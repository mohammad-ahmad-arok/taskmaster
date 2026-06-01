const db = require('../config/db');
const Project = require('../models/project.model');


// get all projects
exports.getProjects = (req, res) => {
    Project.getAll((err, rows) => {
        if (err) return res.status(500).json({ error: 'Database Error' });

        const projectsMap = {};

        rows.forEach(row => {
            if (!projectsMap[row.id]) {
                projectsMap[row.id] = {
                    id: row.id,
                    name: row.name,
                    description: row.description,
                    startDate: row.startDate,
                    endDate: row.endDate,
                    status: row.status,
                    tasks: []
                };
            }

            if (row.task_id) {
                projectsMap[row.id].tasks.push({
                    id: row.task_id,
                    title: row.task_title,
                    description: row.task_description,
                    status: row.task_status,
                    deadline: row.task_deadline
                });
            }
        });

        const projects = Object.values(projectsMap);

        res.json({ data: projects });
    });
};

// get project by id
exports.getOneProject = (req, res) => {
    const projectId = req.params.id;

    Project.getOne(projectId, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database Error' });

        if (!rows.length) return res.status(404).json({ error: 'Project not found' });

        const projectData = {
            id: rows[0].id,
            name: rows[0].name,
            description: rows[0].description,
            startDate: rows[0].startDate,
            endDate: rows[0].endDate,
            status: rows[0].status,
            tasks: []
        };

        const taskMap = {};

        rows.forEach(row => {
            if (row.task_id) {
                if (!taskMap[row.task_id]) {
                    taskMap[row.task_id] = {
                        id: row.task_id,
                        title: row.task_title,
                        description: row.task_description,
                        assignedTo: row.task_assignedTo,
                        assignedToName: row.task_assignedToName,
                        status: row.task_status,
                        deadline: row.task_deadline,
                        extensionRequests: [],
                        notes: []
                    };
                    projectData.tasks.push(taskMap[row.task_id]);
                }

                // Add extension request
                if (row.request_id && !taskMap[row.task_id].extensionRequests.find(r => r.id === row.request_id)) {
                    taskMap[row.task_id].extensionRequests.push({
                        id: row.request_id,
                        reason: row.request_reason,
                        requested_days: row.request_new_deadline,
                        status: row.request_status,
                        created_at: row.request_created_at
                    });
                }

                // Add note
                if (row.note_id && !taskMap[row.task_id].notes.find(n => n.id === row.note_id)) {
                    taskMap[row.task_id].notes.push({
                        id: row.note_id,
                        content: row.note_content,
                        created_at: row.note_created_at
                    });
                }
            }
        });

        res.json({ data: projectData });
    });
};


// create a new projects
exports.createProjects = async (req, res) => {
    const { name, description, startDate, endDate } = req.body;
    if (!name || !description || !startDate || !endDate)
        return res.status(400).json({ error: "All fields are required" });

    try {
        const newProject = { name, description, start_date: startDate, end_date: endDate };
        Project.create(newProject, (err, result) => {
            if (err) return res.status(500).json({ error: 'Error creating new Project' });

            res.status(201).json({
                message: "Project created successfully",
                data: {
                    id: result.insertId,
                    name, description, startDate, endDate, status: 'not-started', tasks: []
                }
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};


