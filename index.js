const express = require('express');
const cors = require('cors');
const app = express();
// import cors from 'cors';
require('dotenv').config();

app.use(express.json());


app.use(cors({
    origin: 'https://taskmaster.devedupai.com',
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



// start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
