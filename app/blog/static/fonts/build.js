const fs = require("fs-extra");
const directory = __dirname + "/" + process.argv[2];
const basename = require("path").basename;
const extname = require("path").extname;
const colors = require("colors");
const EXTENSIONS = [".eot", ".woff2", ".woff", ".ttf", ".otf"];
const relative = require("path").relative;

const SYSTEM_FONTS = [
	"verdana",
	"arial",
	"helvetica",
	"system-sans",
	"system-mono",
	"system-serif",
];

const FORMATS = {
	".ttf": "truetype",
	".otf": "opentype",
	".woff": "woff",
	".woff2": "woff2",
};

const WEIGHTS = {
	thin: 200,
	extralight: 200,
	light: 300,
	roman: 400,
	regular: 400,
	book: 400,
	text: 400,
	medium: 500,
	semibold: 500,
	bold: 600,
	heavy: 700,
	black: 900,
};

if (!process.argv[2]) return printCandidates();

generatePackage(directory);

generateStyle(directory);

function generatePackage(directory) {
	const packagePath = directory + "/package.json";

	if (!fs.existsSync(packagePath))
		fs.outputJsonSync(packagePath, {}, { spaces: 2 });

	let package = fs.readJsonSync(packagePath);

	// Will map cooper-hewitt -> Cooper Hewitt
	if (!package.name)
		package.name = basename(directory)
			.split("-")
			.join(" ")
			.split(" ")
			.map((w) => w[0].toUpperCase() + w.slice(1))
			.join(" ");

	if (!package.stack) package.stack = `'${package.name}'`;

	if (!package.line_height) package.line_height = 1.4;

	fs.outputJsonSync(packagePath, package, { spaces: 2 });
}

function generateStyle(directory) {
	const stylePath = directory + "/style.css";
	const package = fs.readJsonSync(directory + "/package.json");

	const fontFiles = fs
		.readdirSync(directory)
		.filter((i) => EXTENSIONS.indexOf(extname(i)) > -1);

	let family = {};

	fontFiles.forEach((file) => {
		let extension = extname(file);
		let nameWithoutExtension = file.slice(0, -extension.length);

		if (family[nameWithoutExtension]) {
			family[nameWithoutExtension].extensions.push(extname(file));
			return;
		}

		let style =
			nameWithoutExtension.indexOf("italic") > -1 ||
			nameWithoutExtension.indexOf("oblique") > -1
				? "italic"
				: "normal";

		let weight;

		let nameWithoutExtensionAndStyle = nameWithoutExtension
			.split("italic")
			.join("")
			.split("oblique")
			.join("")
			.split("-")
			.join("")
			.trim();

		if (
			(nameWithoutExtension === "italic" ||
				nameWithoutExtension === "oblique") &&
			!nameWithoutExtensionAndStyle
		) {
			nameWithoutExtensionAndStyle = "regular";
		}
		if (
			parseInt(nameWithoutExtensionAndStyle).toString() ===
			nameWithoutExtensionAndStyle
		) {
			weight = parseInt(nameWithoutExtensionAndStyle);
		} else if (WEIGHTS[nameWithoutExtensionAndStyle]) {
			weight = WEIGHTS[nameWithoutExtensionAndStyle];
		} else {
			console.error("");
			console.error(
				colors.red("Unable to parse weight:", nameWithoutExtensionAndStyle)
			);
			console.error(relative(process.cwd(), directory + "/" + file));
		}

		family[nameWithoutExtension] = {
			style,
			weight,
			extensions: [extname(file)],
		};
	});

	let result = "";

	for (let file in family) {
		let name = package.name;
		let style = family[file].style;
		let weight = family[file].weight;
		let extensions = family[file].extensions;
		const base = "/fonts/" + basename(directory);
		let src;
		const extensionList = `${EXTENSIONS.filter(
			(EXTENSION) => EXTENSION !== ".eot" && extensions.indexOf(EXTENSION) > -1
		)
			.map(
				(extension) =>
					`url('${base}/${file}${extension}') format('${FORMATS[extension]}')`
			)
			.join(",\n       ")}`;

		if (extensions.indexOf(".eot") > -1) {
			src = `src: url('${base}/${file}.eot'); 
  src: url('${base}/${file}.eot?#iefix') format('embedded-opentype'), 
       ${extensionList};`;
		} else {
			src = `src: ${extensionList};`;
		}

		const template = `

@font-face {
  font-family: '${name}';
  font-style: ${style};
  font-weight: ${weight};
  ${src}
}
		`;

		result += template;
	}

	console.log();
	console.log(package.name);
	for (let w = 100; w <= 900; w += 100) {
		let hasWRegular =
			Object.keys(family).filter((name) => {
				return family[name].weight === w && family[name].style === "normal";
			}).length > 0;
		let hasWItalic =
			Object.keys(family).filter((name) => {
				return family[name].weight === w && family[name].style === "italic";
			}).length > 0;
		console.log(
			`${
				hasWRegular || hasWItalic
					? colors.green(w.toString())
					: colors.dim(w.toString())
			} ${hasWRegular ? colors.green("regular") : colors.dim("regular")} ${
				hasWItalic ? colors.green("italic") : colors.dim("italic")
			}`
		);
	}
	console.log();
	console.log(colors.dim("folder: ", relative(process.cwd(), directory)));
	console.log(
		colors.dim("package:", relative(process.cwd(), directory + "/package.json"))
	);
	console.log(
		colors.dim("styles: ", relative(process.cwd(), directory + "/style.css"))
	);
	fs.outputFileSync(stylePath, result);
}

function printCandidates() {
	let directories = fs
		.readdirSync(__dirname)

		// Ignore dot folders and folders whose name
		// starts with a dash
		.filter((i) => i[0] && i[0] !== "." && i[0] !== "-")
		.filter((i) => fs.statSync(`${__dirname}/${i}`).isDirectory())
		.filter((i) => {
			return (
				!fs.existsSync(`${__dirname}/${i}/package.json`) ||
				(!fs.existsSync(`${__dirname}/${i}/style.css`) &&
					SYSTEM_FONTS.indexOf(i) === -1)
			);
		});

	directories.forEach((directory) =>
		console.log(`node app/blog/static/fonts/build ${directory}`)
	);
}
