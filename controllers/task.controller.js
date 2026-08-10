const db = require('../config/db');
const Task = require('../models/task.model');
const TaskNote = require('../models/taskNotes.model');
const { logActivity } = require('../utils/activityLogger');
const {
    notifyTaskCreated,
    notifyTaskDeleted,
    notifyStatusChanged,
    notifyExtensionRequest,
    notifyExtensionDecision
} = require('../utils/notificationHelper');

const ALL_STATUSES = [
    'pending', 'in-progress', 'pending-internal-review',
    'pending-client-approval', 'completed', 'blocked', 'rejected'
];

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

exports.updateExtensionRequestStatus = async (req, res) => {
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
        Task.editExtensionRequestStatus(taskId, requestId, status, async (err, result) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Error updating ExtensionRequest status' });
            }

            if (!result || result.affectedRows === 0) {
                return res.status(404).json({ error: 'ExtensionRequest not found' });
            }

            if (status !== 'pending') {
                try {
                    db.query('SELECT user_id FROM extension_requests WHERE id = ?', [requestId], async (err2, extResults) => {
                        if (!err2 && extResults.length > 0) {
                            await notifyExtensionDecision(taskId, status, extResults[0].user_id);
                        }
                    });
                } catch (notifErr) {
                    console.error('Notification error (extension decision):', notifErr);
                }
            }

            return res.status(200).json({ success: true, data: [] });
        });
    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ error: "Server error during ExtensionRequest status update" });
    }
};

// get my tasks
exports.getMyTasks = (req, res) => {
    const { id: user_id } = req.user;
    Task.getMyTasks(user_id, (err, results) => {
        if (err) return res.status(500).json({ error: 'Database Error' });
        res.json({ data: results });
    });
};

// create a new task (Dependency Engine aware: dependsOnTaskId -> isLocked)
exports.createTack = async (req, res) => {
    const { title, description, projectId, assignedTo, deadline, dependsOnTaskId } = req.body;
    const { id: creatorId, roleTable, role } = req.user;

    if (!title || !description || !projectId || !assignedTo || !deadline)
        return res.status(400).json({ error: "All fields are required" });

    try {
        const getUserNameQuery = 'SELECT name FROM employees WHERE id = ?';
        db.query(getUserNameQuery, [assignedTo], (userErr, userResults) => {
            if (userErr || userResults.length === 0) {
                return res.status(404).json({ error: "Assigned employee not found" });
            }

            const assignedToName = userResults[0].name;

            const getProjectNameQuery = 'SELECT name FROM project WHERE id = ?';
            db.query(getProjectNameQuery, [projectId], (projErr, projResults) => {
                if (projErr || projResults.length === 0) {
                    return res.status(404).json({ error: "Project not found" });
                }

                const projectName = projResults[0].name;

                const finishCreate = (isLocked) => {
                    const newTask = {
                        title, description, projectId, projectName, assignedTo, assignedToName, deadline,
                        dependsOnTaskId: dependsOnTaskId || null,
                        isLocked: isLocked ? 1 : 0,
                    };
                    Task.create(newTask, async (err, result) => {
                        if (err) return res.status(500).json({ error: 'Error creating new Task' });

                        const createdTask = { id: result.insertId, ...newTask };

                        notifyTaskCreated(createdTask, creatorId).catch(err =>
                            console.error('Notification error (task created):', err)
                        );
                        logActivity({ roleTable, roleId: creatorId, actionType: 'task_status_change', metadata: { taskId: createdTask.id, event: 'created' } });

                        res.status(201).json({ data: { message: "Task created successfully", task: createdTask } });
                    });
                };

                // If a prerequisite is specified, the new task starts locked
                // unless that prerequisite is already completed.
                if (dependsOnTaskId) {
                    Task.getDependency(dependsOnTaskId, (depErr, depRows) => {
                        if (depErr || depRows.length === 0) {
                            return res.status(400).json({ error: 'dependsOnTaskId does not reference a valid task' });
                        }
                        finishCreate(depRows[0].status !== 'completed');
                    });
                } else {
                    finishCreate(false);
                }
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error during create a new task' });
    }
};

// add extension request
exports.addExtensionRequest = async (req, res) => {
    const task_id = parseInt(req.params.id, 10);
    const { id: user_id, role } = req.user;
    const { reason, requested_days } = req.body;

    if (!reason || !requested_days)
        return res.status(400).json({ error: "All fields are required" });

    try {
        const getUserNameQuery = 'SELECT name FROM employees WHERE id = ?';
        db.query(getUserNameQuery, [user_id], (userErr, userResults) => {
            if (userErr || userResults.length === 0) {
                return res.status(404).json({ error: "Requesting employee not found" });
            }

            const user_name = userResults[0].name;
            const newExtensionRequest = { task_id, user_role: role, user_id, user_name, reason, requested_days };

            Task.addExtensionRequests(newExtensionRequest, async (err, result) => {
                if (err) {
                    console.error("MySQL Error:", err);
                    return res.status(500).json({ error: 'Error creating new extension request' });
                }

                notifyExtensionRequest(task_id, user_name).catch(err =>
                    console.error('Notification error (extension request):', err)
                );

                TaskNote.getByIdWithExtensions(task_id, (taskErr, taskWithExtensions) => {
                    if (taskErr) {
                        return res.status(500).json({ error: 'Error fetching updated task with extension requests' });
                    }

                    res.status(201).json({ success: true, data: taskWithExtensions });
                });
            });
        });
    } catch (error) {
        console.error("Catch Error:", error);
        res.status(500).json({ error: 'Server error during extension request creation' });
    }
};

// update task status — enforces dependency lock + routes through approval gates
exports.updateTaskStatus = async (req, res) => {
    const { status } = req.body;
    const taskId = req.params.id;
    const { id: userId, role, roleTable } = req.user;

    if (!status || !ALL_STATUSES.includes(status)) {
        return res.status(400).json({ error: "Valid status required" });
    }

    Task.getOne(taskId, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database Error' });
        if (rows.length === 0) return res.status(404).json({ error: 'Task not found' });

        const task = rows[0];

        // Ownership check: only the assignee may move their own task
        // between working states; reviewers use the dedicated review
        // endpoint for approve/reject.
        const isOwner = role === 'employee' && task.assignedTo === userId;
        const isPrivileged = ['ceo', 'team_manager', 'qa'].includes(role);
        if (!isOwner && !isPrivileged) {
            return res.status(403).json({ error: 'Forbidden: you are not assigned to this task' });
        }
        if (['completed', 'pending-internal-review', 'pending-client-approval', 'rejected'].includes(status) &&
            !isPrivileged && role !== 'employee') {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // --- STRICT DEPENDENCY ENFORCEMENT ---
        // Backend is the source of truth: even if the frontend UI were
        // bypassed, a locked task can never change state except to stay
        // 'pending' or 'blocked'.
        if (task.isLocked && !['pending', 'blocked'].includes(status)) {
            return res.status(423).json({
                error: 'Task is locked: its prerequisite task has not been completed yet.',
                dependsOnTaskId: task.dependsOnTaskId,
            });
        }

        Task.editTaskStatus(taskId, status, async (err2) => {
            if (err2) return res.status(500).json({ error: 'Error updating task status' });

            logActivity({ roleTable, roleId: userId, actionType: 'task_status_change', metadata: { taskId, from: task.status, to: status } });

            // On completion, unlock any tasks that depended on this one.
            if (status === 'completed') {
                Task.getDependents(taskId, (depErr, dependents) => {
                    if (!depErr && dependents && dependents.length) {
                        dependents.forEach(dep => {
                            if (dep.isLocked) Task.setLocked(dep.id, false, () => {});
                        });
                    }
                });
            }

            notifyStatusChanged(taskId, status, userId).catch(err =>
                console.error('Notification error (status changed):', err)
            );

            res.status(200).json({ message: "Status updated successfully" });
        });
    });
};

// ---- Approval Gates: QA / Team Manager review a submitted task ---------
exports.reviewTask = (req, res) => {
    const taskId = req.params.id;
    const { decision, revisionNotes } = req.body; // decision: 'approve' | 'reject'
    const { id: reviewerId, role, roleTable } = req.user;

    if (!['qa', 'team_manager', 'ceo'].includes(role)) {
        return res.status(403).json({ error: 'Forbidden: only QA, Team Managers, or the CEO may review tasks' });
    }
    if (!['approve', 'reject'].includes(decision)) {
        return res.status(400).json({ error: "decision must be 'approve' or 'reject'" });
    }

    Task.getOne(taskId, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database Error' });
        if (rows.length === 0) return res.status(404).json({ error: 'Task not found' });
        const task = rows[0];

        if (!['pending-internal-review', 'pending-client-approval'].includes(task.status)) {
            return res.status(409).json({ error: 'Task is not currently awaiting review' });
        }

        let nextStatus;
        if (decision === 'reject') {
            nextStatus = 'rejected';
            if (!revisionNotes) {
                return res.status(400).json({ error: 'revisionNotes are required when rejecting a task' });
            }
        } else {
            // internal review approved -> move to client approval; client
            // approval approved -> fully completed.
            nextStatus = task.status === 'pending-internal-review' ? 'pending-client-approval' : 'completed';
        }

        Task.setReviewState(taskId, {
            status: nextStatus,
            reviewerRole: role,
            reviewerId,
            revisionNotes: decision === 'reject' ? revisionNotes : null,
        }, (err2) => {
            if (err2) return res.status(500).json({ error: 'Error updating review state' });

            logActivity({
                roleTable, roleId: reviewerId,
                actionType: decision === 'approve' ? 'task_approve' : 'task_reject',
                metadata: { taskId, resultingStatus: nextStatus },
            });

            if (nextStatus === 'completed') {
                Task.getDependents(taskId, (depErr, dependents) => {
                    if (!depErr && dependents) {
                        dependents.forEach(dep => { if (dep.isLocked) Task.setLocked(dep.id, false, () => {}); });
                    }
                });
            }

            notifyStatusChanged(taskId, nextStatus, reviewerId).catch(() => {});
            res.json({ success: true, data: { taskId, status: nextStatus } });
        });
    });
};

// ---- Timer: Start / Pause / Stop (Financial Module input) --------------
exports.startTimer = (req, res) => {
    const taskId = req.params.id;
    const { id: userId, role, roleTable } = req.user;

    Task.getOne(taskId, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database Error' });
        if (rows.length === 0) return res.status(404).json({ error: 'Task not found' });
        const task = rows[0];

        if (role === 'employee' && task.assignedTo !== userId) {
            return res.status(403).json({ error: 'Forbidden: you are not assigned to this task' });
        }
        if (task.isLocked) {
            return res.status(423).json({ error: 'Task is locked: cannot start timer until the prerequisite task is complete.' });
        }

        Task.startTimer(taskId, (e, result) => {
            if (e) return res.status(500).json({ error: 'Error starting timer' });
            if (result.affectedRows === 0) return res.status(409).json({ error: 'Timer already running' });
            logActivity({ roleTable, roleId: userId, actionType: 'task_timer_start', metadata: { taskId } });
            res.json({ success: true, message: 'Timer started' });
        });
    });
};

function stopOrPause(nextState) {
    return (req, res) => {
        const taskId = req.params.id;
        const { id: userId, role, roleTable } = req.user;

        Task.getOne(taskId, (err, rows) => {
            if (err) return res.status(500).json({ error: 'Database Error' });
            if (rows.length === 0) return res.status(404).json({ error: 'Task not found' });
            const task = rows[0];

            if (role === 'employee' && task.assignedTo !== userId) {
                return res.status(403).json({ error: 'Forbidden: you are not assigned to this task' });
            }

            Task.stopOrPauseTimer(taskId, nextState, (e, result) => {
                if (e) return res.status(500).json({ error: 'Error updating timer' });
                if (result.affectedRows === 0) return res.status(409).json({ error: 'Timer is not currently running' });
                logActivity({
                    roleTable, roleId: userId,
                    actionType: nextState === 'paused' ? 'task_timer_pause' : 'task_timer_stop',
                    metadata: { taskId },
                });
                Task.getTimerState(taskId, (e2, r2) => {
                    res.json({ success: true, data: r2 && r2[0] });
                });
            });
        });
    };
}
exports.pauseTimer = stopOrPause('paused');
exports.stopTimer = stopOrPause('stopped');

// delete task
exports.deleteTask = (req, res) => {
    const taskId = req.params.id;

    if (!taskId) {
        return res.status(400).json({ error: 'task ID is required' });
    }

    db.query('SELECT * FROM task WHERE id = ?', [taskId], (fetchErr, fetchResults) => {
        if (fetchErr || fetchResults.length === 0) {
            return Task.delete(taskId, (err, result) => {
                if (err) return res.status(500).json({ error: 'Error deleting task' });
                if (result.affectedRows === 0) return res.status(404).json({ error: 'task not found' });
                res.status(200).json({ message: 'task deleted successfully' });
            });
        }

        const task = fetchResults[0];

        Task.delete(taskId, (err, result) => {
            if (err) return res.status(500).json({ error: 'Error deleting task' });
            if (result.affectedRows === 0) return res.status(404).json({ error: 'task not found' });

            notifyTaskDeleted(taskId, task.title, task.assignedTo, task.assignedToName)
                .catch(e => console.error('Notification error (task deleted):', e));

            res.status(200).json({ message: 'task deleted successfully' });
        });
    });
};
