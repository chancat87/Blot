// docker exec -it blot-node-app-1 node scripts/dropbox/reset.js
const { promisify } = require("util");
const lowerCaseContents = require("sync/lowerCaseContents");
const get = require("../get/blog");
const each = require("../each/blog");
const getConfirmation = require("../util/getConfirmation");
const Sync = require("sync");
const fs = require("fs-extra");

const alreadyProcessed = [];
const processedFile = __dirname + "/data/processed.json";

try {
  const json = JSON.parse(fs.readFileSync(processedFile, "utf8"));
  json.forEach((blogID) => {
    alreadyProcessed.push(blogID);
  });
  console.log("Already processed blogs", alreadyProcessed.join(", "));
} catch (e) {
  console.log("No processed.json file found");
}

const addBlogIDToProcessed = (blogID) => {
  let json = [];

  try {
    json = JSON.parse(fs.readFileSync(processedFile, "utf8"));
  } catch (e) {}

  if (!json.includes(blogID)) json.push(blogID);

  fs.outputFileSync(processedFile, JSON.stringify(json, null, 2));
};

const main = async (blogID) => {
  try {
    console.log();
    const { folder, done } = await establishSyncLock(blogID);
    folder.status("Restoring case of folder contents");
    await lowerCaseContents(blogID, { restore: true });
    folder.status("Case of folder contents restored");
    await done();
  } catch (e) {
    console.log("Error resetting blog", blogID, e);
  }
};

if (process.argv[2] && process.argv[2] !== "-r") {
  get(process.argv[2], async function (err, user, blog) {
    if (err) throw err;

    if (!blog || blog.isDisabled) throw new Error("Blog not found or disabled");

    if (blog.client !== "dropbox") throw new Error("Blog is not using Dropbox");

    await main(blog.id);

    process.exit();
  });
} else {
  const blogIDsToReset = [];
  each(
    (user, blog, next) => {
      if (!blog || blog.isDisabled) return next();
      if (blog.client !== "dropbox") return next();
      if (alreadyProcessed.includes(blog.id)) return next();
      blogIDsToReset.push(blog.id);
      next();
    },
    async (err) => {
      if (err) throw err;

      if (!blogIDsToReset.length) {
        console.log("No blogs to reset!");
        process.exit();
      }

      console.log(
        "Blogs to restore the case of items in the folders: ",
        blogIDsToReset.length
      );

      const confirmed = await getConfirmation(
        "Are you sure you want to restore the case of items in the folders of all these blogs?"
      );

      if (!confirmed) {
        console.log("Reset cancelled!");
        process.exit();
      }

      // if one of the arguments to this script is '-r', then
      // shuffle the order of the blogs to reset so we can run
      // this script in parallel on multiple servers
      if (process.argv.includes("-r")) {
        console.log("Shuffling the order of the blogs to reset");
        blogIDsToReset.sort(() => Math.random() - 0.5);
      } else {
        console.log("Sorting the order of the blogs to reset");
        blogIDsToReset.sort();
      }

      for (let i = 0; i < blogIDsToReset.length; i++) {
        const blogID = blogIDsToReset[i];
        console.log();
        console.log(i + 1 + " of " + blogIDsToReset.length, blogID);
        await main(blogID);
        addBlogIDToProcessed(blogID);
      }

      console.log("All blogs reset!");
      process.exit();
    }
  );
}

function establishSyncLock(blogID) {
  return new Promise((resolve, reject) => {
    Sync(blogID, function check(err, folder, done) {
      if (err) return reject(err);
      folder.update = promisify(folder.update);
      // I don't quite understand this
      const doneAsync = async function (err) {
        if (err) {
          await promisify(done.bind(null, err))();
        } else {
          await promisify(done.bind(null, null))();
        }
      };
      resolve({ folder, done: doneAsync });
    });
  });
}
