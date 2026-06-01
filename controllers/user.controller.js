const db = require('../config/db');
const User = require('../models/user.model');
const bcrypt = require('bcryptjs');


// get all users
exports.getUsers = (req, res) => {
    User.getAll((err, results) => {
        if (err) return res.status(500).json({ error: 'Database Error' });
        res.json(results);
    });
};

// create a new user
exports.createUser = async (req, res) => {
    const { name, email, password,role } = req.body;

    if (!name || !email || !password||!role)
        return res.status(400).json({ error: "All fields are required" });

    db.query('SELECT * FROM user WHERE email = ?', [email], async (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        if (results.length > 0)
            return res.status(409).json({ error: "email already exists" });

        try {
            const hashedPassword = await bcrypt.hash(password, 10);

            const newUser = { name, email, password: hashedPassword,role };

            User.create(newUser, (err, result) => {
                if (err) return res.status(500).json({ error: 'Error creating user' });

                res.status(201).json({
                    message: "User created successfully",
                    user: {
                        id: result.insertId,
                        name,
                        email,
                        role
                    }
                });
            });
        } catch (error) {
            res.status(500).json({ error: 'Server error during hashing' });
        }
    });
};


// delete user
exports.deleteUser = (req, res) => {
    const userId = req.params.id;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    User.delete(userId, (err, result) => {
        if (err) return res.status(500).json({ error: 'Error deleting user' });

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({ message: 'User deleted successfully' });
    });
};
