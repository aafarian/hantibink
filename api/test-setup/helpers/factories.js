import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import { generateTokenPair } from '../../src/utils/jwt.js';

// User factory
export const userFactory = {
  build: (overrides = {}) => {
    const birthDate = faker.date.birthdate({ min: 18, max: 65, mode: 'age' });
    
    return {
      email: faker.internet.email().toLowerCase(),
      password: 'Test123!@#',
      firebaseUid: faker.string.uuid(),
      name: faker.person.fullName(),
      birthDate,
      gender: faker.helpers.arrayElement(['MALE', 'FEMALE', 'OTHER']),
      interestedIn: faker.helpers.arrayElements(['MALE', 'FEMALE'], { min: 1, max: 2 }),
      bio: faker.lorem.paragraph(),
      profession: faker.person.jobTitle(),
      education: faker.helpers.arrayElement([
        'High School',
        'Some College',
        'Bachelor\'s Degree',
        'Master\'s Degree',
        'PhD',
      ]),
      height: faker.helpers.arrayElement(['5\'6" (168cm)', '5\'10" (178cm)', '6\'0" (183cm)']),
      latitude: faker.location.latitude(),
      longitude: faker.location.longitude(),
      isActive: true,
      isPremium: false,
      ...overrides,
    };
  },

  create: async (prisma, overrides = {}) => {
    const userData = userFactory.build(overrides);
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    return prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
      },
    });
  },

  createWithAuth: async (prisma, overrides = {}) => {
    const user = await userFactory.create(prisma, overrides);
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      firebaseUid: user.firebaseUid,
    });
    
    return {
      user,
      ...tokens,
      authHeader: `Bearer ${tokens.accessToken}`,
    };
  },

  createMany: async (prisma, count = 3, overrides = {}) => {
    const users = [];
    for (let i = 0; i < count; i++) {
      const user = await userFactory.create(prisma, {
        email: `user${i}@example.com`,
        ...overrides,
      });
      users.push(user);
    }
    return users;
  },
};

// Photo factory
export const photoFactory = {
  build: (userId, overrides = {}) => ({
    userId,
    url: faker.image.avatar(),
    order: 0,
    isMain: false,
    isVerified: false,
    ...overrides,
  }),

  create: async (prisma, userId, overrides = {}) => {
    const data = photoFactory.build(userId, overrides);
    return prisma.photo.create({
      data,
    });
  },

  createMany: async (prisma, userId, count = 3) => {
    const photos = [];
    for (let i = 0; i < count; i++) {
      const photo = await photoFactory.create(prisma, userId, {
        order: i,
        isMain: i === 0,
      });
      photos.push(photo);
    }
    return photos;
  },
};

// Match factory
export const matchFactory = {
  create: async (prisma, user1Id, user2Id) => {
    return prisma.match.create({
      data: {
        user1Id,
        user2Id,
        isActive: true,
      },
    });
  },
};

// Interest factory
export const interestFactory = {
  build: (name) => ({
    name: name || faker.helpers.arrayElement([
      'Travel',
      'Music',
      'Movies',
      'Books',
      'Fitness',
      'Cooking',
      'Art',
      'Photography',
      'Sports',
      'Gaming',
    ]),
  }),

  create: async (prisma, name) => {
    const data = interestFactory.build(name);
    return prisma.interest.create({
      data,
    });
  },

  createMany: async (prisma, names) => {
    const interests = [];
    for (const name of names) {
      const interest = await interestFactory.create(prisma, name);
      interests.push(interest);
    }
    return interests;
  },
};