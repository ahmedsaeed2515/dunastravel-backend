import { Prisma, PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  encryptSensitiveField,
  encryptSensitiveJson,
} from '../common/security/field-encryption.util';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
if (!/^[a-fA-F0-9]{64}$/.test(process.env.PII_ENCRYPTION_KEY ?? '')) {
  throw new Error('A valid PII_ENCRYPTION_KEY is required');
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const batchSize = 500;

function requiresJsonEncryption(value: unknown): boolean {
  return (
    value !== null &&
    value !== undefined &&
    !(typeof value === 'string' && value.startsWith('enc:v1:'))
  );
}

async function encryptUsers() {
  let cursor: string | undefined;
  let updated = 0;
  while (true) {
    const rows = await prisma.user.findMany({
      select: {
        id: true,
        passportNumber: true,
        emergencyContact: true,
        address: true,
        familyMembers: true,
        travelCompanions: true,
      },
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });
    if (!rows.length) break;
    const plaintextRows = rows.filter((row) =>
      [
        row.passportNumber && !row.passportNumber.startsWith('enc:v1:'),
        requiresJsonEncryption(row.emergencyContact),
        requiresJsonEncryption(row.address),
        requiresJsonEncryption(row.familyMembers),
        requiresJsonEncryption(row.travelCompanions),
      ].some(Boolean),
    );
    if (plaintextRows.length) {
      await prisma.$transaction(
        plaintextRows.map((row) =>
          prisma.user.update({
            where: { id: row.id },
            data: {
              ...(row.passportNumber &&
                !row.passportNumber.startsWith('enc:v1:') && {
                  passportNumber: encryptSensitiveField(row.passportNumber),
                }),
              ...(requiresJsonEncryption(row.emergencyContact) && {
                emergencyContact: encryptSensitiveJson(
                  row.emergencyContact,
                ) as Prisma.InputJsonValue,
              }),
              ...(requiresJsonEncryption(row.address) && {
                address: encryptSensitiveJson(
                  row.address,
                ) as Prisma.InputJsonValue,
              }),
              ...(requiresJsonEncryption(row.familyMembers) && {
                familyMembers: encryptSensitiveJson(
                  row.familyMembers,
                ) as Prisma.InputJsonValue,
              }),
              ...(requiresJsonEncryption(row.travelCompanions) && {
                travelCompanions: encryptSensitiveJson(
                  row.travelCompanions,
                ) as Prisma.InputJsonValue,
              }),
            },
          }),
        ),
      );
      updated += plaintextRows.length;
    }
    cursor = rows[rows.length - 1]?.id;
  }
  return updated;
}

async function encryptPassengerPassports() {
  let cursor: string | undefined;
  let updated = 0;
  while (true) {
    const rows = await prisma.passenger.findMany({
      where: { passportNumber: { not: null } },
      select: { id: true, passportNumber: true },
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });
    if (!rows.length) break;
    const plaintextRows = rows.filter(
      (row) => !row.passportNumber?.startsWith('enc:v1:'),
    );
    if (plaintextRows.length) {
      await prisma.$transaction(
        plaintextRows.map((row) =>
          prisma.passenger.update({
            where: { id: row.id },
            data: {
              passportNumber: encryptSensitiveField(row.passportNumber),
            },
          }),
        ),
      );
      updated += plaintextRows.length;
    }
    cursor = rows[rows.length - 1]?.id;
  }
  return updated;
}

async function main() {
  const [usersUpdated, passengersUpdated] = await Promise.all([
    encryptUsers(),
    encryptPassengerPassports(),
  ]);
  console.log(
    `PII encryption completed: ${usersUpdated} users, ${passengersUpdated} passengers`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : 'PII encryption failed',
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
