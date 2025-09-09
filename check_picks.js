const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = '/Users/juanmatute/Projects/footballpool/database-backups/database-backup-20250905-131747.sqlite';
const db = new sqlite3.Database(dbPath);

console.log('=== CHECKING USER PICKS FOR WEEK 1 ===');

// Check picks for week 1
db.all(`
  SELECT 
    u.first_name, 
    u.last_name, 
    COUNT(p.id) as picks_made,
    (SELECT COUNT(*) FROM games WHERE week = 1 AND season = 2025) as total_games
  FROM users u 
  LEFT JOIN picks p ON u.id = p.user_id AND p.week = 1 AND p.season = 2025
  GROUP BY u.id, u.first_name, u.last_name
  ORDER BY u.first_name
`, (err, rows) => {
    if (err) {
        console.error('Error:', err);
    } else {
        console.log('User pick counts:');
        console.table(rows);
    }

    // Check total games for week 1
    db.get("SELECT COUNT(*) as game_count FROM games WHERE week = 1 AND season = 2025", (err, row) => {
        if (err) {
            console.error('Error checking games:', err);
        } else {
            console.log(`\nTotal games for Week 1 2025: ${row.game_count}`);
        }

        // Check weekly_scores table
        db.all(`
      SELECT 
        u.first_name, 
        u.last_name, 
        ws.total_picks,
        ws.correct_picks,
        ws.total_points
      FROM users u 
      LEFT JOIN weekly_scores ws ON u.id = ws.user_id AND ws.week = 1 AND ws.season = 2025
      ORDER BY u.first_name
    `, (err, rows) => {
            if (err) {
                console.error('Error checking weekly scores:', err);
            } else {
                console.log('\nWeekly scores data:');
                console.table(rows);
            }
            db.close();
        });
    });
});
