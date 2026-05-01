// NOTE: requires the 'dotenv' package to be installed (`npm install dotenv`)
require('dotenv').config();

const express = require('express');
const app = express();

// H-1, H-2: Credentials sourced from environment variables — never hardcoded
const DB_PASSWORD = process.env.DB_PASSWORD; // eslint-disable-line no-unused-vars
const API_KEY = process.env.API_KEY;         // eslint-disable-line no-unused-vars

// L-2: Body parser with a 10 kb size limit to prevent payload-based DoS
app.use(express.json({ limit: '10kb' }));

// Parameterized-query stub — replace `db` with your real database client (e.g. pg, mysql2)
// The stub below mirrors the calling convention so the safe pattern is visible at runtime.
const db = {
  query: async (text, params) => {
    // Stub: replace this body with your real db.query call
    return { rows: [{ id: params[0], note: 'stub result' }] };
  },
};

// fetchData stub — import from './services/dataService' once that module exists,
// e.g.: const { fetchData } = require('./services/dataService');
async function fetchData() {
  // Stub: replace with real data-fetching logic
  return { message: 'stub data' };
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// M-1: Validate userId; C-1/C-2: parameterized query, return rows not raw SQL
app.get('/users', async (req, res, next) => {
  const userId = parseInt(req.query.id, 10);

  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid or missing id parameter — must be an integer.' });
  }

  try {
    // C-1: Parameterized query prevents SQL injection
    const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    // C-2: Return query result rows, never the raw SQL string
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// H-3: async route wrapped in try/catch; errors forwarded to global handler via next(err)
app.get('/data', async (req, res, next) => {
  try {
    const data = await fetchData();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// L-1: unusedHelper removed (dead code)

// M-2: Global error-handling middleware — must be registered with 4 parameters
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// M-3: Explicit bind address; magic number replaced with PORT constant
const PORT = process.env.PORT || 3000;

// Guard so the server only starts when this file is run directly, not when imported in tests
if (require.main === module) {
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
