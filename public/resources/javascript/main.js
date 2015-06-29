(function() {
    // https://coderwall.com/p/hy_qjw/poll-s3-for-image-using-jquery?p=1&q=
    function waitForImage(img_id, src, callback) {
        var imageSelector = "#" + img_id;
        var tries = 10;

        $("body").find(imageSelector).remove();

        setTimeout(function() {
            $("body").append("<img style='display:none;' id='" + img_id + "'/>");
            var $img = $(imageSelector);
            $img.error(function() {
                setTimeout(function() {
                    tries -= 1;
                    if (tries < 1) {
                        callback(false);
                    }
                    waitForImage(img_id, src, callback);
                }, 5000);
            });
            $img.load(function() {
                callback(true, src);
            });
            $img.attr("src", src + "?" + Math.random().toString());
        }, 1000);
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
                document.getElementById("source-image").src = beforeUrl;

                setTimeout(function() {
                    // TODO: properly poll and check that the image exists?
                    document.getElementById("resulting-image").src = afterUrl;
                }, 5000);
            }
        };
        xhr.onerror = function() {
            alert("Could not upload file.");
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
                    alert("Could not get signed URL. (Status " + xhr.status + ")");
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
            alert("No file selected.");
            return;
        }
        get_signed_request(file);
    }

    /*
       Bind listeners when the page loads.
    */
    (function() {
        document.getElementById("file_input").onchange = init_upload;
    })();
})();