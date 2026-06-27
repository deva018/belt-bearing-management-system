const express = require('express');
const router = express.Router();
const rateController = require('../controllers/rateController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.post('/bulk', verifyToken, requireAdmin, rateController.bulkUpdateRates);
router.get('/history', verifyToken, rateController.getGlobalRateHistory);

module.exports = router;
