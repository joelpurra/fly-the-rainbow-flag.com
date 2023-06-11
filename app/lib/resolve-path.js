import path from "node:path";
import {
	fileURLToPath,
} from "node:url";

// HACK: using is __filename/__dirname is deprecated and should be replaced.
//const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// TODO: use a library.
export const resolvePath = (...args) => {
	const parts = [
		__dirname,
		...args,
	];

	return path.resolve(...parts);
};

const relativePathToRootFromThisFile = "../..";

export const resolvePathFromProjectRoot = (...args) => {
	const parts = [
		relativePathToRootFromThisFile,
		...args,
	];

	return resolvePath(...parts);
};
