const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.post('/in', verifyToken, requireAdmin, stockController.stockIn);
router.post('/out', verifyToken, requireAdmin, stockController.stockOut);
router.get('/history', verifyToken, stockController.getStockHistory);
router.get('/valuation', verifyToken, stockController.getStockValuation);

module.exports = router;
