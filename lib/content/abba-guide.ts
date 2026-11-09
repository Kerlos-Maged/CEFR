export type GuideFocusMode = "STORYTELLING_DEEP_DIVE" | "QUICK_HIGHLIGHTS" | "ARCHITECTURAL_FOCUS";
export type TourPacingStatus = "ON_TRACK" | "BEHIND_SCHEDULE" | "AHEAD_OF_SCHEDULE";

export interface TourWaypoint {
  id: string;
  title: { en: string; ar: string };
  anchor: { en: string; ar: string };
  story: { en: string; ar: string };
  quick: { en: string; ar: string };
  architecture: { en: string; ar: string };
  prompt: { en: string; ar: string };
  next: { en: string; ar: string };
  minutes: number;
}

export const HANGING_CHURCH_TOUR: TourWaypoint[] = [
  {
    id: "church_hanging_mary_nave",
    title: { en: "The nave and the raised church", ar: "صحن الكنيسة والمبنى المرتفع" },
    anchor: {
      en: "From the public visitor area, take in the long central space and notice that the church stands above the remains of the Roman fortress of Babylon.",
      ar: "من منطقة الزيارة العامة، تأمل المساحة الوسطى الممتدة ولاحظ أن الكنيسة تقوم فوق بقايا حصن بابليون الروماني.",
    },
    story: {
      en: "The name “Hanging Church” points to a striking relationship between building and ground. The church was constructed above the remains of the Roman fortress of Babylon, in the landscape now known as Old Cairo. The Ministry of Tourism and Antiquities describes a basilican plan and dates the church to the fourth or fifth century, while also noting its later history as a papal residence in Cairo. Look at the space as a layered place: an active church, a historic building, and a structure set within the older fabric of the fortress. Its story is not one moment in time, but a sequence of use, change, and preservation.",
      ar: "يشير اسم «الكنيسة المعلقة» إلى علاقتها اللافتة بالأرض. فقد أُقيمت الكنيسة فوق بقايا حصن بابليون الروماني، في المنطقة المعروفة اليوم بمصر القديمة. وتصف وزارة السياحة والآثار تخطيطاً بازيليكياً، وتؤرخ الكنيسة إلى القرنين الرابع أو الخامس، كما تذكر تاريخها اللاحق مقراً بابوياً في القاهرة. تأمل المكان بوصفه طبقات متراكبة: كنيسة قائمة، ومبنى تاريخياً، ومنشأة ضمن نسيج الحصن الأقدم. ليست الحكاية لحظة واحدة، بل تتابعاً من الاستخدام والتغيير والحفاظ.",
    },
    quick: {
      en: "The church rises above the Roman fortress remains at Babylon. The Ministry describes its basilican plan and dates it to the 4th–5th centuries.",
      ar: "تقوم الكنيسة فوق بقايا حصن بابليون الروماني. وتصف الوزارة تخطيطها البازيليكي وتؤرخها إلى القرنين الرابع والخامس.",
    },
    architecture: {
      en: "Notice the long central axis and the relationship between the raised church and the fortress remains beneath it. The Ministry describes the plan as basilican.",
      ar: "لاحظ المحور المركزي الممتد وعلاقة الكنيسة المرتفعة ببقايا الحصن أسفلها. وتصف الوزارة التخطيط بأنه بازيليكي.",
    },
    prompt: {
      en: "Can you identify the direction of the central axis from where you are standing?",
      ar: "هل تستطيع تحديد اتجاه المحور المركزي من موضعك؟",
    },
    next: {
      en: "When you are ready, follow the public visitor route and staff directions toward the wooden ceiling. Do not enter closed or restricted areas.",
      ar: "عندما تكون مستعداً، اتبع مسار الزوار العام وتعليمات العاملين باتجاه السقف الخشبي. لا تدخل المناطق المغلقة أو المحظورة.",
    },
    minutes: 8,
  },
  {
    id: "church_hanging_wooden_ceiling",
    title: { en: "The wooden ceiling", ar: "السقف الخشبي" },
    anchor: {
      en: "Look upward from a place where you can pause safely. The Ministry describes the wooden ceiling as shaped like Noah’s Ark.",
      ar: "ارفع نظرك من موضع يمكنك الوقوف فيه بأمان. وتصف الوزارة السقف الخشبي بأنه على هيئة سفينة نوح.",
    },
    story: {
      en: "Above the visitor’s path, the wooden ceiling brings a large biblical image into the architecture. The Ministry describes its form as resembling Noah’s Ark. That description gives you a way to read the space without needing to imagine a separate object: the ceiling itself carries the comparison. Take a moment to follow its lines and notice how the material changes the feeling of the interior. Wood, stone, and the raised structure all belong to the building’s physical story. The archive records the comparison as a description from the Ministry; it does not claim that every detail has one agreed symbolic meaning. Let the visible form lead your questions.",
      ar: "يحمل السقف الخشبي فوق مسار الزوار صورة كتابية كبيرة داخل العمارة نفسها. وتصف الوزارة هيئته بأنها تشبه سفينة نوح. يمنحك هذا الوصف طريقة لقراءة المكان من دون البحث عن عنصر منفصل؛ فالسقف نفسه يحمل المقارنة. تتبع خطوطه ولاحظ كيف تغيّر المادة إحساس الداخل. فالخشب والحجر وارتفاع المبنى أجزاء من حكايته المادية. يسجل الأرشيف هذا التشبيه بوصفه وصفاً وارداً عن الوزارة، ولا يفترض أن لكل تفصيل معنى رمزياً واحداً متفقاً عليه. دع الشكل المرئي يقود أسئلتك.",
    },
    quick: {
      en: "The Ministry describes the wooden ceiling as shaped like Noah’s Ark. Notice how its form and material define the interior overhead.",
      ar: "تصف الوزارة السقف الخشبي بأنه على هيئة سفينة نوح. لاحظ كيف يحدد شكله ومادته المشهد الداخلي فوقك.",
    },
    architecture: {
      en: "Look at the ceiling’s profile, timber surface, and how it spans the space. The Ark comparison is the Ministry’s description; symbolic interpretations should be attributed rather than assumed.",
      ar: "تأمل هيئة السقف وسطحه الخشبي وكيف يغطي المساحة. تشبيه السفينة وارد في وصف الوزارة؛ أما التأويلات الرمزية فينبغي نسبتها إلى مصادرها لا افتراضها.",
    },
    prompt: {
      en: "What changes in the room when you follow the ceiling’s shape from one end to the other?",
      ar: "كيف يتغير إحساسك بالمكان حين تتبع شكل السقف من طرف إلى آخر؟",
    },
    next: {
      en: "Follow site signage or staff guidance toward the marble pulpit if it is open to visitors. The interior route can change with services and conservation work.",
      ar: "اتبع اللافتات أو تعليمات العاملين نحو المنبر الرخامي إذا كان مفتوحاً للزوار. قد يتغير المسار الداخلي أثناء الصلوات أو أعمال الصيانة.",
    },
    minutes: 7,
  },
  {
    id: "church_hanging_marble_pulpit",
    title: { en: "The marble pulpit", ar: "المنبر الرخامي" },
    anchor: {
      en: "From the public route, look for the marble pulpit. The Ministry dates it to the eleventh century.",
      ar: "من مسار الزيارة العام، ابحث عن المنبر الرخامي. وتؤرخه الوزارة إلى القرن الحادي عشر.",
    },
    story: {
      en: "The marble pulpit connects the building’s long life to a specific medieval moment. The Ministry dates it to the eleventh century. A pulpit is also a working part of church space: a place from which readings or teaching can be heard. Here the material and the use meet. Marble marks the object as part of the church’s crafted interior, while its function points to worship and teaching continuing through time. The source descriptions differ on some construction details, so this guide stays with the point they share: the pulpit is an important feature and is associated with the eleventh century. Look closely from the permitted visitor area, and allow the stonework to speak through its visible form.",
      ar: "يربط المنبر الرخامي عمر المبنى الطويل بلحظة محددة من العصور الوسطى؛ إذ تؤرخه الوزارة إلى القرن الحادي عشر. والمنبر أيضاً جزء وظيفي من فضاء الكنيسة، تُلقى منه القراءات أو التعاليم. هنا تلتقي المادة بالاستخدام: فالرخام يجعل المنبر جزءاً من داخل الكنيسة المصنوع بعناية، ووظيفته تشير إلى استمرار العبادة والتعليم عبر الزمن. تختلف أوصاف المصادر في بعض التفاصيل الإنشائية، لذلك يلتزم هذا الدليل بما تتفق عليه: أهمية المنبر وارتباطه بالقرن الحادي عشر. تأمله من منطقة الزيارة المسموح بها، ودع تفاصيل الحجر المرئية تقود انتباهك.",
    },
    quick: {
      en: "The Ministry dates the marble pulpit to the 11th century. It is both a crafted feature and a functional part of church space.",
      ar: "تؤرخ الوزارة المنبر الرخامي إلى القرن الحادي عشر. وهو عنصر مصنوع بعناية وجزء وظيفي من فضاء الكنيسة.",
    },
    architecture: {
      en: "Notice the stone material, support, and position in the church interior. The Ministry dates the pulpit to the 11th century; some descriptions differ on details, so we avoid a disputed count.",
      ar: "لاحظ مادة الحجر والدعامة وموقع المنبر في داخل الكنيسة. وتؤرخه الوزارة إلى القرن الحادي عشر؛ وتختلف بعض الأوصاف في التفاصيل، لذا نتجنب ذكر عدد محل خلاف.",
    },
    prompt: {
      en: "From the public viewing point, what can you observe about the pulpit’s stonework and supports?",
      ar: "من موضع المشاهدة العام، ماذا تلاحظ في أعمال الحجر ودعامات المنبر؟",
    },
    next: {
      en: "Continue only along the public route toward the icon collection, if that area is open. Ask staff before photographing or approaching displayed works.",
      ar: "تابع فقط عبر مسار الزوار باتجاه مجموعة الأيقونات إذا كانت المنطقة مفتوحة. اسأل العاملين قبل التصوير أو الاقتراب من المعروضات.",
    },
    minutes: 7,
  },
  {
    id: "church_hanging_icon_collection",
    title: { en: "The icon collection", ar: "مجموعة الأيقونات" },
    anchor: {
      en: "Pause at the publicly accessible viewing area for the icons. The Ministry says the oldest icons date to the fifteenth century and most others to the late eighteenth century.",
      ar: "توقف في منطقة المشاهدة المتاحة للجمهور أمام الأيقونات. وتذكر الوزارة أن أقدمها يعود إلى القرن الخامس عشر وأن معظم البقية من أواخر القرن الثامن عشر.",
    },
    story: {
      en: "The icon collection holds several periods of making within one church. According to the Ministry, the oldest icons date to the fifteenth century, while most of the others are from the late eighteenth century. That range is a reminder that a collection is assembled over time rather than created all at once. As you look, attend first to what is visible: figures, colors, framing, and the way each image is placed. Specific identifications and dates should come from labels or reliable catalogues. This guide keeps the broad dating attached to the Ministry’s account and invites you to notice the variety without guessing at an individual icon’s maker or story.",
      ar: "تضم مجموعة الأيقونات أعمالاً تنتمي إلى فترات متعددة داخل الكنيسة الواحدة. ووفقاً للوزارة، يعود أقدمها إلى القرن الخامس عشر، بينما يعود معظمها إلى أواخر القرن الثامن عشر. يذكّرنا هذا الفارق بأن المجموعة تكوّنت عبر الزمن ولم تُنشأ دفعة واحدة. ابدأ بما تراه: الشخصيات والألوان والإطارات وطريقة وضع كل صورة. وينبغي أن تستند هوية الأيقونة وتاريخها المحدد إلى بطاقتها أو فهرس موثوق. يربط هذا الدليل التأريخ العام بوصف الوزارة، ويدعوك إلى ملاحظة التنوع من دون تخمين الفنان أو قصة أيقونة بعينها.",
    },
    quick: {
      en: "The Ministry dates the oldest icons to the 15th century and most of the others to the late 18th century. Check labels for an individual icon’s identity.",
      ar: "تؤرخ الوزارة أقدم الأيقونات إلى القرن الخامس عشر ومعظم البقية إلى أواخر القرن الثامن عشر. راجع البطاقات لمعرفة هوية كل أيقونة.",
    },
    architecture: {
      en: "Notice how the icons are framed and arranged within the church. Use the display labels for individual identifications; the date range here describes the collection broadly.",
      ar: "لاحظ طريقة تأطير الأيقونات وترتيبها داخل الكنيسة. استخدم البطاقات للتعرف إلى كل أيقونة؛ فالنطاق الزمني هنا يصف المجموعة عموماً.",
    },
    prompt: {
      en: "Choose one detail you can observe directly—color, framing, or placement—and compare it with another icon nearby.",
      ar: "اختر تفصيلاً تراه مباشرة، كاللون أو الإطار أو الموضع، وقارنه بأيقونة أخرى قريبة.",
    },
    next: {
      en: "This is the final stop in this sample route. Rest where permitted, revisit a story, or return to the church profile for its sources.",
      ar: "هذه المحطة الأخيرة في هذا المسار التجريبي. استرح في الموضع المسموح، أو أعد الاستماع إلى قصة، أو ارجع إلى صفحة الكنيسة ومصادرها.",
    },
    minutes: 8,
  },
];

export const TOUR_DEFAULT_MINUTES = 45;
