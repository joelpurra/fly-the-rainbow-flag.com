import assert from "node:assert";

import configvention from "configvention";

const assertGetConfigurationString = (name) => {
	assert.strictEqual(typeof name, "string");

	const value = configvention.get(name);

	assert.strictEqual(typeof value, "string", `Incorrect value for: ${name}`);
	assert.ok(value.length > 0);

	return value;
};

const parseBoolean = (value) => {
	if (typeof value === "boolean") {
		return value;
	}

	if (typeof value === "string") {
		if (value === "true") {
			return true;
		}

		if (value === "false") {
			return false;
		}
	}

	throw new TypeError(`Not a boolean: '${value}'`);
};

const assertPortNumber = (value, name) => {
	assert.strictEqual(typeof value, "number", `Incorrect value for: ${name}: "${value}"`);
	assert.ok(value > 0);
	assert.ok(value < 65_536);
	assert.strictEqual(value, Math.round(value));
};

const getHttpServerPort = (PORT, serverPort) => {
	let port;

	// NOTE: PORT is the alternative configuration, but prioritized since it's used by some server scaling software.
	// TODO: consider removing PORT.
	if (!Number.isNaN(PORT)) {
		assertPortNumber(PORT, "PORT");

		port = PORT;
	} else if (!Number.isNaN(serverPort)) {
		assertPortNumber(serverPort, "serverPort");

		port = serverPort;
	}

	assertPortNumber(port, "port");

	return port;
};

// NOTE: aws-sdk autodetects the access id, secret key, and region based on environment
//       variable names -- but since file-based configuration is allowed, the mechanic cannot be relied upon.
export const AWS_ACCESS_KEY_ID = assertGetConfigurationString("AWS_ACCESS_KEY_ID");
export const AWS_REGION = assertGetConfigurationString("AWS_REGION");
export const AWS_SECRET_ACCESS_KEY = assertGetConfigurationString("AWS_SECRET_ACCESS_KEY");

export const S3_BUCKET = assertGetConfigurationString("S3_BUCKET");

export const BLITLINE_APP_ID = assertGetConfigurationString("BLITLINE_APP_ID");

export const http = {
	serverIp: configvention.get("ftrf_http:server_ip"),
	serverPort: getHttpServerPort(Number.parseInt(configvention.get("PORT"), 10), Number.parseInt(configvention.get("ftrf_http:server_port"), 10)),
};

export const https = {
	enableHsts: parseBoolean(configvention.get("ftrf_https:enable_hsts")),
	rootUrl: configvention.get("ftrf_https:root_url"),
	shouldRedirect: parseBoolean(configvention.get("ftrf_https:should_redirect")),
};

export const logging = {
	level: configvention.get("ftrf_logging:level"),
};

export const siteRootRelativePath = configvention.get("ftrf_site_root");
