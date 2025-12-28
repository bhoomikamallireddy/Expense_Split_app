/**
 * Input:
 * [
 *   { user_id: 1, net_balance: 200 },
 *   { user_id: 2, net_balance: -100 },
 *   { user_id: 3, net_balance: -100 }
 * ]
 *
 * Output:
 * [
 *   { from: 2, to: 1, amount: 100 },
 *   { from: 3, to: 1, amount: 100 }
 * ]
 */

function simplifyBalances(balances) {
  const creditors = [];
  const debtors = [];

  // STEP 6.1 — Split users
  for (const b of balances) {
    const amount = Number(b.net_balance);
    if (amount > 0) {
      creditors.push({ user_id: b.user_id, amount });
    } else if (amount < 0) {
      debtors.push({ user_id: b.user_id, amount: Math.abs(amount) });
    }
  }

  const simplifiedTransactions = [];
  let i = 0;
  let j = 0;

  // STEP 6.2 — Greedy two-pointer matching
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const payAmount = Math.min(debtor.amount, creditor.amount);

    simplifiedTransactions.push({
      from: debtor.user_id,
      to: creditor.user_id,
      amount: Number(payAmount.toFixed(2))
    });

    debtor.amount -= payAmount;
    creditor.amount -= payAmount;

    if (debtor.amount === 0) i++;
    if (creditor.amount === 0) j++;
  }

  return simplifiedTransactions;
}

module.exports = simplifyBalances;
