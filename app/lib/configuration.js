const assert = require("node:assert");
const configvention = require("configvention");

const AWS_ACCESS_KEY = configvention.get("AWS_ACCESS_KEY");
const AWS_SECRET_KEY = configvention.get("AWS_SECRET_KEY");
const AWS_REGION = configvention.get("AWS_REGION");
const S3_BUCKET = configvention.get("S3_BUCKET");
const BLITLINE_APP_ID = configvention.get("BLITLINE_APP_ID");

assert.strictEqual(typeof AWS_ACCESS_KEY, "string");
assert.strictEqual(typeof AWS_SECRET_KEY, "string");
assert.strictEqual(typeof AWS_REGION, "string");
assert.strictEqual(typeof S3_BUCKET, "string");
assert.strictEqual(typeof BLITLINE_APP_ID, "string");

const PORT = configvention.get("PORT");
const enableHsts = configvention.get("enable-hsts") === true;
const httpServerIp = configvention.get("http-server-ip");
const httpServerPort = configvention.get("http-server-port");
const loggingLevel = configvention.get("logging:level");
const redirectToHttps = configvention.get("redirect-to-https") === true;
const secureRoot = configvention.get("https-url-root");
const siteRootRelativePath = configvention.get("site-root");

const getHttpServerPort = () => {
	const httpServerPortFromEnvironment = Number.parseInt(PORT, 10);
	const httpServerPortFromConfigurationFile = httpServerPort;

	if (Number.isNaN(httpServerPortFromEnvironment) || httpServerPortFromEnvironment <= 0) {
		return httpServerPortFromConfigurationFile;
	}

	return httpServerPortFromEnvironment;
};

// TODO: structured configuration.
const configuration = {
	AWS_ACCESS_KEY,
	AWS_REGION,
	AWS_SECRET_KEY,
	BLITLINE_APP_ID,
	S3_BUCKET,
	enableHsts,
	httpServerIp,
	httpServerPort: getHttpServerPort(),
	loggingLevel,
	redirectToHttps,
	secureRoot,
	siteRootRelativePath,
};

module.exports = configuration;
