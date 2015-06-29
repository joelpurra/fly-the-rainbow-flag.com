(function() {
    // Based on https://github.com/flyingsparx/NodeDirectUploader
    // Apache 2.0 license.
    // By https://github.com/flyingsparx/
    // https://devcenter.heroku.com/articles/s3-upload-node

    /*
        Function to carry out the actual PUT request to S3 using the signed request from the app.
    */
    function upload_file(file, signed_request, url) {
        var xhr = new XMLHttpRequest();
        xhr.open("PUT", signed_request);
        xhr.setRequestHeader("x-amz-acl", "public-read");
        xhr.onload = function() {
            if (xhr.status === 200) {
                document.getElementById("preview").src = url;
                document.getElementById("avatar_url").value = url;
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
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "/sign_s3?file_name=" + file.name + "&file_type=" + file.type);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    var response = JSON.parse(xhr.responseText);
                    upload_file(file, response.signed_request, response.url);
                } else {
                    alert("Could not get signed URL.");
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
        console.log("here");
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