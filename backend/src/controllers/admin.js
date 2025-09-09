const { getAllQuery, runQuery, getQuery } = require('../models/database');
const nflApiService = require('../services/nfl-api');
const scoringService = require('../services/scoring');

const getAllUsers = async (req, res) => {
  try {
    const users = await getAllQuery(`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.is_admin,
        u.is_active,
        u.created_at,
        COUNT(ws.week) as weeks_played,
        SUM(ws.total_points) as total_points
      FROM users u
      LEFT JOIN weekly_scores ws ON u.id = ws.user_id
      GROUP BY u.id, u.email, u.first_name, u.last_name, u.is_admin, u.is_active, u.created_at
      ORDER BY u.created_at DESC
    `);

    res.json({
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        isAdmin: user.is_admin,
        isActive: user.is_active !== 0, // Convert to boolean (SQLite stores as 0/1)
        createdAt: user.created_at,
        weeksPlayed: user.weeks_played || 0,
        totalPoints: user.total_points || 0
      }))
    });
  } catch (error) {
    console.error('Error getting all users:', error);
    res.status(500).json({ message: 'Failed to get users' });
  }
};

const createUser = async (req, res) => {
  try {
    const { email, firstName, lastName, password, isAdmin } = req.body;

    if (!email || !firstName || !lastName || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await getQuery('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await runQuery(
      'INSERT INTO users (email, first_name, last_name, password_hash, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      [email, firstName, lastName, hashedPassword, isAdmin ? 1 : 0]
    );

    const user = await getQuery('SELECT id, email, first_name, last_name, is_admin, created_at FROM users WHERE id = ?', [result.lastID]);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        isAdmin: user.is_admin,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Failed to create user' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { email, firstName, lastName, isAdmin, isActive } = req.body;

    // Check if user exists
    const user = await getQuery('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Don't allow admin to remove their own admin status
    if (req.user.id === parseInt(userId) && isAdmin === false) {
      return res.status(400).json({ message: 'Cannot remove your own admin privileges' });
    }

    // Build update query dynamically based on provided fields
    let updateFields = [];
    let updateValues = [];

    if (email !== undefined) {
      // Check if email is already taken by another user
      const existingUser = await getQuery('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
      if (existingUser) {
        return res.status(409).json({ message: 'Email already taken by another user' });
      }
      updateFields.push('email = ?');
      updateValues.push(email);
    }

    if (firstName !== undefined) {
      updateFields.push('first_name = ?');
      updateValues.push(firstName);
    }

    if (lastName !== undefined) {
      updateFields.push('last_name = ?');
      updateValues.push(lastName);
    }

    if (isAdmin !== undefined) {
      updateFields.push('is_admin = ?');
      updateValues.push(isAdmin ? 1 : 0);
    }

    if (isActive !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(isActive ? 1 : 0);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(userId);

    await runQuery(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Get updated user
    const updatedUser = await getQuery('SELECT id, email, first_name, last_name, is_admin, is_active, created_at, updated_at FROM users WHERE id = ?', [userId]);

    res.json({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        isAdmin: updatedUser.is_admin,
        isActive: updatedUser.is_active,
        createdAt: updatedUser.created_at,
        updatedAt: updatedUser.updated_at
      }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isAdmin } = req.body;

    if (typeof isAdmin !== 'boolean') {
      return res.status(400).json({ message: 'isAdmin must be a boolean' });
    }

    // Check if user exists
    const user = await getQuery('SELECT id FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Don't allow admin to remove their own admin status
    if (req.user.id === parseInt(userId) && !isAdmin) {
      return res.status(400).json({ message: 'Cannot remove your own admin privileges' });
    }

    await runQuery(
      'UPDATE users SET is_admin = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [isAdmin ? 1 : 0, userId]
    );

    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ message: 'Failed to update user role' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const user = await getQuery('SELECT id FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Don't allow admin to delete themselves
    if (req.user.id === parseInt(userId)) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // Delete user's picks first (foreign key constraint)
    await runQuery('DELETE FROM picks WHERE user_id = ?', [userId]);

    // Delete user's weekly scores
    await runQuery('DELETE FROM weekly_scores WHERE user_id = ?', [userId]);

    // Delete the user
    await runQuery('DELETE FROM users WHERE id = ?', [userId]);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
};

const getAllPicksAdmin = async (req, res) => {
  try {
    const { week, season, userId } = req.query;

    let whereConditions = [];
    let params = [];

    if (week) {
      whereConditions.push('p.week = ?');
      params.push(week);
    }

    if (season) {
      whereConditions.push('p.season = ?');
      params.push(season);
    }

    if (userId) {
      whereConditions.push('p.user_id = ?');
      params.push(userId);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const picks = await getAllQuery(`
      SELECT 
        p.*,
        u.first_name,
        u.last_name,
        u.email,
        g.date as game_date,
        g.status as game_status,
        g.is_monday_night,
        ht.name as home_team_name,
        ht.abbreviation as home_team_abbreviation,
        vt.name as visitor_team_name,
        vt.abbreviation as visitor_team_abbreviation,
        st.name as selected_team_name,
        st.abbreviation as selected_team_abbreviation
      FROM picks p
      JOIN users u ON p.user_id = u.id
      JOIN games g ON p.game_id = g.id
      JOIN teams ht ON g.home_team_id = ht.id
      JOIN teams vt ON g.visitor_team_id = vt.id
      LEFT JOIN teams st ON p.selected_team_id = st.id
      ${whereClause}
      ORDER BY p.season DESC, p.week DESC, g.date ASC, u.last_name, u.first_name
    `, params);

    res.json({
      picks: picks.map(pick => ({
        id: pick.id,
        userId: pick.user_id,
        gameId: pick.game_id,
        selectedTeamId: pick.selected_team_id,
        mondayNightPrediction: pick.monday_night_prediction,
        week: pick.week,
        season: pick.season,
        createdAt: pick.created_at,
        updatedAt: pick.updated_at,
        user: {
          firstName: pick.first_name,
          lastName: pick.last_name,
          email: pick.email
        },
        game: {
          date: pick.game_date,
          status: pick.game_status,
          isMonday: pick.is_monday_night,
          homeTeam: {
            name: pick.home_team_name,
            abbreviation: pick.home_team_abbreviation
          },
          visitorTeam: {
            name: pick.visitor_team_name,
            abbreviation: pick.visitor_team_abbreviation
          }
        },
        selectedTeam: {
          name: pick.selected_team_name,
          abbreviation: pick.selected_team_abbreviation
        }
      }))
    });
  } catch (error) {
    console.error('Error getting all picks (admin):', error);
    res.status(500).json({ message: 'Failed to get picks' });
  }
};

const updatePick = async (req, res) => {
  try {
    const { pickId } = req.params;
    const { selectedTeamId, mondayNightPrediction } = req.body;

    if (!selectedTeamId) {
      return res.status(400).json({ message: 'Selected team ID is required' });
    }

    // Get the pick and game details
    const pick = await getQuery(`
      SELECT p.*, g.home_team_id, g.visitor_team_id
      FROM picks p
      JOIN games g ON p.game_id = g.id
      WHERE p.id = ?
    `, [pickId]);

    if (!pick) {
      return res.status(404).json({ message: 'Pick not found' });
    }

    // Validate selected team is playing in this game
    if (selectedTeamId !== pick.home_team_id && selectedTeamId !== pick.visitor_team_id) {
      return res.status(400).json({ message: 'Selected team is not playing in this game' });
    }

    await runQuery(
      'UPDATE picks SET selected_team_id = ?, monday_night_prediction = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [selectedTeamId, mondayNightPrediction, pickId]
    );

    res.json({ message: 'Pick updated successfully' });
  } catch (error) {
    console.error('Error updating pick (admin):', error);
    res.status(500).json({ message: 'Failed to update pick' });
  }
};

const updateGameScores = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { homeTeamScore, visitorTeamScore, status } = req.body;

    if (homeTeamScore === undefined || visitorTeamScore === undefined) {
      return res.status(400).json({ message: 'Both team scores are required' });
    }

    // Check if game exists
    const game = await getQuery('SELECT id FROM games WHERE id = ?', [gameId]);
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    await runQuery(
      'UPDATE games SET home_team_score = ?, visitor_team_score = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [homeTeamScore, visitorTeamScore, status || 'final', gameId]
    );

    res.json({ message: 'Game scores updated successfully' });
  } catch (error) {
    console.error('Error updating game scores:', error);
    res.status(500).json({ message: 'Failed to update game scores' });
  }
};

// Manual API sync functions
const syncTeams = async (req, res) => {
  try {
    console.log('Manual teams sync requested by admin');
    const teams = await nflApiService.fetchAndStoreTeams();
    res.json({
      message: 'Teams synced successfully',
      count: teams?.length || 0
    });
  } catch (error) {
    console.error('Error syncing teams:', error);
    res.status(500).json({ message: 'Failed to sync teams' });
  }
};

const syncSchedule = async (req, res) => {
  try {
    const { week, season } = req.body;
    const currentWeek = week && season ? { week, season } : nflApiService.getCurrentWeek();

    console.log(`Manual schedule sync requested for week ${currentWeek.week}, ${currentWeek.season}`);
    const games = await nflApiService.fetchWeekSchedule(currentWeek.week, currentWeek.season);

    res.json({
      message: `Schedule synced successfully for week ${currentWeek.week}, ${currentWeek.season}`,
      week: currentWeek.week,
      season: currentWeek.season,
      count: games?.length || 0
    });
  } catch (error) {
    console.error('Error syncing schedule:', error);
    res.status(500).json({ message: 'Failed to sync schedule' });
  }
};

const syncFullSeason = async (req, res) => {
  try {
    const { season } = req.body;
    const currentSeason = season || nflApiService.getCurrentWeek().season;

    console.log(`Manual full season sync requested for ${currentSeason}`);
    await nflApiService.fetchCurrentAndUpcomingSchedule();

    res.json({
      message: `Full season ${currentSeason} synced successfully`,
      season: currentSeason
    });
  } catch (error) {
    console.error('Error syncing full season:', error);
    res.status(500).json({ message: 'Failed to sync full season' });
  }
};

const clearCache = async (req, res) => {
  try {
    const { runQuery } = require('../models/database');

    console.log('Manual cache clear requested by admin');
    await runQuery('DELETE FROM api_cache');

    res.json({
      message: 'API cache cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ message: 'Failed to clear cache' });
  }
};

const syncTeamLogos = async (req, res) => {
  try {
    const teamLogoService = require('../services/team-logo.service');

    console.log('Manual team logos sync requested by admin');

    // Fetch and cache team logos from TheSportsDB
    const logoData = await teamLogoService.fetchAndCacheAllTeamLogos();

    // Note: No longer updating database URLs since we serve static files directly

    const totalLogos = Object.keys(logoData).length;
    const cachedLogos = Object.values(logoData).filter(logo => logo.logoUrl && logo.logoUrl.startsWith('/')).length;

    res.json({
      message: 'Team logos synced successfully',
      totalTeams: totalLogos,
      cachedLogos: cachedLogos,
      fallbackLogos: totalLogos - cachedLogos
    });
  } catch (error) {
    console.error('Error syncing team logos:', error);
    res.status(500).json({ message: 'Failed to sync team logos' });
  }
};

const resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    // Validate input
    if (!newPassword) {
      return res.status(400).json({ message: 'New password is required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Check if user exists
    const user = await getQuery('SELECT id, email, first_name, last_name FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Hash new password
    const bcrypt = require('bcryptjs');
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await runQuery(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [passwordHash, userId]
    );

    res.json({
      message: `Password reset successfully for ${user.first_name} ${user.last_name} (${user.email})`
    });
  } catch (error) {
    console.error('Error resetting user password:', error);
    res.status(500).json({ message: 'Failed to reset password' });
  }
};

const recalculateScores = async (req, res) => {
  try {
    const { week, season } = req.query;

    if (!week || !season) {
      return res.status(400).json({ message: 'Week and season are required' });
    }

    console.log(`Manual score recalculation requested for week ${week}, season ${season}`);

    // Recalculate scores for the specified week
    await scoringService.calculateWeeklyScores(parseInt(week), parseInt(season));

    res.json({
      message: `Scores recalculated successfully for week ${week}, season ${season}`,
      week: parseInt(week),
      season: parseInt(season)
    });
  } catch (error) {
    console.error('Error recalculating scores:', error);
    res.status(500).json({ message: 'Failed to recalculate scores' });
  }
};

const autoCalculateAllScores = async (req, res) => {
  try {
    console.log('Manual auto-calculate all scores requested');

    // Run the auto-calculate function
    await scoringService.autoCalculateScores();

    res.json({
      message: 'Auto-calculate all scores completed successfully'
    });
  } catch (error) {
    console.error('Error in auto-calculate all scores:', error);
    res.status(500).json({ message: 'Failed to auto-calculate scores' });
  }
};

module.exports = {
  getAllUsers,
  createUser,
  updateUser,
  updateUserRole,
  deleteUser,
  getAllPicksAdmin,
  updatePick,
  updateGameScores,
  syncTeams,
  syncSchedule,
  syncFullSeason,
  clearCache,
  syncTeamLogos,
  resetUserPassword,
  recalculateScores,
  autoCalculateAllScores
};
