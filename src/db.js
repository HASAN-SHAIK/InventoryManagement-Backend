require("dotenv").config();
const { Pool } = require('pg');

// Determine pool configuration - support both URL and individual details
const poolConfig = process.env.DATABASE_URL 
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT || 5432,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
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
