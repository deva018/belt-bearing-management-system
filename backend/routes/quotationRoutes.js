const express = require('express');
const router = express.Router();
const quotationController = require('../controllers/quotationController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.get('/', verifyToken, quotationController.getQuotations);
router.get('/:id', verifyToken, quotationController.getQuotationById);
router.post('/', verifyToken, quotationController.createQuotation);
router.put('/:id', verifyToken, quotationController.updateQuotation);
router.post('/:id/duplicate', verifyToken, quotationController.duplicateQuotation);
router.get('/:id/pdf', verifyToken, quotationController.getQuotationPDFFile);
router.delete('/:id', verifyToken, requireAdmin, quotationController.deleteQuotation);

module.exports = router;
