// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../Models/User');

const verifyToken = (req, res, next) => {
    const token = req.headers['x-access-token'];
    if (!token) return res.status(403).send('No token provided.');

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(500).send('Failed to authenticate token.');
        req.userId = decoded.id;
        next();
    });
};

const isAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId);
        if (user.role !== 'admin') {
            return res.status(403).send('Requires admin role.');
        }
        next();
    } catch (error) {
        res.status(500).send('Error checking user role.');
    }
};

module.exports = { authenticateToken: verifyToken, isAdmin };