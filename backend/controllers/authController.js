const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');

const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Save Audit log
    await db.run('INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [
      user.id,
      'User Login',
      `User ${username} logged in successfully`,
      req.ip
    ]);

    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // Set to true if running over HTTPS
      maxAge: 8 * 60 * 60 * 1000 // 8 hours
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const logout = async (req, res) => {
  try {
    if (req.user) {
      await db.run('INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [
        req.user.id,
        'User Logout',
        `User ${req.user.username} logged out`,
        req.ip
      ]);
    }
  } catch (err) {
    console.error('Logout logging error:', err);
  }

  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
};

const getMe = (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  res.json({ user: req.user });
};

// Admin only: Get all users
const getUsers = async (req, res) => {
  try {
    const users = await db.query('SELECT id, username, role, email, created_at FROM users');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve users' });
  }
};

// Admin only: Add User
const createUser = async (req, res) => {
  const { username, password, role, email } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Username, password, and role are required' });
  }

  try {
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.run(
      'INSERT INTO users (username, password_hash, role, email) VALUES (?, ?, ?, ?)',
      [username, passwordHash, role, email || '']
    );

    // Audit log
    await db.run('INSERT INTO audit_logs (user_id, action, target_table, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)', [
      req.user.id,
      'Create User',
      'users',
      result.id,
      `Created user ${username} with role ${role}`,
      req.ip
    ]);

    res.status(201).json({ message: 'User created successfully', userId: result.id });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create user' });
  }
};

// Admin only: Delete User
const deleteUser = async (req, res) => {
  const { id } = req.params;

  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ message: 'You cannot delete yourself' });
  }

  try {
    const user = await db.get('SELECT username FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.username === 'admin') {
      return res.status(400).json({ message: 'Default admin user cannot be deleted' });
    }

    await db.run('DELETE FROM users WHERE id = ?', [id]);

    // Audit log
    await db.run('INSERT INTO audit_logs (user_id, action, target_table, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)', [
      req.user.id,
      'Delete User',
      'users',
      id,
      `Deleted user ${user.username}`,
      req.ip
    ]);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete user' });
  }
};

module.exports = {
  login,
  logout,
  getMe,
  getUsers,
  createUser,
  deleteUser
};
