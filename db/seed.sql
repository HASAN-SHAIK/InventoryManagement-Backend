-- Clear existing data
TRUNCATE TABLE transactions, orders, products, users RESTART IDENTITY CASCADE;

-- Insert Users
INSERT INTO users (name, email, password, role) VALUES
('admin', 'admin@example.com', '$2b$10$d9W.TpiRocR4egR8TcAXCeJ1UpDokEQXNVCu7XhTeFOVGejFLFuES', 'admin'),
('staff', 'staff@example.com', '$2b$10$Jp4F6.jurJAEGyRryuPMB.05IKCRp13rTpP04gpxJQ.uPQRVz/nZW', 'staff');

-- Insert Products (With Actual selling_price for Profit Calculation)
INSERT INTO products (name, category, selling_price, actual_price,company, stock_quantity, is_deleted, time_for_delivery) VALUES
('Laptop', 'Electronics', 50000.00, 40000.00,'Dell', 10, FALSE, 5),
('Smartphone', 'Electronics', 30000.00, 25000.00,'Apple', 15, FALSE, 7),
('Headphones', 'Accessories', 5000.00, 3000.00,'Boat',50, FALSE, 2),
('Office Chair', 'Furniture', 8000.00, 6000.00, 'Wipro', 60, FALSE, 4);

-- Insert Orders (Initially Pending)
INSERT INTO orders (user_id, total_price, order_status) VALUES
(1, 100000.00, 'pending'),
(2, 5000.00, 'pending');

-- Insert Transactions (With Profit Calculation)
INSERT INTO transactions (order_id, total_price, profit, transaction_type, payment_mode) VALUES
(1, 100000.00, (50000.00 - 40000.00) * 2 + (30000.00 - 25000.00) * 1, 'sale', 'cash'),
(2, 5000.00, (5000.00 - 3000.00) * 1, 'sale', 'online');

--Insert the Order items
insert into order_items (order_id, product_id, quantity, selling_price) VALUES(1, 1, 2, 50000.00);
insert into order_items (order_id, product_id, quantity, selling_price) VALUES(2, 3, 1, 5000.00);

-- FLAT DISCOUNT COUPONS
INSERT INTO coupons (code, discount_type, discount_value, isActive, expires_at)
VALUES 
('FLAT100', 'flat', 100, true, NOW() + INTERVAL '1 year'),
('FLAT200', 'flat', 200, true, NOW() + INTERVAL '1 year'),
('FLAT300', 'flat', 300, true, NOW() + INTERVAL '1 year'),
('FLAT400', 'flat', 400, true, NOW() + INTERVAL '1 year'),
('FLAT500', 'flat', 500, true, NOW() + INTERVAL '1 year');

-- PERCENTAGE DISCOUNT COUPONS
INSERT INTO coupons (code, discount_type, discount_value, isActive, expires_at)
VALUES 
('PERC5', 'percentage', 5, true, NOW() + INTERVAL '1 year'),
('PERC10', 'percentage', 10, true, NOW() + INTERVAL '1 year'),
('PERC15', 'percentage', 15, true, NOW() + INTERVAL '1 year'),
('PERC20', 'percentage', 20, true, NOW() + INTERVAL '1 year');


-- //Command to run psql -U postgres -d inventory_db -f ./seed.sql