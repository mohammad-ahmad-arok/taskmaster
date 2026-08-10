const db = require('../config/db');
const Template = require('../models/template.model');
const Task = require('../models/task.model');
const Project = require('../models/project.model');

// Create a template with its ordered steps in one request.
// body: { name, description, steps: [{ title, description, sequenceOrder,
//         dependsOnSequence, relativeDueDays, defaultRole,
//         requiresQaReview, requiresClientApproval }] }
exports.createTemplate = (req, res) => {
  const { name, description, steps } = req.body;
  const { id: creatorId, role } = req.user;

  if (!name || !Array.isArray(steps) || steps.length === 0) {
    return res.status(400).json({ error: 'name and a non-empty steps array are required' });
  }

  Template.create(
    { name, description: description || null, created_by_role: role, created_by_id: creatorId },
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Error creating template' });
      const templateId = result.insertId;

      let remaining = steps.length;
      let failed = false;

      steps.forEach((step, idx) => {
        const row = {
          template_id: templateId,
          title: step.title,
          description: step.description || null,
          sequence_order: step.sequenceOrder ?? idx + 1,
          depends_on_sequence: step.dependsOnSequence ?? null,
          relative_due_days: step.relativeDueDays ?? 0,
          default_role: step.defaultRole || 'employee',
          requires_qa_review: step.requiresQaReview ? 1 : 0,
          requires_client_approval: step.requiresClientApproval ? 1 : 0,
        };
        Template.addStep(row, (stepErr) => {
          if (stepErr && !failed) {
            failed = true;
            return res.status(500).json({ error: 'Error creating template steps' });
          }
          remaining -= 1;
          if (remaining === 0 && !failed) {
            res.status(201).json({ success: true, data: { id: templateId, name, stepCount: steps.length } });
          }
        });
      });
    }
  );
};

exports.listTemplates = (req, res) => {
  Template.getAll((err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true, data: rows });
  });
};

exports.getTemplate = (req, res) => {
  Template.getOneWithSteps(req.params.id, (err, template) => {
    if (err) return res.status(404).json({ error: 'Template not found' });
    res.json({ success: true, data: template });
  });
};

// Create a new project FROM a template: generates and sequences every
// linked task with correct dependencies and relative due dates.
// body: { name, description, startDate, endDate, contractValue, templateId,
//         assignments: { [sequenceOrder]: employeeId }  (optional overrides) }
exports.createProjectFromTemplate = (req, res) => {
  const { name, description, startDate, endDate, contractValue, templateId, assignments = {} } = req.body;

  if (!name || !startDate || !endDate || !templateId) {
    return res.status(400).json({ error: 'name, startDate, endDate, and templateId are required' });
  }

  Template.getOneWithSteps(templateId, (tErr, template) => {
    if (tErr) return res.status(404).json({ error: 'Template not found' });
    if (!template.steps.length) return res.status(400).json({ error: 'Template has no steps' });

    const newProject = {
      name,
      description: description || template.description,
      start_date: startDate,
      end_date: endDate,
      contract_value: contractValue || 0,
      template_id: templateId,
    };

    Project.create(newProject, (pErr, pResult) => {
      if (pErr) return res.status(500).json({ error: 'Error creating project' });
      const projectId = pResult.insertId;

      // Resolve default assignee per step (falls back to "unassigned"
      // placeholder handling: require explicit assignment or reject).
      const steps = [...template.steps].sort((a, b) => a.sequence_order - b.sequence_order);
      const sequenceToTaskId = {}; // sequence_order -> created task id
      const start = new Date(startDate);

      const createStepsSequentially = (index) => {
        if (index >= steps.length) {
          return res.status(201).json({
            success: true,
            data: { projectId, tasksCreated: steps.length },
          });
        }

        const step = steps[index];
        const assignedTo = assignments[step.sequence_order] || assignments[String(step.sequence_order)];
        if (!assignedTo) {
          return res.status(400).json({
            error: `Missing employee assignment for template step ${step.sequence_order} ("${step.title}")`,
          });
        }

        const dueDate = new Date(start);
        dueDate.setDate(dueDate.getDate() + step.relative_due_days);
        const deadline = dueDate.toISOString().slice(0, 10);

        const dependsOnTaskId = step.depends_on_sequence ? sequenceToTaskId[step.depends_on_sequence] : null;
        const isLocked = !!dependsOnTaskId; // locked until its prerequisite (in this same project) completes

        db.query('SELECT name FROM employees WHERE id = ?', [assignedTo], (uErr, uRows) => {
          if (uErr || uRows.length === 0) {
            return res.status(404).json({ error: `Employee ${assignedTo} not found for step ${step.sequence_order}` });
          }

          const newTask = {
            title: step.title,
            description: step.description || '',
            projectId,
            projectName: name,
            assignedTo,
            assignedToName: uRows[0].name,
            deadline,
            dependsOnTaskId,
            isLocked: isLocked ? 1 : 0,
          };

          Task.create(newTask, (taskErr, taskResult) => {
            if (taskErr) return res.status(500).json({ error: `Error creating task for step ${step.sequence_order}` });
            sequenceToTaskId[step.sequence_order] = taskResult.insertId;
            createStepsSequentially(index + 1);
          });
        });
      };

      createStepsSequentially(0);
    });
  });
};
