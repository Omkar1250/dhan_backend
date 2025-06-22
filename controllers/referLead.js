const db = require('../config/db'); // adjust db path if needed

exports.referFriendLead = async (req, res) => {
    try {
      const { name, mobile_number, whatsapp_mobile_number } = req.body;
      const userId = req.user.id; // assuming you get user from auth middleware
  
      if (!name || !mobile_number || !whatsapp_mobile_number) {
        return res.status(400).json({ message: 'All fields are required.' });
      }
  
      const numberOnlyRegex = /^\d+$/;
      if (!numberOnlyRegex.test(mobile_number)) {
        return res.status(400).json({ message: 'Only numbers are allowed.' });
      }
  
      // Check if mobile_number already exists
      const [existingLead] = await db.execute('SELECT id FROM leads WHERE mobile_number = ?', [mobile_number]);
  
      if (existingLead.length > 0) {
        return res.status(400).json({ message: 'Mobile number already exists.' });
      }
  
      // Insert new lead
      await db.execute(
        'INSERT INTO leads (name, mobile_number, whatsapp_mobile_number, fetched_by, referred_by_rm, fetched_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [name, mobile_number, whatsapp_mobile_number, userId,userId]
      );
  
      res.status(200).json({
        success:true,
        message: 'Lead referred successfully.' });
  
    } catch (error) {
      console.error('Error in referFriendLead:', error);
      res.status(500).json({ message: 'Something went wrong.' });
    }
  };
  

exports.checkMobileNumber = async (req, res) => {
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
      const [existingLead] = await db.execute('SELECT id FROM leads WHERE mobile_number = ?', [mobile_number]);
  
      if (existingLead.length > 0) {
        return res.status(200).json({ exists: true, message: 'Number Already Exists.' });
      }
  
      res.status(200).json({ exists: false, message: 'Number is available.' });
  
    } catch (error) {
      console.error('Error in checkMobileNumber:', error);
      res.status(500).json({ message: 'Something went wrong.' });
    }
  };


//leads list of particulat RM 
exports.fetchReferLeadsRMs = async (req, res) => {
  try {
    const rmId = req.user.id; // Assuming `rmId` comes from the authenticated user
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 5;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    let baseQuery = `FROM leads`;
    let whereClause = ` WHERE referred_by_rm = ? AND (under_us_status IS NULL OR under_us_status != 'approved')`;
    const queryParams = [rmId];

    if (search) {
      whereClause += ` AND (LOWER(name) LIKE ? OR LOWER(mobile_number) LIKE ? OR LOWER(whatsapp_mobile_number) LIKE ? OR CAST(id AS CHAR) LIKE ?)`;
      const keyword = `%${search.toLowerCase()}%`;
      queryParams.push(keyword, keyword, keyword, keyword);
    }

    // Count query to get the total number of leads
    const [countResult] = await db.execute(
      `SELECT COUNT(*) AS total ${baseQuery}${whereClause}`,
      queryParams
    );
    const totalReferLeads = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalReferLeads / limit);

    // Fetch query to get leads with pagination
    const fetchQuery = `SELECT id, name, mobile_number, whatsapp_mobile_number, under_us_status, fetched_at 
                        ${baseQuery}${whereClause} 
                        ORDER BY fetched_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const [referLeads] = await db.execute(fetchQuery, queryParams);

    if (referLeads.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No leads found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "RM Leads fetched successfully.",
      totalReferLeads,
      referLeads,
      totalPages,
      currentPage: page,
      perPage: limit,
    });
  } catch (err) {
    console.error("Error fetching RM leads:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: err.message,
    });
  }
};
