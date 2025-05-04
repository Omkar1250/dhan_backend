const express = require('express')
const router= express.Router();
const adminAuthController = require('../controllers/Auth')
const adminController = require('../controllers/adminController')
const { auth, isAdmin, isRm } = require('../middlewares/auth');  // Destructure to simplify


//auth route
router.post('/admin/signup', adminAuthController.adminSignup)
router.post('/login',adminAuthController.loginUser )

// Route for Admin to approve or reject the Under Us request
router.post('/under-us-approval', auth, isAdmin, adminController.handleUnderUsApproval);

// Route for Admin to approve or reject the Under Us request
router.post('/code-approval/:leadId', auth, isAdmin, adminController.handleCodeApproval);


//Route for admin to approve aoma req
router.post('/approve-aoma-request/:leadId', auth, isAdmin, adminController.approveAOMARequest);

//Route to approve activation request
router.post('/approve-activation/:leadId',auth, isAdmin, adminController.approveActivationRequest);

//Route to approve ms teams
router.post('/approve-ms-teams/:leadId', auth, isAdmin, adminController.approveMsTeamsLoginRequest)


//Route to approve sip request
router.post('/approve-sip-request/:leadId', auth, isAdmin, adminController.approveSipRequest);


router.get('/get-all-leads', auth, isAdmin, adminController.getAllLeadsForAdmin )


//Get usnder us requests
router.get('/get-underus-requests', auth, adminController.getUsersUnderUsRequests)
router.get('/get-code-requests', auth, adminController.getUsersCodeRequests)
router.get('/get-aoma-requests', auth, adminController.getUsersAomaRequests)
router.get('/get-activation-requests', auth, adminController.getUsersActivationRequests)
router.get('/get-ms-teams-requests', auth, adminController.getUsersMSTeamsRequests)
router.get('/get-sip-requests', auth, adminController.getUsersSIPRequests)
router.get('/get-analytics', auth, adminController.getAnalyticsSummary)
router.get('/get-all-jrm', auth, adminController.getAllJrm)

router.get("/get-conversion-points", auth, isAdmin, adminController.getConversionPoints)
router.put("/update-conversion-points", auth, isAdmin, adminController.updateConversionPoints)
router.get("/get-delete-request-list", auth, isAdmin, adminController.getDeleteRequestsList)
router.post("/lead/approve/:leadId",auth, isAdmin, adminController.approveLeadAction);

router.get("/get-list-msteams-login", auth, isAdmin, adminController.fetchMsTeamsLeadsForAdmin)
router.post("/ms-teams-details/:leadId", auth, isAdmin, adminController.msTeamsDetailsSent)




module.exports =router  