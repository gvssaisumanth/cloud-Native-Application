const express = require("express");
const { authenticateDatabase } = require("../services/databaseService");
const logger = require("../utilities/logWriter");
const client = require("../utilities/stasd");
const router = express.Router();

router.get("/healthz", (req, res) => {
  if (Object.keys(req.query).length > 0 || req.headers["content-length"] > 0) {
    return res.status(400).end();
  }

  authenticateDatabase()
    .then(() => {
      client.increment("GET.healthz");
      res.status(200).set("Cache-Control", "no-cache").end();
      logger.info("Called the healthz endpoint.");
    })
    .catch((error) => {
      res.status(503).set("Cache-Control", "no-cache").end();
      logger.info("Failed at healthz endpoint.");
    });
});
module.exports = router;
