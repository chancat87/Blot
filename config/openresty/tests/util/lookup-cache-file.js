const fs = require("fs-extra");
const fetch = require("node-fetch");
const main = async cache_key_hash => {
  const cache_directory = "/var/www/cache";
  // the cache file path is in the following format: $x/$y/$cache_key_hash
  // where x is the last character of the cache_key_hash
  // and y are the two characters before x
  const cache_file_path = `${cache_directory}/${
    cache_key_hash[cache_key_hash.length - 1]
  }/${cache_key_hash.slice(-3, -1)}/${cache_key_hash}`;

  const stream = fs.createReadStream(cache_file_path, { encoding: "utf8" });
  let data = "";
  for await (const chunk of stream) {
    data += chunk;
    if (data.length > 1024 * 1024) break;
    // if data includes a blank line, break
    if (data.includes("\n\n")) break;
  }
  const host_line = data.split("\n").find(line => line.includes("KEY: "));
  const uri = host_line.split("KEY: ")[1];

  console.log("URI", uri);
  console.log("DATA");
  console.log(data);

  // we fetch the uri and check the response headers for 'Blot-Cache' which will be HIT or MISS
  const response = await fetch(uri);
  const cache_status = response.headers.get("Blot-Cache");
  console.log("cache_status", cache_status);
};

module.exports = main;

if (require.main === module) {
  main(process.argv[2]);
}
