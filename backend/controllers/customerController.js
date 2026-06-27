const db = require('../config/db');

const getCustomers = async (req, res) => {
  try {
    const { search } = req.query;
    let sql = 'SELECT * FROM customers';
    let params = [];

    if (search) {
      sql += ' WHERE name LIKE ? OR mobile LIKE ? OR gst_number LIKE ? OR email LIKE ?';
      const searchWild = `%${search}%`;
      params = [searchWild, searchWild, searchWild, searchWild];
    }

    sql += ' ORDER BY name ASC';
    const customers = await db.query(sql, params);
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve customers' });
  }
};

const getCustomerById = async (req, res) => {
  try {
    const customer = await db.get('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving customer details' });
  }
};

const createCustomer = async (req, res) => {
  const { name, mobile, gst_number, address, email, notes } = req.body;

  if (!name || !mobile) {
    return res.status(400).json({ message: 'Customer Name and Mobile Number are required' });
  }

  try {
    const existing = await db.get('SELECT id FROM customers WHERE mobile = ?', [mobile]);
    if (existing) return res.status(400).json({ message: 'A customer with this mobile number already exists' });

    const result = await db.run(
      `INSERT INTO customers (name, mobile, gst_number, address, email, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, mobile, gst_number || '', address || '', email || '', notes || '']
    );

    // Audit Log
    await db.run('INSERT INTO audit_logs (user_id, action, target_table, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)', [
      req.user.id,
      'Create Customer',
      'customers',
      result.id,
      `Created customer ${name} (Mobile: ${mobile})`,
      req.ip
    ]);

    res.status(201).json({ id: result.id, message: 'Customer created successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create customer' });
  }
};

const updateCustomer = async (req, res) => {
  const { id } = req.params;
  const { name, mobile, gst_number, address, email, notes } = req.body;

  if (!name || !mobile) {
    return res.status(400).json({ message: 'Customer Name and Mobile Number are required' });
  }

  try {
    const customer = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const existing = await db.get('SELECT id FROM customers WHERE mobile = ? AND id != ?', [mobile, id]);
    if (existing) return res.status(400).json({ message: 'Mobile number is already registered to another customer' });

    await db.run(
      `UPDATE customers 
       SET name = ?, mobile = ?, gst_number = ?, address = ?, email = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, mobile, gst_number || '', address || '', email || '', notes || '', id]
    );

    // Audit Log
    await db.run('INSERT INTO audit_logs (user_id, action, target_table, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)', [
      req.user.id,
      'Update Customer',
      'customers',
      id,
      `Updated customer ${name} (Mobile: ${mobile})`,
      req.ip
    ]);

    res.json({ message: 'Customer updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update customer' });
  }
};

const deleteCustomer = async (req, res) => {
  const { id } = req.params;

  try {
    const customer = await db.get('SELECT name, mobile FROM customers WHERE id = ?', [id]);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    // Prevent deletion if quotes exist
    const quote = await db.get('SELECT id FROM quotations WHERE customer_id = ? LIMIT 1', [id]);
    if (quote) {
      return res.status(400).json({ message: 'Cannot delete customer because they have associated quotations.' });
    }

    await db.run('DELETE FROM customers WHERE id = ?', [id]);

    // Audit Log
    await db.run('INSERT INTO audit_logs (user_id, action, target_table, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)', [
      req.user.id,
      'Delete Customer',
      'customers',
      id,
      `Deleted customer ${customer.name} (Mobile: ${customer.mobile})`,
      req.ip
    ]);

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete customer' });
  }
};

const getCustomerQuotationHistory = async (req, res) => {
  const { id } = req.params;
  try {
    const quotations = await db.query(
      'SELECT * FROM quotations WHERE customer_id = ? ORDER BY date DESC, id DESC',
      [id]
    );
    res.json(quotations);
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve quotation history' });
  }
};

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerQuotationHistory
};
