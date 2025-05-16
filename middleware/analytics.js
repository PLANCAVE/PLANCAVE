import { getDb } from '../lib/mongodb';

export async function trackPageView(req, res, next) {
  try {
    const db = await getDb();
    
    // Basic analytics data
    const analyticsData = {
      timestamp: new Date(),
      path: req.url,
      method: req.method,
      userAgent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userId: req.user?._id || null,
      sessionId: req.session?.id || null
    };

    // Asynchronously save analytics
    db.collection('analytics').insertOne(analyticsData).catch(err => {
      console.error('Analytics tracking error:', err);
    });

    // Don't wait for analytics to complete
    next();
  } catch (error) {
    console.error('Analytics middleware error:', error);
    // Continue even if analytics fails
    next();
  }
}

export async function trackUserAction(req, res, next) {
  try {
    const db = await getDb();
    
    // Track specific user actions
    const actionData = {
      timestamp: new Date(),
      userId: req.user?._id || null,
      action: req.body.action || 'unknown',
      details: req.body.details || {},
      path: req.url
    };

    // Asynchronously save user action
    db.collection('user_actions').insertOne(actionData).catch(err => {
      console.error('User action tracking error:', err);
    });

    next();
  } catch (error) {
    console.error('User action tracking middleware error:', error);
    next();
  }
} 