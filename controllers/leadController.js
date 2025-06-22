const db = require('../config/db');
const fs = require("fs");

// Fetch leads for RM
// exports.fetchLeads = async (req, res) => {
//   try {
//     console.log("------")
//     const rmId = req.user.id;
//     console.log(rmId)
//     // Check last fetch time
//     const [lastFetch] = await db.execute(
//       'SELECT MAX(fetched_at) as lastFetch FROM leads WHERE fetched_by = ?',
//       [rmId]
//     );

//     const lastFetchTime = lastFetch[0].lastFetch;
//     const now = new Date();

//     if (lastFetchTime && (now - new Date(lastFetchTime)) / 60000 < 5) {
//       return res.status(400).json({
//         success: false,
//         message: `Please wait ${Math.ceil(5 - (now - new Date(lastFetchTime)) / 60000)} minutes before fetching leads again.`
//       });
//     }

//     // Fetch 5 available leads
//     const [leads] = await db.execute(
//       'SELECT * FROM leads WHERE fetched_by IS NULL ORDER BY id DESC LIMIT 5'
//     );

//     if (leads.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: 'No leads available.'
//       });
//     }

//     // Assign those leads to RM
//     const leadIds = leads.map(l => l.id);
//     await db.execute(
//       `UPDATE leads SET fetched_by = ?, fetched_at = ? WHERE id IN (${leadIds.join(',')})`,
//       [rmId, now]
//     );

//     res.status(200).json({
//       success: true,
//       message: 'Leads fetched successfully.',
//       leads
//     });

//   } catch (error) {
//     res.status(500).json({ success: false, error: error.message });
//   }
// };
exports.fetchLeads = async (req, res) => {
  try {
    const rmId = req.user.id;

    // Check last fetch time
    const [lastFetch] = await db.execute(
      'SELECT MAX(fetched_at) as lastFetch FROM leads WHERE fetched_by = ?',
      [rmId]
    );

    const lastFetchTime = lastFetch[0].lastFetch;
    const now = new Date();

    if (lastFetchTime && (now - new Date(lastFetchTime)) / 60000 < 5) {
      return res.status(400).json({
        success: false,
        message: `Please wait ${Math.ceil(5 - (now - new Date(lastFetchTime)) / 60000)} minutes before fetching leads again.`
      });
    }

    // Fetch 5 available leads that are not already coded
    const [leads] = await db.execute(
      `SELECT * FROM leads 
       WHERE fetched_by IS NULL 
       AND (code_request_status IS NULL OR code_request_status != 'approved') 
       ORDER BY id DESC 
       LIMIT 5`
    );

    if (leads.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No leads available.'
      });
    }

    const leadIds = leads.map(l => l.id);
    await db.execute(
      `UPDATE leads SET fetched_by = ?, fetched_at = ? WHERE id IN (${leadIds.join(',')})`,
      [rmId, now]
    );

    res.status(200).json({
      success: true,
      message: 'Leads fetched successfully.',
      leads
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};



//leads list of particulat RM 
exports.fetchLeadsRMs = async (req, res) => {
  try {
    const rmId = req.user.id;

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 5;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    const baseQuery = `FROM leads`;
    let whereClause = `
      WHERE fetched_by = ?
      AND (referred_by_rm IS NULL OR referred_by_rm = 0 OR deleted_by_rm IS NULL)
      AND (under_us_status IS NULL OR under_us_status != 'approved') 
    `;
    const queryParams = [rmId];

    if (search) {
      whereClause += `
        AND (
          LOWER(name) LIKE ?
          OR LOWER(mobile_number) LIKE ?
          OR CAST(id AS CHAR) LIKE ?
        )
      `;
      const keyword = `%${search.toLowerCase()}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    // Count total leads
    const [countResult] = await db.execute(
      `SELECT COUNT(*) AS total ${baseQuery} ${whereClause}`,
      queryParams
    );
    const totalLeads = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalLeads / limit);

    // Fetch paginated leads
    const fetchQuery = `SELECT * ${baseQuery} ${whereClause} ORDER BY fetched_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const [leads] = await db.execute(fetchQuery, queryParams);

    if (leads.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No leads found for this RM.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "RM Leads fetched successfully.",
      totalLeads,
      leads,
      totalPages,
      currentPage: page,
      perPage: limit,
    });
  } catch (error) {
    console.error("Error fetching RM Leads:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};




//"Under Us" approval req
exports.requestUnderUsApproval = async (req, res) => {
  try {
    const rmId = req.user.id;  // RM ID from authenticated user
    const { leadId } = req.body;  // Lead ID to send for approval

    // Validate that leadId exists
    if (!leadId) {
      return res.status(400).json({
        success: false,
        message: "Lead ID is required."
      });
    }

    // Check if lead is already in 'pending' or 'approved' or 'rejected' status
    const [check] = await db.execute(`
      SELECT under_us_status FROM leads WHERE id = ? AND fetched_by = ?
    `, [leadId, rmId]);

    if (check.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Lead not found or not authorized."
      });
    }

    const currentStatus = check[0].under_us_status;

    if (["pending", "approved"].includes(currentStatus)) {
      return res.status(400).json({
        success: false,
        message: `You have already requested Under Us approval. Current status: '${currentStatus}'.`
      });
    }

    // Proceed to update only if not requested yet
    const [result] = await db.execute(`
      UPDATE leads
      SET under_us_status = 'pending', under_us_requested_at = NOW()
      WHERE id = ? AND fetched_by = ?
    `, [leadId, rmId]);

    // Double-checking affectedRows (should be 1)
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Lead not found or you're not authorized to request approval."
      });
    }

    // Success response
    res.status(200).json({
      success: true,
      message: "Under Us approval request sent to Admin successfully."
    });
  } catch (error) {
    console.error("Error requesting Under Us approval:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};




//request for code approval
exports.requestCodeApproval = async (req, res) => {
  try {
    const { leadId } = req.body;
    const rmId = req.user.id;

    // Check lead belongs to RM & is under_us_approved
    const [leadResult] = await db.execute(
      `SELECT * FROM leads WHERE id=? AND fetched_by=? AND under_us_status='approved'`,
      [leadId, rmId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found or not approved for Under Us' });
    }

    // Update status to 'requested'
    await db.execute(`UPDATE leads SET code_request_status='requested' WHERE id=?`, [leadId]);

    res.json({ success: true, message: 'Code approval request sent to admin' });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};


//aoma approval request
exports.requestAOMAApproval = async (req, res) => {
  try {
    const { leadId } = req.params;
    const rmId = req.user.id;
    const { useStar } = req.body; // Expecting true or false
    const screenshotPath = req.file ? req.file.path : null;
 
  if (useStar !== "true" && !screenshotPath) {
  return res.status(400).json({
    success: false,
    message: "Screenshot is required for AOMA approval.",
  });
}


    // Check if the lead is eligible
    const [leadResult] = await db.execute(
      `SELECT * FROM leads WHERE id = ? AND fetched_by = ? AND code_request_status = 'approved'`,
      [leadId, rmId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Lead not found or not approved for Code.",
      });
    }

    const lead = leadResult[0];

    // Delete old screenshot if exists
    if (lead.aoma_screenshot && fs.existsSync(lead.aoma_screenshot)) {
      fs.unlinkSync(lead.aoma_screenshot);
    }

    if (useStar==="true") {
      // Check if RM has available stars
      const [[{ aoma_stars }]] = await db.execute(
        'SELECT aoma_stars FROM users WHERE id = ?',
        [rmId]
      );

      if (aoma_stars < 1) {
        return res.status(400).json({
          success: false,
          message: "Insufficient AOMA stars for auto-approval.",
        });
      }

      // Deduct one star
      await db.execute(
        'UPDATE users SET aoma_stars = aoma_stars - 1 WHERE id = ?',
        [rmId]
      );

      // Credit wallet points
      const [pointResult] = await db.execute(
        'SELECT points FROM conversion_points WHERE action = "aoma_approved"'
      );

      const pointsToCredit = pointResult[0]?.points || 0;

      await db.execute(
        'UPDATE users SET wallet = wallet + ? WHERE id = ?',
        [pointsToCredit, rmId]
      );

      await db.execute(
        'INSERT INTO wallet_transactions (user_id, lead_id, action, points) VALUES (?, ?, ?, ?)',
        [rmId, leadId, 'aoma_approved', pointsToCredit]
      );

      // Update lead as auto-approved
      await db.execute(
        `UPDATE leads 
         SET aoma_request_status = 'approved',
             aoma_requested_at = NOW(),
             aoma_approved_at = NOW(),
             aoma_screenshot = ?,
             aoma_auto_approved_by_star = TRUE
         WHERE id = ?`,
        [screenshotPath, leadId]
      );

      return res.json({
        success: true,
        message: "AOMA request auto-approved using 1 star. Points credited.",
      });

    } else {
      // Normal request flow
      await db.execute(
        `UPDATE leads 
         SET aoma_request_status = 'requested', 
             aoma_requested_at = NOW(), 
             aoma_screenshot = ? 
         WHERE id = ?`,
        [screenshotPath, leadId]
      );

      return res.json({
        success: true,
        message: "AOMA approval request sent to admin.",
      });
    }

  } catch (err) {
    console.error("Error requesting AOMA approval:", err);
    res.status(500).json({
      success: false,
      error: err.message || "An error occurred while requesting AOMA approval.",
    });
  }
};


//activation approval request
exports.requestActivationApproval = async (req, res) => {
  const leadId = req.params.leadId;
  const rmId = req.user.id;
  const { useStar } = req.body; // Expecting true or false
  const screenshotPath = req.file ? req.file.path : null;
  console.log("Printing star from", useStar)

if (useStar !== "true" && !screenshotPath) {
  return res.status(400).json({
    success: false,
    message: "Screenshot is required for Activation approval.",
  });
}


  try {
    // Check lead belongs to RM & is AOMA approved
    const [leadResult] = await db.execute(
      'SELECT * FROM leads WHERE id=? AND fetched_by=? AND aoma_request_status="approved"',
      [leadId, rmId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Lead not found or not in AOMA approved state.",
      });
    }

    const lead = leadResult[0];

    // Delete old screenshot if exists
    if (lead.activation_screenshot && fs.existsSync(lead.activation_screenshot)) {
      fs.unlinkSync(lead.activation_screenshot);
    }
//     const [[{ aoma_auto_approved_by_star }]] = await db.execute(
//   'SELECT aoma_auto_approved_by_star FROM leads WHERE id = ?',
//   [leadId]
// );

// if (aoma_auto_approved_by_star && useStar === "true") {
//   return res.status(400).json({
//     success: false,
//     message: "You cannot use a star for Activation on a lead that was AOMA auto-approved using a star.",
//   });
// }

    if (useStar === "true") {
      // Check if RM has available stars
      const [[{ activation_stars }]] = await db.execute(
        'SELECT activation_stars FROM users WHERE id = ?',
        [rmId]
      );

      if (activation_stars < 1) {
        return res.status(400).json({
          success: false,
          message: "Insufficient Activation stars for auto-approval.",
        });
      }

      // Deduct one star
      await db.execute(
        'UPDATE users SET activation_stars = activation_stars - 1 WHERE id = ?',
        [rmId]
      );

      // Credit wallet points
      const [pointResult] = await db.execute(
        'SELECT points FROM conversion_points WHERE action = "activation_approved"'
      );

      const pointsToCredit = pointResult[0]?.points || 0;

      await db.execute(
        'UPDATE users SET wallet = wallet + ? WHERE id = ?',
        [pointsToCredit, rmId]
      );

      await db.execute(
        'INSERT INTO wallet_transactions (user_id, lead_id, action, points) VALUES (?, ?, ?, ?)',
        [rmId, leadId, 'activation_approved', pointsToCredit]
      );

      // Update lead as auto-approved
      await db.execute(
        `UPDATE leads 
         SET activation_request_status = 'approved',
             activation_approved_at = NOW(),
             activation_screenshot = ? 
         WHERE id = ?`,
        [screenshotPath, leadId]
      );

      return res.json({
        success: true,
        message: "Activation request auto-approved using 1 star. Points credited.",
      });

    } else {
      // Normal request flow (goes to admin)
      await db.execute(
        `UPDATE leads 
         SET activation_request_status = 'requested', 
             activation_requested_at = NOW(), 
             activation_screenshot = ? 
         WHERE id = ?`,
        [screenshotPath, leadId]
      );

      return res.json({
        success: true,
        message: "Activation approval request sent to admin.",
      });
    }

  } catch (error) {
    console.error('Error requesting Activation approval:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while requesting Activation approval.',
    });
  }
};



//ms team login request approval
exports.requestMsTeamsLogin = async (req, res) => {
  const leadId = req.params.leadId;
  const rmId = req.user.id;
  const screenshotPath = req.file ? req.file.path : null;

  if (!screenshotPath) {
    return res.status(400).json({
      success: false,
      message: "Screenshot is required for MS Teams login request.",
    });
  }

  try {
    // Ensure the lead is Code Approved and fetched by this RM
    const [leadResult] = await db.execute(
      `SELECT * FROM leads WHERE id = ? AND fetched_by = ? AND code_request_status = 'approved'`,
      [leadId, rmId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Lead not found or not eligible for MS Teams login request.",
      });
    }

    // Delete the old MS Teams screenshot if it exists
    const oldScreenshotPath = leadResult[0].ms_teams_screenshot;
    if (oldScreenshotPath && fs.existsSync(oldScreenshotPath)) {
      fs.unlinkSync(oldScreenshotPath);
    }

    // Update lead with new screenshot and request status
    await db.execute(
      `UPDATE leads SET 
        ms_teams_screenshot = ?, 
        ms_teams_request_status = 'requested', 
        ms_teams_login_requested_at = NOW()
       WHERE id = ?`,
      [screenshotPath, leadId]
    );

    res.json({
      success: true,
      message: 'MS Teams Login request successfully sent to admin.',
    });

  } catch (error) {
    console.error('Error requesting MS Teams login:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while requesting MS Teams login.',
    });
  }
};



//Request sip interest
exports.requestSipInterest = async (req, res) => {
  const { leadId } = req.params;
  const rmId = req.user.id;

  try {
    const [leadResult] = await db.execute(
      'SELECT * FROM leads WHERE id = ? AND fetched_by = ? AND code_request_status = "approved"',
      [leadId, rmId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found or not approved for Under Us' });
    }
    await db.execute(
      `UPDATE leads SET 
        sip_request_status = 'requested', 
        sip_requested_at = NOW()
      WHERE id = ?`,
      [leadId]
    );

    res.json({ success: true, message: 'SIP Interest Request sent.' });
  } catch (err) {
    console.error('Error sending SIP request:', err);
    res.status(500).json({ success: false, message: 'Server error while sending SIP request.' });
  }
};

//delete lead
// exports.deleteLead = async (req, res) => {
// const { leadId } = req.params; // Assuming the lead ID is passed in the URL
// const  rmId  = req.user.id; // Assuming the RM ID is passed in the request body

// if (!leadId || !rmId) {
//   return res.status(400).json({
//     success: false,
//     message: "Lead ID or RM ID is missing."
//   });
// }
//   try {
//     // Check if lead exists and if RM has fetched this lead
//     const [check] = await db.execute(`
//       SELECT under_us_status FROM leads WHERE id = ? AND fetched_by = ?
//     `, [leadId, rmId]);

//     if (check.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Lead not found or not authorized."
//       });
//     }

//     const currentStatus = check[0].under_us_status;

//     // Check if lead is in a status where deletion is allowed
//     if (["pending", "approved"].includes(currentStatus)) {
//       return res.status(400).json({
//         success: false,
//         message: `Lead cannot be deleted because it has a status of '${currentStatus}'.`
//       });
//     }

//     // Proceed to delete the lead if status is not one of the above
//     const [result] = await db.execute(`
//       DELETE FROM leads WHERE id = ? AND fetched_by = ?
//     `, [leadId, rmId]);

//     // Double-checking affectedRows (should be 1)
//     if (result.affectedRows === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Lead not found or you're not authorized to delete it."
//       });
//     }

//     // Success response
//     res.status(200).json({
//       success: true,
//       message: "Lead deleted successfully."
//     });
//   } catch (error) {
//     console.error("Error deleting lead:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };
exports.deleteLead = async (req, res) => {
  const { leadId } = req.params;
  const rmId = req.user.id;

  if (!leadId || !rmId) {
    return res.status(400).json({
      success: false,
      message: "Lead ID or RM ID is missing."
    });
  }

  try {
    // Check if the lead is assigned to this RM and get its code_approved_status
    const [check] = await db.execute(`
      SELECT id, code_request_status FROM leads WHERE id = ? AND fetched_by = ?
    `, [leadId, rmId]);

    if (check.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Lead not found or not assigned to you."
      });
    }

    const lead = check[0];

    // Don't allow deletion if code is already approved
    if (lead.code_request_status === 'approved') {
      return res.status(403).json({
        success: false,
        message: "Cannot delete this lead because it is already Code Approved."
      });
    }

    // Remove the RM assignment from the lead
    await db.execute(`
      UPDATE leads SET fetched_by = -1, fetched_at = NULL WHERE id = ? AND fetched_by = ?
    `, [leadId, rmId]);

    res.status(200).json({
      success: true,
      message: "Lead successfully removed from your list."
    });
  } catch (error) {
    console.error("Error removing lead from RM:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};







//underus approved
exports.fetchLeadsUnderUsapproved = async (req, res) => {
  try {
    const rmId = req.user.id; // Assuming rmId comes from the authenticated user

    // Get page, limit, and search query from the request parameters
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 5;
    const offset = (page - 1) * limit;
    const search = req.query.search || ""; // Search query for filtering leads

    // Base query components
    const baseQuery = `FROM leads`;
    let whereClause = `
      WHERE fetched_by = ? 
      AND under_us_status = ? 
      AND deleted_by_rm = 0 
      AND (code_request_status IS NULL OR code_request_status != 'approved')
    `;
    const queryParams = [rmId, "approved"];

    // Add search conditions if a search query is provided
    if (search) {
      whereClause += `
        AND (
          LOWER(name) LIKE ? 
          OR LOWER(mobile_number) LIKE ? 
          OR CAST(id AS CHAR) LIKE ?
        )
      `;
      const keyword = `%${search.toLowerCase()}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    // Count query to get total approved leads excluding code_request_status "approved"
    const [countResult] = await db.execute(
      `SELECT COUNT(*) AS total ${baseQuery}${whereClause}`,
      queryParams
    );
    const totalApprovedLeads = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalApprovedLeads / limit);

    // Fetch query to get paginated approved leads excluding code_request_status "approved"
    const fetchQuery = `
      SELECT * 
      ${baseQuery}${whereClause} 
      ORDER BY fetched_at DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;
    const [underUsApproved] = await db.execute(fetchQuery, queryParams);

    // If no approved leads are found, return a 404 response
    if (underUsApproved.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No approved leads found for this RM.",
      });
    }

    // Return a successful response with approved leads data
    return res.status(200).json({
      success: true,
      message: "Approved RM Leads fetched successfully.",
      totalApprovedLeads,
      underUsApproved,
      totalPages,
      currentPage: page,
      perPage: limit,
    });
  } catch (error) {
    console.error("Error fetching approved leads:", error);
    // Handle unexpected errors and return a 500 response
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

//Coded approved
// Code Approved - Visible only for 20 days after code_approved_at
exports.fetchCodeApprovedLeads = async (req, res) => {
  try {
    const rmId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 5;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    const baseQuery = `FROM leads`;
    let whereClause = `
      WHERE fetched_by = ? 
      AND code_request_status = 'approved' 
      AND (aoma_request_status IS NULL OR aoma_request_status != 'approved')
      AND code_approved_at >= NOW() - INTERVAL 14 DAY
    `;
    const queryParams = [rmId];

    if (search) {
      whereClause += `
        AND (
          LOWER(name) LIKE ? 
          OR LOWER(mobile_number) LIKE ? 
          OR CAST(id AS CHAR) LIKE ?
        )
      `;
      const keyword = `%${search.toLowerCase()}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    const [totalResult] = await db.execute(
      `SELECT COUNT(*) as total ${baseQuery} ${whereClause}`,
      queryParams
    );
    const totalCodedLeads = totalResult[0]?.total || 0;
    const totalPages = Math.ceil(totalCodedLeads / limit);

    const fetchQuery = `
      SELECT * 
      ${baseQuery} ${whereClause} 
      ORDER BY fetched_at ASC 
      LIMIT ${limit} OFFSET ${offset}
    `;
    const [codedApproved] = await db.execute(fetchQuery, queryParams);

    if (codedApproved.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No Code Approved leads found within 20 days.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Code Approved leads (within 20 days) fetched successfully.",
      codedApproved,
      totalCodedLeads,
      totalPages,
      currentPage: page,
      perPage: limit,
    });
  } catch (error) {
    console.error("Error fetching Code Approved leads:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};



// AOMA approved 
exports.fetchAOMAApprovedLeads = async (req, res) => {
  try {
    const rmId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 5;
    const offset = (page - 1) * limit;
    const search = req.query.search || ""; // Search query for filtering leads

    // Base query components
    const baseQuery = `FROM leads`;
    let whereClause = `
      WHERE fetched_by = ? 
      AND aoma_request_status = 'approved' 
      AND (activation_request_status IS NULL OR activation_request_status != 'approved')
      AND code_approved_at >= NOW() - INTERVAL 14 DAY
    `;
    const queryParams = [rmId];

    // Add search conditions if a search query is provided
    if (search) {
      whereClause += `
        AND (
          LOWER(name) LIKE ? 
          OR LOWER(mobile_number) LIKE ? 
          OR CAST(id AS CHAR) LIKE ?
        )
      `;
      const keyword = `%${search.toLowerCase()}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    // Count query to get total approved leads
    const [totalResult] = await db.execute(
      `SELECT COUNT(*) as total ${baseQuery}${whereClause}`,
      queryParams
    );
    const totalAomaLeads = totalResult[0]?.total || 0;
    const totalPages = Math.ceil(totalAomaLeads / limit);

    // Fetch query to get paginated approved leads
    const fetchQuery = `
      SELECT * 
      ${baseQuery}${whereClause} 
      ORDER BY fetched_at DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;
    const [aomaApproved] = await db.execute(fetchQuery, queryParams);

    // If no approved leads are found, return a 404 response
    if (aomaApproved.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No AOMA Approved leads found for this RM.",
      });
    }

    // Return a successful response with approved leads data
    return res.status(200).json({
      success: true,
      message: "AOMA Approved leads fetched successfully.",
      aomaApproved,
      totalAomaLeads,
      totalPages,
      currentPage: page,
      perPage: limit,
    });
  } catch (error) {
    console.error("Error fetching AOMA Approved leads:", error);
    // Handle unexpected errors and return a 500 response
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};



//feth Activation approved list
exports.fetchActivationApprovedLeads = async (req, res) => {
  try {
    const rmId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 5;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    // Base query
    const baseQuery = `FROM leads`;
    let whereClause = ` WHERE fetched_by = ? 
                    AND activation_request_status = 'approved'
                    AND activation_approved_at IS NOT NULL
                    AND code_approved_at >= NOW() - INTERVAL 14 DAY`;

    const queryParams = [rmId];

    // Optional search filter
    if (search) {
      whereClause += ` AND (LOWER(name) LIKE ? 
                            OR LOWER(mobile_number) LIKE ? 
                            OR CAST(id AS CHAR) LIKE ?)`;
      const keyword = `%${search.toLowerCase()}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    // Count query
    const [totalResult] = await db.execute(
      `SELECT COUNT(*) as total ${baseQuery}${whereClause}`,
      queryParams
    );
    const totalActivationLeads = totalResult[0]?.total || 0;
    const totalPages = Math.ceil(totalActivationLeads / limit);

    // Fetch paginated leads
    const fetchQuery = `SELECT * ${baseQuery}${whereClause} 
                        ORDER BY activation_approved_at DESC 
                        LIMIT ${limit} OFFSET ${offset}`;
    const [activationApproved] = await db.execute(fetchQuery, queryParams);

    if (activationApproved.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No Activation Approved leads found for this RM.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Activation Approved leads fetched successfully.",
      activationApproved,
      totalActivationLeads,
      totalPages,
      currentPage: page,
      perPage: limit,
    });
  } catch (error) {
    console.error("Error fetching Activation Approved leads:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};



//fetch ms teams approved list
exports.fetchMsTeamsApprovedLeads = async (req, res) => {
  try {
    const rmId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 5;
    const offset = (page - 1) * limit;
    const search = req.query.search || ""; // Search query for filtering leads

    // Base query components
    const baseQuery = `FROM leads`;
   let whereClause = ` WHERE fetched_by = ? AND code_request_status = 'approved'
    AND ms_details_sent = 'approved'

     AND (ms_teams_request_status IS NULL OR ms_teams_request_status != 'approved')
      AND code_approved_at >= NOW() - INTERVAL 14 DAY`;

    const queryParams = [rmId];

    // Add search conditions if a search query is provided
    if (search) {
      whereClause += ` AND (LOWER(name) LIKE ? OR LOWER(mobile_number) LIKE ? OR CAST(id AS CHAR) LIKE ?)`;
      const keyword = `%${search.toLowerCase()}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    // Count query to get total MS Teams or SIP approved leads
    const [totalResult] = await db.execute(
      `SELECT COUNT(*) as total ${baseQuery}${whereClause}`,
      queryParams
    );
    const totalMsTeamsLeads = totalResult[0]?.total || 0;
    const totalPages = Math.ceil(totalMsTeamsLeads / limit);

    // Fetch query to get paginated MS Teams or SIP approved leads
    const fetchQuery = `SELECT * ${baseQuery}${whereClause} ORDER BY code_approved_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const [msTeamsApproved] = await db.execute(fetchQuery, queryParams);

    // If no approved leads are found, return a 404 response
    if (msTeamsApproved.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No MS Teams or SIP approved leads found for this RM.",
      });
    }

    // Return a successful response with approved leads data
    return res.status(200).json({
      success: true,
      message: "MS Teams or SIP approved leads fetched successfully.",
      msTeamsApproved,
      totalMsTeamsLeads,
      totalPages,
      currentPage: page,
      perPage: limit,
    });
  } catch (error) {
    console.error("Error fetching MS Teams or SIP approved leads:", error);
    // Handle unexpected errors and return a 500 response
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
//fetch sip  approved list
exports.fetchSipApprovedLeads = async (req, res) => {
  try {
    const rmId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 5;
    const offset = (page - 1) * limit;
    const search = req.query.search || ""; // Search query for filtering leads

    // Base query components
    const baseQuery = `FROM leads`;
   let whereClause = ` WHERE fetched_by = ? AND code_request_status = 'approved' 
   AND (sip_request_status IS NULL OR sip_request_status != 'approved')
    AND code_approved_at >= NOW() - INTERVAL 14 DAY`;
    const queryParams = [rmId];

    // Add search conditions if a search query is provided
    if (search) {
      whereClause += ` AND (LOWER(name) LIKE ? OR LOWER(mobile_number) LIKE ? OR CAST(id AS CHAR) LIKE ?)`;
      const keyword = `%${search.toLowerCase()}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    // Count query to get total SIP approved leads
    const [totalResult] = await db.execute(
      `SELECT COUNT(*) as total ${baseQuery}${whereClause}`,
      queryParams
    );
    const totalSipLeads = totalResult[0]?.total || 0;
    const totalPages = Math.ceil(totalSipLeads / limit);

    // Fetch query to get paginated SIP approved leads
    const fetchQuery = `SELECT * ${baseQuery}${whereClause} ORDER BY code_approved_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const [sipApproved] = await db.execute(fetchQuery, queryParams);

    // If no approved leads are found, return a 404 response
    if (sipApproved.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No SIP approved leads found for this RM.",
      });
    }

    // Return a successful response with approved leads data
    return res.status(200).json({
      success: true,
      message: "SIP approved leads fetched successfully.",
      sipApproved,
      totalSipLeads,
      totalPages,
      currentPage: page,
      perPage: limit,
    });
  } catch (error) {
    console.error("Error fetching SIP approved leads:", error);
    // Handle unexpected errors and return a 500 response
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};



exports.LeadDeleteToAdmin = async (req, res) => {
  try {
    const { leadId  } = req.params;
    const { name, mobile_number, whatsapp_number} = req.body
    const rmId = req.user.id;

    // Check if the lead belongs to the RM
    const [leadResult] = await db.execute(
      `SELECT * FROM leads WHERE id=? AND fetched_by=?`,
      [leadId, rmId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found or unauthorized' });
    }

    // Move the lead to the admin delete list (or mark it as deleted)
    await db.execute(
      `INSERT INTO admin_delete_list (lead_id, deleted_by_rm, name, mobile_number, whatsapp_number, deleted_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [leadId, rmId, name, mobile_number, whatsapp_number]
    );

    // Optionally, update the lead's status to indicate it's marked for deletion
    await db.execute(
      `UPDATE leads SET deleted_by_rm=1 WHERE id=?`,
      [leadId]
    );

    res.json({ success: true, message: 'Lead marked for deletion and sent to admin delete list' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.fetchStars = async (req, res) => {
  try {
    const rmId = req.user.id;

    if (!rmId) {
      return res.status(404).json({
        success: false,
        message: "RM id not found",
      });
    }

    const [aomaResult] = await db.execute(
      'SELECT aoma_stars FROM users WHERE id = ?',
      [rmId]
    );
    const [activationResult] = await db.execute(
      'SELECT activation_stars FROM users WHERE id = ?',
      [rmId]
    );

    return res.status(200).json({
      success: true,
      message: "Stars fetched successfully",
      aoma_stars: aomaResult[0]?.aoma_stars || 0,
      activation_stars: activationResult[0]?.activation_stars || 0,
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

//RM Dashboard 
exports.referOldLead = async (req, res) => {
  try {
    const {
      account_opening_name,
      mobile_number,
      whatsapp_number,
      client_code,
      batch_type,
     
    } = req.body;
    const rmId = req.user.id;

    // Check for missing fields
    if (
      !account_opening_name ||
      !mobile_number ||
      !whatsapp_number ||
      !client_code ||
      !batch_type
     
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Validate mobile number
    const numberOnlyRegex = /^\d+$/;
    if (!numberOnlyRegex.test(mobile_number)) {
      return res.status(400).json({
        success: false,
        message: "Only numbers are allowed in mobile number."
      });
    }

    // Check if mobile number already exists
    const [existingLead] = await db.execute(
      `SELECT id FROM advance_batch WHERE mobile_number = ?`,
      [mobile_number]
    );

    if (existingLead.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Mobile Number already exists.",
      });
    }

    // Insert new lead
    await db.execute(
      `INSERT INTO advance_batch 
        (account_opening_name, mobile_number, whatsapp_number, client_code,refer_by,batch_type,  referred_at, old_client_refer_status, old_code_request_status)
       VALUES (?, ?, ?, ?, ?,?, NOW(), 'requested','pending')`,
      [account_opening_name, mobile_number, whatsapp_number, client_code, rmId, batch_type]
    );

    // Success response
    return res.status(200).json({
      success: true,
      message: "Lead referred successfully.",
    });

  } catch (error) {
    console.error("Error in referOldLead:", error);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};


exports.referOldLeadList = async (req, res) => {
  try {
    const rmId = req.user.id;

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    // Base query setup
    let baseQuery = `FROM advance_batch`;
     let whereClause = `
    WHERE refer_by = ? 
      AND old_code_request_status != 'approved'
  `;
    const queryParams = [rmId];

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

    // Count query
    const [countResult] = await db.execute(
      `SELECT COUNT(*) AS total ${baseQuery} ${whereClause}`,
      queryParams
    );
    const totalReferOldList = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalReferOldList / limit);

    // Fetch paginated results
    const fetchQuery = `
      SELECT * ${baseQuery} ${whereClause}
      ORDER BY referred_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const [referOldLeads] = await db.execute(fetchQuery, queryParams);

    if (referOldLeads.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No refer leads found.",
      });
    }

    // Success
    return res.status(200).json({
      success: true,
      message: "Refer leads fetched successfully.",
      totalReferOldList,
      referOldLeads,
      totalPages,
      currentPage: page,
      perPage: limit,
    });

  } catch (error) {
    console.error("Error fetching refer leads:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};



//Old Basic Batch Client Ms Teams Id Pass 
exports.oldBasicMsTeamsClientsList = async (req, res) => {
  try {
    const rmId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    let baseQuery = `FROM advance_batch`;
    let whereClause = `
      WHERE refer_by = ?
      AND old_code_request_status = 'approved'
      AND old_basic_ms_clients_msdetails = 'approved'
      AND basic_call_connect ='no'
     AND batch_type IN ('basic', 'both')
    `;
    const queryParams = [rmId];

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
    const [countResult] = await db.execute(
      `SELECT COUNT(*) AS total ${baseQuery} ${whereClause}`,
      queryParams
    );
    const totalOldBasicBatchList = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalOldBasicBatchList / limit);

    // Fetch paginated results
    const fetchQuery = `
      SELECT * ${baseQuery} ${whereClause}
      ORDER BY referred_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const [oldBasicBatch] = await db.execute(fetchQuery, queryParams);

    if (oldBasicBatch.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No approved  leads found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Approved old refer leads fetched successfully.",
      totalOldBasicBatchList,
      oldBasicBatch,
      totalPages,
      currentPage: page,
      perPage: limit,
    });

  } catch (error) {
    console.error("Error fetching approved old refer leads:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


//Old Advance Batch Client Ms Teams Id Pass 
exports.oldAdvaceBatchMsTeamsClientsList = async (req, res) => {
  try {
    const rmId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    let baseQuery = `FROM advance_batch`;
    let whereClause = `
  WHERE refer_by = ?
  AND old_code_request_status = 'approved'
  AND advance_ms_clients_msdetails = 'approved'
  AND advance_call_connect ='no'
  AND batch_type IN ('advance', 'both')
`;
    const queryParams = [rmId];

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
    const [countResult] = await db.execute(
      `SELECT COUNT(*) AS total ${baseQuery} ${whereClause}`,
      queryParams
    );
    const totalOldAdvanceBatchList = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalOldAdvanceBatchList / limit);

    // Fetch paginated results
    const fetchQuery = `
      SELECT * ${baseQuery} ${whereClause}
      ORDER BY referred_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const [oldAdvanceBatch] = await db.execute(fetchQuery, queryParams);

    if (oldAdvanceBatch.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No approved  leads found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Approved Advance Batch fetched successfully.",
      totalOldAdvanceBatchList,
      oldAdvanceBatch,
      totalPages,
      currentPage: page,
      perPage: limit,
    });

  } catch (error) {
    console.error("Error fetching Advance Batch leads:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


//ALL Old Batch Clients
exports.oldBatchMsTeamsAllClientsList = async (req, res) => {
  try {
    const rmId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    let baseQuery = `FROM advance_batch`;
    let whereClause = `
  WHERE refer_by = ?
  AND old_code_request_status = 'approved'
  AND batch_type IN ('advance','basic', 'both')
`;
    const queryParams = [rmId];

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
    const [countResult] = await db.execute(
      `SELECT COUNT(*) AS total ${baseQuery} ${whereClause}`,
      queryParams
    );
    const totalClientsBatchList = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalClientsBatchList / limit);

    // Fetch paginated results
    const fetchQuery = `
      SELECT * ${baseQuery} ${whereClause}
      ORDER BY referred_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const [allBatchClients] = await db.execute(fetchQuery, queryParams);

    if (allBatchClients.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No Clients found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: " All Clients fetched successfully.",
      totalClientsBatchList,
      allBatchClients,
      totalPages,
      currentPage: page,
      perPage: limit,
    });

  } catch (error) {
    console.error("Error fetching All Clients:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


//New Clients for call after basic_ms details send
exports.NewMsClientsForCallList = async (req, res) => {
  try {
    const rmId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 5;
    const offset = (page - 1) * limit;
    const search = req.query.search || ""; // Search query for filtering leads

    // Base query components
    const baseQuery = `FROM leads`;  //AND new_clinet_call_status IS NULL
      let whereClause = `
        WHERE assigned_to = ? 
        AND code_request_status = 'approved' 
        AND new_clinet_call_status IS NULL
        
      `;

      const queryParams = [rmId];


    // Add search conditions if a search query is provided
    if (search) {
      whereClause += ` AND (LOWER(name) LIKE ? OR LOWER(mobile_number) LIKE ? OR CAST(id AS CHAR) LIKE ?)`;
      const keyword = `%${search.toLowerCase()}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    // Count query to get total MS Teams or SIP approved leads
    const [totalResult] = await db.execute(
      `SELECT COUNT(*) as total ${baseQuery}${whereClause}`,
      queryParams
    );
    const totalNewClientForCall = totalResult[0]?.total || 0;
    const totalPages = Math.ceil(totalNewClientForCall / limit);

    // Fetch query to get paginated MS Teams or SIP approved leads
    const fetchQuery = `SELECT * ${baseQuery}${whereClause} ORDER BY code_approved_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const [newClientForCall] = await db.execute(fetchQuery, queryParams);

    // If no approved leads are found, return a 404 response
    if (newClientForCall.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No Clients Found",
      });
    }

    // Return a successful response with approved leads data
    return res.status(200).json({
      success: true,
      message: "New Client For Call Fetch Successfully.",
      newClientForCall,
      totalNewClientForCall,
      totalPages,
      currentPage: page,
      perPage: limit,
    });
  } catch (error) {
    console.error("Error fetching new clients for call:", error);
    // Handle unexpected errors and return a 500 response
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.checkOldMobileNumber = async (req, res) => {
    try {
      const { mobile_number } = req.body;
  
      if (!mobile_number) {
        return res.status(400).json({ message: 'Mobile number is required.' });
      }
  
      // Validate: only digits allowed
      const numberOnlyRegex = /^\d+$/;
      if (!numberOnlyRegex.test(mobile_number)) {
        return res.status(400).json({ message: 'Only numbers are allowed in mobile number.' });
      }
  
      // Check if mobile_number exists
      const [existingLead] = await db.execute('SELECT id FROM advance_batch WHERE mobile_number = ?', [mobile_number]);
  
      if (existingLead.length > 0) {
        return res.status(200).json({ exists: true, message: 'Number Already Exists.' });
      }
  
      res.status(200).json({ exists: false, message: 'Number is available.' });
  
    } catch (error) {
      console.error('Error in checkMobileNumber:', error);
      res.status(500).json({ message: 'Something went wrong.' });
    }
  };


//request for oldcode approval
exports.requestOldCodeApproval = async (req, res) => {
  try {
    const { leadId } = req.body;
    // Check lead belongs to RM & is under_us_approved
    const [leadResult] = await db.execute(
      `SELECT * FROM advance_batch WHERE id=? AND old_client_refer_status='requested'`,
      [leadId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found or not approved ' });
    }

   await db.execute(
  `UPDATE advance_batch 
   SET old_code_request_status = 'requested',
       old_code_requested_at = NOW()
   WHERE id = ?`,
  [leadId]
);


    res.json({ success: true, message: 'Code approval request sent to admin' });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};



//Basic Batch Call Done
exports.basicBAtchCallDone = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { action } = req.body;

    // Validate input parameters
    if (!leadId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid parameters' });
    }

    // Check if lead exists and is code approved
    const [leadResult] = await db.execute(
      'SELECT * FROM advance_batch WHERE id = ? AND old_code_request_status = "approved"',
      [leadId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found or not code approved.' });
    }

    // Perform the update based on action
    if (action === 'approve') {
      await db.execute(
        'UPDATE advance_batch SET basic_call_connect = "yes" WHERE id = ?',
        [leadId]
      );
      return res.status(200).json({ success: true, message: 'Call marked as done' });

    } else if (action === 'reject') {
      await db.execute(
        'UPDATE advance_batch SET basic_call_connect = "no" WHERE id = ?',
        [leadId]
      );
      return res.status(200).json({ success: true, message: 'Marked as not connected' });
    }

  } catch (error) {
    console.error('Error handling Request:', error);
    res.status(500).json({ success: false, message: 'Server error while processing request.', error: error.message });
  }
};

//ADVANCE BATCH CALL dONE
exports.advanceBatchCallDone = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { action } = req.body;

    // Validate input parameters
    if (!leadId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid parameters' });
    }

    // Check if lead exists and is code approved
    const [leadResult] = await db.execute(
      'SELECT * FROM advance_batch WHERE id = ? AND old_code_request_status = "approved"',
      [leadId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found or not code approved.' });
    }

    // Perform the update based on action
    if (action === 'approve') {
      await db.execute(
        'UPDATE advance_batch SET advance_call_connect = "yes" WHERE id = ?',
        [leadId]
      );
      return res.status(200).json({ success: true, message: 'Advance Call marked as done' });

    } else if (action === 'reject') {
      await db.execute(
        'UPDATE advance_batch SET advance_call_connect = "no" WHERE id = ?',
        [leadId]
      );
      return res.status(200).json({ success: true, message: 'Advance Call marked as not connected' });
    }

  } catch (error) {
    console.error('Error handling Advance Call Request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing advance call status.',
      error: error.message
    });
  }
};



//NEW CLIENTS FOR CALL DONE ====SAVE BUTTON
exports.NewClientCallDone = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { action } = req.body;

    // Validate input parameters
    if (!leadId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid parameters' });
    }

    // Check if lead exists and is code approved
    const [leadResult] = await db.execute(
      'SELECT * FROM leads WHERE id = ? AND code_request_status = "approved"',
      [leadId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found or not code approved.' });
    }

    // Perform the update based on action
    if (action === 'approve') {
      await db.execute(
        'UPDATE leads SET new_clinet_call_status = "yes" WHERE id = ?',
        [leadId]
      );
      return res.status(200).json({ success: true, message: 'Call Done' });

    } else if (action === 'reject') {
      await db.execute(
        'UPDATE leads SET new_clinet_call_status = "no" WHERE id = ?',
        [leadId]
      );
      return res.status(200).json({ success: true, message: ' Call marked as not connected' });
    }

  } catch (error) {
    console.error('Error handling Advance Call Request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing advance call status.',
      error: error.message
    });
  }
};

//New Basic Ms Teams Clients 
exports.jrmBasicMsTeamsClients = async (req, res) => {
  try {
    const rmId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 5;
    const offset = (page - 1) * limit;
    const search = req.query.search || ""; // Search query for filtering leads

    // Base query components
    const baseQuery = `FROM leads`;
      let whereClause = `
        WHERE assigned_to = ? 
        AND code_request_status = 'approved' 
        AND ms_details_sent  = 'approved'
        AND jrm_lead_basic_call_connect IS NULL
      `;

      const queryParams = [rmId];


    // Add search conditions if a search query is provided
    if (search) {
      whereClause += ` AND (LOWER(name) LIKE ? OR LOWER(mobile_number) LIKE ? OR CAST(id AS CHAR) LIKE ?)`;
      const keyword = `%${search.toLowerCase()}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    // Count query to get total MS Teams or SIP approved leads
    const [totalResult] = await db.execute(
      `SELECT COUNT(*) as total ${baseQuery}${whereClause}`,
      queryParams
    );
    const TotalrmBasicMsTeamsClients = totalResult[0]?.total || 0;
    const totalPages = Math.ceil(TotalrmBasicMsTeamsClients / limit);

    // Fetch query to get paginated MS Teams or SIP approved leads
    const fetchQuery = `SELECT * ${baseQuery}${whereClause} ORDER BY code_approved_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const [rmBasicMsTeamsClients] = await db.execute(fetchQuery, queryParams);

    // If no approved leads are found, return a 404 response
    if (rmBasicMsTeamsClients.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No MS Teams or SIP approved leads found for this RM.",
      });
    }

    // Return a successful response with approved leads data
    return res.status(200).json({
      success: true,
      message: "Basic Ms-Teams leads fetched successfully.",
      rmBasicMsTeamsClients,
      TotalrmBasicMsTeamsClients,
      totalPages,
      currentPage: page,
      perPage: limit,
    });
  } catch (error) {
    console.error("Error fetching Basic Ms-Teams  leads:", error);
    // Handle unexpected errors and return a 500 response
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

//New Advance Ms Teams Clients 
exports.rmAdvanceMsTeamsClients = async (req, res) => {
  try {
    const rmId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 5;
    const offset = (page - 1) * limit;
    const search = req.query.search || ""; // Search query for filtering leads

    // Base query components
    const baseQuery = `FROM leads`;
      let whereClause = `
        WHERE assigned_to = ? 
        AND code_request_status = 'approved' 
        AND  advance_msteams_details_sent = 'approved'
        AND  jrm_lead_advance_call_connect IS NULL
      `;

      const queryParams = [rmId];


    // Add search conditions if a search query is provided
    if (search) {
      whereClause += ` AND (LOWER(name) LIKE ? OR LOWER(mobile_number) LIKE ? OR CAST(id AS CHAR) LIKE ?)`;
      const keyword = `%${search.toLowerCase()}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    // Count query to get total MS Teams or SIP approved leads
    const [totalResult] = await db.execute(
      `SELECT COUNT(*) as total ${baseQuery}${whereClause}`,
      queryParams
    );
    const totalrmAdvanceMsTeamsClients = totalResult[0]?.total || 0;
    const totalPages = Math.ceil(totalrmAdvanceMsTeamsClients / limit);

    // Fetch query to get paginated MS Teams or SIP approved leads
    const fetchQuery = `SELECT * ${baseQuery}${whereClause} ORDER BY code_approved_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const [rmAdvanceMsTeamsClients] = await db.execute(fetchQuery, queryParams);

    // If no approved leads are found, return a 404 response
    if (rmAdvanceMsTeamsClients.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No MS Teams  leads found for this RM.",
      });
    }

    // Return a successful response with approved leads data
    return res.status(200).json({
      success: true,
      message: "Advance Ms-Teams leads fetched successfully.",
      rmAdvanceMsTeamsClients,
      totalrmAdvanceMsTeamsClients,
      totalPages,
      currentPage: page,
      perPage: limit,
    });
  } catch (error) {
    console.error("Error fetching Basic Ms-Teams  leads:", error);
    // Handle unexpected errors and return a 500 response
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

//NEW CLIENTS RM BASIC CALL DONE
exports.newClientBasicMsCallDone= async (req, res) =>{
     try {
    const { leadId } = req.params;
    const { action } = req.body;

    // Validate input parameters
    if (!leadId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid parameters' });
    }

    // Check if lead exists and is code approved
    const [leadResult] = await db.execute(
      'SELECT * FROM leads WHERE id = ? AND code_request_status = "approved"',
      [leadId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found or not code approved.' });
    }

    // Perform the update based on action
    if (action === 'approve') {
      await db.execute(
        'UPDATE leads SET jrm_lead_basic_call_connect = "yes" WHERE id = ?',
        [leadId]
      );
      return res.status(200).json({ success: true, message: 'Call Done' });

    } else if (action === 'reject') {
      await db.execute(
        'UPDATE leads SET jrm_lead_basic_call_connect = "no" WHERE id = ?',
        [leadId]
      );
      return res.status(200).json({ success: true, message: ' Call marked as not connected' });
    }

  } catch (error) {
    console.error('Error handling Advance Call Request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing basic call status.',
      error: error.message
    });
  }
  

}


//NEW CLIENTS RM ADVANCE CALL DONE
exports.newClientAdvanceMsCallDone= async (req, res) =>{
     try {
    const { leadId } = req.params;
    const { action } = req.body;

    // Validate input parameters
    if (!leadId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid parameters' });
    }

    // Check if lead exists and is code approved
    const [leadResult] = await db.execute(
      'SELECT * FROM leads WHERE id = ? AND code_request_status = "approved"',
      [leadId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found or not code approved.' });
    }

    // Perform the update based on action
    if (action === 'approve') {
      await db.execute(
  'UPDATE leads SET jrm_lead_advance_call_connect = "yes" WHERE id = ?',
  [leadId]
);

      return res.status(200).json({ success: true, message: 'Call Done' });

    } else if (action === 'reject') {
      await db.execute(
        'UPDATE leads SET jrm_lead_advance_call_connect = "no" WHERE id = ?',
        [leadId]
      );
      return res.status(200).json({ success: true, message: ' Call marked as not connected' });
    }

  } catch (error) {
    console.error('Error handling Advance Call Request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing advance call status.',
      error: error.message
    });
  }
  

}




//My Clients for call after basic_ms details send
exports.jrmLeadsAllMyClients = async (req, res) => {
  try {
    const rmId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 5;
    const offset = (page - 1) * limit;
    const search = req.query.search || ""; // Search query for filtering leads

    // Base query components
    const baseQuery = `FROM leads`;
      let whereClause = `
        WHERE assigned_to = ? 
        AND code_request_status = 'approved' 
       
      `;

      const queryParams = [rmId];


    // Add search conditions if a search query is provided
    if (search) {
      whereClause += ` AND (LOWER(name) LIKE ? OR LOWER(mobile_number) LIKE ? OR CAST(id AS CHAR) LIKE ?)`;
      const keyword = `%${search.toLowerCase()}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    // Count query to get total MS Teams or SIP approved leads
    const [totalResult] = await db.execute(
      `SELECT COUNT(*) as total ${baseQuery}${whereClause}`,
      queryParams
    );
    const totalJrmLeadsAllMyClients = totalResult[0]?.total || 0;
    const totalPages = Math.ceil(totalJrmLeadsAllMyClients / limit);

    // Fetch query to get paginated MS Teams or SIP approved leads
    const fetchQuery = `SELECT * ${baseQuery}${whereClause} ORDER BY code_approved_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const [jrmLeadsAllMyClients] = await db.execute(fetchQuery, queryParams);

    // If no approved leads are found, return a 404 response
    if (jrmLeadsAllMyClients.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No Clients found.",
      });
    }

    // Return a successful response with approved leads data
    return res.status(200).json({
      success: true,
      message: "Clients fetched successfully.",
      jrmLeadsAllMyClients,
      totalJrmLeadsAllMyClients,
      totalPages,
      currentPage: page,
      perPage: limit,
    });
  } catch (error) {
    console.error("My clients:", error);
    // Handle unexpected errors and return a 500 response
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


//Adavance Batch Screeshot approval
exports.rmLeadsForMsTeamSsapprovl = async (req, res) => {
  try {
    const rmId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 5;
    const offset = (page - 1) * limit;
    const search = req.query.search || ""; // Search query for filtering leads

    // Base query components
    const baseQuery = `FROM leads`;
        let whereClause = `
          WHERE assigned_to = ? 
          AND code_request_status = 'approved' 
          AND advance_msteams_details_sent = 'approved'
          AND jrm_lead_advance_call_connect = 'yes'
          AND (advanced_ms_teams_request_status IS NULL OR advanced_ms_teams_request_status != 'approved')
        `;


      const queryParams = [rmId];


    // Add search conditions if a search query is provided
    if (search) {
      whereClause += ` AND (LOWER(name) LIKE ? OR LOWER(mobile_number) LIKE ? OR CAST(id AS CHAR) LIKE ?)`;
      const keyword = `%${search.toLowerCase()}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    // Count query to get total MS Teams or SIP approved leads
    const [totalResult] = await db.execute(
      `SELECT COUNT(*) as total ${baseQuery}${whereClause}`,
      queryParams
    );
    const totalAdvanceMsLeadsCallDone = totalResult[0]?.total || 0;
    const totalPages = Math.ceil(totalAdvanceMsLeadsCallDone / limit);

    // Fetch query to get paginated MS Teams or SIP approved leads
    const fetchQuery = `SELECT * ${baseQuery}${whereClause} ORDER BY code_approved_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const [AdvanceCallDone] = await db.execute(fetchQuery, queryParams);

    // If no approved leads are found, return a 404 response
    if (AdvanceCallDone.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No MS Teams  leads found for this RM.",
      });
    }

    // Return a successful response with approved leads data
    return res.status(200).json({
      success: true,
      message: "Advance Ms-Teams leads fetched successfully.",
      AdvanceCallDone,
      totalAdvanceMsLeadsCallDone,
      totalPages,
      currentPage: page,
      perPage: limit,
    });
  } catch (error) {
    console.error("Error fetching Basic Ms-Teams  leads:", error);
    // Handle unexpected errors and return a 500 response
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
}


//Get all leads for rm or jrm
exports.getAllLeadsForRM = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim();

    if (!search) {
      return res.status(400).json({
        success: false,
        message: "Search keyword is required.",
      });
    }

    let baseQuery = `FROM leads LEFT JOIN users ON leads.fetched_by = users.id`;
    let whereClause = ` WHERE (LOWER(leads.name) LIKE ? OR LOWER(leads.mobile_number) LIKE ? OR CAST(leads.id AS CHAR) LIKE ? OR LOWER(users.name) LIKE ?)`;
    const keyword = `%${search.toLowerCase()}%`;
    const queryParams = [keyword, keyword, keyword, keyword];

    const [countResult] = await db.execute(
      `SELECT COUNT(*) AS total ${baseQuery}${whereClause}`,
      queryParams
    );
    const totalClientsForRmList = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalClientsForRmList / limit);

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
    const [ClientsForRm] = await db.execute(fetchQuery, queryParams);

    return res.status(200).json({
      success: true,
      message: "Leads fetched successfully.",
      totalClientsForRmList,
      ClientsForRm,
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


//Request advance msteams login
exports.requestAdvanceBatchMsTeamsLogin = async (req, res) => {
  const leadId = req.params.leadId;
  const rmId = req.user.id;
  const screenshotPath = req.file ? req.file.path : null;

  if (!screenshotPath) {
    return res.status(400).json({
      success: false,
      message: "Screenshot is required for MS Teams login request.",
    });
  }

  try {
    // Ensure the lead is Code Approved and fetched by this RM
    const [leadResult] = await db.execute(
      `SELECT * FROM leads WHERE id = ? AND assigned_to = ? AND code_request_status = 'approved'`,
      [leadId, rmId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Lead not found or not eligible for MS Teams login request.",
      });
    }

    // Delete the old MS Teams screenshot if it exists
    const oldScreenshotPath = leadResult[0].advanced_ms_teams_screenshot;
    if (oldScreenshotPath && fs.existsSync(oldScreenshotPath)) {
      fs.unlinkSync(oldScreenshotPath);
    }

    // Update lead with new screenshot and request status
    await db.execute(
      `UPDATE leads SET 
        advanced_ms_teams_screenshot = ?, 
        advanced_ms_teams_request_status = 'requested', 
        advanced_ms_teams_requested_at = NOW()
       WHERE id = ?`,
      [screenshotPath, leadId]
    );

    res.json({
      success: true,
      message: 'Advance MS Teams request successfully sent to admin.',
    });

  } catch (error) {
    console.error('Error requesting MS Teams login:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while requesting MS Teams login.',
      error: error.message,
    });
  }
}




//Coded Approved Clinets dump
//My Clients for call after basic_ms details send
exports.jrmCodedAllMyClients = async (req, res) => {
  try {
    const rmId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 5;
    const offset = (page - 1) * limit;
    const search = req.query.search || ""; // Search query for filtering leads

    // Base query components
    const baseQuery = `FROM leads`;
      let whereClause = `
        WHERE fetched_by = ? 
        AND code_request_status = 'approved' 
       
      `;

      const queryParams = [rmId];


    // Add search conditions if a search query is provided
    if (search) {
      whereClause += ` AND (LOWER(name) LIKE ? OR LOWER(mobile_number) LIKE ? OR CAST(id AS CHAR) LIKE ?)`;
      const keyword = `%${search.toLowerCase()}%`;
      queryParams.push(keyword, keyword, keyword);
    }

    // Count query to get total MS Teams or SIP approved leads
    const [totalResult] = await db.execute(
      `SELECT COUNT(*) as total ${baseQuery}${whereClause}`,
      queryParams
    );
    const totalJrmLeadsAllMyClients = totalResult[0]?.total || 0;
    const totalPages = Math.ceil(totalJrmLeadsAllMyClients / limit);

    // Fetch query to get paginated MS Teams or SIP approved leads
    const fetchQuery = `SELECT * ${baseQuery}${whereClause} ORDER BY code_approved_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const [jrmLeadsAllMyClients] = await db.execute(fetchQuery, queryParams);

    // If no approved leads are found, return a 404 response
    if (jrmLeadsAllMyClients.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No Clients found.",
      });
    }

    // Return a successful response with approved leads data
    return res.status(200).json({
      success: true,
      message: "Clients fetched successfully.",
      jrmLeadsAllMyClients,
      totalJrmLeadsAllMyClients,
      totalPages,
      currentPage: page,
      perPage: limit,
    });
  } catch (error) {
    console.error("My clients:", error);
    // Handle unexpected errors and return a 500 response
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


