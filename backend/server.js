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