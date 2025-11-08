// utils/leadAssignment.js
const { myapp, dhanDB } = require("../config/db")

async function getNextMainRm() {
  // Step 1: Check last assigned pointer
  const [pointer] = await myapp.execute(`
    SELECT last_assigned_rm_id 
    FROM lead_assign_pointer 
    WHERE id = 1
  `);

  const lastId = pointer[0]?.last_assigned_rm_id || 0;

  // Step 2: Find next RM
  let [next] = await myapp.execute(`
    SELECT id 
    FROM rm 
    WHERE role='mainRm' AND is_active=1 
      AND id > ?
    ORDER BY id ASC 
    LIMIT 1
  `, [lastId]);

  // Step 3: If none, restart from first
  if (next.length === 0) {
    [next] = await myapp.execute(`
      SELECT id 
      FROM rm 
      WHERE role='mainRm' AND is_active=1
      ORDER BY id ASC
      LIMIT 1
    `);
  }

  const nextRmId = next[0].id;

  // Step 4: Update pointer
  await myapp.execute(`
    UPDATE lead_assign_pointer 
    SET last_assigned_rm_id = ? 
    WHERE id = 1
  `, [nextRmId]);

  return nextRmId;
}

module.exports = { getNextMainRm };
