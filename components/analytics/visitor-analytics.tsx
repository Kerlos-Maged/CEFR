"use client";

import { useEffect } from "react";

import { sendAnalyticsEvent } from "@/lib/analytics/client";

export function VisitorAnalytics({ publicId, language }: { publicId: string; language: string }) {
  useEffect(() => {
    sendAnalyticsEvent({ event_type: "page_view", public_id: publicId, language_code: language });
  }, [publicId, language]);

  return null;
}
