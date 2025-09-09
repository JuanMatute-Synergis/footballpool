const { getAllQuery } = require('../models/database');
const nflApiService = require('../services/nfl-api');

const getWeeklyLeaderboard = async (req, res) => {
  try {
    const { week, season } = req.query;
    const userId = req.user?.id;
    const isAdmin = req.user?.is_admin;

    let currentWeek = week;
    let currentSeason = season;

    if (!currentWeek || !currentSeason) {
      const current = nflApiService.getCurrentWeek();
      currentWeek = current.week;
      currentSeason = current.season;
    }

    // Get total games for the week
    const totalGamesResult = await getAllQuery(`
      SELECT COUNT(*) as total_games
      FROM games 
      WHERE week = ? AND season = ?
    `, [currentWeek, currentSeason]);

    const totalGamesInWeek = totalGamesResult[0]?.total_games || 0;

    let leaderboard;

    if (isAdmin) {
      // For admins, show ALL users with their pick counts (including 0 picks)
      leaderboard = await getAllQuery(`
        SELECT 
          u.id as user_id,
          u.first_name,
          u.last_name,
          COALESCE(ws.correct_picks, 0) as correct_picks,
          COALESCE(pick_counts.picks_made, 0) as total_picks,
          COALESCE(ws.bonus_points, 0) as bonus_points,
          COALESCE(ws.total_points, 0) as total_points,
          ws.monday_night_prediction,
          ws.monday_night_actual,
          ws.monday_night_diff,
          ws.is_perfect_week,
          RANK() OVER (ORDER BY COALESCE(ws.total_points, 0) DESC, COALESCE(ws.monday_night_diff, 999) ASC) as rank
        FROM users u
        LEFT JOIN weekly_scores ws ON ws.user_id = u.id AND ws.week = ? AND ws.season = ?
        LEFT JOIN (
          SELECT user_id, COUNT(*) as picks_made
          FROM picks 
          WHERE week = ? AND season = ?
          GROUP BY user_id
        ) pick_counts ON pick_counts.user_id = u.id
        ORDER BY COALESCE(ws.total_points, 0) DESC, COALESCE(ws.monday_night_diff, 999) ASC
      `, [currentWeek, currentSeason, currentWeek, currentSeason]);
    } else {
      // For regular users, only show users who have made picks
      leaderboard = await getAllQuery(`
        SELECT 
          ws.*,
          u.first_name,
          u.last_name,
          u.id as user_id,
          COALESCE(pick_counts.picks_made, ws.total_picks) as total_picks,
          RANK() OVER (ORDER BY ws.total_points DESC, ws.monday_night_diff ASC) as rank
        FROM weekly_scores ws
        JOIN users u ON ws.user_id = u.id
        LEFT JOIN (
          SELECT user_id, COUNT(*) as picks_made
          FROM picks 
          WHERE week = ? AND season = ?
          GROUP BY user_id
        ) pick_counts ON pick_counts.user_id = ws.user_id
        WHERE ws.week = ? AND ws.season = ?
        ORDER BY ws.total_points DESC, ws.monday_night_diff ASC
      `, [currentWeek, currentSeason, currentWeek, currentSeason]);
    }

    res.json({
      week: parseInt(currentWeek),
      season: parseInt(currentSeason),
      totalGames: totalGamesInWeek,
      leaderboard: leaderboard.map(entry => ({
        rank: entry.rank,
        userId: entry.user_id,
        firstName: entry.first_name,
        lastName: entry.last_name,
        correctPicks: entry.correct_picks,
        totalPicks: entry.total_picks,
        bonusPoints: entry.bonus_points,
        totalPoints: entry.total_points,
        mondayNightPrediction: entry.monday_night_prediction,
        mondayNightActual: entry.monday_night_actual,
        mondayNightDiff: entry.monday_night_diff,
        isPerfectWeek: entry.is_perfect_week
      }))
    });
  } catch (error) {
    console.error('Error getting weekly leaderboard:', error);
    res.status(500).json({ message: 'Failed to get weekly leaderboard' });
  }
};

const getSeasonLeaderboard = async (req, res) => {
  try {
    const { season } = req.query;

    let currentSeason = season;
    if (!currentSeason) {
      currentSeason = nflApiService.getCurrentWeek().season;
    }

    const leaderboard = await getAllQuery(`
      SELECT 
        u.id as user_id,
        u.first_name,
        u.last_name,
        COUNT(ws.week) as weeks_played,
        SUM(ws.correct_picks) as total_correct_picks,
        SUM(ws.total_picks) as total_picks,
        SUM(ws.bonus_points) as total_bonus_points,
        SUM(ws.total_points) as total_points,
        AVG(ws.total_points) as avg_weekly_points,
        COUNT(CASE WHEN ws.is_perfect_week = 1 THEN 1 END) as perfect_weeks,
        RANK() OVER (ORDER BY SUM(ws.total_points) DESC) as rank
      FROM users u
      LEFT JOIN weekly_scores ws ON u.id = ws.user_id AND ws.season = ?
      GROUP BY u.id, u.first_name, u.last_name
      HAVING weeks_played > 0
      ORDER BY total_points DESC
    `, [currentSeason]);

    res.json({
      season: parseInt(currentSeason),
      leaderboard: leaderboard.map(entry => ({
        rank: entry.rank,
        userId: entry.user_id,
        firstName: entry.first_name,
        lastName: entry.last_name,
        weeksPlayed: entry.weeks_played,
        totalCorrectPicks: entry.total_correct_picks,
        totalPicks: entry.total_picks,
        totalBonusPoints: entry.total_bonus_points,
        totalPoints: entry.total_points,
        avgWeeklyPoints: parseFloat(entry.avg_weekly_points?.toFixed(2) || '0'),
        perfectWeeks: entry.perfect_weeks
      }))
    });
  } catch (error) {
    console.error('Error getting season leaderboard:', error);
    res.status(500).json({ message: 'Failed to get season leaderboard' });
  }
};

const getWeeklyWinners = async (req, res) => {
  try {
    const { limit = 10, season } = req.query;

    let query = `
      SELECT 
        ww.*,
        u.first_name,
        u.last_name
      FROM weekly_winners ww
      JOIN users u ON ww.user_id = u.id
    `;

    let params = [];

    if (season) {
      query += ` WHERE ww.season = ?`;
      params.push(parseInt(season));
    }

    query += ` ORDER BY ww.season DESC, ww.week DESC LIMIT ?`;
    params.push(parseInt(limit));

    const winners = await getAllQuery(query, params);

    res.json({
      winners: winners.map(winner => ({
        week: winner.week,
        season: winner.season,
        userId: winner.user_id,
        firstName: winner.first_name,
        lastName: winner.last_name,
        points: winner.points,
        isTie: winner.is_tie,
        tieBreakerDiff: winner.tie_breaker_diff,
        tiebreakerUsed: winner.tie_breaker_diff !== null && winner.tie_breaker_diff !== undefined
      }))
    });
  } catch (error) {
    console.error('Error getting weekly winners:', error);
    res.status(500).json({ message: 'Failed to get weekly winners' });
  }
};

const getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { season } = req.query;

    let currentSeason = season;
    if (!currentSeason) {
      currentSeason = nflApiService.getCurrentWeek().season;
    }

    // Get user's season stats
    const seasonStats = await getAllQuery(`
      SELECT 
        COUNT(ws.week) as weeks_played,
        SUM(ws.correct_picks) as total_correct_picks,
        SUM(ws.total_picks) as total_picks,
        SUM(ws.bonus_points) as total_bonus_points,
        SUM(ws.total_points) as total_points,
        AVG(ws.total_points) as avg_weekly_points,
        COUNT(CASE WHEN ws.is_perfect_week = 1 THEN 1 END) as perfect_weeks,
        MAX(ws.total_points) as best_week_points,
        MIN(ws.total_points) as worst_week_points
      FROM weekly_scores ws
      WHERE ws.user_id = ? AND ws.season = ?
    `, [userId, currentSeason]);

    // Get user's weekly winners count
    const winnersCount = await getAllQuery(`
      SELECT COUNT(*) as wins
      FROM weekly_winners ww
      WHERE ww.user_id = ? AND ww.season = ?
    `, [userId, currentSeason]);

    const stats = seasonStats[0] || {};

    res.json({
      season: parseInt(currentSeason),
      userId,
      weeksPlayed: stats.weeks_played || 0,
      totalCorrectPicks: stats.total_correct_picks || 0,
      totalPicks: stats.total_picks || 0,
      totalBonusPoints: stats.total_bonus_points || 0,
      totalPoints: stats.total_points || 0,
      avgWeeklyPoints: parseFloat(stats.avg_weekly_points?.toFixed(2) || '0'),
      perfectWeeks: stats.perfect_weeks || 0,
      bestWeekPoints: stats.best_week_points || 0,
      worstWeekPoints: stats.worst_week_points || 0,
      weeklyWins: winnersCount[0]?.wins || 0,
      accuracy: stats.total_picks > 0 ? parseFloat(((stats.total_correct_picks / stats.total_picks) * 100).toFixed(1)) : 0
    });
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({ message: 'Failed to get user stats' });
  }
};

module.exports = {
  getWeeklyLeaderboard,
  getSeasonLeaderboard,
  getWeeklyWinners,
  getUserStats
};
