import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@127.0.0.1:5432/dunastravel_db';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting comprehensive database population with Faker...');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Companies & Agents
  console.log('Generating Companies & Agents...');
  const companies = [];
  for (let i = 0; i < 10; i++) {
    const comp = await prisma.company.create({
      data: {
        referenceCode: `COMP-${faker.string.alphanumeric(6).toUpperCase()}`,
        name: faker.company.name(),
        companyType: faker.helpers.arrayElement(['AGENCY', 'CORPORATE', 'AFFILIATE']),
        status: faker.helpers.arrayElement(['ACTIVE', 'INACTIVE']),
        email: faker.internet.email(),
        phone: faker.phone.number(),
        website: faker.internet.url(),
        taxId: faker.finance.routingNumber(),
        commissionRate: faker.number.float({ min: 5, max: 20, fractionDigits: 2 }),
        address: { city: faker.location.city(), country: faker.location.country() },
        tags: [faker.commerce.department(), faker.commerce.department()]
      }
    });
    companies.push(comp);

    // Agents
    for (let j = 0; j < 2; j++) {
      await prisma.user.create({
        data: {
          name: faker.person.fullName(),
          email: faker.internet.email(),
          passwordHash,
          role: 'AGENT',
          status: 'ACTIVE',
          companyId: comp.id,
          phone: faker.phone.number(),
        }
      });
    }
  }

  // 2. Customers
  console.log('Generating Customers...');
  const customers = [];
  for (let i = 0; i < 30; i++) {
    const cust = await prisma.user.create({
      data: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        passwordHash,
        role: 'USER',
        status: faker.helpers.arrayElement(['ACTIVE', 'ACTIVE', 'ACTIVE', 'SUSPENDED']),
        customerNumber: `CUST-${faker.string.alphanumeric(8).toUpperCase()}`,
        phone: faker.phone.number(),
        isVip: faker.datatype.boolean(0.2), // 20% VIP
        tags: [faker.word.adjective(), faker.word.adjective()],
        segments: [faker.helpers.arrayElement(['Luxury', 'Budget', 'Adventure'])],
        nationality: faker.location.country(),
      }
    });
    customers.push(cust);

    // Wallet
    const wallet = await prisma.wallet.create({
      data: {
        ownerType: 'USER',
        ownerId: cust.id,
        balance: faker.number.float({ min: 0, max: 5000, fractionDigits: 2 }),
        currency: 'USD'
      }
    });
    if (Number(wallet.balance) > 0) {
      await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: wallet.balance,
          type: 'CREDIT',
          referenceType: 'MANUAL_ADDITION',
          status: 'COMPLETED'
        }
      });
    }

    // Customer Notes & Logs
    await prisma.customerNote.create({
      data: {
        customerId: cust.id,
        userId: cust.id, // self-authored or logic doesn't strictly matter for mock
        content: faker.lorem.paragraph(),
        noteType: faker.helpers.arrayElement(['INTERNAL', 'PUBLIC']),
      }
    });
    await prisma.customerActivityLog.create({
      data: {
        customerId: cust.id,
        action: 'PROFILE_UPDATED',
        details: { fields: ['phone', 'address'] }
      }
    });
  }

  // Ensure there are Tours
  const tours = await prisma.tour.findMany();
  if (tours.length === 0) {
    console.error('No tours exist. Please run standard seed first.');
    return;
  }

  // 3. Tour Reviews & Favorites
  console.log('Generating Reviews & Favorites...');
  for (let i = 0; i < 40; i++) {
    const tour = faker.helpers.arrayElement(tours);
    const published = faker.datatype.boolean(0.7);
    await prisma.tourReview.create({
      data: {
        tourId: tour.id,
        rating: faker.number.int({ min: 3, max: 5 }),
        reviewerName: faker.person.fullName(),
        comment: faker.lorem.sentences(2),
        isPublished: published,
        adminReply: published && faker.datatype.boolean() ? faker.lorem.sentence() : null
      }
    });
    
    await prisma.tourFavorite.create({
      data: {
        tourId: tour.id,
        userId: faker.helpers.arrayElement(customers).id
      }
    }).catch(() => {}); // Ignore unique constraint errors
  }

  // 4. Inquiries & Contacts & Notifications
  console.log('Generating Inquiries & Contacts...');
  for (let i = 0; i < 20; i++) {
    await prisma.tailorMadeInquiry.create({
      data: {
        referenceCode: `INQ-${faker.string.alphanumeric(6).toUpperCase()}`,
        fullName: faker.person.fullName(),
        email: faker.internet.email(),
        phone: faker.phone.number(),
        preferredLanguage: 'en',
        adults: faker.number.int({ min: 1, max: 4 }),
        destinations: [faker.location.country()],
        status: faker.helpers.arrayElement(['NEWLY_RECEIVED', 'IN_PROGRESS', 'CLOSED']),
        notes: faker.lorem.paragraph(),
        budgetAmount: faker.number.float({ min: 1000, max: 10000, fractionDigits: 2 }),
        budgetCurrency: 'USD'
      }
    });
  }

  for (let i = 0; i < 15; i++) {
    await prisma.contactSubmission.create({
      data: {
        referenceCode: `CON-${faker.string.alphanumeric(6).toUpperCase()}`,
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        subject: faker.lorem.sentence(),
        message: faker.lorem.paragraph(),
        status: faker.helpers.arrayElement(['NEW', 'READ', 'ARCHIVED']),
      }
    });
  }

  for (let i = 0; i < 50; i++) {
    await prisma.notificationDeliveryLog.create({
      data: {
        notificationType: faker.helpers.arrayElement(['CUSTOMER_ACKNOWLEDGMENT', 'INTERNAL_SALES_ALERT']),
        originReferenceCode: faker.string.alphanumeric(8),
        originEntityType: 'BOOKING',
        recipientEmail: faker.internet.email(),
        status: faker.helpers.arrayElement(['PENDING', 'SENT', 'FAILED']),
      }
    });
  }

  // 5. Promotions & CMS & Settings
  console.log('Generating Configs & Promos...');
  for (let i = 0; i < 5; i++) {
    await prisma.promotion.create({
      data: {
        code: faker.string.alphanumeric({ length: 8, casing: 'upper' }),
        discountPercent: faker.number.int({ min: 5, max: 30 }),
        validFrom: faker.date.recent(),
        validUntil: faker.date.future(),
        maxUses: 100,
        isActive: true
      }
    });
  }

  await prisma.emailTemplate.create({
    data: {
      name: 'Welcome Email ' + Date.now(),
      subject: 'Welcome to Dunas Travel',
      bodyHtml: '<h1>Welcome {{name}}</h1><p>Thanks for joining!</p>',
      variables: ['name']
    }
  });

  // 6. Bookings
  console.log('Generating Complex Bookings...');
  for (let i = 0; i < 50; i++) {
    const cust = faker.helpers.arrayElement(customers);
    const tour = faker.helpers.arrayElement(tours);
    const comp = faker.datatype.boolean(0.2) ? faker.helpers.arrayElement(companies) : null;
    const refCode = `BKG-COMP-${faker.string.alphanumeric(6).toUpperCase()}`;
    const status = faker.helpers.arrayElement(['PENDING', 'CONFIRMED', 'PAID', 'CANCELLED']);
    
    const adults = faker.number.int({ min: 1, max: 4 });
    const amount = Number(tour.basePriceUsd) * adults;

    const booking = await prisma.booking.create({
      data: {
        referenceCode: refCode,
        userId: cust.id,
        tourId: tour.id,
        companyId: comp?.id,
        status: status as any,
        arrivalDate: faker.date.soon({ days: 60 }),
        adults,
        totalAmountUsd: amount,
        paidAmountUsd: ['PAID', 'CONFIRMED'].includes(status) ? amount : 0,
        bookingType: 'BOOKING',
        priority: faker.helpers.arrayElement(['LOW', 'MEDIUM', 'HIGH']),
        notes: faker.lorem.sentence(),
        billingInfo: {
          create: {
            fullName: cust.name,
            email: cust.email,
            phone: cust.phone || '+0000',
            invoiceType: comp ? 'COMPANY' : 'PERSONAL'
          }
        },
        passengers: {
          create: Array.from({ length: adults }).map(() => ({
            passengerType: 'ADULT',
            fullName: faker.person.fullName(),
            passportNumber: faker.string.alphanumeric(8).toUpperCase()
          }))
        }
      }
    });

    if (Number(booking.paidAmountUsd) > 0) {
      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          amount: booking.paidAmountUsd,
          currency: 'USD',
          method: 'CREDIT_CARD',
          status: 'CAPTURED',
          transactionId: `txn_${faker.string.alphanumeric(10)}`
        }
      });
      await prisma.invoice.create({
        data: {
          bookingId: booking.id,
          invoiceNumber: `INV-${refCode}`
        }
      });
    }

    if (comp) {
      await prisma.commission.create({
        data: {
          bookingId: booking.id,
          companyId: comp.id,
          rate: comp.commissionRate,
          amount: amount * (Number(comp.commissionRate) / 100),
          status: faker.helpers.arrayElement(['PENDING', 'APPROVED', 'PAID'])
        }
      });
    }

    await prisma.bookingNote.create({
      data: {
        bookingId: booking.id,
        userId: cust.id,
        content: faker.lorem.paragraph()
      }
    });
  }

  console.log('\n✅ Comprehensive Seed Complete!\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
