const { myapp, dhanDB } = require('./config/db');

(async () => {
  try {
    await dhanDB.query('SELECT 1');
    console.log('Connected to dhanDB ✅');
  } catch (err) {
    console.error('dhanDB connection failed ❌', err);
  }

  try {
    await myapp.query('SELECT 1');
    console.log('Connected to myapp ✅');
  } catch (err) {
    console.error('myapp connection failed ❌', err);
  }
})();

