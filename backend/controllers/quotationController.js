const db = require('../config/db');
const { generateQuotationPDF } = require('../services/pdfService');

// Helper to generate a unique sequential quotation number e.g., QT-20260627-0001
const generateQuotationNumber = async (dateStr) => {
  const cleanDate = dateStr.replace(/-/g, ''); // YYYYMMDD
  const datePrefix = `QT-${cleanDate}`;

  try {
    const row = await db.get(
      "SELECT COUNT(*) as count FROM quotations WHERE quotation_number LIKE ?",
      [`${datePrefix}%`]
    );
    const sequence = (row ? row.count : 0) + 1;
    const seqStr = String(sequence).padStart(4, '0');
    return `${datePrefix}-${seqStr}`;
  } catch (err) {
    // Fallback if DB check fails
    return `QT-${cleanDate}-${Math.floor(1000 + Math.random() * 9000)}`;
  }
};

const getQuotations = async (req, res) => {
  try {
    const { search, status } = req.query;
    let sql = `
      SELECT q.*, c.name as customer_name, c.mobile as customer_mobile
      FROM quotations q
      LEFT JOIN customers c ON q.customer_id = c.id
      WHERE 1=1
    `;
    let params = [];

    if (search) {
      sql += ' AND (q.quotation_number LIKE ? OR c.name LIKE ? OR c.mobile LIKE ?)';
      const wild = `%${search}%`;
      params.push(wild, wild, wild);
    }

    if (status) {
      sql += ' AND q.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY q.date DESC, q.id DESC';
    const quotations = await db.query(sql, params);
    res.json(quotations);
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve quotations' });
  }
};

const getQuotationById = async (req, res) => {
  try {
    const quotation = await db.get(
      `SELECT q.*, c.name as customer_name, c.mobile as customer_mobile, c.gst_number as customer_gst, c.address as customer_address, c.email as customer_email
       FROM quotations q
       LEFT JOIN customers c ON q.customer_id = c.id
       WHERE q.id = ?`,
      [req.params.id]
    );

    if (!quotation) return res.status(404).json({ message: 'Quotation not found' });

    const items = await db.query(
      `SELECT qi.*, p.name as product_name, p.code as product_code, co.name as company_name, s.name as size_name
       FROM quotation_items qi
       JOIN products p ON qi.product_id = p.id
       LEFT JOIN companies co ON p.company_id = co.id
       LEFT JOIN sizes s ON p.size_id = s.id
       WHERE qi.quotation_id = ?`,
      [req.params.id]
    );

    res.json({ quotation, items });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving quotation' });
  }
};

const createQuotation = async (req, res) => {
  const { customer_id, date, items, discount_amount = 0, terms, status = 'Draft' } = req.body;

  if (!customer_id || !date || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Customer ID, Date, and at least one Product item are required.' });
  }

  try {
    const quotationNumber = await generateQuotationNumber(date);

    // Calculate totals
    let subtotal = 0;
    let totalGst = 0;
    const computedItems = [];

    for (const item of items) {
      const product = await db.get('SELECT name, selling_rate, gst_percentage FROM products WHERE id = ?', [item.product_id]);
      if (!product) return res.status(400).json({ message: `Product ID ${item.product_id} not found.` });

      const qty = parseInt(item.quantity, 10);
      const rate = parseFloat(item.rate || product.selling_rate);
      const discountPct = parseFloat(item.discount_percentage || 0);
      const gstPct = parseFloat(product.gst_percentage || 18);

      const itemSubtotal = qty * rate;
      const itemDiscount = itemSubtotal * (discountPct / 100);
      const itemTaxable = itemSubtotal - itemDiscount;
      const itemGst = itemTaxable * (gstPct / 100);
      const itemTotal = itemTaxable + itemGst;

      subtotal += itemTaxable;
      totalGst += itemGst;

      computedItems.push({
        product_id: item.product_id,
        quantity: qty,
        rate,
        discount_percentage: discountPct,
        gst_percentage: gstPct,
        total_amount: itemTotal
      });
    }

    const discountAmt = parseFloat(discount_amount);
    const grandTotal = subtotal + totalGst - discountAmt;

    // Save quotation
    const quoteResult = await db.run(
      `INSERT INTO quotations (quotation_number, date, customer_id, subtotal, discount_amount, gst_amount, grand_total, terms, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [quotationNumber, date, customer_id, subtotal, discountAmt, totalGst, grandTotal, terms || '', status]
    );

    const quotationId = quoteResult.id;

    // Save quotation items
    for (const cItem of computedItems) {
      await db.run(
        `INSERT INTO quotation_items (quotation_id, product_id, quantity, rate, discount_percentage, gst_percentage, total_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [quotationId, cItem.product_id, cItem.quantity, cItem.rate, cItem.discount_percentage, cItem.gst_percentage, cItem.total_amount]
      );
    }

    // Audit Log
    await db.run('INSERT INTO audit_logs (user_id, action, target_table, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)', [
      req.user.id,
      'Create Quotation',
      'quotations',
      quotationId,
      `Created Quotation ${quotationNumber}`,
      req.ip
    ]);

    res.status(201).json({ id: quotationId, quotationNumber, message: 'Quotation created successfully.' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create quotation.' });
  }
};

const updateQuotation = async (req, res) => {
  const { id } = req.params;
  const { date, customer_id, items, discount_amount = 0, terms, status } = req.body;

  if (!customer_id || !date || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Customer ID, Date, and items are required.' });
  }

  try {
    const existingQuote = await db.get('SELECT quotation_number FROM quotations WHERE id = ?', [id]);
    if (!existingQuote) return res.status(404).json({ message: 'Quotation not found.' });

    // Calculate new totals
    let subtotal = 0;
    let totalGst = 0;
    const computedItems = [];

    for (const item of items) {
      const product = await db.get('SELECT name, selling_rate, gst_percentage FROM products WHERE id = ?', [item.product_id]);
      if (!product) return res.status(400).json({ message: `Product ID ${item.product_id} not found.` });

      const qty = parseInt(item.quantity, 10);
      const rate = parseFloat(item.rate || product.selling_rate);
      const discountPct = parseFloat(item.discount_percentage || 0);
      const gstPct = parseFloat(product.gst_percentage || 18);

      const itemSubtotal = qty * rate;
      const itemDiscount = itemSubtotal * (discountPct / 100);
      const itemTaxable = itemSubtotal - itemDiscount;
      const itemGst = itemTaxable * (gstPct / 100);
      const itemTotal = itemTaxable + itemGst;

      subtotal += itemTaxable;
      totalGst += itemGst;

      computedItems.push({
        product_id: item.product_id,
        quantity: qty,
        rate,
        discount_percentage: discountPct,
        gst_percentage: gstPct,
        total_amount: itemTotal
      });
    }

    const discountAmt = parseFloat(discount_amount);
    const grandTotal = subtotal + totalGst - discountAmt;

    // Update main quote record
    await db.run(
      `UPDATE quotations
       SET date = ?, customer_id = ?, subtotal = ?, discount_amount = ?, gst_amount = ?, grand_total = ?, terms = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [date, customer_id, subtotal, discountAmt, totalGst, grandTotal, terms || '', status || 'Draft', id]
    );

    // Recreate quotation items (simpler than updating row-by-row)
    await db.run('DELETE FROM quotation_items WHERE quotation_id = ?', [id]);

    for (const cItem of computedItems) {
      await db.run(
        `INSERT INTO quotation_items (quotation_id, product_id, quantity, rate, discount_percentage, gst_percentage, total_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, cItem.product_id, cItem.quantity, cItem.rate, cItem.discount_percentage, cItem.gst_percentage, cItem.total_amount]
      );
    }

    // Audit Log
    await db.run('INSERT INTO audit_logs (user_id, action, target_table, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)', [
      req.user.id,
      'Update Quotation',
      'quotations',
      id,
      `Updated Quotation ${existingQuote.quotation_number}`,
      req.ip
    ]);

    res.json({ message: 'Quotation updated successfully.' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update quotation.' });
  }
};

const duplicateQuotation = async (req, res) => {
  const { id } = req.params;

  try {
    const srcQuote = await db.get('SELECT * FROM quotations WHERE id = ?', [id]);
    if (!srcQuote) return res.status(404).json({ message: 'Quotation not found.' });

    const srcItems = await db.query('SELECT * FROM quotation_items WHERE quotation_id = ?', [id]);

    const todayStr = new Date().toISOString().split('T')[0];
    const newQuoteNum = await generateQuotationNumber(todayStr);

    // Save duplicated quotation
    const quoteResult = await db.run(
      `INSERT INTO quotations (quotation_number, date, customer_id, subtotal, discount_amount, gst_amount, grand_total, terms, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Draft')`,
      [newQuoteNum, todayStr, srcQuote.customer_id, srcQuote.subtotal, srcQuote.discount_amount, srcQuote.gst_amount, srcQuote.grand_total, srcQuote.terms]
    );

    const newQuoteId = quoteResult.id;

    // Save duplicated items
    for (const item of srcItems) {
      await db.run(
        `INSERT INTO quotation_items (quotation_id, product_id, quantity, rate, discount_percentage, gst_percentage, total_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newQuoteId, item.product_id, item.quantity, item.rate, item.discount_percentage, item.gst_percentage, item.total_amount]
      );
    }

    // Audit Log
    await db.run('INSERT INTO audit_logs (user_id, action, target_table, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)', [
      req.user.id,
      'Duplicate Quotation',
      'quotations',
      newQuoteId,
      `Duplicated Quotation ${srcQuote.quotation_number} into new Quote ${newQuoteNum}`,
      req.ip
    ]);

    res.status(201).json({ id: newQuoteId, quotationNumber: newQuoteNum, message: 'Quotation duplicated successfully.' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to duplicate quotation.' });
  }
};

const getQuotationPDFFile = async (req, res) => {
  const { id } = req.params;

  try {
    const quotation = await db.get('SELECT * FROM quotations WHERE id = ?', [id]);
    if (!quotation) return res.status(404).json({ message: 'Quotation not found.' });

    const customer = await db.get('SELECT * FROM customers WHERE id = ?', [quotation.customer_id]);
    if (!customer) return res.status(404).json({ message: 'Customer associated with quotation not found.' });

    const items = await db.query(
      `SELECT qi.*, p.name as product_name, c.name as company_name, s.name as size_name
       FROM quotation_items qi
       JOIN products p ON qi.product_id = p.id
       LEFT JOIN companies c ON p.company_id = c.id
       LEFT JOIN sizes s ON p.size_id = s.id
       WHERE qi.quotation_id = ?`,
      [id]
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Quotation_${quotation.quotation_number}.pdf`);

    generateQuotationPDF(quotation, customer, items, res);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to generate PDF.' });
  }
};

const deleteQuotation = async (req, res) => {
  const { id } = req.params;
  try {
    const quote = await db.get('SELECT quotation_number FROM quotations WHERE id = ?', [id]);
    if (!quote) return res.status(404).json({ message: 'Quotation not found.' });

    await db.run('DELETE FROM quotations WHERE id = ?', [id]);

    // Audit log
    await db.run('INSERT INTO audit_logs (user_id, action, target_table, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)', [
      req.user.id,
      'Delete Quotation',
      'quotations',
      id,
      `Deleted quotation ${quote.quotation_number}`,
      req.ip
    ]);

    res.json({ message: 'Quotation deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete quotation' });
  }
};

module.exports = {
  getQuotations,
  getQuotationById,
  createQuotation,
  updateQuotation,
  duplicateQuotation,
  getQuotationPDFFile,
  deleteQuotation
};
