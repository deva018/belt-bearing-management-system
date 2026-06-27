const db = require('../config/db');

const stockIn = async (req, res) => {
  const { product_id, quantity, purchase_rate, supplier, date, notes } = req.body;

  if (!product_id || !quantity || !purchase_rate || !date) {
    return res.status(400).json({ message: 'Product ID, Quantity, Purchase Rate, and Date are required.' });
  }

  const qty = parseInt(quantity, 10);
  const rate = parseFloat(purchase_rate);

  if (qty <= 0) return res.status(400).json({ message: 'Quantity must be positive.' });
  if (rate < 0) return res.status(400).json({ message: 'Purchase Rate cannot be negative.' });

  try {
    const product = await db.get('SELECT name, stock_quantity, purchase_rate FROM products WHERE id = ?', [product_id]);
    if (!product) return res.status(404).json({ message: 'Product not found.' });

    // Update stock quantity and current purchase rate
    const newStock = product.stock_quantity + qty;
    await db.run(
      'UPDATE products SET stock_quantity = ?, purchase_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStock, rate, product_id]
    );

    // Save transaction
    const tx = await db.run(
      `INSERT INTO stock_transactions (product_id, quantity, type, rate, reference, date, notes)
       VALUES (?, ?, 'Stock In', ?, ?, ?, ?)`,
      [product_id, qty, rate, supplier || '', date, notes || '']
    );

    // Save rate history if rate changed
    if (rate !== product.purchase_rate) {
      await db.run(
        `INSERT INTO rate_history (product_id, old_purchase_rate, new_purchase_rate, change_date, effective_date, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [product_id, product.purchase_rate, rate, date, date, 'Updated via Stock In']
      );
    }

    // Audit Log
    await db.run('INSERT INTO audit_logs (user_id, action, target_table, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)', [
      req.user.id,
      'Stock In',
      'stock_transactions',
      tx.id,
      `Stock In: Added ${qty} units of ${product.name} (Supplier: ${supplier || 'N/A'})`,
      req.ip
    ]);

    res.json({ message: 'Stock In transaction recorded successfully.', newStockQuantity: newStock });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Stock In transaction failed.' });
  }
};

const stockOut = async (req, res) => {
  const { product_id, quantity, rate, customer, date, notes } = req.body;

  if (!product_id || !quantity || !rate || !date) {
    return res.status(400).json({ message: 'Product ID, Quantity, Rate, and Date are required.' });
  }

  const qty = parseInt(quantity, 10);
  const sRate = parseFloat(rate);

  if (qty <= 0) return res.status(400).json({ message: 'Quantity must be positive.' });
  if (sRate < 0) return res.status(400).json({ message: 'Rate cannot be negative.' });

  try {
    const product = await db.get('SELECT name, stock_quantity, selling_rate FROM products WHERE id = ?', [product_id]);
    if (!product) return res.status(404).json({ message: 'Product not found.' });

    if (product.stock_quantity < qty) {
      return res.status(400).json({ message: `Insufficient stock. Current stock is ${product.stock_quantity} units.` });
    }

    const newStock = product.stock_quantity - qty;
    await db.run(
      'UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStock, product_id]
    );

    // Save transaction
    const tx = await db.run(
      `INSERT INTO stock_transactions (product_id, quantity, type, rate, reference, date, notes)
       VALUES (?, ?, 'Stock Out', ?, ?, ?, ?)`,
      [product_id, qty, sRate, customer || '', date, notes || '']
    );

    // Audit Log
    await db.run('INSERT INTO audit_logs (user_id, action, target_table, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)', [
      req.user.id,
      'Stock Out',
      'stock_transactions',
      tx.id,
      `Stock Out: Removed ${qty} units of ${product.name} (Customer: ${customer || 'N/A'})`,
      req.ip
    ]);

    res.json({ message: 'Stock Out transaction recorded successfully.', newStockQuantity: newStock });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Stock Out transaction failed.' });
  }
};

const getStockHistory = async (req, res) => {
  try {
    const history = await db.query(
      `SELECT t.*, p.name as product_name, p.code as product_code
       FROM stock_transactions t
       JOIN products p ON t.product_id = p.id
       ORDER BY t.date DESC, t.id DESC`
    );
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve stock history.' });
  }
};

const getStockValuation = async (req, res) => {
  try {
    const valuation = await db.get(`
      SELECT 
        COUNT(id) as total_products,
        SUM(stock_quantity) as total_stock,
        SUM(stock_quantity * purchase_rate) as total_purchase_value,
        SUM(stock_quantity * selling_rate) as total_selling_value
      FROM products
    `);

    // Fetch individual valuations
    const products = await db.query(`
      SELECT p.id, p.name, p.code, p.stock_quantity, p.purchase_rate, p.selling_rate,
             (p.stock_quantity * p.purchase_rate) as purchase_value,
             (p.stock_quantity * p.selling_rate) as selling_value
      FROM products p
      WHERE p.stock_quantity > 0
      ORDER BY purchase_value DESC
    `);

    res.json({
      summary: {
        totalProducts: valuation.total_products || 0,
        totalStock: valuation.total_stock || 0,
        totalPurchaseValue: valuation.total_purchase_value || 0,
        totalSellingValue: valuation.total_selling_value || 0,
        estimatedMargin: (valuation.total_selling_value || 0) - (valuation.total_purchase_value || 0)
      },
      products
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to generate stock valuation.' });
  }
};

module.exports = {
  stockIn,
  stockOut,
  getStockHistory,
  getStockValuation
};
