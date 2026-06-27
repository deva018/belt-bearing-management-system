const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.get('/dashboard', verifyToken, reportController.getDashboardStats);
router.get('/inventory', verifyToken, requireAdmin, reportController.getInventoryReport);
router.get('/sales', verifyToken, requireAdmin, reportController.getSalesReport);

module.exports = router;
