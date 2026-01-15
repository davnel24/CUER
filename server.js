const express = require('express');
const path = require('path');
const app = express();
app.use(express.json());

const tables = {}; // simple in-memory storage

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

//Re-direct to UI
app.get("/", (req, res) => {
  res.redirect("/table/test-pub-1/ui");
});

// Serve table UI at /table/:id/ui
app.get("/table/:id/ui", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "table.html"));
});

// Join queue
app.post("/table/:id/join", (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });

  if (!tables[id]) tables[id] = { currentGame: null, queue: [] };
  const table = tables[id];

  // Prevent duplicates
  if (table.queue.includes(name) ||
      (table.currentGame && (table.currentGame.tableOwner === name || table.currentGame.player1 === name || table.currentGame.player2 === name))) {
    return res.status(400).json({ error: "Player already in table" });
  }
  // Add to queue temporarily
  table.queue.push(name);

  // Initialize tableOwner / player1 / player2
  if (!table.currentGame) {
    table.currentGame = {
      tableOwner: name,
      player1: name,
      player2: null,
      streak: 0
    };
    table.queue = table.queue.filter(n => n !== name);
  } else if (!table.currentGame.player2) {
    table.currentGame.player2 = name;
    table.queue = table.queue.filter(n => n !== name);
  }

  res.json(table);
});

// Declare win
app.post("/table/:id/win", (req, res) => {
  const { id } = req.params;
  const { winner: winningPlayer } = req.body;

  const table = tables[id];
  if (!table) return res.status(404).json({ error: "Table not found" });
  if (!table.currentGame || !table.currentGame.player2) {
  return res.status(400).json({ error: "No challenger playing" });
}
  if (!winningPlayer) return res.status(400).json({ error: "Winner name required" });

  if (!table.currentGame) return res.status(400).json({ error: "No current game" });

  const { tableOwner, player1, player2 } = table.currentGame;

  // Only current players can declare win
  if (winningPlayer !== player1 && winningPlayer !== player2) {
    return res.status(400).json({ error: "Only current players can declare a win" });
  }

  let loser;
if (winningPlayer === table.currentGame.tableOwner) {
  // Table Owner wins → increment streak
  table.currentGame.streak = (table.currentGame.streak || 0) + 1;
  loser = table.currentGame.player2;
  table.currentGame.player1 = table.currentGame.tableOwner;
  table.currentGame.player2 = table.queue.shift() || null;
} else {
  // Challenger wins → becomes new Table Owner → reset streak
  loser = table.currentGame.tableOwner;
  table.currentGame.tableOwner = winningPlayer;
  table.currentGame.player1 = winningPlayer;
  table.currentGame.player2 = table.queue.shift() || null;
  table.currentGame.streak = 1; // start streak for new owner
}
  // Loser removed completely (do not add back to queue)

  res.json(table);
});

// Get table state
app.get("/table/:id", (req, res) => {
  const table = tables[req.params.id];
  if (!table) return res.status(404).json({ error: "Table not found" });
  res.json(table);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
