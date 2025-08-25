const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function findUser() {
  try {
    // Find users with email containing 'a'
    const users = await prisma.user.findMany({
      where: {
        email: {
          contains: 'a@a',
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
    
    console.log('Users with a@a in email:', users);
    
    // Also try exact match
    const exactUser = await prisma.user.findUnique({
      where: {
        email: 'a@a.com',
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
    
    console.log('User with email a@a.com:', exactUser);
    
    // List first 5 users to see email format
    const firstUsers = await prisma.user.findMany({
      take: 5,
      select: {
        email: true,
        name: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
    
    console.log('\nFirst 5 users in database:');
    firstUsers.forEach(u => console.log(`  - ${u.email} (${u.name})`));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findUser();