import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import st from "st";

import handleUpload from "./handlers/handle-upload.js";
import {
	http as httpConfiguration,
	https as httpsConfiguration,
	siteRootRelativePath,
} from "./lib/configuration.js";
import configuredHttpsRedirect from "./lib/configured-https-redirect.js";
import {
	getS3BaseUrl,
	getS3Domain,
} from "./lib/get-s3-url.js";
import logger from "./lib/logger.js";
import {
	resolvePathFromProjectRoot,
} from "./lib/resolve-path.js";

const createExpressApp = (siteRootPath) => {
	const app = express();

	const expressLogger = morgan("combined", {
		skip: (request, response) => response.statusCode < 400,
	});
	app.use(expressLogger);

	app.use(helmet());
	app.use(helmet.strictTransportSecurity({
		force: httpsConfiguration.enableHsts === true,
		includeSubDomains: true,
		maxAge: 15_724_800_000,
	}));
	app.use(helmet.contentSecurityPolicy({
		directives: {
			...helmet.contentSecurityPolicy.getDefaultDirectives(),
			"connect-src": [
				"'self'",
				getS3BaseUrl(),
			],
			"img-src": [
				"'self'",
				getS3BaseUrl(),
			],
		},
	}));

	app.use(configuredHttpsRedirect());

	app.get("/sign-s3", handleUpload);

	const mount = st({
		index: "index.html",
		path: siteRootPath,
		url: "/",
	});
	app.use(mount);

	return app;
};

const startWebServer = () => {
	// Path to static resources like index.html, css etcetera
	const siteRootPath = resolvePathFromProjectRoot(...siteRootRelativePath.split("/"));
	const app = createExpressApp(siteRootPath);
	const s3Domain = getS3Domain();

	app.listen(httpConfiguration.serverPort, httpConfiguration.serverIp, () => {
		logger.info("Listening on port:", httpConfiguration.serverPort);
		logger.info("Bound to interface with ip:", httpConfiguration.serverIp);
		logger.info("Serving site root from folder:", siteRootPath);
		logger.info("Using S3 bucket/region:", s3Domain);
	});
};

startWebServer();
