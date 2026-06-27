const db = require('../config/db');

const getDashboardStats = async (req, res) => {
  try {
    const totalProducts = await db.get('SELECT COUNT(*) as count FROM products');
    const totalCompanies = await db.get('SELECT COUNT(*) as count FROM companies');
    const totalStock = await db.get('SELECT SUM(stock_quantity) as count FROM products');
    
    // Low stock count
    const lowStock = await db.get('SELECT COUNT(*) as count FROM products WHERE stock_quantity <= min_stock_level');

    // Quotations counts
    const totalQuotes = await db.get('SELECT COUNT(*) as count FROM quotations');
    const todayStr = new Date().toISOString().split('T')[0];
    const todayQuotes = await db.get('SELECT COUNT(*) as count FROM quotations WHERE date = ?', [todayStr]);

    // Top selling products (most quoted products based on quotation item quantity)
    const topSelling = await db.query(`
      SELECT p.name, p.code, SUM(qi.quantity) as total_qty, c.name as company_name
      FROM quotation_items qi
      JOIN products p ON qi.product_id = p.id
      LEFT JOIN companies c ON p.company_id = c.id
      GROUP BY qi.product_id
      ORDER BY total_qty DESC
      LIMIT 5
    `);

    // Recent rate updates
    const recentRates = await db.query(`
      SELECT r.*, p.name as product_name, p.code as product_code
      FROM rate_history r
      JOIN products p ON r.product_id = p.id
      ORDER BY r.change_date DESC, r.id DESC
      LIMIT 5
    `);

    // Recent quotations
    const recentQuotes = await db.query(`
      SELECT q.*, c.name as customer_name
      FROM quotations q
      LEFT JOIN customers c ON q.customer_id = c.id
      ORDER BY q.date DESC, q.id DESC
      LIMIT 5
    `);

    res.json({
      summary: {
        totalProducts: totalProducts ? totalProducts.count : 0,
        totalCompanies: totalCompanies ? totalCompanies.count : 0,
        totalStock: totalStock ? (totalStock.count || 0) : 0,
        lowStockProducts: lowStock ? lowStock.count : 0,
        totalQuotes: totalQuotes ? totalQuotes.count : 0,
        todayQuotes: todayQuotes ? todayQuotes.count : 0
      },
      topSelling,
      recentRates,
      recentQuotes
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to retrieve dashboard stats.' });
  }
};

const getInventoryReport = async (req, res) => {
  try {
    const categories = await db.query('SELECT category, COUNT(*) as count, SUM(stock_quantity) as total_stock FROM products GROUP BY category');
    const lowStockList = await db.query(`
      SELECT p.*, c.name as company_name, s.name as size_name
      FROM products p
      LEFT JOIN companies c ON p.company_id = c.id
      LEFT JOIN sizes s ON p.size_id = s.id
      WHERE p.stock_quantity <= p.min_stock_level
      ORDER BY p.stock_quantity ASC
    `);

    res.json({
      categories,
      lowStockList
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve inventory report.' });
  }
};

const getSalesReport = async (req, res) => {
  try {
    // Quotations by status
    const quotesByStatus = await db.query('SELECT status, COUNT(*) as count, SUM(grand_total) as total_val FROM quotations GROUP BY status');
    
    // Monthly sales estimation based on accepted quotations
    const monthlyQuotes = await db.query(`
      SELECT substr(date, 1, 7) as month, COUNT(*) as count, SUM(grand_total) as total_val
      FROM quotations
      WHERE status = 'Accepted'
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `);

    res.json({
      quotesByStatus,
      monthlyQuotes
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve sales report.' });
  }
};

module.exports = {
  getDashboardStats,
  getInventoryReport,
  getSalesReport
};
