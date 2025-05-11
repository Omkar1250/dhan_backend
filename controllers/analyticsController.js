const db = require('../config/db');

exports.getSummary = async (req, res) => {
  const { startDate, endDate } = req.query;
  const userId = req.user.id;

  try {
    let whereConditions = 'fetched_by = ?';
    let params = [userId];

    if (startDate && endDate) {
      whereConditions += ' AND fetched_at BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    const [rows] = await db.execute(
      `SELECT
         SUM(CASE WHEN fetched_at IS NOT NULL AND (referred_by_rm IS NULL OR referred_by_rm = 0) THEN 1 ELSE 0 END) AS fetchedLeads,
         SUM(CASE WHEN referred_by_rm IS NOT NULL AND referred_by_rm != 0 THEN 1 ELSE 0 END) AS referredLeads,
         SUM(CASE WHEN under_us_status = 'approved' THEN 1 ELSE 0 END) AS underUsApproved,
         SUM(CASE WHEN code_request_status = 'approved' THEN 1 ELSE 0 END) AS codeApproved,
         SUM(CASE WHEN aoma_request_status = 'approved' THEN 1 ELSE 0 END) AS aomaActivated,
         SUM(CASE WHEN activation_request_status = 'approved' THEN 1 ELSE 0 END) AS activationDone,
         SUM(CASE WHEN ms_teams_request_status = 'approved' THEN 1 ELSE 0 END) AS msTeamsLogin,
         SUM(CASE WHEN sip_request_status = 'approved' THEN 1 ELSE 0 END) AS sipSetup
       FROM leads
       WHERE ${whereConditions}`,
      params
    );

    res.json({ success: true, data: rows[0] });

  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    res.status(500).json({ success: false, message: 'Server error fetching analytics summary.' });
  }
};



exports.getUnfetchedLeadsCount = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT 
         COUNT(*) AS unFetchedLeads
       FROM leads
       WHERE fetched_by IS NULL`
    );

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error fetching unfetched leads:', error);
    res.status(500).json({ success: false, message: 'Server error fetching unfetched leads.' });
  }
};
