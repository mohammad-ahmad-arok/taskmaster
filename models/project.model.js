const db = require('../config/db');

const Project = {
    getAll: callback => {
        db.query('SELECT project.id AS id, project.name AS name, project.description AS description, project.start_date AS startDate, project.end_date AS endDate,project.end_date AS endDate ,project.status AS status, task.id AS task_id, task.title AS task_title, task.description AS task_description, task.status AS task_status, task.deadline AS task_deadline FROM project LEFT JOIN task ON task.projectId = project.id ORDER BY project.id, task.id;', callback);
    },

    getOne: (projectId, callback) => {
        const sql = `
    SELECT project.id AS id, project.name AS name, project.description AS description, project.start_date AS startDate, project.end_date AS endDate, project.status AS status, task.id AS task_id, task.title AS task_title, task.description AS task_description,task.assignedTo AS task_assignedTo,task.assignedToName AS task_assignedToName, task.status AS task_status, task.deadline AS task_deadline, extension_requests.id AS request_id, extension_requests.reason AS request_reason, extension_requests.requested_days AS request_new_deadline, extension_requests.status AS request_status, extension_requests.created_at AS request_created_at, task_notes.id AS note_id, task_notes.content AS note_content, task_notes.created_at AS note_created_at FROM project LEFT JOIN task ON task.projectId = project.id LEFT JOIN extension_requests ON extension_requests.task_id = task.id LEFT JOIN task_notes ON task_notes.task_id = task.id WHERE project.id = ? ORDER BY project.id, task.id, extension_requests.id, task_notes.id;
  `;
        db.query(sql, [projectId], callback);
    }
    ,

    create: (project, callback) => {
        db.query('INSERT INTO  project SET ?', project, callback);
    },
};

module.exports = Project;
