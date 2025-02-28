var config = require("config");
var Express = require("express");
var helmet = require("helmet");
var vhost = require("vhost");
var blog = require("blog");
var site = require("site");
var trace = require("helper/trace");
var clfdate = require("helper/clfdate");

// const { PerformanceObserver } = require('perf_hooks');

// // 1. GC Observer
// const obs = new PerformanceObserver((list) => {
//   list.getEntries().forEach((entry) => {
//     // Get memory usage details
//     const memoryUsage = process.memoryUsage();
//     const heapUsedMB = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
//     const heapTotalMB = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);

//     // Log GC event and heap size
//     console.log(
//       `${clfdate()} [GC] kind=${entry.kind}, duration=${entry.duration}ms, ` +
//       `heapUsed=${heapUsedMB}MB, heapTotal=${heapTotalMB}MB`
//     );
//   });
// });
// obs.observe({ entryTypes: ['gc'], buffered: true });

// // 2. Event-Loop Lag Measurement
// // We'll measure the delay in setInterval to gauge how behind the event loop is.
// const CHECK_INTERVAL_MS = 1000; // How frequently to check in ms
// let lastCheck = process.hrtime.bigint();

// setInterval(() => {
//   const now = process.hrtime.bigint();
//   // Convert nanoseconds to milliseconds, then see how far we deviated from 1000 ms
//   const diffMs = (Number(now - lastCheck) / 1e6) - CHECK_INTERVAL_MS;

//   // Get memory usage details
//   const memoryUsage = process.memoryUsage();
//   const heapUsedMB = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
//   const heapTotalMB = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);

//   // Log event loop lag and heap size
//   console.log(
//     `${clfdate()} [LoopLag] ${diffMs.toFixed(2)}ms, ` +
//     `heapUsed=${heapUsedMB}MB, heapTotal=${heapTotalMB}MB`
//   );

//   lastCheck = now;
// }, CHECK_INTERVAL_MS);




// Welcome to Blot. This is the Express application which listens on port 8080.
// NGINX listens on port 80 in front of Express app and proxies requests to
// port 8080. NGINX handles SSL termination, cached response delivery and
// compression. See ../config/nginx for more. Blot does the rest.
var server = Express();

server.set("etag", false); // turn off etags for responses

// Removes a header otherwise added by Express. No wasted bytes
server.disable("x-powered-by");

console.log(
  clfdate(),
  "Starting server on port",
  config.port,
  "host",
  config.host
);

// Trusts secure requests terminated by NGINX, as far as I know
server.set("trust proxy", true);

// Check if the database is healthy
server.get("/redis-health", function (req, res) {
  let redis = require("models/redis");
  let client = redis();

  // do not cache response
  res.set("Cache-Control", "no-store");

  client.ping(function (err, reply) {
    if (err) {
      res.status(500).send("Failed to ping redis");
    } else {
      res.send("OK");
    }

    client.quit();
  });
});

// Prevent <iframes> embedding pages served by Blot
server.use(helmet.frameguard("allow-from", config.host));

// Log response time in development mode
server.use(trace.init);

server.use(require('./request-logger'));

// Blot is composed of two sub applications.

// The Site
// -------------
// Serve the dashboard and public site (the documentation)
// Webhooks from Dropbox and Stripe, git pushes are
// served by these two applications. The dashboard can
// only ever be served for request to the host
server.use(vhost(config.host, site));

// The Webhook forwarder
// -------------
// Forwards webhooks to development environment
if (config.webhooks.server_host && process.env.CONTAINER_NAME === "blot-container-green") {
  console.log(clfdate(), "Webhooks relay on", config.webhooks.server_host);
  server.use(vhost(config.webhooks.server_host, require("./clients/webhooks")));
}

console.log(clfdate(), "Setting up CDN on", "cdn." + config.host);
// CDN server
server.use(vhost("cdn." + config.host, require("./cdn")));

// The Blogs
// ---------
// Serves the customers's blogs. It should come first because it's the
// most important. We don't know the hosts for all the blogs in
// advance so all requests hit this middleware.
server.use(blog);

// Monit, which we use to monitor the server's health, requests
// localhost/health to see if it should attempt to restart Blot.
// If you remove this, change monit.rc too.
server.get("/health", function (req, res) {
  // do not cache response
  res.set("Cache-Control", "no-store");
  res.send("OK");
});

module.exports = server;
