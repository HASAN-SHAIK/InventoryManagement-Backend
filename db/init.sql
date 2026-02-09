-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role VARCHAR(50) CHECK (role IN ('admin', 'staff')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE shop_details (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,    
    shop_name VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255),    
    mobile_number VARCHAR(15) NOT NULL,
    alternate_mobile VARCHAR(15),
    gst_number VARCHAR(20),
    pan_number VARCHAR(20),
    address_line TEXT NOT NULL,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_shop_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- Products Table (Soft Delete)
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255),
    selling_price DECIMAL(10,2) NOT NULL CHECK (selling_price >= 0),
    stock_quantity INT NOT NULL CHECK (stock_quantity >= 0),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    company VARCHAR(255),
    actual_price Decimal(10,2),
    time_for_delivery Decimal(2,0)
);

-- Orders Table (removing JSONB products)
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    total_price DECIMAL(10,2) NOT NULL CHECK (total_price >= 0),
    client_order_id UUID,
    order_status VARCHAR(20) DEFAULT 'pending' CHECK (order_status IN ('pending', 'completed', 'canceled')),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- Order Items Table (Mapping Products to Orders)
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE, -- ✅ Delete order items if order is deleted
    product_id INT REFERENCES products(id) ON DELETE SET NULL, -- ✅ Preserve sales data even if product is deleted
    quantity INT NOT NULL CHECK (quantity > 0),
    selling_price DECIMAL(10,2) NOT NULL CHECK (selling_price >= 0)
);

-- Transactions Table (Links to Orders)
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE, -- ✅ Links to full order
    total_price DECIMAL(10,2) NOT NULL,
    transaction_type VARCHAR(10) CHECK (transaction_type IN ('sale', 'purchase', 'personal')),
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    profit Decimal(10,2),
    payment_mode VARCHAR(10) CHECK (payment_mode IN ('cash', 'online'))
);

--Coupon Table
CREATE TABLE coupons (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_type VARCHAR(10) CHECK (discount_type IN ('percentage', 'flat')) NOT NULL,
  discount_value NUMERIC(10, 2) NOT NULL,
  isActive BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);


-- ✅ Indexes for Performance
-- Users Indexes
CREATE INDEX idx_users_email ON users(email);

-- Products Indexes
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category ON products(category);

-- Orders Indexes
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(order_status);
CREATE UNIQUE INDEX IF NOT EXISTS orders_client_order_id_uniq
ON orders (client_order_id);

-- Order Items Indexes (New Table)
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- Transactions Indexes
CREATE INDEX idx_transactions_order_id ON transactions(order_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
