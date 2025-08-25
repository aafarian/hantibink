const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createLikesForUser() {
  try {
    console.log('💕 Creating likes for a@a.com user...\n');
    
    // Get a@a.com user
    const targetUser = await prisma.user.findUnique({
      where: { email: 'a@a.com' }
    });
    
    if (!targetUser) {
      console.error('❌ User a@a.com not found.');
      return;
    }
    
    console.log(`🎯 Found target user: ${targetUser.name} (${targetUser.gender})\n`);
    
    // Get all users who would be interested in the target user
    const potentialLikers = await prisma.user.findMany({
      where: {
        id: { not: targetUser.id },
        OR: [
          // Users interested in target's gender
          { interestedIn: { has: targetUser.gender } },
          // Users interested in everyone (all 3 genders)
          {
            AND: [
              { interestedIn: { has: 'MALE' } },
              { interestedIn: { has: 'FEMALE' } },
              { interestedIn: { has: 'OTHER' } }
            ]
          }
        ]
      },
      select: {
        id: true,
        name: true,
        gender: true,
        interestedIn: true
      }
    });
    
    console.log(`Found ${potentialLikers.length} users who could be interested in ${targetUser.name}\n`);
    
    // Select 30% of them to like the target
    const likersCount = Math.min(20, Math.floor(potentialLikers.length * 0.3));
    const selectedLikers = potentialLikers
      .sort(() => Math.random() - 0.5)
      .slice(0, likersCount);
    
    let likesCreated = 0;
    let skipped = 0;
    
    for (const liker of selectedLikers) {
      try {
        // Check if action already exists
        const existingAction = await prisma.userAction.findUnique({
          where: {
            senderId_receiverId: {
              senderId: liker.id,
              receiverId: targetUser.id
            }
          }
        });
        
        if (!existingAction) {
          await prisma.userAction.create({
            data: {
              senderId: liker.id,
              receiverId: targetUser.id,
              action: 'LIKE',
              timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) // Within last week
            }
          });
          
          console.log(`   💕 ${liker.name} (${liker.gender}) liked ${targetUser.name}`);
          likesCreated++;
        } else {
          console.log(`   ⏩ ${liker.name} already acted on ${targetUser.name}`);
          skipped++;
        }
      } catch (error) {
        console.error(`   ❌ Failed to create like from ${liker.name}:`, error.message);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   💕 Likes created: ${likesCreated}`);
    console.log(`   ⏩ Skipped (already acted): ${skipped}`);
    console.log(`   👥 Total potential likers: ${potentialLikers.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createLikesForUser();