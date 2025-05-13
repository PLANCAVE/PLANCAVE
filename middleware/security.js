const { securityHeaders, rateLimiting, csrfProtection, sanitization } = require('../utils/security');

/**
 * Apply security headers to all responses
 */
const applySecurityHeaders = (req, res, next) => {
  securityHeaders.applySecurityHeaders(res);
  next();
};

/**
 * Rate limiting middleware
 * @param {Object} options - Rate limiting options
 * @param {number} options.limit - Maximum number of requests
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {Function} options.keyGenerator - Function to generate rate limit key
 */
const rateLimit = (options = {}) => {
  const {
    limit = 100,
    windowMs = 60 * 1000,
    keyGenerator = (req) => req.ip
  } = options;

  return (req, res, next) => {
    const key = keyGenerator(req);
    
    if (rateLimiting.isRateLimited(key, limit, windowMs)) {
      return res.status(429).json({
        message: 'Too many requests, please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    // Add rate limit info to response headers
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', rateLimiting.getRemainingRequests(key, limit, windowMs));
    
    next();
  };
};

/**
 * CSRF protection middleware
 * Requires express-session to be initialized first
 */
const csrfProtectionMiddleware = (req, res, next) => {
  // Skip for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const storedToken = req.session?.csrfToken;
  
  if (!csrfProtection.validateToken(token, storedToken)) {
    return res.status(403).json({ message: 'Invalid or missing CSRF token' });
  }
  
  next();
};

/**
 * Generate and set CSRF token
 * Requires express-session to be initialized first
 */
const setCsrfToken = (req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = csrfProtection.generateToken();
  }
  
  // Make CSRF token available to templates
  res.locals.csrfToken = req.session.csrfToken;
  next();
};

/**
 * Sanitize request body
 */
const sanitizeBody = (req, res, next) => {
  if (req.body) {
    req.body = sanitization.sanitizeObject(req.body);
  }
  next();
};

/**
 * Sanitize request query parameters
 */
const sanitizeQuery = (req, res, next) => {
  if (req.query) {
    req.query = sanitization.sanitizeObject(req.query);
  }
  next();
};

/**
 * Prevent clickjacking by setting X-Frame-Options
 */
const preventClickjacking = (req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  next();
};

/**
 * Force HTTPS in production
 */
const forceHttps = (req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure && req.get('x-forwarded-proto') !== 'https') {
    return res.redirect(`https://${req.get('host')}${req.url}`);
  }
  next();
};

module.exports = {
  applySecurityHeaders,
  rateLimit,
  csrfProtectionMiddleware,
  setCsrfToken,
  sanitizeBody,
  sanitizeQuery,
  preventClickjacking,
  forceHttps
};