const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function resetUserLikesAndMatches(userEmail) {
  try {
    console.log(`🔄 Starting reset for user: ${userEmail}`);
    
    // 1. Find the user
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });
    
    if (!user) {
      console.error(`❌ User with email ${userEmail} not found`);
      return;
    }
    
    console.log(`✅ Found user: ${user.name} (ID: ${user.id})`);
    
    // 2. Delete all matches involving this user
    const matchesDeleted = await prisma.match.deleteMany({
      where: {
        OR: [
          { user1Id: user.id },
          { user2Id: user.id },
        ],
      },
    });
    console.log(`🗑️  Deleted ${matchesDeleted.count} matches`);
    
    // 3. Delete all user actions where this user was the sender (their swipes)
    const actionsAsSenderDeleted = await prisma.userAction.deleteMany({
      where: { senderId: user.id },
    });
    console.log(`🗑️  Deleted ${actionsAsSenderDeleted.count} actions where user swiped`);
    
    // 4. Delete all user actions where this user was the receiver (likes they received)
    const actionsAsReceiverDeleted = await prisma.userAction.deleteMany({
      where: { receiverId: user.id },
    });
    console.log(`🗑️  Deleted ${actionsAsReceiverDeleted.count} actions where user was liked`);
    
    // 5. Reset user's match and like counts
    await prisma.user.update({
      where: { id: user.id },
      data: {
        totalLikes: 0,
        totalMatches: 0,
      },
    });
    console.log(`📊 Reset user's totalLikes and totalMatches to 0`);
    
    console.log(`\n✨ Successfully reset all data for ${user.name}`);
    
    // 6. Now add some fresh likes from other users
    console.log(`\n💕 Adding fresh likes for ${user.name}...`);
    
    // Get some random users to like our user
    const potentialLikers = await prisma.user.findMany({
      where: {
        id: { not: user.id },
        isActive: true,
        // Get users who would be interested in this user's gender
        OR: [
          { interestedIn: { has: user.gender } },
          // Include users interested in everyone (all 3 genders)
          {
            AND: [
              { interestedIn: { has: 'MALE' } },
              { interestedIn: { has: 'FEMALE' } },
              { interestedIn: { has: 'OTHER' } }
            ]
          }
        ]
      },
      take: 20, // Get up to 20 users
    });
    
    console.log(`Found ${potentialLikers.length} potential users to create likes from`);
    
    // Create likes from these users
    let likesCreated = 0;
    for (const liker of potentialLikers) {
      try {
        // Randomly decide if this is a regular like or super like (10% chance of super like)
        const actionType = Math.random() < 0.1 ? 'SUPER_LIKE' : 'LIKE';
        
        await prisma.userAction.create({
          data: {
            senderId: liker.id,
            receiverId: user.id,
            action: actionType,
          },
        });
        
        likesCreated++;
        console.log(`  ✅ ${liker.name} ${actionType === 'SUPER_LIKE' ? '⭐ super liked' : '❤️ liked'} ${user.name}`);
      } catch (error) {
        console.log(`  ⚠️ Skipped ${liker.name} (might already have an action)`);
      }
    }
    
    // Update the user's total likes count
    await prisma.user.update({
      where: { id: user.id },
      data: {
        totalLikes: likesCreated,
      },
    });
    
    console.log(`\n🎉 Created ${likesCreated} new likes for ${user.name}`);
    console.log(`📋 These users will now appear in ${user.name}'s "Liked You" section`);
    console.log(`🎯 All users are now available in the discovery feed again`);
    
  } catch (error) {
    console.error('❌ Error resetting user data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the reset for a@a.com
resetUserLikesAndMatches('a@a.com').then(() => {
  console.log('\n✅ Reset complete!');
  process.exit(0);
}).catch((error) => {
  console.error('Failed:', error);
  process.exit(1);
});