const mongoose = require('mongoose');

const analyticsSchema = mongoose.Schema(
  {
    date: {
      type: Date,
      default: Date.now,
      required: true,
    },
    dailyActiveUsers: {
      type: Number,
      default: 0,
    },
    newUsers: {
      type: Number,
      default: 0,
    },
    returningUsers: {
      type: Number,
      default: 0,
    },
    pageViews: {
      type: Number,
      default: 0,
    },
    averageSessionTime: {
      type: Number, // in seconds
      default: 0,
    },
    featureUsage: {
      type: Map,
      of: Number,
      default: {},
    },
    geographicData: {
      type: Map,
      of: Number,
      default: {},
    },
    productUsage: {
      type: Map,
      of: Number,
      default: {},
    },
    revenue: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient date-based queries
analyticsSchema.index({ date: 1 });

const Analytics = mongoose.model('Analytics', analyticsSchema);

module.exports = Analytics;