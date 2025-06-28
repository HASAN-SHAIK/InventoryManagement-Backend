// require('dotenv').config();
const request = require('supertest');
const pool = require('../src/db'); // DB connection
const app = require('../src/app'); // Adjust path

describe('🔑 Auth API Tests', () => {
 let token;
 test('should register a new user', async () => {
   const res = await request(app).post('/api/auth/register').send({
     name: 'Test User',
     email: 'testuser@example.com',
     password: 'Test@1234',
     role: 'admin'
   });
   expect(res.statusCode).toBe(201);
   expect(res.body).toHaveProperty('message', 'User registered');
 });
 test('should log in and receive a token', async () => {
   const res = await request(app).post('/api/auth/login').send({
     email: 'testuser@example.com',
     password: 'Test@1234'
   });
   expect(res.statusCode).toBe(200);
   expect(res.body).toHaveProperty('token');
   token = res.body.token;
 });
 
 test('should not allow access without token', async () => {
   const res = await request(app).get('/api/products');
   expect(res.statusCode).toBe(401);
   expect(res.body).toHaveProperty('message', 'Access Denied');
 });
 test('should allow access getting products with valid token', async () => {
   const res = await request(app)
     .get('/api/orders')
     .set('Cookie', `token=${token}`);
   expect(res.statusCode).toBe(200);
 });
 test('Delete the user with valid token', async () => {
  const res = await request(app)
     .delete('/api/auth/delete')
     .set('Cookie', `token=${token}`)
     .send({
      email: 'testuser@example.com'
     })
    expect(res.statusCode).toBe(204);
    // expect(res.body).toHaveProperty('message','User Deleted');
 })
 afterAll(async () => {
   await pool.end(); // ✅ Close DB connection
  //  await client.end();
 });
});