/* ==========================================================
   MEKA X — CENTRAL CONFIGURATION
   File: config.js
   Purpose: App settings and public service configuration
   ========================================================== */

(function () {
  "use strict";

  if (window.MEKA_CONFIG?.__initialized) {
    console.warn("[MEKA X] Configuration already initialized.");
    return;
  }

  const DEFAULT_CONFIG = {
    APP_NAME: "MEKA X",
    APP_NAME_AR: "ميكا إكس",
    APP_VERSION: "1.0.0",
    APP_DESCRIPTION: "منصتك الاجتماعية، بطريقتك.",
    APP_LANGUAGE: "ar",
    APP_DIRECTION: "rtl",

    // Change these only when the corresponding pages exist.
    AUTH_REDIRECT_AFTER_LOGIN: "",
    AUTH_REDIRECT_AFTER_LOGOUT: "",

    // Supabase public project settings.
    // Set these values after configuring your Supabase project.
    SUPABASE_URL: "",
    SUPABASE_ANON_KEY: "",

    // UI preferences.
    DEFAULT_THEME: "dark",
    ENABLE_ANIMATIONS: true,
    ENABLE_NOTIFICATIONS: true,

    // Local storage namespace.
    STORAGE_PREFIX: "meka_x_",

    // Public feature switches.
    FEATURES: {
      AUTHENTICATION: true,
      GOOGLE_LOGIN: true,
      LOCAL_STORAGE: true,
      DARK_THEME: true,
      LIGHT_THEME: true,
      SEARCH: true,
      NOTIFICATIONS: true
    },

    // Never place secret server keys in this file.
    __initialized: true
  };

  const existing = window.MEKA_CONFIG || {};

  const mergedFeatures = {
    ...DEFAULT_CONFIG.FEATURES,
    ...(existing.FEATURES || {})
  };

  const config = {
    ...DEFAULT_CONFIG,
    ...existing,
    FEATURES: mergedFeatures,
    __initialized: true
  };

  /*
   * Validate the public Supabase configuration.
   * The app can still load without Supabase.
   */
  function validateSupabaseConfig() {
    const url = String(config.SUPABASE_URL || "").trim();
    const key = String(config.SUPABASE_ANON_KEY || "").trim();

    if (!url && !key) {
      return {
        configured: false,
        valid: false,
        message: "Supabase is not configured yet."
      };
    }

    if (!url || !key) {
      return {
        configured: true,
        valid: false,
        message: "Supabase URL or public key is missing."
      };
    }

    let parsedUrl;

    try {
      parsedUrl = new URL(url);
    } catch {
      return {
        configured: true,
        valid: false,
        message: "Supabase URL is invalid."
      };
    }

    if (
      parsedUrl.protocol !== "https:" &&
      parsedUrl.hostname !== "localhost"
    ) {
      return {
        configured: true,
        valid: false,
        message: "Supabase must use HTTPS."
      };
    }

    return {
      configured: true,
      valid: true,
      message: "Supabase configuration looks valid."
    };
  }

  /*
   * Return a safe snapshot without exposing credentials.
   */
  function getPublicSettings() {
    const validation = validateSupabaseConfig();

    return Object.freeze({
      appName: config.APP_NAME,
      appNameAr: config.APP_NAME_AR,
      version: config.APP_VERSION,
      language: config.APP_LANGUAGE,
      direction: config.APP_DIRECTION,
      defaultTheme: config.DEFAULT_THEME,
      animationsEnabled: Boolean(config.ENABLE_ANIMATIONS),
      notificationsEnabled: Boolean(config.ENABLE_NOTIFICATIONS),
      supabaseConfigured: validation.valid,
      features: Object.freeze({ ...config.FEATURES })
    });
  }

  /*
   * Check whether a feature is enabled.
   */
  function isFeatureEnabled(name) {
    if (!name) return false;

    return config.FEATURES[
      String(name).trim().toUpperCase()
    ] === true;
  }

  /*
   * Allow safe runtime UI preference changes.
   * Connection credentials cannot be changed here.
   */
  function updatePreferences(preferences = {}) {
    const allowed = [
      "DEFAULT_THEME",
      "ENABLE_ANIMATIONS",
      "ENABLE_NOTIFICATIONS"
    ];

    allowed.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(preferences, key)) {
        return;
      }

      if (key === "DEFAULT_THEME") {
        const theme = String(preferences[key]).toLowerCase();

        if (theme === "dark" || theme === "light") {
          config.DEFAULT_THEME = theme;
        }

        return;
      }

      if (typeof preferences[key] === "boolean") {
        config[key] = preferences[key];
      }
    });

    document.documentElement.dataset.theme =
      config.DEFAULT_THEME;

    document.documentElement.lang =
      config.APP_LANGUAGE;

    document.documentElement.dir =
      config.APP_DIRECTION;

    window.dispatchEvent(
      new CustomEvent("meka:config-updated", {
        detail: {
          settings: getPublicSettings()
        }
      })
    );

    return getPublicSettings();
  }

  /*
   * Read a feature-safe configuration snapshot.
   */
  function getSupabaseSettings() {
    const validation = validateSupabaseConfig();

    if (!validation.valid) {
      return {
        configured: false,
        url: "",
        anonKey: "",
        message: validation.message
      };
    }

    return {
      configured: true,
      url: config.SUPABASE_URL,
      anonKey: config.SUPABASE_ANON_KEY,
      message: validation.message
    };
  }

  /*
   * Initialize basic document settings.
   */
  function initializeDocument() {
    if (!document.documentElement) return;

    document.documentElement.lang =
      config.APP_LANGUAGE;

    document.documentElement.dir =
      config.APP_DIRECTION;

    document.documentElement.dataset.theme =
      config.DEFAULT_THEME;

    const themeColor = document.querySelector(
      'meta[name="theme-color"]'
    );

    if (themeColor) {
      themeColor.content =
        config.DEFAULT_THEME === "dark"
          ? "#0b0b18"
          : "#f5f6ff";
    }

    if (!document.title || document.title === "Document") {
      document.title =
        config.APP_NAME + " — " + config.APP_NAME_AR;
    }
  }

  /*
   * Keep credentials out of console output.
   */
  function reportStatus() {
    const validation = validateSupabaseConfig();

    const status = {
      app: config.APP_NAME,
      version: config.APP_VERSION,
      supabaseConfigured: validation.valid,
      message: validation.message
    };

    console.info("[MEKA X] Configuration loaded.", status);

    window.dispatchEvent(
      new CustomEvent("meka:config-ready", {
        detail: {
          settings: getPublicSettings(),
          supabase: {
            configured: validation.valid,
            message: validation.message
          }
        }
      })
    );

    return status;
  }

  /*
   * Expose the configuration API.
   */
  const api = {
    getPublicSettings,
    getSupabaseSettings,
    validateSupabaseConfig,
    isFeatureEnabled,
    updatePreferences,
    reportStatus
  };

  Object.defineProperty(window, "MEKA_CONFIG", {
    value: config,
    writable: false,
    configurable: false,
    enumerable: true
  });

  Object.defineProperty(window, "MekaConfig", {
    value: Object.freeze(api),
    writable: false,
    configurable: false,
    enumerable: true
  });

  initializeDocument();
  reportStatus();

})();
