import type { PublishedClaim, PublishedObject, PublishedSource } from "@/lib/db/objects";

export interface HeritageTimelineEvent {
  date: string;
  title: { en: string; ar: string };
  detail: { en: string; ar: string };
}

export interface FeaturedHeritageRecord {
  kind: "church" | "object";
  slug: string;
  contentKey?: string;
  church: { name: { en: string; ar: string }; city: string; district: string };
  object: PublishedObject;
  image: { src: string; alt: { en: string; ar: string }; credit: string; sourceUrl: string };
  timeline: HeritageTimelineEvent[];
  context: { en: string; ar: string };
}

const mota = "Ministry of Tourism and Antiquities — Discover Egypt's Monuments";

function source(
  id: string,
  title: string,
  url: string,
  author = mota,
  sourceType = "website",
): PublishedSource {
  return { id, title, author, year: null, citation: null, url, sourceType };
}

function record({
  publicId,
  slug,
  church,
  title,
  description,
  date,
  image,
  claims,
  sources,
  timeline,
  context,
  kind = "church",
  contentKey,
}: {
  publicId: string;
  slug: string;
  church: FeaturedHeritageRecord["church"];
  title: { en: string; ar: string };
  description: { en: string; ar: string };
  date: string;
  image: FeaturedHeritageRecord["image"];
  claims: { text: { en: string; ar: string }; verification: "verified" | "uncertain" }[];
  sources: PublishedSource[];
  timeline: HeritageTimelineEvent[];
  context: FeaturedHeritageRecord["context"];
  kind?: FeaturedHeritageRecord["kind"];
  contentKey?: string;
}): FeaturedHeritageRecord {
  const common = {
    id: `featured-${publicId}`,
    publicId,
    objectType: "architectural_feature",
    approximateDate: date,
    locationInChurch: null,
    defaultLanguage: "en",
    publishedAt: null,
    requestedLocale: "en",
    usedFallback: false,
    church: { slug, name: church.name.en },
    media: [],
    sources,
  } satisfies Omit<PublishedObject, "content" | "claims">;
  const mappedClaims: PublishedClaim[] = claims.map((claim, index) => ({
    id: `${publicId}-claim-${index + 1}`,
    text: claim.text.en,
    value: null,
    verification: claim.verification,
    sources,
  }));
  return {
    kind,
    slug,
    contentKey,
    church,
    image,
    timeline,
    context,
    object: {
      ...common,
      content: { title: title.en, description: description.en },
      claims: mappedClaims,
    },
  };
}

const hangingSource = source(
  "mota-hanging-church",
  "The Hanging Church",
  "https://egymonuments.gov.eg/monuments/the-hanging-church/",
);
const hangingArabicSource = source(
  "mota-hanging-church-ar",
  "الكنيسة المعلقة",
  "https://mota.gov.eg/ar/%D8%A7%D9%84%D8%A2%D8%AB%D8%A7%D8%B1-%D9%88%D8%A7%D9%84%D9%85%D8%AA%D8%A7%D8%AD%D9%81/%D8%A7%D9%84%D9%85%D8%AC%D9%84%D8%B3-%D8%A7%D9%84%D8%A3%D8%B9%D9%84%D9%89-%D9%84%D9%84%D8%A2%D8%AB%D8%A7%D8%B1/%D8%AF%D9%84%D9%8A%D9%84-%D8%A7%D9%84%D9%85%D9%88%D8%A7%D9%82%D8%B9-%D8%A7%D9%84%D8%A3%D8%AB%D8%B1%D9%8A%D8%A9-%D8%A7%D9%84%D9%85%D9%81%D8%AA%D9%88%D8%AD%D8%A9-%D9%84%D9%84%D8%B2%D9%8A%D8%A7%D8%B1%D8%A9-%D8%AC%D8%AF%D9%8A%D8%AF/%D8%A7%D9%84%D9%83%D9%86%D9%8A%D8%B3%D8%A9-%D8%A7%D9%84%D9%85%D8%B9%D9%84%D9%82%D8%A9/",
);
const abuSource = source(
  "mota-abu-serga",
  "Church of Saint Sergius and Bacchus (Abu Serga)",
  "https://egymonuments.gov.eg/en/monuments/church-of-saint-sergius-and-bacchus/",
);
const routeSource = source(
  "mota-holy-family-route",
  "The Journey of the Holy Family",
  "https://egymonuments.gov.eg/news/the-journey-of-the-holy-family/",
);
const redMonasterySource = source(
  "mota-red-monastery",
  "The Red Monastery",
  "https://egymonuments.gov.eg/monuments/the-red-monastery/",
);
const syriansMonasterySource = source(
  "mota-monastery-syrians",
  "Monastery of the Syrians",
  "https://egymonuments.gov.eg/monuments/monastery-of-the-syrians/",
);
const syriansResearchSource = source(
  "warsaw-deir-al-surian-project",
  "Deir al-Surian — monastic church research project",
  "https://www.archeologia.uw.edu.pl/en/deir-al-surian-monastic-church/",
);

export const FEATURED_HERITAGE: FeaturedHeritageRecord[] = [
  record({
    publicId: "HCAM000001",
    slug: "hanging-church",
    church: {
      name: { en: "The Hanging Church", ar: "الكنيسة المعلقة" },
      city: "Cairo",
      district: "Old Cairo",
    },
    title: {
      en: "The Hanging Church · architectural history",
      ar: "الكنيسة المعلقة · تاريخ معماري",
    },
    description: {
      en: "Dedicated to the Virgin Mary, the Hanging Church stands above the remains of the Roman fortress of Babylon. The Ministry describes its basilican plan, wooden ceiling shaped like Noah's Ark, marble pulpit, and a notable collection of icons. The church became a papal residence in Cairo in the medieval period.",
      ar: "تُعرف الكنيسة المعلقة باسم كنيسة السيدة العذراء مريم، وقد أُقيمت فوق بقايا حصن بابليون الروماني. وتصف وزارة السياحة والآثار تخطيطها البازيليكي وسقفها الخشبي الذي يحاكي سفينة نوح والمنبر الرخامي ومجموعتها من الأيقونات. وأصبحت مقراً بابوياً في القاهرة خلال العصور الوسطى.",
    },
    date: "4th–5th century; later medieval additions",
    image: {
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Outside_Hanging_church.JPG?width=1400",
      alt: {
        en: "Exterior view of the Hanging Church in Old Cairo",
        ar: "منظر خارجي للكنيسة المعلقة في مصر القديمة",
      },
      credit: "Photo: Hajar Karam (هاجر كرم); CC BY-SA 3.0",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Outside_Hanging_church.JPG",
    },
    claims: [
      {
        text: {
          en: "The church is built over the ruins of the Roman fortress of Babylon.",
          ar: "شُيّدت الكنيسة فوق بقايا حصن بابليون الروماني.",
        },
        verification: "verified",
      },
      {
        text: {
          en: "The Ministry of Antiquities dates the church to the 4th–5th centuries; a separate ministry account places its construction toward the end of the 4th century.",
          ar: "تؤرخ وزارة الآثار الكنيسة بين القرنين الرابع والخامس؛ ويذكر مصدر آخر للوزارة أن بناءها كان في أواخر القرن الرابع.",
        },
        verification: "verified",
      },
      {
        text: {
          en: "The marble pulpit is dated by the Ministry to the 11th century. Its English and Arabic pages differ on the number of supports, so that detail is omitted here.",
          ar: "يؤرخ مصدر الوزارة المنبر الرخامي إلى القرن الحادي عشر. وتختلف صفحتا الوزارة العربية والإنجليزية في عدد دعاماته، لذلك لم ندرج هذا التفصيل.",
        },
        verification: "verified",
      },
    ],
    sources: [hangingSource, hangingArabicSource],
    timeline: [
      {
        date: "4th–5th century CE",
        title: { en: "Church established", ar: "تأسيس الكنيسة" },
        detail: {
          en: "The Egyptian Ministry of Tourism and Antiquities gives this date range for the church.",
          ar: "تذكر وزارة السياحة والآثار هذا النطاق الزمني لتأسيس الكنيسة.",
        },
      },
      {
        date: "10th–11th century CE",
        title: { en: "Papal seat in Cairo", ar: "مقر الكرسي البابوي في القاهرة" },
        detail: {
          en: "The Ministry's Arabic monument entry says the papal seat moved from Alexandria to the church in this period.",
          ar: "يذكر دليل الآثار التابع للوزارة انتقال الكرسي البابوي من الإسكندرية إلى الكنيسة في هذه الفترة.",
        },
      },
      {
        date: "11th century CE",
        title: { en: "Marble pulpit", ar: "المنبر الرخامي" },
        detail: {
          en: "The pulpit is dated to this century in the Ministry's English description.",
          ar: "يؤرخ وصف الوزارة الإنجليزي المنبر إلى هذا القرن.",
        },
      },
      {
        date: "15th–18th centuries CE",
        title: { en: "Icon collection", ar: "مجموعة الأيقونات" },
        detail: {
          en: "The Ministry says the oldest icons date to the 15th century and most others to the late 18th century.",
          ar: "تذكر الوزارة أن أقدم الأيقونات تعود إلى القرن الخامس عشر، وأن معظم البقية من أواخر القرن الثامن عشر.",
        },
      },
    ],
    context: {
      en: "The Hanging Church is one of the historic sites associated with the Holy Family route in Egypt. This association is a religious tradition recorded by the Ministry, not an archaeological date for the church.",
      ar: "تُعد الكنيسة المعلقة من المواقع التاريخية المرتبطة بمسار العائلة المقدسة في مصر. وهذا ارتباط تقليدي ديني توثقه الوزارة، وليس تاريخاً أثرياً لبناء الكنيسة.",
    },
  }),
  record({
    publicId: "ABSV000001",
    slug: "abu-serga",
    church: {
      name: {
        en: "Church of Saints Sergius and Bacchus (Abu Serga)",
        ar: "كنيسة القديسين سرجيوس وباخوس (أبو سرجة)",
      },
      city: "Cairo",
      district: "Old Cairo",
    },
    title: { en: "Abu Serga · the church and crypt", ar: "أبو سرجة · الكنيسة والمغارة" },
    description: {
      en: "Abu Serga is built over the remains of an ancient Roman fortress in Old Cairo. Its date is disputed: the Ministry records scholarly views ranging from the late 4th or early 5th century to the 17th century. A cave lies beneath the sanctuary; its association with the Holy Family is part of the church's religious tradition.",
      ar: "شُيّدت كنيسة أبو سرجة فوق بقايا حصن روماني قديم في مصر القديمة. وتاريخها محل خلاف؛ إذ تسجل الوزارة آراءً علمية تمتد من أواخر القرن الرابع أو أوائل الخامس إلى القرن السابع عشر. وتقع مغارة أسفل الهيكل، ويرتبط بها تقليدياً مرور العائلة المقدسة.",
    },
    date: "Dating disputed: late 4th/early 5th century or 17th century",
    image: {
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Church_of_Abu_Serga-Cairo.JPG?width=1400",
      alt: {
        en: "Interior of Abu Serga Church in Old Cairo",
        ar: "الجزء الداخلي من كنيسة أبي سرجة في مصر القديمة",
      },
      credit: "Photo: Faris knight; CC BY-SA 4.0",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Church_of_Abu_Serga-Cairo.JPG",
    },
    claims: [
      {
        text: {
          en: "The church is built above remains of an ancient Roman fortress.",
          ar: "شُيّدت الكنيسة فوق بقايا حصن روماني قديم.",
        },
        verification: "verified",
      },
      {
        text: {
          en: "Its construction date is disputed; published scholarly opinions cited by the Ministry range from the late 4th/early 5th century to the 17th century.",
          ar: "تاريخ البناء محل خلاف؛ وتتراوح الآراء العلمية التي تنقلها الوزارة بين أواخر القرن الرابع/أوائل الخامس والقرن السابع عشر.",
        },
        verification: "uncertain",
      },
      {
        text: {
          en: "A cave beneath the sanctuary is traditionally associated with the Holy Family's refuge in Egypt.",
          ar: "ترتبط المغارة الواقعة أسفل الهيكل تقليدياً باحتماء العائلة المقدسة في مصر.",
        },
        verification: "uncertain",
      },
    ],
    sources: [abuSource, routeSource],
    timeline: [
      {
        date: "Late 4th / early 5th century CE",
        title: { en: "Earlier proposed date", ar: "تأريخ مقترح مبكر" },
        detail: {
          en: "Some scholars place the church's construction in this period, according to the Ministry.",
          ar: "يرى بعض العلماء أن بناء الكنيسة يعود إلى هذه الفترة، بحسب الوزارة.",
        },
      },
      {
        date: "17th century CE",
        title: { en: "Alternative proposed date", ar: "تأريخ مقترح بديل" },
        detail: {
          en: "Other scholars place the church's construction in the 17th century. The date remains disputed.",
          ar: "يرى علماء آخرون أن بناء الكنيسة يعود إلى القرن السابع عشر. ولا يزال التاريخ محل خلاف.",
        },
      },
      {
        date: "Present-day heritage record",
        title: { en: "Basilica and cave", ar: "الكنيسة البازيليكية والمغارة" },
        detail: {
          en: "The church follows a basilican layout; the cave is below the sanctuary. The Holy Family connection is presented as religious tradition.",
          ar: "تتبع الكنيسة تخطيطاً بازيليكياً، وتقع المغارة أسفل الهيكل. ويُعرض الارتباط بالعائلة المقدسة بوصفه تقليداً دينياً.",
        },
      },
    ],
    context: {
      en: "The Ministry includes Abu Serga among the sites associated with the Holy Family journey. Its account describes the cave as the place where the Holy Family sought refuge; the claim is attributed as religious tradition.",
      ar: "تدرج الوزارة أبا سرجة ضمن المواقع المرتبطة برحلة العائلة المقدسة، وتصف المغارة بأنها موضع احتماء العائلة؛ ويُعرض ذلك باعتباره تقليداً دينياً.",
    },
  }),
  record({
    publicId: "MAAD000001",
    slug: "virgin-mary-maadi",
    church: {
      name: { en: "Church of the Virgin Mary, Maadi", ar: "كنيسة السيدة العذراء بالمعادي" },
      city: "Cairo",
      district: "Maadi",
    },
    title: {
      en: "Maadi · a Nile crossing in the route tradition",
      ar: "المعادي · معبر النيل في تقليد المسار",
    },
    description: {
      en: "The Ministry of Tourism and Antiquities identifies the Maadi church with the place where the Holy Family crossed the Nile toward Upper Egypt. The account belongs to Egypt's religious and cultural route tradition; this record does not assign an unsupported construction date to the present church building.",
      ar: "تربط وزارة السياحة والآثار كنيسة المعادي بموضع عبور العائلة المقدسة نهر النيل باتجاه صعيد مصر. وينتمي هذا الوصف إلى تقليد المسار الديني والثقافي في مصر؛ ولا ينسب هذا السجل تاريخاً غير موثق إلى مبنى الكنيسة الحالي.",
    },
    date: "Date of present building not asserted in this record",
    image: {
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/MaadiVirginChurchEastSide.jpg?width=1400",
      alt: {
        en: "East side of the Church of the Holy Virgin in Maadi",
        ar: "الجانب الشرقي لكنيسة السيدة العذراء بالمعادي",
      },
      credit: "Photo: Roland Unger; released to the public domain",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:MaadiVirginChurchEastSide.jpg",
    },
    claims: [
      {
        text: {
          en: "The Ministry associates the Maadi site with the Holy Family's crossing of the Nile before continuing south.",
          ar: "تربط الوزارة موقع المعادي بعبور العائلة المقدسة نهر النيل قبل متابعة الرحلة جنوباً.",
        },
        verification: "verified",
      },
    ],
    sources: [routeSource],
    timeline: [
      {
        date: "Holy Family route tradition",
        title: { en: "Crossing at Maadi", ar: "العبور عند المعادي" },
        detail: {
          en: "The Ministry's route account says the Holy Family crossed the Nile at Maadi before traveling to Upper Egypt.",
          ar: "يذكر وصف المسار التابع للوزارة أن العائلة المقدسة عبرت النيل عند المعادي قبل التوجه إلى صعيد مصر.",
        },
      },
      {
        date: "Current heritage interpretation",
        title: { en: "A living historic site", ar: "موقع تاريخي حي" },
        detail: {
          en: "The church is included in official descriptions of the Holy Family route. The route association is shown separately from the building's own construction chronology.",
          ar: "ترد الكنيسة في الأوصاف الرسمية لمسار العائلة المقدسة. ويُفصل ارتباط المسار عن التسلسل الزمني لبناء الكنيسة نفسها.",
        },
      },
    ],
    context: {
      en: "This is a church within the active Christian community in Maadi; the feature record focuses only on the official route association and does not claim the church is a platform partner.",
      ar: "هذه كنيسة ضمن مجتمع مسيحي قائم في المعادي؛ ويركز السجل على الارتباط الرسمي بالمسار، ولا يدّعي أن الكنيسة شريك للمنصة.",
    },
  }),
  record({
    publicId: "REDM000001",
    slug: "red-monastery",
    church: {
      name: { en: "The Red Monastery", ar: "الدير الأحمر" },
      city: "Sohag",
      district: "21 km west of Sohag",
    },
    title: { en: "The Red Monastery · sanctuary murals", ar: "الدير الأحمر · جداريات الهيكل" },
    description: {
      en: "The Egyptian Ministry describes the Red Monastery's church as a three-aisled building with a tripartite eastern sanctuary and tempera murals depicting Christ, the Virgin Mary, the Four Evangelists, and the Apostles. Its name refers to the red brick used through much of the complex. The Ministry's account dates the monastery's foundation to the early fourth century; this profile keeps that attribution attached to the source.",
      ar: "تصف وزارة السياحة والآثار كنيسة الدير الأحمر بأنها مبنى ذو ثلاثة أجنحة، ينتهي من الشرق بهيكل ثلاثي مزين برسوم تمبرا تصور المسيح والسيدة العذراء والإنجيليين الأربعة والرسل. وتشير التسمية إلى الطوب الأحمر المستخدم في أجزاء كبيرة من المجمع. وينسب هذا الملف إلى رواية الوزارة تأسيس الدير إلى أوائل القرن الرابع.",
    },
    date: "Monastery foundation: early 4th century (Ministry account)",
    image: {
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Red_Monastery_Sohag_Egypt_Sanctuary_North_apse.jpg?width=1400",
      alt: {
        en: "Painted columns and murals in the north apse of the Red Monastery sanctuary",
        ar: "أعمدة مرسومة وجداريات في الحنية الشمالية لهيكل الدير الأحمر",
      },
      credit: "Photo: Ctschroeder; CC BY-SA 4.0",
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Red_Monastery_Sohag_Egypt_Sanctuary_North_apse.jpg",
    },
    claims: [
      {
        text: {
          en: "The Ministry describes the church's eastern end as a tripartite sanctuary decorated with tempera murals.",
          ar: "تصف الوزارة نهاية الكنيسة الشرقية بأنها هيكل ثلاثي مزين برسوم تمبرا جدارية.",
        },
        verification: "verified",
      },
      {
        text: {
          en: "The Ministry's monument account attributes the monastery's foundation to Saint Bishoy in the early fourth century.",
          ar: "تنسب رواية الوزارة تأسيس الدير إلى القديس بيشوي في أوائل القرن الرابع.",
        },
        verification: "verified",
      },
    ],
    sources: [redMonasterySource],
    timeline: [
      {
        date: "Early 4th century CE (Ministry account)",
        title: { en: "Foundation tradition", ar: "تاريخ التأسيس في رواية الوزارة" },
        detail: {
          en: "The Ministry's profile says Saint Bishoy founded the monastery at the beginning of the fourth century.",
          ar: "يذكر ملف الوزارة أن القديس بيشوي أسس الدير في بداية القرن الرابع.",
        },
      },
      {
        date: "Later periods",
        title: { en: "A layered monastic complex", ar: "مجمع رهباني متعدد المراحل" },
        detail: {
          en: "The surviving church and fortification preserve several architectural components; the Ministry describes more than one episode of fire and rebuilding history.",
          ar: "تحفظ الكنيسة الباقية والتحصينات عناصر معمارية متعددة؛ ويذكر وصف الوزارة أكثر من حادثة حريق ضمن تاريخ الموقع.",
        },
      },
      {
        date: "Present heritage record",
        title: { en: "Sanctuary paintings", ar: "رسوم الهيكل" },
        detail: {
          en: "The Ministry identifies biblical scenes and figures in the painted tripartite sanctuary. The Commons image shows the north apse and is credited to its photographer.",
          ar: "تحدد الوزارة مشاهد وشخصيات كتابية في الهيكل الثلاثي المرسوم. وتعرض صورة ويكيميديا الحنية الشمالية مع ذكر المصور.",
        },
      },
    ],
    context: {
      en: "This is a historic monastic site in Sohag, not an onboarded church partner. Its Ministry profile describes architecture and mural painting; this record does not claim to catalogue every icon or painting at the site.",
      ar: "هذا موقع رهباني تاريخي في سوهاج، وليس كنيسة شريكة مسجلة في المنصة. يصف ملف الوزارة العمارة والجداريات؛ ولا يدعي هذا السجل حصر كل أيقونة أو لوحة في الموقع.",
    },
  }),
  record({
    publicId: "SRMN000001",
    slug: "monastery-of-the-syrians",
    church: {
      name: {
        en: "Monastery of the Syrians (Deir al-Surian)",
        ar: "دير السريان (دير السيدة العذراء السريان)",
      },
      city: "Beheira",
      district: "Wadi al-Natrun",
    },
    title: {
      en: "Deir al-Surian · the Church of the Virgin Mary",
      ar: "دير السريان · كنيسة السيدة العذراء",
    },
    description: {
      en: "The Ministry of Tourism and Antiquities describes Deir al-Surian as one of the surviving Wadi al-Natrun monasteries. It records fourth-century foundations, a Syriac monastic community settling there in 984, and the main Church of the Virgin Mary built in 645. A University of Warsaw and University of Amsterdam research project documents successive changes to the church and its paintings, including important tenth- and thirteenth-century phases.",
      ar: "تصف وزارة السياحة والآثار دير السريان بأنه أحد أديرة وادي النطرون الباقية. وتشير إلى تأسيسه في القرن الرابع، واستقرار جماعة من الرهبان السريان فيه سنة 984، وبناء كنيسة السيدة العذراء الرئيسية سنة 645. ويوثق مشروع بحثي لجامعتي وارسو وأمستردام مراحل متعاقبة من التغيير في الكنيسة ورسومها، ومنها مرحلتان مهمتان في القرنين العاشر والثالث عشر.",
    },
    date: "Church of the Virgin Mary: 645 CE (Ministry account); later phases documented",
    image: {
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Deir_as_Suriani.jpg?width=1400",
      alt: {
        en: "Church buildings at Deir al-Surian in Wadi al-Natrun",
        ar: "مباني الكنيسة في دير السريان بوادي النطرون",
      },
      credit: "Photo: Lumen roma; CC BY 3.0",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Deir_as_Suriani.jpg",
    },
    claims: [
      {
        text: {
          en: "The Ministry dates the main Church of the Virgin Mary to 645 CE.",
          ar: "تؤرخ الوزارة كنيسة السيدة العذراء الرئيسية إلى سنة 645 للميلاد.",
        },
        verification: "verified",
      },
      {
        text: {
          en: "The research project documents significant tenth- and thirteenth-century stages during the monastery's Syriac community period.",
          ar: "يوثق المشروع البحثي مراحل مهمة في القرنين العاشر والثالث عشر خلال فترة وجود الجماعة السريانية في الدير.",
        },
        verification: "verified",
      },
    ],
    sources: [syriansMonasterySource, syriansResearchSource],
    timeline: [
      {
        date: "4th century CE",
        title: { en: "Monastery foundations", ar: "تأسيس الدير" },
        detail: {
          en: "The Ministry dates the monastery's foundations to the fourth century.",
          ar: "تؤرخ الوزارة تأسيس الدير إلى القرن الرابع.",
        },
      },
      {
        date: "645 CE",
        title: { en: "Church of the Virgin Mary", ar: "كنيسة السيدة العذراء" },
        detail: {
          en: "The Ministry identifies this as the date the monastery's main church was built.",
          ar: "تحدد الوزارة هذا التاريخ لبناء الكنيسة الرئيسية في الدير.",
        },
      },
      {
        date: "10th–13th centuries CE",
        title: {
          en: "Syriac community and later church phases",
          ar: "الجماعة السريانية ومراحل لاحقة",
        },
        detail: {
          en: "The Ministry records Syriac monks settling at the monastery in 984; the university research project highlights church phases in the tenth and thirteenth centuries.",
          ar: "تذكر الوزارة استقرار رهبان سريان في الدير سنة 984؛ ويبرز المشروع الجامعي مراحل للكنيسة في القرنين العاشر والثالث عشر.",
        },
      },
    ],
    context: {
      en: "Deir al-Surian remains a living monastic community. This public reference summarizes official and academic historical sources; it does not imply access permission, church partnership, or a complete inventory of the monastery's icons and manuscripts.",
      ar: "لا يزال دير السريان مجتمعاً رهبانياً حياً. يلخص هذا المرجع مصادر تاريخية رسمية وأكاديمية؛ ولا يعني وجود تصريح بالزيارة أو شراكة مع الدير أو اكتمال حصر أيقوناته ومخطوطاته.",
    },
  }),
  record({
    publicId: "CMNA000001",
    slug: "hanging-church",
    contentKey: "coptic-mona-lisa",
    kind: "object",
    church: {
      name: { en: "The Hanging Church", ar: "الكنيسة المعلقة" },
      city: "Cairo",
      district: "Old Cairo",
    },
    title: {
      en: "The Coptic Mona Lisa · Virgin and Child icon",
      ar: "الموناليزا القبطية · أيقونة العذراء والطفل",
    },
    description: {
      en: "This venerated icon at the Hanging Church is popularly called the “Coptic Mona Lisa.” It depicts the Virgin Mary and Christ Child, with John the Baptist and angels. The nickname describes a popular response to the image; it does not imply a connection to Leonardo da Vinci. Published sources date the church’s icon collection broadly, but this particular icon has no securely established item-level date in the sources used here.",
      ar: "تُعرف هذه الأيقونة المكرمة في الكنيسة المعلقة شعبياً باسم «الموناليزا القبطية». وتصور السيدة العذراء والطفل يسوع، وإلى جوارهما يوحنا المعمدان وملائكة. يصف هذا اللقب الانطباع الشعبي عن الصورة ولا يعني وجود صلة بلوحة ليوناردو دافنشي. تؤرخ المصادر المنشورة مجموعة أيقونات الكنيسة بوجه عام، لكن المصادر المستخدمة هنا لا تحدد تاريخاً موثقاً لهذه الأيقونة بعينها.",
    },
    date: "Undetermined for this icon; the Ministry dates the church's oldest icons to the 15th century and most to the late 18th century",
    image: {
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/%D9%84%D9%88%D8%AD%D8%A9_%D8%A7%D9%84%D9%85%D9%88%D9%86%D8%A7%D9%84%D9%8A%D8%B2%D8%A7_%D8%A7%D9%84%D9%82%D8%A8%D8%B7%D9%8A%D8%A9.jpg?width=1400",
      alt: {
        en: "The Virgin Mary and Christ Child icon popularly known as the Coptic Mona Lisa, at the Hanging Church",
        ar: "أيقونة السيدة العذراء والطفل المعروفة شعبياً بالموناليزا القبطية في الكنيسة المعلقة",
      },
      credit: "Photo: Nan deko; CC BY-SA 3.0",
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:%D9%84%D9%88%D8%AD%D8%A9_%D8%A7%D9%84%D9%85%D9%88%D9%86%D8%A7%D9%84%D9%8A%D8%B2%D8%A7_%D8%A7%D9%84%D9%82%D8%A8%D8%B7%D9%8A%D8%A9.jpg",
    },
    claims: [
      {
        text: {
          en: "The icon is popularly nicknamed the Coptic or Egyptian Mona Lisa in published references.",
          ar: "تُعرف الأيقونة شعبياً بلقب الموناليزا القبطية أو المصرية في مراجع منشورة.",
        },
        verification: "verified",
      },
      {
        text: {
          en: "The image depicts the Virgin Mary with the Christ Child, John the Baptist, and angels.",
          ar: "تصور الصورة السيدة العذراء والطفل يسوع ويوحنا المعمدان وملائكة.",
        },
        verification: "verified",
      },
      {
        text: {
          en: "No precise date for this individual icon is asserted; the Ministry's date range applies to the church's icon collection generally.",
          ar: "لا يحدد هذا السجل تاريخاً دقيقاً لهذه الأيقونة؛ فالنطاق الزمني الذي تذكره الوزارة ينطبق على مجموعة أيقونات الكنيسة عموماً.",
        },
        verification: "uncertain",
      },
    ],
    sources: [
      hangingSource,
      source(
        "coptic-mona-lisa-article",
        "The Church of the Holy Virgin Mary (Al-Mu‘allaqa or Hanging Church)",
        "https://ijmsac.journals.ekb.eg/article_304812_3cebe229efbb4c5f7e25d77c01c38ea9.pdf",
      ),
      source(
        "coptic-mona-lisa-photo",
        "لوحة الموناليزا القبطية — Wikimedia Commons file and license",
        "https://commons.wikimedia.org/wiki/File:%D9%84%D9%88%D8%AD%D8%A9_%D8%A7%D9%84%D9%85%D9%88%D9%86%D8%A7%D9%84%D9%8A%D8%B2%D8%A7_%D8%A7%D9%84%D9%82%D8%A8%D8%B7%D9%8A%D8%A9.jpg",
        "Nan deko; Wikimedia Commons",
        "image",
      ),
      source(
        "coptic-mona-lisa-identification",
        "Hanging Church: Virgin Monalisa icon — Ahram Online",
        "https://english.ahram.org.eg/NewsContentMulti/117459/Search.aspx",
        "Ahram Online",
      ),
    ],
    timeline: [
      {
        date: "15th century CE and later (collection context)",
        title: {
          en: "Earliest collection date given by the Ministry",
          ar: "أقدم تاريخ تذكره الوزارة للمجموعة",
        },
        detail: {
          en: "The Ministry says the oldest icons in the Hanging Church date to the 15th century and most of the collection to the late 18th century. These are collection dates, not a confirmed date for this particular icon.",
          ar: "تذكر الوزارة أن أقدم أيقونات الكنيسة المعلقة تعود إلى القرن الخامس عشر وأن معظم المجموعة من أواخر القرن الثامن عشر. هذه تواريخ للمجموعة وليست تاريخاً مؤكداً لهذه الأيقونة بعينها.",
        },
      },
      {
        date: "Modern published references",
        title: { en: "A popular name enters print", ar: "ظهور الاسم الشعبي في المراجع" },
        detail: {
          en: "Modern articles and a 2023 academic publication use the Mona Lisa nickname. This record preserves the popular name while keeping the icon's exact date open.",
          ar: "تستخدم مقالات حديثة ودراسة أكاديمية منشورة سنة 2023 لقب الموناليزا. ويحفظ هذا السجل الاسم الشائع مع إبقاء تاريخ الأيقونة الدقيق غير محسوم.",
        },
      },
    ],
    context: {
      en: "Part of the Hanging Church's revered icon collection. This record identifies one named image and links it to the church profile; it is not a complete catalogue or a conservation assessment.",
      ar: "جزء من مجموعة الأيقونات المكرمة في الكنيسة المعلقة. يعرّف هذا السجل صورة بعينها ويربطها بملف الكنيسة؛ ولا يمثل فهرساً كاملاً أو تقييماً لحالتها الحفظية.",
    },
  }),
];

export function getFeaturedBySlug(slug: string): FeaturedHeritageRecord | null {
  return FEATURED_HERITAGE.find((entry) => entry.slug === slug && entry.kind === "church") ?? null;
}

export function getFeaturedByPublicId(
  publicId: string,
  locale: string,
): FeaturedHeritageRecord | null {
  const entry = FEATURED_HERITAGE.find((record) => record.object.publicId === publicId);
  if (!entry) return null;
  const arabic = locale === "ar";
  const localSources = entry.object.sources;
  return {
    ...entry,
    object: {
      ...entry.object,
      requestedLocale: locale,
      content: {
        title: arabic ? titleArabic(entry) : (entry.object.content?.title ?? ""),
        description: arabic ? descriptionArabic(entry) : (entry.object.content?.description ?? ""),
      },
      claims: entry.object.claims.map((claim, index) => ({
        ...claim,
        text: claimText(entry, index, arabic),
        sources: localSources,
      })),
      usedFallback: false,
    },
  };
}

function titleArabic(entry: FeaturedHeritageRecord): string {
  if (entry.contentKey === "coptic-mona-lisa") return "الموناليزا القبطية · أيقونة العذراء والطفل";
  const titles: Record<string, string> = {
    "hanging-church": "الكنيسة المعلقة · تاريخ معماري",
    "abu-serga": "أبو سرجة · الكنيسة والمغارة",
    "virgin-mary-maadi": "المعادي · معبر النيل في تقليد المسار",
    "red-monastery": "الدير الأحمر · جداريات الهيكل",
    "monastery-of-the-syrians": "دير السريان · كنيسة السيدة العذراء",
  };
  return titles[entry.slug];
}

function descriptionArabic(entry: FeaturedHeritageRecord): string {
  if (entry.contentKey === "coptic-mona-lisa")
    return "تُعرف هذه الأيقونة المكرمة في الكنيسة المعلقة شعبياً باسم «الموناليزا القبطية». وتصور السيدة العذراء والطفل يسوع، وإلى جوارهما يوحنا المعمدان وملائكة. يصف هذا اللقب الانطباع الشعبي عن الصورة ولا يعني وجود صلة بلوحة ليوناردو دافنشي. تؤرخ المصادر المنشورة مجموعة أيقونات الكنيسة بوجه عام، لكن المصادر المستخدمة هنا لا تحدد تاريخاً موثقاً لهذه الأيقونة بعينها.";
  const descriptions: Record<string, string> = {
    "hanging-church":
      "تُعرف الكنيسة المعلقة باسم كنيسة السيدة العذراء مريم، وقد أُقيمت فوق بقايا حصن بابليون الروماني. وتصف وزارة السياحة والآثار تخطيطها البازيليكي وسقفها الخشبي الذي يحاكي سفينة نوح والمنبر الرخامي ومجموعتها من الأيقونات. وأصبحت مقراً بابوياً في القاهرة خلال العصور الوسطى.",
    "abu-serga":
      "شُيّدت كنيسة أبو سرجة فوق بقايا حصن روماني قديم في مصر القديمة. وتاريخها محل خلاف؛ إذ تسجل الوزارة آراءً علمية تمتد من أواخر القرن الرابع أو أوائل الخامس إلى القرن السابع عشر. وتقع مغارة أسفل الهيكل، ويرتبط بها تقليدياً مرور العائلة المقدسة.",
    "virgin-mary-maadi":
      "تربط وزارة السياحة والآثار كنيسة المعادي بموضع عبور العائلة المقدسة نهر النيل باتجاه صعيد مصر. وينتمي هذا الوصف إلى تقليد المسار الديني والثقافي في مصر؛ ولا ينسب هذا السجل تاريخاً غير موثق إلى مبنى الكنيسة الحالي.",
    "red-monastery":
      "تصف وزارة السياحة والآثار كنيسة الدير الأحمر بأنها مبنى ذو ثلاثة أجنحة، ينتهي من الشرق بهيكل ثلاثي مزين برسوم تمبرا تصور المسيح والسيدة العذراء والإنجيليين الأربعة والرسل. وتشير التسمية إلى الطوب الأحمر المستخدم في أجزاء كبيرة من المجمع. وينسب هذا الملف إلى رواية الوزارة تأسيس الدير إلى أوائل القرن الرابع.",
    "monastery-of-the-syrians":
      "تصف وزارة السياحة والآثار دير السريان بأنه أحد أديرة وادي النطرون الباقية. وتشير إلى تأسيسه في القرن الرابع، واستقرار جماعة من الرهبان السريان فيه سنة 984، وبناء كنيسة السيدة العذراء الرئيسية سنة 645. ويوثق مشروع بحثي لجامعتي وارسو وأمستردام مراحل متعاقبة من التغيير في الكنيسة ورسومها، ومنها مرحلتان مهمتان في القرنين العاشر والثالث عشر.",
  };
  return descriptions[entry.slug];
}

function claimText(entry: FeaturedHeritageRecord, index: number, arabic: boolean): string {
  if (entry.contentKey === "coptic-mona-lisa") {
    const localized = [
      [
        "The icon is popularly nicknamed the Coptic or Egyptian Mona Lisa in published references.",
        "تُعرف الأيقونة شعبياً بلقب الموناليزا القبطية أو المصرية في مراجع منشورة.",
      ],
      [
        "The image depicts the Virgin Mary with the Christ Child, John the Baptist, and angels.",
        "تصور الصورة السيدة العذراء والطفل يسوع ويوحنا المعمدان وملائكة.",
      ],
      [
        "No precise date for this individual icon is asserted; the Ministry's date range applies to the church's icon collection generally.",
        "لا يحدد هذا السجل تاريخاً دقيقاً لهذه الأيقونة؛ فالنطاق الزمني الذي تذكره الوزارة ينطبق على مجموعة أيقونات الكنيسة عموماً.",
      ],
    ];
    return localized[index]?.[arabic ? 1 : 0] ?? "";
  }
  const claims: Record<string, { en: string[]; ar: string[] }> = {
    "hanging-church": {
      en: [
        "The church is built over the ruins of the Roman fortress of Babylon.",
        "The Ministry of Antiquities dates the church to the 4th–5th centuries; a separate ministry account places its construction toward the end of the 4th century.",
        "The marble pulpit is dated by the Ministry to the 11th century. Its English and Arabic pages differ on the number of supports, so that detail is omitted here.",
      ],
      ar: [
        "شُيّدت الكنيسة فوق بقايا حصن بابليون الروماني.",
        "تؤرخ وزارة الآثار الكنيسة بين القرنين الرابع والخامس؛ ويذكر مصدر آخر للوزارة أن بناءها كان في أواخر القرن الرابع.",
        "يؤرخ مصدر الوزارة المنبر الرخامي إلى القرن الحادي عشر. وتختلف صفحتا الوزارة العربية والإنجليزية في عدد دعاماته، لذلك لم ندرج هذا التفصيل.",
      ],
    },
    "abu-serga": {
      en: [
        "The church is built above remains of an ancient Roman fortress.",
        "Its construction date is disputed; published scholarly opinions cited by the Ministry range from the late 4th/early 5th century to the 17th century.",
        "A cave beneath the sanctuary is traditionally associated with the Holy Family's refuge in Egypt.",
      ],
      ar: [
        "شُيّدت الكنيسة فوق بقايا حصن روماني قديم.",
        "تاريخ البناء محل خلاف؛ وتتراوح الآراء العلمية التي تنقلها الوزارة بين أواخر القرن الرابع/أوائل الخامس والقرن السابع عشر.",
        "ترتبط المغارة الواقعة أسفل الهيكل تقليدياً باحتماء العائلة المقدسة في مصر.",
      ],
    },
    "virgin-mary-maadi": {
      en: [
        "The Ministry associates the Maadi site with the Holy Family's crossing of the Nile before continuing south.",
      ],
      ar: ["تربط الوزارة موقع المعادي بعبور العائلة المقدسة نهر النيل قبل متابعة الرحلة جنوباً."],
    },
    "red-monastery": {
      en: [
        "The Ministry describes the church's eastern end as a tripartite sanctuary decorated with tempera murals.",
        "The Ministry's monument account attributes the monastery's foundation to Saint Bishoy in the early fourth century.",
      ],
      ar: [
        "تصف الوزارة نهاية الكنيسة الشرقية بأنها هيكل ثلاثي مزين برسوم تمبرا جدارية.",
        "تنسب رواية الوزارة تأسيس الدير إلى القديس بيشوي في أوائل القرن الرابع.",
      ],
    },
    "monastery-of-the-syrians": {
      en: [
        "The Ministry dates the main Church of the Virgin Mary to 645 CE.",
        "The research project documents significant tenth- and thirteenth-century stages during the monastery's Syriac community period.",
      ],
      ar: [
        "تؤرخ الوزارة كنيسة السيدة العذراء الرئيسية إلى سنة 645 للميلاد.",
        "يوثق المشروع البحثي مراحل مهمة في القرنين العاشر والثالث عشر خلال فترة وجود الجماعة السريانية في الدير.",
      ],
    },
  };
  return claims[entry.slug][arabic ? "ar" : "en"][index];
}
