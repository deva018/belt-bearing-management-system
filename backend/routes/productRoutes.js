const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const productController = require('../controllers/productController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// Create upload directory if it does not exist
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Disk storage for product images
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
  }
});
const uploadImage = multer({ storage: imageStorage });

// Multer Memory storage for Excel imports
const memoryStorage = multer.memoryStorage();
const uploadExcel = multer({ storage: memoryStorage });

// Routes
router.get('/', verifyToken, productController.getProducts);
router.get('/export', verifyToken, productController.exportProductsExcel);
router.post('/import', verifyToken, requireAdmin, uploadExcel.single('file'), productController.importProductsExcel);

router.get('/:id', verifyToken, productController.getProductById);
router.post('/', verifyToken, requireAdmin, uploadImage.single('image'), productController.createProduct);
router.put('/:id', verifyToken, requireAdmin, uploadImage.single('image'), productController.updateProduct);
router.delete('/:id', verifyToken, requireAdmin, productController.deleteProduct);

router.get('/:id/history', verifyToken, productController.getProductHistory);

module.exports = router;
