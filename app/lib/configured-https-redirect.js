const configuration = require("configvention");

const redirectRequestToHttps = (request, response) => {
	const secureRoot = configuration.get("https-url-root");
	const secureUrl = new URL(request.originalUrl, secureRoot);

	// From https://github.com/aredo/express-enforces-ssl
	if (request.method === "GET") {
		response.redirect(301, secureUrl);
	} else {
		response.send(403, "Please use HTTPS when submitting data to this server.");
	}
};

const configuredHttpsRedirect = () => {
	const middleware = (request, response, next) => {
		if (request.headers["x-forwarded-proto"] !== "https" && configuration.get("redirect-to-https") === true) {
			redirectRequestToHttps(request, response);
		} else {
			next();
		}
	};

	return middleware;
};

module.exports = configuredHttpsRedirect;
