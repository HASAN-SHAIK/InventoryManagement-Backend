const express = require('express');
const { initiatePayment, phonepeCallback } = require('../controllers/phonepeController');
const router = express.Router();
// const phonepeController = require('../controllers/phonepeController');

router.post('/initiate', initiatePayment);
router.post('/callback', phonepeCallback);


module.exports = router;