#!/usr/bin/env node

/**
 * Utility script to recalculate scoring for specific weeks
 * Usage: node recalculate_scores.js [week] [season]
 * If no arguments provided, calculates for current week
 */

const scoringService = require('./src/services/scoring');
const nflApiService = require('./src/services/nfl-api');
const { getAllQuery } = require('./src/models/database');

async function main() {
    try {
        const args = process.argv.slice(2);

        let week, season;

        if (args.length >= 2) {
            week = parseInt(args[0]);
            season = parseInt(args[1]);
        } else if (args.length === 1) {
            week = parseInt(args[0]);
            season = new Date().getFullYear();
        } else {
            const current = nflApiService.getCurrentWeek();
            week = current.week;
            season = current.season;
        }

        console.log(`🔄 Recalculating scores for Week ${week}, ${season} season...`);

        // Show current scores before recalculation
        console.log('\n📊 Current scores:');
        const currentScores = await getAllQuery(
            'SELECT ws.*, u.first_name, u.last_name FROM weekly_scores ws JOIN users u ON ws.user_id = u.id WHERE week = ? AND season = ? ORDER BY total_points DESC',
            [week, season]
        );

        if (currentScores.length === 0) {
            console.log('No scores found for this week.');
        } else {
            currentScores.forEach(score => {
                console.log(`  ${score.first_name} ${score.last_name}: ${score.correct_picks}/${score.total_picks} + ${score.bonus_points} bonus = ${score.total_points} total`);
            });
        }

        // Recalculate
        await scoringService.calculateWeeklyScores(week, season);

        // Show updated scores
        console.log('\n✅ Updated scores:');
        const updatedScores = await getAllQuery(
            'SELECT ws.*, u.first_name, u.last_name FROM weekly_scores ws JOIN users u ON ws.user_id = u.id WHERE week = ? AND season = ? ORDER BY total_points DESC',
            [week, season]
        );

        updatedScores.forEach(score => {
            console.log(`  ${score.first_name} ${score.last_name}: ${score.correct_picks}/${score.total_picks} + ${score.bonus_points} bonus = ${score.total_points} total`);
        });

        console.log('\n🎉 Score recalculation complete!');

    } catch (error) {
        console.error('❌ Error recalculating scores:', error);
        process.exit(1);
    }
}

main();
