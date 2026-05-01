const express = require('express');
const app = express();

// Hardcoded credentials (bad practice)
const DB_PASSWORD = "supersecret123";
const API_KEY = "sk-abc123xyz";

app.get('/users', (req, res) => {
  // No input validation
  const userId = req.query.id;
  const query = `SELECT * FROM users WHERE id = ${userId}`; // SQL injection risk
  res.send(query);
});

app.get('/data', async (req, res) => {
  // Missing error handling
  const data = await fetchData();
  res.json(data);
});

// Unused function
function unusedHelper(x, y, z, a, b, c) {
  return x + y;
}

app.listen(3000);
