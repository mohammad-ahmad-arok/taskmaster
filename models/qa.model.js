const makeRoleModel = require('./_roleAccountFactory');

module.exports = makeRoleModel('qa_reviewers', [
  'id', 'name', 'email', 'specialty', 'last_login', 'is_active', 'created_at',
]);
