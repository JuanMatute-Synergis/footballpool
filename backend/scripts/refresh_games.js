/**
 * Script to refresh games from the API and recalculate tiebreakers
 * Run this after deploying the tiebreaker changes
 */

const { getAllQuery, runQuery } = require('../src/models/database');

async function refreshGames() {
  console.log('🔄 Refreshing games and recalculating tiebreakers...');

  try {
    // Get all distinct week/season combinations
    const weeks = await getAllQuery(`
      SELECT DISTINCT week, season 
      FROM games 
      ORDER BY season DESC, week DESC
    `);

    console.log(`Found ${weeks.length} weeks to process`);

    for (const { week, season } of weeks) {
      console.log(`\nProcessing Week ${week}, Season ${season}...`);

      // Reset all tiebreaker flags for this week
      await runQuery(`
        UPDATE games 
        SET is_tiebreaker_game = 0 
        WHERE week = ? AND season = ?
      `, [week, season]);

      // Find the last game of the week (by date)
      const games = await getAllQuery(`
        SELECT id, date 
        FROM games 
        WHERE week = ? AND season = ?
        ORDER BY date DESC
      `, [week, season]);

      if (games.length > 0) {
        const lastGame = games[0];
        
        // Set tiebreaker flag on the last game
        await runQuery(`
          UPDATE games 
          SET is_tiebreaker_game = 1 
          WHERE id = ?
        `, [lastGame.id]);

        console.log(`✅ Set game ${lastGame.id} (${lastGame.date}) as tiebreaker`);
      }
    }

    console.log('\n🎉 Games refreshed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error refreshing games:', error);
    process.exit(1);
  }
}

refreshGames();
