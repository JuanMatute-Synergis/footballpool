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
      // Get ALL games for the week (to check if week is complete)
      const allGames = await getAllQuery(`
        SELECT COUNT(*) as total_games, 
               COUNT(CASE WHEN status = 'final' THEN 1 END) as completed_games
        FROM games 
        WHERE week = ? AND season = ?
      `, [week, season]);

      const isWeekComplete = allGames[0].total_games === allGames[0].completed_games;
      const totalGamesInWeek = allGames[0].total_games;

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
      let totalPicksMade = picks.length; // Total picks user made
      let mondayNightPrediction = null;
      let mondayNightActual = null;
      let mondayNightDiff = null;

      // Calculate correct picks (only count completed games)
      for (const pick of picks) {
        if (pick.status === 'final' && pick.home_team_score !== null && pick.visitor_team_score !== null) {
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
        }

        // Handle Monday night game (process regardless of game completion status)
        if (pick.is_monday_night) {
          if (pick.monday_night_prediction !== null && pick.home_team_score !== null && pick.visitor_team_score !== null) {
            mondayNightPrediction = pick.monday_night_prediction;
            mondayNightActual = pick.home_team_score + pick.visitor_team_score;
            mondayNightDiff = Math.abs(mondayNightPrediction - mondayNightActual);
          } else if (pick.monday_night_prediction !== null) {
            // Store prediction even if game isn't complete yet
            mondayNightPrediction = pick.monday_night_prediction;
          }
        }
      }

      // Calculate bonus points - ONLY if week is complete AND user has all picks AND all picks are correct
      let bonusPoints = 0;
      const isPerfectWeek = isWeekComplete &&
        totalPicksMade === totalGamesInWeek &&
        correctPicks === totalGamesInWeek;
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
        userId, week, season, correctPicks, totalPicksMade, bonusPoints, totalPoints,
        mondayNightPrediction, mondayNightActual, mondayNightDiff, isPerfectWeek ? 1 : 0
      ]);

      console.log(`Updated score for user ${userId}: ${correctPicks}/${totalPicksMade} (${totalGamesInWeek} total games) + ${bonusPoints} bonus = ${totalPoints} total. Week complete: ${isWeekComplete}`);
    } catch (error) {
      console.error(`Error calculating user ${userId} weekly score:`, error);
      throw error;
    }
  }

  // Determine weekly winners
  async determineWeeklyWinners(week, season) {
    try {
      // Check if ALL games for the week are completed
      const allGames = await getAllQuery(`
        SELECT COUNT(*) as total_games, 
               COUNT(CASE WHEN status = 'final' THEN 1 END) as completed_games
        FROM games 
        WHERE week = ? AND season = ?
      `, [week, season]);

      const isWeekComplete = allGames[0].total_games === allGames[0].completed_games;
      
      if (!isWeekComplete) {
        console.log(`Week ${week} not complete - ${allGames[0].completed_games}/${allGames[0].total_games} games finished`);
        return; // Don't declare winners until all games are completed
      }

      console.log(`All games completed for week ${week}, determining winners...`);

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
      // Get recent weeks that are complete and might need scoring updates
      const recentWeeks = await getAllQuery(`
        SELECT DISTINCT g.week, g.season,
               COUNT(*) as total_games,
               COUNT(CASE WHEN g.status = 'final' THEN 1 END) as completed_games
        FROM games g
        WHERE g.season >= ? - 1  
        GROUP BY g.week, g.season
        HAVING completed_games = total_games AND completed_games > 0
        ORDER BY g.season DESC, g.week DESC
        LIMIT 5
      `, [new Date().getFullYear()]);

      for (const weekData of recentWeeks) {
        // Check if there are users with picks but missing scores
        const usersWithPicks = await getAllQuery(`
          SELECT DISTINCT user_id FROM picks 
          WHERE week = ? AND season = ?
        `, [weekData.week, weekData.season]);

        const usersWithScores = await getAllQuery(`
          SELECT DISTINCT user_id FROM weekly_scores 
          WHERE week = ? AND season = ?
        `, [weekData.week, weekData.season]);

        const missingScores = usersWithPicks.filter(up =>
          !usersWithScores.some(us => us.user_id === up.user_id)
        );

        if (missingScores.length > 0 || usersWithScores.length === 0) {
          console.log(`Auto-calculating scores for week ${weekData.week}/${weekData.season} - ${missingScores.length} users missing scores`);
          await this.calculateWeeklyScores(weekData.week, weekData.season);
        }
      }
    } catch (error) {
      console.error('Error in auto-calculate scores:', error);
    }
  }
}

module.exports = new ScoringService();
