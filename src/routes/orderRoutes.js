const express = require('express');
const router = express.Router();
const { createOrder,
    getAllOrders,
    getOrderById,
    updateOrder,
    deleteOrder, 
    markOrderAsPaid,
    getCategories,
    applyCoupon} = require('../controllers/orderController');
const { authMiddleware } = require('../middleware/authMiddleware');
const isAdmin = require('../middleware/isAdmin');

router.get('/getcategories', getCategories);
router.get('/', getAllOrders);
router.get('/:id', getOrderById)
router.post('/', createOrder);
router.put('/:id', updateOrder);
router.delete('/:id', deleteOrder);
router.post('/mark-paid', markOrderAsPaid);
router.post('/apply-coupon', applyCoupon);

module.exports = router;