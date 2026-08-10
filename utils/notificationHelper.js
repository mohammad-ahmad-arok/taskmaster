const db = require('../config/db');
const Notification = require('../models/notification.model');
const { sendPushToRecipients } = require('./pushService');
const { taskUrlForRoleTable } = require('./taskUrl');

// ─── Save to DB + Send push (bulk) ───────────────────────────────────────────
// notifications: [{ role_table, role_id, type, title, message, task_id }]
const saveAndPushBulk = async (notifications) => {
    if (!notifications || notifications.length === 0) return;

    return new Promise((resolve, reject) => {
        Notification.createBulk(notifications, async (err) => {
            if (err) return reject(err);

            const byRecipient = new Map();
            for (const n of notifications) {
                const key = `${n.role_table}:${n.role_id}`;
                if (!byRecipient.has(key)) byRecipient.set(key, n);
            }

            for (const n of byRecipient.values()) {
                const payload = {
                    title: n.title,
                    body: n.message,
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    data: {
                        taskId: n.task_id || null,
                        type: n.type,
                        url: taskUrlForRoleTable(n.role_table, n.task_id),
                    },
                };
                sendPushToRecipients([{ roleTable: n.role_table, roleId: n.role_id }], payload).catch(() => {});
            }
            resolve();
        });
    });
};

const saveAndPush = async (notification) => saveAndPushBulk([notification]);

// Fetch all team managers (optionally excluding one), used as the
// "stakeholders who should hear about this" group throughout.
const getManagers = (excludeId) => new Promise((resolve, reject) => {
    const sql = excludeId
        ? 'SELECT id FROM team_managers WHERE id != ?'
        : 'SELECT id FROM team_managers';
    db.query(sql, excludeId ? [excludeId] : [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows.map(r => ({ role_table: 'team_managers', role_id: r.id })));
    });
});

// ─── Task Created ────────────────────────────────────────────────────────────
const notifyTaskCreated = async (task, creatorId) => {
    try {
        const notifications = [
            {
                role_table: 'employees', role_id: task.assignedTo,
                type: 'task_assigned',
                title: '📋 مهمة جديدة تم تعيينها لك',
                message: `تم تعيين مهمة "${task.title}" في مشروع "${task.projectName}" لك. الموعد النهائي: ${new Date(task.deadline).toLocaleDateString('ar-SA')}`,
                task_id: task.id,
            },
        ];

        const managers = await getManagers(creatorId);
        managers.forEach(m => notifications.push({
            role_table: m.role_table, role_id: m.role_id,
            type: 'task_created',
            title: '✅ مهمة جديدة تم إنشاؤها',
            message: `تم إنشاء مهمة "${task.title}" وتعيينها لـ ${task.assignedToName} في مشروع "${task.projectName}"`,
            task_id: task.id,
        }));

        await saveAndPushBulk(notifications);
    } catch (err) {
        console.error('notifyTaskCreated error:', err);
    }
};

// ─── Task Deleted ────────────────────────────────────────────────────────────
const notifyTaskDeleted = async (taskId, taskTitle, assignedToId, assignedToName) => {
    try {
        const notifications = [
            {
                role_table: 'employees', role_id: assignedToId,
                type: 'task_deleted',
                title: '🗑️ تم حذف مهمة معيّنة لك',
                message: `تم حذف المهمة "${taskTitle}" التي كانت معيّنة لك.`,
                task_id: null,
            },
        ];

        const managers = await getManagers();
        managers.forEach(m => notifications.push({
            role_table: m.role_table, role_id: m.role_id,
            type: 'task_deleted',
            title: '🗑️ تم حذف مهمة',
            message: `تم حذف مهمة "${taskTitle}" التي كانت معيّنة لـ ${assignedToName}.`,
            task_id: null,
        }));

        await saveAndPushBulk(notifications);
    } catch (err) {
        console.error('notifyTaskDeleted error:', err);
    }
};

// ─── Note Added ──────────────────────────────────────────────────────────────
const notifyNoteAdded = async (taskId, noteAuthorName, noteAuthorId, content) => {
    try {
        db.query('SELECT * FROM task WHERE id = ?', [taskId], async (err, results) => {
            if (err || results.length === 0) return;
            const task = results[0];

            const managers = await getManagers();
            const stakeholders = [...managers, { role_table: 'employees', role_id: task.assignedTo }]
                .filter(s => !(s.role_table === 'employees' && s.role_id === noteAuthorId));

            const notifications = stakeholders.map(s => ({
                role_table: s.role_table, role_id: s.role_id,
                type: 'note_added',
                title: '💬 ملاحظة جديدة على مهمة',
                message: `أضاف ${noteAuthorName} ملاحظة على مهمة "${task.title}": "${content.substring(0, 80)}${content.length > 80 ? '...' : ''}"`,
                task_id: taskId,
            }));

            await saveAndPushBulk(notifications);
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
            'pending-internal-review': 'بانتظار المراجعة الداخلية',
            'pending-client-approval': 'بانتظار موافقة العميل',
            'completed': 'مكتملة ✅',
            'blocked': 'محظورة 🚫',
            'rejected': 'مرفوضة - تحتاج تعديل ✏️',
        };

        db.query('SELECT * FROM task WHERE id = ?', [taskId], async (err, results) => {
            if (err || results.length === 0) return;
            const task = results[0];

            const managers = await getManagers();
            const stakeholders = [...managers, { role_table: 'employees', role_id: task.assignedTo }]
                .filter(s => !(s.role_id === changedByUserId));

            const notifications = stakeholders.map(s => ({
                role_table: s.role_table, role_id: s.role_id,
                type: 'status_changed',
                title: '🔄 تحديث حالة المهمة',
                message: `تم تغيير حالة مهمة "${task.title}" إلى "${statusLabels[newStatus] || newStatus}"`,
                task_id: taskId,
            }));

            await saveAndPushBulk(notifications);
        });
    } catch (err) {
        console.error('notifyStatusChanged error:', err);
    }
};

// ─── Extension Request ───────────────────────────────────────────────────────
const notifyExtensionRequest = async (taskId, requesterName) => {
    try {
        db.query('SELECT * FROM task WHERE id = ?', [taskId], async (err, results) => {
            if (err || results.length === 0) return;
            const task = results[0];

            const managers = await getManagers();
            const notifications = managers.map(m => ({
                role_table: m.role_table, role_id: m.role_id,
                type: 'extension_request',
                title: '📅 طلب تمديد موعد مهمة',
                message: `طلب ${requesterName} تمديداً لمهمة "${task.title}" - بانتظار موافقتك`,
                task_id: taskId,
            }));

            await saveAndPushBulk(notifications);
        });
    } catch (err) {
        console.error('notifyExtensionRequest error:', err);
    }
};

// ─── Extension Decision ──────────────────────────────────────────────────────
const notifyExtensionDecision = async (taskId, status, requestUserId) => {
    try {
        db.query('SELECT title FROM task WHERE id = ?', [taskId], async (err, results) => {
            if (err || results.length === 0) return;
            const task = results[0];
            const isApproved = status === 'approved';

            await saveAndPush({
                role_table: 'employees', role_id: requestUserId,
                type: isApproved ? 'extension_approved' : 'extension_rejected',
                title: isApproved ? '✅ تمت الموافقة على طلب التمديد' : '❌ تم رفض طلب التمديد',
                message: isApproved
                    ? `تمت الموافقة على طلب التمديد لمهمة "${task.title}"`
                    : `تم رفض طلب التمديد لمهمة "${task.title}"`,
                task_id: taskId,
            });
        });
    } catch (err) {
        console.error('notifyExtensionDecision error:', err);
    }
};

// ─── Employee Added ──────────────────────────────────────────────────────────
const notifyEmployeeAdded = async (newEmployeeName, creatorId) => {
    try {
        const managers = await getManagers(creatorId);
        const notifications = managers.map(m => ({
            role_table: m.role_table, role_id: m.role_id,
            type: 'employee_added',
            title: '👤 موظف جديد تم إضافته',
            message: `تم إضافة الموظف "${newEmployeeName}" إلى النظام`,
            task_id: null,
        }));
        if (notifications.length > 0) await saveAndPushBulk(notifications);
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
