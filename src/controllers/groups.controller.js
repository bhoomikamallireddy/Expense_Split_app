const db = require('../db');

exports.createGroup = async (req, res) => {
  const { name, created_by } = req.body;

  try {
    // We use a "Transaction" (BEGIN/COMMIT) so if one part fails, everything cancels
    await db.query('BEGIN');

    // 1. Insert the group
    const groupResult = await db.query(
      'INSERT INTO groups (name, created_by) VALUES ($1, $2) RETURNING *',
      [name, created_by]
    );
    const newGroup = groupResult.rows[0];

    // 2. Automatically add the creator as the first member
    await db.query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
      [newGroup.id, created_by]
    );

    await db.query('COMMIT');
    res.status(201).json(newGroup);
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: "Could not create group. Ensure User ID exists." });
  }
};

exports.addMember = async (req, res) => {
  const { groupId } = req.params;
  const { user_id } = req.body;

  try {
    // Check if the user is already in the group to avoid errors
    const existing = await db.query(
      'SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, user_id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "User is already a member of this group" });
    }

    const result = await db.query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) RETURNING *',
      [groupId, user_id]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not add member. Ensure User and Group IDs are correct." });
  }
};