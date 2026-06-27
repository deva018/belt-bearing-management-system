const db = require('../config/db');
const excelService = require('../services/excelService');

const getProducts = async (req, res) => {
  try {
    const { search, category, company_id, size_id, min_stock, page = 1, limit = 50, sort_by = 'name', sort_order = 'ASC' } = req.query;
    let sql = `
      SELECT p.*, c.name as company_name, c.code as company_code, s.name as size_name, s.code as size_code
      FROM products p
      LEFT JOIN companies c ON p.company_id = c.id
      LEFT JOIN sizes s ON p.size_id = s.id
      WHERE 1=1
    `;
    let params = [];

    if (search) {
      sql += ' AND (p.name LIKE ? OR p.code LIKE ? OR p.hsn_code LIKE ? OR c.name LIKE ? OR s.name LIKE ?)';
      const wild = `%${search}%`;
      params.push(wild, wild, wild, wild, wild);
    }

    if (category) {
      sql += ' AND p.category = ?';
      params.push(category);
    }

    if (company_id) {
      sql += ' AND p.company_id = ?';
      params.push(company_id);
    }

    if (size_id) {
      sql += ' AND p.size_id = ?';
      params.push(size_id);
    }

    if (min_stock === 'true') {
      sql += ' AND p.stock_quantity <= p.min_stock_level';
    } else if (min_stock === 'out') {
      sql += ' AND p.stock_quantity = 0';
    }

    // Sorting
    const validSortFields = ['name', 'code', 'purchase_rate', 'selling_rate', 'stock_quantity'];
    const orderBy = validSortFields.includes(sort_by) ? `p.${sort_by}` : 'p.name';
    const orderDir = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    sql += ` ORDER BY ${orderBy} ${orderDir}`;

    // Pagination
    const offset = (page - 1) * limit;
    const countSql = `SELECT COUNT(*) as count FROM (${sql})`;
    const countRes = await db.get(countSql, params);
    const totalCount = countRes ? countRes.count : 0;

    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const products = await db.query(sql, params);

    res.json({
      products,
      pagination: {
        totalItems: totalCount,
        currentPage: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to retrieve products' });
  }
};

const getProductById = async (req, res) => {
  try {
    const product = await db.get(
      `SELECT p.*, c.name as company_name, s.name as size_name
       FROM products p
       LEFT JOIN companies c ON p.company_id = c.id
       LEFT JOIN sizes s ON p.size_id = s.id
       WHERE p.id = ?`,
      [req.params.id]
    );

    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving product details' });
  }
};

const createProduct = async (req, res) => {
  const {
    name, code, category, company_id, size_id, unit,
    purchase_rate, selling_rate, gst_percentage, hsn_code,
    description, stock_quantity, min_stock_level
  } = req.body;

  if (!name || !code || !category) {
    return res.status(400).json({ message: 'Product Name, Code, and Category are required' });
  }

  // Handle uploaded file path if exists
  const image_path = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const existing = await db.get('SELECT id FROM products WHERE code = ?', [code]);
    if (existing) return res.status(400).json({ message: 'Product Code already exists' });

    const pRate = parseFloat(purchase_rate || 0);
    const sRate = parseFloat(selling_rate || 0);
    const stockQty = parseInt(stock_quantity || 0, 10);

    const result = await db.run(
      `INSERT INTO products (name, code, category, company_id, size_id, unit, purchase_rate, selling_rate, gst_percentage, hsn_code, description, stock_quantity, min_stock_level, image_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, code, category, company_id ? parseInt(company_id) : null, size_id ? parseInt(size_id) : null,
        unit || 'Pcs', pRate, sRate, parseFloat(gst_percentage || 18), hsn_code || '',
        description || '', stockQty, parseInt(min_stock_level || 10, 10), image_path
      ]
    );

    const today = new Date().toISOString().split('T')[0];

    // Log Rate History initially
    await db.run(
      `INSERT INTO rate_history (product_id, old_purchase_rate, new_purchase_rate, old_selling_rate, new_selling_rate, change_date, effective_date, notes)
       VALUES (?, 0, ?, 0, ?, ?, ?, ?)`,
      [result.id, pRate, sRate, today, today, 'Initial rate on creation']
    );

    // Seed stock transaction if starting stock > 0
    if (stockQty > 0) {
      await db.run(
        `INSERT INTO stock_transactions (product_id, quantity, type, rate, reference, date, notes)
         VALUES (?, ?, 'Stock In', ?, 'Initial Seeding', ?, 'Product creation initial stock')`,
        [result.id, stockQty, pRate, today]
      );
    }

    // Audit log
    await db.run('INSERT INTO audit_logs (user_id, action, target_table, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)', [
      req.user.id,
      'Create Product',
      'products',
      result.id,
      `Created product ${name} (${code})`,
      req.ip
    ]);

    res.status(201).json({ id: result.id, message: 'Product created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create product' });
  }
};

const updateProduct = async (req, res) => {
  const { id } = req.params;
  const {
    name, code, category, company_id, size_id, unit,
    purchase_rate, selling_rate, gst_percentage, hsn_code,
    description, min_stock_level
  } = req.body;

  if (!name || !code || !category) {
    return res.status(400).json({ message: 'Product Name, Code, and Category are required' });
  }

  try {
    const product = await db.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const existingCode = await db.get('SELECT id FROM products WHERE code = ? AND id != ?', [code, id]);
    if (existingCode) return res.status(400).json({ message: 'Product Code already exists for another product' });

    const newPRate = parseFloat(purchase_rate || 0);
    const newSRate = parseFloat(selling_rate || 0);

    let image_path = product.image_path;
    if (req.file) {
      image_path = `/uploads/${req.file.filename}`;
    }

    await db.run(
      `UPDATE products 
       SET name = ?, code = ?, category = ?, company_id = ?, size_id = ?, unit = ?, 
           purchase_rate = ?, selling_rate = ?, gst_percentage = ?, hsn_code = ?, 
           description = ?, min_stock_level = ?, image_path = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name, code, category, company_id ? parseInt(company_id) : null, size_id ? parseInt(size_id) : null,
        unit || 'Pcs', newPRate, newSRate, parseFloat(gst_percentage || 18), hsn_code || '',
        description || '', parseInt(min_stock_level || 10, 10), image_path, id
      ]
    );

    // Check if rates changed to write to history
    if (product.purchase_rate !== newPRate || product.selling_rate !== newSRate) {
      const today = new Date().toISOString().split('T')[0];
      await db.run(
        `INSERT INTO rate_history (product_id, old_purchase_rate, new_purchase_rate, old_selling_rate, new_selling_rate, change_date, effective_date, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, product.purchase_rate, newPRate, product.selling_rate, newSRate, today, today, 'Updated via Product Editor']
      );
    }

    // Audit log
    await db.run('INSERT INTO audit_logs (user_id, action, target_table, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)', [
      req.user.id,
      'Update Product',
      'products',
      id,
      `Updated product ${name} (${code})`,
      req.ip
    ]);

    res.json({ message: 'Product updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update product' });
  }
};

const deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const product = await db.get('SELECT name, code FROM products WHERE id = ?', [id]);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Restrict if product exists in quotation items
    const quoteItem = await db.get('SELECT id FROM quotation_items WHERE product_id = ? LIMIT 1', [id]);
    if (quoteItem) {
      return res.status(400).json({ message: 'Cannot delete product because it is referenced in quotations.' });
    }

    await db.run('DELETE FROM products WHERE id = ?', [id]);

    // Audit log
    await db.run('INSERT INTO audit_logs (user_id, action, target_table, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)', [
      req.user.id,
      'Delete Product',
      'products',
      id,
      `Deleted product ${product.name} (${product.code})`,
      req.ip
    ]);

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete product' });
  }
};

const getProductHistory = async (req, res) => {
  const { id } = req.params;
  try {
    const rates = await db.query('SELECT * FROM rate_history WHERE product_id = ? ORDER BY change_date DESC', [id]);
    const stock = await db.query('SELECT * FROM stock_transactions WHERE product_id = ? ORDER BY date DESC, id DESC', [id]);
    res.json({ rates, stock });
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve product history' });
  }
};

const exportProductsExcel = async (req, res) => {
  try {
    const products = await db.query(`
      SELECT p.id as 'Product ID', p.name as 'Product Name', p.code as 'Product Code', p.category as 'Category',
             c.name as 'Company Name', c.code as 'Company Code', s.name as 'Size Name', s.code as 'Size Code',
             p.unit as 'Unit', p.purchase_rate as 'Purchase Rate', p.selling_rate as 'Selling Rate',
             p.gst_percentage as 'GST Percentage', p.hsn_code as 'HSN Code', p.stock_quantity as 'Stock Quantity',
             p.min_stock_level as 'Minimum Stock Level', p.description as 'Description'
      FROM products p
      LEFT JOIN companies c ON p.company_id = c.id
      LEFT JOIN sizes s ON p.size_id = s.id
      ORDER BY p.name ASC
    `);

    const excelBuffer = excelService.exportToExcel(products, 'Products');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=products_export.xlsx');
    res.send(excelBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Excel export failed' });
  }
};

const importProductsExcel = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Please upload an Excel file.' });
  }

  try {
    const result = await excelService.importProductsFromExcel(req.file.buffer);

    // Audit log
    await db.run('INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [
      req.user.id,
      'Excel Bulk Import',
      `Imported ${result.successCount} products, failed ${result.errorCount} products`,
      req.ip
    ]);

    res.json({
      message: 'Excel import completed.',
      successCount: result.successCount,
      errorCount: result.errorCount
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Excel import failed.' });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductHistory,
  exportProductsExcel,
  importProductsExcel
};
