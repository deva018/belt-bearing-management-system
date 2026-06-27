const express = require('express');
const router = express.Router();
const sizeController = require('../controllers/sizeController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.get('/', verifyToken, sizeController.getSizes);
router.get('/:id', verifyToken, sizeController.getSizeById);
router.post('/', verifyToken, requireAdmin, sizeController.createSize);
router.put('/:id', verifyToken, requireAdmin, sizeController.updateSize);
router.delete('/:id', verifyToken, requireAdmin, sizeController.deleteSize);

module.exports = router;
