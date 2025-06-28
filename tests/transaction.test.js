const request = require("supertest");
const app = require("../src/app"); 
const pool = require("../src/db"); 

describe("Transaction API", () => {
    let adminToken;
    afterAll(async () => {
        await pool.end(); // Close DB pool after all tests
    });
    it('Login for Token', async() => {
        const res = await request(app)
        .post('/api/auth/login')
        .send({
            email: 'admin@gmail.com',
            password: 'admin',
        });
        expect(res.statusCode).toBe(200);
        adminToken = res.body.token;        
    });
    
    it('Get All Transactions', async() => {
        const res = await request(app)
        .get('/api/transactions/')
        .set('Cookie', `token=${adminToken}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.total_cash + res.body.total_online == res.body.total_income).toBe(true);
        expect(res.body.transactions.length).toBeGreaterThan(-1);
    });

    
});