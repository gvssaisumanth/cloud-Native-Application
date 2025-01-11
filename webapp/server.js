const express = require("express");
const healthzRoutes = require("./routes/healthz");
const assignmentsRoutes = require("./routes/assignmentsRoutes");

const app = express();
const PORT = 3000;

//Calling data base and creating tables
const databaseService = require("./services/databaseService");

databaseService
  .authenticateDatabase()
  .then(() => {
    console.log("Database authenticated successfully!");
  })
  .catch((error) => {
    console.error("Error authenticating database:", error);
  });

app.use(healthzRoutes);

app.use(assignmentsRoutes);

app.all("*", (req, res) => {
  return res.status(404).end();
});

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});

module.exports = app;
