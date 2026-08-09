// Static file server for the CarpoolX frontend pages.
//
// Auth used to be faked here with better-sqlite3 + bcrypt (a local,
// throwaway user table). That's gone now - real accounts, JWT tokens, and
// password hashing all live in Backend/ (MongoDB). This file just serves
// the HTML/CSS/JS pages; login.html talks to the Backend API directly via
// api-client.js.
const express = require('express');
const path = require('path');

const app = express();
const parsedPort = parseInt(process.env.PORT, 10);
const PORT = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 5500;
const rootDir = __dirname;

app.use(express.static(rootDir));

app.get('/', (req, res) => {
  res.sendFile(path.join(rootDir, 'login.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend static server running at http://localhost:${PORT}`);
});
