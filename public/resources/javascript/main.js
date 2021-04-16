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
                    },

                    setImage = () => {
                        document.getElementById("after-image").src = afterUrl;
                        document.getElementById("after").className = document.getElementById("after").className.replace(/is-processing/g, "");
                    },

                    retryCheckAndWait = () => {
                        setTimeout(() => {
                            waitForAfterImage(afterUrl);
                        }, 500);
                    },
                    xhr = createCORSRequest("GET", afterUrl);

                if (!xhr) {
                    showError("This browser does not seem support checking for the rainbowified photo =(");

                    return;
                }

                xhr.addEventListener("load", function() {
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
            },

            // Based on https://github.com/flyingsparx/NodeDirectUploader
            // Apache 2.0 license.
            // By https://github.com/flyingsparx/
            // https://devcenter.heroku.com/articles/s3-upload-node
            /*
                Function to carry out the actual PUT request to S3 using the signed request from the app.
            */
            uploadFile = (file, signedRequest, beforeUrl, afterUrl, _filename) => {
                const xhr = createCORSRequest("PUT", signedRequest);

                if (!xhr) {
                    showError("This browser does not seem to support uploading photos to the server =(");

                    return;
                }

                xhr.setRequestHeader("x-amz-acl", "public-read");
                // TODO: save original client file name.
                // xhr.setRequestHeader("x-amz-meta-name", filename);
                xhr.onload = function() {
                    if (xhr.status === 200) {
                        document.getElementById("before-image").src = beforeUrl;
                        document.getElementById("before").className = document.getElementById("before").className.replace(/is-processing/g, "");

                        waitForAfterImage(afterUrl);
                    }
                };

                xhr.onerror = function(evt) {
                    // eslint-disable-next-line no-console
                    console.error("uploadFile", xhr, evt);

                    showError("Could not upload file =(");
                };

                xhr.send(file);
            },

            /*
                Function to get the temporary signed request from the app.
                If request successful, continue to upload the file using this signed
                request.
            */
            getSignedRequest = (file) => {
                const fileName = (file.name || ""),
                    xhr = new XMLHttpRequest();
                xhr.open("GET", "/sign-s3?filename=" + file.name + "&filetype=" + file.type);
                xhr.onreadystatechange = function() {
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
            },

            /*
            Function called when file input updated. If there is a file selected, then
            start upload procedure by asking for a signed request from the app.
            */
            initUpload = () => {
                const files = document.getElementById("file-input").files,
                    file = files[0];

                if (file === null) {
                    return;
                }

                document.getElementById("after").className += " is-processing";
                document.getElementById("before").className += " is-processing";

                getSignedRequest(file);
            },

            showError = (msg) => {
                document.getElementById("log").innerHTML += "<p>" + msg + "</p>";
            };

        /*
           Bind listeners when the page loads.
        */
        (() => {
            document.getElementById("file-input").onchange = initUpload;
        })();
    })();
})();
