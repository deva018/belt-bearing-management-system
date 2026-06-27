const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.get('/', verifyToken, customerController.getCustomers);
router.get('/:id', verifyToken, customerController.getCustomerById);
router.post('/', verifyToken, customerController.createCustomer);
router.put('/:id', verifyToken, customerController.updateCustomer);
router.delete('/:id', verifyToken, requireAdmin, customerController.deleteCustomer);

router.get('/:id/quotations', verifyToken, customerController.getCustomerQuotationHistory);

module.exports = router;
