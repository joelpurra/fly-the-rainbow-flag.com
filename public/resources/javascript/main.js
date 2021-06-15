(() => {
	// From https://web.dev/cross-origin-resource-sharing/
	// By Monsur Hossain
	// Apache 2.0 License
	const createCORSRequest = (method, url) => {
		let xhr = new XMLHttpRequest();
		if ("withCredentials" in xhr) {
			// Check if the XMLHttpRequest object has a "withCredentials" property.
			// "withCredentials" only exists on XMLHTTPRequest2 objects.
			xhr.open(method, url, true);
		} else if (typeof XDomainRequest !== "undefined") {
			// Otherwise, check if XDomainRequest.
			// XDomainRequest only exists in IE, and is IE"s way of making CORS requests.
			// eslint-disable-next-line no-undef
			xhr = new XDomainRequest();
			xhr.open(method, url);
		} else {
			// Otherwise, CORS is not supported by the browser.
			xhr = null;
		}

		return xhr;
	};

	(() => {
		const waitForAfterImage = (afterUrl) => {
			// Expecting a Access-Control-Allow-Origin error here, as there it no such header until the file exists.
			const logAndRetry = (evt) => {
				// eslint-disable-next-line no-console
				console.error("Could not check for after image", evt);
				showError("There was a problem checking for the rainbowified photo =(");

				retryCheckAndWait();
			};

			const setImage = () => {
				document.querySelector("#after-image").src = afterUrl;
				document.querySelector("#after").className = document.querySelector("#after").className.replace(/is-processing/g, "");
			};

			const retryCheckAndWait = () => {
				setTimeout(() => {
					waitForAfterImage(afterUrl);
				}, 500);
			};

			const xhr = createCORSRequest("GET", afterUrl);

			if (!xhr) {
				showError("This browser does not seem support checking for the rainbowified photo =(");

				return;
			}

			xhr.addEventListener("load", () => {
				if (xhr.status === 200) {
					setImage();
				} else {
					retryCheckAndWait();
				}
			});

			xhr.addEventListener("error", logAndRetry, false);
			xhr.addEventListener("abort", logAndRetry, false);
			xhr.addEventListener("timeout", logAndRetry, false);

			xhr.send();
		};

		// Based on https://github.com/flyingsparx/NodeDirectUploader
		// Apache 2.0 license.
		// By https://github.com/flyingsparx/
		// https://devcenter.heroku.com/articles/s3-upload-node
		/*
                Function to carry out the actual PUT request to S3 using the signed request from the app.
            */
		const uploadFile = (file, signedRequest, beforeUrl, afterUrl, _filename) => {
			const xhr = createCORSRequest("PUT", signedRequest);

			if (!xhr) {
				showError("This browser does not seem to support uploading photos to the server =(");

				return;
			}

			xhr.setRequestHeader("x-amz-acl", "public-read");
			// TODO: save original client file name.
			// xhr.setRequestHeader("x-amz-meta-name", filename);
			xhr.addEventListener("load", () => {
				if (xhr.status === 200) {
					document.querySelector("#before-image").src = beforeUrl;
					document.querySelector("#before").className = document.querySelector("#before").className.replace(/is-processing/g, "");

					waitForAfterImage(afterUrl);
				}
			});

			xhr.addEventListener("error", (evt) => {
				// eslint-disable-next-line no-console
				console.error("uploadFile", xhr, evt);

				showError("Could not upload file =(");
			});

			xhr.send(file);
		};

		/*
                Function to get the temporary signed request from the app.
                If request successful, continue to upload the file using this signed
                request.
            */
		const getSignedRequest = (file) => {
			const fileName = (file.name || "");
			const xhr = new XMLHttpRequest();
			xhr.open("GET", "/sign-s3?filename=" + file.name + "&filetype=" + file.type);
			xhr.onreadystatechange = function () {
				if (xhr.readyState === 4) {
					if (xhr.status === 200) {
						const response = JSON.parse(xhr.responseText);
						uploadFile(file, response.signedRequest, response.beforeUrl, response.afterUrl, fileName);
					} else {
						// eslint-disable-next-line no-console
						console.error("getSignedRequest", xhr);
						showError("Could not get signed URL =(");
					}
				}
			};

			xhr.send();
		};

		/*
            Function called when file input updated. If there is a file selected, then
            start upload procedure by asking for a signed request from the app.
            */
		const initUpload = () => {
			const {
				files,
			} = document.querySelector("#file-input");
			const file = files[0];

			if (file === null) {
				return;
			}

			document.querySelector("#after").className += " is-processing";
			document.querySelector("#before").className += " is-processing";

			getSignedRequest(file);
		};

		const showError = (message) => {
			document.querySelector("#log").innerHTML += "<p>" + message + "</p>";
		};

		/*
           Bind listeners when the page loads.
        */
		(() => {
			document.querySelector("#file-input").addEventListener("change", initUpload);
		})();
	})();
})();
