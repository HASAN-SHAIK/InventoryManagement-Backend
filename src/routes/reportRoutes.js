const express = require('express');
const router = express.Router();
const { getSalesReport, getInventoryReport, getDailySalesReport, getProfitReport } = require('../controllers/reportController');
const {authMiddleware} = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const isAdmin = require('../middleware/isAdmin');

// ❌ Only Admins can access reports
router.get('/sales' , getSalesReport);
router.get('/inventory',  getInventoryReport);
router.get('/daily', getDailySalesReport);
router.get('/profit', getProfitReport); 

module.exports = router;