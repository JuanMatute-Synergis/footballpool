const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../database.sqlite');

let db;

function getDatabase() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        throw err;
      }
      console.log('Connected to SQLite database');

      // Enable foreign key constraints
      db.run('PRAGMA foreign_keys = ON');
    });
  }
  return db;
}

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const database = getDatabase();

    // Create tables
    const createTables = `
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        is_admin BOOLEAN DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Teams table
      CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        city TEXT NOT NULL,
        abbreviation TEXT NOT NULL,
        conference TEXT NOT NULL,
        division TEXT NOT NULL,
        logo_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Games table
      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY,
        week INTEGER NOT NULL,
        season INTEGER NOT NULL,
        home_team_id INTEGER NOT NULL,
        visitor_team_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        status TEXT DEFAULT 'scheduled',
        live_status TEXT,
        home_team_score INTEGER,
        visitor_team_score INTEGER,
        quarter_time_remaining TEXT,
        is_monday_night BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (home_team_id) REFERENCES teams(id),
        FOREIGN KEY (visitor_team_id) REFERENCES teams(id)
      );

      -- Picks table
      CREATE TABLE IF NOT EXISTS picks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        game_id INTEGER NOT NULL,
        selected_team_id INTEGER NOT NULL,
        monday_night_prediction INTEGER,
        week INTEGER NOT NULL,
        season INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (game_id) REFERENCES games(id),
        FOREIGN KEY (selected_team_id) REFERENCES teams(id),
        UNIQUE(user_id, game_id)
      );

      -- Weekly scores table
      CREATE TABLE IF NOT EXISTS weekly_scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        week INTEGER NOT NULL,
        season INTEGER NOT NULL,
        correct_picks INTEGER DEFAULT 0,
        total_picks INTEGER DEFAULT 0,
        bonus_points INTEGER DEFAULT 0,
        total_points INTEGER DEFAULT 0,
        monday_night_prediction INTEGER,
        monday_night_actual INTEGER,
        monday_night_diff INTEGER,
        is_perfect_week BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, week, season)
      );

      -- Weekly winners table
      CREATE TABLE IF NOT EXISTS weekly_winners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        week INTEGER NOT NULL,
        season INTEGER NOT NULL,
        points INTEGER NOT NULL,
        is_tie BOOLEAN DEFAULT 0,
        tie_breaker_diff INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      -- API cache table
      CREATE TABLE IF NOT EXISTS api_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cache_key TEXT UNIQUE NOT NULL,
        data TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_games_week_season ON games(week, season);
      CREATE INDEX IF NOT EXISTS idx_picks_user_week ON picks(user_id, week, season);
      CREATE INDEX IF NOT EXISTS idx_weekly_scores_week_season ON weekly_scores(week, season);
      CREATE INDEX IF NOT EXISTS idx_api_cache_key ON api_cache(cache_key);
      CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache(expires_at);
    `;

    database.exec(createTables, (err) => {
      if (err) {
        console.error('Error creating tables:', err);
        reject(err);
      } else {
        console.log('Database tables created successfully');

        // Run migration to add is_active column if it doesn't exist
        database.run('ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1', (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding is_active column:', err);
            reject(err);
          } else {
            // Add live_status column to games table if it doesn't exist
            database.run('ALTER TABLE games ADD COLUMN live_status TEXT', (err2) => {
              if (err2 && !err2.message.includes('duplicate column name')) {
                console.log('live_status column already exists or error:', err2.message);
              }
              // Add quarter_time_remaining column to games table if it doesn't exist
              database.run('ALTER TABLE games ADD COLUMN quarter_time_remaining TEXT', (err3) => {
                if (err3 && !err3.message.includes('duplicate column name')) {
                  console.log('quarter_time_remaining column already exists or error:', err3.message);
                }
                console.log('Migration completed successfully');
                resolve();
              });
            });
          }
        });
      }
    });
  });
}

function closeDatabase() {
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database connection closed');
      }
    });
  }
}

// Utility function to run queries with promises
function runQuery(sql, params = []) {
  const database = getDatabase();
  return new Promise((resolve, reject) => {
    database.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
}

function getQuery(sql, params = []) {
  const database = getDatabase();
  return new Promise((resolve, reject) => {
    database.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function getAllQuery(sql, params = []) {
  const database = getDatabase();
  return new Promise((resolve, reject) => {
    database.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

module.exports = {
  getDatabase,
  initializeDatabase,
  closeDatabase,
  runQuery,
  getQuery,
  getAllQuery
};
