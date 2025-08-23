-- Disable foreign key checks (only needed for MySQL, PostgreSQL doesn't need this)
-- SET session_replication_role = 'replica';

-- 🗑️ Delete existing data
TRUNCATE TABLE transactions RESTART IDENTITY CASCADE;
TRUNCATE TABLE order_items RESTART IDENTITY CASCADE;
TRUNCATE TABLE orders RESTART IDENTITY CASCADE;
TRUNCATE TABLE products RESTART IDENTITY CASCADE;
TRUNCATE TABLE users RESTART IDENTITY CASCADE;

-- Enable foreign key checks back (if disabled)
-- SET session_replication_role = 'origin';

-- ✅ Re-insert fresh data

-- Insert users (Example: Admin & Customers)
INSERT INTO users (name, email,password, role) VALUES(
('Admin User', 'admin@example.com','admin', 'admin'),
('John Doe', 'john@example.com','john', 'staff'),
('Alice Smith', 'alice@example.com','alice', 'staff'));

-- Insert products
INSERT INTO products (name, description, selling_price, stock) VALUES(
('Laptop', '15-inch gaming laptop', 80000, 10),
('Mouse', 'Wireless optical mouse', 1500, 50),
('Keyboard', 'Mechanical keyboard', 3500, 30));

-- Insert orders
INSERT INTO orders (user_id, total_amount, status) VALUES(
(2, 81500, 'completed'),
(3, 5000, 'pending'));

-- Insert order details (Linking orders & products)
INSERT INTO order_items (order_id, product_id, quantity, selling_price) VALUES(
(1, 1, 1, 80000), -- John bought a Laptop
(1, 2, 1, 1500),  -- John bought a Mouse
(2, 3, 2, 3500));  -- Alice bought 2 Keyboards

-- Insert transactions (Simulating payments)
INSERT INTO transactions (order_id,total_price,transaction_type,profit,  payment_mode, status) VALUES(
(1, 'UPI', 'successful'),
(2, 'Card', 'pending'));