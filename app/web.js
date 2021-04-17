const configuration = require("configvention"),

    AWS_ACCESS_KEY = configuration.get("AWS_ACCESS_KEY"),
    AWS_SECRET_KEY = configuration.get("AWS_SECRET_KEY"),
    AWS_REGION = configuration.get("AWS_REGION"),
    S3_BUCKET = configuration.get("S3_BUCKET"),
    BLITLINE_APP_ID = configuration.get("BLITLINE_APP_ID"),

    bunyanConfig = {
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
                type: "stream",
                level: configuration.get("logging:level") || "trace",
                stream: process.stdout,
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
    },
    bunyan = require("bunyan"),
    logger = bunyan.createLogger(bunyanConfig),
    uuid = require("node-uuid"),
    onetime = require("onetime"),

    getHttpServerPort = () => {
        const httpServerPortFromEnvironment = parseInt(configuration.get("PORT"), 10),
            httpServerPortFromConfigurationFile = configuration.get("http-server-port");

        if (isNaN(httpServerPortFromEnvironment) || httpServerPortFromEnvironment <= 0) {
            return httpServerPortFromConfigurationFile;
        }

        return httpServerPortFromEnvironment;
    },

    httpServerPort = getHttpServerPort(),
    httpServerIp = configuration.get("http-server-ip"),

    siteRootRelativePath = configuration.get("site-root"),
    relativePathToRootFromThisFile = "..",

    express = require("express"),
    morgan = require("morgan"),
    expressLogger = morgan("combined", {
        skip: (req, res) => res.statusCode < 400,
    }),
    helmet = require("helmet"),
    st = require("st"),
    path = require("path"),
    configuredHttpsRedirect = require("../lib/configuredHttpsRedirect.js"),

    resolvePath = (...args) => {
        const parts = [__dirname].concat(args);

        return path.resolve.apply(path, parts);
    },
    resolvePathFromProjectRoot = (...args) => {
        const parts = [relativePathToRootFromThisFile].concat(args);

        return resolvePath.apply(null, parts);
    },

    startsWith = (str, check) => str.substring(0, check.length) === check,

    shortDateString = (date) => {
        date = date || new Date();

        const shortDate = date.toISOString().split("T")[0];

        return shortDate;
    },

    getBeforeKey = (generatedId, extension) => `before/${shortDateString()}/${new Date().valueOf()}_${generatedId}${extension}`,

    getAfterKey = (beforeKey) => beforeKey.replace(/^before\//, "after/"),

    getS3Domain = () => {
        // TODO: use a ready-made AWS S3 method instead.
        return `${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com`;
    },

    getS3BaseUrl = () => {
        // TODO: use a ready-made AWS S3 method instead.
        const s3Domain = getS3Domain();

        return `https://${s3Domain}`;
    },

    getS3Url = (pathname) => {
        // TODO: use a ready-made AWS S3 method instead.
        if (!startsWith(pathname, "/")) {
            throw new Error("Key must start with a slash.");
        }

        const s3BaseUrl = getS3BaseUrl(),
            s3Url = new URL(pathname, s3BaseUrl);

        return s3Url.toString();
    },

    getS3UrlFromKey = (key) => {
        // TODO: use a ready-made AWS S3 method instead.
        if (startsWith(key, "/")) {
            throw new Error("Key must not start with a slash.");
        }

        return getS3Url(`/${key}`);
    },

    blitlineCreateAddOverlayJob = (beforeKey, afterKey, signedAfterUrl, clientFilename) => {
        if (!startsWith(beforeKey, "before/")) {
            throw new Error("beforeKey must start with before/.");
        }

        if (!startsWith(afterKey, "after/")) {
            throw new Error("afterKey must start with after/.");
        }

        logger.trace("Creating add overlay job", beforeKey, afterKey, signedAfterUrl, clientFilename);

        const blitline = new Blitline(),
            s3FlagOverlayUrl = getS3Url("/resources/image/overlay/rainbow-flag-superwide.svg"),
            job = {
                "application_id": BLITLINE_APP_ID,
                "src": getS3UrlFromKey(beforeKey),
                "wait_retry_delay": 5,
                "functions": [{
                    "name": "modulate",
                    "params": {
                        "saturation": 0.1,
                    },

                    "functions": [{
                        "name": "dissolve",
                        "params": {
                            // This file used to be hosted locally, but Blitline seemed to not be able to load it from the main domain.
                            // "src": "https://fly-the-rainbow-flag.com/resources/image/overlay/rainbow-flag-superwide.svg",
                            "src": s3FlagOverlayUrl,
                            "gravity": "CenterGravity",
                            "scale_to_match": true,
                            "src_percentage": 0.3,
                            "dst_percentage": 0.7,
                        },

                        "functions": [{
                            "name": "modulate",
                            "params": {
                                "brightness": 1.2,
                                "saturation": 1.25,
                            },

                            "save": {
                                "image_identifier": afterKey,
                                "s3_destination": {
                                    "signed_url": signedAfterUrl,
                                    "headers": {
                                        // TODO: save original client file name.
                                        //     "x-amz-meta-name": clientFilename
                                        "x-amz-acl": "public-read",
                                    },
                                },
                            },
                        }],
                    }],
                }],
            };

        blitline.addJob(job);

        blitline.postJobs()
            .then((response) => {
                logger.trace("Received add overlay job response", beforeKey, afterKey, signedAfterUrl, clientFilename, response);

                // https://www.blitline.com/docs/postback#json
                try {
                    if (response.results.failed_image_identifiers) {
                        // TODO: handle error.
                        logger.error("Blitline",
                            "Failed image identifiers",
                            beforeKey,
                            afterKey,
                            signedAfterUrl,
                            clientFilename,
                            response,
                            response.results.failed_image_identifiers,
                        );
                    } else {
                        // TODO: let the client know?
                        logger.trace(
                            "Blitline",
                            "Success",
                            beforeKey,
                            afterKey,
                            signedAfterUrl,
                            clientFilename,
                            response,
                            response.results,
                            response.results
                                .map((result) => result.images), response.results
                                .map((result) => result.images
                                    .map((image) => `'${image.image_identifier}' '${image.s3_url}'`)));
                    }
                } catch (e) {
                    logger.error("Blitline", "Catch", beforeKey, afterKey, clientFilename, response, e);
                }
            });
    },

    getS3BlitlineUrl = (beforeKey, afterKey, clientFilename) => {
        if (!startsWith(beforeKey, "before/")) {
            throw new Error("beforeKey must start with before/.");
        }

        if (!startsWith(afterKey, "after/")) {
            throw new Error("afterKey must start with after/.");
        }

        logger.trace("Fetching S3 signed putObject url for Blitline", beforeKey, afterKey, clientFilename);

        const s3 = new aws.S3(),
            s3Params = {
                Bucket: S3_BUCKET,
                Key: afterKey,
                Expires: 60,
                ACL: "public-read",
                // TODO: save original client file name.
                // Metadata: metadata
            };

        s3.getSignedUrl("putObject", s3Params, function(err, signedAfterUrl) {
            if (err) {
                logger.error(err);
            } else {
                blitlineCreateAddOverlayJob(beforeKey, afterKey, signedAfterUrl, clientFilename);
            }
        });
    },

    waitAggressivelyForS3Object = (key, callback) => {
        const s3 = new aws.S3(),
            s3Params = {
                Bucket: S3_BUCKET,
                Key: key,
            },
            // TODO: chain timed checks instead of starting all at once.
            timedChecks = [1, 2, 3, 4, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110],
            timeouts = [],
            addTimeout = function(fn, timeout) {
                const timeoutId = setTimeout(fn, timeout);

                timeouts.push(timeoutId);
            },
            clearTimeouts = function() {
                timeouts.forEach(function(timeoutId) {
                    clearTimeout(timeoutId);
                });
            },
            onetimeCallback = onetime(function(err, metadata) {
                const endTime = new Date().valueOf(),
                    deltaTime = endTime - startTime;

                // TODO: chain timed checks instead of starting all at once.
                clearTimeouts();

                logger.trace("Aggressively waiting", "end", key, deltaTime, "ms");

                callback(err, metadata);
            }),
            startTime = new Date().valueOf(),
            filterOutExpectedErrorsCallback = function(err, metadata) {
                // TODO: chain timed checks instead of starting all at once.
                const endTime = new Date().valueOf(),
                    deltaTime = endTime - startTime;

                if (err && err.code === "Not Found") {
                    logger.trace("filterOutExpectedErrorsCallback", "Object didn't exist.", deltaTime, "ms", "Still waiting.", key, err, metadata);
                } else if (err && err.code === "ResourceNotReady") {
                    logger.trace("filterOutExpectedErrorsCallback", "Resource is not ready, check timed out.", deltaTime, "ms", "Still waiting.", key, err, metadata);
                } else if (err) {
                    logger.info("filterOutExpectedErrorsCallback", "Unknown error", deltaTime, "ms", key, err, metadata);

                    onetimeCallback(err, metadata);
                } else {
                    logger.trace("filterOutExpectedErrorsCallback", "Object exists", deltaTime, "ms", key, metadata);

                    onetimeCallback(err, metadata);
                }
            };

        logger.trace("Aggressively waiting", "start", key);

        // Aggressive waiting!
        // https://stackoverflow.com/questions/29255582/how-to-configure-interval-and-max-attempts-in-aws-s3-javascript-sdk
        s3.waitFor("objectExists", s3Params, filterOutExpectedErrorsCallback);

        timedChecks.forEach(function(timeout) {
            // TODO: chain timed checks instead of starting all at once.
            addTimeout(function() {
                s3.waitFor("objectExists", s3Params, filterOutExpectedErrorsCallback);
            }, timeout * 1000);
        });

        addTimeout(function() {
            s3.waitFor("objectExists", s3Params, onetimeCallback);
        }, 120000);
    },

    waitForClientS3Upload = (beforeKey, afterKey, clientFilename) => {
        if (!startsWith(beforeKey, "before/")) {
            throw new Error("beforeKey must start with before/.");
        }

        if (!startsWith(afterKey, "after/")) {
            throw new Error("afterKey must start with after/.");
        }

        logger.trace("Waiting for file upload", beforeKey, afterKey, clientFilename);

        const objectExistsCallback = function(err, metadata) {
            if (err && err.code === "Not Found") {
                // TODO: What, it doesn't exist? Hmm. Check metadata?
                logger.error("Object didn't exist", beforeKey, afterKey, err, metadata);
            } else if (err && err.code === "ResourceNotReady") {
                // TODO: What, it doesn't exist? Hmm. Check metadata?
                logger.error("Resource is not ready, check timed out", beforeKey, afterKey, err, metadata);
            } else if (err) {
                logger.error("Unknown error", beforeKey, afterKey, err, metadata);
            } else {
                logger.trace("Object exists", beforeKey, afterKey, metadata);

                getS3BlitlineUrl(beforeKey, afterKey, clientFilename);
            }
        };

        waitAggressivelyForS3Object(beforeKey, objectExistsCallback);
    },

    getExtensionFromInternetMediaType = (internetMediaType) => {
        switch (internetMediaType) {
            case "image/jpeg":
                return ".jpg";
            case "image/png":
                return ".png";
            default:
                break;
        }

        return null;
    },

    // Path to static resources like index.html, css etcetera
    siteRootPath = resolvePathFromProjectRoot.apply(null, siteRootRelativePath.split("/")),

    mount = st({
        path: siteRootPath,
        url: "/",
        index: "index.html",
    }),

    aws = require("aws-sdk"),
    Blitline = require("simple_blitline_node"),

    app = express();

app.use(expressLogger);

app.use(helmet());
app.use(helmet.hsts({
    maxAge: 15724800000,
    includeSubDomains: true,
    force: configuration.get("enable-hsts") === true,
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

(() => {
    // Based on https://github.com/flyingsparx/NodeDirectUploader
    // Apache 2.0 license.
    // By https://github.com/flyingsparx/
    // https://devcenter.heroku.com/articles/s3-upload-node
    /*
     * Respond to GET requests to /sign-s3.
     * Upon request, return JSON containing the temporarily-signed S3 request and the
     * anticipated URL of the image.
     */
    app.get("/sign-s3", (req, res) => {
        // TODO: better verification.
        // TODO: check which types blitline can handle.
        if (req.query.filetype !== "image/jpeg" && req.query.filetype !== "image/png") {
            res.status(415); // 415 Unsupported Media Type
            res.end();
            return;
        }

        const s3 = new aws.S3(),
            clientFilename = (req.query.filename || ""),
            imageContentType = req.query.filetype,
            extension = getExtensionFromInternetMediaType(imageContentType),
            generatedId = uuid.v4(),
            beforeKey = getBeforeKey(generatedId, extension),
            afterKey = getAfterKey(beforeKey),
            beforeUrl = getS3UrlFromKey(beforeKey),
            afterUrl = getS3UrlFromKey(afterKey),
            // TODO: save original client file name.
            // metadata = {
            //     name: clientFilename
            // },
            s3Params = {
                Bucket: S3_BUCKET,
                Key: beforeKey,
                Expires: 60,
                ContentType: imageContentType,
                ACL: "public-read",
                // TODO: save original client file name.
                // Metadata: metadata
            };

        s3.getSignedUrl("putObject", s3Params, (err, signedBeforeUrl) => {
            if (err) {
                logger.error(err);
            } else {
                const result = {
                    signedRequest: signedBeforeUrl,
                    beforeUrl: beforeUrl,
                    afterUrl: afterUrl,
                };
                res.write(JSON.stringify(result));
                res.end();

                waitForClientS3Upload(beforeKey, afterKey, clientFilename);
            }
        });
    });
})();

app.use(mount);

app.listen(httpServerPort, httpServerIp, () => {
    logger.info("Listening on port", httpServerPort);
    logger.info("Bound to interface with ip", httpServerIp);
    logger.info("Serving site root from folder", siteRootPath);
    logger.info("Using S3_BUCKET", S3_BUCKET);
});
