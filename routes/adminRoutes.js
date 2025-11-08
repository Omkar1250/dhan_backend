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
router.get("/get-adavance-msteams-list", auth, isAdmin, adminController.fetchAdvanceMsTeamsLeadsForAdmin)
router.post("/ms-teams-details/:leadId", auth, isAdmin, adminController.msTeamsDetailsSent)

router.delete("/admin/delete-lead/:leadId", auth, adminController.adminDeleteLead)
router.delete("/delete/lead-delete-from-list/:leadId", auth, isAdmin, adminController.deleteLeadFromDeleteRequest)

//rm
router.get("/get-old-refer-leads", auth, isAdmin, adminController.getRequestedOldLeadForRefer)
router.post("/approve-old-lead/:leadId", auth, isAdmin, adminController.handleOldLeadApproval)
router.post("/advance-ms-details_sent/:leadId", auth, isAdmin, adminController.advanceMsTeamsDetailsSent)


router.get('/get-eligible-old-basic-ms-leads', auth, isAdmin, adminController.fetchBasicOldClientLeadsForMsTeams)
router.get('/get-eligible-old-advance-ms-leads', auth, isAdmin, adminController.fetchAdvanceOldClientLeadsForMsTeams)
router.post('/sent-old-basic-id-pass/:leadId', auth, isAdmin, adminController.oldBasicMsIdPassSent)
router.post('/sent-old-advance-id-pass/:leadId', auth, isAdmin, adminController.oldAdvanceMsIdPassSent)

router.get('/get-advance-ms-teams-requests', auth, isAdmin, adminController.getUsersAdvanceMSTeamsRequests)
router.post('/approve-advance-ms-teams-request/:leadId', auth, isAdmin, adminController.approveAdvanceMsTeamsLoginRequest)



//batch Routes
router.post('/batches', auth, isAdmin, adminController.createBatch)
router.get("/batches", auth, adminController.getAllBatchCodes)
router.get("/all-batches", auth, adminController.getAllBatches)
router.put("/batch/:id", auth, adminController.updateBatch)
router.delete("/batch/:id", auth, adminController.deleteBatch)

//new cliens for call routes
router.get("/new-client/pending", adminController.getPendingNewClientRequests);
router.post("/new-client/approve/:leadId", adminController.approveOrRejectNewCallRequest);

//pending basic ms teams requests
router.get("/ms-clients/pending",auth, isAdmin, adminController.getPendingBasicMsTeamsRequests);
router.post(
  "/admin/basic-ms/requests/:leadId",
auth,
  isAdmin,
  adminController.approveOrRejectBasicMsRequest
);

//pending frequest for sip converted
router.get("/sip-coverted-requests", auth, isAdmin, adminController.getPendingSipConRequests)
router.post(
  "/mf/sip-review/:leadId",
  auth,
  isAdmin,
  adminController.approveOrRejectSipStageRequest
);
// Approved SIP List + Stats + Batches
router.get("/mf/sip-approved", auth, isAdmin, adminController.getApprovedSipConRequests);
router.get("/mf/sip-approved-stats", auth, isAdmin, adminController.getSipApprovedStats);
router.get("/mf/sip-approved-batches", auth, isAdmin, adminController.getSipApprovedBatches);
router.get("/rm/dropdown",auth, isAdmin,adminAuthController.getAllMainRmDropdown)
router.get("/next-rm-preview", auth, isAdmin, adminController.peekNextMainRm);



module.exports =router