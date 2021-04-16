const configuration = require("configvention"),
    redirectRequestToHttps = (req, res) => {
        const secureRoot = configuration.get("https-url-root"),
            secureUrl = new URL(req.originalUrl, secureRoot);

        // From https://github.com/aredo/express-enforces-ssl
        if (req.method === "GET") {
            res.redirect(301, secureUrl);
        } else {
            res.send(403, "Please use HTTPS when submitting data to this server.");
        }
    },

    configuredHttpsRedirect = () => {
        const middleware = (req, res, next) => {
            if (req.headers["x-forwarded-proto"] !== "https" && configuration.get("redirect-to-https") === true) {
                redirectRequestToHttps(req, res);
            } else {
                next();
            }
        };

        return middleware;
    };

module.exports = configuredHttpsRedirect;