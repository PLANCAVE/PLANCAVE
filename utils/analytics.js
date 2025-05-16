import axios from 'axios';

// Base URL for API
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Get user's country (using a simple IP geolocation service)
const getUserCountry = async () => {
  try {
    const res = await axios.get('https://ipapi.co/json/');
    return res.data.country_name;
  } catch (error) {
    console.error('Error getting user country:', error);
    return null;
  }
};

// Analytics tracking class
class AnalyticsTracker {
  constructor() {
    this.sessionStartTime = Date.now();
    this.userId = null;
    this.country = null;
    this.initialized = false;
  }

  // Initialize the tracker
  async init(userId) {
    this.userId = userId;
    this.country = await getUserCountry();
    this.initialized = true;
    
    // Track user active event
    if (userId) {
      this.trackEvent('userActive');
    }
    
    // Set up session tracking
    window.addEventListener('beforeunload', () => {
      this.trackSessionEnd();
    });
    
    return this;
  }

  // Track a page view
  trackPageView(page) {
    this.trackEvent('pageView', { page });
  }

  // Track feature usage
  trackFeatureUse(feature) {
    this.trackEvent('featureUse', { feature });
  }

  // Track a purchase
  trackPurchase(amount, productId) {
    this.trackEvent('purchase', { amount, productId });
  }

  // Track session end
  trackSessionEnd() {
    const sessionTime = (Date.now() - this.sessionStartTime) / 1000; // in seconds
    this.trackEvent('sessionEnd', { sessionTime });
  }

  // Generic event tracking method
  async trackEvent(event, data = {}) {
    if (!this.initialized) {
      console.warn('Analytics tracker not initialized');
      return;
    }
    
    try {
      await axios.post(`${API_URL}/api/analytics/track`, {
        userId: this.userId,
        event,
        country: this.country,
        ...data
      });
    } catch (error) {
      console.error('Error tracking analytics event:', error);
    }
  }
}

// Create and export a singleton instance
const analytics = new AnalyticsTracker();

export default analytics;