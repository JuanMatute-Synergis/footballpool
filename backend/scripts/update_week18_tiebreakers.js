/**
 * Script to update Week 18 tiebreaker predictions for users
 */

const { getAllQuery, runQuery } = require('../src/models/database');

async function updateTiebreakers() {
  console.log('🔄 Updating Week 18 tiebreaker predictions...');

  try {
    // Get Week 18 tiebreaker game ID
    const tiebreakerGame = await getAllQuery(
      'SELECT id FROM games WHERE week = 18 AND season = 2025 AND is_tiebreaker_game = 1 LIMIT 1'
    );
    
    if (!tiebreakerGame || tiebreakerGame.length === 0) {
      console.log('❌ No tiebreaker game found for Week 18');
      process.exit(1);
    }
    
    const gameId = tiebreakerGame[0].id;
    console.log('🎯 Tiebreaker game ID:', gameId);
    
    // Get all users
    const users = await getAllQuery('SELECT id, email FROM users');
    console.log('👥 Found users:', users.map(u => `${u.email} (${u.id})`).join(', '));
    
    // Map user IDs to predictions based on the emails
    const predictionsByEmail = {
      'hbrown8@yahoo.com': 34,        // Heather
      'free67bird@gmail.com': 9,      // Liz
      'renjones714@gmail.com': 29,    // Renee
      'k8tiec18@aol.com': 36,         // Katie
      'kskinker24@gmail.com': 31,     // Kristin
      'tlgildner8@yahoo.com': 44      // Tracy
    };
    
    console.log('\n📝 Processing predictions...');
    
    for (const user of users) {
      const prediction = predictionsByEmail[user.email];
      
      if (prediction !== undefined) {
        // Check if pick exists for this game
        const existingPick = await getAllQuery(
          'SELECT id, monday_night_prediction FROM picks WHERE user_id = ? AND game_id = ? AND week = 18 AND season = 2025',
          [user.id, gameId]
        );
        
        if (existingPick && existingPick.length > 0) {
          // Update existing pick
          await runQuery(
            'UPDATE picks SET monday_night_prediction = ? WHERE id = ?',
            [prediction, existingPick[0].id]
          );
          console.log(`✅ ${user.email}: ${existingPick[0].monday_night_prediction || 'null'} → ${prediction}`);
        } else {
          console.log(`⚠️  ${user.email}: No pick found for this game - they need to make a pick first`);
        }
      } else {
        console.log(`⚠️  ${user.email}: No prediction specified`);
      }
    }
    
    console.log('\n🎉 Tiebreaker predictions updated successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error updating tiebreakers:', error);
    process.exit(1);
  }
}

updateTiebreakers();
