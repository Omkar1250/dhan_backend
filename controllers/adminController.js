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

  