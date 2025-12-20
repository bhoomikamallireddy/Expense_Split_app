const { Pool } = require('pg');


const pool = new Pool({
  user: 'postgres',
  host: '172.23.144.1',
  database: 'expense_sharing',
  password: 'bhoomika*26', 
  port: 5432,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};