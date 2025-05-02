const db = require('../config/db');

exports.handleUnderUsApproval = async (req, res) => {
    try {
      const { leadId, action } = req.body;
  
      if (!leadId || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ success: false, message: 'Invalid parameters.' });
      }
  
      if (action === 'approve') {
        await db.execute(
          `UPDATE leads SET under_us_status = 'approved', under_us_approved_at = NOW() WHERE id = ?`,
          [leadId]
        );
        return res.status(200).json({ success: true, message: 'Lead approved successfully.' });
  
      } else if (action === 'reject') {
        await db.execute(
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
    const {  action, batch_code } = req.body;

    if (!leadId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid parameters.' });
    }

    // Validate existence of the lead
    const [leadResult] = await db.execute(
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

      // Get conversion points
      const [pointResult] = await db.execute(
        'SELECT points FROM conversion_points WHERE action = "code_approved"'
      );
      const pointsToCredit = pointResult[0]?.points || 0;

      // Credit points to RM wallet
      await db.execute(
        'UPDATE users SET wallet = wallet + ? WHERE id = ?',
        [pointsToCredit, lead.fetched_by]
      );

      // Log wallet transaction
      await db.execute(
        'INSERT INTO wallet_transactions (user_id, lead_id, action, points) VALUES (?, ?, ?, ?)',
        [lead.fetched_by, lead.id, 'code_approved', pointsToCredit]
      );

      // Update lead status
      await db.execute(
        `UPDATE leads 
         SET 
           code_request_status = 'approved',
           code_approved_at = NOW(),
           batch_code = ?,
           sip_request_status = 'pending',
           ms_teams_request_status = 'pending'
         WHERE id = ?`,
        [batch_code, leadId]
      );

      return res.status(200).json({ success: true, message: 'Code Request approved, batch code saved, and points credited.' });

    } else if (action === 'reject') {
      await db.execute(
        `UPDATE leads 
         SET code_request_status = 'rejected', 
             code_approved_at = NOW() 
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
exports.approveAOMARequest = async (req, res) => {
  const leadId = req.params.leadId;
  const { action } = req.body; // 'approve' or 'reject'

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ success: false, message: 'Invalid action provided.' });
  }

  try {
    // Check if lead exists and is in requested state
    const [leadResult] = await db.execute(
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
      // Get AOMA Approved point value
      const [pointResult] = await db.execute(
        'SELECT points FROM conversion_points WHERE action = "aoma_approved"'
      );

      const pointsToCredit = pointResult[0]?.points || 0;

      // Credit points to RM's wallet
      await db.execute(
        'UPDATE users SET wallet = wallet + ? WHERE id = ?',
        [pointsToCredit, lead.fetched_by]
      );

      // Log transaction
      await db.execute(
        'INSERT INTO wallet_transactions (user_id, lead_id, action, points) VALUES (?, ?, ?, ?)',
        [lead.fetched_by, lead.id, 'aoma_approved', pointsToCredit]
      );

      // Update lead status to approved
      await db.execute(
        'UPDATE leads SET aoma_request_status = "approved", aoma_approved_at = NOW() WHERE id = ?',
        [leadId]
      );

      return res.status(200).json({
        success: true,
        message: 'AOMA request approved and points credited.',
      });

    } else {
      // Reject case: no wallet credit, just update status
      await db.execute(
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
exports.approveActivationRequest = async (req, res) => {
  const leadId = req.params.leadId;
  const { action } = req.body; // 'approve' or 'reject'

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ success: false, message: 'Invalid action provided.' });
  }

  try {
    // Check if lead exists and is in requested state
    const [leadResult] = await db.execute(
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
      const [pointResult] = await db.execute(
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
      await db.execute(
        'UPDATE users SET wallet = wallet + ? WHERE id = ?',
        [pointsToCredit, lead.fetched_by]
      );

      // Log transaction
      await db.execute(
        'INSERT INTO wallet_transactions (user_id, lead_id, action, points) VALUES (?, ?, ?, ?)',
        [lead.fetched_by, lead.id, 'activation_approved', pointsToCredit]
      );

      // Update lead status to approved
      await db.execute(
        'UPDATE leads SET activation_request_status = "approved", activation_approved_at = NOW() WHERE id = ?',
        [leadId]
      );

      return res.status(200).json({
        success: true,
        message: 'Activation request approved and points credited.',
      });

    } else {
      // Reject case: just update status
      await db.execute(
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
    const [leadResult] = await db.execute(
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
      const [pointResult] = await db.execute(
        'SELECT points FROM conversion_points WHERE action = "ms_teams_approved"'
      );

      if (!pointResult.length) {
        return res.status(500).json({
          success: false,
          message: 'Conversion point for MS Teams approval is not configured.',
        });
      }

      const pointsToCredit = pointResult[0].points;

      // Credit points to RM's wallet
      await db.execute(
        'UPDATE users SET wallet = wallet + ? WHERE id = ?',
        [pointsToCredit, lead.fetched_by]
      );

      // Log wallet transaction
      await db.execute(
        'INSERT INTO wallet_transactions (user_id, lead_id, action, points) VALUES (?, ?, ?, ?)',
        [lead.fetched_by, lead.id, 'ms_teams_login_approved', pointsToCredit]
      );

      // Update lead status to approved
      await db.execute(
        'UPDATE leads SET ms_teams_request_status = "approved", ms_teams_approved_at = NOW() WHERE id = ?',
        [leadId]
      );

      return res.status(200).json({
        success: true,
        message: 'MS Teams Login request approved and points credited.',
      });

    } else {
      // Reject case: just update status
      await db.execute(
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
    const [leadResult] = await db.execute(
      'SELECT * FROM leads WHERE id = ? AND sip_request_status = "requested"',
      [leadId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found or not in requested status.' });
    }

    const lead = leadResult[0];

    if (action === 'approve') {
      // Handle SIP approval
      const [pointResult] = await db.execute(
        'SELECT points FROM conversion_points WHERE action = "sip_approved"'
      );

      const pointsToCredit = pointResult[0]?.points || 0;

    
      
        // Credit points to RM wallet
        await db.execute(
          'UPDATE users SET wallet = wallet + ? WHERE id = ?',
          [pointsToCredit, lead.fetched_by]
        );

        // Log wallet transaction
        await db.execute(
          'INSERT INTO wallet_transactions (user_id, lead_id, action, points) VALUES (?, ?, ?, ?)',
          [lead.fetched_by, lead.id, 'sip_approved', pointsToCredit]
        );

        // Update lead status
        await db.execute(
          'UPDATE leads SET sip_request_status = "approved" WHERE id = ?',
          [leadId]
        );


        return res.status(200).json({ success: true, message: 'SIP Request approved and points credited.' });
      
    } else if (action === 'reject') {
      // Handle SIP rejection
      await db.execute(
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

    // Get total count of pending under_us_status leads
    const [countResult] = await db.execute(
      `SELECT COUNT(*) AS total 
       FROM leads 
       WHERE under_us_status = 'pending'`
    );
    const totalUnderUsRequests = countResult[0].total;
    const totalPages = Math.ceil(totalUnderUsRequests / limit);

    // Fetch paginated pending under_us_status leads
    const [underUsRequests] = await db.execute(
      `SELECT * 
       FROM leads 
       WHERE under_us_status = 'pending' 
       ORDER BY under_us_requested_at DESC 
       LIMIT ${limit} OFFSET ${offset}`,
      [limit, offset]
    );

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

    // Get total count of pending code_status leads
    const [countResult] = await db.execute(
      `SELECT COUNT(*) AS total 
       FROM leads 
       WHERE code_request_status = 'requested'`
    );
    const totalCodedRequests = countResult[0].total;
    const totalPages = Math.ceil(totalCodedRequests / limit);

    // Fetch paginated pending code_status leads
    const [codedRequests] = await db.execute(
      `SELECT * 
       FROM leads 
       WHERE code_request_status = 'requested' 
       ORDER BY code_requested_at DESC 
        LIMIT ${limit} OFFSET ${offset}`,
      [limit, offset]
    );

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

    // Get total count of pending aoma_status leads
    const [countResult] = await db.execute(
      `SELECT COUNT(*) AS total 
       FROM leads 
       WHERE aoma_request_status = 'requested'`
    );
    const totalAomaRequests = countResult[0].total;
    const totalPages = Math.ceil(totalAomaRequests / limit);

    // Fetch paginated pending aoma_status leads
    const [aomaRequests] = await db.execute(
      `SELECT * 
       FROM leads 
       WHERE aoma_request_status = 'requested' 
       ORDER BY aoma_requested_at DESC 
       LIMIT ${limit} OFFSET ${offset}`,
      [limit, offset]
    );

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

    // Get total count of pending activation_status leads
    const [countResult] = await db.execute(
      `SELECT COUNT(*) AS total 
       FROM leads 
       WHERE activation_request_status = 'requested'`
    );
    const totalActivationRequests = countResult[0].total;
    const totalPages = Math.ceil(totalActivationRequests / limit);

    // Fetch paginated pending activation_status leads
    const [activationRequests] = await db.execute(
      `SELECT * 
       FROM leads 
       WHERE activation_request_status = 'requested' 
       ORDER BY activation_requested_at DESC 
     LIMIT ${limit} OFFSET ${offset}`,
      [limit, offset]
    );

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

    let whereClause = `ms_teams_request_status = 'requested'`;
    let searchClause = "";
    let params = [];

    if (search) {
      const likeSearch = `%${search}%`;
      searchClause = `AND (name LIKE ? OR mobile_number LIKE ?)`;
      params.push(likeSearch, likeSearch);
    }

    // Get total count
    const [countResult] = await db.execute(
      `
      SELECT COUNT(*) AS total 
      FROM leads 
      WHERE ${whereClause} ${search ? searchClause : ""}
      `,
      params
    );

    const totalMsTeamsRequests = countResult[0].total;
    const totalPages = Math.ceil(totalMsTeamsRequests / limit);

    // Add pagination params
    params.push(limit, offset);

    // Get paginated results
    const [msTeamsRequests] = await db.execute(
      `
      SELECT * 
      FROM leads 
      WHERE ${whereClause} ${search ? searchClause : ""}
      ORDER BY ms_teams_login_requested_at DESC 
      LIMIT ${limit} OFFSET ${offset}
      `,
      params
    );

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

    // Get total count of pending sip_status leads
    const [countResult] = await db.execute(
      `SELECT COUNT(*) AS total 
       FROM leads 
       WHERE sip_request_status = 'requested'`
    );
    const totalSipRequests = countResult[0].total;
    const totalPages = Math.ceil(totalSipRequests / limit);

    // Fetch paginated pending sip_status leads
    const [sipRequests] = await db.execute(
      `SELECT * 
       FROM leads 
       WHERE sip_request_status = 'requested' 
       ORDER BY sip_requested_at DESC 
       LIMIT ${limit} OFFSET ${offset}`,
      [limit, offset]
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
      fetchedLeads: `SELECT COUNT(*) AS count FROM leads ${whereClause}`,
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
      const [rows] = await db.execute(query, [...values]);
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
    const [rows] = await db.execute('SELECT id, name, personal_number, created_at FROM users WHERE role = "rm"');

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
    const [rows] = await db.query("SELECT action, points FROM conversion_points");
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
    await db.query("START TRANSACTION");

    const actions = Object.entries(updates);
    for (const [action, points] of actions) {
      if (typeof points !== "number" || points < 0) {
        throw new Error(`Invalid points value for action: ${action}`);
      }
      await db.query("UPDATE conversion_points SET points = ? WHERE action = ?", [points, action]);
    }

    // Commit the transaction
    await db.query("COMMIT");

    res.status(200).json({
      success: true,
      message: "Conversion points updated successfully",
    });
  } catch (error) {
    // Rollback the transaction in case of error
    await db.query("ROLLBACK");
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

    console.log("Backend Debugging Logs:");
    console.log("Page:", page, "Limit:", limit, "Offset:", offset, "Search:", search);

    // Base query and parameters
    let baseQuery = `FROM admin_delete_list`;
    let whereClause = ` WHERE mobile_number IS NOT NULL`; // Exclude NULL values in mobile_number
    let queryParams = [];

    // Add search condition
    if (search) {
      whereClause += ` AND TRIM(mobile_number) LIKE ?`;
      queryParams.push(`%${search}%`);
    }

    console.log("Count Query:", `SELECT COUNT(*) AS total ${baseQuery}${whereClause}`);
    console.log("Query Params for Count:", queryParams);

    // Count query to get total matching results
    const [countResult] = await db.execute(
      `SELECT COUNT(*) AS total ${baseQuery}${whereClause}`,
      queryParams
    );
    const totalDeleteRequests = countResult[0]?.total || 0; // Total rows
    const totalPages = Math.ceil(totalDeleteRequests / limit); // Calculate total pages

    console.log("Total Delete Requests:", totalDeleteRequests, "Total Pages:", totalPages);

    // Fetch query to get matching rows with pagination
    const fetchQuery = `SELECT * ${baseQuery}${whereClause} ORDER BY deleted_at DESC LIMIT ${limit} OFFSET ${offset}`;
    console.log("Fetch Query:", fetchQuery);
    console.log("Query Params for Fetch:", queryParams);

    const [deleteRequests] = await db.execute(fetchQuery, queryParams);

    console.log("Delete Requests Result:", deleteRequests);

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