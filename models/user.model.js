const db = require('../config/db');

const User = {
    getAll: callback => {
        db.query('SELECT * FROM user', callback);
    },

    create: (user, callback) => {
        db.query('INSERT INTO user SET ?', user, callback);
    },

    delete: (user, callback) => {
        db.query('DELETE FROM `user` WHERE id=?', user, callback);
    }
};

module.exports = User;
