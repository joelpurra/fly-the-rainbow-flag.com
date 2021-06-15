const bunyan = require("bunyan");
const configuration = require("./configuration");

const bunyanConfig = {
	name: "ftrf-web",

	// TODO: make level logging an option.
	// level: "error",
	// TODO: make src logging an option, disabled in production.
	// src: true,
	// TODO: streams should be a part of per-app configuration.
	streams: [
		//
		// Should stderr output be on as well?
		// {
		//     type: "stream",
		//     level: "error",
		//     stream: process.stderr
		// },
		//
		{
			level: configuration.loggingLevel,
			stream: process.stdout,
			type: "stream",
		},
		//
		// {
		//     type: "rotating-file",
		//     // TODO: use path from configuration so that there's one log path per app.
		//     path: "ftrf-web.log",
		//     // Daily rotation.
		//     period: "1d",
		//     // Keep three files.
		//     count: 3,
		//     level: "trace",
		// },
		//
	],
};

const logger = bunyan.createLogger(bunyanConfig);

module.exports = logger;
