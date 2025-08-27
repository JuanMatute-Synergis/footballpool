#!/usr/bin/env node
const bcrypt = require('bcryptjs');
const { getAllQuery, getQuery, runQuery } = require('../src/models/database');
const scoring = require('../src/services/scoring');

// NFL team IDs and realistic team names/abbreviations for week 0 games (using correct DB IDs)
const WEEK_0_GAMES = [
  // Thursday Night Football
  { home: { id: 18, abbr: 'PHI', name: 'Eagles' }, visitor: { id: 19, abbr: 'DAL', name: 'Cowboys' }, date: '2025-09-05T00:20:00.000Z', isMonday: false },
  
  // Sunday 1PM ET games
  { home: { id: 3, abbr: 'BUF', name: 'Bills' }, visitor: { id: 5, abbr: 'MIA', name: 'Dolphins' }, date: '2025-09-08T17:00:00.000Z', isMonday: false },
  { home: { id: 1, abbr: 'NE', name: 'Patriots' }, visitor: { id: 4, abbr: 'NYJ', name: 'Jets' }, date: '2025-09-08T17:00:00.000Z', isMonday: false },
  { home: { id: 6, abbr: 'BAL', name: 'Ravens' }, visitor: { id: 7, abbr: 'PIT', name: 'Steelers' }, date: '2025-09-08T17:00:00.000Z', isMonday: false },
  { home: { id: 8, abbr: 'CLE', name: 'Browns' }, visitor: { id: 9, abbr: 'CIN', name: 'Bengals' }, date: '2025-09-08T17:00:00.000Z', isMonday: false },
  { home: { id: 10, abbr: 'HOU', name: 'Texans' }, visitor: { id: 12, abbr: 'IND', name: 'Colts' }, date: '2025-09-08T17:00:00.000Z', isMonday: false },
  { home: { id: 13, abbr: 'JAX', name: 'Jaguars' }, visitor: { id: 11, abbr: 'TEN', name: 'Titans' }, date: '2025-09-08T17:00:00.000Z', isMonday: false },
  { home: { id: 25, abbr: 'DET', name: 'Lions' }, visitor: { id: 22, abbr: 'GB', name: 'Packers' }, date: '2025-09-08T17:00:00.000Z', isMonday: false },
  { home: { id: 24, abbr: 'CHI', name: 'Bears' }, visitor: { id: 23, abbr: 'MIN', name: 'Vikings' }, date: '2025-09-08T17:00:00.000Z', isMonday: false },
  
  // Sunday 4PM ET games
  { home: { id: 27, abbr: 'ATL', name: 'Falcons' }, visitor: { id: 29, abbr: 'CAR', name: 'Panthers' }, date: '2025-09-08T20:25:00.000Z', isMonday: false },
  { home: { id: 26, abbr: 'NO', name: 'Saints' }, visitor: { id: 28, abbr: 'TB', name: 'Buccaneers' }, date: '2025-09-08T20:25:00.000Z', isMonday: false },
  { home: { id: 21, abbr: 'WSH', name: 'Commanders' }, visitor: { id: 20, abbr: 'NYG', name: 'Giants' }, date: '2025-09-08T20:25:00.000Z', isMonday: false },
  { home: { id: 15, abbr: 'DEN', name: 'Broncos' }, visitor: { id: 14, abbr: 'KC', name: 'Chiefs' }, date: '2025-09-08T20:25:00.000Z', isMonday: false },
  { home: { id: 16, abbr: 'LV', name: 'Raiders' }, visitor: { id: 17, abbr: 'LAC', name: 'Chargers' }, date: '2025-09-08T20:25:00.000Z', isMonday: false },
  { home: { id: 33, abbr: 'ARI', name: 'Cardinals' }, visitor: { id: 30, abbr: 'SF', name: '49ers' }, date: '2025-09-08T20:25:00.000Z', isMonday: false },
  
  // Sunday Night Football  
  { home: { id: 31, abbr: 'SEA', name: 'Seahawks' }, visitor: { id: 32, abbr: 'LAR', name: 'Rams' }, date: '2025-09-09T00:20:00.000Z', isMonday: false },
  
  // Monday Night Football
  { home: { id: 3, abbr: 'BUF', name: 'Bills' }, visitor: { id: 4, abbr: 'NYJ', name: 'Jets' }, date: '2025-09-09T00:15:00.000Z', isMonday: true }
];

// Test users with realistic names
const TEST_USERS = [
  { email: 'admin@nflpicks.com', firstName: 'Admin', lastName: 'User', password: 'admin123', isAdmin: true },
  { email: 'john.smith@test.com', firstName: 'John', lastName: 'Smith', password: 'test123', isAdmin: false },
  { email: 'sarah.jones@test.com', firstName: 'Sarah', lastName: 'Jones', password: 'test123', isAdmin: false },
  { email: 'mike.wilson@test.com', firstName: 'Mike', lastName: 'Wilson', password: 'test123', isAdmin: false },
  { email: 'lisa.brown@test.com', firstName: 'Lisa', lastName: 'Brown', password: 'test123', isAdmin: false },
  { email: 'david.taylor@test.com', firstName: 'David', lastName: 'Taylor', password: 'test123', isAdmin: false },
  { email: 'jennifer.davis@test.com', firstName: 'Jennifer', lastName: 'Davis', password: 'test123', isAdmin: false },
  { email: 'robert.miller@test.com', firstName: 'Robert', lastName: 'Miller', password: 'test123', isAdmin: false },
  { email: 'michelle.garcia@test.com', firstName: 'Michelle', lastName: 'Garcia', password: 'test123', isAdmin: false },
  { email: 'chris.martinez@test.com', firstName: 'Chris', lastName: 'Martinez', password: 'test123', isAdmin: false }
];

// Realistic score ranges and patterns
function generateRealisticScore() {
  const scoringPatterns = [
    // High scoring games
    { min: 24, max: 35, weight: 0.3 },
    // Medium scoring games  
    { min: 17, max: 28, weight: 0.5 },
    // Low scoring games
    { min: 10, max: 20, weight: 0.2 }
  ];
  
  const random = Math.random();
  let pattern;
  if (random < 0.3) pattern = scoringPatterns[0];
  else if (random < 0.8) pattern = scoringPatterns[1]; 
  else pattern = scoringPatterns[2];
  
  return Math.floor(Math.random() * (pattern.max - pattern.min + 1)) + pattern.min;
}

// Generate user picking tendencies (some users pick favorites, others underdogs, etc.)
const USER_TENDENCIES = {
  'conservative': 0.7, // 70% chance to pick home team
  'aggressive': 0.3,   // 30% chance to pick home team
  'balanced': 0.5,     // 50/50
  'underdog': 0.35,    // Likes underdogs
  'homer': 0.65        // Slight home team bias
};

async function clearWeek0Data() {
  console.log('Clearing existing Week 0 data...');
  await runQuery('DELETE FROM weekly_winners WHERE week = 0 AND season = 2025');
  await runQuery('DELETE FROM weekly_scores WHERE week = 0 AND season = 2025');
  await runQuery('DELETE FROM picks WHERE week = 0 AND season = 2025');
  await runQuery('DELETE FROM games WHERE week = 0 AND season = 2025');
}

async function ensureUsers() {
  console.log('Ensuring test users exist...');
  const existingUsers = await getAllQuery('SELECT email FROM users');
  const existingEmails = new Set(existingUsers.map(u => u.email));
  
  const createdUsers = [];
  for (const userData of TEST_USERS) {
    if (existingEmails.has(userData.email)) {
      const user = await getQuery('SELECT id, email, first_name, last_name, is_admin FROM users WHERE email = ?', [userData.email]);
      createdUsers.push(user);
      console.log(`User ${userData.email} already exists`);
    } else {
      const passwordHash = await bcrypt.hash(userData.password, 10);
      const result = await runQuery(
        'INSERT INTO users (email, first_name, last_name, password_hash, is_admin, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [userData.email, userData.firstName, userData.lastName, passwordHash, userData.isAdmin ? 1 : 0]
      );
      const user = await getQuery('SELECT id, email, first_name, last_name, is_admin FROM users WHERE id = ?', [result.lastID]);
      createdUsers.push(user);
      console.log(`Created user ${userData.email}`);
    }
  }
  return createdUsers;
}

async function createWeek0Schedule() {
  console.log('Creating Week 0 schedule...');
  
  const gameIds = [];
  for (let i = 0; i < WEEK_0_GAMES.length; i++) {
    const game = WEEK_0_GAMES[i];
    
    // Use a predictable game ID for week 0 (500000 + index)
    const gameId = 500000 + i;
    
    await runQuery(`
      INSERT OR REPLACE INTO games 
      (id, week, season, date, home_team_id, visitor_team_id, status, is_monday_night, created_at, updated_at)
      VALUES (?, 0, 2025, ?, ?, ?, 'scheduled', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [gameId, game.date, game.home.id, game.visitor.id, game.isMonday ? 1 : 0]);
    
    gameIds.push(gameId);
    console.log(`Created game ${gameId}: ${game.visitor.abbr} @ ${game.home.abbr}`);
  }
  
  return gameIds;
}

async function generatePicks(users, gameIds) {
  console.log('Generating picks for all users...');
  
  const tendencyTypes = Object.keys(USER_TENDENCIES);
  
  for (let userIndex = 0; userIndex < users.length; userIndex++) {
    const user = users[userIndex];
    const tendency = tendencyTypes[userIndex % tendencyTypes.length];
    const homeTeamBias = USER_TENDENCIES[tendency];
    
    console.log(`Generating picks for ${user.first_name} ${user.last_name} (${tendency} tendency)`);
    
    let picksCount = 0;
    for (const gameId of gameIds) {
      const game = await getQuery('SELECT * FROM games WHERE id = ?', [gameId]);
      
      // Determine pick based on user tendency
      const pickHome = Math.random() < homeTeamBias;
      const selectedTeamId = pickHome ? game.home_team_id : game.visitor_team_id;
      
      // Monday night prediction (if applicable)
      let mondayNightPrediction = null;
      if (game.is_monday_night) {
        // Vary predictions around realistic total (35-55 points)
        const baseTotal = 45;
        const variance = 10;
        mondayNightPrediction = Math.floor(Math.random() * variance * 2) + (baseTotal - variance);
      }
      
      await runQuery(`
        INSERT INTO picks 
        (user_id, game_id, selected_team_id, monday_night_prediction, week, season, created_at, updated_at)
        VALUES (?, ?, ?, ?, 0, 2025, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [user.id, gameId, selectedTeamId, mondayNightPrediction]);
      
      picksCount++;
    }
    
    console.log(`  Generated ${picksCount} picks`);
  }
}

async function simulateGameResults(gameIds) {
  console.log('Simulating game results...');
  
  for (const gameId of gameIds) {
    const homeScore = generateRealisticScore();
    const visitorScore = generateRealisticScore();
    
    // Occasionally create closer games or blowouts
    const gameType = Math.random();
    let finalHomeScore = homeScore;
    let finalVisitorScore = visitorScore;
    
    if (gameType < 0.15) { // 15% chance of close game (1-3 point difference)
      const diff = Math.floor(Math.random() * 3) + 1;
      if (homeScore > visitorScore) {
        finalVisitorScore = finalHomeScore - diff;
      } else {
        finalHomeScore = finalVisitorScore - diff;
      }
    } else if (gameType < 0.25) { // 10% chance of blowout (14+ point difference)
      const diff = Math.floor(Math.random() * 14) + 14;
      if (homeScore > visitorScore) {
        finalVisitorScore = Math.max(3, finalHomeScore - diff);
      } else {
        finalHomeScore = Math.max(3, finalVisitorScore - diff);
      }
    }
    
    await runQuery(`
      UPDATE games 
      SET home_team_score = ?, visitor_team_score = ?, status = 'final', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [finalHomeScore, finalVisitorScore, gameId]);
    
    const game = await getQuery(`
      SELECT g.*, ht.abbreviation as home_abbr, vt.abbreviation as visitor_abbr 
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.id  
      JOIN teams vt ON g.visitor_team_id = vt.id
      WHERE g.id = ?
    `, [gameId]);
    
    const winner = finalHomeScore > finalVisitorScore ? game.home_abbr : 
                   finalVisitorScore > finalHomeScore ? game.visitor_abbr : 'TIE';
    
    console.log(`  ${game.visitor_abbr} ${finalVisitorScore} - ${finalHomeScore} ${game.home_abbr} (Winner: ${winner})`);
  }
}

async function calculateScoresAndWinners() {
  console.log('Calculating weekly scores...');
  await scoring.calculateWeeklyScores(0, 2025);
  
  // Display results summary
  const weeklyScores = await getAllQuery(`
    SELECT 
      ws.*,
      u.first_name,
      u.last_name
    FROM weekly_scores ws
    JOIN users u ON ws.user_id = u.id
    WHERE ws.week = 0 AND ws.season = 2025
    ORDER BY ws.total_points DESC, ws.monday_night_diff ASC NULLS LAST
  `);
  
  const winners = await getAllQuery(`
    SELECT 
      ww.*,
      u.first_name,
      u.last_name
    FROM weekly_winners ww
    JOIN users u ON ww.user_id = u.id
    WHERE ww.week = 0 AND ww.season = 2025
  `);
  
  console.log('\n📊 WEEK 0 FINAL RESULTS');
  console.log('=' + '='.repeat(50));
  
  console.log('\n🏆 Weekly Winner(s):');
  winners.forEach((winner, index) => {
    const tieText = winner.is_tie ? ' (TIE)' : '';
    const tieBreakerText = winner.tie_breaker_diff !== null ? ` | MNF Diff: ${winner.tie_breaker_diff}` : '';
    console.log(`  ${index + 1}. ${winner.first_name} ${winner.last_name} - ${winner.points} points${tieText}${tieBreakerText}`);
  });
  
  console.log('\n📈 Top 5 Leaderboard:');
  weeklyScores.slice(0, 5).forEach((score, index) => {
    const percentage = score.total_picks > 0 ? ((score.correct_picks / score.total_picks) * 100).toFixed(1) : '0.0';
    const bonusText = score.bonus_points > 0 ? ` (+${score.bonus_points} bonus)` : '';
    const perfectText = score.is_perfect_week ? ' 🎯 PERFECT!' : '';
    console.log(`  ${index + 1}. ${score.first_name} ${score.last_name}: ${score.correct_picks}/${score.total_picks} (${percentage}%) = ${score.total_points} pts${bonusText}${perfectText}`);
  });
  
  console.log('\n📊 Full Results:');
  console.table(weeklyScores.map(s => ({
    Name: `${s.first_name} ${s.last_name}`,
    'Correct': s.correct_picks,
    'Total': s.total_picks,
    'Pct': s.total_picks > 0 ? `${((s.correct_picks / s.total_picks) * 100).toFixed(1)}%` : '0%',
    'Bonus': s.bonus_points,
    'Points': s.total_points,
    'MNF Pred': s.monday_night_prediction,
    'MNF Actual': s.monday_night_actual,
    'MNF Diff': s.monday_night_diff,
    'Perfect': s.is_perfect_week ? 'YES' : 'NO'
  })));
  
  return { scores: weeklyScores, winners };
}

async function main() {
  console.log('🏈 GENERATING TEST WEEK 0 DATA');
  console.log('=' + '='.repeat(40));
  
  try {
    // Step 1: Clean existing data
    await clearWeek0Data();
    
    // Step 2: Ensure users exist
    const users = await ensureUsers();
    console.log(`✅ ${users.length} users ready`);
    
    // Step 3: Create week 0 schedule  
    const gameIds = await createWeek0Schedule();
    console.log(`✅ ${gameIds.length} games scheduled`);
    
    // Step 4: Generate picks for all users
    await generatePicks(users, gameIds);
    console.log('✅ All picks generated');
    
    // Step 5: Simulate game results
    await simulateGameResults(gameIds);
    console.log('✅ Game results simulated');
    
    // Step 6: Calculate scores and determine winners
    const results = await calculateScoresAndWinners();
    console.log('✅ Scores calculated and winners determined');
    
    console.log('\n🎉 Test Week 0 generation complete!');
    console.log('\nYou can now:');
    console.log('• View picks at: http://localhost:4200/picks (select Week 0)');
    console.log('• View results at: http://localhost:4200/results (select Week 0)');  
    console.log('• View leaderboard at: http://localhost:4200/leaderboard');
    console.log('• View results grid at: http://localhost:4200/results-grid (select Week 0)');
    
  } catch (error) {
    console.error('❌ Error generating test week:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().then(() => process.exit(0));
}

module.exports = { generateRealisticScore, clearWeek0Data, ensureUsers, createWeek0Schedule };
