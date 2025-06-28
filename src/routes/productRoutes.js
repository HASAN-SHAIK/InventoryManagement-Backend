const express = require('express');
const router = express.Router();
const { getProducts, addProduct, updateProduct, deleteProduct, searchProducts } = require('../controllers/productController');
const {  authMiddleware } = require('../middleware/authMiddleware');
const isAdmin = require('../middleware/isAdmin');

router.get('/', getProducts);
router.get('/search', searchProducts);
router.post('/', isAdmin, addProduct);
router.put('/:id',isAdmin, updateProduct);
router.delete('/:id', isAdmin, deleteProduct);

module.exports = router;