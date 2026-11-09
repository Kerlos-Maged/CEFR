import QRCode from "qrcode";
import Image from "next/image";
import { headers } from "next/headers";

import { publicEnv } from "@/lib/env";

export async function ChurchQr({ slug, lang, name }: { slug: string; lang: string; name: string }) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const isLocalHost = host?.startsWith("localhost") || host?.startsWith("127.0.0.1");
  const origin =
    publicEnv.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    (host
      ? `${requestHeaders.get("x-forwarded-proto") ?? (isLocalHost ? "http" : "https")}://${host}`
      : null);
  const path = `/${encodeURIComponent(lang)}/churches/${encodeURIComponent(slug)}`;
  const url = origin ? `${origin}${path}` : null;
  const qr = url
    ? await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 2, width: 288 })
    : null;
  const isArabic = lang === "ar";

  return (
    <aside className="church-qr-card" aria-labelledby="church-qr-heading">
      <div className="church-qr-copy">
        <p className="eyebrow">{isArabic ? "دخول مباشر" : "KEEP THIS PLACE CLOSE"}</p>
        <h2 id="church-qr-heading">{isArabic ? "رمز الكنيسة" : "Church profile QR"}</h2>
        <p>
          {isArabic
            ? "امسح الرمز لفتح صفحة الكنيسة ومجموعتها المنشورة."
            : "Scan to open this church profile and its published heritage records."}
        </p>
        {url ? (
          <a href={url} className="church-qr-url">
            {url}
          </a>
        ) : null}
        {qr ? (
          <a className="church-qr-download" href={qr} download={`church-${slug}-qr.png`}>
            {isArabic ? "تنزيل رمز QR" : "Download QR code"}
          </a>
        ) : (
          <p className="church-qr-note">
            {isArabic
              ? "يتعذر إنشاء الرمز من عنوان الطلب الحالي."
              : "A public site address is needed to create a shareable QR."}
          </p>
        )}
      </div>
      {qr ? (
        <Image
          unoptimized
          className="church-qr-image"
          src={qr}
          width={144}
          height={144}
          alt={isArabic ? `رمز QR لصفحة ${name}` : `QR code for ${name}`}
        />
      ) : null}
    </aside>
  );
}
