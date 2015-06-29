"use strict";

var configuration = require("configvention"),

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

    app = express();

app.use(expressLogger);

app.use(helmet());
app.use(helmet.hsts({
    maxAge: 15724800000,
    includeSubdomains: true,
    force: configuration.get("enable-hsts") === true
}));

app.use(configuredHttpsRedirect());

app.use(mount);

app.listen(httpServerPort, httpServerIp, function() {
    logger.info("Listening on port", httpServerPort);
    logger.info("Bound to interface with ip", httpServerIp);
    logger.info("Serving site root from folder", siteRootPath);
});