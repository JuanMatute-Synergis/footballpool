const express = require('express');
const router = express.Router();
const leaderboardController = require('../controllers/leaderboard');
const { authenticateToken } = require('../middleware/auth');

// Get weekly leaderboard
router.get('/weekly', authenticateToken, leaderboardController.getWeeklyLeaderboard);

// Get season leaderboard
router.get('/season', authenticateToken, leaderboardController.getSeasonLeaderboard);

// Get weekly winners
router.get('/winners', authenticateToken, leaderboardController.getWeeklyWinners);

// Get user stats
router.get('/stats', authenticateToken, leaderboardController.getUserStats);

module.exports = router;
