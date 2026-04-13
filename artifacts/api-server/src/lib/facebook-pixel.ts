import crypto from "crypto";

const FB_API_VERSION = "v19.0";
const FB_EVENTS_URL = (pixelId: string) =>
  `https://graph.facebook.com/${FB_API_VERSION}/${pixelId}/events`;

export interface FbEventData {
  eventName: string;
  value?: number;
  currency?: string;
  orderId?: string;
  userIp?: string;
  userAgent?: string;
}

function hashSha256(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export async function sendFbEvent(
  pixelId: string,
  accessToken: string,
  data: FbEventData,
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  try {
    const eventTime = Math.floor(Date.now() / 1000);

    const userData: Record<string, string> = {};
    if (data.userIp) userData.client_ip_address = data.userIp;
    if (data.userAgent) userData.client_user_agent = data.userAgent;

    const eventPayload: Record<string, unknown> = {
      event_name: data.eventName,
      event_time: eventTime,
      action_source: "website",
      user_data: userData,
    };

    if (data.value !== undefined) {
      eventPayload.custom_data = {
        value: data.value.toFixed(2),
        currency: data.currency ?? "INR",
        ...(data.orderId ? { order_id: data.orderId } : {}),
      };
    }

    const body = {
      data: [eventPayload],
      test_event_code: undefined as string | undefined,
    };

    const url = new URL(FB_EVENTS_URL(pixelId));
    url.searchParams.set("access_token", accessToken);

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await res.json() as unknown;
    if (!res.ok) {
      const errMsg = (json as any)?.error?.message ?? "Facebook API error";
      return { success: false, error: errMsg };
    }
    return { success: true, result: json };
  } catch (err: unknown) {
    return { success: false, error: String(err) };
  }
}

export async function sendFbTestEvent(
  pixelId: string,
  accessToken: string,
  testEventCode: string,
  eventName: "InitiateCheckout" | "Purchase",
  value: number,
  userIp?: string,
  userAgent?: string,
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  try {
    const eventTime = Math.floor(Date.now() / 1000);

    const userData: Record<string, string> = {};
    if (userIp) userData.client_ip_address = userIp;
    if (userAgent) userData.client_user_agent = userAgent;

    const eventPayload: Record<string, unknown> = {
      event_name: eventName,
      event_time: eventTime,
      action_source: "website",
      user_data: Object.keys(userData).length ? userData : { client_ip_address: "127.0.0.1" },
      custom_data: {
        value: value.toFixed(2),
        currency: "INR",
      },
    };

    const body = {
      data: [eventPayload],
      test_event_code: testEventCode,
    };

    const url = new URL(FB_EVENTS_URL(pixelId));
    url.searchParams.set("access_token", accessToken);

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await res.json() as unknown;
    if (!res.ok) {
      const errMsg = (json as any)?.error?.message ?? "Facebook API error";
      return { success: false, error: errMsg };
    }
    return { success: true, result: json };
  } catch (err: unknown) {
    return { success: false, error: String(err) };
  }
}
