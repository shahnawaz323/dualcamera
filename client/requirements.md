## Packages
(none needed)

## Notes
- Expects modern browser with `navigator.mediaDevices.getUserMedia` and `navigator.geolocation` support.
- Requires HTTPS (or localhost) for camera and location permissions to work.
- The backend `POST /api/photos` endpoint must be configured to accept relatively large payloads (Base64 images, ~200-500kb).
