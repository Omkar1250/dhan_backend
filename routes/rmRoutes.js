const express = require('express');
const router = express.Router();
const adminController = require('../controllers/Auth');
const leadController = require('../controllers/leadController');
const rmController = require('../controllers/rmController')
const upload = require('../middlewares/upload');
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

// Route to request Under Us approval for a lead
router.post('/coded-request', auth, leadController.requestCodeApproval);


//Route to request aoma

router.post(
    '/request-aoma/:leadId',
    auth,         // make sure user is logged in
    isRm,         // and make sure it's a Relationship Manager
    upload.single('screenshot'),
    leadController.requestAOMAApproval
  );

//Route to request activation
router.post(
    '/request-activation/:leadId',
    auth,
    isRm,
    upload.single('screenshot'),
    leadController.requestActivationApproval
  );

//Route to ms team activation
router.post('/request-ms-teams-activation/:leadId', 
    auth, isRm, upload.single('screenshot'), 
    leadController.requestMsTeamsLogin)


  //Route to get client list
  router.get('/get-rm-clients',auth,isAdmin, rmController.getYourClientList)
  

module.exports = router;