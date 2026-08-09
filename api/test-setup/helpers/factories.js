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
      gender: faker.helpers.arrayElement(['MAN', 'WOMAN', 'OTHER']),
      interestedIn: faker.helpers.arrayElements(['MAN', 'WOMAN', 'OTHER'], { min: 1, max: 2 }),
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
      isDiscoverable: true,
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

// UserInterest factory - links users to interests
export const userInterestFactory = {
  create: async (prisma, userId, interestId) => {
    return prisma.userInterest.create({
      data: { userId, interestId },
    });
  },

  addInterestsToUser: async (prisma, userId, interestNames) => {
    const interests = [];
    const userInterests = [];

    for (const name of interestNames) {
      // Find or create interest (handle unique constraint)
      let interest = await prisma.interest.findUnique({
        where: { name },
      });

      if (!interest) {
        interest = await prisma.interest.create({
          data: { name },
        });
      }
      interests.push(interest);

      // Create user interest link
      const userInterest = await prisma.userInterest.create({
        data: { userId, interestId: interest.id },
      });
      userInterests.push(userInterest);
    }

    return { interests, userInterests };
  },
};

// UserAction factory - likes, passes, super likes
export const userActionFactory = {
  build: (senderId, receiverId, action = 'LIKE', overrides = {}) => ({
    senderId,
    receiverId,
    action,
    ...overrides,
  }),

  create: async (prisma, senderId, receiverId, action = 'LIKE', overrides = {}) => {
    const data = userActionFactory.build(senderId, receiverId, action, overrides);
    return prisma.userAction.create({ data });
  },

  createLike: async (prisma, senderId, receiverId) => {
    return userActionFactory.create(prisma, senderId, receiverId, 'LIKE');
  },

  createPass: async (prisma, senderId, receiverId) => {
    return userActionFactory.create(prisma, senderId, receiverId, 'PASS');
  },

  createSuperLike: async (prisma, senderId, receiverId) => {
    return userActionFactory.create(prisma, senderId, receiverId, 'SUPER_LIKE');
  },
};

// Message factory
export const messageFactory = {
  build: (matchId, senderId, receiverId, overrides = {}) => ({
    matchId,
    senderId,
    receiverId,
    content: faker.lorem.sentence(),
    messageType: 'TEXT',
    ...overrides,
  }),

  create: async (prisma, matchId, senderId, receiverId, overrides = {}) => {
    const data = messageFactory.build(matchId, senderId, receiverId, overrides);
    return prisma.message.create({ data });
  },

  createMany: async (prisma, matchId, senderId, receiverId, count = 5) => {
    const messages = [];
    for (let i = 0; i < count; i++) {
      const message = await messageFactory.create(prisma, matchId, senderId, receiverId);
      messages.push(message);
    }
    return messages;
  },
};

// MessageReaction factory
export const messageReactionFactory = {
  create: async (prisma, messageId, userId, emoji = '❤️') => {
    return prisma.messageReaction.create({
      data: { messageId, userId, emoji },
    });
  },
};

// BlockedUser factory
export const blockedUserFactory = {
  create: async (prisma, blockerId, blockedId) => {
    return prisma.blockedUser.create({
      data: { blockerId, blockedId },
    });
  },
};

// MutedMatch factory
export const mutedMatchFactory = {
  create: async (prisma, userId, matchId) => {
    return prisma.mutedMatch.create({
      data: { userId, matchId },
    });
  },
};

// Report factory
export const reportFactory = {
  build: (reporterId, reportedId, reason = 'SPAM', overrides = {}) => ({
    reporterId,
    reportedId,
    reason,
    status: 'PENDING',
    ...overrides,
  }),

  create: async (prisma, reporterId, reportedId, reason = 'SPAM', overrides = {}) => {
    const data = reportFactory.build(reporterId, reportedId, reason, overrides);
    return prisma.report.create({ data });
  },
};