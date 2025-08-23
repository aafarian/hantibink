const { body, query, param, validationResult } = require('express-validator');

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
    body('birthDate')
      .notEmpty().withMessage('Birth date is required')
      .isISO8601().withMessage('Invalid date format')
      .custom((value) => {
        const age = Math.floor((new Date() - new Date(value)) / 31557600000);
        if (age < 18) throw new Error('You must be at least 18 years old');
        if (age > 100) throw new Error('Invalid birth date');
        return true;
      }),
    body('gender')
      .notEmpty().withMessage('Gender is required')
      .isIn(['MALE', 'FEMALE', 'OTHER', 'male', 'female', 'other', 'non-binary']).withMessage('Invalid gender')
      .customSanitizer(value => {
        // Normalize to uppercase
        if (value === 'male') return 'MALE';
        if (value === 'female') return 'FEMALE';
        if (value === 'other' || value === 'non-binary') return 'OTHER';
        return value.toUpperCase();
      }),
    body('interestedIn')
      .notEmpty().withMessage('Interested in is required')
      .isArray().withMessage('Interested in must be an array')
      .custom((value) => {
        const valid = ['MALE', 'FEMALE', 'OTHER', 'male', 'female', 'other'];
        return value.every(v => valid.includes(v));
      }).withMessage('Invalid interested in values')
      .customSanitizer(value => {
        // Normalize to uppercase
        return value.map(v => {
          if (v === 'male') return 'MALE';
          if (v === 'female') return 'FEMALE';
          if (v === 'other' || v === 'non-binary') return 'OTHER';
          return v.toUpperCase();
        });
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
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
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
      .matches(/^c[a-z0-9]{24,}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      .withMessage('Invalid user ID format'),
    handleValidationErrors,
  ],

  pass: [
    body('targetUserId')
      .notEmpty().withMessage('Target user ID is required')
      .isString().withMessage('User ID must be a string')
      .matches(/^c[a-z0-9]{24,}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      .withMessage('Invalid user ID format'),
    handleValidationErrors,
  ],

  superLike: [
    body('targetUserId')
      .notEmpty().withMessage('Target user ID is required')
      .isString().withMessage('User ID must be a string')
      .matches(/^c[a-z0-9]{24,}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
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
          return ids.every(id => /^c[a-z0-9]{24,}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
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
          return value.every(id => /^c[a-z0-9]{24,}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
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
      .matches(/^c[a-z0-9]{24,}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      .withMessage('Invalid match ID format'),
    body('content')
      .notEmpty().withMessage('Message content is required')
      .isString().withMessage('Content must be a string')
      .isLength({ min: 1, max: 1000 }).withMessage('Message must be between 1 and 1000 characters')
      .trim(),
    body('type')
      .optional()
      .isIn(['TEXT', 'IMAGE', 'GIF']).withMessage('Invalid message type'),
    handleValidationErrors,
  ],

  getMessages: [
    param('matchId')
      .notEmpty().withMessage('Match ID is required')
      .matches(/^c[a-z0-9]{24,}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      .withMessage('Invalid match ID format'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 }).withMessage('Offset must be a positive integer'),
    handleValidationErrors,
  ],

  markAsRead: [
    param('matchId')
      .notEmpty().withMessage('Match ID is required')
      .matches(/^c[a-z0-9]{24,}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      .withMessage('Invalid match ID format'),
    handleValidationErrors,
  ],
};

/**
 * Profile validation rules
 */
const profileValidation = {
  updateProfile: [
    body('name')
      .optional()
      .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters')
      .matches(/^[a-zA-Z\s]+$/).withMessage('Name can only contain letters and spaces')
      .trim(),
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
      .matches(/^c[a-z0-9]{24,}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
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
      .matches(/^c[a-z0-9]{24,}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
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

module.exports = {
  handleValidationErrors,
  authValidation,
  actionValidation,
  discoveryValidation,
  messageValidation,
  profileValidation,
  matchValidation,
};