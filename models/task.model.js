const db = require('../config/db');

const Task = {
  getAll: callback => {
    db.query('SELECT * FROM task', callback);
  },
  getOne: (task, callback) => {
    db.query('SELECT * FROM task WHERE id=?', [task], callback);
  },
  getMyTasks: (task, callback) => {
    db.query('SELECT * FROM task WHERE assignedTo=?', [task], callback);
  },

  // ---- Dependency Engine -------------------------------------------
  // Fetch the prerequisite task (if any) so we can check its status
  // before allowing a state change on the dependent task.
  getDependency: (dependsOnTaskId, callback) => {
    if (!dependsOnTaskId) return callback(null, []);
    db.query('SELECT id, status FROM task WHERE id = ?', [dependsOnTaskId], callback);
  },

  // Tasks that list `taskId` as their prerequisite — used to unlock the
  // next step(s) automatically when this task is completed.
  getDependents: (taskId, callback) => {
    db.query('SELECT id, isLocked FROM task WHERE dependsOnTaskId = ?', [taskId], callback);
  },

  setLocked: (taskId, isLocked, callback) => {
    db.query('UPDATE task SET isLocked = ? WHERE id = ?', [isLocked ? 1 : 0, taskId], callback);
  },

  editTaskStatus: (task, status, callback) => {
    db.query('UPDATE `task` SET `status`=? WHERE `id`=?', [status, task], callback);
  },

  // Approval-gate aware status/reviewer update
  setReviewState: (taskId, { status, reviewerRole, reviewerId, revisionNotes }, callback) => {
    db.query(
      'UPDATE task SET status = ?, reviewerRole = ?, reviewerId = ?, revisionNotes = ? WHERE id = ?',
      [status, reviewerRole || null, reviewerId || null, revisionNotes || null, taskId],
      callback
    );
  },

  editExtensionRequestStatus: (task, requestId, status, callback) => {
    db.query('UPDATE `extension_requests` SET `status`=? WHERE `id`=? AND `task_id`=?;', [status, requestId, task], callback);
  },

  create: (task, callback) => {
    db.query('INSERT INTO task SET ?', task, callback);
  },

  addExtensionRequests: (extensionRequests, callback) => {
    db.query('INSERT INTO extension_requests SET ?', extensionRequests, callback);
  },

  delete: (task, callback) => {
    db.query('DELETE FROM `task` WHERE id=?', [task], callback);
  },

  // ---- Timer / actual time spent (Financial Module) ------------------
  startTimer: (taskId, callback) => {
    db.query(
      "UPDATE task SET timerState = 'running', timerStartedAt = NOW() WHERE id = ? AND timerState != 'running'",
      [taskId],
      callback
    );
  },

  // Stops or pauses: adds elapsed seconds since timerStartedAt onto
  // actualTimeSpentSeconds, then clears timerStartedAt.
  stopOrPauseTimer: (taskId, nextState, callback) => {
    db.query(
      `UPDATE task
       SET actualTimeSpentSeconds = actualTimeSpentSeconds + TIMESTAMPDIFF(SECOND, timerStartedAt, NOW()),
           timerStartedAt = NULL,
           timerState = ?
       WHERE id = ? AND timerState = 'running' AND timerStartedAt IS NOT NULL`,
      [nextState, taskId],
      callback
    );
  },

  getTimerState: (taskId, callback) => {
    db.query('SELECT timerState, timerStartedAt, actualTimeSpentSeconds, assignedTo FROM task WHERE id = ?', [taskId], callback);
  },
};

module.exports = Task;
