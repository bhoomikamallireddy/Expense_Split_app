const db = require('../db');

exports.createSettlement = async (req, res) => {
  const { groupId } = req.params;
  const { from_user, to_user, amount } = req.body;

  try {
    await db.query('BEGIN');

    // 1. Validate: Ensure both users are in the group
    const memberCheck = await db.query(
      'SELECT user_id FROM group_members WHERE group_id = $1 AND user_id IN ($2, $3)',
      [groupId, from_user, to_user]
    );

    if (memberCheck.rowCount < 2) {
      await db.query('ROLLBACK');
      return res.status(400).json({ error: 'Both users must be members of the group' });
    }

    // 2. Insert into Settlements table (for history)
    const settlementRes = await db.query(
      'INSERT INTO settlements (group_id, from_user, to_user, amount) VALUES ($1, $2, $3, $4) RETURNING *',
      [groupId, from_user, to_user, amount]
    );

    // 3. Insert into Ledger entries (THE TRUTH)
    // When Bob (from) pays Alice (to), money flows FROM Bob TO Alice.
    // This reduces Bob's debt in the balance calculation.
    // Bob pays Alice → cancel Bob's debt
    await db.query(
    `
     INSERT INTO ledger_entries (group_id, expense_id, from_user, to_user, amount)
     VALUES ($1, NULL, $2, $3, $4)
    `,
    [groupId, to_user, from_user, amount] // REVERSED
   );


    await db.query('COMMIT');
    console.log(`✅ Settlement Processed: ${from_user} paid ${to_user} amount ${amount}`);
    res.status(201).json(settlementRes.rows[0]);

  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Settlement Error:', err);
    res.status(500).json({ error: 'Failed to process settlement' });
  }
};