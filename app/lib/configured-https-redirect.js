import configuration from "./configuration.js";

const {
	redirectToHttps,
	secureRoot,
} = configuration;

const redirectRequestToHttps = (request, response) => {
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
		if (request.headers["x-forwarded-proto"] !== "https" && redirectToHttps === true) {
			redirectRequestToHttps(request, response);
		} else {
			next();
		}
	};

	return middleware;
};

export default configuredHttpsRedirect;
