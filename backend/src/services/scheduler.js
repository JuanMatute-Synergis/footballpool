const cron = require('node-cron');
const nflApiService = require('./nfl-api');
const scoringService = require('./scoring');

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

  // Auto-calculate scores for completed weeks every 15 minutes for faster response
  cron.schedule('*/15 * * * *', async () => {
    console.log('Checking for completed weeks to calculate scores...');
    try {
      await scoringService.autoCalculateScores();
    } catch (error) {
      console.error('Error in auto-calculate scores:', error);
    }
  });

  // Update live game scores every 30 seconds during game days (Thursday-Tuesday to catch MNF)
  cron.schedule('*/30 * * * * *', async () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday, etc.

    // Run during potential game days (Thursday=4, Friday=5, Saturday=6, Sunday=0, Monday=1, Tuesday=2 for MNF completion)
    if ([0, 1, 2, 4, 5, 6].includes(dayOfWeek)) {
      try {
        console.log('Checking for live game score updates...');
        const { week, season } = nflApiService.getCurrentWeek();

        // Check if there are any games today or recently that might be live or just finished
        const { getAllQuery } = require('../models/database');
        const recentGames = await getAllQuery(`
          SELECT id, status 
          FROM games 
          WHERE week = ? AND season = ? 
          AND datetime(date) >= datetime('now', '-12 hours') 
          AND datetime(date) <= datetime('now', '+6 hours')
          AND (status != 'final' OR datetime(date) >= datetime('now', '-2 hours'))
        `, [week, season]);

        if (recentGames.length > 0) {
          console.log(`Found ${recentGames.length} games that might need live updates`);

          // Fetch live data and update database
          try {
            const liveGames = await nflApiService.fetchLiveGames(week, season);
            if (liveGames && liveGames.length > 0) {
              // Update game statuses and scores
              for (const game of liveGames) {
                if (game.id && (game.home_team_score !== null || game.visitor_team_score !== null)) {
                  // Prepare quarter data
                  const quarterData = {
                    live_status: game.live_status,
                    home_team_q1: game.home_team_q1,
                    home_team_q2: game.home_team_q2,
                    home_team_q3: game.home_team_q3,
                    home_team_q4: game.home_team_q4,
                    home_team_ot: game.home_team_ot,
                    visitor_team_q1: game.visitor_team_q1,
                    visitor_team_q2: game.visitor_team_q2,
                    visitor_team_q3: game.visitor_team_q3,
                    visitor_team_q4: game.visitor_team_q4,
                    visitor_team_ot: game.visitor_team_ot,
                    quarter_time_remaining: game.quarter_time_remaining
                  };

                  await nflApiService.updateGameScores(
                    game.id,
                    game.home_team_score,
                    game.visitor_team_score,
                    game.status,
                    quarterData
                  );
                }
              }

              // Check if any games just finished and recalculate scores immediately
              const justFinishedGames = liveGames.filter(game => game.status === 'final');
              if (justFinishedGames.length > 0) {
                console.log(`${justFinishedGames.length} games just finished, recalculating scores...`);
                try {
                  // Always recalculate scores to update user stats, but winner determination
                  // will only happen if all games are complete (handled in scoring service)
                  await scoringService.calculateWeeklyScores(week, season);
                } catch (scoreErr) {
                  console.error('Error calculating scores:', scoreErr.message);
                }
              }
            }
          } catch (liveErr) {
            console.log('Live game fetch failed (rate limited or API issue):', liveErr.message);
          }
        }
      } catch (error) {
        console.error('Error in live game score update:', error);
      }
    }
  });

  console.log('Scheduled tasks initialized');
}

module.exports = {
  scheduleDataFetch
};
