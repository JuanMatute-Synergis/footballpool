const { getAllQuery, getQuery } = require('./src/models/database');

async function checkPicks() {
    try {
        console.log('=== CHECKING USER PICKS FOR WEEK 1 ===');

        // Check picks for week 1
        const userPicks = await getAllQuery(`
      SELECT 
        u.first_name, 
        u.last_name, 
        COUNT(p.id) as picks_made
      FROM users u 
      LEFT JOIN picks p ON u.id = p.user_id AND p.week = 1 AND p.season = 2025
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY u.first_name
    `);

        console.log('User pick counts:');
        console.table(userPicks);

        // Check total games for week 1
        const gameCount = await getQuery("SELECT COUNT(*) as game_count FROM games WHERE week = 1 AND season = 2025");
        console.log(`\nTotal games for Week 1 2025: ${gameCount.game_count}`);

        // Check weekly_scores table
        const weeklyScores = await getAllQuery(`
      SELECT 
        u.first_name, 
        u.last_name, 
        ws.total_picks,
        ws.correct_picks,
        ws.total_points
      FROM users u 
      LEFT JOIN weekly_scores ws ON u.id = ws.user_id AND ws.week = 1 AND ws.season = 2025
      ORDER BY u.first_name
    `);

        console.log('\nWeekly scores data:');
        console.table(weeklyScores);

    } catch (error) {
        console.error('Error:', error);
    }
}

checkPicks();
