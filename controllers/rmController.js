const db = require('../config/db')

//Handler to get client list
exports.getYourClientList = async (req, res) => {
    const rmId = req.user.id;
  
    try {
      const [clients] = await db.execute(
        `SELECT * FROM leads 
         WHERE fetched_by = ? 
         AND activation_request_status = "approved"
         AND TIMESTAMPDIFF(DAY, activation_requested_at, NOW()) <= 30`,
        [rmId]
      );
  
      res.json({ success: true, data: clients });
  
    } catch (err) {
      console.error("Error fetching client list:", err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };

  

