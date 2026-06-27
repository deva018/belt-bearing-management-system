const db = require('../config/db');

const getSizes = async (req, res) => {
  try {
    const { search } = req.query;
    let sql = 'SELECT * FROM sizes';
    let params = [];

    if (search) {
      sql += ' WHERE name LIKE ? OR code LIKE ? OR description LIKE ?';
      const searchWild = `%${search}%`;
      params = [searchWild, searchWild, searchWild];
    }

    sql += ' ORDER BY name ASC';
    const sizes = await db.query(sql, params);
    res.json(sizes);
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve sizes' });
  }
};

const getSizeById = async (req, res) => {
  try {
    const size = await db.get('SELECT * FROM sizes WHERE id = ?', [req.params.id]);
    if (!size) return res.status(404).json({ message: 'Size not found' });
    res.json(size);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving size' });
  }
};

const createSize = async (req, res) => {
  const { name, code, description } = req.body;

  if (!name || !code) {
    return res.status(400).json({ message: 'Size Name and Code are required' });
  }

  try {
    const existingCode = await db.get('SELECT id FROM sizes WHERE code = ?', [code]);
    if (existingCode) return res.status(400).json({ message: 'Size Code already exists' });

    const result = await db.run(
      'INSERT INTO sizes (name, code, description) VALUES (?, ?, ?)',
      [name, code, description || '']
    );

    // Audit log
    await db.run('INSERT INTO audit_logs (user_id, action, target_table, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)', [
      req.user.id,
      'Create Size',
      'sizes',
      result.id,
      `Created size ${name} (${code})`,
      req.ip
    ]);

    res.status(201).json({ id: result.id, message: 'Size created successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create size' });
  }
};

const updateSize = async (req, res) => {
  const { id } = req.params;
  const { name, code, description } = req.body;

  if (!name || !code) {
    return res.status(400).json({ message: 'Size Name and Code are required' });
  }

  try {
    const size = await db.get('SELECT * FROM sizes WHERE id = ?', [id]);
    if (!size) return res.status(404).json({ message: 'Size not found' });

    const existingCode = await db.get('SELECT id FROM sizes WHERE code = ? AND id != ?', [code, id]);
    if (existingCode) return res.status(400).json({ message: 'Size Code already exists for another size' });

    await db.run(
      'UPDATE sizes SET name = ?, code = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, code, description || '', id]
    );

    // Audit log
    await db.run('INSERT INTO audit_logs (user_id, action, target_table, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)', [
      req.user.id,
      'Update Size',
      'sizes',
      id,
      `Updated size ${name} (${code})`,
      req.ip
    ]);

    res.json({ message: 'Size updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update size' });
  }
};

const deleteSize = async (req, res) => {
  const { id } = req.params;

  try {
    const size = await db.get('SELECT name, code FROM sizes WHERE id = ?', [id]);
    if (!size) return res.status(404).json({ message: 'Size not found' });

    const product = await db.get('SELECT id FROM products WHERE size_id = ? LIMIT 1', [id]);
    if (product) {
      return res.status(400).json({ message: 'Cannot delete size as products are associated with it.' });
    }

    await db.run('DELETE FROM sizes WHERE id = ?', [id]);

    // Audit log
    await db.run('INSERT INTO audit_logs (user_id, action, target_table, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)', [
      req.user.id,
      'Delete Size',
      'sizes',
      id,
      `Deleted size ${size.name} (${size.code})`,
      req.ip
    ]);

    res.json({ message: 'Size deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete size' });
  }
};

module.exports = {
  getSizes,
  getSizeById,
  createSize,
  updateSize,
  deleteSize
};
