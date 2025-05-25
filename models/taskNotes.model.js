const db = require('../config/db');

const TaskNote = {
    getAll: callback => {
        db.query('SELECT * FROM task_notes', callback);
    },
    getByTaskId: (taskId, callback) => {
        const query = 'SELECT * FROM task_notes WHERE task_id = ? ORDER BY created_at DESC';
        db.query(query, [taskId], callback);
    },
    create: (taskNote, callback) => {
        db.query('INSERT INTO  task_notes SET ?', taskNote, callback);
    },
    getByIdWithExtensions: (taskId, callback) => {
        const taskQuery = 'SELECT * FROM task WHERE id = ?';
        const extensionsQuery = 'SELECT * FROM extension_requests WHERE task_id = ? ORDER BY created_at DESC';

        db.query(taskQuery, [taskId], (err, taskResults) => {
            if (err || taskResults.length === 0) return callback(err || new Error('Task not found'));

            const task = taskResults[0];

            db.query(extensionsQuery, [taskId], (extErr, extensionResults) => {
                if (extErr) return callback(extErr);
                task.extensionRequests = extensionResults;
                callback(null, task);
            });
        });
    }
};

module.exports = TaskNote;
