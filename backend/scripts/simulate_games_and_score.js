#!/usr/bin/env node
const path = require('path');
const { getAllQuery, runQuery } = require('../src/models/database');
const scoring = require('../src/services/scoring');

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node simulate_games_and_score.js <season> <week> [--random] [--scores JSON]');
    process.exit(1);
  }

  const season = parseInt(args[0], 10);
  const week = parseInt(args[1], 10);
  const random = args.includes('--random');
  const scoresArgIndex = args.findIndex(a => a === '--scores');
  let scoresMap = {};
  if (scoresArgIndex !== -1 && args[scoresArgIndex + 1]) {
    try {
      scoresMap = JSON.parse(args[scoresArgIndex + 1]);
    } catch (e) {
      console.error('Failed to parse --scores JSON:', e.message);
      process.exit(1);
    }
  }

  console.log(`Simulating scores for season ${season} week ${week}`);

  const games = await getAllQuery('SELECT * FROM games WHERE week = ? AND season = ? ORDER BY date ASC', [week, season]);
  if (!games || games.length === 0) {
    console.error('No games found for that week/season');
    process.exit(1);
  }

  for (const g of games) {
    let home = null;
    let visitor = null;
    if (scoresMap && scoresMap[g.id]) {
      home = parseInt(scoresMap[g.id].home, 10);
      visitor = parseInt(scoresMap[g.id].visitor, 10);
    } else if (random) {
      // simple random scores 10..35
      home = Math.floor(Math.random() * 26) + 10;
      visitor = Math.floor(Math.random() * 26) + 10;
    } else {
      // skip if no instructions
      continue;
    }

    // Update game to final with scores
    await runQuery(
      'UPDATE games SET home_team_score = ?, visitor_team_score = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [home, visitor, 'final', g.id]
    );
    console.log(`Updated game ${g.id}: ${home}-${visitor}`);
  }

  // Run scoring for the week
  console.log('Running scoring.calculateWeeklyScores...');
  await scoring.calculateWeeklyScores(week, season);

  // Print results
  const weeklyScores = await getAllQuery('SELECT * FROM weekly_scores WHERE week = ? AND season = ? ORDER BY total_points DESC, monday_night_diff ASC', [week, season]);
  const winners = await getAllQuery('SELECT * FROM weekly_winners WHERE week = ? AND season = ?', [week, season]);

  console.log('\nWeekly Scores:');
  console.table(weeklyScores.map(r => ({ user_id: r.user_id, correct: r.correct_picks, total: r.total_picks, bonus: r.bonus_points, total_points: r.total_points, mn_diff: r.monday_night_diff })));

  console.log('\nWeekly Winners:');
  console.table(winners.map(w => ({ user_id: w.user_id, points: w.points, is_tie: w.is_tie, tie_breaker_diff: w.tie_breaker_diff })));

  process.exit(0);
}

main().catch(err => {
  console.error('Simulation error:', err);
  process.exit(1);
});
