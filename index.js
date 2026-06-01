const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();

app.use(express.json());

app.use(cors({
    origin: '*',
    credentials: true,
}));

// auth Route
const authRoutes = require('./routes/auth.routes');
app.use('/api/auth', authRoutes);

// user Routes
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

// Notifications Routes
const notificationRoutes = require('./routes/notification.routes');
app.use('/api/notifications', notificationRoutes);

// Push Subscription Routes
const pushRoutes = require('./routes/push.routes');
app.use('/api/push', pushRoutes);

// Start notification scheduler
require('./utils/notificationScheduler');

// start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
