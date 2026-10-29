/* =========================================================
   MEKA X — LOCAL STORAGE MANAGER
   File: storage.js
   Version: 1.0.0

   Provides:
   - Safe local persistence
   - Namespaced data
   - Settings and preferences
   - Drafts and local collections
   - Export and import backups
   - Storage usage information

   IMPORTANT:
   Browser storage is local to this browser/device.
   It is not a cloud database or account synchronization.
   ========================================================= */

(() => {
  "use strict";

  /* =======================================================
     1. CONFIGURATION
     ======================================================= */

  const CONFIG = Object.freeze({
    prefix: "meka_x_",
    version: 1,

    keys: Object.freeze({
      metadata: "storage_metadata",
      settings: "settings",
      preferences: "preferences",
      drafts: "drafts",
      conversations: "local_conversations",
      favorites: "favorites",
      recentSearches: "recent_searches",
      localPosts: "local_posts"
    }),

    limits: Object.freeze({
      recentSearches: 30,
      favorites: 500,
      localPosts: 200,
      conversations: 100,
      draftLength: 100000,
      importBytes: 5 * 1024 * 1024
    })
  });

  const listeners = new Set();

  let storageAvailable = true;

  /* =======================================================
     2. SAFE JSON HELPERS
     ======================================================= */

  function clone(value) {
    if (value === undefined) {
      return undefined;
    }

    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return null;
    }
  }

  function parseJSON(value, fallback = null) {
    if (typeof value !== "string") {
      return fallback;
    }

    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function serialize(value) {
    try {
      return JSON.stringify(value);
    } catch (error) {
      console.error(
        "[MEKA Storage] Could not serialize value:",
        error
      );

      return null;
    }
  }

  function normalizeKey(key) {
    if (typeof key !== "string") {
      throw new TypeError(
        "مفتاح التخزين يجب أن يكون نصًا."
      );
    }

    const normalized = key.trim();

    if (!normalized) {
      throw new Error(
        "مفتاح التخزين لا يمكن أن يكون فارغًا."
      );
    }

    if (normalized.length > 180) {
      throw new Error(
        "مفتاح التخزين أطول من الحد المسموح."
      );
    }

    return normalized;
  }

  function fullKey(key) {
    return CONFIG.prefix + normalizeKey(key);
  }

  function createId(prefix = "item") {
    const safePrefix = String(prefix)
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 30) || "item";

    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return safePrefix + "_" + crypto.randomUUID();
    }

    return (
      safePrefix +
      "_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 12)
    );
  }

  function nowISO() {
    return new Date().toISOString();
  }

  /* =======================================================
     3. STORAGE AVAILABILITY
     ======================================================= */

  function checkAvailability() {
    try {
      const testKey = CONFIG.prefix + "__storage_test__";

      localStorage.setItem(testKey, "1");
      localStorage.removeItem(testKey);

      storageAvailable = true;

      return true;
    } catch {
      storageAvailable = false;

      return false;
    }
  }

  function ensureStorage() {
    if (!storageAvailable && !checkAvailability()) {
      return false;
    }

    return true;
  }

  /* =======================================================
     4. INTERNAL EVENT SYSTEM
     ======================================================= */

  function emit(eventName, detail = {}) {
    const event = {
      name: eventName,
      detail: clone(detail),
      timestamp: nowISO()
    };

    listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error(
          "[MEKA Storage] Listener error:",
          error
        );
      }
    });

    try {
      document.dispatchEvent(
        new CustomEvent(
          "meka:storage:" + eventName,
          {
            detail: event.detail
          }
        )
      );
    } catch {
      // يسمح باستخدام الملف دون وجود DOM كامل.
    }
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError(
        "يجب تمرير دالة للاستماع إلى أحداث التخزين."
      );
    }

    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  /* =======================================================
     5. CORE READ / WRITE / DELETE
     ======================================================= */

  function get(key, fallback = null) {
    let storageKey;

    try {
      storageKey = fullKey(key);
    } catch {
      return clone(fallback);
    }

    if (!ensureStorage()) {
      return clone(fallback);
    }

    try {
      const raw = localStorage.getItem(storageKey);

      if (raw === null) {
        return clone(fallback);
      }

      const parsed = parseJSON(raw, undefined);

      if (parsed === undefined) {
        console.warn(
          "[MEKA Storage] Invalid JSON for key:",
          key
        );

        return clone(fallback);
      }

      return parsed;
    } catch (error) {
      console.error(
        "[MEKA Storage] Read error:",
        error
      );

      return clone(fallback);
    }
  }

  function set(key, value) {
    let storageKey;

    try {
      storageKey = fullKey(key);
    } catch (error) {
      return {
        ok: false,
        error: error.message
      };
    }

    if (!ensureStorage()) {
      return {
        ok: false,
        error: "localStorage غير متاح في هذا المتصفح."
      };
    }

    const raw = serialize(value);

    if (raw === null) {
      return {
        ok: false,
        error: "تعذر تحويل البيانات إلى JSON."
      };
    }

    try {
      localStorage.setItem(storageKey, raw);

      emit("set", {
        key,
        value
      });

      return {
        ok: true,
        key
      };
    } catch (error) {
      const message =
        error?.name === "QuotaExceededError"
          ? "مساحة التخزين المحلية ممتلئة."
          : "تعذر حفظ البيانات محليًا.";

      console.error(
        "[MEKA Storage] Write error:",
        error
      );

      emit("error", {
        operation: "set",
        key,
        message
      });

      return {
        ok: false,
        error: message
      };
    }
  }

  function remove(key) {
    let storageKey;

    try {
      storageKey = fullKey(key);
    } catch (error) {
      return {
        ok: false,
        error: error.message
      };
    }

    if (!ensureStorage()) {
      return {
        ok: false,
        error: "localStorage غير متاح."
      };
    }

    try {
      localStorage.removeItem(storageKey);

      emit("remove", {
        key
      });

      return {
        ok: true,
        key
      };
    } catch (error) {
      return {
        ok: false,
        error: "تعذر حذف البيانات."
      };
    }
  }

  function has(key) {
    if (!ensureStorage()) {
      return false;
    }

    try {
      return localStorage.getItem(fullKey(key)) !== null;
    } catch {
      return false;
    }
  }

  function update(key, updater, fallback = null) {
    if (typeof updater !== "function") {
      return {
        ok: false,
        error: "يجب تمرير دالة لتحديث البيانات."
      };
    }

    const current = get(key, fallback);

    let next;

    try {
      next = updater(clone(current));
    } catch (error) {
      return {
        ok: false,
        error: error.message || "تعذر تحديث البيانات."
      };
    }

    return set(key, next);
  }

  /* =======================================================
     6. NAMESPACED DATA
     ======================================================= */

  function makeNamespace(namespace) {
    const safeNamespace = normalizeKey(namespace);

    return Object.freeze({
      get(key, fallback = null) {
        return get(
          safeNamespace + ":" + normalizeKey(key),
          fallback
        );
      },

      set(key, value) {
        return set(
          safeNamespace + ":" + normalizeKey(key),
          value
        );
      },

      remove(key) {
        return remove(
          safeNamespace + ":" + normalizeKey(key)
        );
      },

      has(key) {
        return has(
          safeNamespace + ":" + normalizeKey(key)
        );
      },

      update(key, updater, fallback = null) {
        return update(
          safeNamespace + ":" + normalizeKey(key),
          updater,
          fallback
        );
      }
    });
  }

  /* =======================================================
     7. SETTINGS
     ======================================================= */

  const DEFAULT_SETTINGS = Object.freeze({
    theme: "dark",
    language: "ar",
    direction: "rtl",
    compactMode: false,
    reduceMotion: false,
    soundEnabled: true,
    notificationsEnabled: true,
    autoSaveDrafts: true,
    fontScale: 1
  });

  function getSettings() {
    return {
      ...DEFAULT_SETTINGS,
      ...get(CONFIG.keys.settings, {})
    };
  }

  function getSetting(name, fallback = undefined) {
    const settings = getSettings();

    if (
      Object.prototype.hasOwnProperty.call(
        settings,
        name
      )
    ) {
      return clone(settings[name]);
    }

    return fallback;
  }

  function setSetting(name, value) {
    const allowed = new Set(
      Object.keys(DEFAULT_SETTINGS)
    );

    if (!allowed.has(name)) {
      return {
        ok: false,
        error: "هذا الإعداد غير معروف."
      };
    }

    if (name === "theme") {
      const themes = [
        "dark",
        "light",
        "purple",
        "ocean"
      ];

      if (!themes.includes(value)) {
        return {
          ok: false,
          error: "الثيم المحدد غير مدعوم."
        };
      }
    }

    if (name === "language") {
      if (
        typeof value !== "string" ||
        !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(value)
      ) {
        return {
          ok: false,
          error: "رمز اللغة غير صالح."
        };
      }
    }

    if (
      [
        "compactMode",
        "reduceMotion",
        "soundEnabled",
        "notificationsEnabled",
        "autoSaveDrafts"
      ].includes(name) &&
      typeof value !== "boolean"
    ) {
      return {
        ok: false,
        error: "يجب أن تكون قيمة الإعداد منطقية."
      };
    }

    if (
      name === "fontScale" &&
      (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0.8 ||
        value > 1.5
      )
    ) {
      return {
        ok: false,
        error: "حجم الخط خارج النطاق المسموح."
      };
    }

    const settings = getSettings();

    settings[name] = value;

    const result = set(
      CONFIG.keys.settings,
      settings
    );

    if (result.ok) {
      emit("setting-changed", {
        name,
        value
      });
    }

    return result;
  }

  function resetSettings() {
    const result = set(
      CONFIG.keys.settings,
      { ...DEFAULT_SETTINGS }
    );

    if (result.ok) {
      emit("settings-reset");
    }

    return result;
  }

  /* =======================================================
     8. USER PREFERENCES
     ======================================================= */

  function getPreferences() {
    return get(
      CONFIG.keys.preferences,
      {}
    );
  }

  function getPreference(name, fallback = null) {
    const preferences = getPreferences();

    return Object.prototype.hasOwnProperty.call(
      preferences,
      name
    )
      ? clone(preferences[name])
      : fallback;
  }

  function setPreference(name, value) {
    const key = normalizeKey(name);

    const preferences = getPreferences();

    preferences[key] = value;

    return set(
      CONFIG.keys.preferences,
      preferences
    );
  }

  function removePreference(name) {
    const preferences = getPreferences();

    delete preferences[normalizeKey(name)];

    return set(
      CONFIG.keys.preferences,
      preferences
    );
  }

  /* =======================================================
     9. DRAFTS
     ======================================================= */

  function getDrafts() {
    return get(
      CONFIG.keys.drafts,
      {}
    );
  }

  function getDraft(name, fallback = "") {
    const drafts = getDrafts();

    return Object.prototype.hasOwnProperty.call(
      drafts,
      name
    )
      ? drafts[name]
      : fallback;
  }

  function saveDraft(name, content) {
    const key = normalizeKey(name);

    const text = String(content ?? "");

    if (text.length > CONFIG.limits.draftLength) {
      return {
        ok: false,
        error: "المسودة أكبر من الحد المسموح."
      };
    }

    const drafts = getDrafts();

    drafts[key] = {
      content: text,
      updatedAt: nowISO()
    };

    const result = set(
      CONFIG.keys.drafts,
      drafts
    );

    if (result.ok) {
      emit("draft-saved", {
        name: key
      });
    }

    return result;
  }

  function deleteDraft(name) {
    const drafts = getDrafts();

    delete drafts[normalizeKey(name)];

    return set(
      CONFIG.keys.drafts,
      drafts
    );
  }

  function clearDrafts() {
    return set(
      CONFIG.keys.drafts,
      {}
    );
  }

  /* =======================================================
     10. RECENT SEARCHES
     ======================================================= */

  function getRecentSearches() {
    return get(
      CONFIG.keys.recentSearches,
      []
    );
  }

  function addRecentSearch(query) {
    const text = String(query ?? "").trim();

    if (!text) {
      return {
        ok: false,
        error: "عبارة البحث فارغة."
      };
    }

    if (text.length > 500) {
      return {
        ok: false,
        error: "عبارة البحث طويلة جدًا."
      };
    }

    const searches = getRecentSearches();

    const filtered = searches.filter(item => {
      const oldQuery =
        typeof item === "string"
          ? item
          : item.query;

      return oldQuery !== text;
    });

    filtered.unshift({
      query: text,
      searchedAt: nowISO()
    });

    const limited = filtered.slice(
      0,
      CONFIG.limits.recentSearches
    );

    return set(
      CONFIG.keys.recentSearches,
      limited
    );
  }

  function clearRecentSearches() {
    return set(
      CONFIG.keys.recentSearches,
      []
    );
  }

  /* =======================================================
     11. FAVORITES
     ======================================================= */

  function getFavorites() {
    return get(
      CONFIG.keys.favorites,
      []
    );
  }

  function addFavorite(item) {
    if (!item || typeof item !== "object") {
      return {
        ok: false,
        error: "بيانات العنصر غير صالحة."
      };
    }

    const id = String(item.id ?? "").trim();

    if (!id) {
      return {
        ok: false,
        error: "العنصر يحتاج إلى معرّف."
      };
    }

    const favorites = getFavorites();

    if (
      favorites.some(
        favorite => String(favorite.id) === id
      )
    ) {
      return {
        ok: true,
        alreadyExists: true
      };
    }

    if (
      favorites.length >= CONFIG.limits.favorites
    ) {
      return {
        ok: false,
        error: "وصلت إلى الحد الأقصى للمفضلة."
      };
    }

    favorites.unshift({
      ...clone(item),
      id,
      savedAt: nowISO()
    });

    const result = set(
      CONFIG.keys.favorites,
      favorites
    );

    if (result.ok) {
      emit("favorite-added", {
        id
      });
    }

    return result;
  }

  function removeFavorite(id) {
    const targetId = String(id);

    const favorites = getFavorites();

    const updated = favorites.filter(
      item => String(item.id) !== targetId
    );

    if (updated.length === favorites.length) {
      return {
        ok: true,
        removed: false
      };
    }

    const result = set(
      CONFIG.keys.favorites,
      updated
    );

    if (result.ok) {
      emit("favorite-removed", {
        id: targetId
      });
    }

    return result;
  }

  function isFavorite(id) {
    return getFavorites().some(
      item => String(item.id) === String(id)
    );
  }

  function toggleFavorite(item) {
    if (!item || item.id === undefined) {
      return {
        ok: false,
        error: "العنصر غير صالح."
      };
    }

    if (isFavorite(item.id)) {
      const result = removeFavorite(item.id);

      return {
        ...result,
        favorite: false
      };
    }

    const result = addFavorite(item);

    return {
      ...result,
      favorite: result.ok
    };
  }

  /* =======================================================
     12. LOCAL CONVERSATION CACHE
     ======================================================= */

  function getLocalConversations() {
    return get(
      CONFIG.keys.conversations,
      []
    );
  }

  function saveLocalConversation(conversation) {
    if (
      !conversation ||
      typeof conversation !== "object"
    ) {
      return {
        ok: false,
        error: "بيانات المحادثة غير صالحة."
      };
    }

    const id = String(
      conversation.id || createId("conversation")
    );

    const conversations =
      getLocalConversations();

    const index = conversations.findIndex(
      item => String(item.id) === id
    );

    const normalized = {
      ...clone(conversation),
      id,
      updatedAt: nowISO()
    };

    if (index >= 0) {
      conversations[index] = {
        ...conversations[index],
        ...normalized
      };
    } else {
      conversations.unshift(normalized);
    }

    const limited = conversations.slice(
      0,
      CONFIG.limits.conversations
    );

    const result = set(
      CONFIG.keys.conversations,
      limited
    );

    if (result.ok) {
      emit("conversation-saved", {
        id
      });
    }

    return {
      ...result,
      id
    };
  }

  function getLocalConversation(id) {
    return getLocalConversations().find(
      item => String(item.id) === String(id)
    ) || null;
  }

  function deleteLocalConversation(id) {
    const targetId = String(id);

    const conversations =
      getLocalConversations();

    const updated = conversations.filter(
      item => String(item.id) !== targetId
    );

    if (updated.length === conversations.length) {
      return {
        ok: true,
        removed: false
      };
    }

    return set(
      CONFIG.keys.conversations,
      updated
    );
  }

  function clearLocalConversations() {
    return set(
      CONFIG.keys.conversations,
      []
    );
  }

  /* =======================================================
     13. LOCAL POSTS
     ======================================================= */

  function getLocalPosts() {
    return get(
      CONFIG.keys.localPosts,
      []
    );
  }

  function saveLocalPost(post) {
    if (!post || typeof post !== "object") {
      return {
        ok: false,
        error: "بيانات المنشور غير صالحة."
      };
    }

    const content = String(
      post.content ?? ""
    ).trim();

    if (!content) {
      return {
        ok: false,
        error: "لا يمكن حفظ منشور فارغ."
      };
    }

    const posts = getLocalPosts();

    const normalized = {
      ...clone(post),
      id: post.id || createId("post"),
      content,
      updatedAt: nowISO()
    };

    posts.unshift(normalized);

    const result = set(
      CONFIG.keys.localPosts,
      posts.slice(0, CONFIG.limits.localPosts)
    );

    return {
      ...result,
      id: normalized.id
    };
  }

  function deleteLocalPost(id) {
    const posts = getLocalPosts();

    const updated = posts.filter(
      item => String(item.id) !== String(id)
    );

    return set(
      CONFIG.keys.localPosts,
      updated
    );
  }

  /* =======================================================
     14. STORAGE INFORMATION
     ======================================================= */

  function getStorageInfo() {
    let usedBytes = 0;
    let itemCount = 0;

    if (!ensureStorage()) {
      return {
        available: false,
        usedBytes: 0,
        usedKB: 0,
        itemCount: 0,
        persistent: false
      };
    }

    try {
      for (
        let index = 0;
        index < localStorage.length;
        index += 1
      ) {
        const key = localStorage.key(index);

        if (
          !key ||
          !key.startsWith(CONFIG.prefix)
        ) {
          continue;
        }

        const value = localStorage.getItem(key) || "";

        usedBytes += new Blob(
          [key + value]
        ).size;

        itemCount += 1;
      }
    } catch {
      return {
        available: false,
        usedBytes: 0,
        usedKB: 0,
        itemCount: 0,
        persistent: false
      };
    }

    return {
      available: true,
      usedBytes,
      usedKB: Math.round(
        (usedBytes / 1024) * 100
      ) / 100,
      itemCount,
      persistent: false
    };
  }

  async function requestPersistentStorage() {
    if (
      !navigator.storage ||
      typeof navigator.storage.persist !== "function"
    ) {
      return {
        supported: false,
        persistent: false
      };
    }

    try {
      const persistent =
        await navigator.storage.persist();

      return {
        supported: true,
        persistent
      };
    } catch {
      return {
        supported: true,
        persistent: false
      };
    }
  }

  /* =======================================================
     15. BACKUP EXPORT
     ======================================================= */

  function exportBackup() {
    if (!ensureStorage()) {
      return {
        ok: false,
        error: "التخزين المحلي غير متاح."
      };
    }

    const data = {};

    try {
      for (
        let index = 0;
        index < localStorage.length;
        index += 1
      ) {
        const key = localStorage.key(index);

        if (
          !key ||
          !key.startsWith(CONFIG.prefix)
        ) {
          continue;
        }

        const shortKey = key.slice(
          CONFIG.prefix.length
        );

        const raw = localStorage.getItem(key);

        data[shortKey] = parseJSON(
          raw,
          raw
        );
      }
    } catch (error) {
      return {
        ok: false,
        error: "تعذر قراءة بيانات النسخة الاحتياطية."
      };
    }

    return {
      ok: true,
      backup: {
        application: "MEKA X",
        format: "meka-x-backup",
        version: CONFIG.version,
        createdAt: nowISO(),
        data
      }
    };
  }

  function downloadBackup() {
    const result = exportBackup();

    if (!result.ok) {
      return result;
    }

    try {
      const blob = new Blob(
        [
          JSON.stringify(
            result.backup,
            null,
            2
          )
        ],
        {
          type: "application/json;charset=utf-8"
        }
      );

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;

      anchor.download =
        "meka-x-backup-" +
        new Date().toISOString().slice(0, 10) +
        ".json";

      anchor.style.display = "none";

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);

      emit("backup-exported");

      return {
        ok: true
      };
    } catch (error) {
      return {
        ok: false,
        error: "تعذر تنزيل النسخة الاحتياطية."
      };
    }
  }

  /* =======================================================
     16. BACKUP IMPORT VALIDATION
     ======================================================= */

  function validateBackup(backup) {
    if (
      !backup ||
      typeof backup !== "object"
    ) {
      return {
        ok: false,
        error: "ملف النسخة الاحتياطية غير صالح."
      };
    }

    if (backup.format !== "meka-x-backup") {
      return {
        ok: false,
        error: "نوع الملف ليس نسخة MEKA X احتياطية."
      };
    }

    if (
      !backup.data ||
      typeof backup.data !== "object" ||
      Array.isArray(backup.data)
    ) {
      return {
        ok: false,
        error: "بيانات النسخة الاحتياطية غير صحيحة."
      };
    }

    const raw = serialize(backup);

    if (
      !raw ||
      new Blob([raw]).size > CONFIG.limits.importBytes
    ) {
      return {
        ok: false,
        error: "حجم النسخة الاحتياطية أكبر من المسموح."
      };
    }

    return {
      ok: true
    };
  }

  function importBackup(
    backup,
    options = {}
  ) {
    const {
      merge = false
    } = options;

    const validation = validateBackup(backup);

    if (!validation.ok) {
      return validation;
    }

    if (!ensureStorage()) {
      return {
        ok: false,
        error: "التخزين المحلي غير متاح."
      };
    }

    const incoming = backup.data;

    const allowedKeyPattern =
      /^[a-zA-Z0-9_.:-]{1,180}$/;

    const entries = Object.entries(incoming);

    for (const [key, value] of entries) {
      if (!allowedKeyPattern.test(key)) {
        return {
          ok: false,
          error: "تحتوي النسخة على مفتاح غير صالح."
        };
      }

      if (serialize(value) === null) {
        return {
          ok: false,
          error: "تحتوي النسخة على بيانات غير قابلة للحفظ."
        };
      }
    }

    const previous = {};

    try {
      for (
        let index = 0;
        index < localStorage.length;
        index += 1
      ) {
        const key = localStorage.key(index);

        if (
          key &&
          key.startsWith(CONFIG.prefix)
        ) {
          previous[key] = localStorage.getItem(key);
        }
      }
    } catch {
      return {
        ok: false,
        error: "تعذر تجهيز التخزين للاستيراد."
      };
    }

    try {
      if (!merge) {
        const keysToRemove = [];

        for (
          let index = 0;
          index < localStorage.length;
          index += 1
        ) {
          const key = localStorage.key(index);

          if (
            key &&
            key.startsWith(CONFIG.prefix)
          ) {
            keysToRemove.push(key);
          }
        }

        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
        });
      }

      for (const [key, value] of entries) {
        const storageKey = fullKey(key);

        if (merge && localStorage.getItem(storageKey) !== null) {
          continue;
        }

        const raw = serialize(value);

        if (raw === null) {
          throw new Error(
            "تعذر تجهيز أحد عناصر النسخة الاحتياطية."
          );
        }

        localStorage.setItem(storageKey, raw);
      }

      emit("backup-imported", {
        merge,
        itemCount: entries.length
      });

      return {
        ok: true,
        itemCount: entries.length
      };
    } catch (error) {
      /*
       * محاولة إعادة البيانات السابقة عند فشل الاستيراد.
       */
      try {
        const currentKeys = [];

        for (
          let index = 0;
          index < localStorage.length;
          index += 1
        ) {
          const key = localStorage.key(index);

          if (
            key &&
            key.startsWith(CONFIG.prefix)
          ) {
            currentKeys.push(key);
          }
        }

        currentKeys.forEach(key => {
          localStorage.removeItem(key);
        });

        Object.entries(previous).forEach(([key, value]) => {
          localStorage.setItem(key, value);
        });
      } catch (rollbackError) {
        console.error(
          "[MEKA Storage] Backup rollback failed:",
          rollbackError
        );
      }

      return {
        ok: false,
        error: "فشل استيراد النسخة؛ تمت محاولة استعادة البيانات السابقة."
      };
    }
  }

  /* =======================================================
     17. FILE IMPORT
     ======================================================= */

  async function importBackupFile(file, options = {}) {
    if (!(file instanceof File)) {
      return {
        ok: false,
        error: "لم يتم تحديد ملف صالح."
      };
    }

    if (file.size > CONFIG.limits.importBytes) {
      return {
        ok: false,
        error: "حجم الملف أكبر من 5 ميجابايت."
      };
    }

    let textContent;

    try {
      textContent = await file.text();
    } catch {
      return {
        ok: false,
        error: "تعذر قراءة الملف."
      };
    }

    const backup = parseJSON(
      textContent,
      null
    );

    if (!backup) {
      return {
        ok: false,
        error: "الملف ليس JSON صالحًا."
      };
    }

    return importBackup(
      backup,
      options
    );
  }

  /* =======================================================
     18. CLEAR APP DATA
     ======================================================= */

  function clearAppData(options = {}) {
    const {
      keepSettings = false
    } = options;

    if (!ensureStorage()) {
      return {
        ok: false,
        error: "التخزين المحلي غير متاح."
      };
    }

    const keysToRemove = [];

    try {
      for (
        let index = 0;
        index < localStorage.length;
        index += 1
      ) {
        const key = localStorage.key(index);

        if (
          !key ||
          !key.startsWith(CONFIG.prefix)
        ) {
          continue;
        }

        if (
          keepSettings &&
          key === fullKey(CONFIG.keys.settings)
        ) {
          continue;
        }

        keysToRemove.push(key);
      }

      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });

      emit("app-data-cleared", {
        keepSettings
      });

      return {
        ok: true,
        removedCount: keysToRemove.length
      };
    } catch {
      return {
        ok: false,
        error: "تعذر حذف بعض البيانات المحلية."
      };
    }
  }

  /* =======================================================
     19. CROSS-TAB SYNCHRONIZATION
     ======================================================= */

  window.addEventListener("storage", event => {
    if (
      !event.key ||
      !event.key.startsWith(CONFIG.prefix)
    ) {
      return;
    }

    emit("external-change", {
      key: event.key.slice(
        CONFIG.prefix.length
      ),
      newValue: parseJSON(
        event.newValue,
        event.newValue
      ),
      oldValue: parseJSON(
        event.oldValue,
        event.oldValue
      )
    });
  });

  /* =======================================================
     20. INITIAL METADATA
     ======================================================= */

  function initializeMetadata() {
    const metadata = get(
      CONFIG.keys.metadata,
      null
    );

    if (!metadata) {
      set(CONFIG.keys.metadata, {
        version: CONFIG.version,
        createdAt: nowISO(),
        lastOpenedAt: nowISO()
      });

      return;
    }

    set(CONFIG.keys.metadata, {
      ...metadata,
      version: CONFIG.version,
      lastOpenedAt: nowISO()
    });
  }

  /* =======================================================
     21. PUBLIC STORAGE API
     ======================================================= */

  const MekaStorage = Object.freeze({
    version: CONFIG.version,

    createId,

    get,
    set,
    remove,
    has,
    update,

    namespace: makeNamespace,

    subscribe,

    getSettings,
    getSetting,
    setSetting,
    resetSettings,

    getPreferences,
    getPreference,
    setPreference,
    removePreference,

    getDrafts,
    getDraft,
    saveDraft,
    deleteDraft,
    clearDrafts,

    getRecentSearches,
    addRecentSearch,
    clearRecentSearches,

    getFavorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,

    getLocalConversations,
    saveLocalConversation,
    getLocalConversation,
    deleteLocalConversation,
    clearLocalConversations,

    getLocalPosts,
    saveLocalPost,
    deleteLocalPost,

    getStorageInfo,
    requestPersistentStorage,

    exportBackup,
    downloadBackup,
    validateBackup,
    importBackup,
    importBackupFile,

    clearAppData,

    isAvailable() {
      return ensureStorage();
    },

    getConfig() {
      return clone(CONFIG);
    }
  });

  window.MekaStorage = MekaStorage;

  /* =======================================================
     22. CONNECT TO MEKA APP CORE
     ======================================================= */

  function connectToApp() {
    if (!window.MEKA) {
      return;
    }

    /*
     * app.js يستخدم مفاتيح عامة مثل:
     * meka_x_theme
     *
     * لذلك نقرأ الثيم من إعدادات التخزين الموحدة،
     * ثم نزامنه مع واجهة التطبيق عند توفر MEKA.
     */

    const theme = getSetting("theme", "dark");

    if (typeof window.MEKA.applyTheme === "function") {
      window.MEKA.applyTheme(theme, false);
    }

    subscribe(event => {
      if (
        event.name === "setting-changed" &&
        event.detail?.name === "theme"
      ) {
        if (
          typeof window.MEKA.applyTheme === "function"
        ) {
          window.MEKA.applyTheme(
            event.detail.value,
            false
          );
        }
      }
    });

    window.MEKAStorageReady = true;

    if (typeof window.MEKA.on === "function") {
      window.MEKA.on("initialized", () => {
        window.MEKAStorageReady = true;
      });
    }
  }

  /* =======================================================
     23. INITIALIZE
     ======================================================= */

  function initialize() {
    checkAvailability();

    if (storageAvailable) {
      initializeMetadata();
    }

    connectToApp();

    try {
      document.dispatchEvent(
        new CustomEvent("meka:storage-ready", {
          detail: {
            available: storageAvailable,
            version: CONFIG.version
          }
        })
      );
    } catch {
      // لا شيء.
    }

    console.info(
      "[MEKA Storage] Ready:",
      storageAvailable
        ? "local storage available"
        : "local storage unavailable"
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }

})();
