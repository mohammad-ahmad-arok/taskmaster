const db = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

exports.login = (req, res) => {
    const { email, password } = req.body;

    if (!email || !password)
        return res.status(400).json({ error: "inter email and password" });

    const sql = 'SELECT * FROM user WHERE email = ? LIMIT 1';
    db.query(sql, [email], async (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        if (results.length === 0)
            return res.status(401).json({ error: "user not found" });

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch)
            return res.status(401).json({ error: "password uncorrect" });

        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json(
            {
                success: true,
                data: { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } }
            }
        );
    });
};


// get user info 
exports.getCurrentUser = (req, res) => {
    const sql = 'SELECT id, name, email, role FROM user WHERE id = ? LIMIT 1';
    db.query(sql, [req.user.id], (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error' });

        if (results.length === 0)
            return res.status(404).json({ message: 'User not found' });

        res.json({ success: true, data: results[0] });
    });
};

// logout
exports.logout = (req, res) => {
    res.json({ message: 'Logged out' });
};