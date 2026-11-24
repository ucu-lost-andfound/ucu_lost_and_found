require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { authenticateToken, requireAdmin } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;
const multer = require('multer');
const path = require('path');
const fs = require('fs');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured before starting the API.');
}

const allowedOrigins = new Set([
  ...(process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:5173', 'http://127.0.0.1:5173']),
  ...(process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
]);

app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin));
  },
}));
app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    return res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    console.error('Health check failed:', err);
    return res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

const uploadDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueName + path.extname(file.originalname).toLowerCase());
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed.'));
    }
  }
});

// Make uploaded images accessible to the frontend
app.use('/uploads', express.static(uploadDir));

// 1. AUTHENTICATION ENDPOINTS
app.post('/api/register', async (req, res) => {
  try {
    const { full_name, reg_no, email, password } = req.body;

    if (
      typeof full_name !== 'string' || !full_name.trim() ||
      typeof reg_no !== 'string' || !reg_no.trim() ||
      typeof email !== 'string' || !email.trim() ||
      typeof password !== 'string' || password.length < 6
    ) {
      return res.status(400).json({
        error: 'Full name, registration number, email, and a password of at least 6 characters are required.',
      });
    }

    const [existing] = await db.query(
      'SELECT user_id FROM users WHERE reg_no = ? OR email = ?',
      [reg_no.trim(), email.trim().toLowerCase()]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'A user with this registration number or email already exists.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (full_name, reg_no, email, password_hash, role) VALUES (?, ?, ?, ?, "STUDENT")',
      [full_name.trim(), reg_no.trim(), email.trim().toLowerCase(), password_hash]
    );

    return res.status(201).json({
      message: 'Registration successful.',
      user_id: result.insertId,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to register user.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const [users] = await db.query(
      'SELECT user_id, full_name, reg_no, email, password_hash, role FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = users[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      {
        user_id: user.user_id,
        full_name: user.full_name,
        reg_no: user.reg_no,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      token,
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        reg_no: user.reg_no,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to log in.' });
  }
});

// 3. CLAIMS & ADMIN WORKFLOW ENDPOINTS
app.post('/api/claims', authenticateToken, async (req, res) => {
  try {
    const { item_id, evidence_text } = req.body;
    if (!item_id || typeof evidence_text !== 'string' || evidence_text.trim().length < 5) {
      return res.status(400).json({ error: 'Please provide clear private ownership evidence.' });
    }

    const [items] = await db.query('SELECT * FROM items WHERE item_id = ?', [item_id]);
    if (items.length === 0) {
      return res.status(404).json({ error: 'Item not found.' });
    }

    const item = items[0];
    if (item.report_type !== 'FOUND') {
      return res.status(400).json({ error: 'Claims can only be submitted on FOUND items.' });
    }
    if (item.reporter_id === req.user.user_id) {
      return res.status(403).json({ error: 'You cannot claim an item you reported as found.' });
    }
    if (item.status !== 'OPEN') {
      return res.status(400).json({ error: 'This item already has an approved claim or has been returned.' });
    }

    const [existing] = await db.query(
      'SELECT claim_id FROM claims WHERE item_id = ? AND claimant_id = ? AND status = "PENDING"',
      [item_id, req.user.user_id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'You already have a pending claim for this item.' });
    }

    await db.query(
      'INSERT INTO claims (item_id, claimant_id, evidence_text, status) VALUES (?, ?, ?, "PENDING")',
      [item_id, req.user.user_id, evidence_text.trim()]
    );

    return res.status(201).json({ message: 'Ownership claim submitted privately for administrator review.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to submit claim.' });
  }
});

app.get('/api/claims', authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'ADMIN';
    const privateSelect = isAdmin ? ', i.private_details AS item_private_details' : '';

    let sql = `
      SELECT c.*, i.title AS item_title, i.campus_location, i.status AS item_status${privateSelect},
             u.full_name AS claimant_name, u.reg_no AS claimant_reg
      FROM claims c
      JOIN items i ON c.item_id = i.item_id
      JOIN users u ON c.claimant_id = u.user_id
    `;
    const params = [];

    if (!isAdmin) {
      sql += ' WHERE c.claimant_id = ?';
      params.push(req.user.user_id);
    }

    sql += ' ORDER BY c.created_at DESC';
    const [claims] = await db.query(sql, params);
    return res.json(claims);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch claims.' });
  }
});

app.patch('/api/claims/:id/review', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { decision, admin_reason } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(decision) || typeof admin_reason !== 'string' || !admin_reason.trim()) {
      return res.status(400).json({ error: 'Decision and reason are required.' });
    }

    await conn.beginTransaction();

    const [claims] = await conn.query(
      'SELECT * FROM claims WHERE claim_id = ? FOR UPDATE',
      [req.params.id]
    );
    if (claims.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Claim not found.' });
    }

    const claim = claims[0];
    if (claim.status !== 'PENDING') {
      await conn.rollback();
      return res.status(409).json({ error: `Claim has already been ${claim.status.toLowerCase()}.` });
    }

    const [items] = await conn.query(
      'SELECT status FROM items WHERE item_id = ? FOR UPDATE',
      [claim.item_id]
    );
    if (items.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Associated item not found.' });
    }

    if (decision === 'APPROVED') {
      if (items[0].status !== 'OPEN') {
        await conn.rollback();
        return res.status(400).json({ error: 'Item is no longer open for claim approval.' });
      }
      await conn.query(
        'UPDATE items SET status = "CLAIM_APPROVED" WHERE item_id = ?',
        [claim.item_id]
      );
    }

    await conn.query(
      'UPDATE claims SET status = ?, admin_reason = ?, reviewed_by = ? WHERE claim_id = ?',
      [decision, admin_reason.trim(), req.user.user_id, req.params.id]
    );

    await conn.commit();
    return res.json({ message: `Claim ${decision.toLowerCase()} successfully.` });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    return res.status(500).json({ error: 'Error reviewing claim.' });
  } finally {
    conn.release();
  }
});

app.patch('/api/items/:id/return', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [items] = await db.query('SELECT status FROM items WHERE item_id = ?', [req.params.id]);
    if (items.length === 0) {
      return res.status(404).json({ error: 'Item not found.' });
    }
    if (items[0].status === 'RETURNED') {
      return res.status(400).json({ error: 'Item is already marked as RETURNED.' });
    }
    if (items[0].status !== 'CLAIM_APPROVED') {
      return res.status(400).json({ error: 'Only items with an approved claim can be marked as RETURNED.' });
    }

    await db.query('UPDATE items SET status = "RETURNED" WHERE item_id = ?', [req.params.id]);
    return res.json({ message: 'Item officially marked as RETURNED.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to mark item as returned.' });
  }
});

// ==========================================
//  ITEMS, SEARCH AND REPORTING
// ==========================================

// GET ALL ITEMS WITH SEARCH FILTERS
app.get('/api/items', authenticateToken, async (req, res) => {
  try {
    const { keyword, category, location, date, type } = req.query;

    let sql = `
      SELECT
        i.item_id,
        i.reporter_id,
        i.report_type,
        i.title,
        i.category,
        i.public_description,
        i.campus_location,
        i.incident_date,
        i.image_url,
        i.status,
        u.full_name AS reporter_name,
        CASE
          WHEN ? = 'ADMIN' OR i.reporter_id = ?
          THEN i.private_details
          ELSE NULL
        END AS private_details
      FROM items i
      JOIN users u ON i.reporter_id = u.user_id
      WHERE 1=1
    `;

    const params = [req.user.role, req.user.user_id];

    if (keyword) {
      sql += ' AND (i.title LIKE ? OR i.public_description LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    if (category) {
      sql += ' AND i.category = ?';
      params.push(category);
    }

    if (location) {
      sql += ' AND i.campus_location LIKE ?';
      params.push(`%${location}%`);
    }

    if (date) {
      sql += ' AND i.incident_date = ?';
      params.push(date);
    }

    if (type) {
      sql += ' AND i.report_type = ?';
      params.push(type);
    }

    sql += ' ORDER BY i.created_at DESC';

    const [items] = await db.query(sql, params);

    res.json(items);
  } catch (err) {
    console.error('Item retrieval error:', err);
    res.status(500).json({ error: 'Failed to retrieve items.' });
  }
});

// CREATE A NEW LOST OR FOUND ITEM REPORT
app.post(
  '/api/items',
  authenticateToken,
  upload.single('image'),
  async (req, res) => {
    try {
      const {
        report_type,
        title,
        category,
        public_description,
        private_details,
        campus_location,
        incident_date
      } = req.body;

      if (
        !report_type ||
        !title ||
        !category ||
        !public_description ||
        !campus_location ||
        !incident_date
      ) {
        return res.status(400).json({
          error: 'Please complete all required fields.'
        });
      }

      if (!['LOST', 'FOUND'].includes(report_type)) {
        return res.status(400).json({
          error: 'Report type must be LOST or FOUND.'
        });
      }

      const image_url = req.file
        ? `/uploads/${req.file.filename}`
        : null;

      await db.query(
        `INSERT INTO items (
          reporter_id,
          report_type,
          title,
          category,
          public_description,
          private_details,
          campus_location,
          incident_date,
          image_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.user_id,
          report_type,
          title,
          category,
          public_description,
          private_details || null,
          campus_location,
          incident_date,
          image_url
        ]
      );

      res.status(201).json({
        message: 'Report submitted successfully.'
      });

    } catch (err) {
      console.error('Item creation error:', err);
      res.status(500).json({
        error: 'Error creating item report.'
      });
    }
  }
);
// UPDATE AN EXISTING ITEM REPORT
app.put('/api/items/:id', authenticateToken, async (req, res) => {
  try {
    const [existing] = await db.query(
      'SELECT * FROM items WHERE item_id = ?',
      [req.params.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Item not found.' });
    }

    if (
      existing[0].reporter_id !== req.user.user_id &&
      req.user.role !== 'ADMIN'
    ) {
      return res.status(403).json({
        error: 'You may only edit your own reports.'
      });
    }

    const {
      title,
      category,
      public_description,
      private_details,
      campus_location,
      incident_date
    } = req.body;

    if (
      !title ||
      !category ||
      !public_description ||
      !campus_location ||
      !incident_date
    ) {
      return res.status(400).json({
        error: 'Please complete all required fields.'
      });
    }

    await db.query(
      `UPDATE items
       SET title = ?,
           category = ?,
           public_description = ?,
           private_details = ?,
           campus_location = ?,
           incident_date = ?
       WHERE item_id = ?`,
      [
        title,
        category,
        public_description,
        private_details || null,
        campus_location,
        incident_date,
        req.params.id
      ]
    );

    res.json({ message: 'Report updated successfully.' });

  } catch (err) {
    console.error('Item update error:', err);
    res.status(500).json({
      error: 'Failed to update report.'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});