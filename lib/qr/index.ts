import QRCode from "qrcode";

import { publicEnv } from "@/lib/env";
import { isValidPublicId } from "@/lib/validation/public-id";

/**
 * Permanent public URL for an object's QR code: `{NEXT_PUBLIC_SITE_URL}/o/{publicId}`.
 * The contract is stable and language-independent (api-contracts.md §11). Returns `null` for an
 * invalid id or when the site origin is not configured.
 */
export function objectPublicUrl(publicId: string): string | null {
  if (!isValidPublicId(publicId)) return null;
  const origin = publicEnv.NEXT_PUBLIC_SITE_URL;
  if (!origin) return null;
  return `${origin.replace(/\/$/, "")}/o/${publicId}`;
}

export type QrFormat = "svg" | "png";

const QR_OPTIONS = {
  errorCorrectionLevel: "M",
  margin: 2,
  width: 512,
} as const;

/** Renders the QR code for a public object URL as an SVG string. */
export async function renderQrSvg(publicId: string): Promise<string | null> {
  const url = objectPublicUrl(publicId);
  if (!url) return null;
  return QRCode.toString(url, { ...QR_OPTIONS, type: "svg" });
}

/** Renders the QR code for a public object URL as a PNG buffer. */
export async function renderQrPng(publicId: string): Promise<Buffer | null> {
  const url = objectPublicUrl(publicId);
  if (!url) return null;
  return QRCode.toBuffer(url, { ...QR_OPTIONS, type: "png" });
}
