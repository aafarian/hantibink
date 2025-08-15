/**
 * Database seeding script
 * Run with: node src/scripts/seed.js
 */

const { getPrismaClient } = require('../config/database');
const logger = require('../utils/logger');

async function seedDatabase() {
  const prisma = getPrismaClient();

  try {
    logger.info('🌱 Starting database seeding...');

    // Create default interests
    const interests = [
      { name: 'Hiking', category: 'Outdoor' },
      { name: 'Coffee', category: 'Food & Drink' },
      { name: 'Photography', category: 'Creative' },
      { name: 'Music', category: 'Arts' },
      { name: 'Technology', category: 'Professional' },
      { name: 'Travel', category: 'Lifestyle' },
      { name: 'Art', category: 'Creative' },
      { name: 'Food', category: 'Food & Drink' },
      { name: 'History', category: 'Education' },
      { name: 'Culture', category: 'Education' },
      { name: 'Reading', category: 'Education' },
      { name: 'Dance', category: 'Arts' },
      { name: 'Fitness', category: 'Health' },
      { name: 'Health', category: 'Health' },
      { name: 'Sports', category: 'Outdoor' },
      { name: 'Movies', category: 'Entertainment' },
      { name: 'Gaming', category: 'Entertainment' },
      { name: 'Cooking', category: 'Food & Drink' },
      { name: 'Wine', category: 'Food & Drink' },
      { name: 'Fashion', category: 'Lifestyle' },
      { name: 'Business', category: 'Professional' },
      { name: 'Entrepreneurship', category: 'Professional' },
      { name: 'Yoga', category: 'Health' },
      { name: 'Meditation', category: 'Health' },
      { name: 'Volunteering', category: 'Social' },
      { name: 'Animals', category: 'Lifestyle' },
      { name: 'Nature', category: 'Outdoor' },
      { name: 'Camping', category: 'Outdoor' },
      { name: 'Skiing', category: 'Outdoor' },
      { name: 'Swimming', category: 'Outdoor' },
    ];

    logger.info('📝 Creating interests...');
    for (const interest of interests) {
      await prisma.interest.upsert({
        where: { name: interest.name },
        update: {},
        create: interest,
      });
    }

    logger.info(`✅ Created ${interests.length} interests`);

    // Create sample users for development
    if (process.env.NODE_ENV === 'development') {
      logger.info('👥 Creating sample users for development...');

      const sampleUsers = [
        {
          email: 'ani@example.com',
          password: '$2a$10$example.hash.for.development', // This should be properly hashed
          name: 'Ani',
          age: 25,
          birthDate: new Date('1999-01-15'),
          gender: 'FEMALE',
          interestedIn: ['MALE'],
          bio: 'Love hiking and Armenian coffee ☕',
          location: 'Yerevan, Armenia',
          latitude: 40.1792,
          longitude: 44.4991,
          isActive: true,
          hasCompletedOnboarding: true,
        },
        {
          email: 'saro@example.com',
          password: '$2a$10$example.hash.for.development',
          name: 'Saro',
          age: 28,
          birthDate: new Date('1996-05-20'),
          gender: 'MALE',
          interestedIn: ['FEMALE'],
          bio: 'Software developer by day, musician by night 🎸',
          location: 'Yerevan, Armenia',
          latitude: 40.1792,
          longitude: 44.4991,
          isActive: true,
          hasCompletedOnboarding: true,
        },
      ];

      for (const userData of sampleUsers) {
        const existingUser = await prisma.user.findUnique({
          where: { email: userData.email },
        });

        if (!existingUser) {
          const user = await prisma.user.create({
            data: userData,
          });

          // Add some interests to the user
          const userInterests = await prisma.interest.findMany({
            take: 3,
            where: {
              name: {
                in:
                  userData.name === 'Ani'
                    ? ['Hiking', 'Coffee', 'Photography']
                    : ['Music', 'Technology', 'Travel'],
              },
            },
          });

          for (const interest of userInterests) {
            await prisma.userInterest.create({
              data: {
                userId: user.id,
                interestId: interest.id,
              },
            });
          }

          logger.info(`✅ Created sample user: ${userData.name}`);
        }
      }
    }

    logger.info('🎉 Database seeding completed successfully');
  } catch (error) {
    logger.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase().catch((error) => {
    logger.error('Seeding failed:', error);
    process.exit(1);
  });
}

module.exports = { seedDatabase };
