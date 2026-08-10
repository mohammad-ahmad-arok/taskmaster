const Employee = require('../models/employee.model');
const { createAccount } = require('../utils/createAccount');
const { notifyEmployeeAdded } = require('../utils/notificationHelper');

// get all employees (never includes internal_cost_rate — see financial.controller.js)
exports.getAllEmployee = (req, res) => {
    Employee.getAll((err, rows) => {
        if (err) return res.status(500).json({ error: 'Database Error' });

        const grouped = {};

        rows.forEach(row => {
            if (!grouped[row.user_id]) {
                grouped[row.user_id] = {
                    user_id: row.user_id,
                    name: row.name,
                    email: row.email,
                    position: row.position,
                    department: row.department,
                    joined_date: row.joined_date,
                    manager_id: row.manager_id,
                    tasks: []
                };
            }

            if (row.task_id) {
                grouped[row.user_id].tasks.push({
                    id: row.task_id,
                    title: row.title,
                    description: row.description,
                    status: row.status,
                    deadline: row.deadline
                });
            }
        });

        res.json({ data: Object.values(grouped) });
    });
};

// get employee by id
exports.getOneEmployee = (req, res) => {
    const employeeId = req.params.id;
    const requester = req.user;

    // Employees may only view their own record; managers/QA/CEO can view any.
    if (requester.role === 'employee' && String(requester.id) !== String(employeeId)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    Employee.getOne(employeeId, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database Error' });
        if (rows.length === 0) return res.status(404).json({ error: 'Employee not found' });

        const result = {
            user_id: rows[0].user_id,
            name: rows[0].name,
            email: rows[0].email,
            position: rows[0].position,
            department: rows[0].department,
            joined_date: rows[0].joined_date,
            tasks: []
        };

        const tasksMap = {};

        rows.forEach(row => {
            if (row.task_id) {
                if (!tasksMap[row.task_id]) {
                    tasksMap[row.task_id] = {
                        id: row.task_id,
                        title: row.title,
                        projectId: row.projectId,
                        projectName: row.projectName,
                        description: row.description,
                        status: row.status,
                        deadline: row.deadline,
                        isLocked: !!row.isLocked,
                        dependsOnTaskId: row.dependsOnTaskId,
                        notes: []
                    };
                }

                if (row.note_id) {
                    tasksMap[row.task_id].notes.push({
                        id: row.note_id,
                        content: row.content,
                        created_at: row.note_created_at
                    });
                }
            }
        });

        result.tasks = Object.values(tasksMap);
        res.json({ data: result });
    });
};

// create a new employee — thin wrapper around the shared account-creation
// helper so employees always end up correctly in `employees` + auth_index.
exports.addEmployee = async (req, res) => {
    const { name, email, password, position, department, joined_date } = req.body;
    const requester = req.user;

    if (!name || !email || !password || !position || !department || !joined_date) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const fields = {
        name, email, password, position, department, joined_date,
        internal_cost_rate: 0,
        manager_id: requester.role === 'team_manager' ? requester.id : null,
    };

    createAccount('employee', fields, (err, created) => {
        if (err) {
            if (err.message === 'EMAIL_IN_USE') return res.status(409).json({ error: 'Email already in use' });
            return res.status(500).json({ error: 'Error creating employee' });
        }

        notifyEmployeeAdded(name, requester.id).catch(() => {});

        res.status(201).json({
            success: true,
            data: { id: created.id, name, email, position, department, joined_date, tasks: [] }
        });
    });
};

// delete employee
exports.deleteemployee = (req, res) => {
    const employeeId = req.params.id;

    if (!employeeId) {
        return res.status(400).json({ error: 'Employee ID is required' });
    }

    Employee.delete(employeeId, (err, result) => {
        if (err) return res.status(500).json({ error: 'Error deleting employee' });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Employee not found' });

        const AuthIndex = require('../models/authIndex.model');
        AuthIndex.deleteByRoleRow('employees', employeeId, () => {});

        res.status(200).json({ message: 'Employee deleted successfully' });
    });
};
