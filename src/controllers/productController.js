const pool = require('../db');
const jwt = require('jsonwebtoken');

// ✅ Get all products
const getProducts = async (req, res) => {
    let {sort} = req.query;
    if(!sort)
        sort = 'name';
    try {
        const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        let result;
        if(decoded.role === 'admin')
        result = await pool.query(`SELECT id, name as Name, company as Company, selling_price, actual_price,stock_quantity as Quantity  FROM products WHERE is_deleted = false order by ${sort}`);
        else
        result = await pool.query(`SELECT id, name as Name, company as Company, selling_price,stock_quantity as Quantity  FROM products WHERE is_deleted = false order by ${sort}`);
        
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
};

// ✅ Add new product
const addProduct = async (req, res) => {
  const {
    product_name,
    category,
    selling_price,
    stock_quantity,
    company,
    actual_price,
    time_for_delivery
  } = req.body;

  try {
    // 1. Check if product already exists with same name and company
    const existing = await pool.query(
      'SELECT * FROM products WHERE name = $1 AND company = $2',
      [product_name, company]
    );

    if (existing.rows.length > 0) {
      // 2. Product exists: update stock and prices
      const existingProduct = existing.rows[0];

      const updated = await pool.query(
        `UPDATE products
         SET stock_quantity = stock_quantity + $1,
             actual_price = $2,
             selling_price = $3
         WHERE id = $4
         RETURNING *`,
        [stock_quantity, actual_price, selling_price, existingProduct.id]
      );

      return res.status(200).json({
        message: 'Product already exists. Stock and prices updated.',
        product: updated.rows[0]
      });
    } else {
      // 3. Product doesn't exist: insert new
      const result = await pool.query(
        `INSERT INTO products (name, category, selling_price, stock_quantity, actual_price, company, time_for_delivery)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [product_name, category, selling_price, stock_quantity, actual_price, company, time_for_delivery]
      );

      return res.status(201).json({
        message: 'New product added.',
        product: result.rows[0]
      });
    }
  } catch (error) {
    console.error("Error adding/updating product:", error);
    res.status(500).json({ error: 'Database error' });
  }
};


// ✅ Update product
const updateProduct = async (req, res) => {
    const { id } = req.params;
    const {selling_price, actual_price, stock_quantity } = req.body;
    try {
        const productRes = await pool.query('select * from products where id = $1', [id]);
        const product = productRes.rows[0];
        // console.log(product)
        // const result = await pool.query(
        //     'UPDATE products SET name = $1, category = $2, selling_price = $3, stock_quantity = $4, actual_price = $5, company = $6 WHERE id = $7 RETURNING *',
        //     [product_name|| product.name, category || product.category, selling_price || product.selling_price, stock_quantity || product.stock_quantity,actual_price || product.actual_price, company || product.company, id]
        // );
        const result = await pool.query(
            'UPDATE products SET  selling_price = $1, actual_price = $2, stock_quantity = $3 WHERE id = $4 RETURNING *',
            [selling_price, actual_price, stock_quantity, id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error, message: 'Database error' });
    }
};

// ✅ Soft delete product
const deleteProduct = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE products SET is_deleted = true WHERE id = $1', [id]);
        res.json({ message: 'Product deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
};

// Search products by name (case-insensitive)
const searchProducts = async (req, res) => {
    try {
        const { name } = req.query;
        if (!name) {
            return res.status(400).json({ error: "Product name is required for search." });
        }
        const query = `
            SELECT * FROM products
            WHERE LOWER(name) LIKE LOWER($1) AND is_deleted = FALSE
        `;
        const values = [`%${name}%`]; // Using LIKE for partial match
        const { rows } = await pool.query(query, values);
        res.status(200).json({ products: rows });
    } catch (error) {
        console.error("Error searching products:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
 }

module.exports = { getProducts, addProduct, updateProduct, deleteProduct, searchProducts };