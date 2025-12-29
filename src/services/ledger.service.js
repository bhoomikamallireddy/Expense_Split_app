/*const db = require('../db');

/**
 * Shared function to ensure no ledger entry is ever created without 
 * source_type and source_id.

async function createLedgerEntry({ groupId, fromUser, toUser, amount, expenseId = null, sourceType, sourceId }) {
  if (!sourceType || !sourceId) {
    throw new Error(`Financial Invariant Violated: Ledger entry requires source_type and source_id.`);
  }
  if (!groupId || !fromUser || !toUser || amount === undefined) {
    throw new Error(`Financial Invariant Violated: Missing core ledger participants or group data.`);
  }
  const numericAmount = Number(parseFloat(amount).toFixed(2));
  if (isNaN(numericAmount) || numericAmount <= 0) {
    // We skip zero or negative entries as they don't represent a debt flow
    return null; 
  }
  const query = `
    INSERT INTO ledger_entries (
      group_id, 
      from_user, 
      to_user, 
      amount, 
      expense_id, 
      source_type, 
      source_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id;
  `;

  const values = [groupId, fromUser, toUser, numericAmount, expenseId, sourceType, sourceId];
  return await db.query(query, values);
}

module.exports = { createLedgerEntry };*/

const db = require('../db');

exports.createLedgerEntry = async ({ 
  client = db, // Defaults to standard pool, but can accept a transaction client
  groupId, 
  fromUser, 
  toUser, 
  amount, 
  expenseId = null, 
  sourceType, 
  sourceId 
}) => {
  if (!sourceType || !sourceId) {
    throw new Error(`Financial Invariant Violated: Ledger entry requires source_type and source_id.`);
  }

  const query = `
    INSERT INTO ledger_entries (
      group_id, from_user, to_user, amount, expense_id, source_type, source_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
  `;

  const values = [groupId, fromUser, toUser, amount, expenseId, sourceType, sourceId];
  
  // Uses the passed transaction client if provided
  return await client.query(query, values);
};