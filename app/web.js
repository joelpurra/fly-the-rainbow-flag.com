"use strict";

var configuration = require("configvention"),

    AWS_ACCESS_KEY = configuration.get("AWS_ACCESS_KEY"),
    AWS_SECRET_KEY = configuration.get("AWS_SECRET_KEY"),
    S3_BUCKET = configuration.get("S3_BUCKET"),

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
            // {
            //     type: "rotating-file",
            //     // TODO: use path from configuration so that there's one log path per app.
            //     path: "ftrf.%NAME%.log",
            //     // Daily rotation.
            //     period: "1d",
            //     // Keep three files.
            //     count: 3,
            //     level: "warn",
            // },
            //
        ],
    },
    logger = require("bunyan").createLogger(bunyanConfig),

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

    // Path to static resources like index.html, css etcetera
    siteRootPath = resolvePathFromProjectRoot.apply(null, siteRootRelativePath.split("/")),

    mount = st({
        path: siteRootPath,
        url: "/",
        index: "index.html"
    }),

    aws = require("aws-sdk"),

    app = express();

app.use(expressLogger);

app.use(helmet());
app.use(helmet.hsts({
    maxAge: 15724800000,
    includeSubdomains: true,
    force: configuration.get("enable-hsts") === true
}));

app.use(configuredHttpsRedirect());

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
        aws.config.update({
            accessKeyId: AWS_ACCESS_KEY,
            secretAccessKey: AWS_SECRET_KEY
        });
        aws.config.update({
            region: "eu-central-1",
            signatureVersion: "v4"
        });
        var s3 = new aws.S3();
        var s3_params = {
            Bucket: S3_BUCKET,
            Key: req.query.file_name,
            Expires: 60,
            ContentType: req.query.file_type,
            ACL: "public-read"
        };
        s3.getSignedUrl("putObject", s3_params, function(err, data) {
            if (err) {
                logger.error(err);
            } else {
                var generatedFilename = (new Date().valueOf() + req.query.file_name),
                    return_data = {
                        signed_request: data,
                        url: "https://" + S3_BUCKET + ".s3.amazonaws.com/" + "before/" + generatedFilename
                    };
                res.write(JSON.stringify(return_data));
                res.end();
            }
        });
    });

    /*
     * Respond to POST requests to /submit_form.
     * This function needs to be completed to handle the information in 
     * a way that suits your application.
     */
    app.post("/submit_form", function(req, res) {
        username = req.body.username;
        full_name = req.body.full_name;
        avatar_url = req.body.avatar_url;
        update_account(username, full_name, avatar_url); // TODO: create this function
        // TODO: Return something useful or redirect
    });
}());

app.use(mount);

app.listen(httpServerPort, httpServerIp, function() {
    logger.info("Listening on port", httpServerPort);
    logger.info("Bound to interface with ip", httpServerIp);
    logger.info("Serving site root from folder", siteRootPath);
    logger.info("Using AWS_ACCESS_KEY", AWS_ACCESS_KEY);
    logger.info("Using S3_BUCKET", S3_BUCKET);
});