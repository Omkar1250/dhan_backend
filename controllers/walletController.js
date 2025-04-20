
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
        'UPDATE users SET wallet = wallet - ? WHERE id = ?',
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
  