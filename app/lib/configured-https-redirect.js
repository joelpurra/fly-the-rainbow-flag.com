import {
	https as httpsConfiguration,
} from "./configuration.js";

const redirectRequestToHttps = (request, response) => {
	if (request.method === "GET") {
		const secureUrl = new URL(request.originalUrl, httpsConfiguration.rootUrl);

		response.redirect(301, secureUrl);
	} else {
		response.send(405, "Please use HTTPS when submitting data to this server.");
	}
};

const configuredHttpsRedirect = () => {
	const middleware = (request, response, next) => {
		if (request.headers["x-forwarded-proto"] !== "https" && httpsConfiguration.shouldRedirect === true) {
			redirectRequestToHttps(request, response);
		} else {
			next();
		}
	};

	return middleware;
};

export default configuredHttpsRedirect;
