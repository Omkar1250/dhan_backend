const express = require('express')
const router= express.Router();
const adminAuthController = require('../controllers/Auth')
const adminController = require('../controllers/adminController')
const { auth, isAdmin, isRm } = require('../middlewares/auth');  // Destructure to simplify


//auth route
router.post('/admin/signup', adminAuthController.adminSignup)
router.get('/admin/login',adminAuthController.adminLogin )

// Route for Admin to approve or reject the Under Us request
router.post('/under-us-approval', auth, isAdmin, adminController.handleUnderUsApproval);

// Route for Admin to approve or reject the Under Us request
router.post('/code-approval/:leadId', auth, isAdmin, adminController.approveCodeRequest);


module.exports =router  