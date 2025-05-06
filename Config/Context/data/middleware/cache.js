// Simple in-memory cache
const cache = new Map();
const DEFAULT_CACHE_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Simple in-memory cache middleware
 * @param {number} duration - Cache duration in seconds
 */
function cacheMiddleware(duration = 300) { // Default 5 minutes
  const durationMs = duration * 1000;
  
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    // Create a cache key from the full URL
    const key = req.originalUrl;
    
    // Check if we have a cache hit
    if (cache.has(key)) {
      const cacheEntry = cache.get(key);
      
      // Check if the cache entry is still valid
      if (Date.now() < cacheEntry.expiry) {
        console.log(`Cache hit for ${key}`);
        return res.json(cacheEntry.data);
      } else {
        // Cache expired, delete it
        console.log(`Cache expired for ${key}`);
        cache.delete(key);
      }
    }
    
    // Cache miss, capture the response
    const originalJson = res.json;
    res.json = function(data) {
      // Store in cache before sending response
      cache.set(key, {
        data,
        expiry: Date.now() + durationMs
      });
      
      // Log cache size periodically
      if (cache.size % 10 === 0) {
        console.log(`Cache size: ${cache.size} entries`);
      }
      
      // Call the original json method
      return originalJson.call(this, data);
    };
    
    next();
  };
}

/**
 * Clear all cache entries or those matching a pattern
 * @param {string} pattern - Optional URL pattern to match
 */
function clearCache(pattern = null) {
  if (!pattern) {
    console.log('Clearing entire cache');
    cache.clear();
    return;
  }
  
  // Clear entries matching pattern
  let count = 0;
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
      count++;
    }
  }
  
  console.log(`Cleared ${count} cache entries matching pattern: ${pattern}`);
}

// Automatically clear expired cache entries every hour
setInterval(() => {
  const now = Date.now();
  let expiredCount = 0;
  
  for (const [key, value] of cache.entries()) {
    if (now > value.expiry) {
      cache.delete(key);
      expiredCount++;
    }
  }
  
  if (expiredCount > 0) {
    console.log(`Auto-cleared ${expiredCount} expired cache entries`);
  }
}, 60 * 60 * 1000); // Run every hour

module.exports = { cacheMiddleware, clearCache };