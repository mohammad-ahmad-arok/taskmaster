const db = require('../config/db');
const Notification = require('../models/notification.model');
const { sendPushToUser, sendPushToUsers, sendPushToManagers, notifyUser } = require('./pushService');

// ─── Save to DB + Send push ──────────────────────────────────────────────────
const saveAndPush = async (notificationData) => {
    return new Promise((resolve, reject) => {
        const row = {
            user_id: notificationData.user_id,
            type: notificationData.type,
            title: notificationData.title,
            message: notificationData.message,
            task_id: notificationData.task_id || null,
            is_read: 0,
            created_at: new Date()
        };
        Notification.create(row, async (err, result) => {
            if (err) return reject(err);

            // Fire-and-forget push
            const payload = {
                title: notificationData.title,
                body: notificationData.message,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                data: {
                    taskId: notificationData.task_id || null,
                    type: notificationData.type,
                    notificationId: result.insertId,
                    url: notificationData.task_id
                        ? `/tasks/${notificationData.task_id}`
                        : '/'
                }
            };
            sendPushToUser(notificationData.user_id, payload).catch(() => {});
            resolve(result);
        });
    });
};

// ─── Bulk save + push ────────────────────────────────────────────────────────
const saveAndPushBulk = async (notifications) => {
    if (!notifications || notifications.length === 0) return;

    return new Promise((resolve, reject) => {
        Notification.createBulk(notifications, async (err) => {
            if (err) return reject(err);

            // Group by user and push
            const byUser = {};
            for (const n of notifications) {
                if (!byUser[n.user_id]) byUser[n.user_id] = n;
            }

            for (const [userId, n] of Object.entries(byUser)) {
                const payload = {
                    title: n.title,
                    body: n.message,
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    data: {
                        taskId: n.task_id || null,
                        type: n.type,
                        url: n.task_id ? `/tasks/${n.task_id}` : '/'
                    }
                };
                sendPushToUser(parseInt(userId), payload).catch(() => {});
            }
            resolve();
        });
    });
};

// ─── Task Created ────────────────────────────────────────────────────────────
const notifyTaskCreated = async (task, creatorId) => {
    try {
        const notifications = [];

        notifications.push({
            user_id: task.assignedTo,
            type: 'task_assigned',
            title: '📋 مهمة جديدة تم تعيينها لك',
            message: `تم تعيين مهمة "${task.title}" في مشروع "${task.projectName}" لك. الموعد النهائي: ${new Date(task.deadline).toLocaleDateString('ar-SA')}`,
            task_id: task.id
        });

        await new Promise((resolve, reject) => {
            db.query("SELECT id FROM user WHERE role = 'manager' AND id != ?", [creatorId], (err, managers) => {
                if (err) return reject(err);
                managers.forEach(m => {
                    notifications.push({
                        user_id: m.id,
                        type: 'task_created',
                        title: '✅ مهمة جديدة تم إنشاؤها',
                        message: `تم إنشاء مهمة "${task.title}" وتعيينها لـ ${task.assignedToName} في مشروع "${task.projectName}"`,
                        task_id: task.id
                    });
                });
                resolve();
            });
        });

        await saveAndPushBulk(notifications);
    } catch (err) {
        console.error('notifyTaskCreated error:', err);
    }
};

// ─── Task Deleted ────────────────────────────────────────────────────────────
const notifyTaskDeleted = async (taskId, taskTitle, assignedToId, assignedToName) => {
    try {
        const notifications = [];

        // Notify assigned employee
        notifications.push({
            user_id: assignedToId,
            type: 'task_deleted',
            title: '🗑️ تم حذف مهمة معيّنة لك',
            message: `تم حذف المهمة "${taskTitle}" التي كانت معيّنة لك.`,
            task_id: null
        });

        // Notify managers
        await new Promise((resolve, reject) => {
            db.query("SELECT id FROM user WHERE role = 'manager'", (err, managers) => {
                if (err) return reject(err);
                managers.forEach(m => {
                    if (m.id !== assignedToId) {
                        notifications.push({
                            user_id: m.id,
                            type: 'task_deleted',
                            title: '🗑️ تم حذف مهمة',
                            message: `تم حذف مهمة "${taskTitle}" التي كانت معيّنة لـ ${assignedToName}.`,
                            task_id: null
                        });
                    }
                });
                resolve();
            });
        });

        await saveAndPushBulk(notifications);
    } catch (err) {
        console.error('notifyTaskDeleted error:', err);
    }
};

// ─── Note Added ──────────────────────────────────────────────────────────────
const notifyNoteAdded = async (taskId, noteAuthorName, noteAuthorId, content) => {
    try {
        await new Promise((resolve, reject) => {
            db.query('SELECT * FROM task WHERE id = ?', [taskId], async (err, results) => {
                if (err || results.length === 0) return reject(err || new Error('Task not found'));
                const task = results[0];

                const stakeholdersQuery = `
                    SELECT DISTINCT id FROM user WHERE role = 'manager'
                    UNION
                    SELECT ? as id
                `;
                db.query(stakeholdersQuery, [task.assignedTo], async (err2, users) => {
                    if (err2) return reject(err2);

                    const notifications = users
                        .filter(u => u.id !== noteAuthorId)
                        .map(u => ({
                            user_id: u.id,
                            type: 'note_added',
                            title: '💬 ملاحظة جديدة على مهمة',
                            message: `أضاف ${noteAuthorName} ملاحظة على مهمة "${task.title}": "${content.substring(0, 80)}${content.length > 80 ? '...' : ''}"`,
                            task_id: taskId
                        }));

                    await saveAndPushBulk(notifications);
                    resolve();
                });
            });
        });
    } catch (err) {
        console.error('notifyNoteAdded error:', err);
    }
};

// ─── Status Changed ──────────────────────────────────────────────────────────
const notifyStatusChanged = async (taskId, newStatus, changedByUserId) => {
    try {
        const statusLabels = {
            'pending': 'قيد الانتظار',
            'in-progress': 'قيد التنفيذ',
            'completed': 'مكتملة ✅',
            'blocked': 'محظورة 🚫'
        };

        await new Promise((resolve, reject) => {
            db.query('SELECT * FROM task WHERE id = ?', [taskId], async (err, results) => {
                if (err || results.length === 0) return reject(err);
                const task = results[0];

                const stakeholdersQuery = `
                    SELECT DISTINCT id FROM user WHERE role = 'manager'
                    UNION SELECT ? as id
                `;
                db.query(stakeholdersQuery, [task.assignedTo], async (err2, users) => {
                    if (err2) return reject(err2);

                    const notifications = users
                        .filter(u => u.id !== changedByUserId)
                        .map(u => ({
                            user_id: u.id,
                            type: 'status_changed',
                            title: '🔄 تحديث حالة المهمة',
                            message: `تم تغيير حالة مهمة "${task.title}" إلى "${statusLabels[newStatus] || newStatus}"`,
                            task_id: taskId
                        }));

                    await saveAndPushBulk(notifications);
                    resolve();
                });
            });
        });
    } catch (err) {
        console.error('notifyStatusChanged error:', err);
    }
};

// ─── Extension Request ───────────────────────────────────────────────────────
const notifyExtensionRequest = async (taskId, requesterName) => {
    try {
        await new Promise((resolve, reject) => {
            db.query('SELECT * FROM task WHERE id = ?', [taskId], async (err, results) => {
                if (err || results.length === 0) return reject(err);
                const task = results[0];

                db.query("SELECT id FROM user WHERE role = 'manager'", async (err2, managers) => {
                    if (err2) return reject(err2);

                    const notifications = managers.map(m => ({
                        user_id: m.id,
                        type: 'extension_request',
                        title: '📅 طلب تمديد موعد مهمة',
                        message: `طلب ${requesterName} تمديداً لمهمة "${task.title}" - بانتظار موافقتك`,
                        task_id: taskId
                    }));

                    await saveAndPushBulk(notifications);
                    resolve();
                });
            });
        });
    } catch (err) {
        console.error('notifyExtensionRequest error:', err);
    }
};

// ─── Extension Decision ──────────────────────────────────────────────────────
const notifyExtensionDecision = async (taskId, status, requestUserId) => {
    try {
        await new Promise((resolve, reject) => {
            db.query('SELECT title FROM task WHERE id = ?', [taskId], async (err, results) => {
                if (err || results.length === 0) return reject(err);
                const task = results[0];
                const isApproved = status === 'approved';

                await saveAndPush({
                    user_id: requestUserId,
                    type: isApproved ? 'extension_approved' : 'extension_rejected',
                    title: isApproved ? '✅ تمت الموافقة على طلب التمديد' : '❌ تم رفض طلب التمديد',
                    message: isApproved
                        ? `تمت الموافقة على طلب التمديد لمهمة "${task.title}"`
                        : `تم رفض طلب التمديد لمهمة "${task.title}"`,
                    task_id: taskId
                });
                resolve();
            });
        });
    } catch (err) {
        console.error('notifyExtensionDecision error:', err);
    }
};

// ─── Employee Added ──────────────────────────────────────────────────────────
const notifyEmployeeAdded = async (newEmployeeName, creatorId) => {
    try {
        await new Promise((resolve, reject) => {
            db.query("SELECT id FROM user WHERE role = 'manager' AND id != ?", [creatorId], async (err, managers) => {
                if (err) return reject(err);

                const notifications = managers.map(m => ({
                    user_id: m.id,
                    type: 'employee_added',
                    title: '👤 موظف جديد تم إضافته',
                    message: `تم إضافة الموظف "${newEmployeeName}" إلى النظام`,
                    task_id: null
                }));

                if (notifications.length > 0) await saveAndPushBulk(notifications);
                resolve();
            });
        });
    } catch (err) {
        console.error('notifyEmployeeAdded error:', err);
    }
};

module.exports = {
    saveAndPush,
    saveAndPushBulk,
    notifyTaskCreated,
    notifyTaskDeleted,
    notifyNoteAdded,
    notifyStatusChanged,
    notifyExtensionRequest,
    notifyExtensionDecision,
    notifyEmployeeAdded,
};
