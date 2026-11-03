import assert from "node:assert/strict";
import { decideAnnouncement } from "./broadcast_announcement.ts";

const base = {
  channel: "storefront-creators",
  event: "asset.processed",
  data: { assetId: "asset-7", title: "New product media", body: "Ready for creator delivery" },
  account_id: "shop-42"
};

assert.deepEqual(decideAnnouncement(true, base), base);
assert.equal(decideAnnouncement(false, base), null);
assert.equal(decideAnnouncement(true, { ...base, data: { ...base.data, title: "" } }), null);
console.log("announcement decision test passed");
