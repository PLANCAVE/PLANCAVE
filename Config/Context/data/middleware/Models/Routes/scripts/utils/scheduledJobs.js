// utils/scheduledJobs.js
const Plan = require('../Models/Plan');
const cron = require('node-cron');

// Function to update new arrival status
async function updateNewArrivals() {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  
  try {
    await Plan.updateMany(
      { dateAdded: { $lt: oneMonthAgo }, newArrival: true },
      { $set: { newArrival: false } }
    );
    console.log('New arrivals updated successfully');
  } catch (error) {
    console.error('Error updating new arrivals:', error);
  }
}

// Schedule the job to run at midnight on the 1st of each month
function scheduleJobs() {
  cron.schedule('0 0 1 * *', () => {
    updateNewArrivals();
  });
  
  console.log('Jobs scheduled');
}

module.exports = {
  updateNewArrivals,
  scheduleJobs
};