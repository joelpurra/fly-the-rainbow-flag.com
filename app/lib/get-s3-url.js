import {
	AWS_REGION,
	S3_BUCKET,
} from "./configuration.js";

// TODO: use a ready-made AWS S3 method instead.
export const getS3Domain = () => `${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com`;

export const getS3BaseUrl = () => {
	// TODO: use a ready-made AWS S3 method instead.
	const s3Domain = getS3Domain();

	return `https://${s3Domain}`;
};

export const getS3Url = (pathname) => {
	// TODO: use a ready-made AWS S3 method instead.
	if (!pathname.startsWith("/")) {
		throw new Error("Key must start with a slash.");
	}

	const s3BaseUrl = getS3BaseUrl();
	const s3Url = new URL(pathname, s3BaseUrl);

	return s3Url.toString();
};

export const getS3UrlFromKey = (key) => {
	// TODO: use a ready-made AWS S3 method instead.
	if (key.startsWith("/")) {
		throw new Error("Key must not start with a slash.");
	}

	return getS3Url(`/${key}`);
};
