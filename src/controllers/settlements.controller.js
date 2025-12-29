const settlementService = require('../services/settlement.service');

exports.createSettlement = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { from_user, to_user, amount } = req.body;

    // Delegate business logic to the service
    const settlement = await settlementService.processSettlement({
      groupId: parseInt(groupId),
      fromUser: parseInt(from_user),
      toUser: parseInt(to_user),
      amount: parseFloat(amount)
    });

    return res.status(201).json(settlement);

  } catch (err) {
    // Catch specific validation errors (e.g., "Amount exceeds net debt")
    console.error('Settlement Controller Error:', err.message);
    return res.status(400).json({ error: err.message });
  }
};

/*const db = require('../db');
const { createLedgerEntry } = require('../services/ledger.service');
const settlementService = require('../services/settlement.service');

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
    const settlementId = settlementRes.rows[0].id;
    await createLedgerEntry({
      groupId,
      fromUser: from_user,
      toUser: to_user,
      amount: amount,
      expenseId: null,          
      sourceType: 'SETTLEMENT',  
      sourceId: settlementId     
    });
    const settlement = await settlementService.processSettlement({
      groupId: parseInt(groupId),
      fromUser: parseInt(from_user),
      toUser: parseInt(to_user),
      amount: parseFloat(amount)
    });

    await db.query('COMMIT');
    console.log(`✅ Settlement Processed: ${from_user} paid ${to_user} amount ${amount}`);
    res.status(201).json(settlementRes.rows[0]);

  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Settlement Error:', err);
    res.status(500).json({ error: 'Failed to process settlement' });
  }
};*/