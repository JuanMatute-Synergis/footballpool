const scoringService = require('./src/services/scoring');

async function calculateScores() {
    try {
        console.log('Starting weekly score calculation for Week 1, 2025...');
        await scoringService.calculateWeeklyScores(1, 2025);
        console.log('Weekly scores calculated successfully!');
    } catch (error) {
        console.error('Error calculating scores:', error);
    }
}

calculateScores();
