const db = require('../config/db');

const getAuditLogs = async (req, res) => {
  try {
    const logs = await db.query(
      `SELECT a.*, u.username 
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.timestamp DESC
       LIMIT 100`
    );
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve audit logs' });
  }
};

module.exports = {
  getAuditLogs
};
