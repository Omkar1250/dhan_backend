const express = require('express');
const router = express.Router();
const adminController = require('../controllers/Auth');
const leadController = require('../controllers/leadController');
const rmController = require('../controllers/rmController')
const referLeadRmController = require("../controllers/referLead")
const upload = require('../middlewares/upload');
const { auth, isAdmin, isRm } = require('../middlewares/auth');  // Destructure to simplify

// Admin routes
router.post('/rm/signup', upload.none(),auth, isAdmin, adminController.createRm);
// router.post('/rm/login', adminController.rmLogin);  // Change GET to POST for login
router.get('/get/all-rms', auth, isAdmin, adminController.getAllRms);  // Protect with admin check
router.get('/rm/:id', auth, isAdmin, adminController.getSingleRm);  // Protect with admin check
router.delete('/delete/rm/:id', auth, isAdmin, adminController.rmDelete);  // Protect with admin check

router.put('/update/rm/:id', upload.none(), auth, isAdmin , adminController.rmUpdate)

//refer lead routes
router.post('/rm-refer-lead', auth , referLeadRmController.referFriendLead)

router.post('/rm-check-mobile-number', auth, referLeadRmController.checkMobileNumber)
router.get('/rm-refer-lead-list', auth, referLeadRmController.fetchReferLeadsRMs)


// Leads routes
router.get('/leads/fetch-leads', auth, isRm, leadController.fetchLeads);
router.get('/rm-leads',auth, leadController.fetchLeadsRMs);
// Route to request Under Us approval for a lead
router.post('/under-us-request', auth, leadController.requestUnderUsApproval);

//delete lead
router.delete('/delete-lead/:leadId', auth, leadController.deleteLead)

//delete and visible to admin
router.delete('/lead-delete/:leadId', auth, leadController.LeadDeleteToAdmin);

// Route to request Under Us approval for a lead
router.post('/coded-request', auth, leadController.requestCodeApproval);


router.get('/get-under-us-approved-leads', auth, leadController.fetchLeadsUnderUsapproved)
router.get('/get-coded-approved-leads', auth, leadController.fetchCodeApprovedLeads)
router.get('/get-aoma-approved-leads', auth, leadController.fetchAOMAApprovedLeads)
router.get('/get-activation-approved-list', auth, leadController.fetchActivationApprovedLeads )
router.get('/get-ms-teams-approved-list', auth, leadController.fetchMsTeamsApprovedLeads )
router.get('/get-sip-approved-list', auth, leadController.fetchSipApprovedLeads )

//fetch stars
router.get('/stars', auth, leadController.fetchStars)
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

    //Route to request sip
router.post('/request-sip/:leadId', auth, isRm, leadController.requestSipInterest);

  //Route to get client list
router.get('/get-rm-clients',auth,isAdmin, rmController.getYourClientList)
  



// MAIN RM 
router.post('/mainrm/signup', upload.none(),auth, isAdmin, adminController.createMainRM);

router.get('/get/all-mainrms', auth, isAdmin, adminController.getAllMainRm);  // Protect with admin check
 // Protect with admin check
router.delete('/delete/mainrm/:id', auth, isAdmin, adminController.mainRmDelete);  // Protect with admin check

router.put('/update/mainrm/:id', upload.none(), auth, isAdmin , adminController.mainRmUpdate)


router.post('/refer-old-rm', auth,  leadController.referOldLead)



router.post('/check-old-mobile-number', auth, leadController.checkOldMobileNumber)
router.get("/refer-old-lead-list", auth , leadController.referOldLeadList)

//Requet for oldClient code approval
router.post("/request-old-client-code-approval", auth, leadController.requestOldCodeApproval)
router.get("/get-basic-batch-client-list", auth, leadController.oldBasicMsTeamsClientsList)
router.get("/get-advance-batch-client-list", auth, leadController.oldAdvaceBatchMsTeamsClientsList)
router.get("/get-all-batch-client-list", auth, leadController.oldBatchMsTeamsAllClientsList)
router.get("/new-clients-for-ms-call", auth, leadController.NewMsClientsForCallList)
router.post("/basic-old-batch-call-done/:leadId", auth, leadController.basicBAtchCallDone)
router.post("/advance-old-batch-call-done/:leadId", auth, leadController.advanceBatchCallDone)
router.post("/new-client-call-done/:leadId", auth, leadController.NewClientCallDone)
router.get("/rm-basic-ms-teams-leads", auth, leadController.jrmBasicMsTeamsClients)
router.get("/rm-advance-ms-teams-leads", auth, leadController.rmAdvanceMsTeamsClients)
router.get("/rm-all-my-clients", auth, leadController.jrmLeadsAllMyClients)
router.get("/get-all-leads-for-rm", auth, leadController.getAllLeadsForRM)
router.post("/new-basic-lead-batch-call-done/:leadId", auth, leadController.newClientBasicMsCallDone)
router.post("/new-advance-lead-batch-call-done/:leadId", auth, leadController.newClientAdvanceMsCallDone)
router.get("/get-leads-for-ms-advance-approval", auth, leadController.rmLeadsForMsTeamSsapprovl)
router.post("/request-advance-ms-teams-approval/:leadId", auth, upload.single('screenshot'), leadController.requestAdvanceBatchMsTeamsLogin)

//JRM ALL CLIENTS DUMP ROUTE
router.get("/get-jrm-coded-list", auth, leadController.jrmCodedAllMyClients)

//Mf clients
router.get('/get-all-mf-clients', auth, leadController.mfClients)
router.post('/mark-mf-call-done/:leadId', auth, leadController.mFCallDone)


//new client call routes
router.post(
  "/new-client-call-update",
  auth, 
  upload.single("screenshot"),  // <-- your shared multer middleware
  leadController.submitLeadUpdateForApproval
);

//basic ms teams
router.post(
  "/submit-basic-ms-teams-update",
  auth,
  upload.single("screenshot"),
  leadController.submitBasicMsTeamsUpdate
);

router.post(
  "/submit-mf-lead-status",
  auth,
  upload.single("screenshot"),
  leadController.submitLeadSipConApproval
);








module.exports = router;