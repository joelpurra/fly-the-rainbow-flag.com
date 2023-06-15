import aws from "aws-sdk";

import {
	AWS_ACCESS_KEY_ID,
	AWS_REGION,
	AWS_SECRET_ACCESS_KEY,
} from "./configuration.js";

const initializeAws = () => {
	aws.config.update({
		accessKeyId: AWS_ACCESS_KEY_ID,
		region: AWS_REGION,
		secretAccessKey: AWS_SECRET_ACCESS_KEY,
		signatureVersion: "v4",
	});
};

const hasInitialized = false;

export const initializeAwsIfNeeded = () => {
	// TODO: dynamically determine if the provided access and secret keys are valid.
	if (!hasInitialized) {
		initializeAws();
	}
};
