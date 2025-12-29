const db = require('../db');
const { isUserInGroup } = require('./group.service');
const { getGroupBalancesInternal } = require('./balance.service');
const { createLedgerEntry } = require('./ledger.service');

exports.processSettlement = async ({ groupId, fromUser, toUser, amount }) => {
  // ─────────────────────────────────────────────────────────
  // 1. GLOBAL VALIDATION (Milestone 7 Invariant)
  // ─────────────────────────────────────────────────────────
  const [balances, fromOk, toOk] = await Promise.all([
    getGroupBalancesInternal(groupId),
    isUserInGroup(groupId, fromUser),
    isUserInGroup(groupId, toUser)
  ]);

  if (!fromOk || !toOk) throw new Error('Both users must be active members');

  // Find the payer's NET balance in the entire group
  const payerBalance = balances.find(b => b.user_id === fromUser);
  
  // FIX: Validate against the GROUP NET, not just pairwise debt
  if (!payerBalance || payerBalance.net_balance >= 0) {
    throw new Error('User does not owe any money in this group to settle');
  }

  const maxPayable = Math.abs(payerBalance.net_balance);
  if (amount > (maxPayable + 0.01)) {
    throw new Error(`Amount exceeds total group debt. Max payable: ${maxPayable.toFixed(2)}`);
  }

  // ─────────────────────────────────────────────────────────
  // 2. ATOMIC EXECUTION (Transaction Fix)
  // ─────────────────────────────────────────────────────────
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Insert Settlement History
    const settleRes = await client.query(
      `INSERT INTO settlements (group_id, from_user, to_user, amount) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [groupId, fromUser, toUser, amount]
    );
    const settlementId = settleRes.rows[0].id;

    // FIX: Reverse Ledger Entry (Flow goes from Receiver back to Payer)
    // This adds a "Positive" flow to the payer's balance.
    await createLedgerEntry({
      client,       // 👈 MANDATORY: Passing the transaction client
      groupId,
      fromUser: toUser,   // 👈 REVERSED
      toUser: fromUser,   // 👈 REVERSED
      amount,
      expenseId: null,
      sourceType: 'SETTLEMENT',
      sourceId: settlementId
    });

    await client.query('COMMIT');
    return { settlement_id: settlementId, amount };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release(); // Return connection to pool
  }
};

/*const db = require('../db');
const { isUserInGroup } = require('./group.service');
const { createLedgerEntry } = require('./ledger.service');

exports.processSettlement = async ({ groupId, fromUser, toUser, amount }) => {
  if (fromUser === toUser) throw new Error('Cannot settle with yourself');
  if (amount <= 0) throw new Error('Amount must be positive');

  const [fromOk, toOk] = await Promise.all([
    isUserInGroup(groupId, fromUser),
    isUserInGroup(groupId, toUser)
  ]);
  if (!fromOk || !toOk) throw new Error('Both users must be group members');

  // 🔥 Directional debt validation (ledger truth)
  const { rows } = await db.query(
    `
    SELECT COALESCE(SUM(amount), 0) AS total_owed
    FROM ledger_entries
    WHERE group_id = $1
      AND from_user = $2
      AND to_user = $3
    `,
    [groupId, fromUser, toUser]
  );

  const totalOwed = parseFloat(rows[0].total_owed);
  if (totalOwed <= 0) {
    throw new Error('No outstanding debt to this user');
  }

  if (amount > totalOwed + 0.01) {
    throw new Error(`Amount exceeds owed amount. Max payable: ${totalOwed}`);
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const settleRes = await client.query(
      `
      INSERT INTO settlements (group_id, from_user, to_user, amount)
      VALUES ($1, $2, $3, $4)
      RETURNING id
      `,
      [groupId, fromUser, toUser, amount]
    );

    await createLedgerEntry({
      groupId,
      fromUser,
      toUser,
      amount,
      expenseId: null,
      sourceType: 'SETTLEMENT',
      sourceId: settleRes.rows[0].id
    });

    await client.query('COMMIT');
    return { settlement_id: settleRes.rows[0].id };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
*/