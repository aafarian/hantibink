const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Test user configurations
const TEST_USERS = [
  // Males interested in females
  { name: 'Harry', gender: 'MALE', interestedIn: ['FEMALE'], age: 25, bio: 'Test user Harry' },
  { name: 'James', gender: 'MALE', interestedIn: ['FEMALE'], age: 28, bio: 'Test user James' },
  { name: 'Oliver', gender: 'MALE', interestedIn: ['FEMALE'], age: 30, bio: 'Test user Oliver' },
  { name: 'Jack', gender: 'MALE', interestedIn: ['FEMALE'], age: 22, bio: 'Test user Jack' },
  { name: 'Charlie', gender: 'MALE', interestedIn: ['FEMALE'], age: 35, bio: 'Test user Charlie' },
  
  // Females interested in males
  { name: 'Emma', gender: 'FEMALE', interestedIn: ['MALE'], age: 24, bio: 'Test user Emma' },
  { name: 'Sophie', gender: 'FEMALE', interestedIn: ['MALE'], age: 26, bio: 'Test user Sophie' },
  { name: 'Grace', gender: 'FEMALE', interestedIn: ['MALE'], age: 29, bio: 'Test user Grace' },
  { name: 'Lily', gender: 'FEMALE', interestedIn: ['MALE'], age: 23, bio: 'Test user Lily' },
  { name: 'Mia', gender: 'FEMALE', interestedIn: ['MALE'], age: 31, bio: 'Test user Mia' },
  
  // Males interested in everyone
  { name: 'Alex', gender: 'MALE', interestedIn: ['MALE', 'FEMALE', 'OTHER'], age: 27, bio: 'Test user Alex' },
  { name: 'Sam', gender: 'MALE', interestedIn: ['MALE', 'FEMALE', 'OTHER'], age: 25, bio: 'Test user Sam' },
  
  // Females interested in everyone
  { name: 'Jordan', gender: 'FEMALE', interestedIn: ['MALE', 'FEMALE', 'OTHER'], age: 26, bio: 'Test user Jordan' },
  { name: 'Casey', gender: 'FEMALE', interestedIn: ['MALE', 'FEMALE', 'OTHER'], age: 28, bio: 'Test user Casey' },
  
  // Others
  { name: 'River', gender: 'OTHER', interestedIn: ['MALE', 'FEMALE', 'OTHER'], age: 24, bio: 'Test user River' },
  { name: 'Sky', gender: 'OTHER', interestedIn: ['FEMALE'], age: 27, bio: 'Test user Sky' },
  
  // Males interested in males
  { name: 'David', gender: 'MALE', interestedIn: ['MALE'], age: 26, bio: 'Test user David' },
  { name: 'Ryan', gender: 'MALE', interestedIn: ['MALE'], age: 29, bio: 'Test user Ryan' },
  
  // Females interested in females
  { name: 'Sarah', gender: 'FEMALE', interestedIn: ['FEMALE'], age: 25, bio: 'Test user Sarah' },
  { name: 'Kate', gender: 'FEMALE', interestedIn: ['FEMALE'], age: 27, bio: 'Test user Kate' },
];

async function createTestUsers() {
  try {
    console.log('🚀 Starting test user creation...\n');
    
    // Get a reference user to copy location and photo from
    const referenceUser = await prisma.user.findFirst({
      where: {
        photos: {
          some: {}
        },
        latitude: { not: null },
        longitude: { not: null }
      },
      include: {
        photos: {
          take: 1
        }
      }
    });
    
    if (!referenceUser) {
      console.error('❌ No reference user found with photos and location. Please ensure at least one user exists with these fields.');
      return;
    }
    
    console.log(`📍 Using ${referenceUser.name} as reference for location and photos\n`);
    
    // Hash the password once (all users use the same password)
    const hashedPassword = await bcrypt.hash('Aaaaaa1', 10);
    
    let createdCount = 0;
    let skippedCount = 0;
    
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
          
          // Copy location from reference user
          location: referenceUser.location || 'Los Angeles, CA',
          latitude: referenceUser.latitude || 34.0522,
          longitude: referenceUser.longitude || -118.2437,
          
          // Profile details (randomized but reasonable)
          education: ['High School', 'Associate Degree', 'Bachelor\'s Degree', 'Master\'s Degree'][Math.floor(Math.random() * 4)],
          profession: ['Software Engineer', 'Designer', 'Teacher', 'Marketing Manager', 'Entrepreneur', 'Student'][Math.floor(Math.random() * 6)],
          height: `${5 + Math.floor(Math.random() * 2)}'${Math.floor(Math.random() * 12)}" (${160 + Math.floor(Math.random() * 30)}cm)`,
          relationshipType: 'serious, casual',
          religion: ['Christianity', 'None', 'Spiritual', 'Agnostic'][Math.floor(Math.random() * 4)],
          smoking: ['Never', 'Sometimes', 'Regularly'][Math.floor(Math.random() * 3)],
          drinking: ['Never', 'Socially', 'Regularly'][Math.floor(Math.random() * 3)],
          pets: ['Dog', 'Cat', 'None', 'Both'][Math.floor(Math.random() * 4)],
          travel: ['Love it', 'Sometimes', 'Rarely'][Math.floor(Math.random() * 3)],
          languages: ['English'],
          
          // Flags
          isActive: true,
          isPremium: false,
          hasCompletedOnboarding: true,
          onboardingStep: 0,
          lastActive: new Date(),
        }
      });
      
      // Copy a photo from the reference user
      if (referenceUser.photos.length > 0) {
        const referencePhoto = referenceUser.photos[0];
        const photo = await prisma.photo.create({
          data: {
            userId: newUser.id,
            url: referencePhoto.url, // Using the same photo URL
            isMain: true,
            order: 0,
          }
        });
        
        // Update user's mainPhotoId
        await prisma.user.update({
          where: { id: newUser.id },
          data: { mainPhotoId: photo.id }
        });
      }
      
      console.log(`✅ Created ${userData.name} (${userData.gender} interested in ${userData.interestedIn.join(', ')})`);
      createdCount++;
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Created: ${createdCount} users`);
    console.log(`   ⏩ Skipped: ${skippedCount} users (already existed)`);
    console.log(`\n🔑 All users have password: Aaaaaa1`);
    console.log(`📧 Email format: name@name.com (e.g., harry@harry.com)`);
    
  } catch (error) {
    console.error('❌ Error creating test users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createTestUsers();