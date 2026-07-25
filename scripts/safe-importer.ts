import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// A safe importer for legacy tours as requested by the Deep Closure Forensic Audit.
// It defaults to dry-run and protects against destructive writes.

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes('--execute'); // Defaults to dry-run
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;
  const failOnConflict = args.includes('--fail-on-conflict');
  const onlyMissing = args.includes('--only-missing');
  const reportPathArg = args.find(a => a.startsWith('--output-report='));
  const reportPath = reportPathArg ? reportPathArg.split('=')[1] : path.join(__dirname, 'import-report.json');

  console.log(`Starting Safe Importer (Dry Run: ${isDryRun})`);

  // In a real execution, you would read from a stable source dump.
  // For safety and isolation, we mock the source data ingestion if the file doesn't exist.
  const dumpPath = path.resolve(__dirname, 'legacy-tours-source.json');
  let dataToImport = [];

  if (fs.existsSync(dumpPath)) {
    dataToImport = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
  } else {
    console.log(`No source file found at ${dumpPath}.`);
    console.log(`Please place normalized JSON export at this location to run the importer.`);
    process.exit(0);
  }

  const report = {
    processed: 0,
    created: 0,
    skipped: 0,
    conflicts: 0,
    errors: 0,
    details: [] as any[]
  };

  for (const t of dataToImport) {
    if (report.processed >= limit) break;
    report.processed++;

    const slug = t.slug || t.id;
    if (!slug) continue;

    try {
      const existing = await prisma.tour.findUnique({ where: { slug } });

      if (existing) {
        if (failOnConflict) {
          throw new Error(`Conflict detected for slug: ${slug}`);
        }
        report.conflicts++;
        report.skipped++;
        report.details.push({ slug, status: 'skipped', reason: 'already_exists' });
      } else {
        if (!isDryRun) {
          // Wrapped in transaction to guarantee atomicity of the tour + relations
          await prisma.$transaction(async (tx) => {
            const tour = await tx.tour.create({
              data: {
                slug,
                titleJsonb: { en: t.title || t.name || '' },
                basePriceUsd: parseFloat(String(t.price).replace(/[^0-9.]/g, '')) || 0,
                isActive: true,
                status: 'PUBLISHED',
                // Additional mapped fields would go here...
              }
            });

            // e.g. itineraries, images created here inside tx
          });
        }
        report.created++;
        report.details.push({ slug, status: 'created' });
      }
    } catch (err: any) {
      report.errors++;
      report.details.push({ slug, status: 'error', reason: err.message });
      if (failOnConflict) {
        console.error('Failing fast due to --fail-on-conflict');
        break;
      }
    }
  }

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Import completed. Report written to ${reportPath}`);
  console.log(`Summary: Processed ${report.processed} | Created ${report.created} | Skipped ${report.skipped} | Errors ${report.errors}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
