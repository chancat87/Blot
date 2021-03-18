const Express = require("express");
const redirector = new Express.Router();

const internal = {
  "/notes": "/about/notes",
  "/news": "/about/news",
  "/help": "/how",
  "/about/contact": "/support",
  "/updates": "/about/news",
  "/source": "/about/source-code",
  "/metadata": "/how/metadata",
  "/404s": "/how/configure/redirects",
  "/howto": "/how",
  "/how/templates": "/templates",
  "/how/dates": "/how/metadata",
  "/developers/documentation": "/templates/developers",
  "/how/publishing-with-blot": "/how",
  "/how/configuring": "/how/configure",
  "/how/formatting": "/how/guides",
  "/how/drafts": "/how",
  "/formatting": "/how/guides",
  "/redirects": "/how/configure/redirects",
  "/configuring": "/how/configure",
};

const external = {
  "/typeset": "https://typeset.lllllllllllllllll.com/",
};

Object.keys(internal).forEach((from) => {
  redirector.use(from, function (req, res) {
    let to = internal[from];
    let redirect = req.originalUrl.replace(from, to);
    res.redirect(redirect);
  });
});

Object.keys(external).forEach((from) => {
  redirector.use(from, function (req, res) {
    res.redirect(external[from]);
  });
});

module.exports = redirector;
