const db = require('../config/db');
const TaskNote = require('../models/taskNotes.model');


// get all task notes
exports.getTaskNotes = (req, res) => {
    TaskNote.getAll((err, results) => {
        if (err) return res.status(500).json({ error: 'Database Error' });
        res.json({ data: results });
    });
};


// create a new task note
exports.createTaskNote = async (req, res) => {
    const { task_id, content } = req.body;
    const { id: user_id } = req.user;

    if (!task_id || !content) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        const getUserNameQuery = 'SELECT name FROM user WHERE id = ?';
        db.query(getUserNameQuery, [user_id], (userErr, userResults) => {
            if (userErr || userResults.length === 0) {
                return res.status(404).json({ error: "Assigned user not found" });
            }

            const user_name = userResults[0].name;

            const newTaskNote = { task_id, user_id, user_name, content };
            TaskNote.create(newTaskNote, (err, result) => {
                if (err) {
                    return res.status(500).json({ error: 'Error creating new Task note' });
                }

                TaskNote.getByTaskId(task_id, (fetchErr, notes) => {
                    if (fetchErr) {
                        return res.status(500).json({ error: 'Error fetching task notes' });
                    }

                    res.status(201).json({
                        success: true,
                        data: notes
                    });
                });
            });
        });
    } catch (error) {
        console.error("Server error:", error);
        res.status(500).json({ error: 'Server error' });
    }
};


