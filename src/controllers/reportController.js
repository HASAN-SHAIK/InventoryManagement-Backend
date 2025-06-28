const { getDaysInMonth } = require('../../utils/dateMethods');
const jwt = require("jsonwebtoken");

const pool = require('../db');
// 📊 **Total Sales Report**
//Today and LastMonth Review
const getSalesReport = async (req, res) => {
   try {
        //Checking role
        const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        if(decoded.role !== 'admin')
            return res.json({
                message: "Haha! You are not admin :)"
            });
    
       let { from_date, to_date } = req.query;
       // If no dates are provided, use today's date
       if (!from_date || !to_date) {
        to_date = new Date();
        from_date = new Date();
        from_date.setDate(to_date.getDate() - 30);
       }
       // Fetch Total Revenue
       const revenueResult = await pool.query(
           "SELECT SUM(total_price) AS total_revenue FROM orders WHERE order_status = 'completed' AND order_date BETWEEN $1 AND $2;",
           [from_date, to_date]
       );
       // Fetch Total Orders
       const ordersResult = await pool.query(
           "SELECT COUNT(*) AS total_orders FROM orders WHERE order_status = 'completed' AND order_date BETWEEN $1 AND $2;",
           [from_date, to_date]
       );

        // Total Cost (How much we paid for sold products)
        const costResult = await pool.query(
                `SELECT SUM(oi.quantity * p.actual_price) AS total_cost
                 FROM order_items oi
                 JOIN products p ON oi.product_id = p.id
                 JOIN orders o ON oi.order_id = o.id
                 WHERE o.order_status = 'completed' and o.order_date BETWEEN $1 and $2;`,
                 [from_date, to_date]
        );

        // const totalProfitRes = await pool.query('select sum(profit) as total_profit from transactions where transaction_date = $1', [to_date])
        const totalRevenue = revenueResult.rows[0].total_revenue || 0;
        const totalCost = costResult.rows[0].total_cost || 0;
        const totalProfit = totalRevenue - totalCost;
        const bestSellingProducts = await getBestSellingProducts();
        const profitByProductResult = await getprofitByProductResult();

       return res.json({
           total_revenue: revenueResult.rows[0].total_revenue || 0,
           total_orders: ordersResult.rows[0].total_orders || 0,
           totalProfit: totalProfit,
           bestSellingProducts: bestSellingProducts.rows,
           profitByProduct: profitByProductResult.rows,
       });}
 catch (error) {
       console.error("Error fetching sales report:", error);
       res.status(500).json({ message: "Internal server error" });
   }
};

const getBestSellingProducts = async () =>{
    // Fetch Best-Selling Products
    const bestSellingResult = await pool.query(
            `select  sum(t.profit) as Profit, p.name as Name,p.company as Company, sum(oi.quantity) as NoOfSold from order_items oi 
              join transactions t on t.order_id = oi.order_id
              join products p on p.id = oi.product_id
              group by p.id order by NoOfSold desc`
    );
    return bestSellingResult;
}

const getprofitByProductResult = async () => {
    // Profit by Product
    const profitByProductResult = await pool.query(
        `select  sum(t.profit) as Profit, p.name as Name,p.company as Company, sum(oi.quantity) as NoOfSold, p.selling_price as Price from order_items oi 
        join transactions t on t.order_id = oi.order_id
        join products p on p.id = oi.product_id
        group by p.id order by Profit desc`
    );
    return profitByProductResult;
}
// 📦 **Inventory Stock Report**
const getInventoryReport = async (req, res) => {
    try {
        const { threshold = 5 } = req.query; // Default threshold = 5
        // Total Stock Count
        const totalStockResult = await pool.query(
            "SELECT SUM(stock_quantity) AS total_stock FROM products WHERE is_deleted = FALSE;"
        );
        // Low Stock Products (Threshold based)
        const lowStockResult = await pool.query(
            "SELECT id as ProductId, name as Name,stock_quantity as Quantity, actual_price as ActualPrice , company as Seller,time_for_delivery as TimeForDelivery FROM products WHERE stock_quantity > 0 AND stock_quantity <= $1 AND is_deleted = FALSE order by stock_quantity",
            [threshold]
        );
        // Out of Stock Products
        const outOfStockResult = await pool.query(
            "SELECT id as ProductId, name as Name, actual_price as ActualPrice , company as Seller,time_for_delivery as TimeForDelivery FROM products WHERE stock_quantity = 0 AND is_deleted = FALSE;"
        );
        // Total Inventory Value
        const stockValueResult = await pool.query(
            "SELECT SUM(stock_quantity * selling_price) AS total_inventory_value FROM products WHERE is_deleted = FALSE;"
        );
        // Estimated Profit
        const actual_stock_value = await pool.query(
            "SELECT SUM(stock_quantity * actual_price) AS total_inventory_actual_value FROM products WHERE is_deleted = FALSE;"
        )
        const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        res.json({
            total_stock: totalStockResult.rows[0].total_stock || 0,
            low_stock_products: lowStockResult.rows,
            out_of_stock_products: outOfStockResult.rows,
            total_inventory_value: decoded.role === 'admin' ?stockValueResult.rows[0].total_inventory_value || 0 : null,
            total_inventory_actual_value: actual_stock_value.rows[0].total_inventory_actual_value, 
            estimatedProfit: decoded.role === 'admin'? stockValueResult.rows[0].total_inventory_value - actual_stock_value.rows[0].total_inventory_actual_value: null,
        });

    } catch (error) {
        console.error("Error fetching inventory report:", error);
        res.status(500).json({ message: "Internal server error" });
    }
 };

 const getProfitReport = async (req, res) => {
    try {  
        const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        if(decoded.role !== 'admin')
            return res.json({
                message: "Haha! You are not admin :)"
        })             
        let { from_date, to_date } = req.query;
        let dateFilter = "";
        let values = [];
        if (!from_date || !to_date) {
            to_date = new Date();
            from_date = new Date();
            from_date.setMonth(from_date.getMonth()-1);
            to_date.setMonth(to_date.getMonth()-1);
            from_date.setDate(1);
            to_date.setDate(getDaysInMonth(to_date.getMonth()+1, to_date.getYear()));
        }
        if (from_date && to_date) {
            dateFilter = "AND t.transaction_date BETWEEN $1 AND $2";
            values.push(from_date, to_date);
        }
        // Total Revenue (Completed Sales)
        const revenueResult = await pool.query(
            `SELECT SUM(o.total_price) AS total_revenue
             FROM orders o
             JOIN transactions t ON o.id = t.order_id
             WHERE o.order_status = 'completed' ${dateFilter};`,
            values
        );
        // Total Profit (How much we Got for sold products)
        const profitResult = await pool.query(
            `select sum(profit) as total_profit from transactions where transaction_date  BETWEEN $1 and $2;`, [from_date, to_date]
        );

        const totalProductsRes = await pool.query(`select count(*) as total_products from products`);
       
        const totalRevenue = revenueResult.rows[0].total_revenue || 0;
        // const totalCost = costResult.rows[0].total_cost || 0;
        // const totalProfit = totalRevenue - totalCost;
        res.json({
            total_revenue: totalRevenue,
            total_profit: profitResult.rows[0].total_profit,
            total_products: totalProductsRes.rows[0].total_products,
            from_date,
            to_date
        });
    } catch (error) {
        console.error("Error fetching profit report:", error);
        res.status(500).json({ message: "Internal server error" });
    }
 };


const getDailySalesReport = async (req, res) => {
    try {   
        const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        if(decoded.role !== 'admin')
            return res.json({
                message: "Haha! You are not admin :)"
        })
        let { date } = req.query;
        if(!date){
            date = new Date();
        }
        let salesDate = date || new Date().toISOString().split("T")[0]; // Default to today
        salesDate.setHours(0,0,0,0);
        // Total Sales Revenue for the day
        const salesResult = await pool.query(
            `SELECT SUM(o.total_price*oi.quantity) AS total_revenue
             FROM orders o join order_items oi on oi.order_id = o.id
             join transactions t on t.order_id = o.id
             WHERE o.order_status = 'completed'
             AND t.transaction_type = 'sale' 
             AND DATE(o.order_date) = $1;`,
            [salesDate]
        );
        const totalOrderRes = await pool.query(`select count(*) as total_orders from orders o join transactions t on t.order_id = o.id where order_status = 'completed' and t.transaction_type = 'sale' and  Date(order_date) = $1`,[salesDate]);
        // Best-Selling Products
        const bestSellingProducts = await pool.query(
            `SELECT p.name, SUM(oi.quantity) AS total_sold
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             JOIN orders o ON oi.order_id = o.id
             WHERE o.order_status = 'completed'
             GROUP BY p.name
             ORDER BY total_sold DESC;`
        );
        let endOfDay = new Date(salesDate);
        endOfDay.setHours(23,23,23,23);
        const profitResult = await pool.query(
            `select sum(t.profit) as total_profit from transactions t join orders o on o.id = t.order_id where o.order_status = 'completed' and t.transaction_type = 'sale' and t.transaction_date between $1 and $2;`, [salesDate, endOfDay]
        );
        
        res.json({
            date: salesDate,
            total_revenue: salesResult.rows[0].total_revenue || 0,
            profit: profitResult.rows[0].total_profit || 0,
            total_orders: totalOrderRes.rows[0].total_orders || 0,
            best_selling_products: bestSellingProducts.rows,
        });
    } catch (error) {
        console.error("Error fetching daily sales report:", error);
        res.status(500).json({ message: "Internal server error" });
    }
 };
 

module.exports = { getSalesReport, getInventoryReport, getProfitReport, getDailySalesReport };