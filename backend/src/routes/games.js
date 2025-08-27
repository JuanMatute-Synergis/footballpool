const express = require('express');
const router = express.Router();
const gamesController = require('../controllers/games');
const { authenticateToken } = require('../middleware/auth');

// Get current week games (requires auth)
router.get('/current', authenticateToken, gamesController.getCurrentWeekGames);

// Public live games for current week (no auth) - used for short-polling live scores
router.get('/live', gamesController.getLiveCurrentWeekGames);

// Get games for specific week (public for results page)
router.get('/:season/:week', gamesController.getWeekGames);

// Get all teams (public)
router.get('/teams', gamesController.getAllTeams);

// Get team logos (public)
router.get('/team-logos', gamesController.getTeamLogos);

// Get individual team logo by abbreviation (public)
router.get('/team-logos/:abbreviation', gamesController.getTeamLogo);

module.exports = router;
