const { getAllQuery, runQuery, getQuery } = require('../models/database');

class ScoringService {
  constructor() {
    this.lastScoringRuns = new Map(); // Track last scoring runs for each week
    this.scoringErrors = []; // Track scoring errors
  }

  // Calculate scores for a completed week
  async calculateWeeklyScores(week, season) {
    const runKey = `${season}-${week}`;
    const startTime = Date.now();

    try {
      console.log(`[SCORING] Starting calculation for week ${week}, season ${season}`);

      // Get all users who made picks for this week
      const users = await getAllQuery(`
        SELECT DISTINCT user_id FROM picks WHERE week = ? AND season = ?
      `, [week, season]);

      console.log(`[SCORING] Found ${users.length} users with picks for week ${week}`);

      for (const user of users) {
        await this.calculateUserWeeklyScore(user.user_id, week, season);
      }

      // Determine weekly winners
      await this.determineWeeklyWinners(week, season);

      const duration = Date.now() - startTime;
      this.lastScoringRuns.set(runKey, { timestamp: new Date(), duration, success: true });

      console.log(`[SCORING] Completed calculation for week ${week}, season ${season} in ${duration}ms`);

      // Perform post-calculation verification
      await this.verifyScoringAccuracy(week, season);

    } catch (error) {
      const duration = Date.now() - startTime;
      this.scoringErrors.push({ week, season, error: error.message, timestamp: new Date() });
      this.lastScoringRuns.set(runKey, { timestamp: new Date(), duration, success: false, error: error.message });

      console.error(`[SCORING] Error calculating weekly scores for week ${week}:`, error);
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
      const isTie = winners.length > 1; // True if there was initially a tie requiring tiebreaker

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
          isTie ? 1 : 0, // Set to 1 if there was originally a tie requiring tiebreaker
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
      console.log(`[SCORING] Starting auto-calculate scores check`);

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

      console.log(`[SCORING] Found ${recentWeeks.length} completed weeks to check`);

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
          console.log(`[SCORING] Auto-calculating scores for week ${weekData.week}/${weekData.season} - ${missingScores.length} users missing scores`);
          await this.calculateWeeklyScores(weekData.week, weekData.season);
        } else {
          // Verify existing scores for accuracy
          const discrepancies = await this.verifyScoringAccuracy(weekData.week, weekData.season);
          if (discrepancies.length > 0) {
            console.log(`[SCORING] Found ${discrepancies.length} scoring discrepancies for week ${weekData.week}/${weekData.season}, recalculating...`);
            await this.calculateWeeklyScores(weekData.week, weekData.season);
          }
        }
      }
    } catch (error) {
      console.error('[SCORING] Error in auto-calculate scores:', error);
    }
  }

  // Verify scoring accuracy by comparing stored scores with calculated scores
  async verifyScoringAccuracy(week, season) {
    try {
      console.log(`[SCORING] Verifying accuracy for week ${week}, season ${season}`);

      const discrepancies = [];

      // Get all stored scores for this week
      const storedScores = await getAllQuery(`
        SELECT user_id, correct_picks, total_points 
        FROM weekly_scores 
        WHERE week = ? AND season = ?
      `, [week, season]);

      for (const storedScore of storedScores) {
        // Calculate what the score should be
        const actualCorrect = await this.calculateActualCorrectPicks(storedScore.user_id, week, season);

        if (actualCorrect !== storedScore.correct_picks) {
          const discrepancy = {
            userId: storedScore.user_id,
            stored: storedScore.correct_picks,
            actual: actualCorrect,
            week,
            season
          };
          discrepancies.push(discrepancy);
          console.log(`[SCORING] DISCREPANCY for user ${storedScore.user_id}: stored=${storedScore.correct_picks}, actual=${actualCorrect}`);
        }
      }

      if (discrepancies.length === 0) {
        console.log(`[SCORING] All scores verified correct for week ${week}`);
      }

      return discrepancies;
    } catch (error) {
      console.error(`[SCORING] Error verifying scoring accuracy:`, error);
      return [];
    }
  }

  // Calculate actual correct picks for a user without updating database
  async calculateActualCorrectPicks(userId, week, season) {
    try {
      const picks = await getAllQuery(`
        SELECT 
          p.selected_team_id,
          g.home_team_id,
          g.visitor_team_id,
          g.home_team_score,
          g.visitor_team_score,
          g.status
        FROM picks p
        JOIN games g ON p.game_id = g.id
        WHERE p.user_id = ? AND p.week = ? AND p.season = ?
      `, [userId, week, season]);

      let correctCount = 0;

      for (const pick of picks) {
        if (pick.status === 'final' && pick.home_team_score !== null && pick.visitor_team_score !== null) {
          const winningTeamId = pick.home_team_score > pick.visitor_team_score
            ? pick.home_team_id
            : pick.visitor_team_score > pick.home_team_score
              ? pick.visitor_team_id
              : null;

          if (winningTeamId && pick.selected_team_id === winningTeamId) {
            correctCount++;
          }
        }
      }

      return correctCount;
    } catch (error) {
      console.error(`[SCORING] Error calculating actual correct picks for user ${userId}:`, error);
      return 0;
    }
  }

  // Get scoring service health status
  async getScoringHealth() {
    try {
      const currentSeason = new Date().getFullYear();

      // Get recent scoring runs
      const recentRuns = Array.from(this.lastScoringRuns.entries())
        .map(([key, data]) => ({ week: key, ...data }))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10);

      // Get recent errors
      const recentErrors = this.scoringErrors
        .slice(-10)
        .sort((a, b) => b.timestamp - a.timestamp);

      // Check for weeks that might need scoring
      const weeksNeedingScoring = await getAllQuery(`
        SELECT DISTINCT g.week, g.season,
               COUNT(*) as total_games,
               COUNT(CASE WHEN g.status = 'final' THEN 1 END) as completed_games
        FROM games g
        LEFT JOIN weekly_scores ws ON g.week = ws.week AND g.season = ws.season
        WHERE g.season = ? 
        GROUP BY g.week, g.season
        HAVING completed_games = total_games AND completed_games > 0 AND COUNT(ws.user_id) = 0
        ORDER BY g.week DESC
      `, [currentSeason]);

      return {
        status: weeksNeedingScoring.length === 0 && recentErrors.length === 0 ? 'healthy' : 'warning',
        recentRuns,
        recentErrors,
        weeksNeedingScoring,
        lastCheckTime: new Date()
      };
    } catch (error) {
      console.error('[SCORING] Error getting scoring health:', error);
      return {
        status: 'error',
        error: error.message,
        lastCheckTime: new Date()
      };
    }
  }
}

module.exports = new ScoringService();
