var get = require("./get");
var Entries = require('../../app/models/entries');
var Entry = require('../../app/models/entry');

if (require.main === module) {
  get(process.argv[2], function(user, blog) {
    main(blog, function(err) {
      if (err) throw err;
      process.exit();
    });
  });
}

function main(blog, callback) {
  console.log('Blog ' + blog.id + ':', 'Rebuilding entries...');
  Entries.each(
    blog.id,
    function(_entry, next) {
      console.log('-', _entry.path);      
      Entry.build(blog, _entry.path, function(err, entry){

        if (err) {
          console.log(err, 'deleted?', _entry.deleted);
          return next();
        }

        Entry.set(blog.id, entry.path, entry, next);
      });
    },
    function(err){
      if (err) return callback(err);
      console.log('Blog ' + blog.id + ':', 'Rebuilt all entries!');
      callback();
    }
  );
}

module.exports = main;
