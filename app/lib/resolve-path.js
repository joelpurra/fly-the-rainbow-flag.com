const path = require("node:path");

// TODO: use a library.
const resolvePath = (...args) => {
	const parts = [
		__dirname,
		...args,
	];

	return path.resolve(...parts);
};

const relativePathToRootFromThisFile = "../..";

const resolvePathFromProjectRoot = (...args) => {
	const parts = [
		relativePathToRootFromThisFile,
		...args,
	];

	return resolvePath(...parts);
};

module.exports = {
	resolvePath,
	resolvePathFromProjectRoot,
};

