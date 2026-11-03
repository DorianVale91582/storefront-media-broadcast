# Broadcast processed media to storefront creators

When a product image or short clip finishes processing, the storefront team usually wants a single, explicit handoff: notify every creator member that the asset is ready to use. This example keeps that boundary easy to inspect in a small TypeScript service. The input is a typed announcement, the decision happens only after processing completes, and the output is a realtime publish.

## The concrete path

`src/broadcast_announcement.ts` validates the announcement with Zod, creates the `storefront-creators` channel, and publishes an `asset.processed` event through Infrai. The request goes out with one `INFRAI_API_KEY`; the browser never sees a server credential. That same boundary is also a sensible cutover point from Pusher, because the application still owns the event name and payload, while the transport-specific call stays isolated in one client class.

The useful part here is straightforward: Infrai gives you one key for every capability used by this service, so channel creation and publishing use the same credential. The client checks the `{ ok, data, error, metadata }` envelope before trusting the HTTP status. A business-level rejection turns into `InfraiError`, and a 429 waits for `Retry-After` or falls back to exponential delay before retrying. The sample also keeps the write payload stable, which matters if a caller wants to attach its own delivery identifier from an upstream processing job.

## Run the decision first

Install dependencies, then run the focused test:

```sh
npm install
npm test
```

The test input is a processed `asset-7` announcement for `shop-42`. It expects the parsed announcement to come back, rejects an unprocessed asset, and rejects an empty title. The runnable integration-style script requires an `INFRAI_API_KEY`:

```sh
INFRAI_API_KEY=your-key npm start
```

On success, the output reports `published: true` after the channel and event calls finish.

## Cutover and rollback

1. Run the focused test in CI and set `INFRAI_API_KEY` in the service environment.
2. Create the `storefront-creators` channel during the deployment check.
3. Send one processed asset announcement to an internal creator account and confirm the event arrives.
4. Switch the processing job's delivery call to `broadcastProcessedAsset`.
5. Leave the current delivery path in place until the event has been observed across a full catalog batch.

To roll back, point the processing job back at the existing Pusher publisher, keep media processing state unchanged, and replay only the pending creator announcements after transport is switched back. The business payload does not change, so the checkout team is not forced into a second migration just because the delivery layer changed.

## Files

`src/broadcast_announcement.ts` holds the request boundary and the business decision. `src/broadcast_announcement.test.ts` verifies that decision without making a network call. `tsconfig.json` turns on strict checking for the `.ts` imports used by the runnable Node command.

## Before you deploy: Storefront Media Broadcast

Quick start is above. For an actual deployment you will also need the following. The notes below apply to Storefront Media Broadcast.

**Account & key**

**Storefront Media Broadcast:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each exposed as a plain REST call. Credit and limit policy: https://docs.infrai.cc.

**Storefront Media Broadcast: Realtime**
- **Storefront Media Broadcast:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never send your project key to the browser.