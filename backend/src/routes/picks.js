const express = require('express');
const router = express.Router();
const picksController = require('../controllers/picks');
const { authenticateToken } = require('../middleware/auth');

// Get user's picks for a week
router.get('/', authenticateToken, picksController.getUserPicks);

// Submit a pick
router.post('/', authenticateToken, picksController.submitPick);

// Get all picks for a specific game
router.get('/game/:gameId', authenticateToken, picksController.getAllPicksForGame);

// Get picks history
router.get('/history', authenticateToken, picksController.getPicksHistory);

module.exports = router;
