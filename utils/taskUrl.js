// The frontend nests task detail pages under a role prefix:
//   /employee/tasks/:id   (employees)
//   /manager/tasks/:id    (team_manager, qa, ceo — they all share the
//                          manager UI, see routes/AppRoutes.tsx)
// Every place that builds a notification deep-link must go through this
// helper so the link actually lands on a real route instead of 404ing.
const ROLE_TABLE_TO_PREFIX = {
  employees: 'employee',
  team_managers: 'manager',
  qa_reviewers: 'manager',
  ceo: 'manager',
};

function taskUrlForRoleTable(roleTable, taskId) {
  if (!taskId) return '/';
  const prefix = ROLE_TABLE_TO_PREFIX[roleTable] || 'employee';
  return `/${prefix}/tasks/${taskId}`;
}

module.exports = { taskUrlForRoleTable };
