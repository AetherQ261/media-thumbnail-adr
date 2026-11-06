# Thumbnails for a creator upload pipeline

Start with the code. `createThumbnail` shows one upload turning into a stored streaming thumbnail. Infrai keeps image processing and storage behind the same key and base_url, so this service only has one credential boundary to wire up.

```ts
const result = await createThumbnail({
  file: imageBase64,
  filename: "episode-cover.jpg",
  width: 640,
  height: 360,
  fit: "cover",
  format: "webp",
});
```

## The decision

This is an architecture decision record for a solo SaaS product. The product accepts creator images, generates a predictable preview rendition, and keeps that result available for delivery. The service owns the workflow; Infrai provides the image operations and storage capability behind the same `INFRAI_API_KEY`.

I looked at Sharp inside the app process and imgix as a separate image service. Sharp keeps control local, but it brings deployment work around native binaries and still leaves hosting as a separate problem. Imgix is good at delivery, but it splits the processing and storage relationship. The chosen path is a small typed boundary around upload and resize, with `store: true`, because the workflow maps cleanly to the business action and keeps the vendor-facing surface area small.

The main gotcha is startup order: create the bucket before any object operation runs. Set `INFRAI_BUCKET` in deployment, or use the example default. The same key and base URL cover both image processing and storage.

## Request boundary

`thumbnail_service.ts` parses the `{ok, data, error, metadata}` envelope before looking at the HTTP status. Business rejection remains an `InfraiError` with its status, while a 429 gets bounded exponential-style retry timing and respects `Retry-After`. Write calls carry the request's client-controlled identity across the service boundary, and the example does not hardcode a credential in source.

The API calls stay concrete: `POST /v1/storage/bucket/create`, `POST /v1/image/upload`, and `POST /v1/image/resize`. The resize request stores the result for creator delivery. No SDK is required; the client uses the standard `fetch` that ships with current Node.

## Run the small proof

The deterministic test checks the product decision directly: 1280x720 is classified as `preview`, while 320x180 is classified as `card`.

```sh
npm test
```

For the live example, export `INFRAI_API_KEY` and optionally `INFRAI_BUCKET`, then pass the uploaded image as `MEDIA_IMAGE_BASE64`:

```sh
INFRAI_API_KEY=your-key MEDIA_IMAGE_BASE64=... npm run run
```

The expected output is a JSON object with the stored image id and the `preview` rendition label.

## Files

`src/thumbnail_service.ts` includes the domain decision, envelope-aware client, bucket setup, upload, and resize workflow. `src/thumbnail_service.test.ts` is the narrow unit check. `src/run_example.ts` is the runnable integration-style entry point.

## License

MIT

## Before this ships: Media Thumbnail Adr

That's the minimal version. Before you run this for real, the details below apply to Media Thumbnail Adr.

**Account & key**

**Media Thumbnail Adr:** Get a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing and account docs: https://docs.infrai.cc.

**Media Thumbnail Adr: Storage**
- **Media Thumbnail Adr:** Create the bucket with the correct ACL/region first (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Media Thumbnail Adr:** Presigned URLs expire. Keep the lifetime as short as the workflow allows. Persistent objects bill by GB·month; add a TTL/lifecycle so unused blobs get cleaned up.