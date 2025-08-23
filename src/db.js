require("dotenv").config();
const { Pool } = require('pg');

const poolConfig = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: false,
};

const MAX_RETRIES = 5;
const RETRY_DELAY = 2000; // ms
const pool = new Pool(poolConfig);

async function connectWithRetry(retries = MAX_RETRIES, delay = RETRY_DELAY) {
    console.log('DB_PASSWORD type:', typeof process.env.DB_PASSWORD);
    for (let i = 0; i < retries; i++) {
        try {
            await pool.query('SELECT 1'); // Simple test query
            console.log('✅ PostgreSQL Pool Connected!');
            return pool;
        } catch (err) {
            console.error(`❌ Pool connection attempt ${i + 1} failed:`, err.message);
            if (i < retries - 1) {
                await new Promise(res => setTimeout(res, delay));
                console.log('Retrying...');
            } else {
                console.error('❌ All pool connection attempts failed.');
                throw err;
            }
        }
    }
}

connectWithRetry();
module.exports = pool;
