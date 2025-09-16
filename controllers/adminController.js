const { myapp, dhanDB } = require("../config/db");


exports.handleUnderUsApproval = async (req, res) => {
    try {
      const { leadId, action } = req.body;
  
      if (!leadId || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ success: false, message: 'Invalid parameters.' });
      }
  
      if (action === 'approve') {
        await dhanDB.execute(
          `UPDATE leads SET under_us_status = 'approved', under_us_approved_at = NOW() WHERE id = ?`,
          [leadId]
        );
        return res.status(200).json({ success: true, message: 'Lead approved successfully.' });
  
      } else if (action === 'reject') {
        await dhanDB.execute(
          `UPDATE leads SET under_us_status = 'rejected', under_us_approved_at = NOW() WHERE id = ?`,
          [leadId]
        );
        return res.status(200).json({ success: true, message: 'Lead rejected and deleted successfully.' });
      }
  
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  };


//code approval
exports.handleCodeApproval = async (req, res) => {
  try {
    const {leadId} = req.params
    const {  action, batch_code, rm } = req.body;

    if (!leadId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid parameters.' });
    }

    // Validate existence of the lead
    const [leadResult] = await dhanDB.execute(
      'SELECT * FROM leads WHERE id = ? AND code_request_status = "requested"',
      [leadId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found or not in requested status.' });
    }

    const lead = leadResult[0];

   if (action === 'approve') {
  if (!batch_code || batch_code.trim() === "") {
    return res.status(400).json({ success: false, message: 'Batch Code is required for approval.' });
  }

  if (!rm) {
    return res.status(400).json({ success: false, message: 'RM ID is required to assign.' });
  }

  // Get conversion points
  const [pointResult] = await myapp.execute(
    'SELECT points FROM conversion_points WHERE action = "dhan_code_approved"'
  );
  const pointsToCredit = pointResult[0]?.points || 0;

  // Credit points to RM wallet
  await myapp.execute(
    'UPDATE users SET wallet = wallet + ? WHERE id = ?',
    [pointsToCredit, lead.fetched_by]
  );

  // Log wallet transaction
  await myapp.execute(
    'INSERT INTO wallet_transactions (user_id, lead_id, action,lead_source, points) VALUES (?, ?, ?, ?,?)',
    [lead.fetched_by, lead.id, 'dhan_code_approved','dhanDB', pointsToCredit]
  );

  // ✅ Update lead status and assign RM
  await dhanDB.execute(
    `UPDATE leads 
     SET 
       code_request_status = 'approved',
       code_approved_at = NOW(),
       batch_code = ?,
       sip_request_status = 'pending',
       ms_teams_request_status = 'pending',
       advance_msteams_details_sent = 'pending',
       assigned_to = ?  
     WHERE id = ?`,
    [batch_code, rm, leadId]
  );
   

  return res.status(200).json({ success: true, message: 'Code Request approved, batch code saved, RM assigned, and points credited.' });


    } else if (action === 'reject') {
      await dhanDB.execute(
        `UPDATE leads 
         SET code_request_status = 'rejected'
         WHERE id = ?`,
        [leadId]
      );

      return res.status(200).json({ success: true, message: 'Code Request rejected successfully.' });
    }

  } catch (error) {
    console.error('Error handling Code Approval:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};




//aoma approve handler
// exports.approveAOMARequest = async (req, res) => {
//   const leadId = req.params.leadId;
//   const { action } = req.body; // 'approve' or 'reject'
//   console.log("Svtion from AOMA", action)

//   if (!['approve', 'reject'].includes(action)) {
//     return res.status(400).json({ success: false, message: 'Invalid action provided.' });
//   }

//   try {
//     // Check if lead exists and is in requested state
//     const [leadResult] = await db.execute(
//       'SELECT * FROM leads WHERE id = ? AND aoma_request_status = "requested"',
//       [leadId]
//     );

//     if (leadResult.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: 'Lead not found or not in requested status.',
//       });
//     }

//     const lead = leadResult[0];

//     if (action === 'approve') {
//       // ✅ Credit Wallet
//       const [pointResult] = await db.execute(
//         'SELECT points FROM conversion_points WHERE action = "aoma_approved"'
//       );

//       const pointsToCredit = pointResult[0]?.points || 0;

//       await db.execute(
//         'UPDATE users SET wallet = wallet + ? WHERE id = ?',
//         [pointsToCredit, lead.fetched_by]
//       );

//       await db.execute(
//         'INSERT INTO wallet_transactions (user_id, lead_id, action, points) VALUES (?, ?, ?, ?)',
//         [lead.fetched_by, lead.id, 'aoma_approved', pointsToCredit]
//       );

//       // ✅ Update lead status
//       await db.execute(
//         'UPDATE leads SET aoma_request_status = "approved", aoma_approved_at = NOW() WHERE id = ?',
//         [leadId]
//       );

//       // ✅ Check and update AOMA star
//       const [[{ count }]] = await db.execute(
//         `SELECT COUNT(*) as count FROM leads WHERE fetched_by = ? AND aoma_request_status = 'approved'`,
//         [lead.fetched_by]
//       );

//       const [[{ setting_value: threshold }]] = await db.execute(
//         `SELECT setting_value FROM config WHERE setting_key = 'aoma_star_threshold'`
//       );

//       if (threshold && count % threshold === 0) {
//         await db.execute(
//           `UPDATE users SET aoma_stars = aoma_stars + 1 WHERE id = ?`,
//           [lead.fetched_by]
//         );
//       }
//       console.log("Approved AOMA count for user:", count);
// console.log("Threshold from config:", threshold);
// console.log("Should credit star?", count % threshold === 0);


//       return res.status(200).json({
//         success: true,
//         message: 'AOMA request approved, points credited, and stars updated if eligible.',
//       });

//     } else {
//       // Reject case
//       await db.execute(
//         'UPDATE leads SET aoma_request_status = "rejected" WHERE id = ?',
//         [leadId]
//       );

//       return res.status(200).json({
//         success: true,
//         message: 'AOMA request rejected successfully.',
//       });
//     }

//   } catch (error) {
//     console.error('Error processing AOMA request:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server error while processing AOMA request.',
//     });
//   }
// };
exports.approveAOMARequest = async (req, res) => {
  const leadId = req.params.leadId;
  const { action } = req.body; // 'approve' or 'reject'
  

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ success: false, message: 'Invalid action provided.' });
  }

  try {
    // Check if lead exists and is in requested state
    const [leadResult] = await dhanDB.execute(
      'SELECT * FROM leads WHERE id = ? AND aoma_request_status = "requested"',
      [leadId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found or not in requested status.',
      });
    }

    const lead = leadResult[0];

    if (action === 'approve') {
      // ✅ Credit Wallet
      const [pointResult] = await dhanDB.execute(
        'SELECT points FROM conversion_points WHERE action = "aoma_approved"'
      );

      const pointsToCredit = pointResult[0]?.points || 0;

      await dhanDB.execute(
        'UPDATE users SET wallet = wallet + ? WHERE id = ?',
        [pointsToCredit, lead.fetched_by]
      );

      await dhanDB.execute(
        'INSERT INTO wallet_transactions (user_id, lead_id, action, points) VALUES (?, ?, ?, ?)',
        [lead.fetched_by, lead.id, 'aoma_approved', pointsToCredit]
      );

      // ✅ Update lead status
      await dhanDB.execute(
        'UPDATE leads SET aoma_request_status = "approved", aoma_approved_at = NOW() WHERE id = ?',
        [leadId]
      );

      // ✅ Check and update AOMA star
      const [[{ count }]] = await dhanDB.execute(
        `SELECT COUNT(*) as count FROM leads 
         WHERE fetched_by = ? 
           AND aoma_request_status = 'approved' 
           AND (aoma_auto_approved_by_star IS NULL OR aoma_auto_approved_by_star = FALSE)`,
        [lead.fetched_by]
      );

      const [[{ setting_value: threshold }]] = await dhanDB.execute(
        `SELECT setting_value FROM config WHERE setting_key = 'aoma_star_threshold'`
      );

      const numericThreshold = parseInt(threshold);

      if (numericThreshold && count % numericThreshold === 0) {
        await dhanDB.execute(
          `UPDATE users SET aoma_stars = aoma_stars + 1 WHERE id = ?`,
          [lead.fetched_by]
        );
      }

      return res.status(200).json({
        success: true,
        message: 'AOMA request approved, points credited, and stars updated if eligible.',
      });

    } else {
      // Reject case
      await dhanDB.execute(
        'UPDATE leads SET aoma_request_status = "rejected" WHERE id = ?',
        [leadId]
      );

      return res.status(200).json({
        success: true,
        message: 'AOMA request rejected successfully.',
      });
    }

  } catch (error) {
    console.error('Error processing AOMA request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing AOMA request.',
    });
  }
};










//Approve activation request
// Approve activation request
exports.approveActivationRequest = async (req, res) => {
  const leadId = req.params.leadId;
  const { action } = req.body; // 'approve' or 'reject'
 console.log('activation actiom', action)
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ success: false, message: 'Invalid action provided.' });
  }

  try {
    // Check if lead exists and is in requested state
    const [leadResult] = await dhanDB.execute(
      'SELECT * FROM leads WHERE id = ? AND activation_request_status = "requested"',
      [leadId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found or not in Activation requested status.',
      });
    }

    const lead = leadResult[0];

    if (action === 'approve') {
      // Get Activation Approved point value
      const [pointResult] = await dhanDB.execute(
        'SELECT points FROM conversion_points WHERE action = "activation_approved"'
      );

      if (!pointResult.length) {
        return res.status(500).json({
          success: false,
          message: 'Conversion point for Activation approval is not configured.',
        });
      }

      const pointsToCredit = pointResult[0].points;

      // Credit points to RM's wallet
      await dhanDB.execute(
        'UPDATE users SET wallet = wallet + ? WHERE id = ?',
        [pointsToCredit, lead.fetched_by]
      );

      // Log transaction
      await dhanDB.execute(
        'INSERT INTO wallet_transactions (user_id, lead_id, action, points) VALUES (?, ?, ?, ?)',
        [lead.fetched_by, lead.id, 'activation_approved', pointsToCredit]
      );

      // Update lead status to approved
      await dhanDB.execute(
        'UPDATE leads SET activation_request_status = "approved", activation_approved_at = NOW() WHERE id = ?',
        [leadId]
      );

      // ✅ Check and update Activation star
      const [[{ count }]] = await dhanDB.execute(
        `SELECT COUNT(*) as count FROM leads WHERE fetched_by = ? AND activation_request_status = 'approved'`,
        [lead.fetched_by]
      );

      const [[{ setting_value: thresholdStr }]] = await dhanDB.execute(
        `SELECT setting_value FROM config WHERE setting_key = 'activation_star_threshold'`
      );

      const threshold = parseInt(thresholdStr, 10);

      if (threshold && !isNaN(threshold) && threshold > 0 && count % threshold === 0) {
        await dhanDB.execute(
          `UPDATE users SET activation_stars = activation_stars + 1 WHERE id = ?`,
          [lead.fetched_by]
        );
      }

      // Optionally return updated wallet and star count
      const [[user]] = await dhanDB.execute(
        'SELECT wallet, activation_stars FROM users WHERE id = ?',
        [lead.fetched_by]
      );

      return res.status(200).json({
        success: true,
        message: 'Activation request approved, points credited, and stars updated if eligible.',
        wallet: user.wallet,
        activation_stars: user.activation_stars,
      });

    } else {
      // Reject case
      await dhanDB.execute(
        'UPDATE leads SET activation_request_status = "rejected" WHERE id = ?',
        [leadId]
      );

      return res.status(200).json({
        success: true,
        message: 'Activation request rejected successfully.',
      });
    }

  } catch (error) {
    console.error('Error processing Activation request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing Activation request.',
    });
  }
};



//approve ms teams request
exports.approveMsTeamsLoginRequest = async (req, res) => {
  const leadId = req.params.leadId;
  const { action } = req.body; // 'approve' or 'reject'

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ success: false, message: 'Invalid action provided.' });
  }

  try {
    // Check if lead exists and is in MS Teams requested state
    const [leadResult] = await dhanDB.execute(
      'SELECT * FROM leads WHERE id = ? AND ms_teams_request_status = "requested"',
      [leadId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found or not in MS Teams requested status.',
      });
    }

    const lead = leadResult[0];

    if (action === 'approve') {
      // Get MS Teams Approved point value
      const [pointResult] = await myapp.execute(
        'SELECT points FROM conversion_points WHERE action = "dhan_ms_teams_approved"'
      );

      if (!pointResult.length) {
        return res.status(500).json({
          success: false,
          message: 'Conversion point for MS Teams approval is not configured.',
        });
      }

      const pointsToCredit = pointResult[0].points;

      // Credit points to RM's wallet
      await myapp.execute(
        'UPDATE users SET wallet = wallet + ? WHERE id = ?',
        [pointsToCredit, lead.fetched_by]
      );

      // Log wallet transaction
      await myapp.execute(
        'INSERT INTO wallet_transactions (user_id, lead_id, action, points) VALUES (?, ?, ?, ?)',
        [lead.fetched_by, lead.id, 'dhan_ms_teams_login_approved', pointsToCredit]
      );

      // Update lead status to approved
      await dhanDB.execute(
        'UPDATE leads SET ms_teams_request_status = "approved", ms_teams_approved_at = NOW() WHERE id = ?',
        [leadId]
      );

      return res.status(200).json({
        success: true,
        message: 'MS Teams Login request approved and points credited.',
      });

    } else {
      // Reject case: just update status
      await dhanDB.execute(
        'UPDATE leads SET ms_teams_request_status = "rejected" WHERE id = ?',
        [leadId]
      );

      return res.status(200).json({
        success: true,
        message: 'MS Teams Login request rejected successfully.',
      });
    }

  } catch (error) {
    console.error('Error processing MS Teams Login request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing MS Teams Login request.',
    });
  }
};



//approve sip request
exports.approveSipRequest = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { action } = req.body;

    // Validate input parameters
    if (!leadId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid parameters. Action must be either "approve" or "reject".' });
    }

    // Fetch lead and validate its SIP request status
    const [leadResult] = await dhanDB.execute(
      'SELECT * FROM leads WHERE id = ? AND sip_request_status = "requested"',
      [leadId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found or not in requested status.' });
    }

    const lead = leadResult[0];

    if (action === 'approve') {
      // Handle SIP approval
      const [pointResult] = await dhanDB.execute(
        'SELECT points FROM conversion_points WHERE action = "sip_approved"'
      );

      const pointsToCredit = pointResult[0]?.points || 0;

    
      
        // Credit points to RM wallet
        await dhanDB.execute(
          'UPDATE users SET wallet = wallet + ? WHERE id = ?',
          [pointsToCredit, lead.fetched_by]
        );

        // Log wallet transaction
        await dhanDB.execute(
          'INSERT INTO wallet_transactions (user_id, lead_id, action, points) VALUES (?, ?, ?, ?)',
          [lead.fetched_by, lead.id, 'sip_approved', pointsToCredit]
        );

        // Update lead status
        await dhanDB.execute(
          'UPDATE leads SET sip_request_status = "approved" WHERE id = ?',
          [leadId]
        );


        return res.status(200).json({ success: true, message: 'SIP Request approved and points credited.' });
      
    } else if (action === 'reject') {
      // Handle SIP rejection
      await dhanDB.execute(
        'UPDATE leads SET sip_request_status = "rejected" WHERE id = ?',
        [leadId]
      );

      return res.status(200).json({ success: true, message: 'SIP Request rejected successfully.' });
    }
  } catch (error) {
    console.error('Error handling SIP Request:', error);
    res.status(500).json({ success: false, message: 'Server error while handling SIP Request.', error: error.message });
  }
};




exports.getUsersUnderUsRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    let baseQuery = `FROM leads`;
    let whereClause = ` WHERE under_us_status = 'pending'`;
    const queryParams = [];

    if (search) {
      whereClause += ` AND (name LIKE ? OR mobile_number LIKE ? OR id LIKE ?)`;
      const keyword = `%${search}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    // Get total count
    const [countResult] = await dhanDB.execute(
      `SELECT COUNT(*) AS total ${baseQuery}${whereClause}`,
      queryParams
    );
    const totalUnderUsRequests = countResult[0].total;
    const totalPages = Math.ceil(totalUnderUsRequests / limit);

    // Get paginated data
    const fetchQuery = `SELECT * ${baseQuery}${whereClause} ORDER BY under_us_requested_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const [underUsRequests] = await dhanDB.execute(fetchQuery, queryParams);

    if (underUsRequests.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No pending 'Under Us' requests found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Pending 'Under Us' requests fetched successfully.",
      totalUnderUsRequests,
      underUsRequests,
      totalPages,
      currentPage: page,
      perPage: limit,
    });
  } catch (error) {
    console.error("Error fetching 'Under Us' requests:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};






exports.getUsersCodeRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    let baseQuery = `FROM leads`;
    let whereClause = ` WHERE code_request_status = 'requested'`;
    const queryParams = [];

    if (search) {
      whereClause += ` AND (LOWER(name) LIKE ? OR LOWER(mobile_number) LIKE ? OR CAST(id AS CHAR) LIKE ?)`;
      const keyword = `%${search.toLowerCase()}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    // Count query
    const [countResult] = await dhanDB.execute(
      `SELECT COUNT(*) AS total ${baseQuery}${whereClause}`,
      queryParams
    );
    const totalCodedRequests = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalCodedRequests / limit);

    // Fetch query
    const fetchQuery = `SELECT * ${baseQuery}${whereClause} ORDER BY code_requested_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const [codedRequests] = await dhanDB.execute(fetchQuery, queryParams);

    if (codedRequests.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No pending Code Requests found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Pending Code Requests fetched successfully.",
      totalCodedRequests,
      codedRequests,
      totalPages,
      currentPage: page,
      perPage: limit,
    });
  } catch (error) {
    console.error("Error fetching Code Requests:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};



exports.getUsersAomaRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    let baseQuery = `FROM leads`;
    let whereClause = ` WHERE aoma_request_status = 'requested'`;
    const queryParams = [];

    if (search) {
      whereClause += ` AND (LOWER(name) LIKE ? OR LOWER(mobile_number) LIKE ? OR CAST(id AS CHAR) LIKE ?)`;
      const keyword = `%${search.toLowerCase()}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    // Count query
    const [countResult] = await dhanDB.execute(
      `SELECT COUNT(*) AS total ${baseQuery}${whereClause}`,
      queryParams
    );
    const totalAomaRequests = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalAomaRequests / limit);

    // Fetch query
    const fetchQuery = `SELECT * ${baseQuery}${whereClause} ORDER BY aoma_requested_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const [aomaRequests] = await dhanDB.execute(fetchQuery, queryParams);

    if (aomaRequests.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No pending AOMA Requests found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Pending AOMA Requests fetched successfully.",
      totalAomaRequests,
      aomaRequests,
      totalPages,
      currentPage: page,
      perPage: limit,
    });
  } catch (error) {
    console.error("Error fetching AOMA Requests:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};



exports.getUsersActivationRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    let baseQuery = `FROM leads`;
    let whereClause = ` WHERE activation_request_status = 'requested'`;
    const queryParams = [];

    if (search) {
      whereClause += ` AND (LOWER(name) LIKE ? OR LOWER(mobile_number) LIKE ? OR CAST(id AS CHAR) LIKE ?)`;
      const keyword = `%${search.toLowerCase()}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    // Count query
    const [countResult] = await dhanDB.execute(
      `SELECT COUNT(*) AS total ${baseQuery}${whereClause}`,
      queryParams
    );
    const totalActivationRequests = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalActivationRequests / limit);

    // Fetch query
    const fetchQuery = `SELECT * ${baseQuery}${whereClause} ORDER BY activation_requested_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const [activationRequests] = await dhanDB.execute(fetchQuery, queryParams);

    if (activationRequests.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No pending Activation Requests found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Pending Activation Requests fetched successfully.",
      totalActivationRequests,
      activationRequests,
      totalPages,
      currentPage: page,
      perPage: limit,
    });
  } catch (error) {
    console.error("Error fetching Activation Requests:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};




exports.getUsersMSTeamsRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    let baseQuery = `FROM leads`;
    let whereClause = ` WHERE ms_teams_request_status = 'requested'`;
    const queryParams = [];

    if (search) {
      whereClause += ` AND (LOWER(name) LIKE ? OR LOWER(mobile_number) LIKE ? OR CAST(id AS CHAR) LIKE ?)`;
      const keyword = `%${search.toLowerCase()}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    // Count query
    const [countResult] = await dhanDB.execute(
      `SELECT COUNT(*) AS total ${baseQuery}${whereClause}`,
      queryParams
    );
    const totalMsTeamsRequests = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalMsTeamsRequests / limit);

    // Fetch query
    const fetchQuery = `SELECT * ${baseQuery}${whereClause} ORDER BY ms_teams_login_requested_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const [msTeamsRequests] = await dhanDB.execute(fetchQuery, queryParams);

    if (msTeamsRequests.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No pending MS Teams requests found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Pending MS Teams requests fetched successfully.",
      totalMsTeamsRequests,
      msTeamsRequests,
      totalPages,
      currentPage: page,
      perPage: limit,
    });
  } catch (error) {
    console.error("Error fetching MS Teams requests:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


exports.getUsersSIPRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    let whereClause = `sip_request_status = 'requested'`;
    const searchParams = [];

    if (search) {
      const likeSearch = `%${search.toLowerCase()}%`;
      whereClause += ` AND (LOWER(name) LIKE ? OR LOWER(mobile_number) LIKE ? OR CAST(id AS CHAR) LIKE ?)`;
      searchParams.push(likeSearch, likeSearch, likeSearch);
    }

    // Get total count (no limit/offset here)
    const [countResult] = await dhanDB.execute(
      `SELECT COUNT(*) AS total 
       FROM leads 
       WHERE ${whereClause}`,
      searchParams
    );
    const totalSipRequests = countResult[0].total;
    const totalPages = Math.ceil(totalSipRequests / limit);

    // Pagination-specific params
    const fetchParams = [...searchParams, limit, offset];

    // Get paginated results
    const [sipRequests] = await dhanDB.execute(
      `SELECT * 
       FROM leads 
       WHERE ${whereClause} 
       ORDER BY sip_requested_at DESC 
        LIMIT ${limit} OFFSET ${offset}`,
      fetchParams
    );

    if (sipRequests.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No pending SIP requests found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Pending SIP requests fetched successfully.",
      totalSipRequests,
      sipRequests,
      totalPages,
      currentPage: page,
      perPage: limit,
    });
  } catch (error) {
    console.error("Error fetching SIP requests:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// controllers/analyticsController.js
exports.getAnalyticsSummary = async (req, res) => {
  const { startDate, endDate, jrmId } = req.query;

  try {
    const conditions = [];
    const values = [];

    // Build base WHERE clause
    if (startDate && endDate) {
      conditions.push('DATE(created_at) BETWEEN ? AND ?');
      values.push(startDate, endDate);
    }

    if (jrmId) {
      conditions.push('fetched_by = ?');
      values.push(jrmId);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Define all queries with individual clauses
    const queries = {
     fetchedLeads: `SELECT COUNT(*) AS count FROM leads ${whereClause}${whereClause ? ' AND' : 'WHERE'} fetched_by IS NOT NULL AND referred_by_rm IS NULL`,
      referredLeads: `SELECT COUNT(*) AS count FROM leads ${whereClause}${whereClause ? ' AND' : 'WHERE'} referred_by_rm IS NOT NULL`,
      underUs: `SELECT COUNT(*) AS count FROM leads ${whereClause}${whereClause ? ' AND' : 'WHERE'} under_us_status = 'approved'`,
      codeApproved: `SELECT COUNT(*) AS count FROM leads ${whereClause}${whereClause ? ' AND' : 'WHERE'} code_request_status = 'approved'`,
      aomaActivated: `SELECT COUNT(*) AS count FROM leads ${whereClause}${whereClause ? ' AND' : 'WHERE'} aoma_request_status = 'approved'`,
      activationDone: `SELECT COUNT(*) AS count FROM leads ${whereClause}${whereClause ? ' AND' : 'WHERE'} activation_request_status = 'approved'`,
      msTeamsLogin: `SELECT COUNT(*) AS count FROM leads ${whereClause}${whereClause ? ' AND' : 'WHERE'} ms_teams_request_status = 'approved'`,
      sipSetup: `SELECT COUNT(*) AS count FROM leads ${whereClause}${whereClause ? ' AND' : 'WHERE'} sip_request_status = 'approved'`,
    };

    const results = {};

    // Execute each query independently with cloned parameters
    for (const key in queries) {
      const query = queries[key];
      const [rows] = await dhanDB.execute(query, [...values]);
      results[key] = rows[0].count;
    }

    return res.json({ success: true, data: results });
  } catch (err) {
    console.error('Error fetching analytics summary:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching analytics summary',
    });
  }
};

exports.getAllJrm = async (req, res) => {
  try {
    const [rows] = await myapp.execute('SELECT id, name, personal_number, created_at FROM users WHERE role = "rm"');

    res.status(200).json({
      success: true,
      totalRms: rows.length,
      rms: rows
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get all conversion points
exports.getConversionPoints = async (req, res) => {
  try {
    const [rows] = await myapp.query("SELECT action, points FROM conversion_points");
    const result = {};
    rows.forEach(({ action, points }) => {
      result[action] = points;
    });
    res.status(200).json({
      success:true,
      data:result
    });
  } catch (error) {
    console.error("Error fetching conversion points:", error);
    res.status(500).json({ error: "Failed to fetch conversion points" });
  }
};

// Update conversion points
exports.updateConversionPoints = async (req, res) => {
  const updates = req.body; // e.g., { aoma: 15, activation: 120, ms_teams: 30 }

  if (!updates || typeof updates !== "object" || Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "Invalid input data" });
  }

  try {
    // Start a database transaction
    await myapp.query("START TRANSACTION");

    const actions = Object.entries(updates);
    for (const [action, points] of actions) {
      if (typeof points !== "number" || points < 0) {
        throw new Error(`Invalid points value for action: ${action}`);
      }
      await myapp.query("UPDATE conversion_points SET points = ? WHERE action = ?", [points, action]);
    }

    // Commit the transaction
    await myapp.query("COMMIT");

    res.status(200).json({
      success: true,
      message: "Conversion points updated successfully",
    });
  } catch (error) {
    // Rollback the transaction in case of error
    await myapp.query("ROLLBACK");
    console.error("Error updating conversion points:", error);
    res.status(500).json({ error: "Failed to update conversion points" });
  }
};

exports.getDeleteRequestsList = async (req, res) => {
  try {
    // Extract pagination and search parameters
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    // Base query and parameters
    let baseQuery = `FROM admin_delete_list`;
    let whereClause = ` WHERE mobile_number IS NOT NULL`; // Exclude NULL values in mobile_number
    let queryParams = [];

    // Add search condition
    if (search) {
      whereClause += ` AND TRIM(mobile_number) LIKE ?`;
      queryParams.push(`%${search}%`);
    }

   
    // Count query to get total matching results
    const [countResult] = await dhanDB.execute(
      `SELECT COUNT(*) AS total ${baseQuery}${whereClause}`,
      queryParams
    );
    const totalDeleteRequests = countResult[0]?.total || 0; // Total rows
    const totalPages = Math.ceil(totalDeleteRequests / limit); // Calculate total pages

    

    // Fetch query to get matching rows with pagination
    const fetchQuery = `SELECT * ${baseQuery}${whereClause} ORDER BY deleted_at DESC LIMIT ${limit} OFFSET ${offset}`;
 

    const [deleteRequests] = await dhanDB.execute(fetchQuery, queryParams);

    
    // Return the response
    return res.status(200).json({
      success: true,
      message: "Pending 'Delete' requests fetched successfully.",
      deleteRequests, // Include fetched rows
      totalDeleteRequests,
      totalPages,
      currentPage: page,
      perPage: limit,
    });
  } catch (error) {
    console.error("Error fetching 'delete' requests:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};



// exports.approveAction = async (leadId, type, action) => {
//   const now = moment().format('YYYY-MM-DD HH:mm:ss');

//   switch (type) {
//     case 'under-us':
//       if (action === 'approve') {
//         await db.query(`UPDATE leads SET under_us_status = 'approved', under_us_approved_at = ? WHERE id = ?`, [now, leadId]);
//       } else {
//         await db.query(`UPDATE leads SET under_us_status = 'rejected' WHERE id = ?`, [leadId]);
//       }
//       break;

//     case 'code':
//       if (action === 'approve') {
//         await db.query(`UPDATE leads SET code_request_status = 'approved', code_approved_at = ? WHERE id = ?`, [now, leadId]);
//       } else {
//         await db.query(`UPDATE leads SET code_request_status = 'rejected' WHERE id = ?`, [leadId]);
//       }
//       break;

//     case 'aoma':
//       if (action === 'approve') {
//         await db.query(`UPDATE leads SET aoma_request_status = 'approved', aoma_approved_at = ? WHERE id = ?`, [now, leadId]);
//       } else {
//         await db.query(`UPDATE leads SET aoma_request_status = 'rejected' WHERE id = ?`, [leadId]);
//       }
//       break;

//     case 'activation':
//       if (action === 'approve') {
//         await db.query(`UPDATE leads SET activation_request_status = 'approved', activation_approved_at = ? WHERE id = ?`, [now, leadId]);
//       } else {
//         await db.query(`UPDATE leads SET activation_request_status = 'rejected' WHERE id = ?`, [leadId]);
//       }
//       break;

//     case 'ms-teams':
//       if (action === 'approve') {
//         await db.query(`UPDATE leads SET ms_teams_request_status = 'approved', ms_teams_approved_at = ? WHERE id = ?`, [now, leadId]);
//       } else {
//         await db.query(`UPDATE leads SET ms_teams_request_status = 'rejected' WHERE id = ?`, [leadId]);
//       }
//       break;

//     case 'sip':
//       if (action === 'approve') {
//         await db.query(`UPDATE leads SET sip_request_status = 'approved', sip_approved_at = ? WHERE id = ?`, [now, leadId]);
//       } else {
//         await db.query(`UPDATE leads SET sip_request_status = 'rejected' WHERE id = ?`, [leadId]);
//       }
//       break;

//     case 'delete':
//       await db.query(`DELETE FROM leads WHERE id = ?`, [leadId]);
//       break;

//     default:
//       throw new Error('Invalid type');
//   }
// };


// exports.getAllLeadsForAdmin = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page, 10) || 1;
//     const limit = parseInt(req.query.limit, 10) || 10;
//     const offset = (page - 1) * limit;
//     const search = req.query.search || "";

//     let baseQuery = `FROM leads`;
//     let whereClause = ` WHERE 1=1`; // Always true to allow appending conditions easily
//     const queryParams = [];

//     if (search) {
//       whereClause += ` AND (LOWER(name) LIKE ? OR LOWER(mobile_number) LIKE ? OR CAST(id AS CHAR) LIKE ?)`;
//       const keyword = `%${search.toLowerCase()}%`;
//       queryParams.push(keyword, keyword, keyword);
//     }

//     // Count query to get the total number of leads
//     const [countResult] = await db.execute(
//       `SELECT COUNT(*) AS total ${baseQuery}${whereClause}`,
//       queryParams
//     );
//     const totalTrailList = countResult[0]?.total || 0;
//     const totalPages = Math.ceil(totalTrailList / limit);

//     // Fetch query to get leads with pagination
//     const fetchQuery = `SELECT id, name, mobile_number,whatsapp_mobile_number, under_us_status, code_request_status, 
//                         aoma_request_status, activation_request_status, ms_teams_request_status, sip_request_status 
//                         ${baseQuery}${whereClause} 
//                         ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
//     const [trails] = await db.execute(fetchQuery, queryParams);

//     if (trails.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "No leads found.",
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Leads fetched successfully.",
//       totalTrailList,
//       trails,
//       totalPages,
//       currentPage: page,
//       perPage: limit,
//     });
//   } catch (err) {
//     console.error("Error fetching leads:", err);
//     res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//       error: err.message,
//     });
//   }
// };

exports.getAllLeadsForAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    let baseQuery = `FROM leads LEFT JOIN myapp.users ON leads.fetched_by = users.id`;
    let whereClause = ` WHERE 1=1`;
    const queryParams = [];

    if (search) {
      whereClause += ` AND (LOWER(leads.name) LIKE ? OR LOWER(leads.mobile_number) LIKE ? OR CAST(leads.id AS CHAR) LIKE ? OR LOWER(users.name) LIKE ?)`;
      const keyword = `%${search.toLowerCase()}%`;
      queryParams.push(keyword, keyword, keyword, keyword);
    }

    // Count query
    const [countResult] = await dhanDB.execute(
      `SELECT COUNT(*) AS total ${baseQuery}${whereClause}`,
      queryParams
    );
    const totalTrailList = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalTrailList / limit);

    // Fetch query with JRM name
    const fetchQuery = `
      SELECT leads.id, leads.name, leads.mobile_number, leads.whatsapp_mobile_number,
             leads.under_us_status, leads.code_request_status, leads.aoma_request_status,
             leads.activation_request_status, leads.ms_teams_request_status, leads.sip_request_status,
             users.name AS jrm_name
      ${baseQuery}
      ${whereClause}
      ORDER BY leads.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const [trails] = await dhanDB.execute(fetchQuery, queryParams);

    if (trails.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No leads found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Leads fetched successfully.",
      totalTrailList,
      trails,
      totalPages,
      currentPage: page,
      perPage: limit,
    });
  } catch (err) {
    console.error("Error fetching leads:", err);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: err.message,
    });
  }
};



// UNIVERSAL
// exports.approveLeadAction = async (req, res) => {
//   const { leadId } = req.params;
//   const { action } = req.body;
//   const {batch_code} = req.body;

//   const validActions = {
//     under_us: { column: "under_us_status", date: "under_us_approved_at" },
//     code_request: { column: "code_request_status", date: "code_approved_at" },
//     aoma_request: { column: "aoma_request_status", date: "aoma_approved_at" },
//     activation_request: { column: "activation_request_status", date: "activation_approved_at" },
//     ms_teams_request: { column: "ms_teams_request_status", date: "ms_teams_approved_at" },
//     sip_request: { column: "sip_request_status", date: "sip_approved_at" },
//   };

//   try {
//     if (!validActions[action]) {
//       return res.status(400).json({ message: "Invalid action" });
//     }

//     const { column, date } = validActions[action];

//     // Fetch lead's current status and fetched_by
//     const [results] = await db.query(
//       `SELECT id, fetched_by, under_us_status, code_request_status, aoma_request_status, activation_request_status
//        FROM leads WHERE id = ?`,
//       [leadId]
//     );
//     const lead = results[0];

//     if (!lead) {
//       return res.status(404).json({ message: "Lead not found" });
//     }
//     // Before performing any action like approve/reject
// const [leadData] = await db.execute(
//   `SELECT deleted_by_rm FROM leads WHERE id = ?`,
//   [leadId]
// );

// if (leadData.length === 0) {
//   return res.status(404).json({ success: false, message: 'Lead not found' });
// }

// if (leadData[0].deleted_by_rm === 1) {
//   return res.status(403).json({ success: false, message: 'This lead is deleted by RM. No further actions allowed.' });
// }


//     // Strict dependency validation
//     switch (action) {
//       case "code_request":
//         if (lead.under_us_status !== "approved") {
//           return res.status(400).json({ message: "First complete Under Us request" });
//         }
//         break;
//       case "aoma_request":
//         if (lead.code_request_status !== "approved") {
//           return res.status(400).json({ message: "Please complete Code request first" });
//         }
//         break;
//       case "activation_request":
//         if (lead.aoma_request_status !== "approved") {
//           return res.status(400).json({ message: "First complete AOMA request" });
//         }
//         break;
//       case "ms_teams_request":
//       case "sip_request":
//         if (lead.code_request_status !== "approved") {
//           return res.status(400).json({ message: "Code request must be approved first" });
//         }
//         break;
//       case "under_us":
//         break;
//       default:
//         return res.status(400).json({ message: "Invalid action" });
//     }
   
//     // Code Special Handling
//     if (action === "code_request") {
//       const [pointResult] = await db.execute(
//         'SELECT points FROM conversion_points WHERE action = "code_approved"'
//       );

//       const pointsToCredit = pointResult[0]?.points || 0;

//       // Credit wallet
//       await db.execute(
//         'UPDATE users SET wallet = wallet + ? WHERE id = ?',
//         [pointsToCredit, lead.fetched_by]
//       );

//       // Log transaction
//       await db.execute(
//         'INSERT INTO wallet_transactions (user_id, lead_id, action, points) VALUES (?, ?, ?, ?)',
//         [lead.fetched_by, lead.id, 'code_approved', pointsToCredit]
//       );

//       // Update lead status
//        await db.execute(
//         `UPDATE leads 
//          SET 
//            code_request_status = 'approved',
//            code_approved_at = NOW(),
//            batch_code = ?,
//            sip_request_status = 'pending',
//            ms_teams_request_status = 'pending'
//          WHERE id = ?`,
//         [batch_code, leadId]
//       );
//       return res.status(200).json({
//         success: true,
//         message: 'Code request approved, points credited.',
//       });
//     }


//     // ⭐ AOMA SPECIAL HANDLING
//     if (action === "aoma_request") {
//       const [pointResult] = await db.execute(
//         'SELECT points FROM conversion_points WHERE action = "aoma_approved"'
//       );

//       const pointsToCredit = pointResult[0]?.points || 0;

//       // Credit wallet
//       await db.execute(
//         'UPDATE users SET wallet = wallet + ? WHERE id = ?',
//         [pointsToCredit, lead.fetched_by]
//       );

//       // Log transaction
//       await db.execute(
//         'INSERT INTO wallet_transactions (user_id, lead_id, action, points) VALUES (?, ?, ?, ?)',
//         [lead.fetched_by, lead.id, 'aoma_approved', pointsToCredit]
//       );

//       // Update lead status
//       await db.execute(
//         'UPDATE leads SET aoma_request_status = "approved", aoma_approved_at = NOW() WHERE id = ?',
//         [leadId]
//       );

//       // Check and award AOMA star
//              // ✅ Check and update AOMA star
//       const [[{ count }]] = await db.execute(
//         `SELECT COUNT(*) as count FROM leads 
//          WHERE fetched_by = ? 
//            AND aoma_request_status = 'approved' 
//            AND (aoma_auto_approved_by_star IS NULL OR aoma_auto_approved_by_star = FALSE)`,
//         [lead.fetched_by]
//       );

//       const [[{ setting_value: threshold }]] = await db.execute(
//         `SELECT setting_value FROM config WHERE setting_key = 'aoma_star_threshold'`
//       );

//       const numericThreshold = parseInt(threshold);

//       if (numericThreshold && count % numericThreshold === 0) {
//         await db.execute(
//           `UPDATE users SET aoma_stars = aoma_stars + 1 WHERE id = ?`,
//           [lead.fetched_by]
//         );
//       }

//       return res.status(200).json({
//         success: true,
//         message: 'AOMA request approved, points credited, and stars updated if eligible.',
//       });
//     }

//     // ⭐ ACTIVATION SPECIAL HANDLING
//     if (action === "activation_request") {
//       const [pointResult] = await db.execute(
//         'SELECT points FROM conversion_points WHERE action = "activation_approved"'
//       );

//       const pointsToCredit = pointResult[0]?.points || 0;

//       // Credit wallet
//       await db.execute(
//         'UPDATE users SET wallet = wallet + ? WHERE id = ?',
//         [pointsToCredit, lead.fetched_by]
//       );

//       // Log transaction
//       await db.execute(
//         'INSERT INTO wallet_transactions (user_id, lead_id, action, points) VALUES (?, ?, ?, ?)',
//         [lead.fetched_by, lead.id, 'activation_approved', pointsToCredit]
//       );

//       // Update lead status
//       await db.execute(
//         'UPDATE leads SET activation_request_status = "approved", activation_approved_at = NOW() WHERE id = ?',
//         [leadId]
//       );

//       // Check and award Activation stars
//       const [[{ count }]] = await db.execute(
//         `SELECT COUNT(*) as count FROM leads WHERE fetched_by = ? AND activation_request_status = 'approved'`,
//         [lead.fetched_by]
//       );

//       const [[{ setting_value: thresholdStr }]] = await db.execute(
//         `SELECT setting_value FROM config WHERE setting_key = 'activation_star_threshold'`
//       );

//       const threshold = parseInt(thresholdStr, 10);
//       if (threshold && !isNaN(threshold) && count % threshold === 0) {
//         await db.execute(
//           `UPDATE users SET activation_stars = activation_stars + 1 WHERE id = ?`,
//           [lead.fetched_by]
//         );
//       }

//       return res.status(200).json({
//         success: true,
//         message: 'Activation request approved, points credited, and stars updated if eligible.',
//       });
//     }

//     //Ms Teams
//     if (action === "ms_teams_request") {
//       const [pointResult] = await db.execute(
//         'SELECT points FROM conversion_points WHERE action = "ms_teams_approved"'
//       );

//       const pointsToCredit = pointResult[0]?.points || 0;

//       // Credit wallet
//       await db.execute(
//         'UPDATE users SET wallet = wallet + ? WHERE id = ?',
//         [pointsToCredit, lead.fetched_by]
//       );

//       // Log transaction
//       await db.execute(
//         'INSERT INTO wallet_transactions (user_id, lead_id, action, points) VALUES (?, ?, ?, ?)',
//         [lead.fetched_by, lead.id, 'ms_teams_approved', pointsToCredit]
//       );

//       // Update lead status
//       await db.execute(
//         'UPDATE leads SET ms_teams_request_status = "approved", ms_teams_approved_at = NOW() WHERE id = ?',
//         [leadId]
//       );
//       return res.status(200).json({
//         success: true,
//         message: 'MsTeams request approved, points credited.',
//       });
//     }

//      //SIP
//     if (action === "sip_request") {
//       const [pointResult] = await db.execute(
//         'SELECT points FROM conversion_points WHERE action = "sip_approved"'
//       );

//       const pointsToCredit = pointResult[0]?.points || 0;

//       // Credit wallet
//       await db.execute(
//         'UPDATE users SET wallet = wallet + ? WHERE id = ?',
//         [pointsToCredit, lead.fetched_by]
//       );

//       // Log transaction
//       await db.execute(
//         'INSERT INTO wallet_transactions (user_id, lead_id, action, points) VALUES (?, ?, ?, ?)',
//         [lead.fetched_by, lead.id, 'sip_approved', pointsToCredit]
//       );

//       // Update lead status
//       await db.execute(
//         'UPDATE leads SET sip_request_status = "approved", sip_approved_at = NOW() WHERE id = ?',
//         [leadId]
//       );
//       return res.status(200).json({
//         success: true,
//         message: 'Sip request approved, points credited.',
//       });
//     }


//     // ✅ GENERIC APPROVAL (for under_us, code_request, ms_teams_request, sip_request)
//     const sql = `UPDATE leads SET ${column} = 'approved', ${date} = NOW() WHERE id = ?`;
//     const [result] = await db.query(sql, [leadId]);

//     if (result.affectedRows === 0) {
//       return res.status(400).json({ message: "Failed to update lead status" });
//     }

//     res.status(200).json({ success: true, message: `${action} approved successfully` });
//   } catch (error) {
//     console.error("Approval error:", error);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// };

exports.approveLeadAction = async (req, res) => {
  const { leadId } = req.params;
  const { action } = req.body;
  const {batch_code} = req.body;
  const {rmId} =req.body;

  const validActions = {
    under_us: { column: "under_us_status", date: "under_us_approved_at" },
    code_request: { column: "code_request_status", date: "code_approved_at" },
    aoma_request: { column: "aoma_request_status", date: "aoma_approved_at" },
    activation_request: { column: "activation_request_status", date: "activation_approved_at" },
    ms_teams_request: { column: "ms_teams_request_status", date: "ms_teams_approved_at" },
    sip_request: { column: "sip_request_status", date: "sip_approved_at" },
  };

  try {
    if (!validActions[action]) {
      return res.status(400).json({ message: "Invalid action" });
    }

    const { column, date } = validActions[action];

    // Fetch lead's current status and fetched_by
    const [results] = await dhanDB.query(
      `SELECT id, fetched_by, under_us_status, code_request_status, aoma_request_status, activation_request_status FROM leads WHERE id = ?`,
      [leadId]
    );
    const lead = results[0];

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Check if lead is deleted by RM
    const [leadData] = await dhanDB.execute(`SELECT deleted_by_rm FROM leads WHERE id = ?`, [leadId]);
    if (leadData.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    if (leadData[0].deleted_by_rm === 1) {
      return res.status(403).json({ success: false, message: 'This lead is deleted by RM. No further actions allowed.' });
    }

    // Strict dependency validation
    switch (action) {
      case "code_request":
        if (lead.under_us_status !== "approved") {
          return res.status(400).json({ message: "First complete Under Us request" });
        }
        break;
      case "aoma_request":
        if (lead.code_request_status !== "approved") {
          return res.status(400).json({ message: "Please complete Code request first" });
        }
        break;
      case "activation_request":
        if (lead.aoma_request_status !== "approved") {
          return res.status(400).json({ message: "First complete AOMA request" });
        }
        break;
      case "ms_teams_request":
      case "sip_request":
        if (lead.code_request_status !== "approved") {
          return res.status(400).json({ message: "Code request must be approved first" });
        }
        break;
      case "under_us":
        break;
      default:
        return res.status(400).json({ message: "Invalid action" });
    }

    // ✅ Code Request Approval
    if (action === "code_request") {
      const [pointResult] = await myapp.execute(`SELECT points FROM conversion_points WHERE action = "dhan_code_approved"`);
      const pointsToCredit = pointResult[0]?.points || 0;

      await myapp.execute(`UPDATE users SET wallet = wallet + ? WHERE id = ?`, [pointsToCredit, lead.fetched_by]);
      await myapp.execute(
        `INSERT INTO wallet_transactions (user_id, lead_id, action, points) VALUES (?, ?, ?, ?)`,
        [lead.fetched_by, lead.id, 'dhan_code_approved', pointsToCredit]
      );

      await dhanDB.execute(
        `UPDATE leads SET code_request_status = 'approved', code_approved_at = NOW(), batch_code = ?,assigned_to = ?, sip_request_status = 'pending', ms_teams_request_status = 'pending', advance_msteams_details_sent='pending' WHERE id = ?`,
        [batch_code,rmId, leadId]
      );

      return res.status(200).json({ success: true, message: 'Code request approved, points credited.' });
    }

    // ✅ AOMA Request Approval
    if (action === "aoma_request") {
      const [pointResult] = await db.execute(`SELECT points FROM conversion_points WHERE action = "aoma_approved"`);
      const pointsToCredit = pointResult[0]?.points || 0;

      await dhanDB.execute(`UPDATE users SET wallet = wallet + ? WHERE id = ?`, [pointsToCredit, lead.fetched_by]);
      await dhanDB.execute(
        `INSERT INTO wallet_transactions (user_id, lead_id, action, points) VALUES (?, ?, ?, ?)`,
        [lead.fetched_by, lead.id, 'aoma_approved', pointsToCredit]
      );

      await dhanDB.execute(`UPDATE leads SET aoma_request_status = 'approved', aoma_approved_at = NOW() WHERE id = ?`, [leadId]);

      // ⭐ Check AOMA star eligibility
      const [[{ count }]] = await dhanDB.execute(
        `SELECT COUNT(*) as count FROM leads WHERE fetched_by = ? AND aoma_request_status = 'approved' AND (aoma_auto_approved_by_star IS NULL OR aoma_auto_approved_by_star = FALSE)`,
        [lead.fetched_by]
      );
      const [[{ setting_value: threshold }]] = await dhanDB.execute(
        `SELECT setting_value FROM config WHERE setting_key = 'aoma_star_threshold'`
      );

      const numericThreshold = parseInt(threshold);
      if (numericThreshold && count % numericThreshold === 0) {
        await dhanDB.execute(`UPDATE users SET aoma_stars = aoma_stars + 1 WHERE id = ?`, [lead.fetched_by]);
      }

      return res.status(200).json({ success: true, message: 'AOMA request approved, points credited, and stars updated if eligible.' });
    }

    // ✅ Activation Request Approval
    if (action === "activation_request") {
      const [pointResult] = await dhanDB.execute(`SELECT points FROM conversion_points WHERE action = "activation_approved"`);
      const pointsToCredit = pointResult[0]?.points || 0;

      await dhanDB.execute(`UPDATE users SET wallet = wallet + ? WHERE id = ?`, [pointsToCredit, lead.fetched_by]);
      await dhanDB.execute(
        `INSERT INTO wallet_transactions (user_id, lead_id, action, points) VALUES (?, ?, ?, ?)`,
        [lead.fetched_by, lead.id, 'activation_approved', pointsToCredit]
      );

      await dhanDB.execute(`UPDATE leads SET activation_request_status = 'approved', activation_approved_at = NOW() WHERE id = ?`, [leadId]);

      // ⭐ Check Activation star eligibility
      const [[{ count }]] = await db.execute(
        `SELECT COUNT(*) as count FROM leads WHERE fetched_by = ? AND activation_request_status = 'approved'`,
        [lead.fetched_by]
      );
      const [[{ setting_value: thresholdStr }]] = await dhanDB.execute(
        `SELECT setting_value FROM config WHERE setting_key = 'activation_star_threshold'`
      );
      const threshold = parseInt(thresholdStr, 10);
      if (threshold && count % threshold === 0) {
        await dhanDB.execute(`UPDATE users SET activation_stars = activation_stars + 1 WHERE id = ?`, [lead.fetched_by]);
      }

      return res.status(200).json({ success: true, message: 'Activation request approved, points credited, and stars updated if eligible.' });
    }

    // ✅ MS Teams Approval
    if (action === "ms_teams_request") {
      const [pointResult] = await myapp.execute(`SELECT points FROM conversion_points WHERE action = "dhan_ms_teams_approved"`);
      const pointsToCredit = pointResult[0]?.points || 0;

      await myapp.execute(`UPDATE users SET wallet = wallet + ? WHERE id = ?`, [pointsToCredit, lead.fetched_by]);
      await myapp.execute(
        `INSERT INTO wallet_transactions (user_id, lead_id, action, lead_source, points) VALUES (?, ?, ?,?, ?)`,
        [lead.fetched_by, lead.id, 'dhan_ms_teams_approved','dhanDB', pointsToCredit]
      );

      await dhanDB.execute(`UPDATE leads SET ms_teams_request_status = 'approved', ms_teams_approved_at = NOW() WHERE id = ?`, [leadId]);

      return res.status(200).json({ success: true, message: 'MS Teams request approved, points credited.' });
    }

    // ✅ SIP Approval
    if (action === "sip_request") {
      const [pointResult] = await dhanDB.execute(`SELECT points FROM conversion_points WHERE action = "sip_approved"`);
      const pointsToCredit = pointResult[0]?.points || 0;

      await dhanDB.execute(`UPDATE users SET wallet = wallet + ? WHERE id = ?`, [pointsToCredit, lead.fetched_by]);
      await dhanDB.execute(
        `INSERT INTO wallet_transactions (user_id, lead_id, action, points) VALUES (?, ?, ?, ?)`,
        [lead.fetched_by, lead.id, 'sip_approved', pointsToCredit]
      );

      await dhanDB.execute(`UPDATE leads SET sip_request_status = 'approved', sip_approved_at = NOW() WHERE id = ?`, [leadId]);

      return res.status(200).json({ success: true, message: 'SIP request approved, points credited.' });
    }

    // ✅ Generic Approval (fallback)
    const [result] = await dhanDB.query(
      `UPDATE leads SET ${column} = 'approved', ${date} = NOW() WHERE id = ?`,
      [leadId]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: "Failed to update lead status" });
    }

    return res.status(200).json({ success: true, message: `${action} approved successfully` });
  } catch (error) {
    console.error("Approval error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


//Admin Basic Ms id pass
exports.fetchMsTeamsLeadsForAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    // Build WHERE clause and queryParams array
    let whereClause = `WHERE code_request_status = 'approved' AND ms_details_sent ='pending'`;
    const queryParams = [];

    if (search) {
      whereClause += ` AND (LOWER(name) LIKE ? OR LOWER(mobile_number) LIKE ? OR LOWER(whatsapp_mobile_number) LIKE ?)`;
      const keyword = `%${search.toLowerCase()}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    // Count total matching records
    const [countResult] = await dhanDB.execute(
      `SELECT COUNT(*) AS total FROM leads ${whereClause}`,
      queryParams
    );
    const totalMsLeads = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalMsLeads / limit);

    // Fetch paginated results
    const fetchQuery = `
      SELECT id, name, mobile_number, whatsapp_mobile_number, batch_code,
             created_at, code_approved_at
      FROM leads
      ${whereClause}
      ORDER BY code_approved_at ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [msLeads] = await dhanDB.execute(fetchQuery, queryParams);

    if (msLeads.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No leads found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "MS Teams leads fetched successfully.",
      totalMsLeads,
      msLeads,
      totalPages,
      currentPage: page,
      perPage: limit,
    });
  } catch (err) {
    console.error("Error fetching MS Teams leads for admin:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: err.message,
    });
  }
};

// exports.fetchMsTeamsLeadsForAdmin = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page, 10) || 1;
//     const limit = parseInt(req.query.limit, 10) || 10;
//     const offset = (page - 1) * limit;
//     const search = req.query.search || "";

//     // Prepare search clause and parameters separately
//     let leadsSearchClause = "";
//     let advanceSearchClause = "";
//     const queryParams = [];

//     if (search) {
//       leadsSearchClause = ` AND (LOWER(name) LIKE ? OR LOWER(mobile_number) LIKE ? OR LOWER(whatsapp_mobile_number) LIKE ?)`;
//       advanceSearchClause = ` AND (LOWER(account_opening_name) LIKE ? OR LOWER(mobile_number) LIKE ? OR LOWER(whatsapp_number) LIKE ?)`;

//       const keyword = `%${search.toLowerCase()}%`;
//       queryParams.push(keyword, keyword, keyword, keyword, keyword, keyword);
//     }

//     // Count total
//     const countQuery = `
//       SELECT COUNT(*) AS total FROM (
//         SELECT id FROM leads
//         WHERE code_request_status = 'approved' AND ms_details_sent = 'pending' ${leadsSearchClause}
//         UNION ALL
//         SELECT id FROM advance_batch
//         WHERE old_code_request_status = 'approved' AND old_basic_ms_clients_msdetails = 'pending' ${advanceSearchClause}
//       ) AS combined
//     `;
//     const [countResult] = await db.execute(countQuery, queryParams);
//     const totalMsLeads = countResult[0]?.total || 0;
//     const totalPages = Math.ceil(totalMsLeads / limit);

//     // Fetch records
//     const fetchQuery = `
//       SELECT id, name, mobile_number, whatsapp_mobile_number, batch_code,
//              NULL AS batch_type, NULL AS client_code,
//              created_at, code_approved_at, 'new' AS source
//       FROM leads
//       WHERE code_request_status = 'approved' AND ms_details_sent = 'pending' ${leadsSearchClause}

//       UNION ALL

//       SELECT id, account_opening_name AS name, mobile_number, whatsapp_number AS whatsapp_mobile_number,
//              batch_code, batch_type, client_code,
//              referred_at AS created_at, old_code_approved_at AS code_approved_at, 'old' AS source
//       FROM advance_batch
//       WHERE old_code_request_status = 'approved' AND old_basic_ms_clients_msdetails = 'pending' ${advanceSearchClause}

//       ORDER BY code_approved_at ASC
//       LIMIT ${limit} OFFSET ${offset}
//     `;
//     const [msLeads] = await db.execute(fetchQuery, queryParams);

//     if (msLeads.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "No leads found.",
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       message: "MS Teams leads fetched successfully.",
//       totalMsLeads,
//       msLeads,
//       totalPages,
//       currentPage: page,
//       perPage: limit,
//     });
//   } catch (err) {
//     console.error("Error fetching MS Teams leads for admin:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//       error: err.message,
//     });
//   }
// };



exports.msTeamsDetailsSent = async( req, res) => {
  try {
    const { leadId } = req.params;
    const { action } = req.body;

    // Validate input parameters
    if (!leadId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid parameters. Action must be either "approve" or "reject".' });
    }


    const [leadResult] = await dhanDB.execute(
      'SELECT * FROM leads WHERE id = ? AND code_request_status  = "approved"',
      [leadId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found or not code approved.' });
    }

    const lead = leadResult[0];

    if (action === 'approve') {
        // Update lead status
        await dhanDB.execute(
          'UPDATE leads SET ms_details_sent  = "approved", basic_ms_teams_details_send_at = NOW() WHERE id = ?',
          [leadId]
        );


        return res.status(200).json({ success: true, message: 'Ms Teams Details sent.' });
      
    } else if (action === 'reject') {
  
      await dhanDB.execute(
        'UPDATE leads SET ms_details_sent = "rejected" WHERE id = ?',
        [leadId]
      );

      return res.status(200).json({ success: true, message: 'Not sent' });
    }
  } catch (error) {
    console.error('Error handling Request:', error);
    res.status(500).json({ success: false, message: 'Server error while sending request.', error: error.message });
  }
};

exports.adminDeleteLead = async (req, res) => {
  const { leadId } = req.params;

  if (!leadId) {
    return res.status(400).json({
      success: false,
      message: "Lead ID is required."
    });
  }

  try {
    // Check if the lead exists and get its code approval status
    const [check] = await dhanDB.execute(`
      SELECT id, code_request_status FROM leads WHERE id = ?
    `, [leadId]);

    if (check.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Lead not found."
      });
    }

    const lead = check[0];

    // Block deletion if Code is approved
    if (lead.code_request_status === 'approved') {
      return res.status(403).json({
        success: false,
        message: "Cannot delete lead. Code is already approved."
      });
    }

    // Proceed with deletion
    await dhanDB.execute(`DELETE FROM leads WHERE id = ?`, [leadId]);

    return res.status(200).json({
      success: true,
      message: "Lead permanently deleted by admin."
    });
  } catch (error) {
    console.error("Admin delete error:", error);
    return res.status(500).json({
      success: false,
      message: "Lead is available in Delete Request list First delete from there",
      error: error.message
    });
  }
};


exports.deleteLeadFromDeleteRequest = async (req, res) => {
  const { leadId } = req.params;

  if (!leadId) {
    return res.status(400).json({
      success: false,
      message: "Lead ID is required."
    });
  }

  try {
    // Check if the lead exists in admin_delete_list
    const [check] = await dhanDB.execute(`
      SELECT lead_id FROM admin_delete_list WHERE lead_id = ?
    `, [leadId]);

    if (check.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Lead not found in delete request list."
      });
    }

    // Check if the lead still exists in leads table
    const [check1] = await dhanDB.execute(`
      SELECT id FROM leads WHERE id = ?
    `, [leadId]);

    if (check1.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Lead already deleted from main list."
      });
    }

    // First delete from admin_delete_list to avoid FK error
    await dhanDB.execute(`DELETE FROM admin_delete_list WHERE lead_id = ?`, [leadId]);

    // Then delete from leads
    await dhanDB.execute(`DELETE FROM leads WHERE id = ?`, [leadId]);

    return res.status(200).json({
      success: true,
      message: "Lead permanently deleted by admin."
    });
  } catch (error) {
    console.error("Admin delete error:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.fetchAdvanceMsTeamsLeadsForAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    // Build WHERE clause and queryParams array
    let whereClause = `WHERE code_request_status = 'approved' AND advance_msteams_details_sent ='pending'`;
    const queryParams = [];

    if (search) {
      whereClause += ` AND (LOWER(name) LIKE ? OR LOWER(mobile_number) LIKE ? OR LOWER(whatsapp_mobile_number) LIKE ?)`;
      const keyword = `%${search.toLowerCase()}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    // Count total matching records
    const [countResult] = await dhanDB.execute(
      `SELECT COUNT(*) AS total FROM leads ${whereClause}`,
      queryParams
    );
    const totalAdvanceMsLeads = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalAdvanceMsLeads / limit);

    // Fetch paginated results
    const fetchQuery = `
      SELECT id, name, mobile_number, whatsapp_mobile_number, batch_code,
             created_at, code_approved_at
      FROM leads
      ${whereClause}
      ORDER BY code_approved_at ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [advanceMsLeads] = await dhanDB.execute(fetchQuery, queryParams);

    if (advanceMsLeads.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No leads found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "MS Teams leads fetched successfully.",
      totalAdvanceMsLeads,
      advanceMsLeads,
      totalPages,
      currentPage: page,
      perPage: limit,
    });
  } catch (err) {
    console.error("Error fetching MS Teams leads for admin:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: err.message,
    });
  }
};



// RM 
exports.getRequestedOldLeadForRefer = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    // Base query setup
    let baseQuery = `FROM advance_batch`;
    let whereClause = ` WHERE  old_code_request_status = 'requested'`;
    
    const queryParams = [];

    // Add search filters if provided
    if (search) {
      whereClause += ` AND (
        LOWER(account_opening_name) LIKE ? OR 
        LOWER(mobile_number) LIKE ? OR 
        CAST(id AS CHAR) LIKE ?
      )`;
      const keyword = `%${search.toLowerCase()}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    // Count total
    const [countResult] = await dhanDB.execute(
      `SELECT COUNT(*) AS total ${baseQuery} ${whereClause}`,
      queryParams
    );
    const totalAdvanceCodedRequests = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalAdvanceCodedRequests / limit);

    // Fetch paginated results
    const fetchQuery = `
      SELECT * ${baseQuery} ${whereClause}
      ORDER BY referred_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const [advanceCodedRequests] = await dhanDB.execute(fetchQuery, queryParams);

    if (advanceCodedRequests.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No pending Refer Requests found.",
      });
    }

    // Success response
    return res.status(200).json({
      success: true,
      message: "Pending Refer Requests fetched successfully.",
      totalAdvanceCodedRequests,
      advanceCodedRequests,
      totalPages,
      currentPage: page,
      perPage: limit,
    });

  } catch (error) {
    console.error("Error fetching Refer Requests:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};



// exports.handleOldLeadApproval = async (req, res) => {
//   try {
//     const { leadId } = req.params;
//     const { action } = req.body;
//     console.log("LEad id", leadId)

//     if (!leadId || !['approve', 'reject'].includes(action)) {
//       return res.status(400).json({ success: false, message: 'Invalid parameters.' });
//     }

//     const [leadResult] = await db.execute(
//       'SELECT * FROM advance_batch WHERE id = ? AND old_client_refer_status = "referred" AND old_code_request_status="requested"',
//       [leadId]
//     );

//     if (leadResult.length === 0) {
//       return res.status(404).json({ success: false, message: 'Lead not found or not in requested status.' });
//     }

//     if (action === 'approve') {
//       await db.execute(
//         `UPDATE advance_batch 
//          SET old_client_refer_status = 'approved',
//              old_code_request_status = 'approved',
//              old_code_approved_at = NOW(),
//              referred_approved_at = NOW()
//          WHERE id = ?`,
//         [leadId]
//       );

//       return res.status(200).json({ success: true, message: 'Old Client Reference approved successfully.' });

//     } else if (action === 'reject') {
//       await db.execute(
//         `UPDATE advance_batch 
//          SET old_code_request_status = 'rejected'
//          WHERE id = ?`,
//         [leadId]
//       );

//       return res.status(200).json({ success: true, message: 'Old Client Reference rejected successfully.' });
//     }

//   } catch (error) {
//     console.error('Error handling Old Lead Approval:', error);
//     res.status(500).json({ success: false, message: 'Server error', error: error.message });
//   }
// };
//handle old lead approval
exports.handleOldLeadApproval = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { action, batch_code } = req.body;

    if (!leadId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid parameters.' });
    }
 
    // Validate existence of the lead
    const [leadResult] = await dhanDB.execute(
      'SELECT * FROM advance_batch WHERE id = ? AND old_code_request_status = "requested"',
      [leadId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found or not in requested status.' });
    }

    const lead = leadResult[0];

    if (action === 'approve') {
      if (!batch_code || batch_code.trim() === "") {
        return res.status(400).json({ success: false, message: 'Batch Code is required for approval.' });
      }

      await dhanDB.execute(
        `UPDATE advance_batch 
         SET 
            old_code_request_status = 'approved',
            old_code_approved_at = NOW(),
            batch_code = ?,
            basic_ms_teams_status = 'pending',
            advance_ms_teams_status = 'pending',
            old_basic_ms_clients_msdetails = 'pending',
            advance_ms_clients_msdetails='pending'
         WHERE id = ?`,
        [batch_code, leadId]
      );

      return res.status(200).json({ success: true, message: 'Code Request approved, batch code saved, RM assigned, and points credited.' });

    } else if (action === 'reject') {
      await dhanDB.execute(
        `UPDATE advance_batch 
         SET old_code_request_status = 'rejected'
         WHERE id = ?`,
        [leadId]
      );

      return res.status(200).json({ success: true, message: 'Code Request rejected successfully.' });
    }

  } catch (error) {
    console.error('Error handling Code Approval:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};




exports.advanceMsTeamsDetailsSent = async( req, res) => {
  try {
    const { leadId } = req.params;
    const { action } = req.body;

    // Validate input parameters
    if (!leadId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid parameters. Action must be either "approve" or "reject".' });
    }


    const [leadResult] = await dhanDB.execute(
      'SELECT * FROM leads WHERE id = ? AND code_request_status  = "approved"',
      [leadId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found or not code approved.' });
    }

    const lead = leadResult[0];

    if (action === 'approve') {
        // Update lead status
        await dhanDB.execute(
          'UPDATE leads SET  advance_msteams_details_sent  = "approved",  advance_ms_teams_details_send_at  = NOW() WHERE id = ?',
          [leadId]
        );


        return res.status(200).json({ success: true, message: 'Ms Teams Details sent.' });
      
    } else if (action === 'reject') {
  
      await dhanDB.execute(
        'UPDATE leads SET  advance_msteams_details_sent = "rejected" WHERE id = ?',
        [leadId]
      );

      return res.status(200).json({ success: true, message: 'Not sent' });
    }
  } catch (error) {
    console.error('Error handling Request:', error);
    res.status(500).json({ success: false, message: 'Server error while sending request.', error: error.message });
  }
};


//Handle Old Basic Ms Team Id
exports.oldBasicMsIdPassSent = async( req, res) => {
  try {
    const { leadId } = req.params;
    const { action } = req.body;

    // Validate input parameters
    if (!leadId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid parameters. Action must be either "approve" or "reject".' });
    }


    const [leadResult] = await dhanDB.execute(
      'SELECT * FROM advance_batch WHERE id = ? AND old_code_request_status  = "approved"',
      [leadId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found or not code approved.' });
    }

    const lead = leadResult[0];

    if (action === 'approve') {
        // Update lead status
        await dhanDB.execute(
          'UPDATE advance_batch SET  old_basic_ms_clients_msdetails  = "approved", basic_ms_idpass_sent_at  = NOW() WHERE id = ?',
          [leadId]
        );


        return res.status(200).json({ success: true, message: 'Ms Teams Details sent.' });
      
    } else if (action === 'reject') {
  
      await dhanDB.execute(
        'UPDATE advance_batch SET  old_basic_ms_clients_msdetails = "rejected" WHERE id = ?',
        [leadId]
      );

      return res.status(200).json({ success: true, message: 'Not sent' });
    }
  } catch (error) {
    console.error('Error handling Request:', error);
    res.status(500).json({ success: false, message: 'Server error while sending request.', error: error.message });
  }
};

//Handle Old Advance Ms Details sent
exports.oldAdvanceMsIdPassSent = async( req, res) => {
  try {
    const { leadId } = req.params;
    const { action } = req.body;

    // Validate input parameters
    if (!leadId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid parameters. Action must be either "approve" or "reject".' });
    }


    const [leadResult] = await dhanDB.execute(
      'SELECT * FROM advance_batch WHERE id = ? AND old_code_request_status  = "approved"',
      [leadId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found or not code approved.' });
    }

    const lead = leadResult[0];

    if (action === 'approve') {
        // Update lead status
        await dhanDB.execute(
          'UPDATE advance_batch SET  advance_ms_clients_msdetails  = "approved", advance_ms_idpass_sent_at  = NOW() WHERE id = ?',
          [leadId]
        );


        return res.status(200).json({ success: true, message: 'Ms Teams Details sent.' });
      
    } else if (action === 'reject') {
  
      await dhanDB.execute(
        'UPDATE advance_batch SET  advance_ms_clients_msdetails = "rejected" WHERE id = ?',
        [leadId]
      );

      return res.status(200).json({ success: true, message: 'Not sent' });
    }
  } catch (error) {
    console.error('Error handling Request:', error);
    res.status(500).json({ success: false, message: 'Server error while sending request.', error: error.message });
  }
};




//Fetch Old Basic Code Apprrove leads For ms Teams
exports.fetchBasicOldClientLeadsForMsTeams = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    // Updated WHERE clause to include batch_type = 'basic'
    let whereClause = `
      WHERE old_code_request_status = 'approved'
      AND old_basic_ms_clients_msdetails = 'pending'
      AND (batch_type = 'basic' OR batch_type = 'both')
     
    `;
    const queryParams = [];

    if (search) {
      whereClause += `
        AND (
          LOWER(account_opening_name) LIKE ?
          OR LOWER(mobile_number) LIKE ?
          OR LOWER(whatsapp_number) LIKE ?
        )
      `;
      const keyword = `%${search.toLowerCase()}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    // Count total matching records
    const [countResult] = await dhanDB.execute(
      `SELECT COUNT(*) AS total FROM advance_batch ${whereClause}`,
      queryParams
    );
    const totalOldBasicMsLeads = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalOldBasicMsLeads / limit);

    // Fetch paginated results
    const fetchQuery = `
      SELECT id, account_opening_name, mobile_number, whatsapp_number,
             batch_code, batch_type, old_code_approved_at
      FROM advance_batch
      ${whereClause}
      ORDER BY old_code_approved_at ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const [oldBasicMsLeads] = await dhanDB.execute(fetchQuery, queryParams);

    if (oldBasicMsLeads.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No leads found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Basic MS Teams leads fetched successfully.",
      totalOldBasicMsLeads,
      oldBasicMsLeads,
      totalPages,
      currentPage: page,
      perPage: limit,
    });

  } catch (err) {
    console.error("Error fetching MS Teams leads for admin:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: err.message,
    });
  }
};


//Fetch Old Advance Code Apprrove leads For ms Teams
exports.fetchAdvanceOldClientLeadsForMsTeams = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    // Updated WHERE clause to include batch_type = 'basic'
   let whereClause = `
  WHERE old_code_request_status = 'approved'
  AND advance_ms_clients_msdetails = 'pending'
  AND (batch_type = 'advance' OR batch_type = 'both')
`;

    const queryParams = [];

    if (search) {
      whereClause += `
        AND (
          LOWER(account_opening_name) LIKE ?
          OR LOWER(mobile_number) LIKE ?
          OR LOWER(whatsapp_number) LIKE ?
        )
      `;
      const keyword = `%${search.toLowerCase()}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    // Count total matching records
    const [countResult] = await dhanDB.execute(
      `SELECT COUNT(*) AS total FROM advance_batch ${whereClause}`,
      queryParams
    );
    const totalOldAdvanceMsLeads = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalOldAdvanceMsLeads / limit);

    // Fetch paginated results
    const fetchQuery = `
      SELECT id, account_opening_name, mobile_number, whatsapp_number,
             batch_code, batch_type, old_code_approved_at
      FROM advance_batch
      ${whereClause}
      ORDER BY old_code_approved_at ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const [oldAdvanceMsLeads] = await dhanDB.execute(fetchQuery, queryParams);

    if (oldAdvanceMsLeads.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No leads found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Basic MS Teams leads fetched successfully.",
      totalOldAdvanceMsLeads,
      oldAdvanceMsLeads,
      totalPages,
      currentPage: page,
      perPage: limit,
    });

  } catch (err) {
    console.error("Error fetching MS Teams leads for admin:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: err.message,
    });
  }
};



//AdvaneMS Teams Request
exports.getUsersAdvanceMSTeamsRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    let baseQuery = `FROM leads`;
    let whereClause = ` WHERE advanced_ms_teams_request_status = 'requested'`;
    const queryParams = [];

    if (search) {
      whereClause += ` AND (LOWER(name) LIKE ? OR LOWER(mobile_number) LIKE ? OR CAST(id AS CHAR) LIKE ?)`;
      const keyword = `%${search.toLowerCase()}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    // Count query
    const [countResult] = await dhanDB.execute(
      `SELECT COUNT(*) AS total ${baseQuery}${whereClause}`,
      queryParams
    );
    const totalAdvanceMsTeamsRequests = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalAdvanceMsTeamsRequests / limit);

    // Fetch query
    const fetchQuery = `SELECT * ${baseQuery}${whereClause} ORDER BY ms_teams_login_requested_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const [advanceMsTeamsRequests] = await dhanDB.execute(fetchQuery, queryParams);

    if (advanceMsTeamsRequests.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No pending MS Teams requests found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Pending MS Teams requests fetched successfully.",
      totalAdvanceMsTeamsRequests,
      advanceMsTeamsRequests,
      totalPages,
      currentPage: page,
      perPage: limit,
    });
  } catch (error) {
    console.error("Error fetching MS Teams requests:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};



//approve advancems teams request
exports.approveAdvanceMsTeamsLoginRequest = async (req, res) => {
  const leadId = req.params.leadId;
  const { action } = req.body; // 'approve' or 'reject'

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ success: false, message: 'Invalid action provided.' });
  }

  try {
    // Check if lead exists and is in MS Teams requested state
    const [leadResult] = await dhanDB.execute(
      'SELECT * FROM leads WHERE id = ? AND dhan_advanced_ms_teams_request_status  = "requested"',
      [leadId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found or not in MS Teams requested status.',
      });
    }

    const lead = leadResult[0];

    if (action === 'approve') {
      // Get MS Teams Approved point value
      const [pointResult] = await myapp.execute(
        'SELECT points FROM conversion_points WHERE action = "dhan_advance_ms_teams_approved"'
      );

      if (!pointResult.length) {
        return res.status(500).json({
          success: false,
          message: 'Conversion point for MS Teams approval is not configured.',
        });
      }

      const pointsToCredit = pointResult[0].points;

      // Credit points to RM's wallet
      await myapp.execute(
        'UPDATE rm SET wallet = wallet + ? WHERE id = ?',
        [pointsToCredit, lead.assigned_to]
      );

      // Log wallet transaction
      await myapp.execute(
        'INSERT INTO wallet_transactions (rm_id, lead_id, action, points) VALUES (?, ?, ?, ?)',
        [lead.assigned_to, lead.id, 'dhan_advance_ms_teams_approved', pointsToCredit]
      );

      // Update lead status to approved
      await dhanDB.execute(
        'UPDATE leads SET advanced_ms_teams_request_status = "approved", advanced_ms_teams_approved_at = NOW() WHERE id = ?',
        [leadId]
      );

      return res.status(200).json({
        success: true,
        message: 'MS Teams Login request approved and points credited.',
      });

    } else {
      // Reject case: just update status
      await dhanDB.execute(
        'UPDATE leads SET advanced_ms_teams_request_status = "rejected" WHERE id = ?',
        [leadId]
      );

      return res.status(200).json({
        success: true,
        message: 'MS Teams Login request rejected successfully.',
      });
    }

  } catch (error) {
    console.error('Error processing MS Teams Login request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing MS Teams Login request.',
    });
  }
};