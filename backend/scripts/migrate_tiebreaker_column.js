/**
 * Database migration script to rename is_monday_night column to is_tiebreaker_game
 * and update the tiebreaker logic to use the last game of the week instead of hardcoded Monday detection
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'database.sqlite');

console.log(`🔧 Starting database migration: is_monday_night → is_tiebreaker_game`);
console.log(`Database path: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  
  // Check if migration is needed
  db.all("PRAGMA table_info(games)", [], (err, tableInfo) => {
    if (err) {
      console.error('❌ Error checking table structure:', err.message);
      db.close();
      process.exit(1);
    }

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

    console.log('📝 Creating database backup...');
    const backupPath = dbPath.replace('.sqlite', `_backup_${Date.now()}.sqlite`);
    
    // Simple file copy for backup
    fs.copyFile(dbPath, backupPath, (err) => {
      if (err) {
        console.error('❌ Error creating backup:', err.message);
        db.close();
        process.exit(1);
      }
      console.log(`✅ Backup created: ${backupPath}`);

      // Run migration
      runMigration(db);
    });
  });
});

function runMigration(db) {
  console.log('🔄 Starting migration...');

  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        console.error('❌ Error starting transaction:', err.message);
        db.close();
        process.exit(1);
      }

      // Create new table with is_tiebreaker_game column
      db.run(`
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
          is_tiebreaker_game BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (home_team_id) REFERENCES teams(id),
          FOREIGN KEY (visitor_team_id) REFERENCES teams(id)
        )
      `, (err) => {
        if (err) {
          console.error('❌ Error creating new table:', err.message);
          db.run('ROLLBACK');
          db.close();
          process.exit(1);
        }
        console.log('✅ Created new table structure');

        // Copy data
        copyData(db);
      });
    });
  });
}

function copyData(db) {
  db.run(`
    INSERT INTO games_new (
      id, week, season, home_team_id, visitor_team_id, date, status,
      home_team_score, visitor_team_score,
      is_tiebreaker_game, created_at, updated_at
    )
    SELECT 
      id, week, season, home_team_id, visitor_team_id, date, status,
      home_team_score, visitor_team_score,
      is_monday_night, created_at, updated_at
    FROM games
  `, (err) => {
    if (err) {
      console.error('❌ Error copying data:', err.message);
      db.run('ROLLBACK');
      db.close();
      process.exit(1);
    }
    console.log('✅ Copied data to new table');

    // Recalculate tiebreaker flags
    recalculateTiebreakers(db);
  });
}

function recalculateTiebreakers(db) {
  db.all(`
    SELECT DISTINCT week, season 
    FROM games_new 
    ORDER BY season, week
  `, [], (err, weeks) => {
    if (err) {
      console.error('❌ Error getting weeks:', err.message);
      db.run('ROLLBACK');
      db.close();
      process.exit(1);
    }

    console.log(`🎯 Recalculating tiebreaker games for ${weeks.length} weeks...`);

    let processed = 0;
    weeks.forEach(({ week, season }) => {
      // Reset all tiebreaker flags for this week
      db.run(`
        UPDATE games_new 
        SET is_tiebreaker_game = 0 
        WHERE week = ? AND season = ?
      `, [week, season], (err) => {
        if (err) {
          console.error(`❌ Error resetting week ${week}:`, err.message);
          return;
        }

        // Find the last game of the week
        db.get(`
          SELECT id 
          FROM games_new 
          WHERE week = ? AND season = ?
          ORDER BY date DESC 
          LIMIT 1
        `, [week, season], (err, lastGame) => {
          if (err) {
            console.error(`❌ Error finding last game for week ${week}:`, err.message);
            return;
          }

          if (lastGame) {
            // Set tiebreaker flag on the last game
            db.run(`
              UPDATE games_new 
              SET is_tiebreaker_game = 1 
              WHERE id = ?
            `, [lastGame.id], (err) => {
              if (err) {
                console.error(`❌ Error setting tiebreaker for week ${week}:`, err.message);
                return;
              }

              console.log(`  ✅ Week ${week} ${season}: Set game ${lastGame.id} as tiebreaker`);
              processed++;

              if (processed === weeks.length) {
                finishMigration(db);
              }
            });
          } else {
            processed++;
            if (processed === weeks.length) {
              finishMigration(db);
            }
          }
        });
      });
    });

    if (weeks.length === 0) {
      finishMigration(db);
    }
  });
}

function finishMigration(db) {
  // Drop old table
  db.run('DROP TABLE games', (err) => {
    if (err) {
      console.error('❌ Error dropping old table:', err.message);
      db.run('ROLLBACK');
      db.close();
      process.exit(1);
    }
    console.log('✅ Dropped old table');

    // Rename new table
    db.run('ALTER TABLE games_new RENAME TO games', (err) => {
      if (err) {
        console.error('❌ Error renaming table:', err.message);
        db.run('ROLLBACK');
        db.close();
        process.exit(1);
      }
      console.log('✅ Renamed new table to games');

      // Recreate indexes
      db.run(`CREATE INDEX IF NOT EXISTS idx_games_week_season ON games(week, season)`, (err) => {
        if (err) console.error('Warning: Error creating index:', err.message);
      });
      db.run(`CREATE INDEX IF NOT EXISTS idx_games_date ON games(date)`, (err) => {
        if (err) console.error('Warning: Error creating index:', err.message);
      });
      db.run(`CREATE INDEX IF NOT EXISTS idx_games_status ON games(status)`, (err) => {
        if (err) console.error('Warning: Error creating index:', err.message);
      });

      console.log('✅ Recreated indexes');

      // Commit transaction
      db.run('COMMIT', (err) => {
        if (err) {
          console.error('❌ Error committing transaction:', err.message);
          db.run('ROLLBACK');
          db.close();
          process.exit(1);
        }

        console.log('🎉 Migration completed successfully!');
        db.close();
        process.exit(0);
      });
    });
  });
}
