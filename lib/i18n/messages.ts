import { DEFAULT_LANGUAGE, isSupportedLanguage } from "./languages";

/**
 * Minimal bilingual UI dictionary for the public shell (FR-ML-1/RTL). Content itself is
 * localized in the database; these are the surrounding labels and status messages.
 */
export interface Messages {
  siteName: string;
  languageLabel: string;
  mediaHeading: string;
  claimsHeading: string;
  sourcesHeading: string;
  attributionLabel: string;
  noDescription: string;
  fallbackNotice: string;
  verificationVerified: string;
  verificationUncertain: string;
  verificationDisputed: string;
  archivedTitle: string;
  archivedBody: string;
  notFoundTitle: string;
  notFoundBody: string;
  backendUnavailableTitle: string;
  backendUnavailableBody: string;
  adminTitle: string;
  signInTitle: string;
  signInBody: string;
  signInEmailLabel: string;
  signInButton: string;
  signInSentTitle: string;
  signInSentBody: string;
  signInErrorTitle: string;
  signInErrorBody: string;
  signOutButton: string;
  noAccessTitle: string;
  noAccessBody: string;
}

const EN: Messages = {
  siteName: "Coptic Heritage Digital Platform",
  languageLabel: "Language",
  mediaHeading: "Media",
  claimsHeading: "Historical notes",
  sourcesHeading: "Sources",
  attributionLabel: "Credit",
  noDescription: "A description is not available for this object yet.",
  fallbackNotice:
    "Showing {language} content because a {requested} translation is not available yet.",
  verificationVerified: "Verified",
  verificationUncertain: "Uncertain",
  verificationDisputed: "Disputed",
  archivedTitle: "This object is no longer available",
  archivedBody:
    "This heritage record has been archived. The QR code remains valid and still points here for reference.",
  notFoundTitle: "Object not found",
  notFoundBody:
    "This link does not match any published heritage object. Check the QR code or ask at the church.",
  backendUnavailableTitle: "Content temporarily unavailable",
  backendUnavailableBody:
    "The content service is not configured in this environment, so object details cannot be shown.",
  adminTitle: "Content administration",
  signInTitle: "Sign in",
  signInBody: "Enter your email address and we will send you a secure sign-in link.",
  signInEmailLabel: "Email address",
  signInButton: "Send sign-in link",
  signInSentTitle: "Check your email",
  signInSentBody: "If that address is authorized, a sign-in link is on its way.",
  signInErrorTitle: "Sign-in link problem",
  signInErrorBody: "That sign-in link is invalid or has expired. Please request a new one.",
  signOutButton: "Sign out",
  noAccessTitle: "No access",
  noAccessBody: "Your account is signed in but has no role on this platform yet.",
};

const AR: Messages = {
  siteName: "منصة التراث القبطي الرقمية",
  languageLabel: "اللغة",
  mediaHeading: "الوسائط",
  claimsHeading: "ملاحظات تاريخية",
  sourcesHeading: "المصادر",
  attributionLabel: "المصدر",
  noDescription: "لا يتوفر وصف لهذا العنصر بعد.",
  fallbackNotice: "يُعرض المحتوى باللغة {language} لعدم توفر ترجمة باللغة {requested} بعد.",
  verificationVerified: "موثّق",
  verificationUncertain: "غير مؤكد",
  verificationDisputed: "محل خلاف",
  archivedTitle: "هذا العنصر لم يعد متاحاً",
  archivedBody:
    "تمت أرشفة هذا السجل التراثي. يبقى رمز الاستجابة السريعة صالحاً ويشير إلى هنا للرجوع.",
  notFoundTitle: "العنصر غير موجود",
  notFoundBody:
    "هذا الرابط لا يطابق أي عنصر تراثي منشور. تحقق من رمز الاستجابة السريعة أو اسأل في الكنيسة.",
  backendUnavailableTitle: "المحتوى غير متاح مؤقتاً",
  backendUnavailableBody: "خدمة المحتوى غير مهيأة في هذه البيئة، لذا يتعذر عرض تفاصيل العنصر.",
  adminTitle: "إدارة المحتوى",
  signInTitle: "تسجيل الدخول",
  signInBody: "أدخل بريدك الإلكتروني وسنرسل لك رابط دخول آمن.",
  signInEmailLabel: "البريد الإلكتروني",
  signInButton: "إرسال رابط الدخول",
  signInSentTitle: "تحقق من بريدك الإلكتروني",
  signInSentBody: "إذا كان هذا العنوان مصرّحاً به، فرابط الدخول في طريقه إليك.",
  signInErrorTitle: "مشكلة في رابط الدخول",
  signInErrorBody: "رابط الدخول غير صالح أو منتهي الصلاحية. يرجى طلب رابط جديد.",
  signOutButton: "تسجيل الخروج",
  noAccessTitle: "لا يوجد وصول",
  noAccessBody: "حسابك مسجّل الدخول لكن ليس له دور على هذه المنصة بعد.",
};

const MESSAGES: Record<string, Messages> = { en: EN, ar: AR };

export function getMessages(lang: string | null | undefined): Messages {
  const code = isSupportedLanguage(lang) ? (lang as string) : DEFAULT_LANGUAGE;
  return MESSAGES[code] ?? EN;
}

export function formatMessage(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match,
  );
}
