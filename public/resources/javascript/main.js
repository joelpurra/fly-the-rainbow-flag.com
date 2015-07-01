(function() {
    // From http://www.html5rocks.com/en/tutorials/cors/
    // By Monsur Hossain
    // Apache 2.0 License
    function createCORSRequest(method, url) {
        var xhr = new XMLHttpRequest();
        if ("withCredentials" in xhr) {
            // Check if the XMLHttpRequest object has a "withCredentials" property.
            // "withCredentials" only exists on XMLHTTPRequest2 objects.
            xhr.open(method, url, true);

        } else if (typeof XDomainRequest != "undefined") {
            // Otherwise, check if XDomainRequest.
            // XDomainRequest only exists in IE, and is IE"s way of making CORS requests.
            xhr = new XDomainRequest();
            xhr.open(method, url);
        } else {
            // Otherwise, CORS is not supported by the browser.
            xhr = null;
        }

        return xhr;
    }

    function waitForAfterImage(afterUrl) {
        // Expecting a Access-Control-Allow-Origin error here, as there it no such header until the file exists.
        var xhr = createCORSRequest("GET", afterUrl);

        if (!xhr) {
            showError("This browser doesn't support checking for the rainbowified image =(");

            return;
        }

        xhr.addEventListener("load", function(evt) {
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

        function logAndRetry(evt) {
            console.error("Could not check for after image", evt);
            showError("There was a problem checking for the rainbowified image =(");

            retryCheckAndWait();
        }

        function setImage() {
            document.getElementById("after-image").src = afterUrl;
            document.getElementById("after").className = document.getElementById("after").className.replace(/is-processing/g, "");
        }

        function retryCheckAndWait() {
            setTimeout(function() {
                waitForAfterImage(afterUrl);
            }, 500);
        }
    }

    // Based on https://github.com/flyingsparx/NodeDirectUploader
    // Apache 2.0 license.
    // By https://github.com/flyingsparx/
    // https://devcenter.heroku.com/articles/s3-upload-node

    /*
        Function to carry out the actual PUT request to S3 using the signed request from the app.
    */
    function upload_file(file, signed_request, beforeUrl, afterUrl, filename) {
        var xhr = new XMLHttpRequest();
        xhr.open("PUT", signed_request);
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
            console.error("upload_file", xhr, evt);

            showError("Could not upload file =(");
        };

        xhr.send(file);
    }

    /*
        Function to get the temporary signed request from the app.
        If request successful, continue to upload the file using this signed
        request.
    */
    function get_signed_request(file) {
        var fileName = (file.name || "");
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "/sign_s3?file_name=" + file.name + "&file_type=" + file.type);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    var response = JSON.parse(xhr.responseText);
                    upload_file(file, response.signed_request, response.beforeUrl, response.afterUrl, fileName);
                } else {
                    console.error("get_signed_request", xhr);
                    showError("Could not get signed URL =(");
                }
            }
        };
        xhr.send();
    }

    /*
       Function called when file input updated. If there is a file selected, then
       start upload procedure by asking for a signed request from the app.
    */
    function init_upload() {
        var files = document.getElementById("file_input").files;
        var file = files[0];

        if (file == null) {
            return;
        }

        document.getElementById("after").className += " is-processing";
        document.getElementById("before").className += " is-processing";

        get_signed_request(file);
    }

    /*
       Bind listeners when the page loads.
    */
    (function() {
        document.getElementById("file_input").onchange = init_upload;
    })();

    function showError(msg) {
        document.getElementById("log").innerHTML += "<p>" + msg + "</p>";
    }
})();