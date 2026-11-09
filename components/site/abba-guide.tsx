"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import {
  HANGING_CHURCH_TOUR,
  TOUR_DEFAULT_MINUTES,
  type GuideFocusMode,
  type TourPacingStatus,
} from "@/lib/content/abba-guide";
import { localizedPath } from "@/lib/i18n/paths";

const STORAGE_KEY = "abba-guide-hanging-church-v1";
const FOCUS_MODES: GuideFocusMode[] = [
  "STORYTELLING_DEEP_DIVE",
  "QUICK_HIGHLIGHTS",
  "ARCHITECTURAL_FOCUS",
];
type SavedTourState = {
  currentIndex: number;
  completedWaypoints: string[];
  skippedWaypoints: string[];
  duration: number;
  elapsedSeconds: number;
  focus: GuideFocusMode;
  running: boolean;
  restMode: boolean;
};
type GuideChatMessage = { role: "visitor" | "guide"; content: string };

function readSavedTourState(): Partial<SavedTourState> {
  if (typeof window === "undefined") return {};
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as Partial<SavedTourState>) : {};
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return {};
  }
}

function subscribeToHydration() {
  return () => {};
}

function getClientReadySnapshot() {
  return true;
}

function getServerReadySnapshot() {
  return false;
}

export function AbbaGuide({ lang }: { lang: string }) {
  const ar = lang === "ar";
  const [savedState] = useState(readSavedTourState);
  const [currentIndex, setCurrentIndex] = useState(() =>
    Number.isInteger(savedState.currentIndex)
      ? Math.min(Math.max(savedState.currentIndex!, 0), HANGING_CHURCH_TOUR.length - 1)
      : 0,
  );
  const [completedWaypoints, setCompletedWaypoints] = useState(() =>
    Array.isArray(savedState.completedWaypoints) ? savedState.completedWaypoints : [],
  );
  const [skippedWaypoints, setSkippedWaypoints] = useState(() =>
    Array.isArray(savedState.skippedWaypoints) ? savedState.skippedWaypoints : [],
  );
  const [duration, setDuration] = useState(() =>
    [30, 45, 60].includes(savedState.duration ?? 0) ? savedState.duration! : TOUR_DEFAULT_MINUTES,
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    Number.isFinite(savedState.elapsedSeconds) ? Math.max(0, savedState.elapsedSeconds!) : 0,
  );
  const [focus, setFocus] = useState<GuideFocusMode>(() =>
    FOCUS_MODES.includes(savedState.focus as GuideFocusMode)
      ? savedState.focus!
      : "STORYTELLING_DEEP_DIVE",
  );
  const [running, setRunning] = useState(() => savedState.running === true);
  const [restMode, setRestMode] = useState(() => savedState.restMode === true);
  const [question, setQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState<GuideChatMessage[]>([
    {
      role: "guide",
      content: ar
        ? "أنا رفيق هذا المسار. اسألني عن المحطة الحالية أو محتوى الجولة ومصادرها."
        : "I’m your companion for this route. Ask about the current stop, the guide, or its sources.",
    },
  ]);
  const chatLogRef = useRef<HTMLDivElement>(null);
  const ready = useSyncExternalStore(
    subscribeToHydration,
    getClientReadySnapshot,
    getServerReadySnapshot,
  );

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        currentIndex,
        completedWaypoints,
        skippedWaypoints,
        duration,
        elapsedSeconds,
        focus,
        running,
        restMode,
      }),
    );
  }, [
    currentIndex,
    completedWaypoints,
    skippedWaypoints,
    duration,
    elapsedSeconds,
    focus,
    running,
    restMode,
    ready,
  ]);

  useEffect(() => {
    if (!running || restMode) return;
    const timer = window.setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [running, restMode]);

  useEffect(() => {
    const log = chatLogRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [chatMessages]);

  const waypoint = HANGING_CHURCH_TOUR[currentIndex];
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const remainingMinutes = Math.max(0, duration - elapsedMinutes);
  const upcomingMinutes = HANGING_CHURCH_TOUR.slice(currentIndex)
    .filter((stop) => !completedWaypoints.includes(stop.id) && !skippedWaypoints.includes(stop.id))
    .reduce((total, stop) => total + stop.minutes, 0);
  const isComplete =
    completedWaypoints.length + skippedWaypoints.length >= HANGING_CHURCH_TOUR.length;
  const pacing: TourPacingStatus = useMemo(() => {
    const progress =
      (completedWaypoints.length + skippedWaypoints.length) / HANGING_CHURCH_TOUR.length;
    const expected = Math.min(1, elapsedSeconds / (duration * 60));
    if (progress - expected > 0.18) return "AHEAD_OF_SCHEDULE";
    if (expected - progress > 0.28) return "BEHIND_SCHEDULE";
    return "ON_TRACK";
  }, [completedWaypoints.length, skippedWaypoints.length, elapsedSeconds, duration]);

  function completeCurrent() {
    setCompletedWaypoints((current) =>
      current.includes(waypoint.id) ? current : [...current, waypoint.id],
    );
    if (currentIndex < HANGING_CHURCH_TOUR.length - 1) setCurrentIndex(currentIndex + 1);
    else setRunning(false);
  }

  function simplifyRoute() {
    const upcomingStops = HANGING_CHURCH_TOUR.slice(currentIndex, -1)
      .map((stop) => stop.id)
      .filter((id) => !completedWaypoints.includes(id));
    setSkippedWaypoints((current) => [...new Set([...current, ...upcomingStops])]);
    setCurrentIndex(HANGING_CHURCH_TOUR.length - 1);
    setFocus("QUICK_HIGHLIGHTS");
  }

  function resetTour() {
    setCurrentIndex(0);
    setCompletedWaypoints([]);
    setSkippedWaypoints([]);
    setElapsedSeconds(0);
    setRunning(false);
    setRestMode(false);
    setFocus("STORYTELLING_DEEP_DIVE");
    window.localStorage.removeItem(STORAGE_KEY);
  }

  function askGuide(prompt: string) {
    const normalized = prompt.toLowerCase();
    let response: string;
    if (
      normalized.includes("date") ||
      normalized.includes("old") ||
      normalized.includes("age") ||
      normalized.includes("متى") ||
      normalized.includes("عمر")
    ) {
      response = ar
        ? "تؤرخ وزارة السياحة والآثار الكنيسة إلى القرنين الرابع والخامس، مع تاريخ لاحق كمقر بابوي في القاهرة. راجع صفحة المصدر للتفاصيل."
        : "The Ministry dates the church to the 4th–5th centuries and notes its later use as a papal residence in Cairo. Open the source for details.";
    } else if (
      normalized.includes("ceiling") ||
      normalized.includes("ark") ||
      normalized.includes("سقف") ||
      normalized.includes("سفينة")
    ) {
      response = ar
        ? "تصف الوزارة السقف الخشبي بأنه على هيئة سفينة نوح. هذا وصف موثق؛ أما المعاني الرمزية الأخرى فتحتاج إلى مصدر محدد."
        : "The Ministry describes the wooden ceiling as shaped like Noah’s Ark. That description is sourced; other symbolic readings need their own reference.";
    } else if (normalized.includes("pulpit") || normalized.includes("منبر")) {
      response = ar
        ? "تؤرخ الوزارة المنبر الرخامي إلى القرن الحادي عشر. تختلف بعض الأوصاف في تفاصيله، لذلك لا نثبت هنا عدداً مختلفاً عليه."
        : "The Ministry dates the marble pulpit to the 11th century. Some descriptions differ on details, so this guide avoids an unverified count.";
    } else if (normalized.includes("icon") || normalized.includes("أيقون")) {
      response = ar
        ? "تذكر الوزارة أن أقدم أيقونات المجموعة تعود إلى القرن الخامس عشر، وأن معظم البقية من أواخر القرن الثامن عشر. استخدم بطاقة العرض للتعرف إلى أيقونة بعينها."
        : "The Ministry dates the oldest icons in the collection to the 15th century and most others to the late 18th. Use the display label to identify an individual icon.";
    } else if (
      normalized.includes("candle") ||
      normalized.includes("شمعدان") ||
      normalized.includes("شمعة")
    ) {
      response = ar
        ? "لا يحتوي السجل الحالي على معلومة موثقة عن هذا العنصر تحديداً. أخبرني باسم أو وصف القطعة كما يظهر على بطاقتها، أو اسأل العاملين في الموقع."
        : "The current record has no verified note about that specific item. Share its display label, or ask the site staff for an identification.";
    } else if (
      normalized.includes("where am i") ||
      normalized.includes("current stop") ||
      normalized.includes("أين أنا") ||
      normalized.includes("المحطة الحالية")
    ) {
      response = ar
        ? `أنت في محطة ${waypoint.title.ar}. ابحث عن هذا المعلم: ${waypoint.anchor.ar}`
        : `You’re at ${waypoint.title.en}. Look for this feature: ${waypoint.anchor.en}`;
    } else if (
      normalized.includes("guide") ||
      normalized.includes("route") ||
      normalized.includes("what can you") ||
      normalized.includes("what is this") ||
      normalized.includes("what does this guide") ||
      normalized.includes("الدليل") ||
      normalized.includes("المسار") ||
      normalized.includes("ماذا تقدم") ||
      normalized.includes("ماذا يقدم")
    ) {
      response = ar
        ? "أرشدك في مسار الكنيسة المعلقة محطةً بعد محطة، وأشرح ما تراه، وسياقه التاريخي والمعماري، والمصادر التي يستند إليها الدليل. يمكنك أيضاً ضبط وقت الجولة واختيار قصة معمقة أو أبرز النقاط أو التركيز المعماري."
        : "I guide you through the Hanging Church one stop at a time, explain what you can look for, add historical and architectural context, and point to the sources behind the guide. You can also set your tour time and choose a deep story, quick highlights, or architecture focus.";
    } else {
      response = ar
        ? "لا أملك في هذا الدليل معلومة موثقة عن هذا السؤال بعد. أستطيع مساعدتك في تاريخ الكنيسة أو السقف أو المنبر أو مجموعة الأيقونات."
        : "I don’t have a verified note for that question in this guide yet. I can help with the church’s dating, ceiling, pulpit, or icon collection.";
    }
    setChatMessages((messages) => [
      ...messages,
      { role: "visitor", content: prompt },
      {
        role: "guide",
        content: `${ar ? `في محطة ${waypoint.title.ar}: ` : `At ${waypoint.title.en}: `}${response}`,
      },
    ]);
    setQuestion("");
  }

  const story =
    focus === "QUICK_HIGHLIGHTS"
      ? waypoint.quick
      : focus === "ARCHITECTURAL_FOCUS"
        ? waypoint.architecture
        : waypoint.story;
  const focusLabel = (mode: GuideFocusMode) =>
    mode === "STORYTELLING_DEEP_DIVE"
      ? ar
        ? "قصة معمقة"
        : "Deep story"
      : mode === "QUICK_HIGHLIGHTS"
        ? ar
          ? "أبرز النقاط"
          : "Quick highlights"
        : ar
          ? "تركيز معماري"
          : "Architecture focus";

  if (!ready) {
    return (
      <div
        className="bg-card border-sand min-h-96 animate-pulse rounded-2xl border"
        aria-busy="true"
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-4">
      <header className="overflow-hidden rounded-[1.6rem] bg-[#132a3a] text-white shadow-[var(--shadow-soft)]">
        <div className="grid gap-6 p-6 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Link
              href={localizedPath(lang, "/churches/hanging-church")}
              className="text-xs font-semibold text-[#f2b8a8] underline underline-offset-4"
            >
              {ar ? "الكنيسة المعلقة · مصر القديمة" : "The Hanging Church · Old Cairo"}
            </Link>
            <p className="mt-5 text-xs font-bold tracking-[0.2em] text-[#f2b8a8] uppercase">
              Abba Guide · {ar ? "رفيق الجولة" : "On-site companion"}
            </p>
            <h1 className="mt-2 font-serif text-4xl sm:text-5xl">
              {ar ? "لنتأمل المكان معاً" : "Let’s explore this place"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70">
              {ar
                ? "مسار تجريبي موثق للكنيسة المعلقة. سجّل وصولك يدوياً عند كل محطة؛ لا يتتبع هذا الدليل موقعك."
                : "A sourced sample route for the Hanging Church. Check in manually at each stop; this guide does not track your location."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <label className="flex flex-col gap-1 text-xs text-white/70">
              {ar ? "الوقت المتاح" : "Time available"}
              <select
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
                className="min-h-11 rounded-lg border border-white/20 bg-white/10 px-3 text-sm text-white"
              >
                <option className="text-ink" value={30}>
                  30 {ar ? "دقيقة" : "min"}
                </option>
                <option className="text-ink" value={45}>
                  45 {ar ? "دقيقة" : "min"}
                </option>
                <option className="text-ink" value={60}>
                  60 {ar ? "دقيقة" : "min"}
                </option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => setRunning((value) => !value)}
              className="mt-auto min-h-11 rounded-lg bg-[#f2b8a8] px-4 text-sm font-bold text-[#132a3a]"
            >
              {running
                ? ar
                  ? "إيقاف مؤقت"
                  : "Pause tour"
                : elapsedSeconds
                  ? ar
                    ? "استئناف الجولة"
                    : "Resume tour"
                  : ar
                    ? "ابدأ الجولة"
                    : "Start tour"}
            </button>
            <button
              type="button"
              onClick={resetTour}
              className="mt-auto min-h-11 rounded-lg border border-white/25 px-3 text-xs text-white/80"
            >
              {ar ? "إعادة" : "Reset"}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-4">
          <Metric
            label={ar ? "المحطة الحالية" : "Current stop"}
            value={`${currentIndex + 1} / ${HANGING_CHURCH_TOUR.length}`}
          />
          <Metric
            label={ar ? "الوقت المنقضي" : "Elapsed"}
            value={`${elapsedMinutes} ${ar ? "د" : "min"}`}
          />
          <Metric
            label={ar ? "الوقت المتبقي" : "Time left"}
            value={`${remainingMinutes} ${ar ? "د" : "min"}`}
          />
          <Metric label={ar ? "الإيقاع" : "Pacing"} value={pacingLabel(pacing, ar)} />
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <main className="flex min-w-0 flex-col gap-5">
          <section className="border-sand bg-card rounded-2xl border p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-crimson text-xs font-bold tracking-[0.16em] uppercase">
                  {ar ? "محطة الوصول" : "Arrival waypoint"} · {waypoint.id}
                </p>
                <h2 className="mt-2 font-serif text-3xl">
                  {ar ? waypoint.title.ar : waypoint.title.en}
                </h2>
              </div>
              <span className="bg-gold-tint text-crimson-dark rounded-full px-3 py-1 text-xs font-semibold">
                ≈ {waypoint.minutes} {ar ? "دقائق" : "min"}
              </span>
            </div>
            <p className="text-ink-soft mt-5 leading-relaxed">
              {ar ? "أهلاً بك. " : "Welcome. "}
              {ar ? waypoint.anchor.ar : waypoint.anchor.en}
            </p>
            <div className="mt-5 rounded-xl bg-[#e2edf1] p-4">
              <p className="text-ink-soft text-sm leading-relaxed">
                <strong>{ar ? "ابحث بعينيك" : "Look around"}: </strong>
                {ar ? waypoint.anchor.ar : waypoint.anchor.en}
              </p>
            </div>
          </section>

          <section className="border-sand bg-card rounded-2xl border p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-crimson text-xs font-bold tracking-[0.16em] uppercase">
                  {ar ? "الحكاية" : "The story"}
                </p>
                <h2 className="mt-1 font-serif text-2xl">{focusLabel(focus)}</h2>
              </div>
              <span className="text-ink-muted text-xs">
                {focus === "QUICK_HIGHLIGHTS"
                  ? "≈ 20 sec"
                  : focus === "ARCHITECTURAL_FOCUS"
                    ? "≈ 30 sec"
                    : "≈ 60 sec"}
              </span>
            </div>
            <p className="text-ink-soft mt-4 leading-[1.85]">{ar ? story.ar : story.en}</p>
            <div className="border-sand mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-ink-muted text-xs">
                {ar
                  ? "مستند إلى مصدر وزارة السياحة والآثار"
                  : "Based on the Ministry of Tourism and Antiquities profile"}
              </p>
              <a
                href="https://egymonuments.gov.eg/monuments/the-hanging-church/"
                target="_blank"
                rel="noreferrer"
                className="text-crimson text-xs font-semibold underline underline-offset-4"
              >
                {ar ? "افتح المصدر" : "Open source"}
              </a>
            </div>
          </section>

          <section className="border-sand bg-card rounded-2xl border p-5 sm:p-7">
            <p className="text-crimson text-xs font-bold tracking-[0.16em] uppercase">
              {ar ? "محادثة مع أبا جايد" : "Chat with Abba Guide"}
            </p>
            <h2 className="mt-1 font-serif text-2xl">
              {ar ? "اسأل عن الجولة أو هذه المحطة" : "Ask about the guide or this stop"}
            </h2>
            <p className="text-ink-muted mt-2 text-sm">
              {ar
                ? "ستكون الإجابة مرتبطة بموقعك الحالي وملاحظات الجولة الموثقة."
                : "Replies are grounded in your current stop and the guide’s sourced notes."}
            </p>
            <div
              role="log"
              ref={chatLogRef}
              aria-live="polite"
              aria-label={ar ? "محادثة الدليل" : "Guide conversation"}
              className="mt-4 flex max-h-80 flex-col gap-3 overflow-y-auto rounded-xl bg-[#e2edf1] p-3 sm:p-4"
            >
              {chatMessages.map((message, index) => (
                <article
                  key={`${index}-${message.role}`}
                  className={`max-w-[92%] rounded-xl border p-3 text-sm leading-relaxed ${message.role === "guide" ? "border-sand self-start bg-white" : "self-end border-[#b8dad4] bg-[#e0f1ed]"}`}
                >
                  <p className="text-crimson mb-1 text-[0.65rem] font-bold uppercase">
                    {message.role === "guide"
                      ? ar
                        ? "أبا جايد"
                        : "Abba Guide"
                      : ar
                        ? "أنت"
                        : "You"}
                  </p>
                  <p className="text-ink-soft">{message.content}</p>
                </article>
              ))}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (question.trim()) askGuide(question.trim());
              }}
              className="mt-4 flex flex-col gap-2 sm:flex-row"
            >
              <label className="sr-only" htmlFor="abba-guide-question">
                {ar ? "اكتب سؤالك" : "Write your question"}
              </label>
              <input
                id="abba-guide-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={
                  ar
                    ? "مثال: ماذا نعرف عن السقف؟"
                    : "For example: What do we know about the ceiling?"
                }
                className="border-sand-deep bg-parchment min-h-11 min-w-0 flex-1 rounded-lg border px-3 text-sm"
              />
              <button className="bg-crimson min-h-11 rounded-lg px-5 text-sm font-semibold text-white">
                {ar ? "إرسال" : "Send"}
              </button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              {(ar
                ? ["ماذا يقدم الدليل؟", "السقف؟", "المنبر؟", "الأيقونات؟"]
                : ["What does this guide do?", "The ceiling?", "The pulpit?", "The icons?"]
              ).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => askGuide(prompt)}
                  className="border-sand text-ink-soft hover:border-crimson rounded-full border px-3 py-1.5 text-xs"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <p className="text-ink-muted mt-3 text-xs">
              {ar
                ? "تستخدم المحادثة ملاحظات هذا المسار فقط؛ الأسئلة التي تتجاوز مصادره تُحدَّد بوضوح."
                : "This chat uses the route’s notes. It will say when a question goes beyond its sources."}
            </p>
          </section>

          <section className="rounded-2xl border border-[#f2b8a8] bg-[#fbe7e0] p-5 sm:p-7">
            <p className="text-crimson text-xs font-bold tracking-[0.16em] uppercase">
              {ar ? "اكتشاف تفاعلي" : "A detail to discover"}
            </p>
            <h2 className="mt-2 font-serif text-2xl">
              {ar ? waypoint.prompt.ar : waypoint.prompt.en}
            </h2>
            <p className="text-ink-muted mt-2 text-sm">
              {ar
                ? "خذ لحظة للملاحظة؛ لا حاجة إلى لمس أي قطعة أو الاقتراب من منطقة مغلقة."
                : "Take a moment to observe; there’s no need to touch an object or enter a restricted area."}
            </p>
          </section>

          <section className="rounded-2xl bg-[#132a3a] p-5 text-white sm:p-7">
            <p className="text-xs font-bold tracking-[0.16em] text-[#f2b8a8] uppercase">
              {ar ? "المحطة التالية" : "Navigation bridge"}
            </p>
            <p className="mt-3 leading-relaxed">{ar ? waypoint.next.ar : waypoint.next.en}</p>
            <button
              type="button"
              onClick={completeCurrent}
              disabled={isComplete}
              className="mt-5 min-h-11 rounded-lg bg-[#f2b8a8] px-5 text-sm font-bold text-[#132a3a] disabled:opacity-50"
            >
              {isComplete
                ? ar
                  ? "اكتملت الجولة"
                  : "Tour complete"
                : currentIndex === HANGING_CHURCH_TOUR.length - 1
                  ? ar
                    ? "أنهِ الجولة"
                    : "Finish tour"
                  : ar
                    ? "وصلت إلى المحطة · التالي"
                    : "I’ve arrived · Next stop"}{" "}
            </button>
          </section>

          {remainingMinutes < upcomingMinutes &&
          !isComplete &&
          currentIndex < HANGING_CHURCH_TOUR.length - 1 ? (
            <section role="status" className="border-gold bg-gold-tint rounded-xl border p-4">
              <h2 className="font-semibold">
                {ar ? "الوقت المتبقي أقصر من المسار" : "Less time than the full route needs"}
              </h2>
              <p className="mt-1 text-sm leading-relaxed">
                {ar
                  ? `تحتاج المحطات المتبقية إلى نحو ${upcomingMinutes} دقيقة. يمكنك تجاوز المحطات القادمة والانتقال مباشرة إلى خلاصة مجموعة الأيقونات.`
                  : `The remaining stops take about ${upcomingMinutes} minutes. You can skip ahead to the icon collection highlights, or keep the full route.`}
              </p>
              <button
                type="button"
                onClick={simplifyRoute}
                className="text-crimson mt-3 text-sm font-bold underline underline-offset-4"
              >
                {ar ? "انتقل إلى المحطة الأخيرة" : "Go to the final stop"}
              </button>
            </section>
          ) : null}
        </main>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-32">
          <section className="border-sand bg-card rounded-2xl border p-5">
            <p className="text-crimson text-xs font-bold tracking-[0.16em] uppercase">
              {ar ? "المحطات" : "Waypoints"}
            </p>
            <ol className="mt-4 flex flex-col gap-2">
              {HANGING_CHURCH_TOUR.map((stop, index) => {
                const complete = completedWaypoints.includes(stop.id);
                const skipped = skippedWaypoints.includes(stop.id);
                const current = currentIndex === index && !isComplete;
                return (
                  <li key={stop.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentIndex(index);
                      }}
                      className={`w-full rounded-xl border p-3 text-left transition ${current ? "border-crimson bg-[#e2edf1]" : "border-sand hover:border-gold"}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-ink font-semibold">
                          {index + 1}. {ar ? stop.title.ar : stop.title.en}
                        </span>
                        <span className="text-ink-muted text-[0.65rem]">
                          {complete
                            ? ar
                              ? "تم"
                              : "Done"
                            : skipped
                              ? ar
                                ? "تجاوز"
                                : "Skipped"
                              : current
                                ? ar
                                  ? "الآن"
                                  : "Now"
                                : ""}
                        </span>
                      </span>
                      <span className="text-ink-muted mt-1 block font-mono text-[0.62rem]">
                        {stop.id}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="bg-parchment mt-4 h-2 overflow-hidden rounded-full">
              <div
                className="bg-crimson h-full rounded-full transition-all"
                style={{
                  width: `${((completedWaypoints.length + skippedWaypoints.length) / HANGING_CHURCH_TOUR.length) * 100}%`,
                }}
              />
            </div>
            <p className="text-ink-muted mt-2 text-xs">
              {completedWaypoints.length} {ar ? "من" : "of"} {HANGING_CHURCH_TOUR.length}{" "}
              {ar ? "محطات مكتملة" : "stops completed"}
            </p>
          </section>

          <section className="border-sand bg-card rounded-2xl border p-5">
            <p className="text-crimson text-xs font-bold tracking-[0.16em] uppercase">
              {ar ? "طريقة الجولة" : "Tour focus"}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {FOCUS_MODES.map((mode) => (
                <button
                  type="button"
                  key={mode}
                  onClick={() => setFocus(mode)}
                  aria-pressed={focus === mode}
                  className={`min-h-10 rounded-lg border px-3 text-left text-sm ${focus === mode ? "border-crimson text-crimson bg-[#e2edf1] font-semibold" : "border-sand text-ink-soft"}`}
                >
                  {focusLabel(mode)}
                </button>
              ))}
            </div>
          </section>

          <section className="border-sand bg-card rounded-2xl border p-5">
            <p className="text-crimson text-xs font-bold tracking-[0.16em] uppercase">
              {ar ? "الراحة وإمكانية الوصول" : "Rest & access"}
            </p>
            <p className="text-ink-muted mt-2 text-sm leading-relaxed">
              {ar
                ? "إذا شعرت بالتعب، أوقف المؤقت وابقَ في منطقة عامة آمنة. اسأل العاملين عن أماكن الجلوس والمسارات المتاحة؛ لا يضمن هذا الدليل إمكانية الوصول إلى كل مساحة."
                : "If you feel tired, pause the timer and stay in a safe public area. Ask staff about seating and accessible routes; this guide cannot guarantee access to every area."}
            </p>
            <button
              type="button"
              onClick={() => {
                setRestMode((value) => !value);
                setRunning(false);
              }}
              className="border-sand-deep text-ink mt-3 min-h-10 w-full rounded-lg border px-3 text-sm font-semibold"
            >
              {restMode
                ? ar
                  ? "استئناف من موضعي"
                  : "Continue from here"
                : ar
                  ? "إيقاف للراحة"
                  : "Pause for a rest"}
            </button>
            {restMode ? (
              <p role="status" className="text-ink-muted mt-2 text-xs">
                {ar
                  ? "المؤقت متوقف. يمكنك الاستماع أو القراءة من موضعك."
                  : "Timer paused. Continue reading from where you are."}
              </p>
            ) : null}
          </section>

          <p className="text-ink-muted px-1 text-xs leading-relaxed">
            {ar
              ? "هذا مسار إرشادي تجريبي؛ تختلف حركة الزيارة والإتاحة. اتبع تعليمات الكنيسة والعاملين دائماً."
              : "This is a sample guide route; access and visitor flow may vary. Always follow church instructions and staff guidance."}
          </p>
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/5 px-5 py-3">
      <p className="text-[0.65rem] font-bold tracking-[0.14em] text-white/55 uppercase">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function pacingLabel(status: TourPacingStatus, ar: boolean) {
  if (status === "AHEAD_OF_SCHEDULE") return ar ? "متقدم" : "Ahead";
  if (status === "BEHIND_SCHEDULE") return ar ? "متأخر" : "Behind";
  return ar ? "على المسار" : "On track";
}
