const express = require('express');
const router = express.Router();
const { auth, isAdmin } = require('../middlewares/auth');
const analyticsController = require('../controllers/analyticsController');

// GET analytics summary with date range
router.get('/summary', auth, isAdmin, analyticsController.getSummary);

module.exports = router;
