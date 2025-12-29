const db = require('../db');

exports.isUserInGroup = async (groupId, userId) => {
  const res = await db.query(
    'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND left_at IS NULL',
    [groupId, userId]
  );
  return res.rowCount > 0;
};