#!/usr/bin/env node
const bcrypt = require('bcryptjs');
const nflApiService = require('../src/services/nfl-api');
const scoring = require('../src/services/scoring');
const { getAllQuery, getQuery, runQuery } = require('../src/models/database');

async function ensureUsers() {
  const users = await getAllQuery('SELECT id FROM users');
  if (users.length > 0) return users;

  console.log('No users found - creating 5 test users');
  const created = [];
  for (let i = 1; i <= 5; i++) {
    const email = `testuser${i}@example.com`;
    const firstName = `Test${i}`;
    const lastName = `User${i}`;
    const passwordHash = await bcrypt.hash('test123', 8);
    const res = await runQuery(
      'INSERT INTO users (email, first_name, last_name, password_hash, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      [email, firstName, lastName, passwordHash]
    );
    const user = await getQuery('SELECT id FROM users WHERE id = ?', [res.id || res.lastID]);
    created.push(user);
  }
  return await getAllQuery('SELECT id FROM users');
}

async function main() {
  const args = process.argv.slice(2);
  const useRandomScores = true;

  let week, season;
  if (args.length >= 2) {
    season = parseInt(args[0], 10);
    week = parseInt(args[1], 10);
  } else {
    const cur = nflApiService.getCurrentWeek();
    week = cur.week;
    season = cur.season;
  }

  console.log(`Seeding TEST WEEK: season=${season} week=${week}`);

  // Ensure games exist for the week
  let games = await getAllQuery('SELECT * FROM games WHERE week = ? AND season = ? ORDER BY date ASC', [week, season]);
  if (!games || games.length === 0) {
    console.log('No games found in DB for that week - attempting to fetch schedule...');
    try {
      await nflApiService.fetchWeekSchedule(week, season);
    } catch (e) {
      console.warn('Fetch schedule failed:', e.message || e);
    }
    games = await getAllQuery('SELECT * FROM games WHERE week = ? AND season = ? ORDER BY date ASC', [week, season]);
  }

  if (!games || games.length === 0) {
    console.error('Cannot seed test week: no games available');
    process.exit(1);
  }

  // Ensure users exist
  const users = await ensureUsers();
  console.log(`Using ${users.length} users for picks`);

  // Clear existing picks for the week
  await runQuery('DELETE FROM picks WHERE week = ? AND season = ?', [week, season]);

  // Create random picks for each user for every game
  for (const u of users) {
    let picksInserted = 0;
    for (const g of games) {
      const pickHome = Math.random() < 0.5;
      const selectedTeamId = pickHome ? g.home_team_id : g.visitor_team_id;
      let mnPrediction = null;
      if (g.is_tiebreaker_game) {
        mnPrediction = Math.floor(Math.random() * 41) + 10; // 10..50
      }
      await runQuery(
        'INSERT INTO picks (user_id, game_id, selected_team_id, monday_night_prediction, week, season, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [u.id, g.id, selectedTeamId, mnPrediction, week, season]
      );
      picksInserted++;
    }
    console.log(`Inserted ${picksInserted} picks for user ${u.id}`);
  }

  // Assign random final scores to all games in the week
  for (const g of games) {
    const homeScore = Math.floor(Math.random() * 31) + 10; // 10..40
    const visitorScore = Math.floor(Math.random() * 31) + 10;
    await runQuery('UPDATE games SET home_team_score = ?, visitor_team_score = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [homeScore, visitorScore, 'final', g.id]);
    console.log(`Set game ${g.id} final score ${homeScore}-${visitorScore}`);
  }

  // Run scoring
  await scoring.calculateWeeklyScores(week, season);

  // Print summary
  const weeklyScores = await getAllQuery('SELECT * FROM weekly_scores WHERE week = ? AND season = ? ORDER BY total_points DESC, monday_night_diff ASC', [week, season]);
  const winners = await getAllQuery('SELECT * FROM weekly_winners WHERE week = ? AND season = ?', [week, season]);

  console.log('\nWeekly Scores (top 10):');
  console.table(weeklyScores.slice(0, 10).map(r => ({ user_id: r.user_id, correct: r.correct_picks, total: r.total_picks, bonus: r.bonus_points, total_points: r.total_points, mn_diff: r.monday_night_diff })));

  console.log('\nWeekly Winners:');
  console.table(winners.map(w => ({ user_id: w.user_id, points: w.points, is_tie: w.is_tie, tie_breaker_diff: w.tie_breaker_diff })));

  console.log('\nTest week seeding complete. Use the UI to view picks, scores, and leaderboard for the selected week.');
  process.exit(0);
}

main().catch(err => {
  console.error('Error seeding test week:', err);
  process.exit(1);
});
