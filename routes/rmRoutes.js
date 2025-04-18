const express = require('express');
const router = express.Router();
const adminController = require('../controllers/Auth');
const leadController = require('../controllers/leadController');
const { auth, isAdmin, isRm } = require('../middlewares/auth');  // Destructure to simplify

// Admin routes
router.post('/rm/signup', adminController.createRm);
router.post('/rm/login', adminController.rmLogin);  // Change GET to POST for login
router.get('/rm/all-rms', auth, isAdmin, adminController.getAllRms);  // Protect with admin check
router.get('/rm/:id', auth, isAdmin, adminController.getSingleRm);  // Protect with admin check
router.delete('/delete-rm/:id', auth, isAdmin, adminController.rmDelete);  // Protect with admin check

// Leads routes
router.get('/leads/fetch-leads', auth, isRm, leadController.fetchLeads);
router.get('/rm-leads', auth, leadController.fetchLeadsRMs);
// Route to request Under Us approval for a lead
router.post('/under-us-request', auth, leadController.requestUnderUsApproval);

module.exports = router;