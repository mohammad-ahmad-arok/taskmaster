const webpush = require('web-push');
const nodemailer = require('nodemailer');
const db = require('../config/db');
const PushSubscription = require('../models/pushSubscription.model');
require('dotenv').config();

webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
});

const sendPushToSubscription = async (subscription, payload) => {
    const sub = {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    };
    try {
        await webpush.sendNotification(sub, JSON.stringify(payload));
        return true;
    } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
            PushSubscription.deleteByEndpoint(subscription.endpoint, () => {});
        } else {
            console.error('Push send error:', err.message);
        }
        return false;
    }
};

// recipients: [{ roleTable, roleId }, ...]
const sendPushToRecipients = async (recipients, payload) => {
    if (!recipients || recipients.length === 0) return;
    PushSubscription.getByRecipients(recipients, async (err, subscriptions) => {
        if (err || !subscriptions.length) return;
        for (const sub of subscriptions) {
            await sendPushToSubscription(sub, payload);
        }
    });
};

const sendPushToRecipient = async (roleTable, roleId, payload) => {
    PushSubscription.getByRecipient(roleTable, roleId, async (err, subscriptions) => {
        if (err || !subscriptions.length) return;
        for (const sub of subscriptions) {
            await sendPushToSubscription(sub, payload);
        }
    });
};

const sendPushToManagers = async (payload) => {
    PushSubscription.getManagerSubscriptions(async (err, subscriptions) => {
        if (err || !subscriptions.length) return;
        for (const sub of subscriptions) {
            await sendPushToSubscription(sub, payload);
        }
    });
};

const sendEmail = async (toEmail, subject, htmlBody) => {
    if (!process.env.MAIL_USER || process.env.MAIL_USER === 'your_email@gmail.com') {
        console.log(`📧 [Email skipped - not configured] To: ${toEmail} | Subject: ${subject}`);
        return;
    }
    try {
        await transporter.sendMail({ from: process.env.MAIL_FROM, to: toEmail, subject, html: htmlBody });
        console.log(`📧 Email sent to ${toEmail}`);
    } catch (err) {
        console.error('Email send error:', err.message);
    }
};

const buildEmailHtml = (title, message, taskId = null) => {
    const taskLink = taskId
        ? `<p style="margin-top:16px"><a href="${process.env.APP_URL || 'http://localhost:5173'}/tasks/${taskId}"
            style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;">
            عرض المهمة</a></p>`
        : '';

    return `
    <div style="font-family:Arial,sans-serif;direction:rtl;max-width:560px;margin:0 auto;background:#f8fafc;padding:24px;border-radius:12px;">
      <div style="background:#0f172a;padding:16px 24px;border-radius:8px 8px 0 0;">
        <h1 style="color:#fff;margin:0;font-size:20px;">Agency ERP Mini</h1>
      </div>
      <div style="background:#fff;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;">
        <h2 style="color:#1e293b;font-size:18px;margin-top:0;">${title}</h2>
        <p style="color:#475569;font-size:15px;line-height:1.6;">${message}</p>
        ${taskLink}
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">
        <p style="color:#94a3b8;font-size:12px;margin:0;">هذا البريد تم إرساله تلقائياً من نظام Agency ERP Mini</p>
      </div>
    </div>`;
};

const ROLE_TABLE_TO_TABLE = { ceo: 'ceo', team_manager: 'team_managers', qa: 'qa_reviewers', employee: 'employees' };

// Notify one recipient (push always; email fallback if forced or inactive)
const notifyRecipient = async (roleTable, roleId, payload, { forceEmail = false } = {}) => {
    await sendPushToRecipient(roleTable, roleId, payload);

    if (forceEmail) {
        db.query(`SELECT email, name, last_login FROM \`${roleTable}\` WHERE id = ?`, [roleId], async (err, results) => {
            if (err || !results.length) return;
            const account = results[0];
            const lastLogin = account.last_login ? new Date(account.last_login) : null;
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

            if (!lastLogin || lastLogin < oneHourAgo) {
                await sendEmail(account.email, payload.title, buildEmailHtml(payload.title, payload.body, payload.data?.taskId));
            }
        });
    }
};

const notifyRecipients = async (recipients, payload, options = {}) => {
    for (const r of recipients) {
        await notifyRecipient(r.roleTable, r.roleId, payload, options);
    }
};

module.exports = {
    sendPushToRecipient,
    sendPushToRecipients,
    sendPushToManagers,
    sendEmail,
    buildEmailHtml,
    notifyRecipient,
    notifyRecipients,
};
