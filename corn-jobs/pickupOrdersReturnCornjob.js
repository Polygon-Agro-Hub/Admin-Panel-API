// cronJobs.js
const cron = require('node-cron');
const { marketPlace } = require('./startup/database');

/**
 * Schedule all cron jobs
 */
const scheduleCronJobs = () => {
  console.log('⏰ Initializing cron jobs...');

  // ✅ CRON JOB: Enable marketplace items every day at 9:30 PM
  cron.schedule('30 21 * * *', async () => {
    console.log('🔄 Running scheduled job: Enabling marketplace items...');
    console.log(`⏰ Time: ${new Date().toLocaleString()}`);
    
    try {
      // Execute the query using the marketPlace database connection
      const [result] = await marketPlace.promise().query(
        'UPDATE marketplaceitems SET isEnable = 1'
      );
      
      console.log(`✅ Successfully enabled ${result.affectedRows} marketplace items`);
      console.log(`📊 Query result:`, result);
    } catch (error) {
      console.error('❌ Error executing cron job:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Colombo" // Set your timezone (Sri Lanka time)
  });

  // ✅ You can add more cron jobs here
  // Example: Daily cleanup job at 2:00 AM
  // cron.schedule('0 2 * * *', async () => {
  //   console.log('🔄 Running cleanup job...');
  //   // Your cleanup logic here
  // }, {
  //   timezone: "Asia/Colombo"
  // });

  console.log('✅ All cron jobs scheduled successfully');
  console.log('📅 Marketplace items enable job: 9:30 PM daily');
};

module.exports = { scheduleCronJobs };