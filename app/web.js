"use strict";

var configuration = require("configvention"),

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
                level: "trace",
                stream: process.stdout
            },
            //
            {
                type: "rotating-file",
                // TODO: use path from configuration so that there's one log path per app.
                path: "ftrf-web.log",
                // Daily rotation.
                period: "1d",
                // Keep three files.
                count: 3,
                level: "trace",
            },
            //
        ],
    },
    logger = require("bunyan").createLogger(bunyanConfig),
    uuid = require("node-uuid"),
    onetime = require("onetime"),

    httpServerPort = configuration.get("PORT") || configuration.get("http-server-port"),
    httpServerIp = configuration.get("http-server-ip"),

    siteRootRelativePath = configuration.get("site-root"),
    relativePathToRootFromThisFile = "..",

    express = require("express"),
    morgan = require("morgan"),
    expressLogger = morgan("combined", {
        skip: function(req, res) {
            return res.statusCode < 400;
        }
    }),
    helmet = require("helmet"),
    st = require("st"),
    path = require("path"),
    configuredHttpsRedirect = require("../lib/configuredHttpsRedirect.js"),

    resolvePath = function() {
        var args = [].slice.call(arguments),
            parts = [__dirname].concat(args);

        return path.resolve.apply(path, parts);
    },
    resolvePathFromProjectRoot = function() {
        var args = [].slice.call(arguments),
            parts = [relativePathToRootFromThisFile].concat(args);

        return resolvePath.apply(null, parts);
    },

    startsWith = function(str, check) {
        return str.substring(0, check.length) === check;
    },

    // Path to static resources like index.html, css etcetera
    siteRootPath = resolvePathFromProjectRoot.apply(null, siteRootRelativePath.split("/")),

    mount = st({
        path: siteRootPath,
        url: "/",
        index: "index.html"
    }),

    aws = require("aws-sdk"),
    Blitline = require("simple_blitline_node"),

    app = express();

app.use(expressLogger);

app.use(helmet());
app.use(helmet.hsts({
    maxAge: 15724800000,
    includeSubdomains: true,
    force: configuration.get("enable-hsts") === true
}));

app.use(configuredHttpsRedirect());

aws.config.update({
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_KEY
});
aws.config.update({
    region: AWS_REGION,
    signatureVersion: "v4"
});


function shortDateString(date) {
    date = date || new Date();

    var shortDate = date.toISOString().split("T")[0];

    return shortDate;
}

function getBeforeKey(generatedId, extension) {
    return "before/" + shortDateString() + "/" + new Date().valueOf() + "_" + generatedId + extension;
}

function getAfterKey(beforeKey) {
    return beforeKey.replace(/^before\//, "after/");
}

function getS3UrlFromKey(key) {
    // TODO: use a ready-made AWS S3 method instead.
    if (startsWith(key, "/")) {
        throw new Error("Key must not start with a slash.");
    }
    return "https://" + S3_BUCKET + ".s3." + AWS_REGION + ".amazonaws.com/" + key;
}

function blitlineCreateAddOverlayJob(beforeKey, afterKey, signedAfterUrl, clientFilename) {
    if (!startsWith(beforeKey, "before/")) {
        throw new Error("beforeKey must start with before/.");
    }

    if (!startsWith(afterKey, "after/")) {
        throw new Error("afterKey must start with after/.");
    }

    logger.trace("Creating add overlay job", beforeKey, afterKey, signedAfterUrl, clientFilename);

    var s3 = new aws.S3(),
        blitline = new Blitline(),
        job = {
            "application_id": BLITLINE_APP_ID,
            "src": getS3UrlFromKey(beforeKey),
            "functions": [{
                // TODO DEBUG REMOVE
                "name": "gray_colorspace",
                "params": {},

                // "name": "composite",
                // "params": {
                //     "src": "https://ftrf.example.com/resources/image/overlay/rainbow-flag-superwide.svg",
                //     "gravity": "CenterGravity",
                //     "scale_to_fit": {
                //         "height": "100%"
                //     },
                //     "src_percentage": 0.5,
                //     "dst_percentage": 0.5
                // },
                "save": {
                    "image_identifier": afterKey,
                    "s3_destination": {
                        "signed_url": signedAfterUrl,
                        "headers": {
                            "x-amz-acl": "public-read"
                                // TODO: save original client file name.
                                //     "x-amz-meta-name": clientFilename
                        }
                    }
                }
            }]
        };

    blitline.addJob(job);

    blitline.postJobs(function(response) {
        logger.trace("Received add overlay job response", beforeKey, afterKey, signedAfterUrl, clientFilename, response);

        //http://www.blitline.com/docs/postback#json
        //
        // {
        //     "results": {
        //         "images": [{
        //             "image_identifier": "MY_CLIENT_ID",
        //             "s3_url": "https://dev.blitline.s3.amazonaws.com/2011111513/1/fDIFJQVNlO6IeDZwXlruYg.jpg"
        //         }],
        //         "job_id": "4ec2e057c29aba53a5000001"
        //     }
        // }
        try {
            if (response.results.failed_image_identifiers) {
                // TODO: handle error.
                logger.error("Blitline", "Failed image identifiers", beforeKey, afterKey, signedAfterUrl, clientFilename, response, response.results.failed_image_identifiers);
            } else {
                // TODO: let the client know?
                logger.trace("Blitline", "Success", beforeKey, afterKey, signedAfterUrl, clientFilename, response, response.results, response.results.map(function(result) {
                    return result.images;
                }), response.results.map(function(result) {
                    return result.images.map(function(image) {
                        return "'" + image.image_identifier + "' '" + image.s3_url + "'";
                    });
                }));
            }
        } catch (e) {
            logger.error("Blitline", "Catch", beforeKey, afterKey, clientFilename, response, e);
        }
    });
}

function getS3BitlineUrl(beforeKey, afterKey, clientFilename) {
    if (!startsWith(beforeKey, "before/")) {
        throw new Error("beforeKey must start with before/.");
    }

    if (!startsWith(afterKey, "after/")) {
        throw new Error("afterKey must start with after/.");
    }

    logger.trace("Fetching S3 signed putObject url for Blitline", beforeKey, afterKey, clientFilename);

    var s3 = new aws.S3(),
        s3_params = {
            Bucket: S3_BUCKET,
            Key: afterKey,
            Expires: 60,
            ACL: "public-read",
            // TODO: save original client file name.
            // Metadata: metadata
        };

    s3.getSignedUrl("putObject", s3_params, function(err, signedAfterUrl) {
        if (err) {
            logger.error(err);
        } else {
            blitlineCreateAddOverlayJob(beforeKey, afterKey, signedAfterUrl, clientFilename);
        }
    });
}

function waitAggressivelyForS3Object(key, callback) {
    var s3 = new aws.S3(),
        s3_params = {
            Bucket: S3_BUCKET,
            Key: key,
        },
        onetimeCallback = onetime(function() {
            var endTime = new Date().valueOf(),
                deltaTime = endTime - startTime;

            logger.trace("Agressively waiting", "end", key, deltaTime, "ms");

            callback.apply(null, arguments);
        }),
        startTime = new Date().valueOf();

    logger.trace("Agressively waiting", "start", key);

    // Agressive waiting!
    // https://stackoverflow.com/questions/29255582/how-to-configure-interval-and-max-attempts-in-aws-s3-javascript-sdk?rq=1
    s3.waitFor("objectExists", s3_params, onetimeCallback);

    setTimeout(function() {
        s3.waitFor("objectExists", s3_params, onetimeCallback);
    }, 1000);

    setTimeout(function() {
        s3.waitFor("objectExists", s3_params, onetimeCallback);
    }, 2000);

    setTimeout(function() {
        s3.waitFor("objectExists", s3_params, onetimeCallback);
    }, 3000);

    setTimeout(function() {
        s3.waitFor("objectExists", s3_params, onetimeCallback);
    }, 4000);

    setTimeout(function() {
        s3.waitFor("objectExists", s3_params, onetimeCallback);
    }, 5000);
}

function waitForClientS3Upload(beforeKey, afterKey, clientFilename) {
    if (!startsWith(beforeKey, "before/")) {
        throw new Error("beforeKey must start with before/.");
    }

    if (!startsWith(afterKey, "after/")) {
        throw new Error("afterKey must start with after/.");
    }

    logger.trace("Waiting for file upload", beforeKey, afterKey, clientFilename);

    var objectExistsCallback = function(err, metadata) {
        if (err && err.code === "Not Found") {
            // TODO: What, it doesn"t exist? Hmm. Check metadata?
            logger.error("Object didn't exist", beforeKey, afterKey, err, metadata);
        } else if (err) {
            logger.error("Unknown error", beforeKey, afterKey, err, metadata);
        } else {
            logger.trace("Object exists", beforeKey, afterKey, metadata);

            getS3BitlineUrl(beforeKey, afterKey, clientFilename);
        }
    };

    // Give the client browser a second to receive this reply and upload the file to S3 before initial check.
    setTimeout(function() {
        waitAggressivelyForS3Object(beforeKey, objectExistsCallback);
    }, 1000);
}

function getExtensionFromInternetMediaType(internetMediaType) {
    switch (internetMediaType) {
        case "image/jpeg":
            return ".jpg";
        case "image/png":
            return ".png";
        default:
            break;
    }

    return null;
}

(function() {
    // Based on https://github.com/flyingsparx/NodeDirectUploader
    // Apache 2.0 license.
    // By https://github.com/flyingsparx/
    // https://devcenter.heroku.com/articles/s3-upload-node

    /*
     * Respond to GET requests to /sign_s3.
     * Upon request, return JSON containing the temporarily-signed S3 request and the
     * anticipated URL of the image.
     */
    app.get("/sign_s3", function(req, res) {
        // TODO: better verification.
        // TODO: check which types blitline can handle.
        if (req.query.file_type !== "image/jpeg" && req.query.file_type !== "image/png") {
            res.status(415); // 415 Unsupported Media Type
            res.end();
            return;
        }

        var s3 = new aws.S3(),
            clientFilename = (req.query.file_name || ""),
            imageContentType = req.query.file_type,
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
            s3_params = {
                Bucket: S3_BUCKET,
                Key: beforeKey,
                Expires: 60,
                ContentType: imageContentType,
                ACL: "public-read",
                // TODO: save original client file name.
                // Metadata: metadata
            };

        s3.getSignedUrl("putObject", s3_params, function(err, signedBeforeUrl) {
            if (err) {
                logger.error(err);
            } else {
                var return_data = {
                    signed_request: signedBeforeUrl,
                    beforeUrl: beforeUrl,
                    afterUrl: afterUrl
                };
                res.write(JSON.stringify(return_data));
                res.end();

                waitForClientS3Upload(beforeKey, afterKey, clientFilename);
            }
        });
    });
}());

app.use(mount);

app.listen(httpServerPort, httpServerIp, function() {
    logger.info("Listening on port", httpServerPort);
    logger.info("Bound to interface with ip", httpServerIp);
    logger.info("Serving site root from folder", siteRootPath);
    logger.info("Using S3_BUCKET", S3_BUCKET);
});