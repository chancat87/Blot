var createClient = require("./util/createClient");
var retry = require("./util/retry");

// The goal of this function is to retrieve a list of changes made
// to the blog folder inside a user's Dropbox folder. We add a new
// property relative_path to each change. This property refers to
// the path the change relative to the folder for this blog.
module.exports = function delta(token, folderID) {
  var client = createClient(token);

  function get(cursor, callback) {
    var requests = [];
    var result = {};

    if (cursor) {
      // We pass in a tag which tells Dropbox what we know
      // to be the previous state of a user's folder
      // so we don't get everything every time...
      requests.push(client.filesListFolderContinue({ cursor: cursor }));
    } else {
      // Dropbox likes root as empty string,
      // so if there is no folder ID this is fine
      // We obviously want to know about removed files
      // We want to know about changes anywhere in the folder
      requests.push(
        client.filesListFolder({
          path: folderID,
          include_deleted: true,
          recursive: true
        })
      );
    }

    // folderID will be an empty string if the blog is set up as
    // root directory of the folder to which Blot has access.
    if (folderID) {
      // The reason we look up the metadata for the blog's folder
      // is to make sure we can filter the list of all changes to
      // only those made to the blog folder. We pass the ID instead
      // of the folder path because the user may rename the folder.
      requests.push(client.filesGetMetadata({ path: folderID }));
    }

    Promise.all(requests)
      .then(function(results) {
        result = results[0];

        if (results[1]) {
          result.path_display = results[1].path_display;
          result.path_lower = results[1].path_lower;
        }

        // Filter entries to only those changes applied
        // to the blog folder and compute the relative
        // path of each change inside the blog folder.
        if (result.path_display) {
          result.entries = result.entries
            .filter(function(entry) {
              return (
                entry.path_lower.indexOf(result.path_lower) === 0 &&
                entry.path_lower !== result.path_lower
              );
            })
            .map(function(entry) {
              entry.relative_path = entry.path_lower.slice(
                result.path_lower.length
              );
              return entry;
            });
        } else {
          result.entries = result.entries.map(function(entry) {
            entry.relative_path = entry.path_lower;
            return entry;
          });
        }

        callback(null, result);
      })
      .catch(function(err) {
        // Professional programmers wrote this SDK
        if (
          err.error &&
          err.error.error &&
          err.error.error[".tag"] === "reset"
        ) {
          cursor = "";
          return get(cursor, callback);
        }

        if (err.status === 409) {
          err = new Error("Blog folder was removed");
          err.code = "ENOENT";
          err.status = 409;
        } else {
          err = new Error("Failed to fetch delta from Dropbox");
        }

        callback(err, null);
      });
  }

  // We try to make this function more robust by retrying under
  // certain conditions, and adding a timeout to eachh attempt.
  // Only retry if the folder has not been moved
  return retry(get);
};
