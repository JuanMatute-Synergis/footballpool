const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All admin routes require authentication and admin privileges
router.use(authenticateToken, requireAdmin);

// User management
router.get('/users', adminController.getAllUsers);
router.post('/users', adminController.createUser);
router.put('/users/:userId', adminController.updateUser);
router.put('/users/:userId/role', adminController.updateUserRole);
router.put('/users/:userId/reset-password', adminController.resetUserPassword);
router.delete('/users/:userId', adminController.deleteUser);

// Picks management
router.get('/picks', adminController.getAllPicksAdmin);
router.put('/picks/:pickId', adminController.updatePick);

// Game management
router.put('/games/:gameId/scores', adminController.updateGameScores);

// API sync endpoints
router.post('/sync/teams', adminController.syncTeams);
router.post('/sync/schedule', adminController.syncSchedule);
router.post('/sync/full-season', adminController.syncFullSeason);
router.post('/sync/team-logos', adminController.syncTeamLogos);
router.post('/clear-cache', adminController.clearCache);

// Scoring management
router.post('/recalculate-scores', adminController.recalculateScores);
router.post('/auto-calculate-scores', adminController.autoCalculateAllScores);
router.get('/scoring-health', adminController.getScoringHealth);
router.get('/verify-scoring', adminController.verifyScoringAccuracy);

module.exports = router;
