const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.get('/', verifyToken, companyController.getCompanies);
router.get('/:id', verifyToken, companyController.getCompanyById);
router.post('/', verifyToken, requireAdmin, companyController.createCompany);
router.put('/:id', verifyToken, requireAdmin, companyController.updateCompany);
router.delete('/:id', verifyToken, requireAdmin, companyController.deleteCompany);

router.get('/:id/products', verifyToken, companyController.getCompanyProducts);

module.exports = router;
