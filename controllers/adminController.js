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
          `DELETE FROM leads WHERE id = ?`,
          [leadId]
        );
        return res.status(200).json({ success: true, message: 'Lead rejected and deleted successfully.' });
      }
  
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  };


//code approval
exports.approveCodeRequest = async (req, res) => {
  const leadId = req.params.leadId;

  try {
    // Check if lead exists and is pending for code approval
    const [leadResult] = await db.execute(
      'SELECT * FROM leads WHERE id = ? AND code_request_status = "requested"',
      [leadId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found or not in requested status.' });
    }

    const lead = leadResult[0];

    // Get Code Approved point value
    const [pointResult] = await db.execute(
      'SELECT points FROM conversion_points WHERE action = "code_approved"'
    );

    const pointsToCredit = pointResult[0].points;

    // Credit points to RM's wallet
    await db.execute(
      'UPDATE users SET wallet = wallet + ? WHERE id = ?',
      [pointsToCredit, lead.fetched_by]
    );

    // Log transaction
    await db.execute(
      'INSERT INTO wallet_transactions (user_id, lead_id, action, points) VALUES (?, ?, ?, ?)',
      [lead.fetched_by, lead.id, 'code_approved', pointsToCredit]
    );

    // Update lead status to 'approved' and set approved time
    await db.execute(
      'UPDATE leads SET code_request_status = "approved", code_approved_at = NOW() WHERE id = ?',
      [leadId]
    );

    res.status(200).json({ success: true, message: 'Code Request Approved and points credited.' });

  } catch (error) {
    console.error('Error approving Code Request:', error);
    res.status(500).json({ success: false, message: 'Server error while approving Code Request.' });
  }
};



//aoma approve handler
exports.approveAOMARequest = async (req, res) => {
  const leadId = req.params.leadId;

  try {
    // Check if lead exists and is pending for AOMA approval
    const [leadResult] = await db.execute(
      'SELECT * FROM leads WHERE id = ? AND aoma_request_status = "requested"',
      [leadId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found or not in requested status.' });
    }

    const lead = leadResult[0];

    // Get AOMA Approved point value
    const [pointResult] = await db.execute(
      'SELECT points FROM conversion_points WHERE action = "aoma_approved"'
    );

    const pointsToCredit = pointResult[0].points;

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

    // Update lead status to 'approved' and set approved time
    await db.execute(
      'UPDATE leads SET aoma_request_status = "approved", aoma_approved_at = NOW() WHERE id = ?',
      [leadId]
    );

    res.status(200).json({ success: true, message: 'AOMA Request Approved and points credited.' });

  } catch (error) {
    console.error('Error approving AOMA Request:', error);
    res.status(500).json({ success: false, message: 'Server error while approving AOMA Request.' });
  }
};



//Approve activation request
exports.approveActivationRequest = async (req, res) => {
  const leadId = req.params.leadId;

  try {
    // Check if lead exists and is pending for Activation approval
    const [leadResult] = await db.execute(
      'SELECT * FROM leads WHERE id = ? AND activation_request_status = "requested"',
      [leadId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found or not in Activation requested status.' });
    }

    const lead = leadResult[0];

    // Get Activation Approved point value
    const [pointResult] = await db.execute(
      'SELECT points FROM conversion_points WHERE action = "activation_approved"'
    );

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

    // Update lead status to 'approved' and set approved time
    await db.execute(
      'UPDATE leads SET activation_request_status = "approved", activation_approved_at = NOW() WHERE id = ?',
      [leadId]
    );

    res.status(200).json({ success: true, message: 'Activation Request Approved and points credited.' });

  } catch (error) {
    console.error('Error approving Activation Request:', error);
    res.status(500).json({ success: false, message: 'Server error while approving Activation Request.' });
  }
};

//approve ms teams request
exports.approveMsTeamsLoginRequest = async (req, res) => {
  const leadId = req.params.leadId;

  try {
    // Check if lead exists and is pending for MS Teams login approval
    const [leadResult] = await db.execute(
      'SELECT * FROM leads WHERE id = ? AND ms_teams_request_status = "requested"',
      [leadId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found or not in MS Teams requested status.' });
    }

    const lead = leadResult[0];

    // Get MS Teams Login Approved point value
    const [pointResult] = await db.execute(
      'SELECT points FROM conversion_points WHERE action = "ms_teams_login_approved"'
    );

    const pointsToCredit = pointResult[0].points;

    // Credit points to RM's wallet
    await db.execute(
      'UPDATE users SET wallet = wallet + ? WHERE id = ?',
      [pointsToCredit, lead.fetched_by]
    );

    // Log transaction for points credited
    await db.execute(
      'INSERT INTO wallet_transactions (user_id, lead_id, action, points) VALUES (?, ?, ?, ?)',
      [lead.fetched_by, lead.id, 'ms_teams_login_approved', pointsToCredit]
    );

    // Update lead status to 'approved' and set approved time
    await db.execute(
      'UPDATE leads SET ms_teams_request_status = "approved", ms_teams_approved_at = NOW() WHERE id = ?',
      [leadId]
    );

    // Move lead to the RM's MS Teams list
    await db.execute(
      'INSERT INTO ms_teams_list (user_id, lead_id, ms_teams_screenshot) VALUES (?, ?, ?)',
      [lead.fetched_by, leadId, lead.ms_teams_screenshot]
    );

    res.status(200).json({ success: true, message: 'MS Teams Login Request Approved and points credited.' });

  } catch (error) {
    console.error('Error approving MS Teams Login Request:', error);
    res.status(500).json({ success: false, message: 'Server error while approving MS Teams Login Request.' });
  }
};


//approve sip request
exports.approveSipRequest = async (req, res) => {
  const { leadId } = req.params;

  try {
    const [leadResult] = await db.execute(
      'SELECT * FROM leads WHERE id = ? AND sip_request_status = "requested"',
      [leadId]
    );

    if (leadResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found or not in requested status.' });
    }

    const lead = leadResult[0];

    const [pointResult] = await db.execute(
      'SELECT points FROM conversion_points WHERE action = "sip_approved"'
    );

    const pointsToCredit = pointResult[0]?.points;

    // Credit points
    await db.execute(
      'UPDATE users SET wallet = wallet + ? WHERE id = ?',
      [pointsToCredit, lead.fetched_by]
    );

    // Log transaction
    await db.execute(
      'INSERT INTO wallet_transactions (user_id, lead_id, action, points) VALUES (?, ?, ?, ?)',
      [lead.fetched_by, lead.id, 'sip_approved', pointsToCredit]
    );

    // Update lead status
    await db.execute(
      'UPDATE leads SET sip_request_status = "approved" WHERE id = ?',
      [leadId]
    );

    res.json({ success: true, message: 'SIP Request approved and points credited.' });
  } catch (err) {
    console.error('Error approving SIP Request:', err);
    res.status(500).json({ success: false, message: 'Server error while approving SIP Request.' });
  }
};


//reject sip request
exports.rejectSipRequest = async (req, res) => {
  const { leadId } = req.params;

  try {
    await db.execute(
      'UPDATE leads SET sip_request_status = "rejected" WHERE id = ?',
      [leadId]
    );

    res.json({ success: true, message: 'SIP Request rejected.' });
  } catch (err) {
    console.error('Error rejecting SIP Request:', err);
    res.status(500).json({ success: false, message: 'Server error while rejecting SIP Request.' });
  }
};




