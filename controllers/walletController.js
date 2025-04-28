
const db = require('../config/db');


//get wallet poits
exports.getWalletBalance = async (req, res) => {
    try {
      const [result] = await db.execute(
        'SELECT wallet FROM users WHERE id = ?',
        [req.user.id]
      );
      res.json({ success: true, wallet: result[0].wallet });
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      res.status(500).json({ success: false, message: 'Could not fetch wallet balance.' });
    }
  };
  
  
  
  //get wallet treasaction with points
  exports.getTransactionHistory = async (req, res) => {
    const userId = req.user.id;
  
    try {
      // Fetch all transactions for this user ordered by latest first
      const [transactions] = await db.execute(
        'SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );
  
      res.json({ success: true, transactions });
  
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ success: false, message: 'Server error while fetching transactions.' });
    }
  };
  
  

  //wallet points payout
exports.adminPayout = async (req, res) => {
    const { rmId, amountInRupees, pointsToDeduct } = req.body;
  
    try {
      // Deduct points
      await db.execute(
        'UPDATE users SET wallet = wallet - ? WHERE user_id = ?',
        [pointsToDeduct, rmId]
      );
  
      // Log transaction
      await db.execute(
        `INSERT INTO wallet_transactions (user_id, action, points) 
         VALUES (?, ?, ?)`,
        [rmId, `Withdrawal: ₹${amountInRupees}`, -pointsToDeduct]
      );
  
      res.json({ success: true, message: 'Payout successful and points deducted.' });
  
    } catch (error) {
      console.error('Error processing payout:', error);
      res.status(500).json({ success: false, message: 'Payout failed.' });
    }
  };
  

  //RM PAYEMENT OVERVIEW
 
  
  exports.getPaymentsOverview = async (req, res) => {
    try {
      const rmId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 5;
      const offset = (page - 1) * limit;
  
      console.log("userId:", rmId, "limit:", limit, "offset:", offset); // Debugging log
  
      // Fetch the total number of transactions for this user
      const [totalResult] = await db.execute(
        'SELECT COUNT(*) AS total FROM wallet_transactions WHERE user_id = ?',
        [rmId]
      );
      const totalTransactions = totalResult[0].total;
      const totalPages = Math.ceil(totalTransactions / limit); // Calculate total pages
  
      // Fetch the total points for all transactions
      const [totalPointsResult] = await db.execute(
        'SELECT SUM(points) AS totalPoints FROM wallet_transactions WHERE user_id = ?',
        [rmId]
      );
      const totalPoints = totalPointsResult[0].totalPoints || 0; // Default to 0 if null
  
      // Fetch the paginated transaction history along with the lead name
      const query = `
        SELECT wt.*, l.name AS lead_name
        FROM wallet_transactions wt
        LEFT JOIN leads l ON wt.lead_id = l.id
        WHERE wt.user_id = ?
        ORDER BY wt.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
  
      const [transactions] = await db.execute(query, [rmId]);
  
      res.status(200).json({
        success: true,
        message: "Payments overview fetched successfully.",
        transactions,
        totalTransactions,
        totalPages,
        currentPage: page,
        totalPoints, // Include total points in the response
      });
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  };