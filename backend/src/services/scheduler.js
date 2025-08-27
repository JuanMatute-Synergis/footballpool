const cron = require('node-cron');
const nflApiService = require('./nfl-api');

function scheduleDataFetch() {
  // Fetch full season data weekly (Sunday at 2 AM) to catch schedule changes
  cron.schedule('0 2 * * 0', async () => {
    console.log('Running weekly full season data refresh...');
    try {
      await nflApiService.fetchCurrentAndUpcomingSchedule();
    } catch (error) {
      console.error('Error in scheduled season data fetch:', error);
    }
  });

  // Fetch current and next week schedule daily at 3 AM for fresher data
  cron.schedule('0 3 * * *', async () => {
    console.log('Running daily schedule refresh...');
    try {
      const { week, season } = nflApiService.getCurrentWeek();
      
      // Ensure teams are present before fetching schedules
      await nflApiService.fetchAndStoreTeams();

      // Fetch current week and next week
      try {
        await nflApiService.fetchWeekSchedule(week, season);
        if (week < 18) {
          await nflApiService.fetchWeekSchedule(week + 1, season);
        }
      } catch (schedErr) {
        // If we are in a no-mock-data/production environment, fetchWeekSchedule may throw.
        // Log and continue — do not crash the scheduler.
        console.error('Failed to fetch schedule during daily refresh:', schedErr.message);
      }
    } catch (error) {
      console.error('Error in scheduled schedule refresh:', error);
    }
  });

  // Periodic sync every 2 hours to detect schedule changes
  cron.schedule('0 */2 * * *', async () => {
    console.log('Running 2-hour schedule sync...');
    try {
      const { week, season } = nflApiService.getCurrentWeek();
      try {
        await nflApiService.syncWeekSchedule(week, season);
        if (week < 18) {
          await nflApiService.syncWeekSchedule(week + 1, season);
        }
      } catch (err) {
        console.error('2-hour sync failed:', err.message);
      }
    } catch (error) {
      console.error('Error running 2-hour schedule sync:', error);
    }
  });

  // Clean up expired cache entries daily at 1 AM
  cron.schedule('0 1 * * *', async () => {
    console.log('Cleaning up expired cache...');
    try {
      const { runQuery } = require('../models/database');
      await runQuery('DELETE FROM api_cache WHERE expires_at < datetime("now")');
      console.log('Cache cleanup completed');
    } catch (error) {
      console.error('Error in cache cleanup:', error);
    }
  });

  console.log('Scheduled tasks initialized');
}

module.exports = {
  scheduleDataFetch
};
