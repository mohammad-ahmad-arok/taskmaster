const db = require('../config/db');
const Task = require('../models/task.model');
const TaskNote = require('../models/taskNotes.model');


// get all tasks
exports.getTasks = (req, res) => {
    Task.getAll((err, results) => {
        if (err) return res.status(500).json({ error: 'Database Error' });
        res.json({ success: true, data: results });
    });
};

// get one task with notes and extension requests
exports.getOneTask = (req, res) => {
    const taskId = req.params.id;
    const taskQuery = 'SELECT * FROM task WHERE id = ?';
    const notesQuery = 'SELECT * FROM task_notes WHERE task_id = ?';
    const extensionsQuery = 'SELECT * FROM extension_requests WHERE task_id = ?';

    db.query(taskQuery, [taskId], (err, taskResults) => {
        if (err) return res.status(500).json({ error: 'Database Error (task)' });

        if (taskResults.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const task = taskResults[0];

        db.query(notesQuery, [taskId], (err, notesResults) => {
            if (err) return res.status(500).json({ error: 'Database Error (notes)' });

            db.query(extensionsQuery, [taskId], (err, extensionResults) => {
                if (err) return res.status(500).json({ error: 'Database Error (extensions)' });

                task.notes = notesResults || [];
                task.extensionRequests = extensionResults || [];

                res.json({ data: [task] });
            });
        });
    });
};

exports.updateExtensionRequestStatus = (req, res) => {
    const { status } = req.body;
    const { taskId, requestId } = req.params;

    const allowedStatuses = ['pending', 'approved', 'rejected'];

    if (!taskId || !requestId) {
        return res.status(400).json({ error: "taskId and requestId are required in params." });
    }

    if (!status || typeof status !== 'string' || !allowedStatuses.includes(status)) {
        return res.status(400).json({ error: "A valid status ('pending', 'approved', 'rejected') is required." });
    }

    try {
        Task.editExtensionRequestStatus(taskId, requestId, status, (err, result) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Error updating ExtensionRequest status' });
            }

            if (!result || result.affectedRows === 0) {
                return res.status(404).json({ error: 'ExtensionRequest not found' });
            }

            return res.status(200).json({
                sccess: true,
                data: []
            });
        });
    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ error: "Server error during ExtensionRequest status update" });
    }
};


// get my  tasks
exports.getMyTasks = (req, res) => {
    const { id: user_id } = req.user;
    Task.getMyTasks(user_id, (err, results) => {
        if (err) return res.status(500).json({ error: 'Database Error' });
        res.json({ data: results });
    });
};

// create a new task
exports.createTack = async (req, res) => {
    const { title, description, projectId, assignedTo, deadline } = req.body;

    if (!title || !description || !projectId || !assignedTo || !deadline)
        return res.status(400).json({ error: "All fields are required" });
    try {
        // get user name
        const getUserNameQuery = 'SELECT name FROM user WHERE id = ?';
        db.query(getUserNameQuery, [assignedTo], (userErr, userResults) => {
            if (userErr || userResults.length === 0) {
                return res.status(404).json({ error: "Assigned user not found" });
            }

            const assignedToName = userResults[0].name;

            // get project name
            const getProjectNameQuery = 'SELECT name FROM project WHERE id = ?';
            db.query(getProjectNameQuery, [projectId], (projErr, projResults) => {
                if (projErr || projResults.length === 0) {
                    return res.status(404).json({ error: "Project not found" });
                }

                const projectName = projResults[0].name;

                // create a task
                const newTask = { title, description, projectId, projectName, assignedTo, assignedToName, deadline };
                Task.create(newTask, (err, result) => {
                    if (err) return res.status(500).json({ error: 'Error creating new Task' });

                    res.status(201).json({
                        data: {
                            message: "Task created successfully",
                            task: {
                                id: result.insertId,
                                title,
                                description,
                                projectId,
                                projectName,
                                assignedTo,
                                assignedToName,
                                deadline
                            }
                        }
                    });
                });
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error during create a new task' });
    }
};

//add extension request
exports.addExtensionRequest = async (req, res) => {
    const task_id = parseInt(req.params.id, 10);
    const { id: user_id } = req.user;
    const { reason, requested_days } = req.body;

    if (!reason || !requested_days)
        return res.status(400).json({ error: "All fields are required" });

    try {
        const getUserNameQuery = 'SELECT name FROM user WHERE id = ?';
        db.query(getUserNameQuery, [user_id], (userErr, userResults) => {
            if (userErr || userResults.length === 0) {
                return res.status(404).json({ error: "Assigned user not found" });
            }

            const user_name = userResults[0].name;
            const newExtensionRequest = { task_id, user_id, user_name, reason, requested_days };

            Task.addExtensionRequests(newExtensionRequest, (err, result) => {
                if (err) {
                    console.error("MySQL Error:", err);
                    return res.status(500).json({ error: 'Error creating new extension request' });
                }

                TaskNote.getByIdWithExtensions(task_id, (taskErr, taskWithExtensions) => {
                    if (taskErr) {
                        return res.status(500).json({ error: 'Error fetching updated task with extension requests' });
                    }

                    res.status(201).json({
                        success: true,
                        data: taskWithExtensions
                    });
                });
            });
        });
    } catch (error) {
        console.error("Catch Error:", error);
        res.status(500).json({ error: 'Server error during extension request creation' });
    }
};

//update task status
exports.updateTaskStatus = async (req, res) => {
    const { status } = req.body;
    const taskId = req.params.id;

    const allowedStatuses = ['pending', 'in-progress', 'completed', 'blocked'];
    if (!status || !allowedStatuses.includes(status)) {
        return res.status(400).json({ error: "Valid status required" });
    }
    try {
        Task.editTaskStatus(taskId, status, (err, result) => {
            if (err) return res.status(500).json({ error: 'Error updating task status' });

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Task not found' });
            }

            res.status(200).json({
                message: "Status updated successfully"
            });
        });
    } catch (error) {
        console.error('MySQL Error:', err);
        return res.status(500).json({ error: "Server error during task status update" });
    }
};

// delete task
exports.deleteTask = (req, res) => {
    const taskId = req.params.id;

    if (!taskId) {
        return res.status(400).json({ error: 'task ID is required' });
    }

    Task.delete(taskId, (err, result) => {
        if (err) return res.status(500).json({ error: 'Error deleting task' });

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'task not found' });
        }

        res.status(200).json({ message: 'task deleted successfully' });
    });
};
