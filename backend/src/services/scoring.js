const { getAllQuery, runQuery, getQuery } = require('../models/database');

class ScoringService {
  // Calculate scores for a completed week
  async calculateWeeklyScores(week, season) {
    try {
      console.log(`Calculating scores for week ${week}, season ${season}`);

      // Get all users who made picks for this week
      const users = await getAllQuery(`
        SELECT DISTINCT user_id FROM picks WHERE week = ? AND season = ?
      `, [week, season]);

      for (const user of users) {
        await this.calculateUserWeeklyScore(user.user_id, week, season);
      }

      // Determine weekly winners
      await this.determineWeeklyWinners(week, season);

      console.log(`Completed score calculation for week ${week}, season ${season}`);
    } catch (error) {
      console.error('Error calculating weekly scores:', error);
      throw error;
    }
  }

  // Calculate individual user's weekly score
  async calculateUserWeeklyScore(userId, week, season) {
    try {
      // Get user's picks for the week
      const picks = await getAllQuery(`
        SELECT 
          p.*,
          g.home_team_id,
          g.visitor_team_id,
          g.home_team_score,
          g.visitor_team_score,
          g.status,
          g.is_monday_night
        FROM picks p
        JOIN games g ON p.game_id = g.id
        WHERE p.user_id = ? AND p.week = ? AND p.season = ?
      `, [userId, week, season]);

      if (picks.length === 0) {
        return; // No picks for this user/week
      }

      let correctPicks = 0;
      let totalPicks = 0;
      let mondayNightPrediction = null;
      let mondayNightActual = null;
      let mondayNightDiff = null;

      // Calculate correct picks
      for (const pick of picks) {
        if (pick.status === 'final' && pick.home_team_score !== null && pick.visitor_team_score !== null) {
          totalPicks++;
          
          // Determine winning team
          const winningTeamId = pick.home_team_score > pick.visitor_team_score 
            ? pick.home_team_id 
            : pick.visitor_team_score > pick.home_team_score 
              ? pick.visitor_team_id 
              : null; // Tie

          // Check if pick was correct
          if (winningTeamId && pick.selected_team_id === winningTeamId) {
            correctPicks++;
          }

          // Handle Monday night game
          if (pick.is_monday_night && pick.monday_night_prediction !== null) {
            mondayNightPrediction = pick.monday_night_prediction;
            mondayNightActual = pick.home_team_score + pick.visitor_team_score;
            mondayNightDiff = Math.abs(mondayNightPrediction - mondayNightActual);
          }
        }
      }

      // Calculate bonus points
      let bonusPoints = 0;
      const isPerfectWeek = totalPicks > 0 && correctPicks === totalPicks;
      if (isPerfectWeek) {
        bonusPoints = 3;
      }

      const totalPoints = correctPicks + bonusPoints;

      // Insert or update weekly score
      await runQuery(`
        INSERT OR REPLACE INTO weekly_scores 
        (user_id, week, season, correct_picks, total_picks, bonus_points, total_points, 
         monday_night_prediction, monday_night_actual, monday_night_diff, is_perfect_week, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        userId, week, season, correctPicks, totalPicks, bonusPoints, totalPoints,
        mondayNightPrediction, mondayNightActual, mondayNightDiff, isPerfectWeek ? 1 : 0
      ]);

      console.log(`Updated score for user ${userId}: ${correctPicks}/${totalPicks} + ${bonusPoints} bonus = ${totalPoints} total`);
    } catch (error) {
      console.error(`Error calculating user ${userId} weekly score:`, error);
      throw error;
    }
  }

  // Determine weekly winners
  async determineWeeklyWinners(week, season) {
    try {
      // Clear existing winners for this week
      await runQuery('DELETE FROM weekly_winners WHERE week = ? AND season = ?', [week, season]);

      // Get top score(s) for the week
      const topScore = await getQuery(`
        SELECT MAX(total_points) as max_points
        FROM weekly_scores
        WHERE week = ? AND season = ?
      `, [week, season]);

      if (!topScore || topScore.max_points === null) {
        return; // No scores available
      }

      // Get all users with the top score
      const winners = await getAllQuery(`
        SELECT *
        FROM weekly_scores
        WHERE week = ? AND season = ? AND total_points = ?
        ORDER BY monday_night_diff ASC NULLS LAST
      `, [week, season, topScore.max_points]);

      if (winners.length === 0) {
        return;
      }

      // If multiple winners, use Monday night tie-breaker
      let finalWinners = winners;
      const isTie = winners.length > 1;

      if (isTie) {
        // Find winners with best Monday night prediction (lowest diff)
        const bestMonday = winners.find(w => w.monday_night_diff !== null);
        if (bestMonday) {
          const bestDiff = bestMonday.monday_night_diff;
          finalWinners = winners.filter(w => w.monday_night_diff === bestDiff);
        }
      }

      // Insert winners
      for (const winner of finalWinners) {
        await runQuery(`
          INSERT INTO weekly_winners 
          (user_id, week, season, points, is_tie, tie_breaker_diff) 
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          winner.user_id,
          week,
          season,
          winner.total_points,
          finalWinners.length > 1 ? 1 : 0,
          winner.monday_night_diff
        ]);
      }

      console.log(`Determined ${finalWinners.length} winner(s) for week ${week}`);
    } catch (error) {
      console.error('Error determining weekly winners:', error);
      throw error;
    }
  }

  // Check if a week is complete (all games finished)
  async isWeekComplete(week, season) {
    try {
      const incompleteGames = await getQuery(`
        SELECT COUNT(*) as count
        FROM games
        WHERE week = ? AND season = ? AND status != 'final'
      `, [week, season]);

      return incompleteGames.count === 0;
    } catch (error) {
      console.error('Error checking if week is complete:', error);
      return false;
    }
  }

  // Auto-calculate scores for completed weeks
  async autoCalculateScores() {
    try {
      // Get recent weeks that might need scoring
      const recentWeeks = await getAllQuery(`
        SELECT DISTINCT week, season
        FROM games
        WHERE status = 'final'
        AND NOT EXISTS (
          SELECT 1 FROM weekly_scores ws 
          WHERE ws.week = games.week AND ws.season = games.season
        )
        ORDER BY season DESC, week DESC
        LIMIT 5
      `);

      for (const weekData of recentWeeks) {
        if (await this.isWeekComplete(weekData.week, weekData.season)) {
          await this.calculateWeeklyScores(weekData.week, weekData.season);
        }
      }
    } catch (error) {
      console.error('Error in auto-calculate scores:', error);
    }
  }
}

module.exports = new ScoringService();
