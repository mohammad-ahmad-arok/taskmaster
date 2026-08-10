const db = require('../config/db');

const Template = {
  getAll: (callback) => {
    db.query(
      `SELECT t.id, t.name, t.description, t.created_at, COUNT(tt.id) AS step_count
       FROM project_templates t
       LEFT JOIN template_tasks tt ON tt.template_id = t.id
       GROUP BY t.id
       ORDER BY t.id DESC`,
      callback
    );
  },

  getOneWithSteps: (id, callback) => {
    db.query('SELECT * FROM project_templates WHERE id = ?', [id], (err, templateRows) => {
      if (err || templateRows.length === 0) return callback(err || new Error('Template not found'));
      db.query(
        'SELECT * FROM template_tasks WHERE template_id = ? ORDER BY sequence_order ASC',
        [id],
        (err2, steps) => {
          if (err2) return callback(err2);
          const template = templateRows[0];
          template.steps = steps;
          callback(null, template);
        }
      );
    });
  },

  create: (template, callback) => {
    db.query('INSERT INTO project_templates SET ?', template, callback);
  },

  addStep: (step, callback) => {
    db.query('INSERT INTO template_tasks SET ?', step, callback);
  },
};

module.exports = Template;
