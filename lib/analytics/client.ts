"use client";

export type AnalyticsEventType = "page_view" | "language_select" | "audio_play" | "audio_complete";
export type AnalyticsReferrerType = "qr" | "direct" | "internal" | "external";

const SESSION_KEY = "heritage-analytics-session";

function analyticsAllowed(): boolean {
  const browser = navigator as Navigator & {
    globalPrivacyControl?: boolean;
    doNotTrack?: string | null;
  };
  return browser.doNotTrack !== "1" && browser.globalPrivacyControl !== true;
}

function getSessionId(): string {
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

function getReferrerType(): AnalyticsReferrerType {
  if (!document.referrer) return "direct";
  try {
    return new URL(document.referrer).origin === window.location.origin ? "internal" : "external";
  } catch {
    return "direct";
  }
}

/** Analytics is fire-and-forget, cookie-free, and never affects page rendering. */
export function sendAnalyticsEvent(input: {
  event_type: AnalyticsEventType;
  public_id?: string;
  language_code?: string;
}): void {
  if (!analyticsAllowed()) return;

  const body = {
    ...input,
    session_id: getSessionId(),
    referrer_type: getReferrerType(),
  };
  void fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "omit",
    keepalive: true,
  }).catch(() => undefined);
}
