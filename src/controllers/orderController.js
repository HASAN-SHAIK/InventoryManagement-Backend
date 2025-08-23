
const pool = require('../db'); // PostgreSQL connection pool
const { createTransaction } = require('./transactionController');

//Get Order Profit
const getProfitByOrderId = async (orderId) => {
    try {
      const query = `
        SELECT 
          oi.quantity,
          oi.price AS selling_price,
          p.cost_price
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1
      `;
  
      const { rows } = await pool.query(query, [orderId]);
  
      let totalProfit = 0, total_price = 0;
  
      for (const item of rows) {
        const profitPerItem = (item.selling_price - item.cost_price) * item.quantity;
        total_price += item.selling_price;
        totalProfit += profitPerItem;
      }
  
      return { order_id: orderId, profit: totalProfit, total_price };
  
    } catch (error) {
      console.error("Error calculating profit:", error.message);
      throw error;
    }
  };

// 🟢 Helper Function: Check Product Availability
const checkProductAvailability = async (client, items) => {
    for (const item of items) {
        const { product_id, quantity } = item;
        const productRes = await client.query(
            'SELECT stock_quantity FROM products WHERE id = $1 AND is_deleted = FALSE FOR UPDATE',
            [product_id]
        );

        if (productRes.rowCount === 0) {
            throw new Error(`Product ID ${product_id} not found or deleted.`);
        }

        const stock = productRes.rows[0].stock_quantity;
        if (stock < quantity) {
            throw new Error(`Insufficient stock for Product ID ${product_id}. Available: ${stock}`);
        }
    }
};

// 🟢 Helper Function: Update Stock and Insert Order Items
const processOrderItems = async (client, orderId, items) => {
    let totalPrice = 0;

    for (const item of items) {
        const { product_id, quantity } = item;

        // Get selling_price of the product
        const priceRes = await client.query('SELECT selling_price FROM products WHERE id = $1', [product_id]);
        const selling_price = priceRes.rows[0].selling_price;
        totalPrice += selling_price * quantity;

        // Insert into order_items
        await client.query(
            'INSERT INTO order_items (order_id, product_id, quantity, selling_price) VALUES ($1, $2, $3, $4)',
            [orderId, product_id, quantity, selling_price]
        );

        // Update product stock
        await client.query(
            'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
            [quantity, product_id]
        );
    }

    return totalPrice;
};

const saleOrder = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const { user_id, products, payment_method, coupon_code } = req.body;
        if (!user_id || products.length == 0)
            return res.status(400).json({ error: "Should have userid, products" });

        let total_price = 0;
        let total_profit = 0;

        // Step 1: Calculate total and update stock
        for (const product of products) {
            const { rows } = await client.query(
                "SELECT selling_price, actual_price, stock_quantity FROM products WHERE id = $1 FOR UPDATE",
                [product.product_id]
            );
            if (rows.length === 0 || rows[0].stock_quantity < product.quantity) {
                throw new Error("Product not available or insufficient stock");
            }
            const { selling_price, actual_price } = rows[0];
            const profit = (selling_price - actual_price) * product.quantity;
            total_price += selling_price * product.quantity;
            total_profit += profit;

            await client.query(
                "UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2",
                [product.quantity, product.product_id]
            );
        }

        // Step 2: Apply coupon discount (if any)
        let discountAmount = 0;
        if (coupon_code) {
            const { rows: couponRows } = await client.query(
                "SELECT * FROM coupons WHERE code = $1 AND isactive = true",
                [coupon_code]
            );
            if (couponRows.length === 0) {
                throw new Error("Invalid or expired coupon code");
            }
            const coupon = couponRows[0];
            if (coupon.discount_type === 'fixed') {
                discountAmount = coupon.discount_value;
            } else if (coupon.discount_type === 'percentage') {
                discountAmount = (total_price * coupon.discount_value) / 100;
            }

            // Optional: deactivate coupon if one-time use
            // if (coupon.used_once) {
            //     await client.query("UPDATE coupons SET is_active = false WHERE id = $1", [coupon.id]);
            // }

            total_price = Math.max(total_price - discountAmount, 0); // Prevent negative price
        }

        // Step 3: Create order
        const orderResult = await client.query(
            "INSERT INTO orders (user_id, total_price, order_status) VALUES ($1, $2, 'pending') RETURNING id",
            [user_id, total_price]
        );
        const order_id = orderResult.rows[0].id;

        // Step 4: Add order_items
        for (const item of products) {
            const productResult = await client.query("SELECT * FROM products WHERE id = $1", [item.product_id]);
            const product = productResult.rows[0];
            await client.query(
                "INSERT INTO order_items (order_id, product_id, quantity, selling_price) VALUES($1, $2, $3, $4)",
                [order_id, product.id, item.quantity, product.selling_price]
            );
        }

        // Step 5: Recalculate profit
        const orderItemsRes = await client.query(
            "SELECT product_id, quantity FROM order_items WHERE order_id = $1",
            [order_id]
        );
        let profit = 0;
        for (const product of orderItemsRes.rows) {
            const profitRes = await client.query(
                "SELECT selling_price - actual_price AS profit FROM products WHERE id = $1",
                [product.product_id]
            );
            profit += profitRes.rows[0].profit * product.quantity;
        }

        // Step 6: Insert into transactions
        await client.query(
            "INSERT INTO transactions (order_id, total_price, transaction_type, profit, payment_mode, coupon_code, discount) VALUES ($1, $2, $3, $4, $5,$6,$7)",
            [order_id, total_price, 'sale', profit, payment_method, coupon_code || null, discountAmount]
        );

        await client.query("COMMIT");
        res.status(201).json({
            message: "Order created successfully",
            order_id,
            total_price,
            discount: discountAmount,
            payment_method,
        });
    } catch (error) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }
};


const createPurchaseOrder = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN"); // Start transaction
        const { user_id, products, total_amount, payment_mode, transaction_type } = req.body;
        if (!products || products.length === 0) {
            return res.status(400).json({ message: "No items provided for purchase" });
        }
        // Step 1: Create the order entry
        const orderQuery = `
            INSERT INTO orders (user_id, total_price, order_status)
            VALUES ($1, $2, 'completed') RETURNING id;
        `;
        const orderResult = await client.query(orderQuery, [user_id, total_amount]);
        const orderId = orderResult.rows[0].id;
        // Step 2: Process each item in the purchase order
        for (let item of products) {
            const { product_name, company, quantity, actual_price, selling_price, category, time_for_delivery } = item;
            // Check if the product already exists
            const productQuery = `SELECT * FROM products WHERE name ilike $1 AND company ilike $2;`;
            const productResult = await client.query(productQuery, [product_name, company]);
            if (productResult.rows.length > 0) {
                // Product exists, update the stock and actual selling_price (weighted average)
                const existingProduct = productResult.rows[0];
                const newQuantity = parseInt(existingProduct.stock_quantity) + parseInt(quantity);
                // Calculate weighted average for actual selling_price
                const totalActualPrice = parseFloat(existingProduct.actual_price * existingProduct.stock_quantity) + parseFloat(actual_price * quantity);
                const newActualPrice =parseFloat(totalActualPrice) / parseFloat(newQuantity);
                const updateProductQuery = `
                    UPDATE products
                    SET stock_quantity = $1, actual_price = $2, selling_price = $3, time_for_delivery = $4
                    WHERE id = $5;
                `;
                await client.query(updateProductQuery, [newQuantity, newActualPrice, selling_price, time_for_delivery, existingProduct.id ]);
            } else {
                // Product does not exist, insert as a new product
                const insertProductQuery = `
                    INSERT INTO products (name, company, stock_quantity, actual_price, selling_price, category,time_for_delivery)
                    VALUES ($1, $2, $3, $4, $5, $6, $7);
                `;
                await client.query(insertProductQuery, [product_name, company, quantity, actual_price, selling_price, category,time_for_delivery]);
            }
            // Step 3: Insert into order_items
            // const insertOrderItemQuery = `
            //     INSERT INTO order_items (order_id, product_name, company, quantity, actual_price, selling_price)
            //     VALUES ($1, $2, $3, $4, $5, $6);
            // `;
            // await client.query(insertOrderItemQuery, [orderId, product_name, company, quantity, actual_price, selling_price]);
        }
        // Step 4: Insert into transactions as a purchase
        const insertTransactionQuery = `
            INSERT INTO transactions (order_id, transaction_type, total_price, profit, payment_mode)
            VALUES ($1, 'purchase', $2, 0, $3);
        `;
        await client.query(insertTransactionQuery, [orderId, total_amount, payment_mode]);
        await client.query("COMMIT"); // Commit transaction
        res.status(201).json({ message: "Purchase order created successfully", transaction_type, orderId });
    } catch (error) {
        await client.query("ROLLBACK"); // Rollback transaction on error
        console.error("Error creating purchase order:", error);
        res.status(500).json({ message: "Internal server error" });
    } finally {
        client.release(); // Release client back to pool
    }
 };

const createPersonalOrder = async (req, res) => {

  const client = await pool.connect();

  try {

    const { user_id, total_amount, payment_method ,transaction_type} = req.body;

    if (!user_id || !total_amount) {

      return res.status(400).json({ error: "User ID and amount are required" });

    }

    await client.query("BEGIN"); // Start transaction

    // 1️⃣ Create a Personal Order

    const orderQuery = `

      INSERT INTO orders (user_id, total_price, order_status)

      VALUES ($1, $2, 'completed')

      RETURNING id;

    `;

    const orderResult = await client.query(orderQuery, [user_id, total_amount]);

    const orderId = orderResult.rows[0].id;

    // 2️⃣ Insert into Transactions (Type: Personal)

    const transactionQuery = `

      INSERT INTO transactions (order_id, transaction_type, total_price,profit, payment_mode)

      VALUES ($1, 'personal', $2, 0,$3);

    `;

    await client.query(transactionQuery, [orderId, total_amount, payment_method]);

    await client.query("COMMIT"); // Commit transaction

    res.status(201).json({ message: "Personal transaction recorded successfully", orderId, transaction_type });

  } catch (error) {

    await client.query("ROLLBACK"); // Rollback on error

    console.error("Error creating personal order:", error);

    res.status(500).json({ error: "Failed to create personal transaction" });

  } finally {

    client.release(); // Release the client

  }

};


// 🟢 Create Order
const createOrder = async (req, res) => {
    const { transaction_type } = req.body;
    const { user_id, products, payment_mode } = req.body;
    if(!user_id || !transaction_type)
        return res.status(400).json({ error: "userId and transaction type should be There"});
    if(transaction_type === 'sale') 
        await saleOrder(req, res);
    else if(transaction_type === 'purchase')
        await createPurchaseOrder(req, res);
    else if(transaction_type === 'personal')
        await createPersonalOrder(req, res);
    else
        res.json({message: "transaction type should be sent for creating order"});
    // const client = await pool.connect();
    // try {
    //     const { type, payment_mode } = req.query;
    //     await client.query("BEGIN");
    //     const { user_id, products } = req.body;
    //     let total_price = 0;
    //     let total_profit = 0;
    //     for (const product of products) {
    //         const { rows } = await client.query(
    //             "SELECT selling_price, actual_price, stock_quantity FROM products WHERE id = $1 FOR UPDATE",
    //             [product.product_id]
    //         );
    //         if (rows.length === 0 || rows[0].stock_quantity < product.quantity) {
    //             throw new Error("Product not available or insufficient stock");
    //         }
    //         const sellingPrice = rows[0].selling_price;
    //         const actualPrice = rows[0].actual_price;
    //         const profit = (sellingPrice - actualPrice) * product.quantity;
    //         total_price += sellingPrice * product.quantity;
    //         total_profit += profit;
    //         await client.query(
    //             "UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2",
    //             [product.quantity, product.product_id]
    //         );

    //     }
    //     const orderResult = await client.query(
    //         "INSERT INTO orders (user_id, total_price, order_status) VALUES ($1, $2, 'pending') RETURNING id",
    //         [user_id, total_price]
    //     );
    //     const order_id = orderResult.rows[0].id;
    //     for (const item of products) {
    //     console.log(item);
    //     const productResult = await client.query("SELECT * from PRODUCTS where id = $1", [item.product_id]);
    //     const product = productResult.rows[0];
    //     console.log(product)
    //     await client.query(
    //         `INSERT INTO order_items (order_id, product_id, quantity, selling_price) VALUES($1, $2, $3, $4)`,
    //         [order_id, product.id, item.quantity, product.selling_price]
    //     );
    //     }
        
    //     await client.query("COMMIT");
    //     res.status(201).json({ message: "Order created successfully", order_id, payment_mode: payment_mode });
    // } catch (error) {
    //     await client.query("ROLLBACK");
    //     res.status(400).json({ error: error.message });
    // } finally {
    //     client.release();
    // }
 };

// 🟢 Get Order by ID
const getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const orderRes = await pool.query('SELECT o.*, u.name, t.transaction_type, t.payment_mode FROM orders o join users u on o.user_id = u.id join transactions t on t.order_id = o.id WHERE o.id = $1', [id]);

        if (orderRes.rowCount === 0) {
            return res.status(404).json({ error: "Order not found" });
        }

        const orderItems = await pool.query(
            'SELECT p.name, o.quantity, o.selling_price FROM order_items o join products p on p.id=o.product_id WHERE o.order_id = $1',
            [id]
        );

        res.json({ order: orderRes.rows[0], items: orderItems.rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 🟢 Get All Orders
const getAllOrders = async (req, res) => {
    try {
        let {sort} = req.query;
        if(!sort)
            sort = 'order_date';
        const ordersRes = await pool.query(`select o.*, u.name as username,t.payment_mode as payment, t.transaction_type as type, t.coupon_code as couponCode from orders o join users u on o.user_id = u.id join transactions t on t.order_id = o.id ORDER BY o.${sort} DESC`);

        if (ordersRes.rowCount === 0) {
            return res.status(404).json({ error: "No orders found" });
        }

        // Fetch order items for each order
        const orders = await Promise.all(
            ordersRes.rows.map(async (order) => {
                const itemsRes = await pool.query(
                    'SELECT p.id as product_id, p.name as product_name, oi.quantity, oi.selling_price FROM order_items oi join products p on p.id = oi.product_id WHERE order_id = $1',
                    [order.id]
                );
                return { ...order, items: itemsRes.rows };
            })
        );
        const completedOrdersRes = await pool.query(`select count(*) as total_orders from orders where order_status = 'completed'`);
        const completedOrders = parseInt(completedOrdersRes.rows[0].total_orders);
        const pendingOrdersRes = await pool.query(`select count(*) as total_orders from orders where order_status = 'pending'`);
        const pendingOrders = parseInt(pendingOrdersRes.rows[0].total_orders);
        const totalOrders = pendingOrders + completedOrders;

        res.json({ orders,  completedOrders: completedOrders, pendingOrders:pendingOrders, totalOrders: totalOrders});
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 🟢 Delete Order
const deleteOrder = async (req, res) => {
    const order_id = req.params.id;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get order details including transaction_type and coupon_id
        const { rows: orderRows } = await client.query(
            'SELECT transaction_type, coupon_code FROM orders JOIN transactions ON orders.id = transactions.order_id WHERE orders.id = $1',
            [order_id]
        );

        if (orderRows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Order not found' });
        }

        const { transaction_type, coupon_code } = orderRows[0];

        if (transaction_type === 'sale') {
            // Restore product quantities
            const { rows: orderItems } = await client.query(
                'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
                [order_id]
            );

            for (const item of orderItems) {
                await client.query(
                    'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2',
                    [item.quantity, item.product_id]
                );
            }
        }

        // OPTIONAL: If you track coupon usage, restore it (e.g., usage_count)
        // if (coupon_code) {
        //     await client.query(
        //         'UPDATE coupons SET max_uses = max_uses - 1 WHERE id = $1 AND max_uses > 0',
        //         [coupon_code]
        //     );
        // }

        // Delete from order_items
        await client.query('DELETE FROM order_items WHERE order_id = $1', [order_id]);

        // Delete from transactions
        await client.query('DELETE FROM transactions WHERE order_id = $1', [order_id]);

        // Delete the order
        await client.query('DELETE FROM orders WHERE id = $1', [order_id]);

        await client.query('COMMIT');
        res.status(204).json({ message: 'Order deleted successfully' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting order:', error);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        client.release();
    }
};


const updateOrder = async (req, res) => {
  const orderId = parseInt(req.params.id);
  const { payment_method, products, coupon_code } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Get old order items
    const { rows: oldOrderItems } = await client.query(
      `SELECT product_id, quantity FROM order_items WHERE order_id = $1`,
      [orderId]
    );

    // 2. Restore stock
    for (const item of oldOrderItems) {
      await client.query(
        `UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2`,
        [item.quantity, item.product_id]
      );
    }

    // 3. Delete old order items
    await client.query(`DELETE FROM order_items WHERE order_id = $1`, [orderId]);

    let newTotalPrice = 0;
    let newProfit = 0;

    // 4. Insert new items and update stock
    for (const product of products) {
      const { product_id, quantity, selling_price } = product;

      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, selling_price)
         VALUES ($1, $2, $3, $4)`,
        [orderId, product_id, quantity, selling_price]
      );

      await client.query(
        `UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2`,
        [quantity, product_id]
      );

      const { rows } = await client.query(
        `SELECT actual_price FROM products WHERE id = $1`,
        [product_id]
      );

      const actualPrice = rows[0].actual_price;

      newTotalPrice += selling_price * quantity;
      newProfit += (selling_price - actualPrice) * quantity;
    }

    // 5. Apply coupon if provided
    let discountAmount = 0;
    if (coupon_code) {
      const { rows: couponRows } = await client.query(
        `SELECT * FROM coupons WHERE code = $1 AND isActive = TRUE`,
        [coupon_code]
      );

      if (couponRows.length === 0) {
        throw new Error('Invalid or inactive coupon');
      }

      const coupon = couponRows[0];

      if (coupon.discount_type === 'flat') {
        discountAmount = parseFloat(coupon.discount_value);
      } else if (coupon.discount_type === 'percent') {
        discountAmount = (newTotalPrice * parseFloat(coupon.discount_value)) / 100;
      }

      newTotalPrice -= discountAmount;
      if (newTotalPrice < 0) newTotalPrice = 0;
    }

    // 6. Update transaction
    await client.query(
      `UPDATE transactions
       SET total_price = $1, profit = $2, payment_mode = $3, discount = $4, coupon_code = $5
       WHERE order_id = $6`,
      [newTotalPrice, newProfit, payment_method, discountAmount, coupon_code || null, orderId]
    );

    // 7. Update order
    await client.query(
      `UPDATE orders
       SET total_price = $1
       WHERE id = $2`,
      [newTotalPrice, orderId]
    );
    

    await client.query('COMMIT');
    res.status(200).json({ message: 'Order updated successfully' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating order:', error.message);

    if (error.message.includes('products_stock_quantity_check')) {
      return res.status(500).json({ error: 'Some product quantities are out of stock. Please check quantities.' });
    } else if (error.message === 'Invalid or inactive coupon') {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to update order' });
  } finally {
    client.release();
  }
};

  

const markOrderAsPaid = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const { order_id, type } = req.body;
        // Update order status
        await client.query(
            "UPDATE orders SET order_status = 'completed' WHERE id = $1;",
            [order_id]
        );
        
        await client.query("COMMIT");
        res.status(200).json({ message: "Order marked as paid successfully" });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error marking order as paid:", error);
        res.status(500).json({ error: "Internal Server Error" });
    } finally {
        client.release();
    }
 };

 const getCategories = async(req, res) => {
    try {
      // Update order status
      const categoryRes = await pool.query("select distinct category from products");
      res.status(200).json({ data: categoryRes.rows});
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error at getCategories" });
    }
 }

const applyCoupon = async (req, res) => {
  const { coupon_code, orderTotal, order_id } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check if the coupon is valid
    const couponResult = await client.query(
      "SELECT * FROM coupons WHERE code = $1 AND isactive = true",
      [coupon_code]
    );

    if (!couponResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Invalid or expired coupon." });
    }

    const coupon = couponResult.rows[0];
    const { discount_type, discount_value } = coupon;

     const transactionResult = await client.query(
      "SELECT discount FROM transactions WHERE order_id = $1",
      [order_id]
    );
    orderTotal = parseFloat(orderTotal) + parseFloat(transactionResult.rows[0].discount || 0);
    // Remove previous coupon (if any) by setting it to NULL
    await client.query(
      "UPDATE transactions SET coupon_code = NULL WHERE order_id = $1",
      [order_id]
    );

    // Apply new coupon
    await client.query(
      "UPDATE transactions SET coupon_code = $1 WHERE order_id = $2",
      [coupon_code, order_id]
    );

    // Calculate discount
    let discount = 0;
    if (discount_type === "percentage") {
      discount = (orderTotal * discount_value) / 100;
    } else {
      discount = discount_value;
    }

    const newTotal = orderTotal - discount;

    await client.query("COMMIT");

    return res.json({ success: true, discount, newTotal });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Coupon apply error:", err);
    return res.status(500).json({ error: "Something went wrong." });
  } finally {
    client.release();
  }
};



 module.exports = {markOrderAsPaid,applyCoupon, createOrder, getAllOrders, getOrderById, updateOrder, deleteOrder, getProfitByOrderId, getCategories}