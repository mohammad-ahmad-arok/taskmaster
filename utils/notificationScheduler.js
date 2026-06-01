const db = require('../config/db');
const Notification = require('../models/notification.model');
const { sendPushToUser, sendEmail, buildEmailHtml } = require('./pushService');

console.log('⏰ Notification Scheduler started');

// ─── Helper: save to DB + push + optional email ───────────────────────────────
const dispatchNotification = async (userId, type, title, message, taskId, userEmail = null) => {
    return new Promise((resolve) => {
        const row = { user_id: userId, type, title, message, task_id: taskId || null, is_read: 0, created_at: new Date() };
        Notification.create(row, async (err, result) => {
            if (err) { console.error('dispatchNotification DB error:', err); return resolve(); }

            const payload = {
                title,
                body: message,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                data: { taskId, type, url: taskId ? `/tasks/${taskId}` : '/' }
            };

            // Push notification (works even when tab is closed if SW is registered)
            sendPushToUser(userId, payload).catch(() => {});

            // Email fallback (only for inactivity / overdue reminders)
            if (userEmail) {
                sendEmail(userEmail, title, buildEmailHtml(title, message, taskId)).catch(() => {});
            }
            resolve();
        });
    });
};

// ─── Inactive Users (24h+) ───────────────────────────────────────────────────
const checkInactiveUsers = () => {
    const query = `
        SELECT u.id, u.name, u.email
        FROM user u
        WHERE u.last_login IS NOT NULL
          AND u.last_login < DATE_SUB(NOW(), INTERVAL 24 HOUR)
          AND NOT EXISTS (
            SELECT 1 FROM notifications n
            WHERE n.user_id = u.id
              AND n.type = 'inactivity_reminder'
              AND n.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
          )
    `;
    db.query(query, async (err, users) => {
        if (err) return console.error('Scheduler checkInactiveUsers error:', err);
        if (!users.length) return;

        for (const u of users) {
            await dispatchNotification(
                u.id,
                'inactivity_reminder',
                '👋 نحن نفتقدك!',
                'لم تقم بتسجيل الدخول منذ أكثر من 24 ساعة. قد تكون هناك مهام بانتظارك!',
                null,
                u.email  // send email since they're offline
            );
        }
        console.log(`📬 Sent inactivity reminders to ${users.length} user(s)`);
    });
};

// ─── Deadline Reminders: 3h, 2h, 1h ─────────────────────────────────────────
const checkDeadlineReminders = () => {
    const windows = [
        { upper: 180, lower: 150, label: '3 ساعات',     type: 'deadline_3h' },
        { upper: 120, lower: 90,  label: 'ساعتين',      type: 'deadline_2h' },
        { upper: 60,  lower: 30,  label: 'ساعة واحدة',  type: 'deadline_1h' },
    ];

    windows.forEach(({ upper, lower, label, type }) => {
        const query = `
            SELECT t.id AS task_id, t.title, t.assignedTo, t.deadline, u.name AS assigned_name, u.email
            FROM task t
            JOIN user u ON u.id = t.assignedTo
            WHERE t.status NOT IN ('completed', 'blocked')
              AND t.deadline BETWEEN DATE_ADD(NOW(), INTERVAL ? MINUTE) AND DATE_ADD(NOW(), INTERVAL ? MINUTE)
              AND NOT EXISTS (
                SELECT 1 FROM notifications n
                WHERE n.user_id = t.assignedTo AND n.type = ? AND n.task_id = t.id
                  AND n.created_at > DATE_SUB(NOW(), INTERVAL 4 HOUR)
              )
        `;
        db.query(query, [lower, upper, type], async (err, tasks) => {
            if (err) return console.error(`Scheduler ${type} error:`, err);
            if (!tasks.length) return;

            // Get manager emails for push
            db.query("SELECT id FROM user WHERE role = 'manager'", async (err2, managers) => {
                if (err2) return;

                for (const task of tasks) {
                    // Notify employee (with push - no email for short-term reminders)
                    await dispatchNotification(
                        task.assignedTo,
                        type,
                        `⏰ تذكير: موعد المهمة بعد ${label}`,
                        `تذكير! موعد تسليم مهمة "${task.title}" بعد ${label} فقط.`,
                        task.task_id
                    );

                    // Notify managers
                    for (const m of managers) {
                        await dispatchNotification(
                            m.id,
                            type,
                            `⏰ مهمة تقترب من موعدها`,
                            `مهمة "${task.title}" المعينة لـ ${task.assigned_name} ستنتهي بعد ${label}.`,
                            task.task_id
                        );
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
        SELECT t.id AS task_id, t.title, t.assignedTo, u.name AS assigned_name, u.email
        FROM task t
        JOIN user u ON u.id = t.assignedTo
        WHERE t.status NOT IN ('completed', 'blocked')
          AND t.deadline < NOW()
          AND NOT EXISTS (
            SELECT 1 FROM notifications n
            WHERE n.user_id = t.assignedTo AND n.type = 'task_overdue' AND n.task_id = t.id
              AND n.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
          )
    `;
    db.query(query, async (err, tasks) => {
        if (err) return console.error('Scheduler overdue error:', err);
        if (!tasks.length) return;

        db.query("SELECT id, email FROM user WHERE role = 'manager'", async (err2, managers) => {
            if (err2) return;

            for (const task of tasks) {
                // Notify employee with email (they might be offline)
                await dispatchNotification(
                    task.assignedTo,
                    'task_overdue',
                    '🔴 مهمة متأخرة!',
                    `تجاوزت مهمة "${task.title}" موعدها النهائي. يرجى تحديث حالتها أو طلب تمديد.`,
                    task.task_id,
                    task.email  // email since they might be offline
                );

                // Notify managers with email too
                for (const m of managers) {
                    await dispatchNotification(
                        m.id,
                        'task_overdue',
                        '🔴 مهمة متأخرة!',
                        `مهمة "${task.title}" المعينة لـ ${task.assigned_name} تجاوزت موعدها النهائي.`,
                        task.task_id,
                        m.email
                    );
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

// ─── Schedules ───────────────────────────────────────────────────────────────
setInterval(checkInactiveUsers,    60 * 60 * 1000);       // every 1 hour
setInterval(checkDeadlineReminders, 30 * 60 * 1000);      // every 30 min
setInterval(checkOverdueTasks,      6 * 60 * 60 * 1000);  // every 6 hours
setInterval(cleanupOldNotifications, 24 * 60 * 60 * 1000); // daily

// Run on startup after DB is ready
setTimeout(checkDeadlineReminders, 5000);
setTimeout(checkOverdueTasks, 8000);

module.exports = { checkInactiveUsers, checkDeadlineReminders, checkOverdueTasks };
