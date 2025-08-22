const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Since we already have auth profile endpoint, this is just for consistency
// Additional user-related endpoints can be added here

module.exports = router;
