import aws from "aws-sdk";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import st from "st";

import handleUpload from "./handlers/handle-upload.js";
import configuration from "./lib/configuration.js";
import configuredHttpsRedirect from "./lib/configured-https-redirect.js";
import {
	getS3BaseUrl,
} from "./lib/get-s3-url.js";
import logger from "./lib/logger.js";
import {
	resolvePathFromProjectRoot,
} from "./lib/resolve-path.js";

const initializeAws = () => {
	aws.config.update({
		accessKeyId: configuration.AWS_ACCESS_KEY,
		secretAccessKey: configuration.AWS_SECRET_KEY,
	});
	aws.config.update({
		region: configuration.AWS_REGION,
		signatureVersion: "v4",
	});
};

const createExpressApp = (siteRootPath) => {
	const app = express();

	const expressLogger = morgan("combined", {
		skip: (request, response) => response.statusCode < 400,
	});
	app.use(expressLogger);

	app.use(helmet());
	app.use(helmet.strictTransportSecurity({
		force: configuration.enableHsts === true,
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
	initializeAws();

	// Path to static resources like index.html, css etcetera
	const siteRootPath = resolvePathFromProjectRoot(...configuration.siteRootRelativePath.split("/"));

	const app = createExpressApp(siteRootPath);

	app.listen(configuration.httpServerPort, configuration.httpServerIp, () => {
		logger.info("Listening on port", configuration.httpServerPort);
		logger.info("Bound to interface with ip", configuration.httpServerIp);
		logger.info("Serving site root from folder", siteRootPath);
		logger.info("Using S3_BUCKET", configuration.S3_BUCKET);
	});
};

startWebServer();
