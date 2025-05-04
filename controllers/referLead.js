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
      const rmId = req.user.id; // Assuming rmId comes from the authenticated user
      
      // Get page and limit from the query params (default to 1 page and 5 leads per page)
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 5;
      
      // Calculate the offset for pagination
      const offset = (page - 1) * limit;
  
      console.log('rmId:', rmId, 'page:', page, 'limit:', limit, 'offset:', offset);
  
      // Query to get the total number of leads for pagination info
      const [totalReferLeadsResult] = await db.execute('SELECT COUNT(*) as total FROM leads WHERE referred_by_rm = ? ', [rmId]);
      const totalReferLeads = totalReferLeadsResult[0].total;
      const totalPages = Math.ceil(totalReferLeads / limit);
  
      console.log('Total referLeads:', totalReferLeads, 'Total Pages:', totalPages);
  
      // Use template literals for LIMIT and OFFSET
      const query = `
    SELECT * FROM leads 
    WHERE referred_by_rm = ? 
    ORDER BY fetched_at ASC 
    LIMIT ${limit} OFFSET ${offset}
  `;
      // Logging query and parameters to ensure they're correct
      console.log('Executing query:', query, 'with parameters:', [rmId]);
  
      const [referLeads] = await db.execute(query, [rmId]);
  
      // If leads are not found, log the error
      if (!referLeads || referLeads.length === 0) {
        console.log('No leads found for this RMId:', rmId);
      }
  
      res.status(200).json({
        success: true,
        message: 'RM Leads fetched successfully.',
        referLeads, // Include the actual leads data in the response
        totalReferLeads, // Total number of leads
        totalPages, // Total number of pages
        currentPage: page // Current page number
      });
    } catch (error) {
      console.error('Error fetching leads:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };
  