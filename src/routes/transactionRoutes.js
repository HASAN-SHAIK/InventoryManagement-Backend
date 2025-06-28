const express = require('express');
const router = express.Router();
const { createTransaction, getAllTransactions, rollbackTransaction } = require('../controllers/transactionController');
const { authMiddleware } = require('../middleware/authMiddleware');
const isAdmin = require('../middleware/isAdmin');

// 💳 Process a Payment (Create Transaction)
router.post('/', createTransaction);

// 📜 Get All Transactions
router.get('/', getAllTransactions);

// 🔄 Rollback a Transaction (Refund or Failure)
router.post('/rollback',isAdmin, rollbackTransaction);

module.exports = router;