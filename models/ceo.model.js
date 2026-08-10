const makeRoleModel = require('./_roleAccountFactory');

module.exports = makeRoleModel('ceo', ['id', 'name', 'email', 'last_login', 'is_active', 'created_at']);
