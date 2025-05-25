const db = require('../config/db');
const Employee = require('../models/employee.model');
const bcrypt = require('bcryptjs');


// get all employee
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

        const finalResult = Object.values(grouped);
        res.json({ data: finalResult });
    });
};

// get employee by id
exports.getOneEmployee = (req, res) => {
    const employeeId = req.params.id;
    Employee.getOne(employeeId, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database Error' });

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }


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


// create a new employee
exports.addEmployee = async (req, res) => {
    const { name, email, password, position, department, joined_date } = req.body;

    if (!name || !email || !password || !position || !department || !joined_date) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    db.query('SELECT id FROM user WHERE email = ?', [email], async (checkErr, existingUser) => {
        if (checkErr) return res.status(500).json({ error: 'Database error on email check' });
        if (existingUser.length > 0) return res.status(409).json({ error: 'Email already in use' });

        try {
            const hashedPassword = await bcrypt.hash(password, 10);

            const userInsert = 'INSERT INTO user (name, email, password, role) VALUES (?, ?, ?, ?)';
            db.query(userInsert, [name, email, hashedPassword, 'employee'], (userErr, userResult) => {
                if (userErr) return res.status(500).json({ error: 'Error inserting into user table' });

                const userId = userResult.insertId;

                const detailsInsert = 'INSERT INTO employee_details (user_id, position, department, joined_date) VALUES (?, ?, ?, ?)';
                db.query(detailsInsert, [userId, position, department, joined_date], (detailsErr) => {
                    if (detailsErr) return res.status(500).json({ error: 'Error inserting into employee_details' });

                    res.status(201).json({
                        success: true,
                        data: {
                            id: userId,
                            name,
                            email,
                            position,
                            department,
                            joined_date,
                            tasks: []
                        }
                    });
                });
            });
        } catch (error) {
            res.status(500).json({ error: 'Server error during hashing' });
        }
    });
};


// delete employee
exports.deleteemployee = (req, res) => {
    const userId = req.params.id;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    // delete employee_details
    const deleteDetailsQuery = 'DELETE FROM employee_details WHERE user_id = ?';
    db.query(deleteDetailsQuery, [userId], (detailsErr) => {
        if (detailsErr) return res.status(500).json({ error: 'Error deleting employee details' });

        // delete user
        const deleteUserQuery = 'DELETE FROM user WHERE id = ?';
        db.query(deleteUserQuery, [userId], (userErr, userResult) => {
            if (userErr) return res.status(500).json({ error: 'Error deleting user' });

            if (userResult.affectedRows === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.status(200).json({ message: 'User deleted successfully' });
        });
    });
};

