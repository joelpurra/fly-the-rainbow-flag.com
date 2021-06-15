const assert = require("assert");
const aws = require("aws-sdk");
const Blitline = require("simple_blitline_node");
const bunyan = require("bunyan");
const configuration = require("configvention");
const configuredHttpsRedirect = require("./lib/configured-https-redirect.js");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const st = require("st");
const uuid = require("node-uuid");

const AWS_ACCESS_KEY = configuration.get("AWS_ACCESS_KEY");
const AWS_SECRET_KEY = configuration.get("AWS_SECRET_KEY");
const AWS_REGION = configuration.get("AWS_REGION");
const S3_BUCKET = configuration.get("S3_BUCKET");
const BLITLINE_APP_ID = configuration.get("BLITLINE_APP_ID");

assert.strictEqual(typeof AWS_ACCESS_KEY, "string");
assert.strictEqual(typeof AWS_SECRET_KEY, "string");
assert.strictEqual(typeof AWS_REGION, "string");
assert.strictEqual(typeof S3_BUCKET, "string");
assert.strictEqual(typeof BLITLINE_APP_ID, "string");

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
			level: configuration.get("logging:level"),
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

const getHttpServerPort = () => {
	const httpServerPortFromEnvironment = Number.parseInt(configuration.get("PORT"), 10);
	const httpServerPortFromConfigurationFile = configuration.get("http-server-port");

	if (Number.isNaN(httpServerPortFromEnvironment) || httpServerPortFromEnvironment <= 0) {
		return httpServerPortFromConfigurationFile;
	}

	return httpServerPortFromEnvironment;
};

const httpServerPort = getHttpServerPort();
const httpServerIp = configuration.get("http-server-ip");

const siteRootRelativePath = configuration.get("site-root");
const relativePathToRootFromThisFile = "..";

const expressLogger = morgan("combined", {
	skip: (request, response) => response.statusCode < 400,
});

const resolvePath = (...args) => {
	const parts = [
		__dirname,
		...args,
	];

	return path.resolve(...parts);
};

const resolvePathFromProjectRoot = (...args) => {
	const parts = [
		relativePathToRootFromThisFile,
		...args,
	];

	return resolvePath(...parts);
};

const shortDateString = (date) => {
	date = date || new Date();

	const shortDate = date.toISOString().split("T")[0];

	return shortDate;
};

const getBeforeKey = (generatedId, extension) => `before/${shortDateString()}/${Date.now()}_${generatedId}${extension}`;

const getAfterKey = (beforeKey) => beforeKey.replace(/^before\//, "after/");

const getS3Domain = () => {
	// TODO: use a ready-made AWS S3 method instead.
	return `${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com`;
};

const getS3BaseUrl = () => {
	// TODO: use a ready-made AWS S3 method instead.
	const s3Domain = getS3Domain();

	return `https://${s3Domain}`;
};

const getS3Url = (pathname) => {
	// TODO: use a ready-made AWS S3 method instead.
	if (!pathname.startsWith("/")) {
		throw new Error("Key must start with a slash.");
	}

	const s3BaseUrl = getS3BaseUrl();
	const s3Url = new URL(pathname, s3BaseUrl);

	return s3Url.toString();
};

const getS3UrlFromKey = (key) => {
	// TODO: use a ready-made AWS S3 method instead.
	if (key.startsWith("/")) {
		throw new Error("Key must not start with a slash.");
	}

	return getS3Url(`/${key}`);
};

const blitlineCreateAddOverlayJob = async (beforeKey, afterKey, signedAfterUrl) => {
	if (!beforeKey.startsWith("before/")) {
		throw new Error("beforeKey must start with before/.");
	}

	if (!afterKey.startsWith("after/")) {
		throw new Error("afterKey must start with after/.");
	}

	logger.trace("Creating add overlay job", beforeKey, afterKey, signedAfterUrl);

	const blitline = new Blitline();
	const s3FlagOverlayUrl = getS3Url("/resources/image/overlay/rainbow-flag-superwide.svg");
	const job = {
		/* eslint-disable camelcase */
		application_id: BLITLINE_APP_ID,
		functions: [
			{
				functions: [
					{
						functions: [
							{
								name: "modulate",
								params: {
									brightness: 1.2,
									saturation: 1.25,
								},

								save: {
									image_identifier: afterKey,
									s3_destination: {
										headers: {
											// TODO: save original client file name.
											// "x-amz-meta-name": clientFilename
											"x-amz-acl": "public-read",
										},
										signed_url: signedAfterUrl,
									},
								},
							},
						],
						name: "dissolve",
						params: {
							// This file used to be hosted locally, but Blitline seemed to not be able to load it from the main domain.
							// "src": "https://fly-the-rainbow-flag.com/resources/image/overlay/rainbow-flag-superwide.svg",
							dst_percentage: 0.7,
							gravity: "CenterGravity",
							scale_to_match: true,
							src: s3FlagOverlayUrl,
							src_percentage: 0.3,
						},
					},
				],
				name: "modulate",
				params: {
					saturation: 0.1,
				},
			},
		],
		src: getS3UrlFromKey(beforeKey),
		wait_retry_delay: 5,
	};
	/* eslint-enable camelcase */

	blitline.addJob(job);

	const jobsResponse = await blitline.postJobs();

	logger.trace("Received add overlay job response", beforeKey, afterKey, signedAfterUrl, JSON.stringify(jobsResponse));

	const {
		results,
	} = jobsResponse;

	// https://www.blitline.com/docs/postback#json
	if (results.failed_image_identifiers) {
		throw new Error(`Blitline: ${JSON.stringify(beforeKey)} ${JSON.stringify(afterKey)} ${JSON.stringify(signedAfterUrl)} ${JSON.stringify(results)}`);
	}

	assert(Array.isArray(results));
	assert.strictEqual(results.length, 1);

	const result = results[0];

	assert(Array.isArray(result.images));
	assert.strictEqual(result.images.length, 1);

	const image = result.images[0];

	logger.trace(
		"Blitline",
		"Success",
		beforeKey,
		afterKey,
		signedAfterUrl,
		image,
	);

	const data = {
		identifier: image.image_identifier,
		url: image.s3_url,
	};

	return data;
};

const getS3BlitlineUrl = async (afterKey) => {
	if (!afterKey.startsWith("after/")) {
		throw new Error("afterKey must start with after/.");
	}

	logger.trace("Fetching S3 signed putObject url for Blitline", afterKey);

	const s3 = new aws.S3();
	const s3Parameters = {
		ACL: "public-read",
		Bucket: S3_BUCKET,
		Expires: 60,
		Key: afterKey,
		// TODO: save original client file name.
		// Metadata: metadata
	};

	const signedAfterUrl = await s3.getSignedUrl("putObject", s3Parameters);

	return signedAfterUrl;
};

const waitForS3Object = async (key) => {
	const s3 = new aws.S3();
	const s3Parameters = {
		...{
			Bucket: S3_BUCKET,
			Key: key,
		},
		...{
			delay: 1,
			maxAttempts: 300,
		},
	};

	await s3.waitFor("objectExists", s3Parameters);
};

const getExtensionFromInternetMediaType = (internetMediaType) => {
	switch (internetMediaType) {
		case "image/jpeg":
			return ".jpg";
		case "image/png":
			return ".png";
		default:
			break;
	}

	throw new Error(`Unexpected internet media type: ${JSON.stringify(internetMediaType)}.`);
};

// Path to static resources like index.html, css etcetera
const siteRootPath = resolvePathFromProjectRoot(...siteRootRelativePath.split("/"));

const mount = st({
	index: "index.html",
	path: siteRootPath,
	url: "/",
});

const app = express();

app.use(expressLogger);

app.use(helmet());
app.use(helmet.hsts({
	force: configuration.get("enable-hsts") === true,
	includeSubDomains: true,
	maxAge: 15724800000,
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

aws.config.update({
	accessKeyId: AWS_ACCESS_KEY,
	secretAccessKey: AWS_SECRET_KEY,
});
aws.config.update({
	region: AWS_REGION,
	signatureVersion: "v4",
});

const expectedFiletypes = new Set([
	"image/jpeg",
	"image/png",
]);

// Based on https://github.com/flyingsparx/NodeDirectUploader
// Apache 2.0 license.
// By https://github.com/flyingsparx/
// https://devcenter.heroku.com/articles/s3-upload-node
const handleUpload = async (request, response) => {
	// TODO: better verification.
	// TODO: check which types blitline can handle.
	const {
		query,
	} = request;
	const matchesExpectedFiletype = expectedFiletypes.has(query.filetype);

	if (!matchesExpectedFiletype) {
		// NOTE: 415 Unsupported Media Type
		response.status(415);
		response.end();
		return;
	}

	const s3 = new aws.S3();
	const imageContentType = query.filetype;
	const extension = getExtensionFromInternetMediaType(imageContentType);
	const generatedId = uuid.v4();
	const beforeKey = getBeforeKey(generatedId, extension);
	const afterKey = getAfterKey(beforeKey);
	const beforeUrl = getS3UrlFromKey(beforeKey);
	const afterUrl = getS3UrlFromKey(afterKey);

	// const clientFilename = (query.filename || "");
	// TODO: save original client file name.
	// const metadata = {
	//     name: clientFilename
	// },
	const s3Parameters = {
		ACL: "public-read",
		Bucket: S3_BUCKET,
		ContentType: imageContentType,
		Expires: 60,
		Key: beforeKey,
		// TODO: save original client file name.
		// Metadata: metadata
	};

	const signedBeforeUrl = await s3.getSignedUrl("putObject", s3Parameters);
	const result = {
		afterUrl,
		beforeUrl,
		signedRequest: signedBeforeUrl,
	};
	const data = JSON.stringify(result);
	response.contentType("application/json");
	response.end(data);

	// NOTE: the client will upload the original image, then check/wait for the processed image to finish.
	// NOTE: the server will check/wait for the client's original image upload to finish, then trigger the image processing and wait for the result.

	logger.trace("Waiting for client file upload", beforeKey);
	await waitForS3Object(beforeKey);
	logger.trace("Client file upload done", beforeKey);

	const signedAfterUrl = await getS3BlitlineUrl(afterKey);
	await blitlineCreateAddOverlayJob(beforeKey, afterKey, signedAfterUrl);

	logger.trace("Waiting for Blitline file upload", afterKey);
	await waitForS3Object(afterKey);
	logger.trace("Client file upload done", afterKey);

	logger.info("Success", beforeUrl, afterUrl);
};

app.get("/sign-s3", handleUpload);

app.use(mount);

app.listen(httpServerPort, httpServerIp, () => {
	logger.info("Listening on port", httpServerPort);
	logger.info("Bound to interface with ip", httpServerIp);
	logger.info("Serving site root from folder", siteRootPath);
	logger.info("Using S3_BUCKET", S3_BUCKET);
});
