(function () {
  "use strict";

  function svgImage(content, background = "#eaf4ee") {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${background}"/>
            <stop offset="1" stop-color="#ffffff"/>
          </linearGradient>
          <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="10" stdDeviation="10"
              flood-color="#173c2b" flood-opacity=".16"/>
          </filter>
        </defs>
        <rect width="640" height="400" rx="28" fill="url(#bg)"/>
        <circle cx="70" cy="65" r="34" fill="#ffffff" opacity=".45"/>
        <circle cx="570" cy="330" r="55" fill="#d4e9dc" opacity=".55"/>
        ${content}
      </svg>`;

    return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
  }

  const pictures = {
    key: svgImage(`
      <g filter="url(#shadow)" stroke="#b88635" stroke-width="17"
         fill="none" stroke-linecap="round">
        <circle cx="245" cy="175" r="68"/>
        <path d="M310 220 L440 310 L480 270 L450 240 L480 210"/>
      </g>
      <circle cx="245" cy="175" r="27" fill="#eaf4ee"/>
    `),

    moon: svgImage(`
      <path d="M370 85
        C250 80 190 200 250 285
        C300 360 410 340 455 265
        C360 295 290 205 325 130
        C337 108 352 94 370 85Z"
        fill="#f2c65d" stroke="#dba93b" stroke-width="7"/>
      <g fill="#ffffff" opacity=".9">
        <circle cx="180" cy="100" r="6"/>
        <circle cx="455" cy="100" r="9"/>
        <circle cx="480" cy="185" r="5"/>
        <circle cx="160" cy="250" r="8"/>
      </g>
    `, "#192b46"),

    sun: svgImage(`
      <g transform="translate(320 195)" stroke="#e8a83a"
         stroke-width="13" stroke-linecap="round">
        <path d="M0 -112 V-145 M0 112 V145 M-112 0 H-145 M112 0 H145
          M-80 -80 L-104 -104 M80 80 L104 104
          M80 -80 L104 -104 M-80 80 L-104 104"/>
      </g>
      <circle cx="320" cy="195" r="82" fill="#ffc94f"
        stroke="#e8a83a" stroke-width="8"/>
      <circle cx="292" cy="175" r="10" fill="#fff2bd" opacity=".8"/>
    `, "#fff3d7"),

    book: svgImage(`
      <g filter="url(#shadow)">
        <path d="M145 100 Q230 70 320 120 V305 Q230 255 145 280Z"
          fill="#f8fafc" stroke="#315d45" stroke-width="8"/>
        <path d="M495 100 Q410 70 320 120 V305 Q410 255 495 280Z"
          fill="#ffffff" stroke="#315d45" stroke-width="8"/>
        <path d="M320 120 V305" stroke="#315d45" stroke-width="7"/>
        <path d="M175 145 Q235 130 280 153 M175 180 Q235 165 280 188
          M360 153 Q410 130 465 145 M360 188 Q410 165 465 180"
          stroke="#a4c6ad" stroke-width="7" fill="none"
          stroke-linecap="round"/>
      </g>
    `),

    lock: svgImage(`
      <g filter="url(#shadow)">
        <path d="M235 180 V140 A85 85 0 0 1 405 140 V180"
          fill="none" stroke="#496c55" stroke-width="23"/>
        <rect x="180" y="170" width="280" height="175" rx="25"
          fill="#e4b84d" stroke="#bd8d2b" stroke-width="8"/>
        <circle cx="320" cy="238" r="19" fill="#76521b"/>
        <path d="M320 250 V280" stroke="#76521b" stroke-width="15"
          stroke-linecap="round"/>
      </g>
    `),

    door: svgImage(`
      <g filter="url(#shadow)">
        <rect x="205" y="65" width="230" height="300" rx="8"
          fill="#bd8150" stroke="#86502f" stroke-width="12"/>
        <rect x="235" y="95" width="170" height="240" rx="5"
          fill="#dca16a" stroke="#9c643b" stroke-width="6"/>
        <circle cx="375" cy="220" r="12" fill="#f8d77c"/>
      </g>
    `),

    flower: svgImage(`
      <g transform="translate(320 190)">
        <path d="M0 40 V160" stroke="#418552" stroke-width="15"
          stroke-linecap="round"/>
        <path d="M0 105 Q-80 60 -95 105 Q-50 150 0 105Z"
          fill="#62a96b"/>
        <g fill="#ed7791" stroke="#d95778" stroke-width="5">
          <ellipse cx="0" cy="-55" rx="36" ry="55"/>
          <ellipse cx="0" cy="55" rx="36" ry="55"/>
          <ellipse cx="-55" cy="0" rx="55" ry="36"/>
          <ellipse cx="55" cy="0" rx="55" ry="36"/>
          <ellipse cx="-39" cy="-39" rx="36" ry="48"
            transform="rotate(-45 -39 -39)"/>
          <ellipse cx="39" cy="-39" rx="36" ry="48"
            transform="rotate(45 39 -39)"/>
        </g>
        <circle cx="0" cy="0" r="31" fill="#f8c84c"
          stroke="#dca52d" stroke-width="5"/>
      </g>
    `, "#fff0f3"),

    crown: svgImage(`
      <path d="M150 135 L235 205 L320 105 L405 205 L490 135
        L455 305 L185 305Z"
        fill="#f4c84f" stroke="#c99a2e" stroke-width="10"
        stroke-linejoin="round"/>
      <path d="M185 325 H455" stroke="#c99a2e" stroke-width="18"
        stroke-linecap="round"/>
      <g fill="#e46d79">
        <circle cx="150" cy="125" r="16"/>
        <circle cx="320" cy="95" r="16"/>
        <circle cx="490" cy="125" r="16"/>
      </g>
    `, "#fff4d8"),

    heart: svgImage(`
      <path d="M320 315
        C285 280 150 195 150 125
        C150 40 260 40 320 120
        C380 40 490 40 490 125
        C490 195 355 280 320 315Z"
        fill="#e96376" stroke="#c84259" stroke-width="10"/>
      <path d="M220 110 Q245 85 270 105" fill="none"
        stroke="#ffb3bf" stroke-width="12" stroke-linecap="round"/>
    `, "#fff0f2"),

    star: svgImage(`
      <path d="M320 65 L380 175 L505 195 L415 282
        L437 350 L320 290 L203 350 L225 282
        L135 195 L260 175Z"
        fill="#f7ca4f" stroke="#d9a72d" stroke-width="9"
        stroke-linejoin="round"/>
      <path d="M320 105 L330 170" stroke="#fff2b5"
        stroke-width="10" stroke-linecap="round"/>
    `, "#fff6dc")
  };

  const rawLevels = [
    {
      id: 1,
      answers: ["مفتاح"],
      letters: ["ف", "ت", "ا", "ح", "م", "ب", "ر"],
      image: pictures.key,
      instruction: "ما الشيء الذي تراه في الصورة؟",
      hint: "نستخدمه لفتح الأبواب",
      reward: 10,
      category: "أشياء"
    },
    {
      id: 2,
      answers: ["قمر"],
      letters: ["ق", "م", "ر", "ش", "س", "ن"],
      image: pictures.moon,
      instruction: "اكتشف الكلمة من الصورة",
      hint: "يظهر في السماء ليلًا",
      reward: 10,
      category: "الطبيعة"
    },
    {
      id: 3,
      answers: ["شمس"],
      letters: ["ش", "م", "س", "ق", "ل", "ر"],
      image: pictures.sun,
      instruction: "اكتب اسم الشيء الظاهر",
      hint: "تمدنا بالضوء والحرارة",
      reward: 10,
      category: "الطبيعة"
    },
    {
      id: 4,
      answers: ["كتاب"],
      letters: ["ك", "ت", "ا", "ب", "م", "د"],
      image: pictures.book,
      instruction: "ما اسم هذا الشيء؟",
      hint: "نقرأ صفحاته لنتعلم",
      reward: 10,
      category: "التعليم"
    },
    {
      id: 5,
      answers: ["قفل"],
      letters: ["ق", "ف", "ل", "م", "ك", "ب"],
      image: pictures.lock,
      instruction: "اكتشف اسم الشيء",
      hint: "يحمي الباب ويُفتح بالمفتاح",
      reward: 10,
      category: "أشياء"
    },
    {
      id: 6,
      answers: ["باب"],
      letters: ["ب", "ا", "ب", "د", "ر", "م"],
      image: pictures.door,
      instruction: "اكتب الكلمة المناسبة للصورة",
      hint: "ندخل ونخرج من خلاله",
      reward: 10,
      category: "المنزل"
    },
    {
      id: 7,
      answers: ["وردة"],
      letters: ["و", "ر", "د", "ة", "ز", "ه"],
      image: pictures.flower,
      instruction: "ما اسم هذا النبات الجميل؟",
      hint: "نقدمها أحيانًا كهدية",
      reward: 10,
      category: "الطبيعة"
    },
    {
      id: 8,
      answers: ["تاج"],
      letters: ["ت", "ا", "ج", "م", "ل", "ك"],
      image: pictures.crown,
      instruction: "اكتشف الكلمة",
      hint: "يرتديه الملك فوق رأسه",
      reward: 10,
      category: "أشياء"
    },
    {
      id: 9,
      answers: ["قلب"],
      letters: ["ق", "ل", "ب", "ك", "م", "ر"],
      image: pictures.heart,
      instruction: "اكتب اسم العضو الظاهر",
      hint: "يضخ الدم في الجسم",
      reward: 10,
      category: "جسم الإنسان"
    },
    {
      id: 10,
      answers: ["نجمة"],
      letters: ["ن", "ج", "م", "ة", "س", "ب"],
      image: pictures.star,
      instruction: "ما اسم الشكل الظاهر؟",
      hint: "نراها في السماء ليلًا",
      reward: 10,
      category: "الطبيعة"
    }
  ];

  if (!window.LevelsLoader) {
  document.body.insertAdjacentHTML(
    "beforeend",
    '<div style="position:fixed;z-index:999999;top:10px;left:10px;right:10px;padding:16px;background:#8b0000;color:white;border-radius:12px;direction:rtl;font-size:16px">خطأ تحميل: ملف levels-loader.js غير موجود أو لم يتم تحميله قبل ملف المراحل.</div>'
  );

  throw new Error("LevelsLoader is missing");
}

window.LevelsLoader.registerLevels(rawLevels);

document.body.insertAdjacentHTML(
  "beforeend",
  '<div id="level-load-test" style="position:fixed;z-index:999998;bottom:10px;left:10px;right:10px;padding:12px;background:#14532d;color:white;border-radius:12px;direction:rtl;font-size:15px">تم تحميل ' +
    window.LevelsLoader.getLoadedCount() +
    ' مراحل. المرحلة الأولى: ' +
    (window.LevelsLoader.getLevel(1) ? "موجودة بنجاح" : "غير موجودة") +
    "</div>"
);

console.info(
  "[GAME] اختبار المرحلة الأولى:",
  window.LevelsLoader.getLevel(1)
);
})();
