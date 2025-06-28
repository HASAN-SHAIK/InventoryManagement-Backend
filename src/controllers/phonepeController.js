const axios = require('axios');
const crypto = require('crypto');
const { getProfitByOrderId } = require('./orderController');

const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
const SALT_KEY = process.env.PHONEPE_SALT_KEY;
const SALT_INDEX = process.env.PHONEPE_SALT_INDEX;
const BASE_URL = process.env.PHONEPE_BASE_URL; // Use production URL for live

exports.initiatePayment = async (req, res) => {
  const { amount, userId, orderId } = req.body;

  const payload = {
    merchantId: MERCHANT_ID,
    merchantTransactionId: orderId,
    merchantUserId: userId,
    amount: amount * 100, // In paise
    redirectUrl: `http://localhost:5000/phonepe/redirect`,
    redirectMode: 'POST',
    callbackUrl: `http://localhost:5000/api/phonepe/callback`,
    paymentInstrument: {
      type: 'PAY_PAGE'
    }
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
  const stringToSign = `${encodedPayload}/pg/v1/pay${SALT_KEY}`;
  const xVerify = crypto.createHash('sha256').update(stringToSign).digest('hex') + `###${SALT_INDEX}`;

  try {
    const response = await axios.post(`${BASE_URL}/pg/v1/pay`, { request: encodedPayload }, {
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerify
      }
    });

    const redirectUrl = response.data.data.instrumentResponse.redirectInfo.url;
    res.json({ success: true, url: redirectUrl });
  } catch (err) {
    console.error('PhonePe Initiate Error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Payment initiation failed' });
  }
};

const updateTransactionStatus = async (transactionId, status) => {
    try {
      const {profit, total_price} = await getProfitByOrderId(transactionId);
      await pool.query(
        `INSERT INTO transactions (order_id, total_price, profit, payment_method, transaction_type) VALUES($1, $2, $3, 'online', 'sale')`,
        [transactionId, total_price, profit]
      );
  
      // Optionally update order status too:
      if (status === "SUCCESS") {
        await pool.query(
          `UPDATE orders 
           SET order_status = 'completed' 
           WHERE id = $1`,
          [transactionId]
        );
      }
    } catch (error) {
      console.error("Error updating transaction:", error.message);
    }
};
exports.phonepeCallback = async (req, res) => {
    try {
        const { transactionId } = req.body.data; // PhonePe sends the transaction ID here
    
        const statusURL = `/pg/v1/status/${MERCHANT_ID}/${transactionId}`;
        const baseString = `${statusURL}${SALT_KEY}`;
        const xVerify = crypto.createHash("sha256").update(baseString).digest("hex") + "###" + SALT_INDEX;
    
        const response = await axios.get(`https://api-preprod.phonepe.com/apis/pg-sandbox${statusURL}`, {
          headers: {
            "Content-Type": "application/json",
            "X-VERIFY": xVerify,
            "X-MERCHANT-ID": MERCHANT_ID,
          },
        });
    
        const paymentData = response.data.data;
        const paymentStatus = paymentData.paymentStatus;
        if(paymentStatus === 'SUCCESS'){
        await updateTransactionStatus(transactionId, paymentStatus);
        return res.status(200).send("Callback received and transaction updated");
        }
        return res.status(400).send("paymentStatus is Unsuccess");
      } catch (err) {
        console.error("PhonePe Callback Error:", err.message);
        return res.status(500).send("Error handling callback");
      }
};
