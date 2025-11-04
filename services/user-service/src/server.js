const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const app = express();
const PORT = process.env.PORT || 3001;
const SALT_ROUNDS = 10;

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// DATABASE CONNECTION (MySQL only)
// ============================================
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'cloudeats_user',
  password: process.env.DB_PASSWORD || 'cloudeats_password',
  database: process.env.DB_NAME || 'cloudeats_db'
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    return;
  }
  console.log('✅ User Service: Connected to MySQL database');
  initializeDatabase();
});

// ============================================
// DATABASE INITIALIZATION
// ============================================
function initializeDatabase() {
  const createUserTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      phone VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_email (email)
    )
  `;
  
  db.query(createUserTableQuery, (err) => {
    if (err) {
      console.error('Error creating users table:', err);
      return;
    }
    console.log('✅ Users table ready');
  });
}

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
  res.json({ 
    service: 'user-service', 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// USER AUTHENTICATION ROUTES
// ============================================

// --- Registration Endpoint ---
// [COPY from your monolith: app.post('/api/auth/register', ...)]
app.post('/api/auth/register', async (req, res) => {
  const { email, password, full_name, phone } = req.body;
  
  // Validation
  if (!email || !password || !full_name) {
    return res.status(400).json({ 
      error: 'Email, password, and full name are required' 
    });
  }
  
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  // Password strength validation
  if (password.length < 6) {
    return res.status(400).json({ 
      error: 'Password must be at least 6 characters long' 
    });
  }
  
  try {
    // Check if user already exists
    db.query('SELECT id FROM users WHERE email = ?', [email], async (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (results.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      
      // Hash password
      const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
      
      // Insert new user
      const insertQuery = 'INSERT INTO users (email, password_hash, full_name, phone) VALUES (?, ?, ?, ?)';
      db.query(insertQuery, [email, password_hash, full_name, phone || null], (err, result) => {
        if (err) {
          console.error('Error creating user:', err);
          return res.status(500).json({ error: 'Failed to create user' });
        }
        
        res.status(201).json({
          message: 'User registered successfully',
          user: {
            id: result.insertId,
            email: email,
            full_name: full_name
          }
        });
      });
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// --- Login Endpoint ---
// [COPY from your monolith: app.post('/api/auth/login', ...)]
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  // Find user by email
  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (results.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const user = results[0];
    
    try {
      // Compare password with hash
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      
      // Login successful
      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          phone: user.phone
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });
});

// --- Get User Profile ---
// [COPY from your monolith: app.get('/api/users/:id', ...)]
app.get('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  
  db.query('SELECT id, email, full_name, phone, created_at FROM users WHERE id = ?', 
    [userId], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (results.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(results[0]);
    });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 User Service running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});