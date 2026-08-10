const db = require('../config/db');

// NOTE: contract_value is CEO-only financial data. getAll/getOne below
// deliberately never select it — only the financial controller
// (gated by requireRole('ceo')) reads it, via getFinancials().
const Project = {
  getAll: callback => {
    db.query(
      `SELECT project.id AS id, project.name AS name, project.description AS description,
              project.start_date AS startDate, project.end_date AS endDate, project.status AS status,
              task.id AS task_id, task.title AS task_title, task.description AS task_description,
              task.status AS task_status, task.deadline AS task_deadline,
              task.isLocked AS task_isLocked, task.dependsOnTaskId AS task_dependsOnTaskId
       FROM project
       LEFT JOIN task ON task.projectId = project.id
       ORDER BY project.id, task.id;`,
      callback
    );
  },

  getOne: (projectId, callback) => {
    const sql = `
    SELECT project.id AS id, project.name AS name, project.description AS description,
           project.start_date AS startDate, project.end_date AS endDate, project.status AS status,
           task.id AS task_id, task.title AS task_title, task.description AS task_description,
           task.assignedTo AS task_assignedTo, task.assignedToName AS task_assignedToName,
           task.status AS task_status, task.deadline AS task_deadline,
           task.isLocked AS task_isLocked, task.dependsOnTaskId AS task_dependsOnTaskId,
           task.actualTimeSpentSeconds AS task_actualTimeSpentSeconds,
           extension_requests.id AS request_id, extension_requests.reason AS request_reason,
           extension_requests.requested_days AS request_new_deadline, extension_requests.status AS request_status,
           extension_requests.created_at AS request_created_at,
           task_notes.id AS note_id, task_notes.content AS note_content,
           task_notes.attachment_url AS note_attachment_url, task_notes.attachment_name AS note_attachment_name,
           task_notes.attachment_type AS note_attachment_type, task_notes.created_at AS note_created_at
    FROM project
    LEFT JOIN task ON task.projectId = project.id
    LEFT JOIN extension_requests ON extension_requests.task_id = task.id
    LEFT JOIN task_notes ON task_notes.task_id = task.id
    WHERE project.id = ?
    ORDER BY project.id, task.id, extension_requests.id, task_notes.id;
  `;
    db.query(sql, [projectId], callback);
  },

  create: (project, callback) => {
    db.query('INSERT INTO  project SET ?', project, callback);
  },

  // ---- CEO-only (Financial Module) -------------------------------------
  getFinancials: (projectId, callback) => {
    db.query(
      'SELECT id, name, contract_value, start_date, end_date, status FROM project WHERE id = ?',
      [projectId],
      callback
    );
  },

  getAllFinancials: (callback) => {
    db.query('SELECT id, name, contract_value, start_date, end_date, status FROM project ORDER BY id', callback);
  },
};

module.exports = Project;
