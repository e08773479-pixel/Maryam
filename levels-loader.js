(function () {
  "use strict";

  const TOTAL_LEVELS = 3000;
  const LEVELS_PER_FILE = 100;

  const registry = new Map();

  function normalizeLevel(raw, fallbackId) {
    if (!raw || typeof raw !== "object") {
      throw new Error("بيانات المرحلة غير صالحة");
    }

    const id = Number(raw.id ?? fallbackId);
    const answers = Array.isArray(raw.answers)
      ? raw.answers
      : [raw.answer || ""];

    const cleanAnswers = answers
      .map(value => String(value || "").trim())
      .filter(Boolean);

    if (!Number.isInteger(id) || id < 1 || id > TOTAL_LEVELS) {
      throw new Error("رقم المرحلة خارج النطاق");
    }

    if (!cleanAnswers.length) {
      throw new Error("المرحلة لا تحتوي على إجابة");
    }

    const letters = Array.isArray(raw.letters)
      ? raw.letters.map(String)
      : Array.from(cleanAnswers[0].replace(/\s/g, ""));

    return Object.freeze({
      id,
      answers: cleanAnswers,
      letters,
      image: String(raw.image || ""),
      instruction: String(raw.instruction || "اكتشف الكلمة من الصورة"),
      hint: String(raw.hint || "فكّر في تفاصيل الصورة"),
      reward: Math.max(1, Number(raw.reward) || 10),
      category: String(raw.category || "عام")
    });
  }

  function registerLevels(levels) {
    if (!Array.isArray(levels)) {
      throw new Error("ملف المراحل يجب أن يحتوي على مصفوفة");
    }

    for (const raw of levels) {
      const level = normalizeLevel(raw, raw && raw.id);

      if (registry.has(level.id)) {
        throw new Error("رقم مرحلة مكرر: " + level.id);
      }

      registry.set(level.id, level);
    }

    window.WORD_PUZZLE_LEVELS = Array.from(registry.values())
      .sort((a, b) => a.id - b.id);

    return registry.size;
  }

  function getLevel(id) {
    return registry.get(Number(id)) || null;
  }

  function getLoadedCount() {
    return registry.size;
  }

  function getLoadedRange() {
    const ids = Array.from(registry.keys()).sort((a, b) => a - b);

    if (!ids.length) {
      return { first: null, last: null, count: 0 };
    }

    return {
      first: ids[0],
      last: ids[ids.length - 1],
      count: ids.length
    };
  }

  function getFileName(levelId) {
    const fileNumber = Math.ceil(Number(levelId) / LEVELS_PER_FILE);

    if (
      !Number.isInteger(fileNumber) ||
      fileNumber < 1 ||
      fileNumber > TOTAL_LEVELS / LEVELS_PER_FILE
    ) {
      return null;
    }

    return "levels-" + String(fileNumber).padStart(3, "0") + ".js";
  }

  window.LevelsLoader = Object.freeze({
    TOTAL_LEVELS,
    LEVELS_PER_FILE,
    registerLevels,
    getLevel,
    getLoadedCount,
    getLoadedRange,
    getFileName
  });
})();
