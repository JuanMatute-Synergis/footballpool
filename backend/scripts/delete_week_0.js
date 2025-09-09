const path = require('path');
const { initializeDatabase, runQuery, getAllQuery } = require('../src/models/database.js');

async function deleteWeek0Data() {
    try {
        console.log('Initializing database...');
        await initializeDatabase();

        console.log('Checking for week 0 data...');

        // Check for week 0 games
        const week0Games = await getAllQuery('SELECT COUNT(*) as count FROM games WHERE week = 0');
        console.log(`Found ${week0Games[0].count} week 0 games`);

        // Check for week 0 picks
        const week0Picks = await getAllQuery('SELECT COUNT(*) as count FROM picks WHERE week = 0');
        console.log(`Found ${week0Picks[0].count} week 0 picks`);

        // Check for week 0 scores
        const week0Scores = await getAllQuery('SELECT COUNT(*) as count FROM weekly_scores WHERE week = 0');
        console.log(`Found ${week0Scores[0].count} week 0 scores`);

        if (week0Games[0].count > 0 || week0Picks[0].count > 0 || week0Scores[0].count > 0) {
            console.log('Deleting week 0 data...');

            // Delete in the correct order to avoid foreign key constraints
            await runQuery('DELETE FROM weekly_winners WHERE week = 0');
            console.log('Deleted week 0 weekly winners');

            await runQuery('DELETE FROM weekly_scores WHERE week = 0');
            console.log('Deleted week 0 weekly scores');

            await runQuery('DELETE FROM picks WHERE week = 0');
            console.log('Deleted week 0 picks');

            await runQuery('DELETE FROM games WHERE week = 0');
            console.log('Deleted week 0 games');

            console.log('Week 0 data deletion completed successfully!');
        } else {
            console.log('No week 0 data found to delete.');
        }

    } catch (error) {
        console.error('Error deleting week 0 data:', error);
        process.exit(1);
    }
}

// Run the deletion
deleteWeek0Data().then(() => {
    console.log('Script completed');
    process.exit(0);
});
