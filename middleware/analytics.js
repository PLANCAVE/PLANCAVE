const { Pool } = require('pg');

// Use your DATABASE_URL environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function trackPageView(req, res, next) {
  try {
    const analyticsData = {
      timestamp: new Date(),
      path: req.url,
      method: req.method,
      userAgent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userId: req.user?._id || null,
      sessionId: req.session?.id || null,
    };

    // Asynchronously save analytics
    pool.query(
      `INSERT INTO analytics (timestamp, path, method, user_agent, ip, user_id, session_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        analyticsData.timestamp,
        analyticsData.path,
        analyticsData.method,
        analyticsData.userAgent,
        analyticsData.ip,
        analyticsData.userId,
        analyticsData.sessionId,
      ]
    ).catch(err => {
      console.error('Analytics tracking error:', err);
    });

    next();
  } catch (error) {
    console.error('Analytics middleware error:', error);
    next();
  }
}

async function trackUserAction(req, res, next) {
  try {
    const actionData = {
      timestamp: new Date(),
      userId: req.user?._id || null,
      action: req.body.action || 'unknown',
      details: req.body.details || {},
      path: req.url,
    };

    // Asynchronously save user action
    pool.query(
      `INSERT INTO user_actions (timestamp, user_id, action, details, path)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        actionData.timestamp,
        actionData.userId,
        actionData.action,
        JSON.stringify(actionData.details),
        actionData.path,
      ]
    ).catch(err => {
      console.error('User action tracking error:', err);
    });

    next();
  } catch (error) {
    console.error('User action tracking middleware error:', error);
    next();
  }
}

module.exports = { trackPageView, trackUserAction };