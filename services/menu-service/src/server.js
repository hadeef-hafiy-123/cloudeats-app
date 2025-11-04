const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3002;

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
  console.log('✅ Menu Service: Connected to MySQL database');
  initializeDatabase();
});

// ============================================
// DATABASE INITIALIZATION
// ============================================
function initializeDatabase() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS menu_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      price DECIMAL(10, 2) NOT NULL,
      description TEXT,
      badge VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  db.query(createTableQuery, (err) => {
    if (err) {
      console.error('Error creating table:', err);
      return;
    }
    console.log('✅ Menu items table ready');
    
    // Check if we need sample data
    db.query('SELECT COUNT(*) as count FROM menu_items', (err, results) => {
      if (err) return;
      if (results[0].count === 0) {
        insertSampleData();
      }
    });
  });
}

function insertSampleData() {
  const sampleItems = [
    ['Nasi Lemak Special', 'Breakfast', 12.00, 'Fragrant coconut rice with sambal, anchovies, peanuts, boiled egg, and crispy chicken', 'popular'],
    ['Nasi Lemak Regular', 'Breakfast', 8.00, 'Classic coconut rice with sambal, anchovies, peanuts, and boiled egg', null],
    ['Nasi Lemak Ayam Goreng', 'Breakfast', 10.00, 'Coconut rice with fried chicken, sambal, anchovies, peanuts, and egg', null],
    ['Roti Canai with Curry', 'Breakfast', 6.00, 'Flaky flatbread served with dhal curry', 'popular'],
    ['Nasi Goreng Kampung', 'Main', 11.00, 'Village-style fried rice with anchovies, vegetables, and egg', null],
    ['Mee Goreng Mamak', 'Main', 10.00, 'Spicy fried yellow noodles with vegetables, tofu, and egg', null],
    ['Char Kuey Teow', 'Main', 12.00, 'Stir-fried flat rice noodles with prawns, egg, and bean sprouts', 'spicy'],
    ['Teh Tarik', 'Beverage', 3.00, 'Malaysian pulled tea with condensed milk', null],
    ['Milo Ais', 'Beverage', 4.00, 'Iced chocolate malt drink', null],
    ['Air Sirap', 'Beverage', 2.50, 'Sweet rose syrup drink', null]
  ];
  
  const insertQuery = 'INSERT INTO menu_items (name, category, price, description, badge) VALUES ?';
  
  db.query(insertQuery, [sampleItems], (err) => {
    if (err) {
      console.error('Error inserting sample data:', err);
      return;
    }
    console.log('✅ Sample menu items inserted');
  });
}

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
  res.json({ 
    service: 'menu-service', 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// MENU ROUTES
// ============================================

// --- Get all menu items ---
// [COPY from your monolith: app.get('/api/menu', ...)]
app.get('/api/menu', (req, res) => {
  db.query('SELECT * FROM menu_items ORDER BY category, name', (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

// --- Get menu items by category ---
// [COPY from your monolith: app.get('/api/menu/category/:category', ...)]
app.get('/api/menu/category/:category', (req, res) => {
  const category = req.params.category;
  db.query('SELECT * FROM menu_items WHERE category = ? ORDER BY name', [category], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

// --- Get single menu item ---
// [COPY from your monolith: app.get('/api/menu/:id', ...)]
app.get('/api/menu/:id', (req, res) => {
  const id = req.params.id;
  db.query('SELECT * FROM menu_items WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(results[0]);
  });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Menu Service running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});