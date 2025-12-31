import { describe, it, expect, beforeEach, vi } from 'vitest';
import { userFactory, photoFactory, matchFactory, userActionFactory, userInterestFactory } from '@test-helpers/factories.js';

// The discovery service exports only getUsersForDiscovery
// Internal functions (calculateDistance, calculateAge, calculateMatchScore, calculateSharedInterests)
// are tested indirectly through getUsersForDiscovery behavior
const { getUsersForDiscovery } = require('./discoveryService');

describe('Discovery Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUsersForDiscovery - Profile Eligibility', () => {
    it('should throw error when user does not exist', async () => {
      await expect(getUsersForDiscovery('non-existent-id')).rejects.toThrow('User not found');
    });

    it('should throw PROFILE_INCOMPLETE when user has no gender', async () => {
      const user = await userFactory.create(global.prisma, {
        gender: null,
        interestedIn: ['WOMAN'],
      });
      await photoFactory.create(global.prisma, user.id, { isMain: true });

      await expect(getUsersForDiscovery(user.id)).rejects.toThrow('PROFILE_INCOMPLETE');
    });

    it('should throw PROFILE_INCOMPLETE when user has no interestedIn', async () => {
      const user = await userFactory.create(global.prisma, {
        gender: 'MAN',
        interestedIn: [],
      });
      await photoFactory.create(global.prisma, user.id, { isMain: true });

      await expect(getUsersForDiscovery(user.id)).rejects.toThrow('PROFILE_INCOMPLETE');
    });

    it('should throw PHOTOS_REQUIRED when user has no photos', async () => {
      const user = await userFactory.create(global.prisma, {
        gender: 'MAN',
        interestedIn: ['WOMAN'],
        location: 'New York',
      });

      await expect(getUsersForDiscovery(user.id)).rejects.toThrow('PHOTOS_REQUIRED');
    });

    it('should throw LOCATION_REQUIRED when user has no location', async () => {
      const user = await userFactory.create(global.prisma, {
        gender: 'MAN',
        interestedIn: ['WOMAN'],
        location: null,
      });
      await photoFactory.create(global.prisma, user.id, { isMain: true });

      await expect(getUsersForDiscovery(user.id)).rejects.toThrow('LOCATION_REQUIRED');
    });
  });

  describe('getUsersForDiscovery - User Exclusion', () => {
    it('should exclude the current user from results', async () => {
      const user = await createEligibleUser('MAN', ['WOMAN']);
      const results = await getUsersForDiscovery(user.id);

      const selfInResults = results.find(u => u.id === user.id);
      expect(selfInResults).toBeUndefined();
    });

    it('should exclude users already liked by current user', async () => {
      const user1 = await createEligibleUser('MAN', ['WOMAN']);
      const user2 = await createEligibleUser('WOMAN', ['MAN']);

      // User1 likes User2
      await userActionFactory.createLike(global.prisma, user1.id, user2.id);

      const results = await getUsersForDiscovery(user1.id);
      const likedUserInResults = results.find(u => u.id === user2.id);
      expect(likedUserInResults).toBeUndefined();
    });

    it('should exclude users already passed by current user', async () => {
      const user1 = await createEligibleUser('MAN', ['WOMAN']);
      const user2 = await createEligibleUser('WOMAN', ['MAN']);

      // User1 passes User2
      await userActionFactory.createPass(global.prisma, user1.id, user2.id);

      const results = await getUsersForDiscovery(user1.id);
      const passedUserInResults = results.find(u => u.id === user2.id);
      expect(passedUserInResults).toBeUndefined();
    });

    it('should exclude users in active matches', async () => {
      const user1 = await createEligibleUser('MAN', ['WOMAN']);
      const user2 = await createEligibleUser('WOMAN', ['MAN']);

      // Create a match between them
      await matchFactory.create(global.prisma, user1.id, user2.id);

      const results = await getUsersForDiscovery(user1.id);
      const matchedUserInResults = results.find(u => u.id === user2.id);
      expect(matchedUserInResults).toBeUndefined();
    });

    it('should exclude users without photos', async () => {
      const user1 = await createEligibleUser('MAN', ['WOMAN']);

      // Create user2 without photos
      await userFactory.create(global.prisma, {
        gender: 'WOMAN',
        interestedIn: ['MAN'],
        location: 'New York',
        latitude: 40.7580,
        longitude: -73.9855,
        isActive: true,
      });

      const results = await getUsersForDiscovery(user1.id);
      // All results should have photos
      results.forEach(user => {
        expect(user.photos?.length).toBeGreaterThan(0);
      });
    });

    it('should exclude inactive users', async () => {
      const user1 = await createEligibleUser('MAN', ['WOMAN']);

      // Create inactive user
      const inactiveUser = await userFactory.create(global.prisma, {
        gender: 'WOMAN',
        interestedIn: ['MAN'],
        location: 'New York',
        latitude: 40.7580,
        longitude: -73.9855,
        isActive: false,
      });
      await photoFactory.create(global.prisma, inactiveUser.id, { isMain: true });

      const results = await getUsersForDiscovery(user1.id);
      const inactiveInResults = results.find(u => u.id === inactiveUser.id);
      expect(inactiveInResults).toBeUndefined();
    });

    it('should exclude users passed via excludeIds option', async () => {
      const user1 = await createEligibleUser('MAN', ['WOMAN']);
      const user2 = await createEligibleUser('WOMAN', ['MAN']);

      const results = await getUsersForDiscovery(user1.id, {
        excludeIds: [user2.id],
      });

      const excludedInResults = results.find(u => u.id === user2.id);
      expect(excludedInResults).toBeUndefined();
    });
  });

  describe('getUsersForDiscovery - Gender Preference Matching', () => {
    it('should return users matching gender preferences (man seeking woman)', async () => {
      const man = await createEligibleUser('MAN', ['WOMAN']);
      const woman = await createEligibleUser('WOMAN', ['MAN']);
      // Woman also interested in man - mutual interest

      const results = await getUsersForDiscovery(man.id);

      expect(results.length).toBeGreaterThan(0);
      const foundWoman = results.find(u => u.id === woman.id);
      expect(foundWoman).toBeDefined();
    });

    it('should not return users when there is no mutual interest', async () => {
      const man = await createEligibleUser('MAN', ['WOMAN']);
      // Create a woman who is NOT interested in men
      const womanNotInterestedInMen = await userFactory.create(global.prisma, {
        gender: 'WOMAN',
        interestedIn: ['WOMAN'], // Only interested in women
        location: 'New York',
        latitude: 40.7580,
        longitude: -73.9855,
        isActive: true,
      });
      await photoFactory.create(global.prisma, womanNotInterestedInMen.id, { isMain: true });

      const results = await getUsersForDiscovery(man.id);
      const foundWoman = results.find(u => u.id === womanNotInterestedInMen.id);
      expect(foundWoman).toBeUndefined();
    });

    it('should handle EVERYONE preference (all 3 genders)', async () => {
      // User interested in everyone
      const userInterestedInAll = await createEligibleUser('MAN', ['MAN', 'WOMAN', 'OTHER']);

      // Create users of different genders interested in men
      const woman = await createEligibleUser('WOMAN', ['MAN']);
      const otherGender = await createEligibleUser('OTHER', ['MAN']);
      const anotherMan = await createEligibleUser('MAN', ['MAN']);

      const results = await getUsersForDiscovery(userInterestedInAll.id);

      const foundWoman = results.find(u => u.id === woman.id);
      const foundOther = results.find(u => u.id === otherGender.id);
      const foundMan = results.find(u => u.id === anotherMan.id);

      expect(foundWoman).toBeDefined();
      expect(foundOther).toBeDefined();
      expect(foundMan).toBeDefined();
    });
  });

  describe('getUsersForDiscovery - Priority Users (Who Liked Me)', () => {
    it('should prioritize users who liked the current user', async () => {
      const user1 = await createEligibleUser('MAN', ['WOMAN']);
      const user2 = await createEligibleUser('WOMAN', ['MAN']);
      // Create a third user to ensure priority ordering works
      await createEligibleUser('WOMAN', ['MAN']);

      // User2 likes user1 (user1 should see user2 first)
      await userActionFactory.createLike(global.prisma, user2.id, user1.id);

      const results = await getUsersForDiscovery(user1.id);

      // User2 should appear first since they liked user1
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe(user2.id);
    });

    it('should include users who liked me even if I already acted on them is excluded', async () => {
      const user1 = await createEligibleUser('MAN', ['WOMAN']);
      const user2 = await createEligibleUser('WOMAN', ['MAN']);

      // User2 likes user1
      await userActionFactory.createLike(global.prisma, user2.id, user1.id);
      // User1 also likes user2 (mutual - creates action)
      await userActionFactory.createLike(global.prisma, user1.id, user2.id);

      const results = await getUsersForDiscovery(user1.id);

      // User2 should NOT appear because user1 already acted on them
      const foundUser2 = results.find(u => u.id === user2.id);
      expect(foundUser2).toBeUndefined();
    });
  });

  describe('getUsersForDiscovery - Scoring and Sorting', () => {
    it('should return users sorted by match score descending', async () => {
      const user1 = await createEligibleUser('MAN', ['WOMAN']);

      // Create multiple women with different attributes
      // User with better profile completeness should score higher
      const userComplete = await userFactory.create(global.prisma, {
        gender: 'WOMAN',
        interestedIn: ['MAN'],
        location: 'New York',
        latitude: 40.7580,
        longitude: -73.9855,
        isActive: true,
        bio: 'Complete bio here',
        education: 'Master\'s Degree',
        profession: 'Engineer',
        height: '5\'6" (168cm)',
        lastActive: new Date(), // Recently active
      });
      await photoFactory.createMany(global.prisma, userComplete.id, 3);

      const userIncomplete = await userFactory.create(global.prisma, {
        gender: 'WOMAN',
        interestedIn: ['MAN'],
        location: 'Los Angeles',
        latitude: 34.0522,
        longitude: -118.2437,
        isActive: true,
        bio: null,
        education: null,
        profession: null,
        height: null,
        lastActive: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      });
      await photoFactory.create(global.prisma, userIncomplete.id, { isMain: true });

      const results = await getUsersForDiscovery(user1.id);

      expect(results.length).toBe(2);
      // Complete profile should score higher
      expect(results[0].matchScore).toBeGreaterThanOrEqual(results[1].matchScore);
    });

    it('should include matchScore in results', async () => {
      const user1 = await createEligibleUser('MAN', ['WOMAN']);
      await createEligibleUser('WOMAN', ['MAN']);

      const results = await getUsersForDiscovery(user1.id);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('matchScore');
      expect(typeof results[0].matchScore).toBe('number');
    });

    it('should include scoreBreakdown in results', async () => {
      const user1 = await createEligibleUser('MAN', ['WOMAN']);
      await createEligibleUser('WOMAN', ['MAN']);

      const results = await getUsersForDiscovery(user1.id);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('scoreBreakdown');
      expect(typeof results[0].scoreBreakdown).toBe('object');
    });
  });

  describe('getUsersForDiscovery - Distance Calculation', () => {
    it('should calculate distance between users with coordinates', async () => {
      // New York coordinates
      const user1 = await createEligibleUser('MAN', ['WOMAN'], {
        latitude: 40.7128,
        longitude: -74.0060,
      });

      // New Jersey (close to NY)
      const nearbyUser = await createEligibleUser('WOMAN', ['MAN'], {
        latitude: 40.7580,
        longitude: -73.9855,
      });

      const results = await getUsersForDiscovery(user1.id);
      const found = results.find(u => u.id === nearbyUser.id);

      expect(found).toBeDefined();
      expect(found.distance).toBeDefined();
      expect(typeof found.distance).toBe('number');
      // Distance should be reasonable (< 50km for NYC area)
      expect(found.distance).toBeLessThan(50);
    });

    it('should return null distance when user has no coordinates', async () => {
      const user1 = await createEligibleUser('MAN', ['WOMAN']);

      const userNoCoords = await userFactory.create(global.prisma, {
        gender: 'WOMAN',
        interestedIn: ['MAN'],
        location: 'Unknown',
        latitude: null,
        longitude: null,
        isActive: true,
      });
      await photoFactory.create(global.prisma, userNoCoords.id, { isMain: true });

      const results = await getUsersForDiscovery(user1.id);
      const found = results.find(u => u.id === userNoCoords.id);

      expect(found).toBeDefined();
      expect(found.distance).toBeNull();
    });
  });

  describe('getUsersForDiscovery - Age Calculation', () => {
    it('should calculate age from birthDate', async () => {
      const user1 = await createEligibleUser('MAN', ['WOMAN']);

      // Create user born 25 years ago
      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - 25);

      const user25 = await userFactory.create(global.prisma, {
        gender: 'WOMAN',
        interestedIn: ['MAN'],
        location: 'New York',
        latitude: 40.7580,
        longitude: -73.9855,
        isActive: true,
        birthDate,
      });
      await photoFactory.create(global.prisma, user25.id, { isMain: true });

      const results = await getUsersForDiscovery(user1.id);
      const found = results.find(u => u.id === user25.id);

      expect(found).toBeDefined();
      expect(found.age).toBe(25);
    });
  });

  describe('getUsersForDiscovery - Strict Filters', () => {
    it('should apply strict age filter when strictAge is true', async () => {
      const user1 = await createEligibleUser('MAN', ['WOMAN']);

      // Create user aged 40
      const birthDate40 = new Date();
      birthDate40.setFullYear(birthDate40.getFullYear() - 40);

      const user40 = await userFactory.create(global.prisma, {
        gender: 'WOMAN',
        interestedIn: ['MAN'],
        location: 'New York',
        latitude: 40.7580,
        longitude: -73.9855,
        isActive: true,
        birthDate: birthDate40,
      });
      await photoFactory.create(global.prisma, user40.id, { isMain: true });

      // Search with strict age filter (18-30)
      const results = await getUsersForDiscovery(user1.id, {
        filters: {
          ageRange: { min: 18, max: 30 },
          strictAge: true,
        },
      });

      const found40 = results.find(u => u.id === user40.id);
      expect(found40).toBeUndefined();
    });

    it('should apply strict distance filter when strictDistance is true', async () => {
      // User in New York
      const user1 = await createEligibleUser('MAN', ['WOMAN'], {
        latitude: 40.7128,
        longitude: -74.0060,
      });

      // User in Los Angeles (far away)
      const farUser = await userFactory.create(global.prisma, {
        gender: 'WOMAN',
        interestedIn: ['MAN'],
        location: 'Los Angeles',
        latitude: 34.0522,
        longitude: -118.2437,
        isActive: true,
      });
      await photoFactory.create(global.prisma, farUser.id, { isMain: true });

      // Search with strict distance filter (50km)
      const results = await getUsersForDiscovery(user1.id, {
        filters: {
          maxDistance: 50,
          strictDistance: true,
        },
      });

      const foundFar = results.find(u => u.id === farUser.id);
      expect(foundFar).toBeUndefined();
    });
  });

  describe('getUsersForDiscovery - Pagination', () => {
    it('should respect limit parameter', async () => {
      const user1 = await createEligibleUser('MAN', ['WOMAN']);

      // Create 5 potential matches
      for (let i = 0; i < 5; i++) {
        await createEligibleUser('WOMAN', ['MAN']);
      }

      const results = await getUsersForDiscovery(user1.id, { limit: 3 });

      expect(results.length).toBe(3);
    });

    it('should return empty array when no matches found', async () => {
      // User interested in women, but no women exist
      const user1 = await createEligibleUser('MAN', ['WOMAN']);

      const results = await getUsersForDiscovery(user1.id);

      expect(results).toEqual([]);
    });
  });

  describe('getUsersForDiscovery - Shared Interests', () => {
    it('should calculate sharedInterestsCount correctly', async () => {
      const user1 = await createEligibleUser('MAN', ['WOMAN']);
      const user2 = await createEligibleUser('WOMAN', ['MAN']);

      // Add shared interests
      await userInterestFactory.addInterestsToUser(global.prisma, user1.id, ['Travel', 'Music']);
      await userInterestFactory.addInterestsToUser(global.prisma, user2.id, ['Travel', 'Photography']);

      const results = await getUsersForDiscovery(user1.id);
      const found = results.find(u => u.id === user2.id);

      expect(found).toBeDefined();
      expect(found.sharedInterestsCount).toBe(1); // Travel is shared
    });
  });

  describe('getUsersForDiscovery - Response Shape', () => {
    it('should not include password in response', async () => {
      const user1 = await createEligibleUser('MAN', ['WOMAN']);
      await createEligibleUser('WOMAN', ['MAN']);

      const results = await getUsersForDiscovery(user1.id);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).not.toHaveProperty('password');
    });

    it('should not include email in response', async () => {
      const user1 = await createEligibleUser('MAN', ['WOMAN']);
      await createEligibleUser('WOMAN', ['MAN']);

      const results = await getUsersForDiscovery(user1.id);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).not.toHaveProperty('email');
    });

    it('should include mainPhotoUrl in response', async () => {
      const user1 = await createEligibleUser('MAN', ['WOMAN']);
      await createEligibleUser('WOMAN', ['MAN']);

      const results = await getUsersForDiscovery(user1.id);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('mainPhotoUrl');
    });

    it('should include photos array in response', async () => {
      const user1 = await createEligibleUser('MAN', ['WOMAN']);
      await createEligibleUser('WOMAN', ['MAN']);

      const results = await getUsersForDiscovery(user1.id);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('photos');
      expect(Array.isArray(results[0].photos)).toBe(true);
    });

    it('should include matchesPreferences flag in response', async () => {
      const user1 = await createEligibleUser('MAN', ['WOMAN']);
      await createEligibleUser('WOMAN', ['MAN']);

      const results = await getUsersForDiscovery(user1.id);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('matchesPreferences');
      expect(typeof results[0].matchesPreferences).toBe('boolean');
    });
  });
});

// Helper function to create a user eligible for discovery
async function createEligibleUser(gender, interestedIn, overrides = {}) {
  const userData = {
    gender,
    interestedIn,
    location: 'New York',
    latitude: 40.7128 + (Math.random() * 0.1),
    longitude: -74.0060 + (Math.random() * 0.1),
    isActive: true,
    ...overrides,
  };

  const user = await userFactory.create(global.prisma, userData);
  await photoFactory.create(global.prisma, user.id, { isMain: true });

  return user;
}
