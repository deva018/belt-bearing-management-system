// ================= GLOBAL STATE & ROUTING =================
let currentUser = null;

// Helpers for API requests
async function apiFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (res.status === 401) {
      // Session expired or unauthorized
      logoutUser(false);
      throw new Error('Unauthorized');
    }
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'API request failed');
    }
    return data;
  } catch (error) {
    console.error(`API Error (${url}):`, error);
    showToast(error.message || 'Network request failed', 'error');
    throw error;
  }
}

// Show Toast Alerts
export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-xmark';
  if (type === 'warning') icon = 'fa-circle-exclamation';

  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.style.animation = 'toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Calculator logic
function initCalculator() {
  const calcBase = document.getElementById('calc-base');
  const calcMargin = document.getElementById('calc-margin');
  const calcDiscount = document.getElementById('calc-discount');
  const calcGst = document.getElementById('calc-gst');

  const resSellingPre = document.getElementById('res-selling-pre');
  const resDiscVal = document.getElementById('res-disc-val');
  const resTaxable = document.getElementById('res-taxable');
  const resGstVal = document.getElementById('res-gst-val');
  const resFinalAmount = document.getElementById('res-final-amount');

  function calculate() {
    const base = parseFloat(calcBase.value) || 0;
    const margin = parseFloat(calcMargin.value) || 0;
    const discount = parseFloat(calcDiscount.value) || 0;
    const gstRate = parseFloat(calcGst.value) || 0;

    const sellingPre = base * (1 + margin / 100);
    const discVal = sellingPre * (discount / 100);
    const taxable = sellingPre - discVal;
    const gstVal = taxable * (gstRate / 100);
    const finalAmount = taxable + gstVal;

    resSellingPre.textContent = `Rs. ${sellingPre.toFixed(2)}`;
    resDiscVal.textContent = `- Rs. ${discVal.toFixed(2)}`;
    resTaxable.textContent = `Rs. ${taxable.toFixed(2)}`;
    resGstVal.textContent = `Rs. ${gstVal.toFixed(2)}`;
    resFinalAmount.textContent = `Rs. ${finalAmount.toFixed(2)}`;
  }

  [calcBase, calcMargin, calcDiscount, calcGst].forEach(el => {
    if (el) el.addEventListener('input', calculate);
  });

  calculate(); // Run initial calculation
}

// Authentication handlers
async function checkAuthSession() {
  try {
    const data = await apiFetch('/api/auth/me');
    if (data.user) {
      loginUserSuccess(data.user);
    } else {
      logoutUser(false);
    }
  } catch (err) {
    logoutUser(false);
  }
}

function loginUserSuccess(user) {
  currentUser = user;
  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('app-wrapper').style.display = 'grid';

  // Apply visual admin flags
  if (user.role === 'Admin') {
    document.body.classList.add('is-admin');
  } else {
    document.body.classList.remove('is-admin');
  }

  // Set Profile Information
  document.getElementById('profile-username').textContent = user.username;
  document.getElementById('profile-role').textContent = user.role;
  document.getElementById('user-avatar-char').textContent = user.username.charAt(0).toUpperCase();

  // Load initial view
  router();
}

async function logoutUser(notifyServer = true) {
  currentUser = null;
  document.getElementById('app-wrapper').style.display = 'none';
  document.getElementById('login-overlay').style.display = 'flex';
  document.body.classList.remove('is-admin');

  if (notifyServer) {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      showToast('Logged out successfully', 'success');
    } catch (e) {}
  }
}

// Router map
const routes = {
  dashboard: renderDashboard,
  products: renderProducts,
  companies: renderCompanies,
  sizes: renderSizes,
  stock: renderStock,
  customers: renderCustomers,
  quotations: renderQuotations,
  rates: renderRates,
  reports: renderReports,
  audit: renderAudit,
  users: renderUsers
};

async function router() {
  if (!currentUser) return;

  let hash = window.location.hash.slice(1) || 'dashboard';
  
  // Strip params from hash (e.g. #products?id=12)
  const queryIndex = hash.indexOf('?');
  let view = hash;
  let queryParams = {};
  if (queryIndex !== -1) {
    view = hash.substring(0, queryIndex);
    const queryString = hash.substring(queryIndex + 1);
    queryParams = Object.fromEntries(new URLSearchParams(queryString));
  }

  // Role Restriction Check
  const adminRoutes = ['rates', 'reports', 'audit', 'users'];
  if (adminRoutes.includes(view) && currentUser.role !== 'Admin') {
    showToast('Unauthorized access to page', 'error');
    window.location.hash = '#dashboard';
    return;
  }

  // Update nav item activity
  document.querySelectorAll('.nav-item').forEach(el => {
    if (el.getAttribute('data-hash') === view) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  // Set Title and Subtitle dynamically
  const titles = {
    dashboard: ['Dashboard', 'Overview of products, companies, stock and quotes.'],
    products: ['Product Inventory', 'Manage and search belts and bearings catalog.'],
    companies: ['Company Partners', 'Manufacturers and brand directories.'],
    sizes: ['Dimension Variants', 'Standard sized tags and models.'],
    stock: ['Stock Ledger', 'Stock In, Stock Out, history tracking and valuations.'],
    customers: ['Client Profiles', 'Active customer details and purchase quotes.'],
    quotations: ['Sales Quotations', 'Issue rates proposals, duplicate or download PDFs.'],
    rates: ['Bulk Price updates', 'Adjust prices globally with tracking.'],
    reports: ['Analytical Reports', 'Stock valuations, low-stocks, and growth curves.'],
    audit: ['Security Audit logs', 'Trace user operations and system updates.'],
    users: ['Staff Registration', 'Add logins and manage role clearances.']
  };

  const [title, subtitle] = titles[view] || ['RD Bearing Mill & Store', 'Belt & Bearing Trading Solutions'];
  document.getElementById('page-title').textContent = title;
  document.getElementById('page-subtitle').textContent = subtitle;

  const contentTarget = document.getElementById('app-content');
  contentTarget.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Fetching data from server...</p>
    </div>
  `;

  // Execute view renderer
  const renderer = routes[view];
  if (renderer) {
    try {
      await renderer(contentTarget, queryParams);
    } catch (err) {
      contentTarget.innerHTML = `
        <div class="card" style="text-align: center; padding: 40px;">
          <i class="fa-solid fa-triangle-exclamation text-error" style="font-size: 2.5rem; margin-bottom:12px;"></i>
          <h3>Failed to Load Screen</h3>
          <p class="text-error" style="margin-top: 8px;">${err.message}</p>
          <button class="btn btn-secondary btn-sm" style="margin-top:16px;" onclick="window.location.reload()">Reload Page</button>
        </div>
      `;
    }
  } else {
    contentTarget.innerHTML = `<h3>Screen Not Found</h3>`;
  }
}

// ================= MODAL DIALOG CONTROLLER =================
function openModal(title, bodyHTML, onConfirm = null) {
  const overlay = document.getElementById('modal-container');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');

  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHTML;
  overlay.style.display = 'flex';

  if (onConfirm) {
    const form = modalBody.querySelector('form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        try {
          const formData = new FormData(form);
          const success = await onConfirm(formData, form);
          if (success) {
            closeModal();
          }
        } catch (err) {
          showToast(err.message || 'Operation failed', 'error');
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }
  }
}

function closeModal() {
  document.getElementById('modal-container').style.display = 'none';
  document.getElementById('modal-body').innerHTML = '';
}

// ================= RENDERERS: 1. DASHBOARD =================
async function renderDashboard(container) {
  const stats = await apiFetch('/api/reports/dashboard');

  container.innerHTML = `
    <div class="dashboard-grid">
      <div class="stat-card blue">
        <div class="stat-content">
          <h3>Total Products</h3>
          <div class="stat-val">${stats.summary.totalProducts}</div>
        </div>
        <div class="stat-icon"><i class="fa-solid fa-cubes"></i></div>
      </div>
      <div class="stat-card green">
        <div class="stat-content">
          <h3>Total Stock Qty</h3>
          <div class="stat-val">${stats.summary.totalStock}</div>
        </div>
        <div class="stat-icon"><i class="fa-solid fa-boxes-stacked"></i></div>
      </div>
      <div class="stat-card orange">
        <div class="stat-content">
          <h3>Low Stock Items</h3>
          <div class="stat-val">${stats.summary.lowStockProducts}</div>
        </div>
        <div class="stat-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
      </div>
      <div class="stat-card red">
        <div class="stat-content">
          <h3>Quotes Generated</h3>
          <div class="stat-val">${stats.summary.totalQuotes}</div>
        </div>
        <div class="stat-icon"><i class="fa-solid fa-file-invoice-dollar"></i></div>
      </div>
    </div>

    <div class="dashboard-sections">
      <div class="card">
        <div class="card-title-bar">
          <h3>Recent Quotations Issued</h3>
          <a href="#quotations" class="btn btn-secondary btn-sm">View All</a>
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Quote No</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Total Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${stats.recentQuotes.map(q => `
                <tr>
                  <td><strong>${q.quotation_number}</strong></td>
                  <td>${q.date}</td>
                  <td>${q.customer_name || 'Walk-In'}</td>
                  <td>Rs. ${q.grand_total.toFixed(2)}</td>
                  <td><span class="badge badge-${q.status === 'Accepted' ? 'success' : q.status === 'Draft' ? 'warning' : 'info'}">${q.status}</span></td>
                </tr>
              `).join('') || '<tr><td colspan="5" style="text-align:center;">No recent quotations</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-title-bar">
          <h3>Recent Rate Updates</h3>
          <a href="#rates" class="btn btn-secondary btn-sm admin-only">Update</a>
        </div>
        <div class="table-responsive">
          <table class="custom-table" style="font-size: 0.85rem;">
            <thead>
              <tr>
                <th>Product</th>
                <th>Old Rs</th>
                <th>New Rs</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${stats.recentRates.map(r => `
                <tr>
                  <td><strong>${r.product_code}</strong><br><small>${r.product_name}</small></td>
                  <td>${r.old_selling_rate || 0}</td>
                  <td class="text-success">${r.new_selling_rate || 0}</td>
                  <td>${r.change_date}</td>
                </tr>
              `).join('') || '<tr><td colspan="4" style="text-align:center;">No recent rate logs</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ================= RENDERERS: 2. PRODUCTS =================
async function renderProducts(container, params) {
  // Load dependencies in parallel
  const [companies, sizes] = await Promise.all([
    apiFetch('/api/companies'),
    apiFetch('/api/sizes')
  ]);

  let searchVal = '';
  let catVal = '';
  let compVal = '';
  let sizeVal = '';
  let stockAlertVal = '';
  let page = 1;

  async function loadTable() {
    const query = new URLSearchParams({
      search: searchVal,
      category: catVal,
      company_id: compVal,
      size_id: sizeVal,
      min_stock: stockAlertVal,
      page
    }).toString();

    const data = await apiFetch(`/api/products?${query}`);
    const tbody = container.querySelector('#products-table-body');
    const pagination = container.querySelector('#products-pagination');

    tbody.innerHTML = data.products.map(p => `
      <tr class="${p.stock_quantity <= p.min_stock_level ? 'warning-row' : ''}">
        <td>
          ${p.image_path ? `<img src="${p.image_path}" class="table-thumb" alt="${p.name}">` : `<div class="table-thumb-placeholder"><i class="fa-solid fa-image"></i></div>`}
        </td>
        <td><strong>${p.code}</strong></td>
        <td>
          <a href="#" class="view-product-details-link" data-id="${p.id}">${p.name}</a>
        </td>
        <td><span class="badge badge-info">${p.category}</span></td>
        <td>${p.company_name || 'N/A'}</td>
        <td>${p.size_name || 'N/A'}</td>
        <td>${p.purchase_rate.toFixed(2)}</td>
        <td><strong>${p.selling_rate.toFixed(2)}</strong></td>
        <td>
          <span class="badge badge-${p.stock_quantity === 0 ? 'danger' : p.stock_quantity <= p.min_stock_level ? 'warning' : 'success'}">
            ${p.stock_quantity} / ${p.min_stock_level} (${p.unit})
          </span>
        </td>
        <td class="admin-only" style="text-align: right;">
          <button class="btn btn-secondary btn-sm edit-product-btn" data-id="${p.id}"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-danger btn-sm delete-product-btn" data-id="${p.id}"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="10" style="text-align:center;">No matching products found.</td></tr>';

    // Click links to view details
    tbody.querySelectorAll('.view-product-details-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        viewProductDetails(link.getAttribute('data-id'));
      });
    });

    // Edit/Delete binds
    tbody.querySelectorAll('.edit-product-btn').forEach(btn => {
      btn.addEventListener('click', () => openProductForm(btn.getAttribute('data-id')));
    });

    tbody.querySelectorAll('.delete-product-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteProductItem(btn.getAttribute('data-id')));
    });

    // Pagination display
    const pg = data.pagination;
    pagination.innerHTML = `
      <span>Showing Page <strong>${pg.currentPage}</strong> of <strong>${pg.totalPages || 1}</strong> (${pg.totalItems} items)</span>
      <div class="pagination-buttons">
        <button class="btn btn-secondary btn-sm" id="pg-prev-btn" ${pg.currentPage <= 1 ? 'disabled' : ''}>Prev</button>
        <button class="btn btn-secondary btn-sm" id="pg-next-btn" ${pg.currentPage >= pg.totalPages ? 'disabled' : ''}>Next</button>
      </div>
    `;

    const prevBtn = pagination.querySelector('#pg-prev-btn');
    const nextBtn = pagination.querySelector('#pg-next-btn');

    if (prevBtn) prevBtn.addEventListener('click', () => { page--; loadTable(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { page++; loadTable(); });
  }

  container.innerHTML = `
    <div class="card">
      <div class="card-title-bar">
        <h3>Master Product Catalog</h3>
        <div class="action-row">
          <button class="btn btn-secondary btn-sm" id="export-excel-btn"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
          <button class="btn btn-secondary btn-sm admin-only" id="import-excel-btn"><i class="fa-solid fa-file-arrow-up"></i> Import Excel</button>
          <button class="btn btn-primary btn-sm admin-only" id="add-product-btn"><i class="fa-solid fa-plus"></i> Add Product</button>
        </div>
      </div>

      <div class="search-filter-bar">
        <div class="search-box-wrapper">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" id="product-search-input" class="search-input" placeholder="Search by name, code, sizes or company...">
        </div>
        <select id="filter-category" class="filter-select">
          <option value="">All Categories</option>
          <option value="Belt">Belts</option>
          <option value="Bearing">Bearings</option>
          <option value="Other">Others</option>
        </select>
        <select id="filter-company" class="filter-select">
          <option value="">All Companies</option>
          ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
        <select id="filter-size" class="filter-select">
          <option value="">All Sizes</option>
          ${sizes.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
        </select>
        <select id="filter-stock" class="filter-select">
          <option value="">All Stock Levels</option>
          <option value="true">Low Stock Alert</option>
          <option value="out">Out Of Stock</option>
        </select>
      </div>

      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th style="width: 50px;">Image</th>
              <th>Code</th>
              <th>Product Name</th>
              <th>Category</th>
              <th>Company</th>
              <th>Size</th>
              <th>Purchase Rs</th>
              <th>Selling Rs</th>
              <th>Stock / Min</th>
              <th class="admin-only" style="width: 120px; text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody id="products-table-body"></tbody>
        </table>
      </div>

      <div class="pagination-wrapper" id="products-pagination"></div>
    </div>
  `;

  // Event Listeners
  const searchInput = container.querySelector('#product-search-input');
  const catSelect = container.querySelector('#filter-category');
  const compSelect = container.querySelector('#filter-company');
  const sizeSelect = container.querySelector('#filter-size');
  const stockSelect = container.querySelector('#filter-stock');

  // Instant Search debounce
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchVal = searchInput.value;
      page = 1;
      loadTable();
    }, 300);
  });

  [catSelect, compSelect, sizeSelect, stockSelect].forEach(el => {
    el.addEventListener('change', () => {
      catVal = catSelect.value;
      compVal = compSelect.value;
      sizeVal = sizeSelect.value;
      stockAlertVal = stockSelect.value;
      page = 1;
      loadTable();
    });
  });

  container.querySelector('#add-product-btn').addEventListener('click', () => openProductForm());

  container.querySelector('#export-excel-btn').addEventListener('click', () => {
    window.open('/api/products/export', '_blank');
  });

  container.querySelector('#import-excel-btn').addEventListener('click', openImportModal);

  // Initial load
  loadTable();

  // Dialog builders
  function openProductForm(id = null) {
    const isEdit = id !== null;
    const title = isEdit ? 'Modify Product Profile' : 'Add New Product';
    
    let html = `
      <form id="product-form" enctype="multipart/form-data">
        <div class="form-grid">
          <div class="form-group">
            <label for="p-name">Product Name *</label>
            <input type="text" id="p-name" name="name" class="form-control" required>
          </div>
          <div class="form-group">
            <label for="p-code">Product Code / SKU *</label>
            <input type="text" id="p-code" name="code" class="form-control" required>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label for="p-cat">Category *</label>
            <select id="p-cat" name="category" class="form-control" required>
              <option value="Belt">Belt</option>
              <option value="Bearing">Bearing</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div class="form-group">
            <label for="p-unit">Measurement Unit</label>
            <input type="text" id="p-unit" name="unit" class="form-control" placeholder="Pcs, Mtr, Box" value="Pcs">
          </div>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label for="p-comp">Company Profile</label>
            <select id="p-comp" name="company_id" class="form-control">
              <option value="">-- Select Company --</option>
              ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="p-size">Size Profile</label>
            <select id="p-size" name="size_id" class="form-control">
              <option value="">-- Select Size --</option>
              ${sizes.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label for="p-purchase">Purchase Rate (Rs.)</label>
            <input type="number" id="p-purchase" name="purchase_rate" class="form-control" value="0" min="0" step="any">
          </div>
          <div class="form-group">
            <label for="p-sell">Selling Rate (Rs.)</label>
            <input type="number" id="p-sell" name="selling_rate" class="form-control" value="0" min="0" step="any">
          </div>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label for="p-gst">GST Percentage (%)</label>
            <input type="number" id="p-gst" name="gst_percentage" class="form-control" value="18" min="0" max="100">
          </div>
          <div class="form-group">
            <label for="p-hsn">HSN Code</label>
            <input type="text" id="p-hsn" name="hsn_code" class="form-control">
          </div>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label for="p-stock">Starting Stock Qty</label>
            <input type="number" id="p-stock" name="stock_quantity" class="form-control" value="0" min="0" ${isEdit ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label for="p-min">Minimum Stock level</label>
            <input type="number" id="p-min" name="min_stock_level" class="form-control" value="10" min="0">
          </div>
        </div>
        <div class="form-group">
          <label for="p-desc">Product Description</label>
          <textarea id="p-desc" name="description" class="form-control" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label for="p-image">Product Profile Image</label>
          <input type="file" id="p-image" name="image" class="form-control" accept="image/*">
        </div>
        <div style="text-align: right; margin-top:20px;">
          <button type="button" class="btn btn-secondary btn-close-modal" id="p-form-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Create Product'}</button>
        </div>
      </form>
    `;

    openModal(title, html, async (formData) => {
      const url = isEdit ? `/api/products/${id}` : '/api/products';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          // Do NOT set Content-Type header when uploading FormData with files; browser sets it automatically
        },
        body: formData
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.message || 'Operation failed');
      }

      showToast(resData.message, 'success');
      loadTable();
      return true;
    });

    // Bind cancel
    document.getElementById('p-form-cancel').addEventListener('click', closeModal);

    // If edit, pre-fill values
    if (isEdit) {
      apiFetch(`/api/products/${id}`).then(p => {
        document.getElementById('p-name').value = p.name;
        document.getElementById('p-code').value = p.code;
        document.getElementById('p-cat').value = p.category;
        document.getElementById('p-unit').value = p.unit;
        document.getElementById('p-comp').value = p.company_id || '';
        document.getElementById('p-size').value = p.size_id || '';
        document.getElementById('p-purchase').value = p.purchase_rate;
        document.getElementById('p-sell').value = p.selling_rate;
        document.getElementById('p-gst').value = p.gst_percentage;
        document.getElementById('p-hsn').value = p.hsn_code || '';
        document.getElementById('p-min').value = p.min_stock_level;
        document.getElementById('p-desc').value = p.description || '';
      });
    }
  }

  async function deleteProductItem(id) {
    if (confirm('Are you sure you want to delete this product? This action is irreversible.')) {
      const res = await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
      showToast(res.message, 'success');
      loadTable();
    }
  }

  function openImportModal() {
    const html = `
      <form id="import-form">
        <div class="form-group">
          <label>Select Product Excel File (.xlsx, .xls) *</label>
          <input type="file" name="file" class="form-control" accept=".xlsx, .xls" required>
        </div>
        <div class="card-info" style="font-size:0.8rem; margin:12px 0; color:var(--text-secondary);">
          <p>Columns expected in excel:</p>
          <strong style="color:var(--primary-color);">Product Name, Product Code, Category (Belt/Bearing/Other), Company Code, Size Code, Purchase Rate, Selling Rate, HSN Code, Stock Quantity</strong>
        </div>
        <div style="text-align: right; margin-top:20px;">
          <button type="button" class="btn btn-secondary" id="import-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">Process Import</button>
        </div>
      </form>
    `;

    openModal('Bulk Import from Excel', html, async (formData) => {
      const response = await fetch('/api/products/import', {
        method: 'POST',
        body: formData
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.message || 'Excel import failed');

      showToast(`Imported: ${resData.successCount} products, Errors: ${resData.errorCount}`, 'success');
      loadTable();
      return true;
    });

    document.getElementById('import-cancel').addEventListener('click', closeModal);
  }

  async function viewProductDetails(id) {
    const [p, history] = await Promise.all([
      apiFetch(`/api/products/${id}`),
      apiFetch(`/api/products/${id}/history`)
    ]);

    const html = `
      <div class="product-detail-layout">
        <div>
          ${p.image_path ? `<img src="${p.image_path}" class="product-detail-img" alt="${p.name}">` : `<div class="product-detail-img" style="display:flex;align-items:center;justify-content:center;background:var(--bg-primary);"><i class="fa-solid fa-image" style="font-size:3rem;color:var(--text-muted);"></i></div>`}
        </div>
        <div class="product-detail-info">
          <h2>${p.name}</h2>
          <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:12px;">SKU/Code: <strong>${p.code}</strong></p>
          
          <div class="form-grid" style="font-size:0.9rem;">
            <div>Category: <span class="badge badge-info">${p.category}</span></div>
            <div>Brand/Company: <strong>${p.company_name || 'N/A'}</strong></div>
            <div>Size: <strong>${p.size_name || 'N/A'}</strong></div>
            <div>Unit: <strong>${p.unit}</strong></div>
          </div>
          <div class="form-grid" style="font-size:0.9rem; margin-top:8px;">
            <div>Purchase: <strong>Rs. ${p.purchase_rate.toFixed(2)}</strong></div>
            <div>Selling: <strong style="color:var(--primary-color);">Rs. ${p.selling_rate.toFixed(2)}</strong></div>
            <div>GST Tax: <strong>${p.gst_percentage}%</strong></div>
            <div>HSN Code: <strong>${p.hsn_code || 'N/A'}</strong></div>
          </div>
          <div class="form-grid" style="font-size:0.9rem; margin-top:8px;">
            <div>Stock Level: <strong class="text-${p.stock_quantity <= p.min_stock_level ? 'warning' : 'success'}">${p.stock_quantity} units</strong></div>
            <div>Min Alert Level: <strong>${p.min_stock_level} units</strong></div>
          </div>
          <p style="margin-top:12px; font-size:0.85rem;"><strong>Description:</strong> ${p.description || 'No description provided.'}</p>
        </div>
      </div>

      <div class="calc-divider" style="margin:20px 0;"></div>

      <div class="form-grid">
        <div>
          <h4 style="margin-bottom:10px;"><i class="fa-solid fa-boxes-stacked"></i> Recent Stock Movements</h4>
          <div class="table-responsive" style="max-height:180px;">
            <table class="custom-table" style="font-size:0.8rem;">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Ref</th>
                </tr>
              </thead>
              <tbody>
                ${history.stock.map(s => `
                  <tr>
                    <td>${s.date}</td>
                    <td><span class="text-${s.type === 'Stock In' ? 'success' : 'error'}">${s.type}</span></td>
                    <td><strong>${s.quantity}</strong></td>
                    <td>${s.reference || 'N/A'}</td>
                  </tr>
                `).join('') || '<tr><td colspan="4" style="text-align:center;">No stock transaction history</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h4 style="margin-bottom:10px;"><i class="fa-solid fa-tags"></i> Price Revision Logs</h4>
          <div class="table-responsive" style="max-height:180px;">
            <table class="custom-table" style="font-size:0.8rem;">
              <thead>
                <tr>
                  <th>Rev Date</th>
                  <th>Old Rs</th>
                  <th>New Rs</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                ${history.rates.map(r => `
                  <tr>
                    <td>${r.change_date}</td>
                    <td>${(r.old_selling_rate || 0).toFixed(2)}</td>
                    <td class="text-success"><strong>${(r.new_selling_rate || 0).toFixed(2)}</strong></td>
                    <td>${r.notes || ''}</td>
                  </tr>
                `).join('') || '<tr><td colspan="4" style="text-align:center;">No price history logged</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <div style="text-align: right; margin-top:20px;">
        <button class="btn btn-secondary" onclick="document.getElementById('modal-container').style.display='none'">Close View</button>
      </div>
    `;

    openModal('Product File Details', html);
  }
}

// ================= RENDERERS: 3. COMPANIES =================
async function renderCompanies(container) {
  async function loadList() {
    const list = await apiFetch('/api/companies');
    const tbody = container.querySelector('#company-table-body');
    tbody.innerHTML = list.map(c => `
      <tr>
        <td><strong>${c.code}</strong></td>
        <td><a href="#" class="company-view-link" data-id="${c.id}">${c.name}</a></td>
        <td>${c.contact_person || 'N/A'}</td>
        <td>${c.mobile || 'N/A'}</td>
        <td>${c.gst_number || 'N/A'}</td>
        <td>${c.address || 'N/A'}</td>
        <td class="admin-only" style="text-align: right;">
          <button class="btn btn-secondary btn-sm edit-btn" data-id="${c.id}"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-danger btn-sm delete-btn" data-id="${c.id}"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="7" style="text-align:center;">No companies registered yet</td></tr>';

    tbody.querySelectorAll('.company-view-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        viewCompanyProducts(link.getAttribute('data-id'), link.textContent);
      });
    });

    tbody.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => openCompanyForm(btn.getAttribute('data-id')));
    });

    tbody.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteCompanyItem(btn.getAttribute('data-id')));
    });
  }

  container.innerHTML = `
    <div class="card">
      <div class="card-title-bar">
        <h3>Brand Companies Directory</h3>
        <button class="btn btn-primary btn-sm admin-only" id="add-company-btn"><i class="fa-solid fa-plus"></i> Add Company</button>
      </div>
      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Company Name</th>
              <th>Contact Person</th>
              <th>Mobile Number</th>
              <th>GST Number</th>
              <th>Address</th>
              <th class="admin-only" style="width: 120px; text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody id="company-table-body"></tbody>
        </table>
      </div>
    </div>
  `;

  container.querySelector('#add-company-btn').addEventListener('click', () => openCompanyForm());
  loadList();

  function openCompanyForm(id = null) {
    const isEdit = id !== null;
    openModal(isEdit ? 'Edit Company Profile' : 'Add New Company Brand', `
      <form id="company-form">
        <div class="form-grid">
          <div class="form-group">
            <label for="c-name">Company Name *</label>
            <input type="text" id="c-name" name="name" class="form-control" required>
          </div>
          <div class="form-group">
            <label for="c-code">Company Code (e.g. SKF, FAG) *</label>
            <input type="text" id="c-code" name="code" class="form-control" required>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label for="c-person">Contact Person</label>
            <input type="text" id="c-person" name="contact_person" class="form-control">
          </div>
          <div class="form-group">
            <label for="c-mobile">Mobile Number</label>
            <input type="text" id="c-mobile" name="mobile" class="form-control">
          </div>
        </div>
        <div class="form-group">
          <label for="c-gst">GSTIN Number</label>
          <input type="text" id="c-gst" name="gst_number" class="form-control">
        </div>
        <div class="form-group">
          <label for="c-addr">Office Address</label>
          <textarea id="c-addr" name="address" class="form-control" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label for="c-notes">Notes</label>
          <textarea id="c-notes" name="notes" class="form-control" rows="2"></textarea>
        </div>
        <div style="text-align: right; margin-top:20px;">
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('modal-container').style.display='none'">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Profile</button>
        </div>
      </form>
    `, async (formData) => {
      const url = isEdit ? `/api/companies/${id}` : '/api/companies';
      const method = isEdit ? 'PUT' : 'POST';
      const rawData = Object.fromEntries(formData);

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rawData)
      });

      showToast(res.message, 'success');
      loadList();
      return true;
    });

    if (isEdit) {
      apiFetch(`/api/companies/${id}`).then(c => {
        document.getElementById('c-name').value = c.name;
        document.getElementById('c-code').value = c.code;
        document.getElementById('c-person').value = c.contact_person || '';
        document.getElementById('c-mobile').value = c.mobile || '';
        document.getElementById('c-gst').value = c.gst_number || '';
        document.getElementById('c-addr').value = c.address || '';
        document.getElementById('c-notes').value = c.notes || '';
      });
    }
  }

  async function deleteCompanyItem(id) {
    if (confirm('Are you sure you want to delete this company?')) {
      const res = await apiFetch(`/api/companies/${id}`, { method: 'DELETE' });
      showToast(res.message, 'success');
      loadList();
    }
  }

  async function viewCompanyProducts(id, compName) {
    const products = await apiFetch(`/api/companies/${id}/products`);
    const html = `
      <h3>Products Manufactured by ${compName}</h3>
      <div class="table-responsive" style="margin-top:16px; max-height: 350px;">
        <table class="custom-table">
          <thead>
            <tr>
              <th>SKU Code</th>
              <th>Product Name</th>
              <th>Category</th>
              <th>Selling Rs</th>
              <th>Stock Qty</th>
            </tr>
          </thead>
          <tbody>
            ${products.map(p => `
              <tr>
                <td><strong>${p.code}</strong></td>
                <td>${p.name}</td>
                <td>${p.category}</td>
                <td>Rs. ${p.selling_rate.toFixed(2)}</td>
                <td><span class="badge badge-${p.stock_quantity <= p.min_stock_level ? 'warning' : 'success'}">${p.stock_quantity}</span></td>
              </tr>
            `).join('') || '<tr><td colspan="5" style="text-align:center;">No products associated with this brand company.</td></tr>'}
          </tbody>
        </table>
      </div>
      <div style="text-align: right; margin-top:20px;">
        <button class="btn btn-secondary" onclick="document.getElementById('modal-container').style.display='none'">Close</button>
      </div>
    `;
    openModal(`${compName} Products`, html);
  }
}

// ================= RENDERERS: 4. SIZES =================
async function renderSizes(container) {
  async function loadList() {
    const list = await apiFetch('/api/sizes');
    const tbody = container.querySelector('#sizes-table-body');
    tbody.innerHTML = list.map(s => `
      <tr>
        <td><strong>${s.code}</strong></td>
        <td>${s.name}</td>
        <td>${s.description || 'N/A'}</td>
        <td class="admin-only" style="text-align: right;">
          <button class="btn btn-secondary btn-sm edit-btn" data-id="${s.id}"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-danger btn-sm delete-btn" data-id="${s.id}"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center;">No standard sizes recorded</td></tr>';

    tbody.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => openSizeForm(btn.getAttribute('data-id')));
    });

    tbody.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteSizeItem(btn.getAttribute('data-id')));
    });
  }

  container.innerHTML = `
    <div class="card" style="max-width: 800px; margin: 0 auto;">
      <div class="card-title-bar">
        <h3>Dimension Size Profiles</h3>
        <button class="btn btn-primary btn-sm admin-only" id="add-size-btn"><i class="fa-solid fa-plus"></i> Add Size</button>
      </div>
      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Size Code (e.g. 6201, B-52)</th>
              <th>Display Label</th>
              <th>Description</th>
              <th class="admin-only" style="width: 120px; text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody id="sizes-table-body"></tbody>
        </table>
      </div>
    </div>
  `;

  container.querySelector('#add-size-btn').addEventListener('click', () => openSizeForm());
  loadList();

  function openSizeForm(id = null) {
    const isEdit = id !== null;
    openModal(isEdit ? 'Edit Size Code' : 'Add Dimension Code', `
      <form id="size-form">
        <div class="form-group">
          <label for="s-code">Size Code (Unique Identifier) *</label>
          <input type="text" id="s-code" name="code" class="form-control" required placeholder="6201, A-40, etc.">
        </div>
        <div class="form-group">
          <label for="s-name">Display Name *</label>
          <input type="text" id="s-name" name="name" class="form-control" required placeholder="SKF 6201, V-Belt A-40">
        </div>
        <div class="form-group">
          <label for="s-desc">Size Description / Dimensions</label>
          <textarea id="s-desc" name="description" class="form-control" rows="2" placeholder="ID x OD x Width specs"></textarea>
        </div>
        <div style="text-align: right; margin-top:20px;">
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('modal-container').style.display='none'">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Size</button>
        </div>
      </form>
    `, async (formData) => {
      const url = isEdit ? `/api/sizes/${id}` : '/api/sizes';
      const method = isEdit ? 'PUT' : 'POST';
      const rawData = Object.fromEntries(formData);

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rawData)
      });

      showToast(res.message, 'success');
      loadList();
      return true;
    });

    if (isEdit) {
      apiFetch(`/api/sizes/${id}`).then(s => {
        document.getElementById('s-code').value = s.code;
        document.getElementById('s-name').value = s.name;
        document.getElementById('s-desc').value = s.description || '';
      });
    }
  }

  async function deleteSizeItem(id) {
    if (confirm('Are you sure you want to delete this size profile?')) {
      const res = await apiFetch(`/api/sizes/${id}`, { method: 'DELETE' });
      showToast(res.message, 'success');
      loadList();
    }
  }
}

// ================= RENDERERS: 5. STOCK =================
async function renderStock(container) {
  const [products, history, valuation] = await Promise.all([
    apiFetch('/api/products?limit=200'),
    apiFetch('/api/stock/history'),
    apiFetch('/api/stock/valuation')
  ]);

  const pList = products.products;

  container.innerHTML = `
    <div class="dashboard-grid">
      <div class="stat-card blue">
        <div class="stat-content">
          <h3>Total Stock Units</h3>
          <div class="stat-val">${valuation.summary.totalStock}</div>
        </div>
        <div class="stat-icon"><i class="fa-solid fa-boxes-stacked"></i></div>
      </div>
      <div class="stat-card green">
        <div class="stat-content">
          <h3>Valuation (Purchase Rate)</h3>
          <div class="stat-val">Rs. ${valuation.summary.totalPurchaseValue.toFixed(2)}</div>
        </div>
        <div class="stat-icon"><i class="fa-solid fa-indian-rupee-sign"></i></div>
      </div>
      <div class="stat-card orange">
        <div class="stat-content">
          <h3>Estimated Sales Worth</h3>
          <div class="stat-val">Rs. ${valuation.summary.totalSellingValue.toFixed(2)}</div>
        </div>
        <div class="stat-icon"><i class="fa-solid fa-wallet"></i></div>
      </div>
      <div class="stat-card red">
        <div class="stat-content">
          <h3>Estimated Profit Margins</h3>
          <div class="stat-val">Rs. ${valuation.summary.estimatedMargin.toFixed(2)}</div>
        </div>
        <div class="stat-icon"><i class="fa-solid fa-percent"></i></div>
      </div>
    </div>

    <div class="dashboard-sections">
      <div class="card">
        <div class="card-title-bar">
          <h3>Stock Transaction History</h3>
          <div class="admin-only action-row">
            <button class="btn btn-primary btn-sm" id="stock-in-btn"><i class="fa-solid fa-plus-circle"></i> Stock In</button>
            <button class="btn btn-danger btn-sm" id="stock-out-btn"><i class="fa-solid fa-minus-circle"></i> Stock Out</button>
          </div>
        </div>
        
        <div class="table-responsive" style="max-height: 400px;">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Tx ID</th>
                <th>Date</th>
                <th>Product Description</th>
                <th>Tx Type</th>
                <th>Quantity</th>
                <th>Rate Applied</th>
                <th>Ref (Supplier/Client)</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${history.map(t => `
                <tr>
                  <td>TX-${t.id}</td>
                  <td>${t.date}</td>
                  <td><strong>${t.product_code}</strong><br><small>${t.product_name}</small></td>
                  <td><span class="badge badge-${t.type === 'Stock In' ? 'success' : 'danger'}">${t.type}</span></td>
                  <td><strong>${t.quantity}</strong></td>
                  <td>Rs. ${t.rate.toFixed(2)}</td>
                  <td>${t.reference || 'N/A'}</td>
                  <td><small>${t.notes || ''}</small></td>
                </tr>
              `).join('') || '<tr><td colspan="8" style="text-align:center;">No stock transactions recorded yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-title-bar">
          <h3>Valuation Breakdowns</h3>
        </div>
        <div class="table-responsive" style="max-height:400px;">
          <table class="custom-table" style="font-size:0.85rem;">
            <thead>
              <tr>
                <th>Code</th>
                <th>Stock</th>
                <th>Purchase Cost</th>
              </tr>
            </thead>
            <tbody>
              ${valuation.products.map(p => `
                <tr>
                  <td><strong>${p.code}</strong><br><small>${p.name}</small></td>
                  <td><strong>${p.stock_quantity}</strong></td>
                  <td>Rs. ${p.purchase_value.toFixed(2)}</td>
                </tr>
              `).join('') || '<tr><td colspan="3" style="text-align:center;">Empty stock valuations</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Bind Actions if Admin
  const inBtn = container.querySelector('#stock-in-btn');
  const outBtn = container.querySelector('#stock-out-btn');
  
  if (inBtn) {
    inBtn.addEventListener('click', () => openStockTxForm('Stock In'));
  }
  if (outBtn) {
    outBtn.addEventListener('click', () => openStockTxForm('Stock Out'));
  }

  function openStockTxForm(type) {
    const isStockIn = type === 'Stock In';
    openModal(`${type} Transaction`, `
      <form id="stock-tx-form">
        <div class="form-group">
          <label for="st-prod">Select Product *</label>
          <select id="st-prod" name="product_id" class="form-control" required>
            <option value="">-- Select Product --</option>
            ${pList.map(p => `<option value="${p.id}" data-purchase="${p.purchase_rate}" data-selling="${p.selling_rate}">${p.code} - ${p.name} (Stock: ${p.stock_quantity})</option>`).join('')}
          </select>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label for="st-qty">Quantity *</label>
            <input type="number" id="st-qty" name="quantity" class="form-control" min="1" required value="10">
          </div>
          <div class="form-group">
            <label for="st-rate">Rate Applied (Rs.) *</label>
            <input type="number" id="st-rate" name="${isStockIn ? 'purchase_rate' : 'rate'}" class="form-control" min="0" step="any" required>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label for="st-ref">${isStockIn ? 'Supplier Name' : 'Customer Name'}</label>
            <input type="text" id="st-ref" name="${isStockIn ? 'supplier' : 'customer'}" class="form-control" placeholder="Walk-In details">
          </div>
          <div class="form-group">
            <label for="st-date">Transaction Date *</label>
            <input type="date" id="st-date" name="date" class="form-control" required value="${new Date().toISOString().split('T')[0]}">
          </div>
        </div>
        <div class="form-group">
          <label for="st-notes">Transaction Notes</label>
          <textarea id="st-notes" name="notes" class="form-control" rows="2"></textarea>
        </div>
        <div style="text-align: right; margin-top:20px;">
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('modal-container').style.display='none'">Cancel</button>
          <button type="submit" class="btn btn-primary">Process ${type}</button>
        </div>
      </form>
    `, async (formData) => {
      const url = isStockIn ? '/api/stock/in' : '/api/stock/out';
      const rawData = Object.fromEntries(formData);

      const res = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rawData)
      });

      showToast(res.message, 'success');
      renderStock(container); // Reload entire view
      return true;
    });

    // Auto load current product rate on product select change
    const pSelect = document.getElementById('st-prod');
    const rInput = document.getElementById('st-rate');
    pSelect.addEventListener('change', () => {
      const opt = pSelect.options[pSelect.selectedIndex];
      if (opt) {
        rInput.value = isStockIn ? opt.getAttribute('data-purchase') : opt.getAttribute('data-selling');
      }
    });
  }
}

// ================= RENDERERS: 6. CUSTOMERS =================
async function renderCustomers(container) {
  async function loadList() {
    const list = await apiFetch('/api/customers');
    const tbody = container.querySelector('#customer-table-body');
    tbody.innerHTML = list.map(c => `
      <tr>
        <td><strong>${c.name}</strong></td>
        <td>${c.mobile}</td>
        <td>${c.gst_number || 'N/A'}</td>
        <td>${c.email || 'N/A'}</td>
        <td>${c.address || 'N/A'}</td>
        <td>
          <button class="btn btn-secondary btn-sm history-btn" data-id="${c.id}"><i class="fa-solid fa-clock-history"></i> Quotes</button>
        </td>
        <td style="text-align: right;">
          <button class="btn btn-secondary btn-sm edit-btn" data-id="${c.id}"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-danger btn-sm delete-btn admin-only" data-id="${c.id}"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="7" style="text-align:center;">No customers added yet</td></tr>';

    tbody.querySelectorAll('.history-btn').forEach(btn => {
      btn.addEventListener('click', () => viewCustomerHistory(btn.getAttribute('data-id'), btn.closest('tr').cells[0].textContent));
    });

    tbody.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => openCustomerForm(btn.getAttribute('data-id')));
    });

    tbody.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteCustomerItem(btn.getAttribute('data-id')));
    });
  }

  container.innerHTML = `
    <div class="card">
      <div class="card-title-bar">
        <h3>Customer Accounts Ledger</h3>
        <button class="btn btn-primary btn-sm" id="add-customer-btn"><i class="fa-solid fa-plus"></i> Add Customer</button>
      </div>
      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Mobile Number</th>
              <th>GST Number</th>
              <th>Email</th>
              <th>Address</th>
              <th>Quotation Logs</th>
              <th style="width: 120px; text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody id="customer-table-body"></tbody>
        </table>
      </div>
    </div>
  `;

  container.querySelector('#add-customer-btn').addEventListener('click', () => openCustomerForm());
  loadList();

  function openCustomerForm(id = null) {
    const isEdit = id !== null;
    openModal(isEdit ? 'Edit Customer Details' : 'Register New Customer', `
      <form id="customer-form">
        <div class="form-grid">
          <div class="form-group">
            <label for="cu-name">Customer Name *</label>
            <input type="text" id="cu-name" name="name" class="form-control" required placeholder="Proprietor/Company">
          </div>
          <div class="form-group">
            <label for="cu-mob">Mobile Number *</label>
            <input type="text" id="cu-mob" name="mobile" class="form-control" required placeholder="10-digit number">
          </div>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label for="cu-gst">GSTIN (Optional)</label>
            <input type="text" id="cu-gst" name="gst_number" class="form-control">
          </div>
          <div class="form-group">
            <label for="cu-email">Email Address</label>
            <input type="email" id="cu-email" name="email" class="form-control">
          </div>
        </div>
        <div class="form-group">
          <label for="cu-addr">Billing/Shipping Address</label>
          <textarea id="cu-addr" name="address" class="form-control" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label for="cu-notes">Internal Notes</label>
          <textarea id="cu-notes" name="notes" class="form-control" rows="2"></textarea>
        </div>
        <div style="text-align: right; margin-top:20px;">
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('modal-container').style.display='none'">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Details</button>
        </div>
      </form>
    `, async (formData) => {
      const url = isEdit ? `/api/customers/${id}` : '/api/customers';
      const method = isEdit ? 'PUT' : 'POST';
      const rawData = Object.fromEntries(formData);

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rawData)
      });

      showToast(res.message, 'success');
      loadList();
      return true;
    });

    if (isEdit) {
      apiFetch(`/api/customers/${id}`).then(c => {
        document.getElementById('cu-name').value = c.name;
        document.getElementById('cu-mob').value = c.mobile;
        document.getElementById('cu-gst').value = c.gst_number || '';
        document.getElementById('cu-email').value = c.email || '';
        document.getElementById('cu-addr').value = c.address || '';
        document.getElementById('cu-notes').value = c.notes || '';
      });
    }
  }

  async function deleteCustomerItem(id) {
    if (confirm('Are you sure you want to delete this customer record?')) {
      const res = await apiFetch(`/api/customers/${id}`, { method: 'DELETE' });
      showToast(res.message, 'success');
      loadList();
    }
  }

  async function viewCustomerHistory(id, name) {
    const quotes = await apiFetch(`/api/customers/${id}/quotations`);
    const html = `
      <h3>Quotations Log for ${name}</h3>
      <div class="table-responsive" style="margin-top:16px; max-height:300px;">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Quote No</th>
              <th>Issue Date</th>
              <th>Grand Total</th>
              <th>Status</th>
              <th>PDF</th>
            </tr>
          </thead>
          <tbody>
            ${quotes.map(q => `
              <tr>
                <td><strong>${q.quotation_number}</strong></td>
                <td>${q.date}</td>
                <td>Rs. ${q.grand_total.toFixed(2)}</td>
                <td><span class="badge badge-${q.status === 'Accepted' ? 'success' : 'warning'}">${q.status}</span></td>
                <td>
                  <a href="/api/quotations/${q.id}/pdf" target="_blank" class="btn btn-secondary btn-sm"><i class="fa-solid fa-file-pdf text-error"></i> View</a>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="5" style="text-align:center;">No quotations issued to this client yet.</td></tr>'}
          </tbody>
        </table>
      </div>
      <div style="text-align: right; margin-top:20px;">
        <button class="btn btn-secondary" onclick="document.getElementById('modal-container').style.display='none'">Close</button>
      </div>
    `;
    openModal(`${name} History`, html);
  }
}

// ================= RENDERERS: 7. QUOTATIONS =================
async function renderQuotations(container) {
  // Load lookup lists
  const [customers, products] = await Promise.all([
    apiFetch('/api/customers'),
    apiFetch('/api/products?limit=500')
  ]);

  const pList = products.products;

  async function loadList() {
    const quotes = await apiFetch('/api/quotations');
    const tbody = container.querySelector('#quotations-table-body');
    
    tbody.innerHTML = quotes.map(q => `
      <tr>
        <td><strong>${q.quotation_number}</strong></td>
        <td>${q.date}</td>
        <td><strong>${q.customer_name || 'Walk-In Customer'}</strong><br><small>${q.customer_mobile || ''}</small></td>
        <td>Rs. ${q.subtotal.toFixed(2)}</td>
        <td>Rs. ${q.gst_amount.toFixed(2)}</td>
        <td><strong>Rs. ${q.grand_total.toFixed(2)}</strong></td>
        <td><span class="badge badge-${q.status === 'Accepted' ? 'success' : q.status === 'Sent' ? 'info' : q.status === 'Declined' ? 'danger' : 'warning'}">${q.status}</span></td>
        <td style="text-align: right; white-space: nowrap;">
          <a href="/api/quotations/${q.id}/pdf" target="_blank" class="btn btn-secondary btn-sm" title="Print/PDF"><i class="fa-solid fa-file-pdf text-error"></i></a>
          <button class="btn btn-secondary btn-sm duplicate-btn" data-id="${q.id}" title="Duplicate Quote"><i class="fa-solid fa-copy"></i></button>
          <button class="btn btn-secondary btn-sm edit-btn" data-id="${q.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-danger btn-sm delete-btn admin-only" data-id="${q.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="8" style="text-align:center;">No quotations generated yet</td></tr>';

    // Event Binds
    tbody.querySelectorAll('.duplicate-btn').forEach(btn => {
      btn.addEventListener('click', () => duplicateQuote(btn.getAttribute('data-id')));
    });

    tbody.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => openQuotationBuilder(btn.getAttribute('data-id')));
    });

    tbody.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteQuotationItem(btn.getAttribute('data-id')));
    });
  }

  container.innerHTML = `
    <div class="card">
      <div class="card-title-bar">
        <h3>Quotations Manager</h3>
        <button class="btn btn-primary btn-sm" id="create-quote-btn"><i class="fa-solid fa-plus-circle"></i> Create Quotation</button>
      </div>
      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Quotation No</th>
              <th>Issue Date</th>
              <th>Customer</th>
              <th>Taxable Amount</th>
              <th>GST Tax</th>
              <th>Grand Total</th>
              <th>Status</th>
              <th style="width: 180px; text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody id="quotations-table-body"></tbody>
        </table>
      </div>
    </div>
  `;

  container.querySelector('#create-quote-btn').addEventListener('click', () => openQuotationBuilder());
  loadList();

  // Quotation Builder wizard
  function openQuotationBuilder(id = null) {
    const isEdit = id !== null;
    const title = isEdit ? 'Edit Quotation Details' : 'Generate New Quotation';

    let builderHTML = `
      <form id="quotation-builder-form">
        <div class="form-grid">
          <div class="form-group">
            <label for="q-cust">Customer *</label>
            <select id="q-cust" name="customer_id" class="form-control" required>
              <option value="">-- Select Customer --</option>
              ${customers.map(c => `<option value="${c.id}">${c.name} (${c.mobile})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="q-date">Quotation Date *</label>
            <input type="date" id="q-date" name="date" class="form-control" required value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label for="q-status">Quotation Status</label>
            <select id="q-status" name="status" class="form-control">
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Accepted">Accepted</option>
              <option value="Declined">Declined</option>
            </select>
          </div>
        </div>

        <div class="quote-items-container">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h4>Items Table</h4>
            <button type="button" class="btn btn-secondary btn-sm" id="add-row-btn"><i class="fa-solid fa-plus-circle"></i> Add Row</button>
          </div>
          <div class="quote-rows-wrapper" id="quote-rows-wrapper">
            <!-- Row headers -->
            <div class="quote-item-row" style="font-weight:600; font-size:0.8rem; margin-bottom:8px; border-bottom:1px solid var(--border-color); padding-bottom:4px;">
              <div>Product Item</div>
              <div>Qty</div>
              <div>Rate (Rs)</div>
              <div>Disc %</div>
              <div>Total (Incl GST)</div>
              <div></div>
            </div>
            <!-- Dynamic rows injected here -->
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group" style="grid-column: span 2;">
            <label for="q-terms">Terms & Conditions</label>
            <textarea id="q-terms" name="terms" class="form-control" rows="2">1. Validity: 30 Days.
2. Payment: 100% against delivery.
3. Warranty: Standard OEM warranty.</textarea>
          </div>
          <div class="quote-totals-summary">
            <div class="form-group" style="margin-bottom:6px;">
              <label>Extra Overall Discount (Rs.):</label>
              <input type="number" id="q-disc-amt" name="discount_amount" class="form-control" value="0" min="0" step="any" style="max-width:150px; text-align:right;">
            </div>
            <div style="font-size:0.9rem; margin-top:10px;">Taxable Subtotal: <strong id="lbl-subtotal">Rs. 0.00</strong></div>
            <div style="font-size:0.9rem;">GST Tax: <strong id="lbl-gst">Rs. 0.00</strong></div>
            <div style="font-size:1.2rem; border-top:1px solid var(--border-color); padding-top:6px; margin-top:6px;">
              Grand Total: <strong id="lbl-total" style="color:var(--primary-color);">Rs. 0.00</strong>
            </div>
          </div>
        </div>

        <div style="text-align: right; margin-top:20px;">
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('modal-container').style.display='none'">Cancel</button>
          <button type="submit" class="btn btn-primary">Process Quotation</button>
        </div>
      </form>
    `;

    // Make modal large
    document.getElementById('modal-card').style.maxWidth = '900px';

    openModal(title, builderHTML, async (formData, form) => {
      // Collect row items
      const items = [];
      const itemRows = form.querySelectorAll('.row-record');
      
      itemRows.forEach(row => {
        const product_id = row.querySelector('.row-prod').value;
        const quantity = row.querySelector('.row-qty').value;
        const rate = row.querySelector('.row-rate').value;
        const discount_percentage = row.querySelector('.row-disc').value;
        
        if (product_id && quantity) {
          items.push({
            product_id: parseInt(product_id),
            quantity: parseInt(quantity),
            rate: parseFloat(rate),
            discount_percentage: parseFloat(discount_percentage)
          });
        }
      });

      if (items.length === 0) {
        throw new Error('Please add at least one valid product item.');
      }

      const rawObj = {
        customer_id: parseInt(formData.get('customer_id')),
        date: formData.get('date'),
        status: formData.get('status'),
        terms: formData.get('terms'),
        discount_amount: parseFloat(formData.get('discount_amount') || 0),
        items
      };

      const url = isEdit ? `/api/quotations/${id}` : '/api/quotations';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rawObj)
      });

      showToast(res.message, 'success');
      loadList();
      // Restore modal size
      document.getElementById('modal-card').style.maxWidth = '650px';
      return true;
    });

    const addRowBtn = document.getElementById('add-row-btn');
    const rowsWrapper = document.getElementById('quote-rows-wrapper');
    const discInput = document.getElementById('q-disc-amt');

    // Bind item totals calculation trigger
    function computeQuotationTotals() {
      let subtotal = 0;
      let taxValue = 0;

      const rows = rowsWrapper.querySelectorAll('.row-record');
      rows.forEach(row => {
        const prodSelect = row.querySelector('.row-prod');
        const qtyVal = parseInt(row.querySelector('.row-qty').value) || 0;
        const rateVal = parseFloat(row.querySelector('.row-rate').value) || 0;
        const discVal = parseFloat(row.querySelector('.row-disc').value) || 0;

        const opt = prodSelect.options[prodSelect.selectedIndex];
        let gstPct = 18;
        if (opt) gstPct = parseFloat(opt.getAttribute('data-gst')) || 18;

        const rowSub = qtyVal * rateVal;
        const rowDisc = rowSub * (discVal / 100);
        const rowTaxable = rowSub - rowDisc;
        const rowGst = rowTaxable * (gstPct / 100);
        const rowTotal = rowTaxable + rowGst;

        row.querySelector('.row-total-lbl').textContent = `Rs. ${rowTotal.toFixed(2)}`;
        
        subtotal += rowTaxable;
        taxValue += rowGst;
      });

      const overallDisc = parseFloat(discInput.value) || 0;
      const grandTotal = subtotal + taxValue - overallDisc;

      document.getElementById('lbl-subtotal').textContent = `Rs. ${subtotal.toFixed(2)}`;
      document.getElementById('lbl-gst').textContent = `Rs. ${taxValue.toFixed(2)}`;
      document.getElementById('lbl-total').textContent = `Rs. ${grandTotal.toFixed(2)}`;
    }

    // Function to add a product row in quotation list
    function addRow(data = null) {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'quote-item-row row-record';
      rowDiv.innerHTML = `
        <div>
          <select class="form-control row-prod" required>
            <option value="">-- Product --</option>
            ${pList.map(p => `<option value="${p.id}" data-gst="${p.gst_percentage}" data-rate="${p.selling_rate}">${p.code} - ${p.name}</option>`).join('')}
          </select>
        </div>
        <div><input type="number" class="form-control row-qty" min="1" value="1" required></div>
        <div><input type="number" class="form-control row-rate" min="0" step="any" required></div>
        <div><input type="number" class="form-control row-disc" min="0" max="100" value="0"></div>
        <div style="font-weight:600; text-align:right;" class="row-total-lbl">Rs. 0.00</div>
        <div><button type="button" class="btn btn-danger btn-sm row-remove-btn" style="padding: 6px;"><i class="fa-solid fa-times"></i></button></div>
      `;

      rowsWrapper.appendChild(rowDiv);

      const pSelect = rowDiv.querySelector('.row-prod');
      const qtyInput = rowDiv.querySelector('.row-qty');
      const rateInput = rowDiv.querySelector('.row-rate');
      const discItemInput = rowDiv.querySelector('.row-disc');
      const remBtn = rowDiv.querySelector('.row-remove-btn');

      pSelect.addEventListener('change', () => {
        const opt = pSelect.options[pSelect.selectedIndex];
        if (opt) {
          rateInput.value = opt.getAttribute('data-rate');
          computeQuotationTotals();
        }
      });

      [qtyInput, rateInput, discItemInput].forEach(el => {
        el.addEventListener('input', computeQuotationTotals);
      });

      remBtn.addEventListener('click', () => {
        rowDiv.remove();
        computeQuotationTotals();
      });

      // Prefill if data is provided
      if (data) {
        pSelect.value = data.product_id;
        qtyInput.value = data.quantity;
        rateInput.value = data.rate;
        discItemInput.value = data.discount_percentage;
        computeQuotationTotals();
      }
    }

    addRowBtn.addEventListener('click', () => addRow());
    discInput.addEventListener('input', computeQuotationTotals);

    // Close clean modal reset
    document.getElementById('modal-close-btn').addEventListener('click', () => {
      document.getElementById('modal-card').style.maxWidth = '650px';
    });

    // If edit, retrieve quotation details
    if (isEdit) {
      apiFetch(`/api/quotations/${id}`).then(qData => {
        document.getElementById('q-cust').value = qData.quotation.customer_id;
        document.getElementById('q-date').value = qData.quotation.date;
        document.getElementById('q-status').value = qData.quotation.status;
        document.getElementById('q-terms').value = qData.quotation.terms;
        discInput.value = qData.quotation.discount_amount;
        
        qData.items.forEach(item => {
          addRow(item);
        });
      });
    } else {
      addRow(); // Add first blank row
    }
  }

  async function duplicateQuote(id) {
    if (confirm('Create a duplicate copy of this quotation? (Will be saved as Draft)')) {
      const res = await apiFetch(`/api/quotations/${id}/duplicate`, { method: 'POST' });
      showToast(res.message, 'success');
      loadList();
    }
  }

  async function deleteQuotationItem(id) {
    if (confirm('Are you sure you want to delete this quotation?')) {
      const res = await apiFetch(`/api/quotations/${id}`, { method: 'DELETE' });
      showToast(res.message, 'success');
      loadList();
    }
  }
}

// ================= RENDERERS: 8. RATES =================
async function renderRates(container) {
  const [companies, sizes, history] = await Promise.all([
    apiFetch('/api/companies'),
    apiFetch('/api/sizes'),
    apiFetch('/api/rates/history')
  ]);

  container.innerHTML = `
    <div class="dashboard-sections">
      <div class="card">
        <div class="card-title-bar">
          <h3>Bulk Pricing adjustment</h3>
        </div>
        <form id="bulk-rates-form">
          <div class="form-group">
            <label>Filters (Modify only products matching):</label>
            <div class="form-grid">
              <select name="company_id" class="form-control">
                <option value="">-- Matching Company (All) --</option>
                ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
              </select>
              <select name="category" class="form-control">
                <option value="">-- Matching Category (All) --</option>
                <option value="Belt">Belt</option>
                <option value="Bearing">Bearing</option>
                <option value="Other">Other</option>
              </select>
              <select name="size_id" class="form-control">
                <option value="">-- Matching Size (All) --</option>
                ${sizes.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
              </select>
            </div>
          </div>
          
          <div class="calc-divider"></div>

          <div class="form-grid">
            <div class="form-group">
              <label>Rate Column to Revise *</label>
              <select name="rate_type" class="form-control" required>
                <option value="purchase_rate">Purchase Rate Only</option>
                <option value="selling_rate">Selling Rate Only</option>
                <option value="both">Both Purchase & Selling Rates</option>
              </select>
            </div>
            <div class="form-group">
              <label>Adjustment Metric *</label>
              <select name="adjustment_type" class="form-control" required>
                <option value="percentage">Percentage Revision (%)</option>
                <option value="flat">Flat revision (Rs.)</option>
              </select>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Revision Value *</label>
              <input type="number" name="adjustment_value" class="form-control" required placeholder="Use -ve values to reduce rate (e.g. -5)">
            </div>
            <div class="form-group">
              <label>Effective Revision Date *</label>
              <input type="date" name="effective_date" class="form-control" required value="${new Date().toISOString().split('T')[0]}">
            </div>
          </div>

          <div class="form-group">
            <label>Revision Notes / Reason</label>
            <input type="text" name="notes" class="form-control" placeholder="Supplier pricing revisions, summer sales">
          </div>

          <button type="submit" class="btn btn-primary"><i class="fa-solid fa-save"></i> Execute Global Re-pricing</button>
        </form>
      </div>

      <div class="card">
        <div class="card-title-bar">
          <h3>Pricing Change Logs</h3>
        </div>
        <div class="table-responsive" style="max-height: 400px;">
          <table class="custom-table" style="font-size:0.85rem;">
            <thead>
              <tr>
                <th>Code / Description</th>
                <th>Selling Rev</th>
                <th>Date</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              ${history.map(h => `
                <tr>
                  <td><strong>${h.product_code}</strong><br><small>${h.product_name}</small></td>
                  <td>${h.old_selling_rate.toFixed(2)} &rarr; <strong class="text-success">${h.new_selling_rate.toFixed(2)}</strong></td>
                  <td>${h.change_date}</td>
                  <td><small>${h.notes || 'Bulk modification'}</small></td>
                </tr>
              `).join('') || '<tr><td colspan="4" style="text-align:center;">No global pricing revisions recorded</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Submit bulk updates
  const form = container.querySelector('#bulk-rates-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!confirm('Are you sure you want to perform this bulk update? It will alter the prices of multiple products in the database.')) {
      return;
    }

    const rawData = Object.fromEntries(new FormData(form));
    
    // Convert inputs
    if (rawData.company_id) rawData.company_id = parseInt(rawData.company_id);
    if (rawData.size_id) rawData.size_id = parseInt(rawData.size_id);
    rawData.adjustment_value = parseFloat(rawData.adjustment_value);

    const res = await apiFetch('/api/rates/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rawData)
    });

    showToast(res.message, 'success');
    renderRates(container); // Reload view
  });
}

// ================= RENDERERS: 9. REPORTS =================
async function renderReports(container) {
  const [sales, inventory] = await Promise.all([
    apiFetch('/api/reports/sales'),
    apiFetch('/api/reports/inventory')
  ]);

  container.innerHTML = `
    <div class="form-grid">
      <div class="card">
        <div class="card-title-bar">
          <h3>Quotations status metrics</h3>
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Quantity Count</th>
                <th>Value Sum</th>
              </tr>
            </thead>
            <tbody>
              ${sales.quotesByStatus.map(s => `
                <tr>
                  <td><span class="badge badge-${s.status === 'Accepted' ? 'success' : s.status === 'Declined' ? 'danger' : 'warning'}">${s.status}</span></td>
                  <td><strong>${s.count}</strong></td>
                  <td>Rs. ${(s.total_val || 0).toFixed(2)}</td>
                </tr>
              `).join('') || '<tr><td colspan="3" style="text-align:center;">No status stats</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-title-bar">
          <h3>Stock Categories Overview</h3>
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Uniques Count</th>
                <th>Total stock qty</th>
              </tr>
            </thead>
            <tbody>
              ${inventory.categories.map(c => `
                <tr>
                  <td><strong>${c.category}</strong></td>
                  <td>${c.count} products</td>
                  <td><strong>${c.total_stock || 0} units</strong></td>
                </tr>
              `).join('') || '<tr><td colspan="3" style="text-align:center;">No category stats</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title-bar">
        <h3>Critical Low Stock Products</h3>
      </div>
      <div class="table-responsive" style="max-height: 250px;">
        <table class="custom-table">
          <thead>
            <tr>
              <th>SKU Code</th>
              <th>Product Name</th>
              <th>Category</th>
              <th>Brand Company</th>
              <th>Available Stock</th>
              <th>Alert Min Level</th>
            </tr>
          </thead>
          <tbody>
            ${inventory.lowStockList.map(p => `
              <tr class="warning-row">
                <td><strong>${p.code}</strong></td>
                <td>${p.name}</td>
                <td>${p.category}</td>
                <td>${p.company_name || 'N/A'}</td>
                <td><strong class="text-error">${p.stock_quantity}</strong></td>
                <td>${p.min_stock_level}</td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--success-color);">All products have sufficient stock levels!</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ================= RENDERERS: 10. AUDIT LOGS =================
async function renderAudit(container) {
  const logs = await apiFetch('/api/audit');

  container.innerHTML = `
    <div class="card">
      <div class="card-title-bar">
        <h3>Security Audit Logs</h3>
      </div>
      <div class="table-responsive" style="max-height: 500px;">
        <table class="custom-table" style="font-size: 0.85rem;">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Operation/Action</th>
              <th>Object ID</th>
              <th>Operator Details</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(l => `
              <tr>
                <td>${new Date(l.timestamp).toLocaleString()}</td>
                <td><strong>${l.username || 'System'}</strong></td>
                <td><span class="badge badge-info">${l.action}</span></td>
                <td>${l.target_table ? `${l.target_table} (ID: ${l.target_id || 'N/A'})` : 'N/A'}</td>
                <td><small>${l.details || ''}</small></td>
                <td><code>${l.ip_address || 'N/A'}</code></td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="text-align:center;">No audit logs yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ================= RENDERERS: 11. USER SETUP =================
async function renderUsers(container) {
  async function loadList() {
    const list = await apiFetch('/api/auth/users');
    const tbody = container.querySelector('#users-table-body');
    tbody.innerHTML = list.map(u => `
      <tr>
        <td><strong>${u.username}</strong></td>
        <td><span class="badge badge-${u.role === 'Admin' ? 'success' : 'info'}">${u.role}</span></td>
        <td>${u.email || 'N/A'}</td>
        <td>${new Date(u.created_at).toLocaleDateString()}</td>
        <td style="text-align: right;">
          <button class="btn btn-danger btn-sm delete-btn" data-id="${u.id}" ${u.username === 'admin' ? 'disabled' : ''}><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteUserItem(btn.getAttribute('data-id')));
    });
  }

  container.innerHTML = `
    <div class="card" style="max-width: 800px; margin: 0 auto;">
      <div class="card-title-bar">
        <h3>User Profiles Setup</h3>
        <button class="btn btn-primary btn-sm" id="add-user-btn"><i class="fa-solid fa-user-plus"></i> Add Staff User</button>
      </div>
      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Clearance Role</th>
              <th>Email</th>
              <th>Registered Date</th>
              <th style="width: 100px; text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody id="users-table-body"></tbody>
        </table>
      </div>
    </div>
  `;

  container.querySelector('#add-user-btn').addEventListener('click', openUserForm);
  loadList();

  function openUserForm() {
    openModal('Add Staff Account', `
      <form id="user-form">
        <div class="form-group">
          <label for="u-uname">Username *</label>
          <input type="text" id="u-uname" name="username" class="form-control" required placeholder="User account login name">
        </div>
        <div class="form-group">
          <label for="u-pass">Password *</label>
          <input type="password" id="u-pass" name="password" class="form-control" required placeholder="At least 6 characters">
        </div>
        <div class="form-group">
          <label for="u-role">System Role clearance *</label>
          <select id="u-role" name="role" class="form-control" required>
            <option value="Sales Staff">Sales Staff (Quotation & stock viewer)</option>
            <option value="Admin">Admin (Full system configurations)</option>
          </select>
        </div>
        <div class="form-group">
          <label for="u-email">Email Address</label>
          <input type="email" id="u-email" name="email" class="form-control" placeholder="user@company.com">
        </div>
        <div style="text-align: right; margin-top:20px;">
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('modal-container').style.display='none'">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Account</button>
        </div>
      </form>
    `, async (formData) => {
      const rawData = Object.fromEntries(formData);
      const res = await apiFetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rawData)
      });
      showToast(res.message, 'success');
      loadList();
      return true;
    });
  }

  async function deleteUserItem(id) {
    if (confirm('Delete this user account?')) {
      const res = await apiFetch(`/api/auth/users/${id}`, { method: 'DELETE' });
      showToast(res.message, 'success');
      loadList();
    }
  }
}

// ================= BOOTSTRAP INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  // Theme management
  const themeSwitch = document.getElementById('theme-switch');
  const storedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', storedTheme);
  
  if (storedTheme === 'light') {
    themeSwitch.innerHTML = '<i class="fa-solid fa-moon"></i>';
  } else {
    themeSwitch.innerHTML = '<i class="fa-solid fa-sun"></i>';
  }

  themeSwitch.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    if (newTheme === 'light') {
      themeSwitch.innerHTML = '<i class="fa-solid fa-moon"></i>';
    } else {
      themeSwitch.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }
  });

  // Sidebar toggle
  document.getElementById('toggle-sidebar-btn').addEventListener('click', () => {
    document.getElementById('app-wrapper').classList.toggle('sidebar-collapsed');
  });

  // Modal closes
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-container')) {
      closeModal();
    }
  });

  // Calculator logic binding
  document.getElementById('calculator-toggle').addEventListener('click', () => {
    const calc = document.getElementById('calculator-widget');
    calc.style.display = calc.style.display === 'block' ? 'none' : 'block';
  });

  document.getElementById('calc-close-btn').addEventListener('click', () => {
    document.getElementById('calculator-widget').style.display = 'none';
  });

  // Login handler
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    const loginBtn = document.getElementById('login-btn');

    loginBtn.disabled = true;
    errorDiv.style.display = 'none';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      showToast('Logged in successfully', 'success');
      loginUserSuccess(data.user);
    } catch (err) {
      errorDiv.style.display = 'flex';
      errorDiv.querySelector('span').textContent = err.message;
      showToast(err.message, 'error');
    } finally {
      loginBtn.disabled = false;
    }
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    if (confirm('Are you sure you want to sign out?')) {
      logoutUser(true);
    }
  });

  // Init global calc
  initCalculator();

  // Load routing
  window.addEventListener('hashchange', router);

  // Authenticate user session
  checkAuthSession();
});
