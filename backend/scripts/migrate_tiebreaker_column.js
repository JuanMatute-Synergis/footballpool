/**
 * Database migration script to rename is_monday_night column to is_tiebreaker_game
 * and update the tiebreaker logic to use the last game of the week instead of hardcoded Monday detection
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'database.sqlite');

console.log(`🔧 Starting database migration: is_monday_night → is_tiebreaker_game`);
console.log(`Database path: ${dbPath}`);

try {
  const db = new Database(dbPath);

  // Check if migration is needed
  const tableInfo = db.prepare("PRAGMA table_info(games)").all();
  const hasMondayColumn = tableInfo.some(col => col.name === 'is_monday_night');
  const hasTiebreakerColumn = tableInfo.some(col => col.name === 'is_tiebreaker_game');

  if (hasTiebreakerColumn && !hasMondayColumn) {
    console.log('✅ Migration already completed - is_tiebreaker_game column exists');
    db.close();
    process.exit(0);
  }

  if (!hasMondayColumn) {
    console.log('⚠️  is_monday_night column not found - database may already be migrated or corrupted');
    db.close();
    process.exit(1);
  }

  console.log('📝 Backing up database...');
  const backupPath = dbPath.replace('.sqlite', `_backup_${Date.now()}.sqlite`);
  db.backup(backupPath);
  console.log(`✅ Backup created: ${backupPath}`);

  console.log('🔄 Starting migration...');

  // SQLite doesn't support ALTER TABLE RENAME COLUMN directly in older versions
  // We need to use the recommended SQLite migration pattern

  db.exec('BEGIN TRANSACTION');

  try {
    // 1. Create new table with is_tiebreaker_game column
    db.exec(`
      CREATE TABLE games_new (
        id INTEGER PRIMARY KEY,
        week INTEGER NOT NULL,
        season INTEGER NOT NULL,
        home_team_id INTEGER NOT NULL,
        visitor_team_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        status TEXT DEFAULT 'scheduled',
        home_team_score INTEGER,
        visitor_team_score INTEGER,
        live_status TEXT,
        quarter_time_remaining TEXT,
        home_team_q1 INTEGER,
        home_team_q2 INTEGER,
        home_team_q3 INTEGER,
        home_team_q4 INTEGER,
        home_team_ot INTEGER,
        visitor_team_q1 INTEGER,
        visitor_team_q2 INTEGER,
        visitor_team_q3 INTEGER,
        visitor_team_q4 INTEGER,
        visitor_team_ot INTEGER,
        is_tiebreaker_game BOOLEAN DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (home_team_id) REFERENCES teams(id),
        FOREIGN KEY (visitor_team_id) REFERENCES teams(id)
      )
    `);
    console.log('✅ Created new table structure');

    // 2. Copy data from old table to new table
    db.exec(`
      INSERT INTO games_new (
        id, week, season, home_team_id, visitor_team_id, date, status,
        home_team_score, visitor_team_score, live_status, quarter_time_remaining,
        home_team_q1, home_team_q2, home_team_q3, home_team_q4, home_team_ot,
        visitor_team_q1, visitor_team_q2, visitor_team_q3, visitor_team_q4, visitor_team_ot,
        is_tiebreaker_game, created_at, updated_at
      )
      SELECT 
        id, week, season, home_team_id, visitor_team_id, date, status,
        home_team_score, visitor_team_score, live_status, quarter_time_remaining,
        home_team_q1, home_team_q2, home_team_q3, home_team_q4, home_team_ot,
        visitor_team_q1, visitor_team_q2, visitor_team_q3, visitor_team_q4, visitor_team_ot,
        is_monday_night, created_at, updated_at
      FROM games
    `);
    console.log('✅ Copied data to new table');

    // 3. Recalculate tiebreaker flags for each week
    const weeks = db.prepare(`
      SELECT DISTINCT week, season 
      FROM games_new 
      ORDER BY season, week
    `).all();

    console.log(`🎯 Recalculating tiebreaker games for ${weeks.length} weeks...`);

    for (const { week, season } of weeks) {
      // Reset all tiebreaker flags for this week
      db.prepare(`
        UPDATE games_new 
        SET is_tiebreaker_game = 0 
        WHERE week = ? AND season = ?
      `).run(week, season);

      // Find the last game of the week (latest date)
      const lastGame = db.prepare(`
        SELECT id 
        FROM games_new 
        WHERE week = ? AND season = ?
        ORDER BY date DESC 
        LIMIT 1
      `).get(week, season);

      if (lastGame) {
        // Set tiebreaker flag on the last game
        db.prepare(`
          UPDATE games_new 
          SET is_tiebreaker_game = 1 
          WHERE id = ?
        `).run(lastGame.id);
        console.log(`  ✅ Week ${week} ${season}: Set game ${lastGame.id} as tiebreaker`);
      }
    }

    // 4. Drop old table
    db.exec('DROP TABLE games');
    console.log('✅ Dropped old table');

    // 5. Rename new table
    db.exec('ALTER TABLE games_new RENAME TO games');
    console.log('✅ Renamed new table to games');

    // 6. Recreate indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_games_week_season ON games(week, season);
      CREATE INDEX IF NOT EXISTS idx_games_date ON games(date);
      CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
    `);
    console.log('✅ Recreated indexes');

    db.exec('COMMIT');
    console.log('🎉 Migration completed successfully!');

  } catch (error) {
    db.exec('ROLLBACK');
    console.error('❌ Migration failed, rolled back:', error.message);
    throw error;
  }

  db.close();

} catch (error) {
  console.error('❌ Migration error:', error.message);
  process.exit(1);
}
