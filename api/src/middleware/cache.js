/**
 * Cache middleware for improving API performance
 */

const logger = require('../utils/logger');

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 30 * 1000; // 30 seconds default

/**
 * Cache middleware factory
 * @param {number} ttl - Time to live in milliseconds
 * @param {Function} keyGenerator - Function to generate cache key from request
 */
const cacheMiddleware = (ttl = CACHE_TTL, keyGenerator = null) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key
    const key = keyGenerator 
      ? keyGenerator(req) 
      : `${req.originalUrl || req.url}_${req.user?.id || 'anonymous'}`;

    // Check cache
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) {
      logger.debug(`✅ Cache hit: ${key}`);
      
      // Set cache headers
      res.set('X-Cache', 'HIT');
      res.set('Cache-Control', `private, max-age=${Math.floor(ttl / 1000)}`);
      
      return res.json(cached.data);
    }

    // Cache miss - store original res.json
    const originalJson = res.json;
    res.json = function(data) {
      // Only cache successful responses
      if (res.statusCode === 200) {
        cache.set(key, {
          data: data,
          expires: Date.now() + ttl
        });
        logger.debug(`💾 Cached: ${key} for ${ttl}ms`);
      }
      
      // Set cache headers
      res.set('X-Cache', 'MISS');
      res.set('Cache-Control', `private, max-age=${Math.floor(ttl / 1000)}`);
      
      // Call original res.json
      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Clear cache for a specific pattern or all
 * @param {string|RegExp} pattern - Optional pattern to match keys
 */
const clearCache = (pattern = null) => {
  if (!pattern) {
    cache.clear();
    logger.info('🗑️ Cleared all cache');
    return;
  }

  let cleared = 0;
  for (const key of cache.keys()) {
    if (typeof pattern === 'string' && key.includes(pattern)) {
      cache.delete(key);
      cleared++;
    } else if (pattern instanceof RegExp && pattern.test(key)) {
      cache.delete(key);
      cleared++;
    }
  }
  
  logger.info(`🗑️ Cleared ${cleared} cache entries matching pattern`);
};

/**
 * Clean expired cache entries
 */
const cleanExpiredCache = () => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, value] of cache.entries()) {
    if (value.expires <= now) {
      cache.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    logger.debug(`🧹 Cleaned ${cleaned} expired cache entries`);
  }
};

// Run cleanup every minute
setInterval(cleanExpiredCache, 60 * 1000);

module.exports = {
  cacheMiddleware,
  clearCache,
  cache
};