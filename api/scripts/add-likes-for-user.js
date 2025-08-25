#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addLikesForUser(userEmail, numberOfLikes = 10) {
  try {
    console.log(`\n💕 Adding ${numberOfLikes} likes for user: ${userEmail}\n`);
    
    // 1. Find the target user
    const targetUser = await prisma.user.findUnique({
      where: { email: userEmail },
    });
    
    if (!targetUser) {
      console.error(`❌ User with email ${userEmail} not found`);
      return;
    }
    
    console.log(`✅ Found user: ${targetUser.name} (ID: ${targetUser.id})`);
    console.log(`   Gender: ${targetUser.gender}`);
    
    // 2. Get users who haven't already liked or been acted on by the target user
    const existingActions = await prisma.userAction.findMany({
      where: {
        OR: [
          { senderId: targetUser.id }, // Target user's actions
          { receiverId: targetUser.id }, // Actions towards target user
        ],
      },
      select: {
        senderId: true,
        receiverId: true,
      },
    });
    
    // Get IDs of users who have already interacted
    const excludedIds = new Set([targetUser.id]);
    existingActions.forEach(action => {
      excludedIds.add(action.senderId);
      excludedIds.add(action.receiverId);
    });
    
    // 3. Find potential users to create likes from
    const potentialLikers = await prisma.user.findMany({
      where: {
        id: { notIn: Array.from(excludedIds) },
        isActive: true,
        // Get users who would be interested in this user's gender
        OR: [
          { interestedIn: { has: targetUser.gender } },
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
      take: numberOfLikes * 2, // Get extra in case some fail
    });
    
    console.log(`\n📋 Found ${potentialLikers.length} potential users who could like ${targetUser.name}`);
    
    if (potentialLikers.length === 0) {
      console.log('❌ No available users found to create likes from');
      return;
    }
    
    // 4. Randomly select users and create likes
    const shuffled = potentialLikers.sort(() => Math.random() - 0.5);
    const selectedLikers = shuffled.slice(0, numberOfLikes);
    
    console.log(`\n🎲 Creating ${selectedLikers.length} new likes...\n`);
    
    let likesCreated = 0;
    let superLikesCreated = 0;
    
    for (const liker of selectedLikers) {
      try {
        // 20% chance of super like
        const actionType = Math.random() < 0.2 ? 'SUPER_LIKE' : 'LIKE';
        
        await prisma.userAction.create({
          data: {
            senderId: liker.id,
            receiverId: targetUser.id,
            action: actionType,
          },
        });
        
        if (actionType === 'SUPER_LIKE') {
          console.log(`  ⭐ ${liker.name} (${liker.gender}) super liked ${targetUser.name}`);
          superLikesCreated++;
        } else {
          console.log(`  ❤️  ${liker.name} (${liker.gender}) liked ${targetUser.name}`);
          likesCreated++;
        }
      } catch (error) {
        console.log(`  ⚠️  Skipped ${liker.name} - ${error.message}`);
      }
    }
    
    // 5. Update the target user's total likes count
    const totalNewLikes = likesCreated + superLikesCreated;
    if (totalNewLikes > 0) {
      await prisma.user.update({
        where: { id: targetUser.id },
        data: {
          totalLikes: { increment: totalNewLikes },
        },
      });
    }
    
    console.log(`\n✨ Summary:`);
    console.log(`   • Created ${likesCreated} regular likes`);
    console.log(`   • Created ${superLikesCreated} super likes`);
    console.log(`   • Total: ${totalNewLikes} new likes for ${targetUser.name}`);
    console.log(`\n🎯 These users will now appear in ${targetUser.name}'s "Liked You" section`);
    
  } catch (error) {
    console.error('❌ Error adding likes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const userEmail = args[0] || 'a@a.com';
const numberOfLikes = parseInt(args[1]) || 10;

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node add-likes-for-user.js [email] [number]

Examples:
  node add-likes-for-user.js                    # Add 10 likes for a@a.com
  node add-likes-for-user.js a@a.com 20         # Add 20 likes for a@a.com
  node add-likes-for-user.js john@example.com 5 # Add 5 likes for john@example.com

Options:
  --help, -h    Show this help message
`);
  process.exit(0);
}

// Run the script
addLikesForUser(userEmail, numberOfLikes).then(() => {
  console.log('\n✅ Done!\n');
  process.exit(0);
}).catch((error) => {
  console.error('Failed:', error);
  process.exit(1);
});