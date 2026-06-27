const db = require('../config/db');

const bulkUpdateRates = async (req, res) => {
  const { company_id, category, size_id, rate_type, adjustment_type, adjustment_value, effective_date, notes } = req.body;

  if (!rate_type || !adjustment_type || adjustment_value === undefined || !effective_date) {
    return res.status(400).json({ message: 'Rate type, adjustment type, adjustment value, and effective date are required.' });
  }

  const val = parseFloat(adjustment_value);
  if (isNaN(val)) {
    return res.status(400).json({ message: 'Adjustment value must be a valid number.' });
  }

  try {
    // 1. Build SELECT query to find matching products to update
    let selectSql = 'SELECT id, name, code, purchase_rate, selling_rate FROM products WHERE 1=1';
    let selectParams = [];

    if (company_id) {
      selectSql += ' AND company_id = ?';
      selectParams.push(company_id);
    }
    if (category) {
      selectSql += ' AND category = ?';
      selectParams.push(category);
    }
    if (size_id) {
      selectSql += ' AND size_id = ?';
      selectParams.push(size_id);
    }

    const products = await db.query(selectSql, selectParams);

    if (products.length === 0) {
      return res.status(404).json({ message: 'No matching products found to update.' });
    }

    // 2. Perform updates inside a transaction or sequential runs
    let updatedCount = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const p of products) {
      let newPurchaseRate = p.purchase_rate;
      let newSellingRate = p.selling_rate;

      if (rate_type === 'purchase_rate' || rate_type === 'both') {
        if (adjustment_type === 'percentage') {
          newPurchaseRate = p.purchase_rate * (1 + val / 100);
        } else {
          newPurchaseRate = p.purchase_rate + val;
        }
        newPurchaseRate = Math.max(0, parseFloat(newPurchaseRate.toFixed(2)));
      }

      if (rate_type === 'selling_rate' || rate_type === 'both') {
        if (adjustment_type === 'percentage') {
          newSellingRate = p.selling_rate * (1 + val / 100);
        } else {
          newSellingRate = p.selling_rate + val;
        }
        newSellingRate = Math.max(0, parseFloat(newSellingRate.toFixed(2)));
      }

      // Check if any change actually occurs
      if (newPurchaseRate !== p.purchase_rate || newSellingRate !== p.selling_rate) {
        await db.run(
          `UPDATE products 
           SET purchase_rate = ?, selling_rate = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [newPurchaseRate, newSellingRate, p.id]
        );

        // Record to rate_history
        await db.run(
          `INSERT INTO rate_history (product_id, old_purchase_rate, new_purchase_rate, old_selling_rate, new_selling_rate, change_date, effective_date, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            p.id,
            p.purchase_rate,
            newPurchaseRate,
            p.selling_rate,
            newSellingRate,
            today,
            effective_date,
            notes || `Bulk rate adjustment: ${adjustment_value}${adjustment_type === 'percentage' ? '%' : ' Rs'} (${rate_type})`
          ]
        );
        updatedCount++;
      }
    }

    // Audit log
    await db.run('INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [
      req.user.id,
      'Bulk Rate Update',
      `Updated rates for ${updatedCount} products. Type: ${rate_type}, Adj: ${adjustment_value}${adjustment_type === 'percentage' ? '%' : ' Flat'}`,
      req.ip
    ]);

    res.json({ message: `Bulk rate update completed. ${updatedCount} products updated.`, updatedCount });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Bulk rate update failed.' });
  }
};

const getGlobalRateHistory = async (req, res) => {
  try {
    const history = await db.query(
      `SELECT h.*, p.name as product_name, p.code as product_code
       FROM rate_history h
       JOIN products p ON h.product_id = p.id
       ORDER BY h.change_date DESC, h.id DESC
       LIMIT 100`
    );
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve rate history.' });
  }
};

module.exports = {
  bulkUpdateRates,
  getGlobalRateHistory
};
