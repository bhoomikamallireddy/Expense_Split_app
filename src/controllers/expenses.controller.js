const db = require('../db');
const { getGroupBalances } = require('../services/balance.service');
const simplifyBalances = require('../utils/balanceSimplifier');
const { createLedgerEntry } = require('../services/ledger.service');

/**
 * Helper: validate group existence
 */
async function validateGroup(groupId) {
  const res = await db.query('SELECT 1 FROM groups WHERE id = $1', [groupId]);
  if (res.rowCount === 0) {
    throw new Error('Group not found');
  }
}

/**
 * Helper: fetch group members with temporal validity
 */
async function fetchValidMembers(groupId, atTime) {
  const res = await db.query(
    `
    SELECT user_id
    FROM group_members
    WHERE group_id = $1
      AND joined_at <= $2
      AND (left_at IS NULL OR left_at > $2)
    `,
    [groupId, atTime]
  );
  return res.rows.map(r => r.user_id);
}

/**
 * Helper: generate ledger entries (SINGLE SOURCE OF TRUTH)
 
async function generateLedger(expenseId, paidBy, splits) {
  for (const { userId, amount } of splits) {
    if (userId !== paidBy && amount > 0) {
      await db.query(
        `
        INSERT INTO ledger_entries (group_id, expense_id, from_user, to_user, amount, source_type, source_id)
        VALUES ($1, $2, $3, $4, $5, 'EXPENSE', $2);

        `,
        [groupId, expenseId, userId, paidBy, amount]
      );
    }
  }
}
*/
/**
 * CREATE EXPENSE + LEDGER
 */
exports.createExpense = async (req, res) => {
  const { groupId } = req.params;
  const { paid_by, total_amount, description, split_type, participants, splits } = req.body;
  
  try {
    await db.query('BEGIN');
    console.log("--- Starting Expense Creation ---");
    await validateGroup(groupId);

    const createdAt = new Date();

    // Validate payer membership at expense time
    const validMembers = await fetchValidMembers(groupId, createdAt);
    if (!validMembers.includes(Number(paid_by))) {
      throw new Error('Payer is not a valid group member at expense time');
    }

    // Insert expense
    const expenseRes = await db.query(
      `
      INSERT INTO expenses (group_id, paid_by, total_amount, description, split_type, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
      `,
      [groupId, paid_by, total_amount, description, split_type, createdAt]
    );

    const expenseId = expenseRes.rows[0].id;
    console.log(`Expense Created with ID: ${expenseId}`);
    let normalizedSplits = [];

    /**
     * SPLIT LOGIC (ONLY PRODUCES amount_owed)
     */
    if (split_type === 'EQUAL') {
      if (!participants || participants.length === 0) {
        throw new Error('Participants required for equal split');
      }

      const share = Number((total_amount / participants.length).toFixed(2));
      const distributed = share * participants.length;

      if (Math.abs(distributed - total_amount) > 0.01) {
        throw new Error('Equal split causes rounding imbalance');
      }

      for (const uid of participants) {
        if (!validMembers.includes(Number(uid))) {
          throw new Error(`User ${uid} not valid at expense time`);
        }
        normalizedSplits.push({ userId: Number(uid), amount: share });
      }
    }

    else if (split_type === 'EXACT') {
      let sum = 0;
      for (const uid in splits) {
        sum += Number(splits[uid]);
      }
      if (Math.abs(sum - total_amount) > 0.01) {
        throw new Error('Exact split does not match total');
      }

      for (const uid in splits) {
        if (!validMembers.includes(Number(uid))) {
          throw new Error(`User ${uid} not valid at expense time`);
        }
        normalizedSplits.push({ userId: Number(uid), amount: Number(splits[uid]) });
      }
    }

    else if (split_type === 'PERCENT') {
      let percentSum = 0;
      for (const uid in splits) {
        percentSum += Number(splits[uid]);
      }

      if (Math.abs(percentSum - 100) > 0.001) {
        throw new Error('Percent split must total 100');
      }

      for (const uid in splits) {
        if (!validMembers.includes(Number(uid))) {
          throw new Error(`User ${uid} not valid at expense time`);
        }
        const amount = Number(((splits[uid] / 100) * total_amount).toFixed(2));
        normalizedSplits.push({ userId: Number(uid), amount });
      }
    }

    else {
      throw new Error('Invalid split type');
    }

    /**
     * STORE SPLITS (IMMUTABLE FACTS) & LEDGER GENERATION (CORE TRUTH)
     */
    console.log("Normalized Splits to process:", normalizedSplits);
    const paidByNum = Number(paid_by);
    
    for (const s of normalizedSplits) {
      // Insert Split
      await db.query(
        `
        INSERT INTO expense_splits (expense_id, user_id, amount_owed)
        VALUES ($1, $2, $3)
        `,
        [expenseId, s.userId, s.amount]
      );

      // LEDGER LOGIC - Insert ledger entry if user is not the payer
      console.log(`Checking Ledger for User ${s.userId} vs Payer ${paidByNum}, Amount: ${s.amount}`);
      
      if (s.userId !== paidByNum && s.amount > 0) {
        console.log(`>> INSERTING LEDGER: ${s.userId} owes ${paidByNum} amount ${s.amount}`);
        await createLedgerEntry({
          groupId: groupId,
          fromUser: s.userId,
          toUser: paidByNum,
          amount: s.amount,
          expenseId: expenseId,
          sourceType: 'EXPENSE',
          sourceId: expenseId
        });
      } else {
        console.log(`>> SKIPPED LEDGER: User is payer or amount is 0`);
      }
    }

    await db.query('COMMIT');
    console.log("--- Transaction Committed Successfully ---");
    res.status(201).json({ message: 'Expense recorded successfully', expenseId });

  } catch (err) {
    await db.query('ROLLBACK');
    console.error("ERROR DURING EXPENSE:", err.message);
    res.status(400).json({ error: err.message });
  }
};

/**
 * GET BALANCES (LEDGER ONLY)
 */
exports.getBalances = async (req, res) => {
  const { groupId } = req.params;

  try {
    const query = `
      SELECT
        u.id AS user_id,
        u.name,

        COALESCE(SUM(
          CASE WHEN l.to_user = u.id THEN l.amount ELSE 0 END
        ), 0) AS total_gets,

        COALESCE(SUM(
          CASE WHEN l.from_user = u.id THEN l.amount ELSE 0 END
        ), 0) AS total_owes

      FROM users u
      JOIN group_members gm ON gm.user_id = u.id
      LEFT JOIN ledger_entries l
        ON l.group_id = gm.group_id
       AND (l.from_user = u.id OR l.to_user = u.id)

      WHERE gm.group_id = $1
      GROUP BY u.id, u.name
      ORDER BY u.name;
    `;

    const { rows } = await db.query(query, [groupId]);

    const balances = rows.map(r => {
      const gets = Number(r.total_gets);
      const owes = Number(r.total_owes);
      return {
        user_id: r.user_id,
        name: r.name,
        total_gets: gets.toFixed(2),
        total_owes: owes.toFixed(2),
        net_balance: (gets - owes).toFixed(2)
      };
    });

    // Invariant check
    const sum = balances.reduce((s, b) => s + Number(b.net_balance), 0);
    if (Math.abs(sum) > 0.01) {
      console.error('❌ Ledger invariant broken:', sum);
    }

    res.json({ groupId, balances });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Balance computation failed' });
  }
};


/**
 * GET GROUP EXPENSES
 */
exports.getGroupExpenses = async (req, res) => {
  const { groupId } = req.params;

  try {
    const query = `
      SELECT e.*, u.name as payer_name 
      FROM expenses e
      JOIN users u ON e.paid_by = u.id
      WHERE e.group_id = $1
      ORDER BY e.created_at DESC;
    `;
    const result = await db.query(query, [groupId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch expenses" });
  }
};


exports.getSimplifiedBalances = async (req, res) => {
  const { groupId } = req.params;

  try {
    // 1. Validate group exists
    const groupCheck = await db.query(
      'SELECT id, name FROM groups WHERE id = $1',
      [groupId]
    );

    if (groupCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // 2. Compute derived balances (Milestone 5)
    const balances = await getGroupBalances(groupId);

    // Invariant check (optional but senior-level)
    const total = balances.reduce((sum, b) => sum + b.net_balance, 0);
    if (Math.abs(total) > 0.01) {
      return res.status(500).json({
        error: 'Balance invariant violated',
        total
      });
    }

    // 3. Simplify balances (Milestone 6)
    const simplified = simplifyBalances(balances);

    return res.json({
      groupId,
      groupName: groupCheck.rows[0].name,
      simplified_settlements: simplified
    });

  } catch (err) {
    console.error('Simplification Error:', err);
    res.status(500).json({ error: 'Failed to simplify balances' });
  }
};

exports.getGroupDashboard = async (req, res) => {
  const { groupId } = req.params;

  try {
    // 1. Fetch Group Info
    const groupRes = await db.query(
      'SELECT id, name, created_at FROM groups WHERE id = $1', 
      [groupId]
    );
    if (groupRes.rowCount === 0) return res.status(404).json({ error: "Group not found" });

    // 2. Fetch Recent Expenses (Limit to last 5)
    const expensesRes = await db.query(
      `SELECT e.*, u.name as payer_name 
       FROM expenses e 
       JOIN users u ON e.paid_by = u.id 
       WHERE e.group_id = $1 
       ORDER BY e.created_at DESC LIMIT 5`,
      [groupId]
    );

    // 3. Fetch Balances & Simplify (Milestone 5 & 6)
    const netBalances = await getGroupBalances(groupId);
    const simplified = simplifyBalances(netBalances);

    // 4. Combine everything
    res.json({
      group: groupRes.rows[0],
      recent_expenses: expensesRes.rows,
      my_balances: netBalances.map(b => ({
        name: b.name,
        amount: b.net_balance.toFixed(2)
      })),
      suggested_settlements: simplified
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
};


