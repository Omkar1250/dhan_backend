const db = require('../config/db');
const fs = require("fs");

// Fetch leads for RM
exports.fetchLeads = async (req, res) => {
  try {
    console.log("------")
    const rmId = req.user.id;
    console.log(rmId)
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

    // Fetch 5 available leads
    const [leads] = await db.execute(
      'SELECT * FROM leads WHERE fetched_by IS NULL ORDER BY id DESC LIMIT 5'
    );

    if (leads.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No leads available.'
      });
    }

    // Assign those leads to RM
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
    const rmId = req.user.id; // Assuming rmId comes from the authenticated user
    
    // Get page and limit from the query params (default to 1 page and 5 leads per page)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    
    // Calculate the offset for pagination
    const offset = (page - 1) * limit;

    console.log('rmId:', rmId, 'page:', page, 'limit:', limit, 'offset:', offset);

    // Query to get the total number of leads for pagination info
    const [totalLeadsResult] = await db.execute('SELECT COUNT(*) as total FROM leads WHERE fetched_by = ?', [rmId]);
    const totalLeads = totalLeadsResult[0].total;
    const totalPages = Math.ceil(totalLeads / limit);

    console.log('Total Leads:', totalLeads, 'Total Pages:', totalPages);

    // Use template literals for LIMIT and OFFSET
    const query = `
  SELECT * FROM leads 
  WHERE fetched_by = ? 
  ORDER BY fetched_at ASC 
  LIMIT ${limit} OFFSET ${offset}
`;
    // Logging query and parameters to ensure they're correct
    console.log('Executing query:', query, 'with parameters:', [rmId]);

    const [leads] = await db.execute(query, [rmId]);

    // If leads are not found, log the error
    if (!leads || leads.length === 0) {
      console.log('No leads found for this RMId:', rmId);
    }

    res.status(200).json({
      success: true,
      message: 'RM Leads fetched successfully.',
      leads, // Include the actual leads data in the response
      totalLeads, // Total number of leads
      totalPages, // Total number of pages
      currentPage: page // Current page number
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ success: false, error: error.message });
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

    if (["pending", "approved", "rejected"].includes(currentStatus)) {
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
    const screenshotPath = req.file ? req.file.path : null;

    // Validate that a screenshot is uploaded
    if (!screenshotPath) {
      return res.status(400).json({
        success: false,
        message: "Screenshot is required for AOMA approval.",
      });
    }

    // Check if the lead belongs to the RM and is code approved
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

    // Delete the old screenshot if present
    const oldScreenshotPath = leadResult[0].aoma_screenshot;
    if (oldScreenshotPath && fs.existsSync(oldScreenshotPath)) {
      fs.unlinkSync(oldScreenshotPath); // Delete the old file
    }

    // Update status to 'requested', store screenshot path, and request time
    await db.execute(
      `UPDATE leads 
       SET aoma_request_status = 'requested', 
           aoma_requested_at = NOW(), 
           aoma_screenshot = ? 
       WHERE id = ?`,
      [screenshotPath, leadId]
    );

    res.json({
      success: true,
      message: "AOMA approval request sent to admin.",
    });
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
  const screenshotPath = req.file ? req.file.path : null;

  if (!screenshotPath) {
    return res.status(400).json({
      success: false,
      message: "Screenshot is required for AOMA approval.",
    });
  }
  try {
    // Check lead belongs to RM & is aoma approved
    const [leadResult] = await db.execute(
      'SELECT * FROM leads WHERE id=? AND fetched_by=? AND aoma_request_status="approved"',
      [leadId, rmId]
    );
    if (leadResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Lead not found or not approved for AOMA.",
      });
    }

    // Delete the old screenshot if present
    const oldScreenshotPath = leadResult[0].activation_screenshot;
    if (oldScreenshotPath && fs.existsSync(oldScreenshotPath)) {
      fs.unlinkSync(oldScreenshotPath); // Delete the old file
    }
   

    // Update lead status and screenshot
    await db.execute(
      `UPDATE leads 
       SET activation_request_status = 'requested', 
           activation_requested_at = NOW(), 
           activation_screenshot = ? 
       WHERE id = ?`,
      [screenshotPath, leadId]
    );

    res.json({ success: true, message: 'Activation request sent to admin' });

  } catch (error) {
    console.error('Error requesting Activation approval:', error);
    res.status(500).json({ success: false, message: 'Server error while requesting Activation approval' });
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
exports.deleteLead = async (req, res) => {
const { leadId } = req.params; // Assuming the lead ID is passed in the URL
const  rmId  = req.user.id; // Assuming the RM ID is passed in the request body

if (!leadId || !rmId) {
  return res.status(400).json({
    success: false,
    message: "Lead ID or RM ID is missing."
  });
}
  try {
    // Check if lead exists and if RM has fetched this lead
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

    // Check if lead is in a status where deletion is allowed
    if (["pending", "approved", "rejected"].includes(currentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Lead cannot be deleted because it has a status of '${currentStatus}'.`
      });
    }

    // Proceed to delete the lead if status is not one of the above
    const [result] = await db.execute(`
      DELETE FROM leads WHERE id = ? AND fetched_by = ?
    `, [leadId, rmId]);

    // Double-checking affectedRows (should be 1)
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Lead not found or you're not authorized to delete it."
      });
    }

    // Success response
    res.status(200).json({
      success: true,
      message: "Lead deleted successfully."
    });
  } catch (error) {
    console.error("Error deleting lead:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};



//underus approved
exports.fetchLeadsUnderUsapproved = async (req, res) => {
  try {
    const rmId = req.user.id; // Assuming rmId comes from the authenticated user
    
    // Get page and limit from the query params (default to 1 page and 5 leads per page)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    
    // Calculate the offset for pagination
    const offset = (page - 1) * limit;

    console.log('rmId:', rmId, 'page:', page, 'limit:', limit, 'offset:', offset);

    // Query to get the total number of approved leads for pagination info
    const [totalLeadsResult] = await db.execute(
     'SELECT COUNT(*) as total FROM leads WHERE fetched_by = ? AND under_us_status = ? AND deleted_by_rm = 0',
      [rmId, 'approved']
    );
    const totalApprovedLeads = totalLeadsResult[0].total;
    const totalPages = Math.ceil(totalApprovedLeads / limit);

    console.log('Total Approved Leads:', totalApprovedLeads, 'Total Pages:', totalPages);

    // Query to fetch approved leads for this RM
    const query = `
      SELECT * FROM leads 
       WHERE fetched_by = ? AND under_us_status = ? AND deleted_by_rm = 0  
      ORDER BY fetched_at ASC 
      LIMIT ${limit} OFFSET ${offset}
    `;
    // Logging query and parameters to ensure they're correct
    console.log('Executing query:', query, 'with parameters:', [rmId, 'approved']);

    const [underUsApproved] = await db.execute(query, [rmId, 'approved']);

    // If leads are not found, log the error
    if (!underUsApproved || underUsApproved.length === 0) {
      console.log('No approved leads found for this RMId:', rmId);
    }

    res.status(200).json({
      success: true,
      message: 'Approved RM Leads fetched successfully.',
      underUsApproved, // Include the actual approved leads data in the response
      totalApprovedLeads, // Total number of approved leads
      totalPages, // Total number of pages
      currentPage: page // Current page number
    });
  } catch (error) {
    console.error('Error fetching approved leads:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

//Coded approved
exports.fetchCodeApprovedLeads = async (req, res) => {
  try {
    const rmId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;

    // Count total leads
    const [totalResult] = await db.execute(
      "SELECT COUNT(*) as total FROM leads WHERE fetched_by = ? AND code_request_status = 'approved'",
      [rmId]
    );
    const totalCodedLeads = totalResult[0].total;
    const totalPages = Math.ceil(totalCodedLeads / limit);

    // Fetch paginated approved leads
    const [codedApproved] = await db.execute(
      `SELECT * FROM leads 
       WHERE fetched_by = ? AND code_request_status = 'approved' 
       ORDER BY fetched_at ASC 
       LIMIT ${limit} OFFSET ${offset}`,
      [rmId]
    );

    res.status(200).json({
      success: true,
      message: "Code Approved leads fetched successfully.",
      codedApproved,
      totalCodedLeads,
      totalPages,
      currentPage: page,
    });
  } catch (error) {
    console.error("Error fetching Code Approved leads:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// AOMA approved 
exports.fetchAOMAApprovedLeads = async (req, res) => {
  try {
    const rmId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;

    // Count total leads with approved AOMA request
    const [totalResult] = await db.execute(
      "SELECT COUNT(*) as total FROM leads WHERE fetched_by = ? AND aoma_request_status = 'approved'",
      [rmId]
    );
    const totalAomaLeads = totalResult[0].total;
    const totalPages = Math.ceil(totalAomaLeads / limit);

    // Fetch paginated leads
    const [aomaApproved] = await db.execute(
      `SELECT * FROM leads 
       WHERE fetched_by = ? AND aoma_request_status = 'approved' 
       ORDER BY fetched_at ASC 
       LIMIT ${limit} OFFSET ${offset}`,
      [rmId]
    );

    res.status(200).json({
      success: true,
      message: "AOMA Approved leads fetched successfully.",
      aomaApproved,
      totalAomaLeads,
      totalPages,
      currentPage: page,
    });
  } catch (error) {
    console.error("Error fetching AOMA Approved leads:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};



//feth Activation approved list
exports.fetchActivationApprovedLeads = async (req, res) => {
  try {
    const rmId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;

    // Remove expired leads (activated more than 30 days ago)
    await db.execute(
      `DELETE FROM leads 
       WHERE fetched_by = ? 
         AND activation_request_status = 'approved' 
         AND activation_approved_at IS NOT NULL 
         AND activation_approved_at < (NOW() - INTERVAL 30 DAY)`,
      [rmId]
    );

    // Count remaining activation approved leads
    const [totalResult] = await db.execute(
      `SELECT COUNT(*) as total 
       FROM leads 
       WHERE fetched_by = ? 
         AND activation_request_status = 'approved'`,
      [rmId]
    );
    const totalActivationLeads = totalResult[0].total;
    const totalPages = Math.ceil(totalActivationLeads / limit);

    // Fetch paginated leads
    const [activationApproved] = await db.execute(
      `SELECT * FROM leads 
       WHERE fetched_by = ? 
         AND activation_request_status = 'approved' 
       ORDER BY activation_approved_at ASC 
       LIMIT ${limit} OFFSET ${offset}`,
      [rmId]
    );

    res.status(200).json({
      success: true,
      message: "Activation Approved leads fetched successfully.",
      activationApproved,
      totalActivationLeads,
      totalPages,
      currentPage: page,
    });
  } catch (error) {
    console.error("Error fetching Activation Approved leads:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};


//fetch ms teams approved list
exports.fetchMsTeamsApprovedLeads = async (req, res) => {
  try {
    const rmId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;
  
    // Count remaining leads matching condition
    const [totalResult] = await db.execute(
      `SELECT COUNT(*) as total 
       FROM leads 
       WHERE fetched_by = ? 
         AND code_request_status = 'approved'
    `,
      [rmId]
    );
    const totalMsTeamsLeads = totalResult[0].total;
    const totalPages = Math.ceil(totalMsTeamsLeads / limit);
  
    // Fetch paginated leads
    const [msTeamsApproved] = await db.execute(
      `SELECT * FROM leads 
       WHERE fetched_by = ? 
         AND code_request_status = 'approved'
        
       ORDER BY code_approved_at ASC 
       LIMIT ${limit} OFFSET ${offset}`,
      [rmId]
    );
  
    res.status(200).json({
      success: true,
      message: "Pending MS Teams or SIP leads fetched successfully.",
      msTeamsApproved,
      totalMsTeamsLeads,
      totalPages,
      currentPage: page,
    });
  
  } catch (error) {
    console.error("Error fetching Pending MS Teams or SIP leads:", error);
    res.status(500).json({ success: false, error: error.message });
  }
  
}
//fetch sip  approved list
exports.fetchSipApprovedLeads = async (req, res) => {
  try {
    const rmId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;
  
    // Count remaining leads matching condition
    const [totalResult] = await db.execute(
      `SELECT COUNT(*) as total 
       FROM leads 
       WHERE fetched_by = ? 
         AND code_request_status = 'approved'
        `,
      [rmId]
    );
    const totalSipLeads = totalResult[0].total;
    const totalPages = Math.ceil(totalSipLeads / limit);
  
    // Fetch paginated leads
    const [sipApproved] = await db.execute(
      `SELECT * FROM leads 
       WHERE fetched_by = ? 
         AND code_request_status = 'approved'
       ORDER BY code_approved_at ASC 
       LIMIT ${limit} OFFSET ${offset}`,
      [rmId]
    );
  
    res.status(200).json({
      success: true,
      message: "Pending MS Teams or SIP leads fetched successfully.",
      sipApproved,
      totalSipLeads,
      totalPages,
      currentPage: page,
    });
  
  } catch (error) {
    console.error("Error fetching Pending MS Teams or SIP leads:", error);
    res.status(500).json({ success: false, error: error.message });
  }
  
}



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