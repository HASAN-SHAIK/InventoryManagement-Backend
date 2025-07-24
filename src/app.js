const express = require('express');
const cors = require('cors');
require('dotenv').config({path: '../'});
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const authRoutes = require('./routes/authRoutes');
const reportRoutes = require('./routes/reportRoutes');
const phonepeRoutes = require('./routes/phonepeRoutes');
const app = express();
const cookieParser = require('cookie-parser');
const { authMiddleware } = require('./middleware/authMiddleware');
app.use(cookieParser());
app.use((err, req, res, next) => {
  console.error("💥 Global Error:", err);

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});
const allowedOrigins = [
  'https://inventorymanagement-frontend-qa.onrender.com',
  'https://inventorymanagement-frontend.onrender.com',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

app.use('/api/products',authMiddleware, productRoutes);
app.use('/api/orders',authMiddleware, orderRoutes);
app.use('/api/transactions',authMiddleware, transactionRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/reports',authMiddleware, reportRoutes);
app.use('/api/phonepe', authMiddleware,phonepeRoutes);

module.exports = app;