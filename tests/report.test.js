const request = require("supertest");
const app = require("../src/app"); 
const pool = require("../src/db"); 
const { getDaysInMonth } = require("../utils/dateMethods");

describe("product API", () => {
    let adminToken;
    afterAll(async () => {
        await pool.end(); // Close DB pool after all tests
    });
  it('Login with Admin Creds', async() =>{
      const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email:"admin@example.com",
        password:"admin"
      });
       adminToken= loginRes.body.token;
    }
    )

    it('get Sales Report with from and to date', async () => {
        const salesRes = await request(app)
            .get('/api/reports/sales?from_date=2020-01-01&to_date=2025-01-01')
            .set('Cookie', `token=${adminToken}`);
        expect(salesRes.statusCode).toBe(200);
        expect(salesRes.body).toHaveProperty('total_revenue');
        expect(salesRes.body).toHaveProperty('total_orders');
    })
    it('GetSales without date', async () => {
        const salesRes = await request(app)
            .get('/api/reports/sales')
            .set('Cookie', `token=${adminToken}`);
        expect(salesRes.statusCode).toBe(200);
        expect(salesRes.body).toHaveProperty('total_revenue');
        expect(salesRes.body).toHaveProperty('total_orders');
    })
    it('Get Inventory Report', async() => {
        const salesRes = await request(app)
            .get('/api/reports/inventory')
            .set('Cookie', `token=${adminToken}`)
        expect(salesRes.statusCode).toBe(200);
        expect(salesRes.body).toHaveProperty('total_stock');
        expect(salesRes.body).toHaveProperty('low_stock_products');
    })
    it('Get Profit Report', async() => {
        let to_date = new Date();
        to_date.setMonth(to_date.getMonth()-1);
        to_date.setDate(getDaysInMonth(to_date.getMonth()+1, to_date.getYear()));
        const salesRes = await request(app)
        .get('/api/reports/profit')
            .set('Cookie', `token=${adminToken}`)
        expect(salesRes.statusCode).toBe(200);
        expect(salesRes.body.to_date.split('T')[0] == to_date.toISOString().split( "T" )[0]).toBe(true);
    })
    it('Get Daily Sales Report', async() => {
        const salesRes = await request(app)
        .get('/api/reports/daily')
            .set('Cookie', `token=${adminToken}`)
        expect(salesRes.statusCode).toBe(200);
        expect(salesRes.body).toHaveProperty('total_revenue');
        expect(salesRes.body).toHaveProperty('date');
    })
});