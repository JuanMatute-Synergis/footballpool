const { runQuery, getQuery, getAllQuery } = require('../models/database');
const nflApiService = require('../services/nfl-api');

const getUserPicks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { week, season } = req.query;

    let currentWeek = week;
    let currentSeason = season;

    if (!currentWeek || !currentSeason) {
      const current = nflApiService.getCurrentWeek();
      currentWeek = current.week;
      currentSeason = current.season;
    }

    const picks = await getAllQuery(`
      SELECT 
        p.*,
        g.date as game_date,
        g.status as game_status,
        g.home_team_score,
        g.visitor_team_score,
        g.home_team_id,
        g.visitor_team_id,
        ht.name as home_team_name,
        ht.abbreviation as home_team_abbreviation,
        vt.name as visitor_team_name,
        vt.abbreviation as visitor_team_abbreviation,
        st.name as selected_team_name,
        st.abbreviation as selected_team_abbreviation
      FROM picks p
      JOIN games g ON p.game_id = g.id
      JOIN teams ht ON g.home_team_id = ht.id
      JOIN teams vt ON g.visitor_team_id = vt.id
      LEFT JOIN teams st ON p.selected_team_id = st.id
      WHERE p.user_id = ? AND p.week = ? AND p.season = ?
      ORDER BY g.date ASC
    `, [userId, currentWeek, currentSeason]);

    res.json({
      week: parseInt(currentWeek),
      season: parseInt(currentSeason),
      picks: picks.map(pick => {
        // Calculate if pick is correct
        let isCorrect = null;
        if (pick.game_status === 'final' && pick.home_team_score !== null && pick.visitor_team_score !== null) {
          // Determine winning team
          const winningTeamId = pick.home_team_score > pick.visitor_team_score
            ? pick.home_team_id
            : pick.visitor_team_score > pick.home_team_score
              ? pick.visitor_team_id
              : null; // Tie

          // Check if pick was correct (handle ties as incorrect for simplicity)
          isCorrect = winningTeamId && pick.selected_team_id === winningTeamId;
        }

        return {
          id: pick.id,
          gameId: pick.game_id,
          selectedTeamId: pick.selected_team_id,
          selectedTeamName: pick.selected_team_name,
          selectedTeamAbbreviation: pick.selected_team_abbreviation,
          mondayNightPrediction: pick.monday_night_prediction,
          gameDate: pick.game_date,
          gameStatus: pick.game_status,
          isCorrect: isCorrect,
          homeTeam: {
            name: pick.home_team_name,
            abbreviation: pick.home_team_abbreviation
          },
          visitorTeam: {
            name: pick.visitor_team_name,
            abbreviation: pick.visitor_team_abbreviation
          }
        };
      })
    });
  } catch (error) {
    console.error('Error getting user picks:', error);
    res.status(500).json({ message: 'Failed to get picks' });
  }
};

const submitPick = async (req, res) => {
  try {
    const userId = req.user.id;
    const { gameId, selectedTeamId, mondayNightPrediction, adminOverride } = req.body;

    if (!gameId || !selectedTeamId) {
      return res.status(400).json({ message: 'Game ID and selected team ID are required' });
    }

    // Get game details
    const game = await getQuery(
      'SELECT * FROM games WHERE id = ?',
      [gameId]
    );

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    // Check if game has already started (allow admin override)
    const gameDate = new Date(game.date);
    const now = new Date();
    const isAdmin = req.user.is_admin;

    if (gameDate <= now && game.status !== 'scheduled') {
      // Only allow if user is admin and explicitly using admin override
      if (!isAdmin || !adminOverride) {
        return res.status(400).json({ message: 'Cannot make picks for games that have already started' });
      }
      console.log(`[ADMIN] ${req.user.email} using admin override to modify pick for game ${gameId}`);
    }

    // Validate selected team is playing in this game
    if (selectedTeamId !== game.home_team_id && selectedTeamId !== game.visitor_team_id) {
      return res.status(400).json({ message: 'Selected team is not playing in this game' });
    }

    // Insert or update pick
    await runQuery(`
      INSERT OR REPLACE INTO picks 
      (user_id, game_id, selected_team_id, monday_night_prediction, week, season, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [userId, gameId, selectedTeamId, mondayNightPrediction, game.week, game.season]);

    res.json({ message: 'Pick submitted successfully' });
  } catch (error) {
    console.error('Error submitting pick:', error);
    res.status(500).json({ message: 'Failed to submit pick' });
  }
};

const getAllPicksForGame = async (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.is_admin;

    // Get game details
    const game = await getQuery('SELECT * FROM games WHERE id = ?', [gameId]);

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    // Check if game has started or if user is admin
    const gameDate = new Date(game.date);
    const now = new Date();
    const canSeeAllPicks = isAdmin || (gameDate <= now);

    let picks;

    if (canSeeAllPicks) {
      // Get all picks for this game
      picks = await getAllQuery(`
        SELECT 
          p.selected_team_id,
          p.monday_night_prediction,
          u.first_name,
          u.last_name,
          t.name as selected_team_name,
          t.abbreviation as selected_team_abbreviation
        FROM picks p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN teams t ON p.selected_team_id = t.id
        WHERE p.game_id = ?
        ORDER BY u.last_name, u.first_name
      `, [gameId]);
    } else {
      // Only get current user's pick
      picks = await getAllQuery(`
        SELECT 
          p.selected_team_id,
          p.monday_night_prediction,
          u.first_name,
          u.last_name,
          t.name as selected_team_name,
          t.abbreviation as selected_team_abbreviation
        FROM picks p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN teams t ON p.selected_team_id = t.id
        WHERE p.game_id = ? AND p.user_id = ?
      `, [gameId, userId]);
    }

    res.json({
      gameId: parseInt(gameId),
      canSeeAllPicks,
      picks: picks.map(pick => ({
        userFirstName: pick.first_name,
        userLastName: pick.last_name,
        selectedTeamId: pick.selected_team_id,
        selectedTeamName: pick.selected_team_name,
        selectedTeamAbbreviation: pick.selected_team_abbreviation,
        mondayNightPrediction: pick.monday_night_prediction
      }))
    });
  } catch (error) {
    console.error('Error getting picks for game:', error);
    res.status(500).json({ message: 'Failed to get picks' });
  }
};

const getPicksHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10 } = req.query;

    const history = await getAllQuery(`
      SELECT 
        ws.*,
        u.first_name,
        u.last_name
      FROM weekly_scores ws
      JOIN users u ON ws.user_id = u.id
      WHERE ws.user_id = ?
      ORDER BY ws.season DESC, ws.week DESC
      LIMIT ?
    `, [userId, parseInt(limit)]);

    res.json({
      history: history.map(record => ({
        week: record.week,
        season: record.season,
        correctPicks: record.correct_picks,
        totalPicks: record.total_picks,
        bonusPoints: record.bonus_points,
        totalPoints: record.total_points,
        mondayNightPrediction: record.monday_night_prediction,
        mondayNightActual: record.monday_night_actual,
        mondayNightDiff: record.monday_night_diff,
        isPerfectWeek: record.is_perfect_week
      }))
    });
  } catch (error) {
    console.error('Error getting picks history:', error);
    res.status(500).json({ message: 'Failed to get picks history' });
  }
};

const getSpecificUserPicks = async (req, res) => {
  try {
    const { userId } = req.params;
    const { week, season } = req.query;

    let currentWeek = week;
    let currentSeason = season;

    if (!currentWeek || !currentSeason) {
      const current = nflApiService.getCurrentWeek();
      currentWeek = current.week;
      currentSeason = current.season;
    }

    const picks = await getAllQuery(`
      SELECT 
        p.*,
        g.date as game_date,
        g.status as game_status,
        g.home_team_score,
        g.visitor_team_score,
        g.home_team_id,
        g.visitor_team_id,
        ht.name as home_team_name,
        ht.abbreviation as home_team_abbreviation,
        vt.name as visitor_team_name,
        vt.abbreviation as visitor_team_abbreviation,
        st.name as selected_team_name,
        st.abbreviation as selected_team_abbreviation
      FROM picks p
      JOIN games g ON p.game_id = g.id
      JOIN teams ht ON g.home_team_id = ht.id
      JOIN teams vt ON g.visitor_team_id = vt.id
      LEFT JOIN teams st ON p.selected_team_id = st.id
      WHERE p.user_id = ? AND p.week = ? AND p.season = ?
      ORDER BY g.date ASC
    `, [userId, currentWeek, currentSeason]);

    res.json(picks.map(pick => {
      // Calculate if pick is correct
      let isCorrect = null;
      if (pick.game_status === 'final' && pick.home_team_score !== null && pick.visitor_team_score !== null) {
        const winningTeamId = pick.home_team_score > pick.visitor_team_score
          ? pick.home_team_id
          : pick.visitor_team_score > pick.home_team_score
            ? pick.visitor_team_id
            : null;

        isCorrect = winningTeamId && pick.selected_team_id === winningTeamId;
      }

      return {
        id: pick.id,
        game_id: pick.game_id,
        selected_team_id: pick.selected_team_id,
        selected_team_name: pick.selected_team_name,
        selected_team_abbreviation: pick.selected_team_abbreviation,
        monday_night_prediction: pick.monday_night_prediction,
        game_date: pick.game_date,
        game_status: pick.game_status,
        is_correct: isCorrect,
        home_team_id: pick.home_team_id,
        visitor_team_id: pick.visitor_team_id,
        home_team_name: pick.home_team_name,
        home_team_abbreviation: pick.home_team_abbreviation,
        visitor_team_name: pick.visitor_team_name,
        visitor_team_abbreviation: pick.visitor_team_abbreviation,
        home_team_score: pick.home_team_score,
        visitor_team_score: pick.visitor_team_score
      };
    }));
  } catch (error) {
    console.error('Error getting specific user picks:', error);
    res.status(500).json({ message: 'Failed to get picks' });
  }
};

module.exports = {
  getUserPicks,
  submitPick,
  getAllPicksForGame,
  getPicksHistory,
  getSpecificUserPicks
};
