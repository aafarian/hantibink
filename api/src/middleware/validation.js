const { body, query, param, validationResult } = require('express-validator');

/**
 * Regular expression for validating ID formats
 * - CUID: starts with 'c' followed by 24-25 lowercase alphanumeric characters (v1 and v2 formats)
 * - UUID: standard UUID v4 format
 */
const ID_REGEX = /^c[a-z0-9]{24,25}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Image URLs must point at an object in OUR Firebase Storage bucket that
 * the requesting user uploaded. Host alone is not enough (any Firebase
 * project shares it), and bucket alone is not enough (another user's
 * object would pass) — the app writes objects as <folder>/<userId>_..., so
 * the path proves both origin and ownership.
 */
const OUR_STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || 'hantibink.firebasestorage.app';

const parseOurStorageObject = (value) => {
  try {
    const url = new URL(value);
    if (url.hostname !== 'firebasestorage.googleapis.com') {
      return null;
    }
    const prefix = `/v0/b/${OUR_STORAGE_BUCKET}/o/`;
    if (!url.pathname.startsWith(prefix)) {
      return null;
    }
    return decodeURIComponent(url.pathname.slice(prefix.length));
  } catch {
    return null;
  }
};

const ownsStorageObject = (folder) => (value, { req }) => {
  const objectPath = parseOurStorageObject(value);
  return !!objectPath && !!req.user?.id && objectPath.startsWith(`${folder}/${req.user.id}_`);
};

/**
 * Validation middleware for handling validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }
  next();
};

/**
 * Auth validation rules
 */
const authValidation = {
  register: [
    body('email')
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail()
      .isLength({ max: 100 }).withMessage('Email must be less than 100 characters'),
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
      .isLength({ max: 100 }).withMessage('Password must be less than 100 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    body('name')
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters')
      .matches(/^[a-zA-Z\s]+$/).withMessage('Name can only contain letters and spaces')
      .trim(),
    // birthDate is now collected during gatekeeping, not registration
    // Gender is now OPTIONAL for registration
    body('gender')
      .optional()
      .isIn(['MAN', 'WOMAN', 'OTHER', 'man', 'woman', 'other']).withMessage('Invalid gender')
      .customSanitizer(value => {
        if (!value) {return undefined;}
        // Normalize to uppercase
        return value.toUpperCase();
      }),
    // InterestedIn is now OPTIONAL for registration
    body('interestedIn')
      .optional()
      .isArray().withMessage('Interested in must be an array')
      .custom((value) => {
        if (!value) {return true;}
        const valid = ['MAN', 'WOMAN', 'OTHER', 'man', 'woman', 'other'];
        return value.every(v => valid.includes(v));
      }).withMessage('Invalid interested in values')
      .customSanitizer(value => {
        if (!value) {return undefined;}
        // Normalize to uppercase
        return value.map(v => v.toUpperCase());
      }),
    handleValidationErrors,
  ],

  login: [
    body('email')
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Password is required'),
    handleValidationErrors,
  ],

  firebaseLogin: [
    body('idToken')
      .notEmpty().withMessage('ID token is required')
      .isString().withMessage('ID token must be a string'),
    handleValidationErrors,
  ],

  refreshToken: [
    body('refreshToken')
      .notEmpty().withMessage('Refresh token is required')
      .isString().withMessage('Refresh token must be a string'),
    handleValidationErrors,
  ],

  forgotPassword: [
    body('email')
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    handleValidationErrors,
  ],

  resetPassword: [
    body('token')
      .notEmpty().withMessage('Reset token is required')
      .isString().withMessage('Token must be a string'),
    body('newPassword')
      .notEmpty().withMessage('New password is required')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    handleValidationErrors,
  ],
};

/**
 * User action validation rules
 */
const actionValidation = {
  like: [
    body('targetUserId')
      .notEmpty().withMessage('Target user ID is required')
      .isString().withMessage('User ID must be a string')
      .matches(ID_REGEX)
      .withMessage('Invalid user ID format'),
    handleValidationErrors,
  ],

  pass: [
    body('targetUserId')
      .notEmpty().withMessage('Target user ID is required')
      .isString().withMessage('User ID must be a string')
      .matches(ID_REGEX)
      .withMessage('Invalid user ID format'),
    handleValidationErrors,
  ],

  superLike: [
    body('targetUserId')
      .notEmpty().withMessage('Target user ID is required')
      .isString().withMessage('User ID must be a string')
      .matches(ID_REGEX)
      .withMessage('Invalid user ID format'),
    handleValidationErrors,
  ],

  getHistory: [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 }).withMessage('Offset must be a positive integer'),
    handleValidationErrors,
  ],

  getWhoLikedMe: [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 }).withMessage('Offset must be a positive integer'),
    handleValidationErrors,
  ],
};

/**
 * Discovery validation rules
 */
const discoveryValidation = {
  getUsers: [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    query('minAge')
      .optional()
      .isInt({ min: 18, max: 100 }).withMessage('Min age must be between 18 and 100'),
    query('maxAge')
      .optional()
      .isInt({ min: 18, max: 100 }).withMessage('Max age must be between 18 and 100'),
    query('maxDistance')
      .optional()
      .isInt({ min: 1, max: 10000 }).withMessage('Max distance must be between 1 and 10000'),
    query('excludeIds')
      .optional()
      .custom((value) => {
        if (typeof value === 'string') {
          const ids = value.split(',');
          return ids.every(id => ID_REGEX.test(id));
        }
        return true;
      }).withMessage('Invalid ID format in excludeIds'),
    handleValidationErrors,
  ],

  filterUsers: [
    body('limit')
      .optional()
      .isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    body('excludeIds')
      .optional()
      .isArray().withMessage('Exclude IDs must be an array')
      .custom((value) => {
        if (Array.isArray(value)) {
          return value.every(id => ID_REGEX.test(id));
        }
        return true;
      }).withMessage('Invalid ID format in excludeIds'),
    body('filters')
      .optional()
      .isObject().withMessage('Filters must be an object'),
    body('filters.ageRange')
      .optional()
      .isObject().withMessage('Age range must be an object'),
    body('filters.ageRange.min')
      .optional()
      .isInt({ min: 18, max: 100 }).withMessage('Min age must be between 18 and 100'),
    body('filters.ageRange.max')
      .optional()
      .isInt({ min: 18, max: 100 }).withMessage('Max age must be between 18 and 100'),
    body('filters.maxDistance')
      .optional()
      .isInt({ min: 1, max: 10000 }).withMessage('Max distance must be between 1 and 10000'),
    handleValidationErrors,
  ],
};

/**
 * Message validation rules
 */
const messageValidation = {
  sendMessage: [
    param('matchId')
      .notEmpty().withMessage('Match ID is required')
      .isString().withMessage('Match ID must be a string')
      .matches(ID_REGEX)
      .withMessage('Invalid match ID format'),
    body('content')
      .notEmpty().withMessage('Message content is required')
      .isString().withMessage('Content must be a string')
      .isLength({ min: 1, max: 2000 }).withMessage('Message must be between 1 and 2000 characters')
      .trim(),
    body('messageType')
      .optional()
      .isIn(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'LOCATION', 'STICKER', 'GIF']).withMessage('Invalid message type'),
    body('mediaUrl')
      .optional({ values: 'falsy' })
      .isURL({ protocols: ['https'], require_protocol: true }).withMessage('Invalid media URL'),
    body('metadata')
      .optional({ values: 'falsy' })
      .custom((value) => {
        if (typeof value !== 'string') {
          throw new Error('Metadata must be a string');
        }
        if (value.length > 2048) {
          throw new Error('Metadata too large');
        }
        try {
          JSON.parse(value);
        } catch {
          throw new Error('Metadata must be valid JSON');
        }
        return true;
      }),
    body('replyToId')
      .optional({ values: 'falsy' })
      .isString().withMessage('Reply ID must be a string')
      .matches(ID_REGEX).withMessage('Invalid reply ID format'),
    handleValidationErrors,
  ],

  getMessages: [
    param('matchId')
      .notEmpty().withMessage('Match ID is required')
      .matches(ID_REGEX)
      .withMessage('Invalid match ID format'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 500 }).withMessage('Limit must be between 1 and 500'),
    query('offset')
      .optional()
      .isInt({ min: 0 }).withMessage('Offset must be a positive integer'),
    handleValidationErrors,
  ],

  markAsRead: [
    param('matchId')
      .notEmpty().withMessage('Match ID is required')
      .matches(ID_REGEX)
      .withMessage('Invalid match ID format'),
    handleValidationErrors,
  ],

  addReaction: [
    param('matchId')
      .notEmpty().withMessage('Match ID is required')
      .matches(ID_REGEX)
      .withMessage('Invalid match ID format'),
    param('messageId')
      .notEmpty().withMessage('Message ID is required')
      .matches(ID_REGEX)
      .withMessage('Invalid message ID format'),
    body('emoji')
      .notEmpty().withMessage('Emoji is required')
      .isString().withMessage('Emoji must be a string')
      .isLength({ min: 1, max: 8 }).withMessage('Invalid emoji'),
    handleValidationErrors,
  ],

  removeReaction: [
    param('matchId')
      .notEmpty().withMessage('Match ID is required')
      .matches(ID_REGEX)
      .withMessage('Invalid match ID format'),
    param('messageId')
      .notEmpty().withMessage('Message ID is required')
      .matches(ID_REGEX)
      .withMessage('Invalid message ID format'),
    body('emoji')
      .notEmpty().withMessage('Emoji is required')
      .isString().withMessage('Emoji must be a string')
      .isLength({ min: 1, max: 8 }).withMessage('Invalid emoji'),
    handleValidationErrors,
  ],
};

/**
 * Profile validation rules
 */
const profileValidation = {
  // New endpoint for completing profile setup (birthDate, gender, interestedIn, location required)
  completeSetup: [
    body('birthDate')
      .optional() // birthDate might already be set
      .isISO8601().withMessage('Invalid date format')
      .custom((value) => {
        if (!value) {return true;}
        const age = Math.floor((new Date() - new Date(value)) / 31557600000);
        if (age < 18) {throw new Error('You must be at least 18 years old');}
        if (age > 100) {throw new Error('Invalid birth date');}
        return true;
      }),
    body('gender')
      .optional() // Gender might already be set
      .isIn(['MAN', 'WOMAN', 'OTHER', 'man', 'woman', 'other']).withMessage('Invalid gender')
      .customSanitizer(value => value ? value.toUpperCase() : value),
    body('interestedIn')
      .optional() // InterestedIn might already be set
      .isArray().withMessage('Interested in must be an array')
      .custom((value) => {
        if (!value) {
          return true; // Optional
        }
        const valid = ['MAN', 'WOMAN', 'OTHER', 'man', 'woman', 'other'];
        return value.length > 0 && value.every(v => valid.includes(v));
      }).withMessage('Invalid interested in values')
      .customSanitizer(value => value ? value.map(v => v.toUpperCase()) : value),
    body('photos')
      .optional()
      .isArray().withMessage('Photos must be an array')
      .custom((value) => {
        if (!value) {
          return true;
        }
        // Validate each photo is a valid URL
        return value.every(photo => {
          if (typeof photo !== 'string') {
            return false;
          }
          try {
            const url = new URL(photo);
            return url.protocol === 'http:' || url.protocol === 'https:';
          } catch {
            return false;
          }
        });
      }).withMessage('Invalid photo URLs'),
    body('location')
      .optional() // Location is auto-detected on client
      .isString().withMessage('Location must be a string'),
    body('latitude')
      .optional()
      .isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    body('longitude')
      .optional()
      .isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
    handleValidationErrors,
  ],
  
  updateProfile: [
    body('name')
      .optional()
      .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters')
      .matches(/^[a-zA-Z\s]+$/).withMessage('Name can only contain letters and spaces')
      .trim(),
    // gender/interestedIn pass through to Prisma enums — unvalidated input
    // crashed as a 500 instead of a clean 400
    body('gender')
      .optional()
      .isIn(['MAN', 'WOMAN', 'OTHER', 'man', 'woman', 'other']).withMessage('Invalid gender')
      .customSanitizer((value) => (value ? value.toUpperCase() : value)),
    body('interestedIn')
      .optional()
      .isArray().withMessage('Interested in must be an array')
      .custom((value) => {
        const valid = ['MAN', 'WOMAN', 'OTHER', 'man', 'woman', 'other'];
        return value.every((v) => valid.includes(v));
      }).withMessage('Invalid interested in values')
      .customSanitizer((value) => (value ? value.map((v) => v.toUpperCase()) : value)),
    body('bio')
      .optional({ nullable: true, checkFalsy: true })
      .isLength({ max: 500 }).withMessage('Bio must be less than 500 characters')
      .trim(),
    body('education')
      .optional({ nullable: true, checkFalsy: true })
      .isLength({ max: 100 }).withMessage('Education must be less than 100 characters')
      .trim(),
    body('profession')
      .optional({ nullable: true, checkFalsy: true })
      .isLength({ max: 100 }).withMessage('Profession must be less than 100 characters')
      .trim(),
    body('height')
      .optional({ nullable: true, checkFalsy: true })
      .isLength({ max: 20 }).withMessage('Height text too long')
      .trim(),
    body('relationshipType')
      .optional({ nullable: true, checkFalsy: true })
      .trim(),
    body('smoking')
      .optional({ nullable: true, checkFalsy: true })
      .isLength({ max: 50 }).withMessage('Smoking preference text too long')
      .trim(),
    body('drinking')
      .optional({ nullable: true, checkFalsy: true })
      .isLength({ max: 50 }).withMessage('Drinking preference text too long')
      .trim(),
    body('pets')
      .optional({ nullable: true, checkFalsy: true })
      .isLength({ max: 200 }).withMessage('Pet description too long')
      .trim(),
    body('interests')
      .optional()
      .isArray().withMessage('Interests must be an array')
      .custom((value) => {
        if (Array.isArray(value)) {
          return value.length <= 10;
        }
        return true;
      }).withMessage('Maximum 10 interests allowed'),
    body('languages')
      .optional()
      .isArray().withMessage('Languages must be an array'),
    body('latitude')
      .optional()
      .isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    body('longitude')
      .optional()
      .isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
    handleValidationErrors,
  ],

  getProfile: [
    param('userId')
      .optional()
      .matches(ID_REGEX)
      .withMessage('Invalid user ID format'),
    handleValidationErrors,
  ],
};

/**
 * Match validation rules
 */
const matchValidation = {
  unmatch: [
    param('matchId')
      .notEmpty().withMessage('Match ID is required')
      .matches(ID_REGEX)
      .withMessage('Invalid match ID format'),
    handleValidationErrors,
  ],

  getMatches: [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 }).withMessage('Offset must be a positive integer'),
    handleValidationErrors,
  ],
};

/**
 * User settings validation rules
 */
const userValidation = {
  addPhoto: [
    body('photoUrl')
      .notEmpty().withMessage('Photo URL is required')
      .isURL({ protocols: ['https'], require_protocol: true }).withMessage('Photo URL must be a valid https URL')
      .isLength({ max: 2048 }).withMessage('Photo URL too long')
      .custom(ownsStorageObject('profile-photos')).withMessage('Photos must be uploaded through the app'),
    body('isMain')
      .optional()
      .isBoolean({ strict: true }).withMessage('isMain must be a boolean'),
    handleValidationErrors,
  ],

  submitVerification: [
    body('photoUrl')
      .notEmpty().withMessage('Selfie URL is required')
      .isURL({ protocols: ['https'], require_protocol: true }).withMessage('Selfie URL must be a valid https URL')
      .isLength({ max: 2048 }).withMessage('Selfie URL too long')
      .custom(ownsStorageObject('verification-selfies')).withMessage('Selfies must be uploaded through the app'),
    handleValidationErrors,
  ],

  preferences: [
    body('interestedIn')
      .optional()
      .isArray().withMessage('Interested in must be an array')
      .custom((value) => {
        const valid = ['MAN', 'WOMAN', 'OTHER'];
        if (!value.every((g) => valid.includes(g))) {
          throw new Error('Invalid gender preference');
        }
        return true;
      }),
    body('ageRange.min')
      .optional()
      .isInt({ min: 18, max: 99 }).withMessage('Minimum age must be between 18 and 99'),
    body('ageRange.max')
      .optional()
      .isInt({ min: 18, max: 99 }).withMessage('Maximum age must be between 18 and 99'),
    body('ageRange')
      .optional()
      .custom((value) => {
        if (
          value &&
          value.min !== undefined &&
          value.max !== undefined &&
          Number(value.min) > Number(value.max)
        ) {
          throw new Error('Minimum age cannot exceed maximum age');
        }
        return true;
      }),
    body('distance')
      .optional()
      .isInt({ min: 1, max: 500 }).withMessage('Distance must be between 1 and 500 km'),
    handleValidationErrors,
  ],

  notificationSettings: [
    body('messages')
      .optional()
      .isBoolean({ strict: true }).withMessage('messages must be a boolean'),
    body('matches')
      .optional()
      .isBoolean({ strict: true }).withMessage('matches must be a boolean'),
    body('likes')
      .optional()
      .isBoolean({ strict: true }).withMessage('likes must be a boolean'),
    handleValidationErrors,
  ],
};

/**
 * Moderation validation rules
 */
const moderationValidation = {
  matchIdParam: [
    param('matchId')
      .notEmpty().withMessage('Match ID is required')
      .matches(ID_REGEX).withMessage('Invalid match ID format'),
    handleValidationErrors,
  ],

  userIdParam: [
    param('userId')
      .notEmpty().withMessage('User ID is required')
      .matches(ID_REGEX).withMessage('Invalid user ID format'),
    handleValidationErrors,
  ],

  report: [
    body('reportedId')
      .notEmpty().withMessage('reportedId is required')
      .matches(ID_REGEX).withMessage('Invalid user ID format'),
    body('reason')
      .notEmpty().withMessage('reason is required')
      .isIn([
        'INAPPROPRIATE_PHOTOS',
        'HARASSMENT',
        'SPAM',
        'FAKE_PROFILE',
        'UNDERAGE',
        'OTHER',
      ]).withMessage('Invalid report reason'),
    body('description')
      .optional({ values: 'falsy' })
      .isString().withMessage('Description must be a string')
      .isLength({ max: 1000 }).withMessage('Description must be at most 1000 characters')
      .trim(),
    handleValidationErrors,
  ],
};

module.exports = {
  handleValidationErrors,
  authValidation,
  actionValidation,
  discoveryValidation,
  messageValidation,
  profileValidation,
  matchValidation,
  userValidation,
  moderationValidation,
};