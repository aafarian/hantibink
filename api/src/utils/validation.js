const Joi = require('joi');

/**
 * User Registration Validation Schema
 */
const registerSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name cannot exceed 50 characters',
      'any.required': 'Name is required',
    }),
  
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
  
  password: Joi.string()
    .min(6)
    .max(128)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters long',
      'string.max': 'Password cannot exceed 128 characters',
      'any.required': 'Password is required',
    }),
  
  birthDate: Joi.date()
    .max('now')
    .required()
    .messages({
      'date.max': 'Birth date cannot be in the future',
      'any.required': 'Birth date is required',
    }),
  
  gender: Joi.string()
    .valid('male', 'female', 'non-binary')
    .required()
    .messages({
      'any.only': 'Gender must be male, female, or non-binary',
      'any.required': 'Gender is required',
    }),
  
  interestedIn: Joi.array()
    .items(Joi.string().valid('male', 'female', 'non-binary'))
    .min(1)
    .required()
    .messages({
      'array.min': 'Please select at least one preference',
      'any.required': 'Interested in preferences are required',
    }),
  
  location: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    address: Joi.string().max(255).optional(),
    city: Joi.string().max(100).optional(),
    country: Joi.string().max(100).optional(),
  }).optional(),
  
  photos: Joi.array()
    .items(Joi.string().uri())
    .min(1)
    .max(6)
    .required()
    .messages({
      'array.min': 'At least one photo is required',
      'array.max': 'Maximum 6 photos allowed',
      'any.required': 'Photos are required',
    }),
});

/**
 * User Login Validation Schema
 */
const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
  
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required',
    }),
});

/**
 * Firebase Token Validation Schema
 */
const firebaseTokenSchema = Joi.object({
  idToken: Joi.string()
    .required()
    .messages({
      'any.required': 'Firebase ID token is required',
    }),
});

/**
 * Refresh Token Validation Schema
 */
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string()
    .required()
    .messages({
      'any.required': 'Refresh token is required',
    }),
});

/**
 * Password Reset Request Validation Schema
 */
const passwordResetRequestSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
});

/**
 * Password Reset Validation Schema
 */
const passwordResetSchema = Joi.object({
  token: Joi.string()
    .required()
    .messages({
      'any.required': 'Reset token is required',
    }),
  
  newPassword: Joi.string()
    .min(6)
    .max(128)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters long',
      'string.max': 'Password cannot exceed 128 characters',
      'any.required': 'New password is required',
    }),
});

/**
 * Profile Update Validation Schema
 */
const profileUpdateSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(50)
    .optional()
    .messages({
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name cannot exceed 50 characters',
    }),
  
  bio: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Bio cannot exceed 500 characters',
    }),
  
  interestedIn: Joi.array()
    .items(Joi.string().valid('male', 'female', 'non-binary'))
    .min(1)
    .optional()
    .messages({
      'array.min': 'Please select at least one preference',
    }),
  
  location: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    address: Joi.string().max(255).optional(),
    city: Joi.string().max(100).optional(),
    country: Joi.string().max(100).optional(),
  }).optional(),
  
  photos: Joi.array()
    .items(Joi.string().uri())
    .min(1)
    .max(6)
    .optional()
    .messages({
      'array.min': 'At least one photo is required',
      'array.max': 'Maximum 6 photos allowed',
    }),
  
  interests: Joi.array()
    .items(Joi.string().max(50))
    .max(10)
    .optional()
    .messages({
      'array.max': 'Maximum 10 interests allowed',
    }),
});

/**
 * Validation middleware factory
 */
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        error: 'Validation failed',
        message: 'Please check your input data',
        details: errors,
      });
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
};

module.exports = {
  registerSchema,
  loginSchema,
  firebaseTokenSchema,
  refreshTokenSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  profileUpdateSchema,
  validate,
};
