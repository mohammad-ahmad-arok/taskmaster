const db = require('../config/db');

// NOTE: internal_cost_rate is CEO-only financial data. Every query below
// that is reachable by non-CEO roles deliberately omits that column.
// Only getAllWithCost / getCostRate (used exclusively by the financial
// controller, which is gated by requireRole('ceo')) select it.

const Employee = {
  getAll: (callback) => {
    db.query(
      `SELECT e.id AS user_id, e.name, e.email, e.position, e.department,
              e.joined_date, e.manager_id,
              t.id AS task_id, t.title, t.description, t.status, t.deadline
       FROM employees e
       LEFT JOIN task t ON t.assignedTo = e.id
       ORDER BY e.id`,
      callback
    );
  },

  getOne: (id, callback) => {
    db.query(
      `SELECT e.id AS user_id, e.name, e.email, e.position, e.department, e.joined_date,
              t.id AS task_id, t.title, t.description, t.projectId, t.projectName,
              t.status, t.deadline, t.isLocked, t.dependsOnTaskId,
              tn.id AS note_id, tn.content, tn.created_at AS note_created_at
       FROM employees e
       LEFT JOIN task t ON t.assignedTo = e.id
       LEFT JOIN task_notes tn ON tn.task_id = t.id
       WHERE e.id = ?
       ORDER BY t.id, tn.id`,
      [id],
      callback
    );
  },

  getById: (id, callback) => {
    db.query(
      'SELECT id, name, email, position, department, joined_date, manager_id FROM employees WHERE id = ? LIMIT 1',
      [id],
      callback
    );
  },

  getByEmailWithSecret: (email, callback) => {
    db.query('SELECT * FROM employees WHERE email = ? LIMIT 1', [email], callback);
  },

  create: (employee, callback) => {
    db.query('INSERT INTO employees SET ?', employee, callback);
  },

  delete: (id, callback) => {
    db.query('DELETE FROM `employees` WHERE id = ?', [id], callback);
  },

  updateLastLogin: (id, callback) => {
    db.query('UPDATE employees SET last_login = NOW() WHERE id = ?', [id], callback);
  },

  // ---- CEO-only (Financial Module) -------------------------------------
  getAllWithCost: (callback) => {
    db.query(
      'SELECT id, name, email, position, department, internal_cost_rate, manager_id FROM employees ORDER BY id',
      callback
    );
  },

  getCostRate: (id, callback) => {
    db.query('SELECT internal_cost_rate FROM employees WHERE id = ?', [id], callback);
  },
};

module.exports = Employee;
