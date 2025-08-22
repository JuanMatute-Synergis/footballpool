const express = require('express');
const router = express.Router();
const gamesController = require('../controllers/games');
const { authenticateToken } = require('../middleware/auth');

// Get current week games
router.get('/current', authenticateToken, gamesController.getCurrentWeekGames);

// Get games for specific week
router.get('/:season/:week', authenticateToken, gamesController.getWeekGames);

// Get all teams
router.get('/teams', authenticateToken, gamesController.getAllTeams);

module.exports = router;
