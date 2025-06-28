const request = require("supertest");
const app = require("../src/app"); // Adjust path based on your file structure
const pool = require("../src/db"); // Your PostgreSQL pool

// Sample product and user data for testing
const testUser = { user_id: 1 };
const testProducts = [{ product_id: 1, quantity: 2 }];

describe("Order API", () => {

    afterAll(async () => {
        await pool.end(); // Close DB pool after all tests
    });
    let orderId, token;

    test("Should create a sale order successfully", async () => {
        const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email:"admin@example.com",
        password:"admin"
      });
       token= loginRes.body.token;
        const res = await request(app)
            .post("/api/orders")
            .set('Cookie', `token=${token}`)
            .send({
                transaction_type: "sale",
                payment_mode: "cash",
                user_id: testUser.user_id,
                products: testProducts
            });
        orderId = res.body.order_id;
        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty("message", "Order created successfully");
        expect(res.body).toHaveProperty("order_id");
    });

    test("Mard as paid", async () => {
        const res = await request(app)
            .post("/api/orders/mark-paid")
            .set('Cookie', `token=${token}`)
            .send({
                order_id: orderId,
                type: 'sale'
            });
        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('Order marked as paid successfully');
    })

    test("Should fail with missing user_id", async () => {
        const res = await request(app)
            .post("/api/orders")
            .set('Cookie', `token=${token}`)
            .send({
                payment_mode: "cash",
                transaction_type: "sale",
                products: testProducts
            });

        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty("error");
    });

    test("Should fail with empty product list", async () => {
        const res = await request(app)
            .post("/api/orders")
            .set('Cookie', `token=${token}`)
            .send({
                payment_mode: "cash",
                transaction_type: "sale",
                user_id: testUser.user_id,
                products: []
            });

        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty("error");
    });

    test("Should fail if stock is insufficient", async () => {
        const res = await request(app)
            .post("/api/orders")
            .set('Cookie', `token=${token}`)
            .send({
                payment_mode: "cash",
                transaction_type: "sale",
                user_id: testUser.user_id,
                products: [{ product_id: 1, quantity: 100000 }] // assuming this exceeds stock
            });

        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty("error", expect.stringContaining("Product not available or insufficient stock"));
    });

    it('should create a personal order successfully', async () => {
        const res = await request(app)
          .post('/api/orders')
            .set('Cookie', `token=${token}`)
          .send({
            user_id: 1,
            transaction_type: 'personal',
            payment_mode: 'cash',
            total_amount: 100
          });
        const delRes = await request(app)
          .delete(`/api/orders/${res.body.orderId}`)
            .set('Cookie', `token=${token}`);
        expect(delRes.statusCode).toBe(204);
        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty('orderId');
        expect(res.body.transaction_type).toBe('personal');
      });

      it('Delete the order', async () => {
        const res = await request(app)
          .delete(`/api/orders/${orderId}`)
            .set('Cookie', `token=${token}`);
        expect(res.statusCode).toBe(204);
      });
    
      it('should create a purchase order successfully', async () => {
        const res = await request(app)
          .post('/api/orders')
            .set('Cookie', `token=${token}`)
          .send({
                "user_id": 1,
                "total_amount": 5600,
                "payment_mode":"online",
                "transaction_type": "purchase",
                "products": [
                  {
                    "product_name": "TMT Steel Rod",
                    "company": "JSW",
                    "quantity": 50,
                    "actual_price": 100,
                    "selling_price": 120,
                    "category": "construction",
                    "time_for_delivery": 3
                  },
                  {
                    "product_name": "Cement Bag",
                    "company": "Ultratech",
                    "quantity": 30,
                    "actual_price": 200,
                    "selling_price": 250,
                    "category": "construction"
                  }
                ]
                });
        
        const delRes = await request(app)
           .delete(`/api/orders/${res.body.orderId}`)
            .set('Cookie', `token=${token}`)

        expect(delRes.statusCode).toBe(204);
        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty('message');
        expect(res.body).toHaveProperty('orderId');
        expect(res.body.transaction_type).toBe('purchase');
      });
    
      it('should return 400 if required fields are missing', async () => {
        const res = await request(app)
          .post('/api/orders')
            .set('Cookie', `token=${token}`)
          .send({
            user_id: 1,
            // transaction_type missing
            payment_mode: 'cash',
            products: [{ product_id: 1, quantity: 2 }]
          });
    
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error');
      });
      describe('GET /orders/:id', () => {
        it('should fetch an order by ID', async () => {
          const saleRes = await request(app)
            .post('/api/orders')
            .set('Cookie', `token=${token}`)
            .send({
                transaction_type: "sale",
                payment_mode: "cash",
                user_id: testUser.user_id,
                products: testProducts
            });
          const orderId = saleRes.body.order_id;
          const getRes = await request(app).get(`/api/orders/${orderId}`)
            .set('Cookie', `token=${token}`);
          
    
          expect(getRes.statusCode).toBe(200);
          expect(getRes.body).toHaveProperty('order');
          expect(getRes.body.order).toHaveProperty('id');
          expect(getRes.body).toHaveProperty('items');
        });
    
        it('should return 404 for non-existing order', async () => {
          const res = await request(app).get('/api/orders/999999')
            .set('Cookie', `token=${token}`);
          
          expect(res.statusCode).toBe(404);
          expect(res.body).toHaveProperty('error', 'Order not found');
        });
      });
    
      describe('GET /orders', () => {
        it('should fetch all orders', async () => {
          const res = await request(app).get('/api/orders')
            .set('Cookie', `token=${token}`);
          expect(res.statusCode).toBe(200);
          expect(res.body).toHaveProperty('completedOrders');
          expect(res.body).toHaveProperty('orders');
    });
    });
});