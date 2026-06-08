# Laravel-Handled S3 Uploads

Wasiy will handle amenity photo uploads through the Laravel API in v1, validating multipart uploads server-side and storing files on S3-compatible object storage. Direct browser-to-object-storage uploads are deferred until upload volume or performance requirements justify the extra signed URL and CORS complexity.
