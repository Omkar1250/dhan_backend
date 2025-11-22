const { myapp, dhanDB } = require("../config/db");
const { getNextMainRm } = require("../utils/getNextRm");

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
// exports.handleCodeApproval = async (req, res) => {
//   try {
//     const {leadId} = req.params
//     const {  action, batch_code, rm } = req.body;

//     if (!leadId || !['approve', 'reject'].includes(action)) {
//       return res.status(400).json({ success: false, message: 'Invalid parameters.' });
//     }

//     // Validate existence of the lead
//     const [leadResult] = await dhanDB.execute(
//       'SELECT * FROM leads WHERE id = ? AND code_request_status = "requested"',
//       [leadId]
//     );

//     if (leadResult.length === 0) {
//       return res.status(404).json({ success: false, message: 'Lead not found or not in requested status.' });
//     }

//     const lead = leadResult[0];

//    if (action === 'approve') {
//   if (!batch_code || batch_code.trim() === "") {
//     return res.status(400).json({ success: false, message: 'Batch Code is required for approval.' });
//   }

//   if (!rm) {
//     return res.status(400).json({ success: false, message: 'RM ID is required to assign.' });
//   }

//   // Get conversion points
//   const [pointResult] = await myapp.execute(
//     'SELECT points FROM conversion_points WHERE action = "dhan_code_approved"'
//   );
//   const pointsToCredit = pointResult[0]?.points || 0;

//   // Credit points to RM wallet
//   await myapp.execute(
//     'UPDATE users SET wallet = wallet + ? WHERE id = ?',
//     [pointsToCredit, lead.fetched_by]
//   );

//   // Log wallet transaction
//   await myapp.execute(
//     'INSERT INTO wallet_transactions (user_id, lead_id, action,lead_source, points) VALUES (?, ?, ?, ?,?)',
//     [lead.fetched_by, lead.id, 'dhan_code_approved','dhanDB', pointsToCredit]
//   );

//   // ✅ Update lead status and assign RM
//   await dhanDB.execute(
//     `UPDATE leads 
//      SET 
//        code_request_status = 'approved',
//        code_approved_at = NOW(),
//        batch_code = ?,
//        sip_request_status = 'pending',
//        ms_teams_request_status = 'pending',
//        advance_msteams_details_sent = 'pending',
//        new_client_request_status = 'pending',
//        assigned_to = ?  
//      WHERE id = ?`,
//     [batch_code, rm, leadId]
//   );
   

//   return res.status(200).json({ success: true, message: 'Code Request approved, batch code saved, RM assigned, and points credited.' });


//     } else if (action === 'reject') {
//       await dhanDB.execute(
//         `UPDATE leads 
//          SET code_request_status = 'rejected'
//          WHERE id = ?`,
//         [leadId]
//       );

//       return res.status(200).json({ success: true, message: 'Code Request rejected successfully.' });
//     }

//   } catch (error) {
//     console.error('Error handling Code Approval:', error);
//     res.status(500).json({ success: false, message: 'Server error', error: error.message });
//   }
// };

exports.peekNextMainRm = async (req, res) => {
  try {

    // 1️⃣ Try to get next RM (after pointer)
    let [rm] = await myapp.execute(`
      SELECT id, name FROM rm 
      WHERE role='mainRm' AND is_active=1
        AND id > (SELECT last_assigned_rm_id FROM lead_assign_pointer WHERE id=1)
      ORDER BY id ASC LIMIT 1;
    `);

    // 2️⃣ If not found → restart from first RM
    if (rm.length === 0) {
      [rm] = await myapp.execute(`
        SELECT id, name FROM rm 
        WHERE role='mainRm' AND is_active=1
        ORDER BY id ASC LIMIT 1;
      `);
    }

    // 3️⃣ Return JSON response properly
    return res.status(200).json({
      success: true,
      rm: rm[0] || null
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Something went wrong while fetching next RM",
      error: error.message
    });
  }
};

//code approval
exports.handleCodeApproval = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { action, batch_code } = req.body;

    if (!leadId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid parameters.' });
    }

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
        return res.status(400).json({ success: false, message: 'Batch Code is required.' });
      }

      // ✅ AUTO ROUND ROBIN RM SELECT
      const rmId = await getNextMainRm();

      // ✅ CREDIT POINTS
      const [pointResult] = await myapp.execute(
        'SELECT points FROM conversion_points WHERE action = "dhan_code_approved"'
      );
      const pointsToCredit = pointResult[0]?.points || 0;

      await myapp.execute(
        'UPDATE users SET wallet = wallet + ? WHERE id = ?',
        [pointsToCredit, lead.fetched_by]
      );
 // Log wallet transaction
   await myapp.execute(
     'INSERT INTO wallet_transactions (user_id, lead_id, action,lead_source, points) VALUES (?, ?, ?, ?,?)',
     [lead.fetched_by, lead.id, 'dhan_code_approved','dhanDB', pointsToCredit]
   );

      // ✅ ASSIGN RM
      await dhanDB.execute(
        `UPDATE leads 
         SET 
           code_request_status = 'approved',
           code_approved_at = NOW(),
           batch_code = ?,
           sip_request_status = 'pending',
           ms_teams_request_status = 'pending',
           advance_msteams_details_sent = 'pending',
           new_client_request_status = 'pending',
           assigned_to = ?  
         WHERE id = ?`,
        [batch_code, rmId, leadId]
      );

      return res.status(200).json({ 
        success: true, 
        message: `Approved & Assigned to RM ID: ${rmId}`, 
        assigned_rm_id: rmId 
      });
    }

    if (action === 'reject') {
      await dhanDB.execute(
        `UPDATE leads SET code_request_status = 'rejected' WHERE id = ?`,
        [leadId]
      );
      return res.status(200).json({ success: true, message: 'Request rejected successfully.' });
    }

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};




//Bateches
exports.getAllBatchCodes = async (req, res) => {
  try {
    const [batches] = await dhanDB.execute(
      'SELECT id, batch_code FROM batches WHERE status = "active" ORDER BY id DESC'
    );
    res.status(200).json({ success: true, data: batches });
  } catch (error) {
    console.error('Error fetching batch codes:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};


//create batch
exports.createBatch = async (req, res) => {
  try {
    const { batch_code, description, status } = req.body;

    // ✅ Validation
    if (!batch_code || batch_code.trim() === "") {
      return res.status(400).json({ success: false, message: "Batch code is required." });
    }

    // ✅ Check if batch code already exists
    const [existingBatch] = await dhanDB.execute(
      "SELECT id FROM batches WHERE batch_code = ?",
      [batch_code]
    );

    if (existingBatch.length > 0) {
      return res.status(400).json({ success: false, message: "Batch code already exists." });
    }

    // ✅ Insert new batch
    await dhanDB.execute(
      "INSERT INTO batches (batch_code, description, status) VALUES (?, ?, ?)",
      [batch_code, description || null, status || "active"]
    );

    res.status(201).json({
      success: true,
      message: "Batch created successfully.",
    });
  } catch (error) {
    console.error("Error creating batch:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating batch.",
      error: error.message,
    });
  }
};

exports.getAllBatches = async (req, res) => {
  try {
    const [rows] = await dhanDB.execute("SELECT * FROM batches ORDER BY id DESC");
    res.status(200).json({ success: true, batches: rows });
  } catch (error) {
    console.error("Error fetching batches:", error);
    res.status(500).json({ success: false, message: "Server error while fetching batches." });
  }
};

exports.updateBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { batch_code, description, status } = req.body;

    if (!batch_code || batch_code.trim() === "") {
      return res.status(400).json({ success: false, message: "Batch code is required." });
    }

    // Check if another batch exists with same code
    const [existing] = await dhanDB.execute(
      "SELECT id FROM batches WHERE batch_code = ? AND id != ?",
      [batch_code, id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: "Batch code already exists." });
    }

    await dhanDB.execute(
      "UPDATE batches SET batch_code = ?, description = ?, status = ? WHERE id = ?",
      [batch_code, description || null, status, id]
    );

    res.status(200).json({ success: true, message: "Batch updated successfully." });
  } catch (error) {
    console.error("Error updating batch:", error);
    res.status(500).json({ success: false, message: "Server error while updating batch." });
  }
}; 

exports.deleteBatch = async (req, res) => {
  try {
    const { id } = req.params;

    await dhanDB.execute("DELETE FROM batches WHERE id = ?", [id]);

    res.status(200).json({ success: true, message: "Batch deleted successfully." });
  } catch (error) {
    console.error("Error deleting batch:", error);
    res.status(500).json({ success: false, message: "Server error while deleting batch." });
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
        'INSERT INTO wallet_transactions (user_id, lead_id, action,lead_source, points) VALUES (?, ?, ?,?, ?)',
        [lead.fetched_by, lead.id, 'dhan_ms_teams_login_approved','dhanDB', pointsToCredit]
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
      if (!batch_code) return res.status(400).json({ message: "Batch code required" });

      const assignedRmId = await getNextMainRm();
      const [pointResult] = await myapp.execute(`SELECT points FROM conversion_points WHERE action = "dhan_code_approved"`);
      const pointsToCredit = pointResult[0]?.points || 0;

      await myapp.execute(`UPDATE users SET wallet = wallet + ? WHERE id = ?`, [pointsToCredit, lead.fetched_by]);
      await myapp.execute(
        `INSERT INTO wallet_transactions (user_id, lead_id, action,lead_source, points) VALUES (?, ?, ?, ?, ?)`,
        [lead.fetched_by, lead.id, 'dhan_code_approved','dhanDB', pointsToCredit]
      );

        await dhanDB.execute(
        `UPDATE leads SET code_request_status = 'approved', code_approved_at = NOW(), batch_code = ?,assigned_to = ?, sip_request_status = 'pending', ms_teams_request_status = 'pending',new_client_request_status = 'pending', advance_msteams_details_sent='pending' WHERE id = ?`,
        [batch_code,assignedRmId, leadId]
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

    const search = (req.query.search || "").trim().toLowerCase();
    const batchCode = (req.query.batch_code || "").trim();

    // Base WHERE clause
    let whereClause = `
      WHERE l.code_request_status = 'approved'
      AND l.ms_details_sent = 'pending'
    `;

    const queryParams = [];

    // Batch Filter
    if (batchCode) {
      whereClause += ` AND l.batch_code = ? `;
      queryParams.push(batchCode);
    }

    // Search Filter
    if (search) {
      whereClause += `
        AND (
          LOWER(l.name) LIKE ? 
          OR LOWER(l.mobile_number) LIKE ? 
          OR LOWER(l.whatsapp_mobile_number) LIKE ?
        )
      `;
      const keyword = `%${search}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    // Count Query
    const [countResult] = await dhanDB.execute(
      `SELECT COUNT(*) AS total 
       FROM leads l 
       ${whereClause}`,
      queryParams
    );

    const totalMsLeads = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalMsLeads / limit);

    // Fetch Data with RM + JRM Name
    const fetchQuery = `
      SELECT 
        l.id, 
        l.name, 
        l.mobile_number, 
        l.whatsapp_mobile_number, 
        l.batch_code,
        l.created_at, 
        l.code_approved_at,

        rm.name AS rm_name,
        jrm.name AS jrm_name

      FROM leads l
      LEFT JOIN myapp.rm rm ON rm.id = l.assigned_to
      LEFT JOIN myapp.users jrm ON jrm.id = l.referred_by_rm

      ${whereClause}
      ORDER BY l.code_approved_at ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [msLeads] = await dhanDB.execute(fetchQuery, queryParams);

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

    const search = (req.query.search || "").trim().toLowerCase();
    const batchCode = (req.query.batch_code || "").trim();

    // Base WHERE clause
    let whereClause = `
      WHERE l.code_request_status = 'approved'
      AND l.advance_msteams_details_sent = 'pending'
    `;

    const queryParams = [];

    // Batch Filter
    if (batchCode) {
      whereClause += ` AND l.batch_code = ? `;
      queryParams.push(batchCode);
    }

    // Search Filter
    if (search) {
      whereClause += ` 
        AND (
          LOWER(l.name) LIKE ? 
          OR LOWER(l.mobile_number) LIKE ? 
          OR LOWER(l.whatsapp_mobile_number) LIKE ?
        )`;
      const keyword = `%${search}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    // Count Query
    const [countResult] = await dhanDB.execute(
      `SELECT COUNT(*) AS total FROM leads l ${whereClause}`,
      queryParams
    );

    const totalAdvanceMsLeads = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalAdvanceMsLeads / limit);

    // Fetch Data Query with RM + JRM name
    const fetchQuery = `
      SELECT 
        l.id, 
        l.name, 
        l.mobile_number, 
        l.whatsapp_mobile_number, 
        l.batch_code,
        l.created_at, 
        l.code_approved_at,

        rm.name AS rm_name,
        jrm.name AS jrm_name

      FROM leads l

      LEFT JOIN myapp.rm rm ON rm.id = l.assigned_to
      LEFT JOIN myapp.users jrm ON jrm.id = l.referred_by_rm

      ${whereClause}
      ORDER BY l.code_approved_at ASC
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
      message: "Advance MS Teams leads fetched successfully.",
      totalAdvanceMsLeads,
      advanceMsLeads,
      totalPages,
      currentPage: page,
      perPage: limit,
    });

  } catch (err) {
    console.error("Error fetching Advance MS Teams leads:", err);
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

    const search = (req.query.search || "").trim().toLowerCase();
    const batchCode = (req.query.batch_code || "").trim();

    // WHERE CLAUSE
    let whereClause = `
      WHERE a.old_code_request_status = 'approved'
      AND a.advance_ms_clients_msdetails = 'pending'
      AND (a.batch_type = 'advance' OR a.batch_type = 'both')
    `;

    const queryParams = [];

    // BATCH FILTER
    if (batchCode) {
      whereClause += ` AND a.batch_code = ? `;
      queryParams.push(batchCode);
    }

    // SEARCH FILTER
    if (search) {
      whereClause += `
        AND (
          LOWER(a.account_opening_name) LIKE ?
          OR LOWER(a.mobile_number) LIKE ?
          OR LOWER(a.whatsapp_number) LIKE ?
        )
      `;
      const keyword = `%${search}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    // COUNT QUERY
    const [countResult] = await dhanDB.execute(
      `SELECT COUNT(*) AS total FROM advance_batch a ${whereClause}`,
      queryParams
    );

    const totalOldAdvanceMsLeads = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalOldAdvanceMsLeads / limit);

    // FETCH QUERY (WITH RM + JRM)
    const fetchQuery = `
      SELECT 
        a.id,
        a.account_opening_name,
        a.mobile_number,
        a.whatsapp_number,
        a.batch_code,
        a.batch_type,
        a.old_code_approved_at,

        rm.name AS rm_name
      

      FROM advance_batch a
      LEFT JOIN myapp.users rm ON rm.id = a.refer_by
    

      ${whereClause}
      ORDER BY a.old_code_approved_at ASC
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
      message: "Advance MS Teams leads fetched successfully.",
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


//new client for call
// ✅ Get all leads pending approval
exports.getPendingNewClientRequests = async (req, res) => {
  try {
    // 📄 Pagination setup
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    // 🔍 Filters
    const search = req.query.search ? req.query.search.trim().toLowerCase() : "";
    const batch = req.query.batch || "";

    // 🧩 Base WHERE clause
    let whereClause = `
      WHERE 
        leads.new_client_approval_status = 'pending' 
        AND leads.new_client_action_status = 'sent' 
        AND leads.new_client_request_status = 'requested'
        AND leads.code_request_status = 'approved'
    `;

    const queryParams = [];

    // 🧾 Optional batch filter
    if (batch) {
      whereClause += ` AND leads.batch_code = ?`;
      queryParams.push(batch);
    }

    // 🔍 Optional search filter
    if (search) {
      whereClause += `
        AND (
          LOWER(leads.name) LIKE ? 
          OR LOWER(leads.mobile_number) LIKE ? 
          OR LOWER(leads.batch_code) LIKE ?
          OR CAST(leads.id AS CHAR) LIKE ?
        )
      `;
      const keyword = `%${search}%`;
      queryParams.push(keyword, keyword, keyword, keyword);
    }

    // 📊 Count total rows
    const [countResult] = await dhanDB.execute(
      `SELECT COUNT(*) AS total FROM leads ${whereClause}`,
      queryParams
    );
    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    // 📦 Fetch paginated data (curly braces for limit and offset)
    const [rows] = await dhanDB.query(
  `
  SELECT 
    leads.id,
    leads.name,
    leads.batch_code,
    leads.mobile_number,
    leads.whatsapp_mobile_number,
    leads.new_client_call_status,
    leads.new_client_call_screenshot,
    leads.new_client_request_status,
    leads.new_client_approval_status,
    leads.new_client_action_status,
    leads.new_client_requested_at,
    users.name AS rm_name
  FROM leads
  LEFT JOIN users ON leads.assigned_to = users.id
  ${whereClause}
  ORDER BY leads.id DESC
  LIMIT ${dhanDB.escape(limit)} OFFSET ${dhanDB.escape(offset)}
  `,
  queryParams
);

    // ✅ Success response
    return res.status(200).json({
      success: true,
      message: "Pending new client requests fetched successfully.",
      data: rows,
      total,
      totalPages,
      currentPage: page,
      perPage: limit,
    });

  } catch (error) {
    console.error("❌ Error fetching pending new client requests:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching pending new client requests.",
      error: error.message,
    });
  }
};

exports.approveOrRejectNewCallRequest = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { action } = req.body;

    // ✅ Validate input parameters
    if (!leadId || !["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid parameters. Action must be either "approve" or "reject".',
      });
    }

    // ✅ Check if lead exists and is still in requested state
    const [leadResult] = await dhanDB.execute(
      `SELECT * FROM leads WHERE id = ? AND new_client_request_status = 'requested'`,
      [leadId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Lead not found or not in requested status.",
      });
    }

    // ✅ Process Approval
    if (action === "approve") {
      await dhanDB.execute(
        `UPDATE leads 
         SET 
           new_client_approval_status = 'approved',
           new_client_action_status = 'pending',
           new_client_request_status = 'approved'
         WHERE id = ?`,
        [leadId]
      );

      return res.status(200).json({
        success: true,
        message: "New client call request approved successfully.",
      });
    }

    // ✅ Process Rejection
    if (action === "reject") {
      await dhanDB.execute(
        `UPDATE leads 
         SET 
           new_client_approval_status = 'rejected',
           new_client_action_status = 'rejected'
         WHERE id = ?`,
        [leadId]
      );

      return res.status(200).json({
        success: true,
        message: "New client call request rejected successfully.",
      });
    }
  } catch (error) {
    console.error("❌ Error handling new client call request:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while handling client call request.",
      error: error.message,
    });
  }
};


exports.getPendingBasicMsTeamsRequests = async (req, res) => {
  try {
    // 📄 Pagination setup
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    // 🔍 Filters
    const search = req.query.search ? req.query.search.trim().toLowerCase() : "";
    const batch = req.query.batch || "";

    // 🧩 Base WHERE clause
    let whereClause = `
      WHERE 
        leads.new_client_basic_ms_approval_status = 'pending' 
        AND leads.new_client_basic_ms_action_status = 'sent' 
        AND leads.new_client_basic_ms_request_status = 'requested'
    `;

    const queryParams = [];

    // 🧾 Optional batch filter
    if (batch) {
      whereClause += ` AND leads.batch_code = ?`;
      queryParams.push(batch);
    }

    // 🔍 Optional search filter
    if (search) {
      whereClause += `
        AND (
          LOWER(leads.name) LIKE ? 
          OR LOWER(leads.mobile_number) LIKE ? 
          OR LOWER(leads.batch_code) LIKE ?
          OR CAST(leads.id AS CHAR) LIKE ?
        )
      `;
      const keyword = `%${search}%`;
      queryParams.push(keyword, keyword, keyword, keyword);
    }

    // 📊 Count total rows
    const [countResult] = await dhanDB.execute(
      `SELECT COUNT(*) AS total FROM leads ${whereClause}`,
      queryParams
    );
    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    // 📦 Fetch paginated data (curly braces for limit and offset)
    const [rows] = await dhanDB.query(
      `
      SELECT 
        leads.id,
        leads.name,
        leads.batch_code,
        leads.mobile_number,
        leads.whatsapp_mobile_number,
        leads.new_client_basic_ms_status,
        leads.new_client_basic_ms_screenshot,
        leads.new_client_basic_ms_request_status,
        leads.new_client_basic_ms_approval_status,
        leads.new_client_basic_ms_action_status,
        users.name AS rm_name
      FROM leads
      LEFT JOIN users ON leads.assigned_to = users.id
      ${whereClause}
      ORDER BY leads.id DESC
      LIMIT ${dhanDB.escape(limit)} OFFSET ${dhanDB.escape(offset)}
      `,
      queryParams
    );

    // ✅ Success response
    return res.status(200).json({
      success: true,
      message: "Pending Basic MS Teams requests fetched successfully.",
      data: rows,
      total,
      totalPages,
      currentPage: page,
      perPage: limit,
    });

  } catch (error) {
    console.error("❌ Error fetching Basic MS Teams requests:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching Basic MS Teams requests.",
      error: error.message,
    });
  }
};

exports.approveOrRejectBasicMsRequest = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { action } = req.body;

    // ✅ Validate input
    if (!leadId || !["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid parameters. Action must be either "approve" or "reject".',
      });
    }

    // ✅ Check lead exists and is in requested state
    const [leadResult] = await dhanDB.execute(
      `SELECT id FROM leads 
       WHERE id = ? 
       AND new_client_basic_ms_request_status = 'requested'
       AND new_client_basic_ms_action_status = 'sent'
      `, 
      [leadId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Lead not found OR request not in requested state.",
      });
    }

    // ✅ Approve Flow
    if (action === "approve") {
      await dhanDB.execute(
        `UPDATE leads 
         SET 
           new_client_basic_ms_approval_status = 'approved',
           new_client_basic_ms_action_status = 'sent',
           new_client_basic_ms_request_status = 'approved'
         WHERE id = ?`,
        [leadId]
      );

      return res.status(200).json({
        success: true,
        message: "Basic MS Teams request approved successfully.",
      });
    }

    // ✅ Reject Flow
    if (action === "reject") {
      await dhanDB.execute(
        `UPDATE leads 
         SET 
           new_client_basic_ms_approval_status = 'rejected',
           new_client_basic_ms_action_status = 'rejected',
           new_client_basic_ms_request_status = NULL
         WHERE id = ?`,
        [leadId]
      );

      return res.status(200).json({
        success: true,
        message: "Basic MS Teams request rejected successfully.",
      });
    }
  } catch (error) {
    console.error("❌ Error approving/rejecting Basic MS request:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while processing request.",
      error: error.message,
    });
  }
};


// PATCH /mf/admin/stage-review
// body: { leadId, stage, action, reason? }



// GET /mf/admin/pending-requests
// ✅ Valid stages
const VALID_STAGE = new Set(['session4', 'session19', 'batchEnd', 'monthly']);

// ✅ Stage to column mapping (must match your DB columns)
const approvalColumns = `
  approval_session_4='pending' OR
  approval_session_19='pending' OR
  approval_batch_end='pending' OR
  approval_monthly='pending'
`;

const statusColumns = `
  rm_mf_status_session_4='sip_done_converted' OR
  rm_mf_status_session_19='sip_done_converted' OR
  rm_mf_status_batch_end='sip_done_converted' OR
  rm_mf_status_monthly='sip_done_converted'
`;

const where = `
  WHERE code_request_status='approved'
  AND (${approvalColumns})
  AND (${statusColumns})
`;




exports.getPendingSipConRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    // Build pending approval OR conditions
    const approvalColumns = `
      approval_session_4='pending' OR
      approval_session_19='pending' OR
      approval_batch_end='pending' OR
      approval_monthly='pending'
    `;

    // Build SIP done OR conditions
    const statusColumns = `
      rm_mf_status_session_4='sip_done_converted' OR
      rm_mf_status_session_19='sip_done_converted' OR
      rm_mf_status_batch_end='sip_done_converted' OR
      rm_mf_status_monthly='sip_done_converted'
    `;

    const where = `
      WHERE code_request_status='approved'
      AND (${approvalColumns})
      AND (${statusColumns})
    `;

    // Total count
    const [[{ total }]] = await dhanDB.execute(
      `SELECT COUNT(*) as total FROM leads ${where}`
    );

    // Fetch data
    const [rows] = await dhanDB.execute(
      `SELECT id, name, mobile_number, whatsapp_mobile_number, batch_code,
              rm_mf_status_session_4, rm_mf_status_session_19, rm_mf_status_batch_end, rm_mf_status_monthly,
              approval_session_4, approval_session_19, approval_batch_end, approval_monthly,
              screenshot_session_4, screenshot_session_19, screenshot_batch_end, screenshot_monthly
       FROM leads
       ${where}
       ORDER BY id DESC
       LIMIT ${dhanDB.escape(limit)} OFFSET ${dhanDB.escape(offset)}
      `,
    );

    return res.json({
      success: true,
      message: "Pending SIP approval requests fetched",
      pendingRequests: rows,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      perPage: limit,
    });

  } catch (err) {
    console.error("getPendingSipRequests error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};



// STAGE MAP MUST MATCH YOUR DB STRUCTURE
const STAGE_MAP = {
  session4: {
    statusCol: "rm_mf_status_session_4",
    approvalCol: "approval_session_4",
    screenshotCol: "screenshot_session_4",
  },
  session19: {
    statusCol: "rm_mf_status_session_19",
    approvalCol: "approval_session_19",
    screenshotCol: "screenshot_session_19",
  },
  batchEnd: {
    statusCol: "rm_mf_status_batch_end",
    approvalCol: "approval_batch_end",
    screenshotCol: "screenshot_batch_end",
  },
  monthly: {
    statusCol: "rm_mf_status_monthly",
    approvalCol: "approval_monthly",
    screenshotCol: "screenshot_monthly",
  },
};




// ✅ PATCH /api/admin/mf/sip-review/:leadId
exports.approveOrRejectSipStageRequest = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { leadId } = req.params;
    const { stage, action } = req.body;

    // 🔹 Validate
    if (!leadId || !stage || !action) {
      return res.status(400).json({
        success: false,
        message: "leadId, stage and action are required.",
      });
    }

    if (!VALID_STAGE.has(stage)) {
      return res.status(400).json({
        success: false,
        message: "Invalid stage.",
      });
    }

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be either "approve" or "reject".',
      });
    }

    // ✅ Extract DB columns for this stage
    const { statusCol, approvalCol } = STAGE_MAP[stage];

    // ✅ Select the lead's stage record
    const [[lead]] = await dhanDB.execute(
      `SELECT ${statusCol} as stageStatus, ${approvalCol} as stageApproval FROM leads WHERE id=?`,
      [leadId]
    );

    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found." });
    }

    if (lead.stageApproval !== "pending") {
      return res.status(400).json({
        success: false,
        message: "This stage is not in a pending approval state.",
      });
    }

    // ✅ APPROVE FLOW
    if (action === "approve") {
      await dhanDB.execute(
        `UPDATE leads
         SET ${approvalCol}='approved'
         WHERE id=?`,
        [ leadId]
      );

      // If SIP conversion, mark final approval as well
      if (lead.stageStatus === "sip_done_converted") {
        await dhanDB.execute(
          `UPDATE leads SET final_sip_approved='yes' WHERE id=?`,
          [leadId]
        );
      }

      return res.status(200).json({
        success: true,
        message: "SIP approval granted successfully.",
      });
    }

    // ✅ REJECT FLOW
    if (action === "reject") {
      await dhanDB.execute(
        `UPDATE leads
         SET ${approvalCol}='rejected'
         WHERE id=?`,
        [leadId]
      );

      return res.json({
        success: true,
        message: "SIP request rejected successfully.",
      });
    }
  } catch (err) {
    console.error("approveOrRejectSipStageRequest error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// ====== Approved SIP: List, Stats, Batches ======

/**
 * GET /api/admin/mf/sip-approved
 * Query: page, limit, search, batch_code, rm_id
 */
exports.getApprovedSipConRequests = async (req, res) => {
  try {
    const page  = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const search = (req.query.search || '').trim().toLowerCase();
    const batchCode = (req.query.batch_code || '').trim();
    const rmId = req.query.rm_id ? parseInt(req.query.rm_id, 10) : null;

    let where = `
      WHERE l.code_request_status='approved'
      AND l.final_sip_approved='yes'
    `;
    const params = [];

    if (batchCode) {
      where += ` AND l.batch_code = ? `;
      params.push(batchCode);
    }

    if (rmId) {
      where += ` AND l.assigned_to = ? `;
      params.push(rmId);
    }

    if (search) {
      const kw = `%${search}%`;
      where += ` AND (LOWER(l.name) LIKE ? OR l.mobile_number LIKE ? OR l.whatsapp_mobile_number LIKE ? OR l.batch_code LIKE ?) `;
      params.push(kw, kw, kw, kw);
    }

    // Count
    const [[{ total }]] = await dhanDB.execute(
      `SELECT COUNT(*) AS total
       FROM leads l
       LEFT JOIN users u ON u.id = l.assigned_to
       ${where}`,
      params
    );

    // Data
    const [rows] = await dhanDB.execute(
      `SELECT l.id, l.name, l.mobile_number, l.whatsapp_mobile_number,
              l.batch_code, l.created_at,
              l.rm_mf_status_session_4, l.rm_mf_status_session_19, l.rm_mf_status_batch_end, l.rm_mf_status_monthly,
              l.approval_session_4, l.approval_session_19, l.approval_batch_end, l.approval_monthly,
              l.screenshot_session_4, l.screenshot_session_19, l.screenshot_batch_end, l.screenshot_monthly,
              l.final_sip_approved,
              l.assigned_to AS rm_id, u.name AS rm_name
       FROM leads l
       LEFT JOIN users u ON u.id = l.assigned_to
       ${where}
       ORDER BY  l.id DESC
       LIMIT ${db.escape(limit)} OFFSET ${db.escape(offset)}`,
      [...params]
    );

    return res.json({
      success: true, 
      message: "Approved SIP list fetched",
      approvedRequests: rows,
      total: total || 0,
      totalPages: Math.max(1, Math.ceil((total || 0) / limit)),
      currentPage: page,
      perPage: limit,
    });

  } catch (err) {
    console.error("getApprovedSipConRequests error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * GET /api/admin/mf/sip-approved-stats
 * Query: batch_code (optional)
 * Returns RM-wise counts of final approved SIPs
 */
exports.getSipApprovedStats = async (req, res) => {
  try {
    const batchCode = (req.query.batch_code || '').trim();

    let where = `
      WHERE l.code_request_status='approved'
      AND l.final_sip_approved='yes'
    `;
    const params = [];

    if (batchCode) {
      where += ` AND l.batch_code = ? `;
      params.push(batchCode);
    }

    const [rows] = await dhanDB.execute(
      `SELECT l.assigned_to AS rm_id, COALESCE(u.name, 'Unknown') AS rm_name, COUNT(*) AS converted
       FROM leads l
       LEFT JOIN users u ON u.id = l.assigned_to
       ${where}
       GROUP BY l.assigned_to, u.name
       ORDER BY converted DESC`,
      params
    );

    const totalConverted = rows.reduce((acc, r) => acc + Number(r.converted || 0), 0);

    return res.json({
      success: true,
      message: "RM-wise approved SIP stats",
      stats: rows,
      totalConverted,
    });

  } catch (err) {
    console.error("getSipApprovedStats error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * GET /api/admin/mf/sip-approved-batches
 * Returns distinct batch codes with final approved SIPs
 */
exports.getSipApprovedBatches = async (req, res) => {
  try {
    const [rows] = await dhanDB.execute(
      `SELECT DISTINCT batch_code
       FROM leads
       WHERE code_request_status='approved'
         AND final_sip_approved='yes'
         AND batch_code IS NOT NULL
       ORDER BY batch_code ASC`
    );

    return res.json({
      success: true,
      message: "Approved SIP batches fetched",
      batches: rows.map(r => r.batch_code),
    });

  } catch (err) {
    console.error("getSipApprovedBatches error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
