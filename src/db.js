require('dotenv').config({path: '../'}); // ✅ Load environment variables
const { Pool } = require('pg');


console.log("🔄 Initializing PostgreSQL Connection...");
console.log("🔍 DATABASE_URL:", 'xxxxxxx');//process.env.DATABASE_URL); // Debug log

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // ✅ Use env variable
    ssl: {
        rejectUnauthorized: false, // Required for many managed Postgres services like Neon
    }
});

// pool.connect()
//     .then(() => console.log("✅ PostgreSQL Connected!"))
//     .catch((err) => console.error("❌ Database Connection Failed:", err));

module.exports = pool;