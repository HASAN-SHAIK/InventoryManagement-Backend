const express = require('express');
const { register, login, deleteUser, logout, getLogin } = require('../controllers/authController');
const roleMiddleware = require('../middleware/roleMiddleware');
const { authMiddleware } = require('../middleware/authMiddleware');
const isAdmin = require('../middleware/isAdmin');
const router = express.Router();


router.post('/register',register);
router.post('/login',login);
router.get('/login', getLogin);
router.delete('/delete',isAdmin, deleteUser);
router.post('/logout', authMiddleware,logout);

module.exports = router;    