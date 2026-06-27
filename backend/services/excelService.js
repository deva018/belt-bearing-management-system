const XLSX = require('xlsx');
const db = require('../config/db');

// Helper to find or create company during import
async function getOrCreateCompany(name, code) {
  if (!name || !code) return null;
  let company = await db.get('SELECT id FROM companies WHERE code = ? OR name = ?', [code, name]);
  if (!company) {
    const res = await db.run('INSERT INTO companies (name, code) VALUES (?, ?)', [name, code]);
    return res.id;
  }
  return company.id;
}

// Helper to find or create size during import
async function getOrCreateSize(name, code) {
  if (!name || !code) return null;
  let size = await db.get('SELECT id FROM sizes WHERE code = ? OR name = ?', [code, name]);
  if (!size) {
    const res = await db.run('INSERT INTO sizes (name, code) VALUES (?, ?)', [name, code]);
    return res.id;
  }
  return size.id;
}

const importProductsFromExcel = async (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  let successCount = 0;
  let errorCount = 0;

  for (const row of data) {
    try {
      const name = row['Product Name'] || row['name'];
      const code = String(row['Product Code'] || row['code'] || '');
      const category = row['Category'] || row['category'] || 'Other';
      const companyName = row['Company Name'] || row['company_name'] || '';
      const companyCode = String(row['Company Code'] || row['company_code'] || '');
      const sizeName = row['Size Name'] || row['size_name'] || '';
      const sizeCode = String(row['Size Code'] || row['size_code'] || '');
      const unit = row['Unit'] || row['unit'] || 'Pcs';
      const purchaseRate = parseFloat(row['Purchase Rate'] || row['purchase_rate'] || 0);
      const sellingRate = parseFloat(row['Selling Rate'] || row['selling_rate'] || 0);
      const gstPercentage = parseFloat(row['GST Percentage'] || row['gst_percentage'] || 18);
      const hsnCode = String(row['HSN Code'] || row['hsn_code'] || '');
      const description = row['Description'] || row['description'] || '';
      const stockQuantity = parseInt(row['Stock Quantity'] || row['stock_quantity'] || 0, 10);
      const minStockLevel = parseInt(row['Minimum Stock Level'] || row['min_stock_level'] || 10, 10);

      if (!name || !code) {
        errorCount++;
        continue;
      }

      // Find or create company and size dependencies
      const companyId = await getOrCreateCompany(companyName || companyCode, companyCode || companyName);
      const sizeId = await getOrCreateSize(sizeName || sizeCode, sizeCode || sizeName);

      // Check if product code exists
      const existingProduct = await db.get('SELECT id, stock_quantity, purchase_rate, selling_rate FROM products WHERE code = ?', [code]);

      if (existingProduct) {
        // Update product rates and quantity (if specified)
        await db.run(`
          UPDATE products 
          SET name = ?, category = ?, company_id = ?, size_id = ?, unit = ?, 
              purchase_rate = ?, selling_rate = ?, gst_percentage = ?, hsn_code = ?, 
              description = ?, min_stock_level = ?
          WHERE id = ?
        `, [
          name, category, companyId, sizeId, unit, 
          purchaseRate, sellingRate, gstPercentage, hsnCode, 
          description, minStockLevel, existingProduct.id
        ]);

        // If rate changed, log rate history
        if (purchaseRate !== existingProduct.purchase_rate || sellingRate !== existingProduct.selling_rate) {
          const today = new Date().toISOString().split('T')[0];
          await db.run(`
            INSERT INTO rate_history (product_id, old_purchase_rate, new_purchase_rate, old_selling_rate, new_selling_rate, change_date, effective_date, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [existingProduct.id, existingProduct.purchase_rate, purchaseRate, existingProduct.selling_rate, sellingRate, today, today, 'Import update']);
        }
      } else {
        // Insert new product
        const newProduct = await db.run(`
          INSERT INTO products (name, code, category, company_id, size_id, unit, purchase_rate, selling_rate, gst_percentage, hsn_code, description, stock_quantity, min_stock_level)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          name, code, category, companyId, sizeId, unit, 
          purchaseRate, sellingRate, gstPercentage, hsnCode, 
          description, stockQuantity, minStockLevel
        ]);

        // Insert initial stock transaction if stock > 0
        if (stockQuantity > 0) {
          const today = new Date().toISOString().split('T')[0];
          await db.run(`
            INSERT INTO stock_transactions (product_id, quantity, type, rate, reference, date, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [newProduct.id, stockQuantity, 'Stock In', purchaseRate, 'Excel Import', today, 'Initial stock import']);
        }
      }

      successCount++;
    } catch (e) {
      console.error('Import error for row:', row, e);
      errorCount++;
    }
  }

  return { successCount, errorCount };
};

const exportToExcel = (data, sheetName = 'Sheet1') => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  // Return buffer
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

module.exports = {
  importProductsFromExcel,
  exportToExcel
};
