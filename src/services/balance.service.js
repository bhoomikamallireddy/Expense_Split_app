const db = require('../db');

async function getGroupBalances(groupId) {
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
    ORDER BY u.id;
  `;

  const { rows } = await db.query(query, [groupId]);

  return rows.map(r => ({
    user_id: r.user_id,
    name: r.name,
    net_balance: Number(r.total_gets) - Number(r.total_owes)
  }));
}

module.exports = { getGroupBalances };
