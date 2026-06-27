const db = require('../config/db');

const getCompanies = async (req, res) => {
  try {
    const { search } = req.query;
    let sql = 'SELECT * FROM companies';
    let params = [];

    if (search) {
      sql += ' WHERE name LIKE ? OR code LIKE ? OR contact_person LIKE ? OR mobile LIKE ? OR gst_number LIKE ?';
      const searchWild = `%${search}%`;
      params = [searchWild, searchWild, searchWild, searchWild, searchWild];
    }

    sql += ' ORDER BY name ASC';
    const companies = await db.query(sql, params);
    res.json(companies);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to retrieve companies' });
  }
};

const getCompanyById = async (req, res) => {
  try {
    const company = await db.get('SELECT * FROM companies WHERE id = ?', [req.params.id]);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    res.json(company);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving company' });
  }
};

const createCompany = async (req, res) => {
  const { name, code, contact_person, mobile, gst_number, address, notes } = req.body;

  if (!name || !code) {
    return res.status(400).json({ message: 'Company Name and Code are required' });
  }

  try {
    const existingCode = await db.get('SELECT id FROM companies WHERE code = ?', [code]);
    if (existingCode) return res.status(400).json({ message: 'Company Code already exists' });

    const result = await db.run(
      `INSERT INTO companies (name, code, contact_person, mobile, gst_number, address, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, code, contact_person || '', mobile || '', gst_number || '', address || '', notes || '']
    );

    // Audit log
    await db.run('INSERT INTO audit_logs (user_id, action, target_table, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)', [
      req.user.id,
      'Create Company',
      'companies',
      result.id,
      `Created company ${name} (${code})`,
      req.ip
    ]);

    res.status(201).json({ id: result.id, message: 'Company created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create company' });
  }
};

const updateCompany = async (req, res) => {
  const { id } = req.params;
  const { name, code, contact_person, mobile, gst_number, address, notes } = req.body;

  if (!name || !code) {
    return res.status(400).json({ message: 'Company Name and Code are required' });
  }

  try {
    const company = await db.get('SELECT * FROM companies WHERE id = ?', [id]);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    const existingCode = await db.get('SELECT id FROM companies WHERE code = ? AND id != ?', [code, id]);
    if (existingCode) return res.status(400).json({ message: 'Company Code already exists for another company' });

    await db.run(
      `UPDATE companies 
       SET name = ?, code = ?, contact_person = ?, mobile = ?, gst_number = ?, address = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, code, contact_person || '', mobile || '', gst_number || '', address || '', notes || '', id]
    );

    // Audit log
    await db.run('INSERT INTO audit_logs (user_id, action, target_table, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)', [
      req.user.id,
      'Update Company',
      'companies',
      id,
      `Updated company ${name} (${code})`,
      req.ip
    ]);

    res.json({ message: 'Company updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update company' });
  }
};

const deleteCompany = async (req, res) => {
  const { id } = req.params;

  try {
    const company = await db.get('SELECT name, code FROM companies WHERE id = ?', [id]);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    // Restrict if products belong to this company
    const product = await db.get('SELECT id FROM products WHERE company_id = ? LIMIT 1', [id]);
    if (product) {
      return res.status(400).json({ message: 'Cannot delete company as products are associated with it.' });
    }

    await db.run('DELETE FROM companies WHERE id = ?', [id]);

    // Audit log
    await db.run('INSERT INTO audit_logs (user_id, action, target_table, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)', [
      req.user.id,
      'Delete Company',
      'companies',
      id,
      `Deleted company ${company.name} (${company.code})`,
      req.ip
    ]);

    res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete company' });
  }
};

const getCompanyProducts = async (req, res) => {
  const { id } = req.params;
  try {
    const products = await db.query(
      `SELECT p.*, s.name as size_name, c.name as company_name 
       FROM products p
       LEFT JOIN sizes s ON p.size_id = s.id
       LEFT JOIN companies c ON p.company_id = c.id
       WHERE p.company_id = ?`,
      [id]
    );
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve company products' });
  }
};

module.exports = {
  getCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  getCompanyProducts
};
