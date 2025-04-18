const db = require('../config/db');

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
      ORDER BY id DESC 
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

    // Update the lead status to 'pending' for under us approval
    const [result] = await db.execute(`
      UPDATE leads
      SET under_us_status = 'pending', under_us_requested_at = NOW()
      WHERE id = ? AND fetched_by = ?
    `, [leadId, rmId]);

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
    await db.execute(`UPDATE leads SET code_status='requested' WHERE id=?`, [leadId]);

    res.json({ success: true, message: 'Code approval request sent to admin' });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

