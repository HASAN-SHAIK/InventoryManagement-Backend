const pool = require('../db'); // Database connection
const jwt = require("jsonwebtoken");

// 💳 Create a Transaction (Payment Processing)
const createTransaction = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start transaction

        const { order_id, payment_method, amount_paid } = req.body;
        
        // 🔍 Check if order exists and fetch total selling_price
        const orderQuery = `SELECT total_price, order_status FROM orders WHERE id = $1 FOR UPDATE`;
        const orderRes = await client.query(orderQuery, [order_id]);

        if (orderRes.rows.length === 0) {
            throw new Error(`Order ID ${order_id} not found`);
        }

        const { total_price, order_status } = orderRes.rows[0];

        // 🚨 Prevent duplicate payments or processing canceled orders
        if (order_status === 'completed') {
            throw new Error(`Order ID ${order_id} is already paid`);
        } else if (order_status === 'canceled') {
            throw new Error("Cannot process payment for a canceled order");
        }

        // 🔍 Validate amount paid
        if (amount_paid !== total_price) {
            throw new Error(`Amount paid (${amount_paid}) does not match order total (${total_price})`);
        }

        // 💾 Insert transaction
        const transactionQuery = `
            INSERT INTO transactions (order_id, total_price, payment_method, transaction_type)
            VALUES ($1, $2, $3, 'sale') RETURNING id;
        `;
        const transactionRes = await client.query(transactionQuery, [order_id, total_price, payment_method]);
        const transactionId = transactionRes.rows[0].id;

        // ✅ Mark order as completed
        const updateOrderQuery = `UPDATE orders SET order_status = 'completed' WHERE id = $1;`;
        await client.query(updateOrderQuery, [order_id]);

        await client.query('COMMIT'); // Commit transaction
        res.status(201).json({ message: 'Payment successful', transactionId });

    } catch (error) {
        await client.query('ROLLBACK'); // Rollback on failure
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }
};

// 📜 Get All Transactions
const getAllTransactions = async (req, res) => {
    try {
                  
        // let {from_date, to_date} = req.query;
        // if(!to_date || !from_date){
        //     to_date = new Date().toISOString().split( "T" )[0];
        //     from_date = new Date();
        //     from_date.setDate(from_date.getDate()-30);
        //     from_date = from_date.toISOString().split( "T" )[0];
        // }

        // console.log(from_date, to_date)
        // const query = `
        //     SELECT top 20 t.*, o.user_id, o.order_status
        //     FROM transactions t
        //     JOIN orders o ON t.order_id = o.id
		// 	where t.transaction_date BETWEEN $1 and $2
        //     ORDER BY t.transaction_date DESC;
        // `;        
        const query = `
        SELECT t.*, u.name as user , o.order_status
        FROM transactions t
        JOIN orders o ON t.order_id = o.id
        JOIN users u on o.user_id = u.id
        ORDER BY t.transaction_date DESC
        LIMIT 20;
        `;
        const query2 = `select sum(total_price) as total_cash from transactions where payment_mode ='cash' and transaction_type = 'sale'`
        const query3 = `select sum(total_price) as total_cash from transactions where payment_mode ='online' and transaction_type = 'sale'`
        const purchaseCash = `select sum(total_price) as total_cash from transactions where payment_mode ='cash' and transaction_type = 'purchase'`
        const purchaseOnline = `select sum(total_price) as total_cash from transactions where payment_mode ='online' and transaction_type = 'purchase'`
        const personalCash = `select sum(total_price) as total_cash from transactions where payment_mode ='cash' and transaction_type = 'personal'`
        const personalOnline = `select sum(total_price) as total_cash from transactions where payment_mode ='online' and transaction_type = 'personal'`
        const query4 = `select sum(profit) as profit from transactions`;
        const result = await pool.query(query);
        const result2 = await pool.query(query2);
        const result3 = await pool.query(query3);
        const result4 = await pool.query(query4);
        const purchaseCashRes = await pool.query(purchaseCash);
        const purchaseOnlineRes = await pool.query(purchaseOnline);
        const personalCashRes = await pool.query(personalCash);
        const personalOnlineRes = await pool.query(personalOnline);
        // console.log(personalCashRes.rows[0].total_cash, typeof(personalCashRes.rows[0].total_cash));
        // const total_cash = parseFloat(result2.rows[0].total_cash) || 0 - parseFloat(personalCashRes.rows[0].total_cash) || 0;

        const total_cash = (parseFloat(result2.rows[0].total_cash) || 0) - (parseFloat(personalCashRes.rows[0].total_cash) || 0) - (parseFloat(purchaseCashRes.rows[0].total_cash) || 0);
        const total_online = (parseFloat(result3.rows[0].total_cash) || 0) - (parseFloat(personalOnlineRes.rows[0].total_cash) || 0) - (parseFloat(purchaseOnlineRes.rows[0].total_cash) || 0);
        const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        if(decoded.role !== 'admin')
            return res.json({
                transactions: result.rows,
                message: "Haha! You are not admin :)"
        }) 
        else
        return res.status(200).json({
            total_cash: total_cash,
            total_online: total_online,
            total_income: total_cash +total_online,
            profit: result4.rows[0].profit,
            transactions: result.rows,
    });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 🛑 Rollback Transaction (In case of refund or failure)
const rollbackTransaction = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { transaction_id } = req.body;

        // Get transaction details
        const transactionQuery = `SELECT order_id, total_price FROM transactions WHERE id = $1 FOR UPDATE;`;
        const transactionRes = await client.query(transactionQuery, [transaction_id]);

        if (transactionRes.rows.length === 0) {
            throw new Error(`Transaction ID ${transaction_id} not found`);
        }

        const { order_id, total_price } = transactionRes.rows[0];

        // 🚨 Check if transaction was already refunded
        const existingRefundQuery = `SELECT id FROM transactions WHERE order_id = $1 AND transaction_type = 'refund';`;
        const refundRes = await client.query(existingRefundQuery, [order_id]);

        if (refundRes.rows.length > 0) {
            throw new Error("Transaction already refunded");
        }

        // 🔄 Insert refund transaction
        const refundQuery = `
            INSERT INTO transactions (order_id, total_price, payment_method, transaction_type)
            VALUES ($1, $2, 'refund', 'refund') RETURNING id;
        `;
        const refundResInsert = await client.query(refundQuery, [order_id, total_price]);

        // ✅ Mark order as pending for further processing
        const updateOrderQuery = `UPDATE orders SET order_status = 'pending' WHERE id = $1`;
        await client.query(updateOrderQuery, [order_id]);

        await client.query('COMMIT');
        res.status(200).json({ message: 'Transaction rolled back successfully', refundTransactionId: refundResInsert.rows[0].id });

    } catch (error) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }
};

// const withdrawMoney =async (req, res) => {
//     const {amount} = req.body;
//     try {
//         await pool.query(`INSERT into transactions `)
//     } catch (error) {
        
//     }
// }

module.exports = { createTransaction, getAllTransactions, rollbackTransaction };