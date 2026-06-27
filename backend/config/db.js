const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = process.env.SQLITE_DB_PATH || path.resolve(__dirname, '../../database.sqlite');
console.log('Initializing database at:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database successfully.');
  }
});

// Enable Foreign Key support in SQLite
db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON;');
});

// Promise wrappers for DB operations
const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const exec = (sql) => {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

// Initialize schema
const initDB = async () => {
  try {
    // 1. Users Table
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT CHECK(role IN ('Admin', 'Sales Staff')) NOT NULL,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Companies Table
    await run(`
      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        code TEXT UNIQUE NOT NULL,
        contact_person TEXT,
        mobile TEXT,
        gst_number TEXT,
        address TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Sizes Table
    await run(`
      CREATE TABLE IF NOT EXISTS sizes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        code TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. Products Table
    await run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        category TEXT CHECK(category IN ('Belt', 'Bearing', 'Other')) NOT NULL,
        company_id INTEGER,
        size_id INTEGER,
        unit TEXT DEFAULT 'Pcs',
        purchase_rate REAL DEFAULT 0,
        selling_rate REAL DEFAULT 0,
        gst_percentage REAL DEFAULT 18,
        hsn_code TEXT,
        description TEXT,
        stock_quantity INTEGER DEFAULT 0,
        min_stock_level INTEGER DEFAULT 10,
        image_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
        FOREIGN KEY (size_id) REFERENCES sizes(id) ON DELETE SET NULL
      )
    `);

    // 5. Customers Table
    await run(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        mobile TEXT UNIQUE NOT NULL,
        gst_number TEXT,
        address TEXT,
        email TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 6. Quotations Table
    await run(`
      CREATE TABLE IF NOT EXISTS quotations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_number TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        customer_id INTEGER,
        subtotal REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        gst_amount REAL DEFAULT 0,
        grand_total REAL DEFAULT 0,
        terms TEXT,
        status TEXT CHECK(status IN ('Draft', 'Sent', 'Accepted', 'Declined')) DEFAULT 'Draft',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
      )
    `);

    // 7. Quotation Items Table
    await run(`
      CREATE TABLE IF NOT EXISTS quotation_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_id INTEGER NOT NULL,
        product_id INTEGER,
        quantity INTEGER NOT NULL CHECK(quantity > 0),
        rate REAL NOT NULL CHECK(rate >= 0),
        discount_percentage REAL DEFAULT 0,
        gst_percentage REAL DEFAULT 0,
        total_amount REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
      )
    `);

    // 8. Stock Transactions Table
    await run(`
      CREATE TABLE IF NOT EXISTS stock_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        type TEXT CHECK(type IN ('Stock In', 'Stock Out')) NOT NULL,
        rate REAL NOT NULL,
        reference TEXT, -- Supplier name for Stock In, Customer name for Stock Out
        date TEXT NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    // 9. Rate History Table
    await run(`
      CREATE TABLE IF NOT EXISTS rate_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        old_purchase_rate REAL,
        new_purchase_rate REAL,
        old_selling_rate REAL,
        new_selling_rate REAL,
        change_date TEXT NOT NULL,
        effective_date TEXT NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    // 10. Audit Logs Table
    await run(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        target_table TEXT,
        target_id INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        details TEXT,
        ip_address TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Indexes for speed optimization
    await run('CREATE INDEX IF NOT EXISTS idx_products_code ON products(code)');
    await run('CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)');
    await run('CREATE INDEX IF NOT EXISTS idx_quotations_num ON quotations(quotation_number)');
    await run('CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name)');
    await run('CREATE INDEX IF NOT EXISTS idx_sizes_name ON sizes(name)');
    await run('CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile)');

    // Seed initial admin user if empty
    const adminExists = await get('SELECT id FROM users WHERE username = ?', ['admin']);
    if (!adminExists) {
      const hash = await bcrypt.hash('admin123', 10);
      await run(
        'INSERT INTO users (username, password_hash, role, email) VALUES (?, ?, ?, ?)',
        ['admin', hash, 'Admin', 'admin@rdbearingmill.com']
      );
      console.log('Seeded initial admin user.');
    }

    // Seed sales staff user if empty
    const salesExists = await get('SELECT id FROM users WHERE username = ?', ['sales']);
    if (!salesExists) {
      const hash = await bcrypt.hash('sales123', 10);
      await run(
        'INSERT INTO users (username, password_hash, role, email) VALUES (?, ?, ?, ?)',
        ['sales', hash, 'Sales Staff', 'sales@rdbearingmill.com']
      );
      console.log('Seeded initial sales user.');
    }

    // Seed sample companies if empty
    const companiesCount = await get('SELECT COUNT(*) as count FROM companies');
    if (companiesCount.count === 0) {
      await run("INSERT INTO companies (name, code, contact_person, mobile, gst_number, address) VALUES ('SKF Bearings India', 'SKF', 'Anil Mehta', '9898989898', '07AAAAS0101A1Z1', 'Plot 4, Okhla Industrial Area, Delhi')");
      await run("INSERT INTO companies (name, code, contact_person, mobile, gst_number, address) VALUES ('Gates Corporation', 'GATES', 'John Doe', '9797979797', '07AAAAG0202A2Z2', 'A-12, Sector 63, Noida')");
      await run("INSERT INTO companies (name, code, contact_person, mobile, gst_number, address) VALUES ('FAG Bearings', 'FAG', 'Suresh Kumar', '9696969696', '07AAAAF0303A3Z3', 'Industrial Estate, Gurgaon')");
      console.log('Seeded sample companies.');
    }

    // Seed sample sizes if empty
    const sizesCount = await get('SELECT COUNT(*) as count FROM sizes');
    if (sizesCount.count === 0) {
      await run("INSERT INTO sizes (name, code, description) VALUES ('6201', '6201', 'Ball bearing 12x32x10 mm')");
      await run("INSERT INTO sizes (name, code, description) VALUES ('6202', '6202', 'Ball bearing 15x35x11 mm')");
      await run("INSERT INTO sizes (name, code, description) VALUES ('B-52', 'B-52', 'Classic V-Belt B-section 52 inch')");
      await run("INSERT INTO sizes (name, code, description) VALUES ('A-40', 'A-40', 'Classic V-Belt A-section 40 inch')");
      console.log('Seeded sample sizes.');
    }

    // Seed sample products if empty
    const productsCount = await get('SELECT COUNT(*) as count FROM products');
    if (productsCount.count === 0) {
      const skf = await get("SELECT id FROM companies WHERE code = 'SKF'");
      const gates = await get("SELECT id FROM companies WHERE code = 'GATES'");
      const fag = await get("SELECT id FROM companies WHERE code = 'FAG'");

      const s6201 = await get("SELECT id FROM sizes WHERE code = '6201'");
      const s6202 = await get("SELECT id FROM sizes WHERE code = '6202'");
      const sB52 = await get("SELECT id FROM sizes WHERE code = 'B-52'");
      const sA40 = await get("SELECT id FROM sizes WHERE code = 'A-40'");

      // Add products
      await run(`
        INSERT INTO products (name, code, category, company_id, size_id, unit, purchase_rate, selling_rate, gst_percentage, hsn_code, description, stock_quantity, min_stock_level)
        VALUES ('Ball Bearing 6201 2RS', 'BRG-6201-SKF', 'Bearing', ?, ?, 'Pcs', 80.0, 120.0, 18.0, '84821010', 'Deep groove ball bearing with rubber seals', 150, 20)
      `, [skf.id, s6201.id]);

      await run(`
        INSERT INTO products (name, code, category, company_id, size_id, unit, purchase_rate, selling_rate, gst_percentage, hsn_code, description, stock_quantity, min_stock_level)
        VALUES ('Ball Bearing 6202 ZZ', 'BRG-6202-FAG', 'Bearing', ?, ?, 'Pcs', 95.0, 140.0, 18.0, '84821010', 'Deep groove ball bearing with metal shields', 80, 15)
      `, [fag.id, s6202.id]);

      await run(`
        INSERT INTO products (name, code, category, company_id, size_id, unit, purchase_rate, selling_rate, gst_percentage, hsn_code, description, stock_quantity, min_stock_level)
        VALUES ('V-Belt B-52 Gates', 'BLT-B52-GATES', 'Belt', ?, ?, 'Pcs', 220.0, 310.0, 18.0, '40103100', 'High performance industrial wrap belt', 45, 10)
      `, [gates.id, sB52.id]);

      await run(`
        INSERT INTO products (name, code, category, company_id, size_id, unit, purchase_rate, selling_rate, gst_percentage, hsn_code, description, stock_quantity, min_stock_level)
        VALUES ('V-Belt A-40 Gates', 'BLT-A40-GATES', 'Belt', ?, ?, 'Pcs', 140.0, 200.0, 18.0, '40103100', 'Lightweight V-belt A-section 40 inch', 5, 12)
      `, [gates.id, sA40.id]);

      console.log('Seeded sample products.');

      // Insert stock transaction records for products
      const p1 = await get("SELECT id FROM products WHERE code = 'BRG-6201-SKF'");
      const p2 = await get("SELECT id FROM products WHERE code = 'BRG-6202-FAG'");
      const p3 = await get("SELECT id FROM products WHERE code = 'BLT-B52-GATES'");
      const p4 = await get("SELECT id FROM products WHERE code = 'BLT-A40-GATES'");

      const today = new Date().toISOString().split('T')[0];
      await run("INSERT INTO stock_transactions (product_id, quantity, type, rate, reference, date, notes) VALUES (?, 150, 'Stock In', 80.0, 'SKF India Depot', ?, 'Opening stock')", [p1.id, today]);
      await run("INSERT INTO stock_transactions (product_id, quantity, type, rate, reference, date, notes) VALUES (?, 80, 'Stock In', 95.0, 'FAG Distribution', ?, 'Opening stock')", [p2.id, today]);
      await run("INSERT INTO stock_transactions (product_id, quantity, type, rate, reference, date, notes) VALUES (?, 45, 'Stock In', 220.0, 'Gates Distributor', ?, 'Opening stock')", [p3.id, today]);
      await run("INSERT INTO stock_transactions (product_id, quantity, type, rate, reference, date, notes) VALUES (?, 5, 'Stock In', 140.0, 'Gates Distributor', ?, 'Low initial stock')", [p4.id, today]);
    }

    // Seed sample customers if empty
    const customersCount = await get('SELECT COUNT(*) as count FROM customers');
    if (customersCount.count === 0) {
      await run("INSERT INTO customers (name, mobile, gst_number, address, email, notes) VALUES ('Radhe Shyam Bearing Traders', '9876543210', '07AABCR1234A1Z0', '45, Chawri Bazar, Delhi - 110006', 'shyam.traders@gmail.com', 'Regular retail customer')");
      await run("INSERT INTO customers (name, mobile, gst_number, address, email, notes) VALUES ('Krishna Belt House', '9123456789', '07AAACK5678K2Z1', 'Shop 12, Sector 9, Noida - 201301', 'krishna.belts@outlook.com', 'Wholesale buyer')");
      console.log('Seeded sample customers.');
    }
  } catch (error) {
    console.error('Error seeding/creating DB tables:', error);
  }
};

module.exports = {
  db,
  query,
  get,
  run,
  exec,
  initDB
};
