const db = require('../config/db');
const Project = require('../models/project.model');
const Employee = require('../models/employee.model');

// Every handler in this file is mounted behind requireRole('ceo') in
// financial.routes.js — nothing here is reachable by any other role.

// Real operational cost for one project:
//   sum over its tasks of (actualTimeSpentSeconds / 3600) * assignee.internal_cost_rate
// Profit margin = contract_value - operational cost.
function computeProjectProfitability(projectId, callback) {
  const sql = `
    SELECT p.id, p.name, p.contract_value,
           t.id AS task_id, t.actualTimeSpentSeconds, t.assignedTo,
           e.internal_cost_rate
    FROM project p
    LEFT JOIN task t ON t.projectId = p.id
    LEFT JOIN employees e ON e.id = t.assignedTo
    WHERE p.id = ?
  `;
  db.query(sql, [projectId], (err, rows) => {
    if (err) return callback(err);
    if (rows.length === 0) return callback(null, null);

    let operationalCost = 0;
    const taskBreakdown = [];

    rows.forEach(row => {
      if (row.task_id) {
        const hours = (row.actualTimeSpentSeconds || 0) / 3600;
        const rate = parseFloat(row.internal_cost_rate || 0);
        const cost = hours * rate;
        operationalCost += cost;
        taskBreakdown.push({
          taskId: row.task_id,
          hoursLogged: Number(hours.toFixed(2)),
          costRate: rate,
          cost: Number(cost.toFixed(2)),
        });
      }
    });

    const contractValue = parseFloat(rows[0].contract_value || 0);
    const profitMargin = contractValue - operationalCost;
    const marginPct = contractValue > 0 ? (profitMargin / contractValue) * 100 : 0;

    callback(null, {
      projectId: rows[0].id,
      projectName: rows[0].name,
      contractValue,
      operationalCost: Number(operationalCost.toFixed(2)),
      profitMargin: Number(profitMargin.toFixed(2)),
      profitMarginPct: Number(marginPct.toFixed(1)),
      taskBreakdown,
    });
  });
}

exports.getProjectProfitability = (req, res) => {
  computeProjectProfitability(req.params.projectId, (err, data) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!data) return res.status(404).json({ error: 'Project not found' });
    res.json({ success: true, data });
  });
};

// Dashboard: profitability for every project, ranked worst-to-best margin.
exports.getDashboard = (req, res) => {
  Project.getAllFinancials((err, projects) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (projects.length === 0) return res.json({ success: true, data: [] });

    let remaining = projects.length;
    const results = [];

    projects.forEach(p => {
      computeProjectProfitability(p.id, (pErr, data) => {
        if (!pErr && data) results.push(data);
        remaining -= 1;
        if (remaining === 0) {
          results.sort((a, b) => a.profitMargin - b.profitMargin);
          res.json({ success: true, data: results });
        }
      });
    });
  });
};

exports.getEmployeeCostRates = (req, res) => {
  Employee.getAllWithCost((err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true, data: rows });
  });
};

exports.setEmployeeCostRate = (req, res) => {
  const { employeeId } = req.params;
  const { costRate } = req.body;

  if (costRate === undefined || isNaN(costRate) || costRate < 0) {
    return res.status(400).json({ error: 'A valid non-negative costRate is required' });
  }

  db.query(
    'UPDATE employees SET internal_cost_rate = ? WHERE id = ?',
    [costRate, employeeId],
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Employee not found' });
      res.json({ success: true, message: 'Cost rate updated' });
    }
  );
};
