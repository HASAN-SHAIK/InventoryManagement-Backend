require('dotenv').config();
const promclient = require("prom-client");

const {apiLimiter, loginLimiter} = require('./middleware/rateLimiter')

const PORT = process.env.PORT || 5000; // Default to 5000 if PORT is not set

const app = require('./app');

// //Prometheus
// const register = new promclient.Registry();
// promclient.collectDefaultMetrics({ register });
// // Define a simple counter metric
// const httpRequestCounter = new promclient.Counter({
//  name: 'http_requests_total',
//  help: 'Total number of HTTP requests',
//  labelNames: ['method', 'route', 'status'],
// });
// const httpRequestDurationMicroseconds = new promclient.Histogram({
//     name: 'http_request_duration_seconds',
//     help: 'Duration of http requests in seconds',
//     labelNames: ['method', 'route', 'status'],
//     buckets: [0.1,0.5, 1, 2, 5]
//    });
// register.registerMetric(httpRequestDurationMicroseconds);
// register.registerMetric(httpRequestCounter);
// // Middleware to count requests
// app.use((req, res, next) => {
//  res.on('finish', () => {
//    httpRequestCounter.labels(req.method, req.path, res.statusCode).inc();
//  });
//  next();
// });

// //middleware to track reponse time
// app.use((req, res, next) => {
//     const start = process.hrtime();
//     res.on('finish',() => {
//         const [seconds, nanoseconds] = process.hrtime(start);
//         const duration = seconds + nanoseconds/1e9;
//         httpRequestDurationMicroseconds.labels(req.method, req.path, req.statusCode).observe(duration);
//     });
//     next();
// })
// // Expose the /metrics endpoint
// app.get('/metrics', async (req, res) => {
//  res.set('Content-Type', register.contentType);
//  res.end(await register.metrics());
// });

// // Middleware
// app.use(apiLimiter);
// app.use(loginLimiter)

// Test API
app.get('/', (req, res) => {
    res.send('Inventory API is running...');
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

//postgre connection
const {Client} = require('pg');
// const client = new Client ({
//     user: "postgres",
//     host: "localhost",
//     database:"inventory_db",
//     password:"postgres",
//     port:5432,
// });
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }  // Needed for Neon
});
client.connect()
.then(()=> console.log("Connected to PostGre"))
.catch((err)=> console.log("Error in Connection to Postgre", err));






module.exports = app;

