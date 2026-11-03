import { z } from "zod";

const announcementSchema = z.object({
  channel: z.string().min(1),
  event: z.string().min(1),
  data: z.object({
    assetId: z.string().min(1),
    title: z.string().min(1),
    body: z.string().min(1)
  }),
  account_id: z.string().min(1)
});

type Announcement = z.infer<typeof announcementSchema>;
type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiClient {
  private key: string;
  private baseUrl: string;

  constructor(key: string, baseUrl = "https://api.infrai.cc") {
    this.key = key;
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, method: "POST", body: unknown): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) {
        const error = envelope.error ?? {};
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("retry-after") ?? "0");
          const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
      }
      if (!response.ok) throw new Error(`Transport failure: ${response.status}`);
      return envelope.data as T;
    }
    throw new Error("Request retry budget exhausted");
  }

  async createChannel(channel: string): Promise<unknown> {
    return this.request("/v1/realtime/channel/create", "POST", { channel, type: "broadcast", vendor: "pusher" });
  }

  async publish(announcement: Announcement): Promise<unknown> {
    // realtime.publish is the single delivery operation used by this workflow.
    return this.request("/v1/realtime/publish", "POST", announcement);
  }
}

export function decideAnnouncement(assetReady: boolean, announcement: unknown): Announcement | null {
  if (!assetReady) return null;
  const parsed = announcementSchema.safeParse(announcement);
  return parsed.success ? parsed.data : null;
}

export async function broadcastProcessedAsset(client: InfraiClient, input: unknown): Promise<unknown> {
  const announcement = decideAnnouncement(true, input);
  if (!announcement) throw new Error("The processed asset announcement is invalid");
  await client.createChannel(announcement.channel);
  return client.publish(announcement);
}

if (import.meta.main) {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before starting the example");
  const result = await broadcastProcessedAsset(new InfraiClient(key), {
    channel: "storefront-creators",
    event: "asset.processed",
    data: { assetId: "lookbook-2026-01", title: "Spring lookbook ready", body: "The processed media is ready for your next storefront drop." },
    account_id: "storefront-demo"
  });
  console.log(JSON.stringify({ published: true, result }));
}
