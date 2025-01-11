const statsd = require("node-statsd");

const client = new statsd({
  host: "localhost",
  port: 8125,
  prefix: "api.calls.",
});
module.exports = client;
