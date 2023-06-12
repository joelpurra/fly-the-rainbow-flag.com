import assert from "node:assert";

import aws from "aws-sdk";
import Blitline from "simple_blitline_node";
import {
	v4 as uuidv4,
} from "uuid";

import {
	BLITLINE_APP_ID,
	S3_BUCKET,
} from "../lib/configuration.js";
import {
	getS3Url,
	getS3UrlFromKey,
} from "../lib/get-s3-url.js";
import logger from "../lib/logger.js";

// TODO: check which types blitline can handle.
const expectedFiletypes = new Set([
	"image/jpeg",
	"image/png",
]);

const verifyRequest = (request, response) => {
	// TODO: better verification.
	const matchesExpectedFiletype = expectedFiletypes.has(request.query.filetype);

	if (!matchesExpectedFiletype) {
		// NOTE: 415 Unsupported Media Type
		response.status(415);
		response.end();

		return false;
	}

	return true;
};

const getExtensionFromInternetMediaType = (internetMediaType) => {
	switch (internetMediaType) {
		case "image/jpeg": {
			return ".jpg";
		}

		case "image/png": {
			return ".png";
		}

		default: {
			break;
		}
	}

	throw new Error(`Unexpected internet media type: ${JSON.stringify(internetMediaType)}.`);
};

const shortDateString = (date) => {
	date = date || new Date();

	const shortDate = date.toISOString().split("T")[0];

	return shortDate;
};

const getBeforeKey = (generatedId, extension) => `before/${shortDateString()}/${Date.now()}_${generatedId}${extension}`;

const getAfterKey = (beforeKey) => beforeKey.replace(/^before\//, "after/");

const getSignedS3Url = async (key, imageContentType) => {
	// const clientFilename = (query.filename || "");
	// TODO: save original client file name.
	// const metadata = {
	//     name: clientFilename
	// },

	const s3 = new aws.S3();
	const s3Parameters = {
		ACL: "public-read",
		Bucket: S3_BUCKET,
		ContentType: imageContentType || undefined,
		Expires: 60,
		Key: key,
		// TODO: save original client file name.
		// Metadata: metadata
	};

	const signedUrl = await s3.getSignedUrl("putObject", s3Parameters);

	return signedUrl;
};

const blitlineCreateAddOverlayJob = async (beforeKey, afterKey, signedAfterUrl) => {
	if (!beforeKey.startsWith("before/")) {
		throw new Error("beforeKey must start with before/.");
	}

	if (!afterKey.startsWith("after/")) {
		throw new Error("afterKey must start with after/.");
	}

	logger.trace("Creating add overlay job", beforeKey, afterKey, signedAfterUrl);

	const blitline = new Blitline();
	const s3FlagOverlayUrl = getS3Url("/resources/image/overlay/rainbow-flag-superwide.svg");
	const job = {
		/* eslint-disable camelcase */
		application_id: BLITLINE_APP_ID,
		functions: [
			{
				functions: [
					{
						functions: [
							{
								name: "modulate",
								params: {
									brightness: 1.2,
									saturation: 1.25,
								},

								save: {
									image_identifier: afterKey,
									s3_destination: {
										headers: {
											// TODO: save original client file name.
											// "x-amz-meta-name": clientFilename
											"x-amz-acl": "public-read",
										},
										signed_url: signedAfterUrl,
									},
								},
							},
						],
						name: "dissolve",
						params: {
							// This file used to be hosted locally, but Blitline seemed to not be able to load it from the main domain.
							// "src": "https://fly-the-rainbow-flag.com/resources/image/overlay/rainbow-flag-superwide.svg",
							dst_percentage: 0.7,
							gravity: "CenterGravity",
							scale_to_match: true,
							src: s3FlagOverlayUrl,
							src_percentage: 0.3,
						},
					},
				],
				name: "modulate",
				params: {
					saturation: 0.1,
				},
			},
		],
		src: getS3UrlFromKey(beforeKey),
		wait_retry_delay: 5,
	};
	/* eslint-enable camelcase */

	blitline.addJob(job);

	const jobsResponse = await blitline.postJobs();

	logger.trace("Received add overlay job response", beforeKey, afterKey, signedAfterUrl, JSON.stringify(jobsResponse));

	const {
		results,
	} = jobsResponse;

	// https://www.blitline.com/docs/postback#json
	if (results.failed_image_identifiers) {
		throw new Error(`Blitline: ${JSON.stringify(beforeKey)} ${JSON.stringify(afterKey)} ${JSON.stringify(signedAfterUrl)} ${JSON.stringify(results)}`);
	}

	assert(Array.isArray(results));
	assert.strictEqual(results.length, 1);

	const result = results[0];

	assert(Array.isArray(result.images));
	assert.strictEqual(result.images.length, 1);

	const image = result.images[0];

	logger.trace(
		"Blitline",
		"Success",
		beforeKey,
		afterKey,
		signedAfterUrl,
		image,
	);

	const data = {
		identifier: image.image_identifier,
		url: image.s3_url,
	};

	return data;
};

const waitForS3Object = async (key) => {
	const s3 = new aws.S3();
	const s3Parameters = {
		Bucket: S3_BUCKET,
		Key: key,
		delay: 1,
		maxAttempts: 300,
	};

	await s3.waitFor("objectExists", s3Parameters);
};

// Based on https://github.com/flyingsparx/NodeDirectUploader
// Apache 2.0 license.
// By https://github.com/flyingsparx/
// https://devcenter.heroku.com/articles/s3-upload-node
export default async function handleUpload(request, response) {
	// TODO: use an express router.
	if (!verifyRequest(request, response)) {
		return;
	}

	const imageContentType = request.query.filetype;
	const extension = getExtensionFromInternetMediaType(imageContentType);
	const generatedId = uuidv4();
	const beforeKey = getBeforeKey(generatedId, extension);
	const afterKey = getAfterKey(beforeKey);
	const beforeUrl = getS3UrlFromKey(beforeKey);
	const afterUrl = getS3UrlFromKey(afterKey);

	const signedBeforeUrl = await getSignedS3Url(beforeKey, imageContentType);
	const result = {
		afterUrl,
		beforeUrl,
		signedRequest: signedBeforeUrl,
	};
	const data = JSON.stringify(result);
	response.contentType("application/json");
	response.end(data);

	// NOTE: minimal server-client communication, instead polling S3.
	// 1. the client will upload the original image, then poll for the processed image to finish.
	// 2. the server will poll for the client's original image upload to finish, then trigger the image processing (and wait for the result, which is optional in this flow).
	logger.trace("Waiting for client file upload", beforeKey);
	await waitForS3Object(beforeKey);
	logger.trace("Client file upload done", beforeKey);

	const signedAfterUrl = await getSignedS3Url(afterKey);
	await blitlineCreateAddOverlayJob(beforeKey, afterKey, signedAfterUrl);

	logger.trace("Waiting for Blitline file upload", afterKey);
	await waitForS3Object(afterKey);
	logger.trace("Client file upload done", afterKey);

	logger.info("Success", beforeUrl, afterUrl);
}
