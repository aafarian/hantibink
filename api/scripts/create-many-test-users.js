const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Expanded list of names for more diversity
const MALE_NAMES = [
  'Harry', 'James', 'Oliver', 'Jack', 'Charlie', 'Alex', 'Sam', 'David', 'Ryan',
  'Michael', 'Daniel', 'Matthew', 'Joseph', 'Anthony', 'Christopher', 'Andrew',
  'Paul', 'Mark', 'Donald', 'Kenneth', 'Steven', 'Edward', 'Brian', 'Ronald',
  'George', 'Frank', 'Larry', 'Eric', 'Stephen', 'Scott', 'Benjamin', 'Samuel',
  'Nicholas', 'Gary', 'Patrick', 'Nathan', 'Henry', 'Carl', 'Arthur', 'Roger'
];

const FEMALE_NAMES = [
  'Emma', 'Sophie', 'Grace', 'Lily', 'Mia', 'Jordan', 'Casey', 'Sarah', 'Kate',
  'Jennifer', 'Linda', 'Patricia', 'Mary', 'Barbara', 'Susan', 'Jessica', 'Nancy',
  'Lisa', 'Betty', 'Helen', 'Sandra', 'Donna', 'Carol', 'Ruth', 'Sharon', 'Michelle',
  'Laura', 'Kimberly', 'Deborah', 'Amy', 'Anna', 'Amanda', 'Melissa', 'Stephanie',
  'Rebecca', 'Virginia', 'Maria', 'Brenda', 'Catherine', 'Nicole', 'Janet', 'Alice'
];

const OTHER_NAMES = [
  'River', 'Sky', 'Quinn', 'Sage', 'Phoenix', 'Dakota', 'Robin', 'Morgan',
  'Avery', 'Riley', 'Drew', 'Blake', 'Cameron', 'Emerson', 'Finley', 'Hayden'
];

// Bio templates
const BIO_TEMPLATES = [
  'Love hiking and outdoor adventures 🏔️',
  'Coffee addict ☕ Book lover 📚',
  'Gym enthusiast 💪 Healthy lifestyle',
  'Travel junkie ✈️ 30 countries and counting',
  'Foodie 🍕 Always trying new restaurants',
  'Dog parent 🐕 My pup is my world',
  'Netflix and chill kind of person 📺',
  'Music is life 🎵 Concert lover',
  'Beach vibes 🏖️ Sun and sand',
  'Yoga and meditation 🧘 Inner peace',
  'Entrepreneur 💼 Building my empire',
  'Artist at heart 🎨 Creative soul',
  'Sports fanatic ⚽ Game day is the best day',
  'Wine enthusiast 🍷 Love a good vineyard',
  'Dancing is my therapy 💃',
  'Cooking is my passion 👨‍🍳',
  'Photography lover 📸 Capturing moments',
  'Gamer 🎮 Level 99 in life',
  'Film buff 🎬 Always at the cinema',
  'Adventure seeker 🏃 Try everything once'
];

function generateTestUsers(count = 100) {
  const users = [];
  const usedNames = new Set();
  
  // Gender distribution: 40% male, 40% female, 20% other
  const maleCount = Math.floor(count * 0.4);
  const femaleCount = Math.floor(count * 0.4);
  const otherCount = count - maleCount - femaleCount;
  
  // Helper to get unique name
  const getUniqueName = (nameList) => {
    for (const name of nameList) {
      if (!usedNames.has(name)) {
        usedNames.add(name);
        return name;
      }
    }
    // If all names used, add number suffix
    let counter = 2;
    while (true) {
      const name = nameList[0] + counter;
      if (!usedNames.has(name)) {
        usedNames.add(name);
        return name;
      }
      counter++;
    }
  };
  
  // Generate males
  for (let i = 0; i < maleCount; i++) {
    const name = getUniqueName(MALE_NAMES);
    const age = 18 + Math.floor(Math.random() * 33); // 18-50
    
    // Varied interests: 70% interested in females, 20% in males, 10% in everyone
    let interestedIn;
    const rand = Math.random();
    if (rand < 0.7) {
      interestedIn = ['FEMALE'];
    } else if (rand < 0.9) {
      interestedIn = ['MALE'];
    } else {
      interestedIn = ['MALE', 'FEMALE', 'OTHER'];
    }
    
    users.push({
      name,
      gender: 'MALE',
      interestedIn,
      age,
      bio: BIO_TEMPLATES[Math.floor(Math.random() * BIO_TEMPLATES.length)]
    });
  }
  
  // Generate females
  for (let i = 0; i < femaleCount; i++) {
    const name = getUniqueName(FEMALE_NAMES);
    const age = 18 + Math.floor(Math.random() * 33);
    
    // Varied interests: 70% interested in males, 20% in females, 10% in everyone
    let interestedIn;
    const rand = Math.random();
    if (rand < 0.7) {
      interestedIn = ['MALE'];
    } else if (rand < 0.9) {
      interestedIn = ['FEMALE'];
    } else {
      interestedIn = ['MALE', 'FEMALE', 'OTHER'];
    }
    
    users.push({
      name,
      gender: 'FEMALE',
      interestedIn,
      age,
      bio: BIO_TEMPLATES[Math.floor(Math.random() * BIO_TEMPLATES.length)]
    });
  }
  
  // Generate others
  for (let i = 0; i < otherCount; i++) {
    const name = getUniqueName(OTHER_NAMES);
    const age = 18 + Math.floor(Math.random() * 33);
    
    // Others mostly interested in everyone
    const rand = Math.random();
    const interestedIn = rand < 0.8 
      ? ['MALE', 'FEMALE', 'OTHER']
      : rand < 0.9 ? ['FEMALE'] : ['MALE'];
    
    users.push({
      name,
      gender: 'OTHER',
      interestedIn,
      age,
      bio: BIO_TEMPLATES[Math.floor(Math.random() * BIO_TEMPLATES.length)]
    });
  }
  
  return users;
}

async function createTestUsersAndLikes() {
  try {
    console.log('🚀 Starting massive test user creation...\n');
    
    // Get a@a.com user
    const targetUser = await prisma.user.findUnique({
      where: { email: 'a@a.com' }
    });
    
    if (!targetUser) {
      console.error('❌ User a@a.com not found. Please ensure this user exists.');
      return;
    }
    
    console.log(`🎯 Found target user: ${targetUser.name} (${targetUser.id})\n`);
    
    // Get reference user for location and photos
    const referenceUser = await prisma.user.findFirst({
      where: {
        photos: { some: {} },
        latitude: { not: null },
        longitude: { not: null }
      },
      include: {
        photos: { take: 1 }
      }
    });
    
    if (!referenceUser) {
      console.error('❌ No reference user found with photos and location.');
      return;
    }
    
    console.log(`📍 Using ${referenceUser.name} as reference for location and photos\n`);
    
    // Generate test users
    const TEST_USERS = generateTestUsers(80); // Generate 80 more users
    
    // Hash password once
    const hashedPassword = await bcrypt.hash('Aaaaaa1', 10);
    
    let createdCount = 0;
    let skippedCount = 0;
    const createdUserIds = [];
    
    console.log('Creating users...\n');
    
    for (const userData of TEST_USERS) {
      const email = `${userData.name.toLowerCase()}@${userData.name.toLowerCase()}.com`;
      
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });
      
      if (existingUser) {
        console.log(`⏩ Skipping ${userData.name} - already exists`);
        skippedCount++;
        continue;
      }
      
      // Calculate birth date from age
      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - userData.age);
      
      // Create the user
      const newUser = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name: userData.name,
          birthDate,
          gender: userData.gender,
          interestedIn: userData.interestedIn,
          bio: userData.bio,
          
          // Copy location from reference (with slight variations)
          location: referenceUser.location || 'Los Angeles, CA',
          latitude: referenceUser.latitude + (Math.random() * 0.2 - 0.1), // Small variation
          longitude: referenceUser.longitude + (Math.random() * 0.2 - 0.1),
          
          // Profile details (randomized)
          education: ['High School', 'Associate Degree', 'Bachelor\'s Degree', 'Master\'s Degree', 'PhD'][Math.floor(Math.random() * 5)],
          profession: ['Software Engineer', 'Designer', 'Teacher', 'Marketing Manager', 'Entrepreneur', 'Student', 'Doctor', 'Lawyer', 'Artist', 'Consultant'][Math.floor(Math.random() * 10)],
          height: `${5 + Math.floor(Math.random() * 2)}'${Math.floor(Math.random() * 12)}" (${160 + Math.floor(Math.random() * 30)}cm)`,
          relationshipType: ['serious', 'casual', 'friendship', 'serious, casual', 'casual, friendship', 'serious, friendship'][Math.floor(Math.random() * 6)],
          religion: ['Christianity', 'None', 'Spiritual', 'Agnostic', 'Judaism', 'Islam', 'Buddhism'][Math.floor(Math.random() * 7)],
          smoking: ['Never', 'Sometimes', 'Regularly'][Math.floor(Math.random() * 3)],
          drinking: ['Never', 'Socially', 'Regularly', 'Sometimes'][Math.floor(Math.random() * 4)],
          pets: ['Dog', 'Cat', 'None', 'Both', 'Fish', 'Bird'][Math.floor(Math.random() * 6)],
          travel: ['Love it', 'Sometimes', 'Rarely', 'Frequently'][Math.floor(Math.random() * 4)],
          languages: ['English'],
          
          // Flags
          isActive: true,
          isPremium: Math.random() < 0.1, // 10% premium users
          hasCompletedOnboarding: true,
          onboardingStep: 0,
          lastActive: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Active within last week
        }
      });
      
      // Copy photo from reference
      if (referenceUser.photos.length > 0) {
        const referencePhoto = referenceUser.photos[0];
        const photo = await prisma.photo.create({
          data: {
            userId: newUser.id,
            url: referencePhoto.url,
            isMain: true,
            order: 0,
          }
        });
        
        await prisma.user.update({
          where: { id: newUser.id },
          data: { mainPhotoId: photo.id }
        });
      }
      
      createdUserIds.push({
        id: newUser.id,
        name: newUser.name,
        gender: newUser.gender,
        interestedIn: newUser.interestedIn
      });
      
      console.log(`✅ Created ${userData.name} (${userData.gender} → ${userData.interestedIn.join(', ')})`);
      createdCount++;
    }
    
    console.log(`\n📊 User Creation Summary:`);
    console.log(`   ✅ Created: ${createdCount} users`);
    console.log(`   ⏩ Skipped: ${skippedCount} users\n`);
    
    // Now create likes for a@a.com user
    console.log('💕 Creating likes for a@a.com user...\n');
    
    // Select users who would be interested in the target user
    const potentialLikers = createdUserIds.filter(user => {
      // Check if this user would be interested in target user's gender
      return user.interestedIn.includes(targetUser.gender) || 
             user.interestedIn.length === 3; // interested in everyone
    });
    
    // Have 30% of compatible users like the target
    const likersCount = Math.floor(potentialLikers.length * 0.3);
    const selectedLikers = potentialLikers
      .sort(() => Math.random() - 0.5) // Shuffle
      .slice(0, likersCount);
    
    let likesCreated = 0;
    
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
              action: 'LIKE', // Changed from actionType to action
              timestamp: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000) // Within last 3 days
            }
          });
          
          console.log(`   💕 ${liker.name} liked ${targetUser.name}`);
          likesCreated++;
        }
      } catch (error) {
        console.error(`   ❌ Failed to create like from ${liker.name}:`, error.message);
      }
    }
    
    console.log(`\n📊 Final Summary:`);
    console.log(`   👥 Total users created: ${createdCount}`);
    console.log(`   💕 Likes created for a@a.com: ${likesCreated}`);
    console.log(`   🔑 All users have password: Aaaaaa1`);
    console.log(`   📧 Email format: name@name.com`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createTestUsersAndLikes();