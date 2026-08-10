// Single source of truth mapping a role name to its physical table.
// This is what lets us keep four fully separate tables while still
// writing generic, reusable RBAC and lookup logic.
const ROLE_TABLES = {
  ceo: 'ceo',
  team_manager: 'team_managers',
  qa: 'qa_reviewers',
  employee: 'employees',
};

const ALL_ROLES = Object.keys(ROLE_TABLES); // ['ceo','team_manager','qa','employee']

function tableForRole(role) {
  const table = ROLE_TABLES[role];
  if (!table) throw new Error(`Unknown role: ${role}`);
  return table;
}

module.exports = { ROLE_TABLES, ALL_ROLES, tableForRole };
