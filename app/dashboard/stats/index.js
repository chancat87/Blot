const express = require("express");
const Stats = new express.Router();
const { admin, blot_directory } = require("config");
const fs = require("fs-extra");

// Ensure that only the admin can access this
Stats.use((req, res, next) => {
  if (!req.user || req.user.uid !== admin.uid) {
    return next(new Error("You are not authorized to access this page"));
  }

  next();
});

Stats.get("/stats.json", async (req, res) => {
  // data is stored JSON files in stats_directory with names in format YYYY-MM-DD-HH-MM.json
  // the query string 'range' can equal either 'hour', 'day', or 'week'
  // and will return the most recent data from all the JSON files, merged into one object
  const range = req.query.range || "hour";
  const server = req.query.server || "node";
  const stats_directory = blot_directory + "/tmp/stats/" + server;

  const number_of_files = range === "hour" ? 1 : range === "day" ? 24 : 168;

  // Get the most recent files
  const files = await fs.readdir(stats_directory);
  const most_recent_files = files
    .filter(file => file.indexOf(".json") > -1)
    .sort()
    // we fetch an extra file to ensure we have enough data if the hour just rolled over
    .slice(-1 * (number_of_files + 1));

  // Read the files
  const data = await Promise.all(
    most_recent_files.map(file => fs.readJson(stats_directory + "/" + file))
  );

  console.log("fetching files", most_recent_files);

  // The files are all arrays of objects for each minute, merge them into one array
  // then sort the array of objects by their date property, most recent first
  const merged = data.reduce((acc, file) => acc.concat(file), []);

  merged.sort((a, b) => {
    if (a.date > b.date) return -1;
    if (a.date < b.date) return 1;
    return 0;
  });

  // then trim the array to the number of minutes we want, most recent first
  const trimmed = merged.slice(0, number_of_files);

  res.json(trimmed);
});

Stats.get("/", (req, res) => {
  res.render("stats");
});

module.exports = Stats;
