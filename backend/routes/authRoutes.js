const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', verifyToken, authController.getMe);

// Admin-only user management
router.get('/users', verifyToken, requireAdmin, authController.getUsers);
router.post('/users', verifyToken, requireAdmin, authController.createUser);
router.delete('/users/:id', verifyToken, requireAdmin, authController.deleteUser);

module.exports = router;
