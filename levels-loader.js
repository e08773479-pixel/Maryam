"use strict";

(() => {
  const registry = new Map();

  function registerLevels(levels) {
    if (!Array.isArray(levels)) {
      throw new Error("بيانات المراحل ليست مصفوفة.");
    }

    for (const level of levels) {
      if (!level || !Number.isInteger(Number(level.id))) {
        throw new Error("يوجد مستوى برقم غير صالح.");
      }

      const id = Number(level.id);

      if (registry.has(id)) {
        throw new Error("رقم مرحلة مكرر: " + id);
      }

      registry.set(id, {
        ...level,
        id
      });
    }

    publishLevels();

    console.info(
      "[GAME] تم تسجيل المراحل:",
      registry.size
    );

    return registry.size;
  }

  function publishLevels() {
    window.WORD_PUZZLE_LEVELS = Array
      .from(registry.values())
      .sort((a, b) => a.id - b.id);
  }

  function getLevel(id) {
    return registry.get(Number(id)) || null;
  }

  function getLoadedCount() {
    return registry.size;
  }

  window.LevelsLoader = {
    registerLevels,
    getLevel,
    getLoadedCount
  };

  console.info("[GAME] levels-loader.js تم تحميله بنجاح.");
})();
