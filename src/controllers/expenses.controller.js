const db = require('../db');

exports.createExpense = async (req, res) => {
  const { groupId } = req.params;
  const { paid_by, total_amount, description, split_type, participants, splits } = req.body;

  try {
    await db.query('BEGIN'); // Start Transaction

    // --- STEP 3.1: Validate Group Exists ---
    const groupCheck = await db.query('SELECT 1 FROM groups WHERE id = $1', [groupId]);
    if (groupCheck.rowCount === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: "Group not found" });
    }

    // --- STEP 3.2: Validate Payer is Active Member ---
    const payerCheck = await db.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND left_at IS NULL',
      [groupId, paid_by]
    );
    if (payerCheck.rowCount === 0) {
      await db.query('ROLLBACK');
      return res.status(400).json({ error: "Payer must be an active group member" });
    }

    // --- STEP 5: Insert Expense (The Event) ---
    const expenseRes = await db.query(
      'INSERT INTO expenses (group_id, paid_by, total_amount, description, split_type) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [groupId, paid_by, total_amount, description, split_type]
    );
    const expenseId = expenseRes.rows[0].id;

    // --- STEP 6: Insert Splits (The Ledger) ---
    // Handle EQUAL split logic
    if (split_type === 'EQUAL') {
      const amountPerPerson = (total_amount / participants.length).toFixed(2);
      
      for (let userId of participants) {
        // STEP 3.3: Validate participant is active member in group (handle soft delete)
        const memberStatus = await db.query(
          'SELECT left_at FROM group_members WHERE group_id = $1 AND user_id = $2',
          [groupId, userId]
        );

        if (memberStatus.rows.length === 0 || memberStatus.rows[0].left_at !== null) {
          throw new Error(`User ${userId} is not an active member of this group.`);
        }

        await db.query(
          'INSERT INTO expense_splits (expense_id, user_id, amount_owed) VALUES ($1, $2, $3)',
          [expenseId, userId, amountPerPerson]
        );
      }
    } 
    // You can add logic for EXACT and PERCENT here later

    await db.query('COMMIT'); 
    res.status(201).json({ message: "Expense recorded", expenseId });

  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to create expense" });
  }
};