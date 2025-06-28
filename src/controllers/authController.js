const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');  // Using Pool for DB connection
const { error } = require('winston');
require('dotenv').config();

// Register a New User
exports.register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Check if user exists
        const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ message: "User already exists" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user
        const newUser = await pool.query(
            'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
            [name, email, hashedPassword, role]
        );

        res.status(201).json({ message: "User registered", user: newUser.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getLogin = async (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return res.status(200).json({ user: decoded });
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// Login User
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const user = userResult.rows[0];

        // Compare password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // Generate JWT Token
        const token = jwt.sign({ id: user.id, role: user.role, user_name: user.name }, process.env.JWT_SECRET, {
            expiresIn: process.env.TOKEN_EXPIRY,
        });
        res.cookie("token", token, {
            httpOnly: false,
            // secure: process.env.NODE_ENV === "production", // true only on HTTPS
            secure: false,
            // sameSite: "Strict",
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { email } = req.body;

        // Find user
        const userResult = await pool.query('select * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const user = userResult.rows[0];

        // Compare password
        // const validPassword = await bcrypt.compare(password, user.password);
        // if (!validPassword) {
            // return res.status(401).json({ message: "Invalid email or password" });
        // }

        // Generate JWT Token
        // const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
        //     expiresIn: process.env.TOKEN_EXPIRY,
        // });
        const deletedUserRes = await pool.query('delete from users where email = $1', [email]);
        return res.status(204).json({ message: "User Deleted" });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.logout = async (req, res) => {
    try {
      res.clearCookie("authToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
      });
      res.json({message:"Logout Successful"});

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };