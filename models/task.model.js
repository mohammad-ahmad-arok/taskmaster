const db = require('../config/db');

const Task = {
    getAll: callback => {
        db.query('SELECT * FROM task', callback);
    },
    getOne: (task, callback) => {
        db.query('SELECT * FROM task WHERE id=?', task, callback);
    },
    getMyTasks: (task, callback) => {
        db.query('SELECT * FROM task WHERE assignedTo=?', task, callback);
    },

    editTaskStatus: (task, status, callback) => {
        db.query('UPDATE `task` SET `status`=? WHERE `id`=?', [status, task], callback);
    },
    editExtensionRequestStatus: (task, requestId, status, callback) => {
        db.query('UPDATE `extension_requests` SET `status`=? WHERE `id`=? AND `task_id`=?;', [status, requestId, task], callback);
    },

    create: (task, callback) => {
        db.query('INSERT INTO task SET ?', task, callback);
    },

    addExtensionRequests: (extensionRequests, callback) => {
        db.query('INSERT INTO extension_requests SET ?', extensionRequests, callback);
    },

    delete: (task, callback) => {
        db.query('DELETE FROM `task` WHERE id=?', task, callback);
    }
};

module.exports = Task;
