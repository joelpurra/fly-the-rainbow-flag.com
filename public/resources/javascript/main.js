const showError = (error, message) => {
	// eslint-disable-next-line no-console
	console.error(message, error);

	document.querySelector("#log").innerHTML += "<p>" + message + "</p>";
};

const promiseTimeout = async (promise, limit) => {
	// NOTE: using promise objects for the race.
	// TODO: use bluebird?
	const timeoutPromise = new Promise((resolve) => {
		setTimeout(
			() => {
				resolve();
			},
			limit,
		);
	})
		// eslint-disable-next-line promise/prefer-await-to-then
		.then(() => {
			throw new Error(`Timeout: ${limit}`);
		});

	return Promise.race([
		promise,
		timeoutPromise,
	]);
};

const promiseSleep = async (sleep) => {
	// TODO: use bluebird?
	return new Promise((resolve, reject) => {
		setTimeout(
			() => {
				try {
					resolve();
				} catch (error) {
					reject(error);
				}
			},
			sleep,
		);
	});
};

const waitForAfterImage = async (afterUrl) => {
	// TODO: use library with retries and exponential backoff.
	let countdown = 1000;

	// NOTE: both timeout and delay, to not flood remote system.
	const timeout = 500;
	const delay = 500;

	while (countdown--) {
		const checkS3 = fetch(afterUrl, {
			method: "GET",
		});

		// eslint-disable-next-line no-await-in-loop
		await promiseTimeout(checkS3, timeout);

		// eslint-disable-next-line no-await-in-loop
		const response = await checkS3;

		if (response.ok) {
			return response;
		}

		if ([
			403,
			404,
		].includes(response.status)) {
			// eslint-disable-next-line no-await-in-loop
			await promiseSleep(delay);

			continue;
		}

		throw new Error(`${response.status} ${JSON.stringify(response.statusText)} ${JSON.stringify(afterUrl)}`);
	}

	throw new Error(`Could not find ${JSON.stringify(afterUrl)}`);
};

const uploadFile = async (file, signedRequest) => {
	const response = await fetch(signedRequest, {
		body: file,
		headers: {
			"x-amz-acl": "public-read",
			// TODO: save original client file name?
			// "x-amz-meta-name": filename,
		},
		method: "PUT",
	});

	if (!response.ok) {
		throw new Error(`${response.status} ${JSON.stringify(response.statusText)}`);
	}
};

const getSignedRequest = async (file) => {
	const url = `/sign-s3?filetype=${encodeURIComponent(file.type)}&filename=${encodeURIComponent(file.name)}`;
	const response = await fetch(url, {
		method: "GET",
	});

	if (!response.ok) {
		throw new Error(`${response.status} ${JSON.stringify(response.statusText)}`);
	}

	const data = await response.json();

	return {
		afterUrl: data.afterUrl,
		beforeUrl: data.beforeUrl,
		signedRequest: data.signedRequest,
	};
};

const rainbowify = async () => {
	const {
		files,
	} = document.querySelector("#file-input");
	const file = files[0];

	if (!file) {
		return;
	}

	document.querySelector("#after").className += " is-processing";
	document.querySelector("#before").className += " is-processing";

	try {
		// Based on https://github.com/flyingsparx/NodeDirectUploader
		// Apache 2.0 license.
		// By https://github.com/flyingsparx/
		// https://devcenter.heroku.com/articles/s3-upload-node
		const {
			afterUrl,
			beforeUrl,
			signedRequest,
		} = await getSignedRequest(file);

		await uploadFile(file, signedRequest);

		document.querySelector("#before-image").src = beforeUrl;
		document.querySelector("#before").className = document.querySelector("#before").className.replace(/is-processing/g, "");

		await waitForAfterImage(afterUrl);

		document.querySelector("#after-image").src = afterUrl;
		document.querySelector("#after").className = document.querySelector("#after").className.replace(/is-processing/g, "");
	} catch (error) {
		showError(error, "Could not upload image and add the flag =(");
	}
};

const main = () => {
	document.querySelector("#file-input").addEventListener("change", rainbowify);
};

main();
