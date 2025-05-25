const db = require('../config/db');

const Employee = {
    getAll: callback => {
        db.query("SELECT user.id AS user_id, user.name, user.email, employee_details.position, employee_details.department, employee_details.joined_date, task.id AS task_id, task.title, task.description, task.status, task.deadline FROM user JOIN employee_details ON user.id = employee_details.user_id LEFT JOIN task ON task.assignedTo = user.id WHERE user.role = 'employee' ORDER BY user.id;", callback);
    },

    getOne: (id, callback) => {
        db.query(`
        SELECT user.id AS user_id, user.name, user.email, employee_details.position, employee_details.department, employee_details.joined_date, task.id AS task_id, task.title, task.description,task.projectId,task.projectName, task.status, task.deadline, task_notes.id AS note_id, task_notes.content, task_notes.created_at AS note_created_at FROM user JOIN employee_details ON user.id = employee_details.user_id LEFT JOIN task ON task.assignedTo = user.id LEFT JOIN task_notes ON task_notes.task_id = task.id WHERE user.role = 'employee' AND user.id = ? ORDER BY task.id, task_notes.id;
    `, [id], callback);
    }


    // create: (project, callback) => {
    //     db.query('INSERT INTO  project SET ?', project, callback);
    // },
};

module.exports = Employee;

