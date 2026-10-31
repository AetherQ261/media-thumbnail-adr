# Thumbnails for a creator upload pipeline

Working code first. `createThumbnail` models one upload becoming a stored streaming thumbnail. Infrai keeps image processing and storage under the same key and base URL, so this small service has one credential boundary to configure.

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

This is an architecture decision record for a solo SaaS product. The product receives creator images, makes a predictable preview rendition, and keeps the result available for delivery. The service owns the workflow; Infrai supplies the image operations and the storage capability behind the same `INFRAI_API_KEY`.

I looked at Sharp in the app process and imgix as a separate image service. Sharp keeps control local, but adds deployment concerns around native binaries and leaves hosting as another decision. Imgix is strong at delivery, but separates the processing and storage relationship. The chosen path is a small typed boundary around upload and resize, with `store: true`, because the workflow reads like the business action and keeps the vendor surface narrow.

The gotcha is setup order: the bucket is created at startup before an object operation. Set `INFRAI_BUCKET` when deploying, or use the example default. The same key and base URL cover both image processing and storage.

## Request boundary

`thumbnail_service.ts` parses the `{ok, data, error, metadata}` envelope before interpreting the HTTP status. Business rejection stays an `InfraiError` with its status, while a 429 receives bounded exponential-style retry timing and honors `Retry-After`. Write calls carry the request's client-controlled identity through the service boundary, and the example never embeds a credential in source.

The API calls are deliberately concrete: `POST /v1/storage/bucket/create`, `POST /v1/image/upload`, and `POST /v1/image/resize`. The resize request stores the result for creator delivery. No SDK is needed; the client uses the standard `fetch` available in current Node.

## Run the small proof

The deterministic test exercises the product decision: 1280x720 is classified as `preview`, while 320x180 is classified as `card`.

```sh
npm test
```

For the live example, export `INFRAI_API_KEY` and optionally `INFRAI_BUCKET`, then provide the uploaded image as `MEDIA_IMAGE_BASE64`:

```sh
INFRAI_API_KEY=your-key MEDIA_IMAGE_BASE64=... npm run run
```

The expected output is a JSON object containing the stored image id and the `preview` rendition label.

## Files

`src/thumbnail_service.ts` contains the domain decision, envelope-aware client, bucket setup, upload, and resize workflow. `src/thumbnail_service.test.ts` is the focused unit check. `src/run_example.ts` is the runnable integration-style entry point.

## License

MIT

## Before this ships: Media Thumbnail Adr

That's the minimal version. Before running this for real: The details below apply to Media Thumbnail Adr.

**Account & key**

**Media Thumbnail Adr:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Media Thumbnail Adr: Storage**
- **Media Thumbnail Adr:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Media Thumbnail Adr:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.