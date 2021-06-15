const configuration = require("configvention");

const redirectRequestToHttps = (request, res) => {
	const secureRoot = configuration.get("https-url-root");
	const secureUrl = new URL(request.originalUrl, secureRoot);

	// From https://github.com/aredo/express-enforces-ssl
	if (request.method === "GET") {
		res.redirect(301, secureUrl);
	} else {
		res.send(403, "Please use HTTPS when submitting data to this server.");
	}
};

const configuredHttpsRedirect = () => {
	const middleware = (request, res, next) => {
		if (request.headers["x-forwarded-proto"] !== "https" && configuration.get("redirect-to-https") === true) {
			redirectRequestToHttps(request, res);
		} else {
			next();
		}
	};

	return middleware;
};

module.exports = configuredHttpsRedirect;
