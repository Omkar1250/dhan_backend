const db = require('../config/db');

exports.getSummary = async (req, res) => {
  const { startDate, endDate } = req.query;
  const userId = req.user.id; // Get RM's ID from logged-in user

  try {
    let whereConditions = 'fetched_by = ?'; // Always filter by this RM
    let params = [userId];

    if (startDate && endDate) {
      whereConditions += ` AND fetched_at BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    const [rows] = await db.execute(
      `SELECT
         SUM(fetched_at IS NOT NULL) AS fetchedLeads,
         SUM(referred_by_rm) AS referredLeads,
         SUM(under_us_status = 'approved') AS underUsApproved,
         SUM(code_request_status = 'approved') AS codeApproved,
         SUM(aoma_request_status = 'approved') AS aomaActivated,
         SUM(activation_request_status = 'approved') AS activationDone,
         SUM(ms_teams_request_status = 'approved') AS msTeamsLogin,
         SUM(sip_request_status = 'approved') AS sipSetup
       FROM leads
       WHERE ${whereConditions}
      `,
      params
    );

    res.json({ success: true, data: rows[0] });

  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    res.status(500).json({ success: false, message: 'Server error fetching analytics summary.' });
  }
};
// SUM(is_referred = 1) AS referredLeads,