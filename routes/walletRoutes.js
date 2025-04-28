const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { auth,isRm, isAdmin } = require('../middlewares/auth');

// 📊 Get current wallet balance (for RM)
router.get('/balance',auth, isRm, walletController.getWalletBalance);

// 📄 Get transaction history (with search & pagination)
router.get('/transactions',auth, isRm, walletController.getTransactionHistory);

// 💸 Admin payout (deduct points from RM)
router.post('/admin-payout',auth, isAdmin, walletController.adminPayout);

//PAYEMENT OVERVIE RM
router.get('/payement-overview',auth,  walletController.getPaymentsOverview);


module.exports = router;
