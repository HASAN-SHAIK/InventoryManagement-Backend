const request = require("supertest");
const app = require("../src/app"); // Adjust path based on your file structure
const pool = require("../src/db"); // Your PostgreSQL pool

describe("product API", () => {

    afterAll(async () => {
        await pool.end(); // Close DB pool after all tests
    });
    let adminToken;
    let productId;
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
    it('Get all Products', async () => {
      const productRes = await request(app)
            .get('/api/products')
            .set('Cookie', `token=${adminToken}`);
        expect(productRes.statusCode).toBe(200);
    });
    
    it('add product', async () => {
          const res = await request(app)
          .post('/api/products')
            .set('Cookie', `token=${adminToken}`)
          .send({
            "product_name": "cement",
            "company": "Sagar Cements",
            "stock_quantity": 50,
            "actual_price": 200,
            "selling_price": 250,
            "category": "construction"
          });
          expect(res.statusCode).toBe(201);
          expect(res.body).toHaveProperty('id');
          productId = res.body.id;
    });

    it('Search the Product', async () => {
        const productRes = await request(app)
          .get('/api/products/search?name=sagar')
            .set('Cookie', `token=${adminToken}`)
        
        expect(productRes.statusCode).toBe(200);
        expect(productRes.body).toHaveProperty('products');
    });

    it('Update product', async () => {
        const res = await request(app)
        .put(`/api/products/${productId}`)
            .set('Cookie', `token=${adminToken}`)
        .send({
          "product_name": "cement",
          "company": "Sagar Cements",
          "stock_quantity": 50,
          "actual_price": 200,
          "selling_price": 260,
          "category": "construction"
        });
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('name');
    });

    it('Delete product', async () => {
        const res = await request(app)
        .delete(`/api/products/${productId}`)
            .set('Cookie', `token=${adminToken}`)

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('Product deleted');
  });

});