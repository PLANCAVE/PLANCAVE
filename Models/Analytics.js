const { Pool } = require('pg');
const pool = new Pool({ /* connection config */ });

const analytics = {
  date: new Date(),
  daily_active_users: 100,
  new_users: 10,
  returning_users: 90,
  page_views: 500,
  average_session_time: 300,
  feature_usage: { search: 50, filter: 30 },
  geographic_data: { US: 70, IN: 30 },
  product_usage: { prodA: 20, prodB: 80 },
  revenue: 1234.56,
};

await pool.query(
  `INSERT INTO analytics
    (date, daily_active_users, new_users, returning_users, page_views, average_session_time, feature_usage, geographic_data, product_usage, revenue)
   VALUES
    ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
  [
    analytics.date,
    analytics.daily_active_users,
    analytics.new_users,
    analytics.returning_users,
    analytics.page_views,
    analytics.average_session_time,
    JSON.stringify(analytics.feature_usage),
    JSON.stringify(analytics.geographic_data),
    JSON.stringify(analytics.product_usage),
    analytics.revenue,
  ]
);