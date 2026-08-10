const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const app = express();
require('dotenv').config();

app.use(express.json());

app.use(cors({
    origin: '*',
    credentials: true,
}));

// Serve uploaded task attachments (Enhanced Internal Communication module)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// auth Route
const authRoutes = require('./routes/auth.routes');
app.use('/api/auth', authRoutes);

// user/account Routes (multi-table account management)
const userRoutes = require('./routes/user.routes');
app.use('/api/user', userRoutes);

// task Routes
const taskRoutes = require('./routes/task.routes');
app.use('/api/task', taskRoutes);

// task Notes Routes
const taskNoteRoutes = require('./routes/taskNote.routes');
app.use('/api/taskNote', taskNoteRoutes);

// Project Routes
const projectRoutes = require('./routes/project.routes');
app.use('/api/project', projectRoutes);

// employee Routes
const employeeRoutes = require('./routes/employee.routes');
app.use('/api/employee', employeeRoutes);

// Project Template Routes (Automated Project Templates module)
const templateRoutes = require('./routes/template.routes');
app.use('/api/template', templateRoutes);

// Financial / Profitability Routes (CEO only)
const financialRoutes = require('./routes/financial.routes');
app.use('/api/financial', financialRoutes);

// Activity Log + Presence Routes
const activityRoutes = require('./routes/activity.routes');
app.use('/api/activity', activityRoutes);

// Notifications Routes
const notificationRoutes = require('./routes/notification.routes');
app.use('/api/notifications', notificationRoutes);

// Push Subscription Routes
const pushRoutes = require('./routes/push.routes');
app.use('/api/push', pushRoutes);

// ─── Global error handler ────────────────────────────────────────────────
// Without this, unhandled errors (e.g. Multer rejecting an unsupported
// file type or a file over the size limit) fall through to Express's
// default HTML error page. The frontend always does `await response.json()`,
// so an HTML response throws a parse error client-side and shows a generic
// "network error" with zero diagnostic value. This middleware guarantees
// every error — including ones thrown deep in route handlers — comes back
// as JSON with a real, useful message.
const multer = require('multer');
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: 'File is too large (max 15MB).' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    if (err && err.message === 'File type not allowed') {
        return res.status(400).json({ error: 'This file type is not supported.' });
    }
    if (err instanceof SyntaxError && 'body' in err) {
        return res.status(400).json({ error: 'Malformed JSON in request body.' });
    }
    if (err) {
        console.error('Unhandled error:', err);
        return res.status(500).json({ error: 'Unexpected server error.' });
    }
    next();
});

// Start notification scheduler
require('./utils/notificationScheduler');

// start server (wrapped in a plain http server so Socket.io can attach)
const PORT = process.env.PORT || 3000;
const httpServer = http.createServer(app);

// Real-Time Presence & Activity Tracking (Socket.io)
const initSockets = require('./sockets');
initSockets(httpServer);

httpServer.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
