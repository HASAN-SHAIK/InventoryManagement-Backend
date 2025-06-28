const express = require('express');
const cors = require('cors');
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

app.use(cors({
    origin: 'https://inventorymanagement-frontend.onrender.com',
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