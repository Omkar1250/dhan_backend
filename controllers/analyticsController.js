const db = require('../config/db');

exports.getSummary = async (req, res) => {
  const { startDate, endDate } = req.query;

  try {
    const queries = {
      fetchedLeads: 'SELECT COUNT(*) AS count FROM leads WHERE fetched_at BETWEEN ? AND ?',
    //   referredLeads: 'SELECT COUNT(*) AS count FROM leads WHERE is_referred = 1 AND fetched_at BETWEEN ? AND ?',
      underUsApproved: 'SELECT COUNT(*) AS count FROM leads WHERE under_us_request_status = "approved" AND under_us_approved_at BETWEEN ? AND ?',
      codeApproved: 'SELECT COUNT(*) AS count FROM leads WHERE code_request_status = "approved" AND code_approved_at BETWEEN ? AND ?',
      aomaActivated: 'SELECT COUNT(*) AS count FROM leads WHERE aoma_request_status = "approved" AND aoma_approved_at BETWEEN ? AND ?',
      activationDone: 'SELECT COUNT(*) AS count FROM leads WHERE activation_request_status = "approved" AND activation_approved_at BETWEEN ? AND ?',
      msTeamsLogin: 'SELECT COUNT(*) AS count FROM leads WHERE ms_teams_request_status = "approved" AND ms_teams_login_approved_at BETWEEN ? AND ?',
      sipSetup: 'SELECT COUNT(*) AS count FROM leads WHERE sip_request_status = "approved" AND sip_approved_at BETWEEN ? AND ?',
    };

    const results = {};

    for (let [key, query] of Object.entries(queries)) {
      const [rows] = await db.execute(query, [startDate, endDate]);
      results[key] = rows[0].count;
    }

    res.json({ success: true, data: results });

  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    res.status(500).json({ success: false, message: 'Server error fetching analytics summary.' });
  }
};
