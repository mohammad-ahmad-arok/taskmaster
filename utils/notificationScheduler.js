const db = require('../config/db');
const Notification = require('../models/notification.model');
const { sendPushToRecipient, sendEmail, buildEmailHtml } = require('./pushService');
const { taskUrlForRoleTable } = require('./taskUrl');

console.log('⏰ Notification Scheduler started');

const dispatchNotification = async (roleTable, roleId, type, title, message, taskId, email = null) => {
    return new Promise((resolve) => {
        const row = { role_table: roleTable, role_id: roleId, type, title, message, task_id: taskId || null, is_read: 0, created_at: new Date() };
        Notification.create(row, async (err) => {
            if (err) { console.error('dispatchNotification DB error:', err); return resolve(); }

            const payload = {
                title, body: message, icon: '/icon-192.png', badge: '/icon-192.png',
                data: { taskId, type, url: taskUrlForRoleTable(roleTable, taskId) },
            };
            sendPushToRecipient(roleTable, roleId, payload).catch(() => {});

            if (email) {
                sendEmail(email, title, buildEmailHtml(title, message, taskId)).catch(() => {});
            }
            resolve();
        });
    });
};

// ─── Inactive Employees (24h+) ───────────────────────────────────────────────
// Reminders target employees; managers/QA/CEO are salaried oversight roles
// and are intentionally excluded from "come back and do your tasks" nudges.
const checkInactiveUsers = () => {
    const query = `
        SELECT e.id, e.name, e.email
        FROM employees e
        WHERE e.last_login IS NOT NULL
          AND e.last_login < DATE_SUB(NOW(), INTERVAL 24 HOUR)
          AND NOT EXISTS (
            SELECT 1 FROM notifications n
            WHERE n.role_table = 'employees' AND n.role_id = e.id
              AND n.type = 'inactivity_reminder'
              AND n.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
          )
    `;
    db.query(query, async (err, users) => {
        if (err) return console.error('Scheduler checkInactiveUsers error:', err);
        if (!users.length) return;

        for (const u of users) {
            await dispatchNotification('employees', u.id, 'inactivity_reminder',
                '👋 نحن نفتقدك!',
                'لم تقم بتسجيل الدخول منذ أكثر من 24 ساعة. قد تكون هناك مهام بانتظارك!',
                null, u.email);
        }
        console.log(`📬 Sent inactivity reminders to ${users.length} user(s)`);
    });
};

// ─── Deadline Reminders: 3h, 2h, 1h ─────────────────────────────────────────
const checkDeadlineReminders = () => {
    const windows = [
        { upper: 180, lower: 150, label: '3 ساعات',    type: 'deadline_3h' },
        { upper: 120, lower: 90,  label: 'ساعتين',      type: 'deadline_2h' },
        { upper: 60,  lower: 30,  label: 'ساعة واحدة',  type: 'deadline_1h' },
    ];

    windows.forEach(({ upper, lower, label, type }) => {
        const query = `
            SELECT t.id AS task_id, t.title, t.assignedTo, t.deadline, e.name AS assigned_name, e.email
            FROM task t
            JOIN employees e ON e.id = t.assignedTo
            WHERE t.status NOT IN ('completed', 'blocked')
              AND t.deadline BETWEEN DATE_ADD(NOW(), INTERVAL ? MINUTE) AND DATE_ADD(NOW(), INTERVAL ? MINUTE)
              AND NOT EXISTS (
                SELECT 1 FROM notifications n
                WHERE n.role_table = 'employees' AND n.role_id = t.assignedTo AND n.type = ? AND n.task_id = t.id
                  AND n.created_at > DATE_SUB(NOW(), INTERVAL 4 HOUR)
              )
        `;
        db.query(query, [lower, upper, type], async (err, tasks) => {
            if (err) return console.error(`Scheduler ${type} error:`, err);
            if (!tasks.length) return;

            db.query('SELECT id FROM team_managers', async (err2, managers) => {
                if (err2) return;

                for (const task of tasks) {
                    await dispatchNotification('employees', task.assignedTo, type,
                        `⏰ تذكير: موعد المهمة بعد ${label}`,
                        `تذكير! موعد تسليم مهمة "${task.title}" بعد ${label} فقط.`,
                        task.task_id);

                    for (const m of managers) {
                        await dispatchNotification('team_managers', m.id, type,
                            `⏰ مهمة تقترب من موعدها`,
                            `مهمة "${task.title}" المعينة لـ ${task.assigned_name} ستنتهي بعد ${label}.`,
                            task.task_id);
                    }
                }
                console.log(`⏰ ${type}: processed ${tasks.length} task(s)`);
            });
        });
    });
};

// ─── Overdue Tasks ───────────────────────────────────────────────────────────
const checkOverdueTasks = () => {
    const query = `
        SELECT t.id AS task_id, t.title, t.assignedTo, e.name AS assigned_name, e.email
        FROM task t
        JOIN employees e ON e.id = t.assignedTo
        WHERE t.status NOT IN ('completed', 'blocked')
          AND t.deadline < NOW()
          AND NOT EXISTS (
            SELECT 1 FROM notifications n
            WHERE n.role_table = 'employees' AND n.role_id = t.assignedTo AND n.type = 'task_overdue' AND n.task_id = t.id
              AND n.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
          )
    `;
    db.query(query, async (err, tasks) => {
        if (err) return console.error('Scheduler overdue error:', err);
        if (!tasks.length) return;

        db.query('SELECT id, email FROM team_managers', async (err2, managers) => {
            if (err2) return;

            for (const task of tasks) {
                await dispatchNotification('employees', task.assignedTo, 'task_overdue',
                    '🔴 مهمة متأخرة!',
                    `تجاوزت مهمة "${task.title}" موعدها النهائي. يرجى تحديث حالتها أو طلب تمديد.`,
                    task.task_id, task.email);

                for (const m of managers) {
                    await dispatchNotification('team_managers', m.id, 'task_overdue',
                        '🔴 مهمة متأخرة!',
                        `مهمة "${task.title}" المعينة لـ ${task.assigned_name} تجاوزت موعدها النهائي.`,
                        task.task_id, m.email);
                }
            }
            console.log(`🔴 Overdue: notified for ${tasks.length} task(s)`);
        });
    });
};

// ─── Cleanup ─────────────────────────────────────────────────────────────────
const cleanupOldNotifications = () => {
    Notification.deleteOldRead((err) => {
        if (err) console.error('Cleanup error:', err);
        else console.log('🧹 Old notifications cleaned');
    });
};

setInterval(checkInactiveUsers,    60 * 60 * 1000);
setInterval(checkDeadlineReminders, 30 * 60 * 1000);
setInterval(checkOverdueTasks,      6 * 60 * 60 * 1000);
setInterval(cleanupOldNotifications, 24 * 60 * 60 * 1000);

setTimeout(checkDeadlineReminders, 5000);
setTimeout(checkOverdueTasks, 8000);

module.exports = { checkInactiveUsers, checkDeadlineReminders, checkOverdueTasks };
