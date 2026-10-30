/* =========================================================
   MEKA CHAT
   CORE APPLICATION ENGINE
   File 4 / 10
========================================================= */

"use strict";

(() => {
  const MEKA = window.MEKA || (window.MEKA = {});

  /* =======================================================
     APPLICATION STATE
  ======================================================= */

  MEKA.state = {
    initialized: false,
    loading: true,
    authenticated: false,
    user: null,
    session: null,
    currentScreen: "welcome",
    previousScreen: null,
    activeConversation: null,
    activeMenu: null,
    activeModal: null,
    searchQuery: "",
    networkOnline: navigator.onLine,
    language: window.mekaGetLanguage
      ? window.mekaGetLanguage()
      : "ar",
    theme: localStorage.getItem("meka-theme") || "dark"
  };

  MEKA.events = new EventTarget();

  /* =======================================================
     DOM HELPERS
  ======================================================= */

  MEKA.$ = (selector, parent = document) => {
    return parent.querySelector(selector);
  };

  MEKA.$$ = (selector, parent = document) => {
    return Array.from(parent.querySelectorAll(selector));
  };

  MEKA.getElement = (...selectors) => {
    for (const selector of selectors) {
      const element = document.querySelector(selector);

      if (element) return element;
    }

    return null;
  };

  MEKA.getElements = (selector) => {
    return Array.from(document.querySelectorAll(selector));
  };

  MEKA.escapeHTML = (value = "") => {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  };

  MEKA.emit = (eventName, detail = {}) => {
    MEKA.events.dispatchEvent(
      new CustomEvent(eventName, { detail })
    );

    window.dispatchEvent(
      new CustomEvent("meka:" + eventName, { detail })
    );
  };

  MEKA.on = (eventName, callback) => {
    MEKA.events.addEventListener(eventName, event => {
      callback(event.detail);
    });
  };

  /* =======================================================
     TOAST NOTIFICATIONS
  ======================================================= */

  MEKA.toastContainer = null;

  MEKA.createToastContainer = () => {
    let container = document.getElementById(
      "mekaToastContainer"
    );

    if (!container) {
      container = document.createElement("div");

      container.id = "mekaToastContainer";
      container.className = "meka-toast-container";

      container.setAttribute(
        "aria-live",
        "polite"
      );

      document.body.appendChild(container);
    }

    MEKA.toastContainer = container;

    return container;
  };

  MEKA.toast = (message, type = "info", duration = 3500) => {
    const container = MEKA.createToastContainer();

    const toast = document.createElement("div");

    const icons = {
      success: "✓",
      error: "!",
      warning: "⚠",
      info: "i"
    };

    toast.className =
      "meka-toast meka-toast-" + type;

    toast.innerHTML = `
      <span class="meka-toast-icon">
        ${icons[type] || icons.info}
      </span>

      <span class="meka-toast-message"></span>

      <button
        class="meka-toast-close"
        type="button"
        aria-label="إغلاق"
      >×</button>
    `;

    toast.querySelector(
      ".meka-toast-message"
    ).textContent = String(message);

    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    const remove = () => {
      toast.classList.remove("show");

      setTimeout(() => {
        toast.remove();
      }, 250);
    };

    toast.querySelector(
      ".meka-toast-close"
    ).addEventListener("click", remove);

    if (duration > 0) {
      setTimeout(remove, duration);
    }

    return toast;
  };

  window.mekaToast = MEKA.toast;

  /* =======================================================
     LOADING OVERLAY
  ======================================================= */

  MEKA.showLoading = (message = "جاري التحميل...") => {
    let overlay = document.getElementById(
      "mekaLoadingOverlay"
    );

    if (!overlay) {
      overlay = document.createElement("div");

      overlay.id = "mekaLoadingOverlay";
      overlay.className = "meka-loading-overlay";

      overlay.innerHTML = `
        <div class="meka-loading-box">
          <div class="meka-spinner"></div>
          <div class="meka-loading-message"></div>
        </div>
      `;

      document.body.appendChild(overlay);
    }

    overlay.querySelector(
      ".meka-loading-message"
    ).textContent = message;

    overlay.classList.add("active");

    return overlay;
  };

  MEKA.hideLoading = () => {
    const overlay = document.getElementById(
      "mekaLoadingOverlay"
    );

    if (overlay) {
      overlay.classList.remove("active");
    }
  };

  window.mekaShowLoading = MEKA.showLoading;
  window.mekaHideLoading = MEKA.hideLoading;

  /* =======================================================
     MODAL SYSTEM
  ======================================================= */

  MEKA.openModal = (content, options = {}) => {
    MEKA.closeModal();

    const modal = document.createElement("div");

    modal.className = "meka-modal-overlay";
    modal.id = "mekaActiveModal";

    modal.innerHTML = `
      <div
        class="meka-modal"
        role="dialog"
        aria-modal="true"
      >
        <div class="meka-modal-header">
          <h3 class="meka-modal-title"></h3>

          <button
            type="button"
            class="meka-modal-close"
            aria-label="إغلاق"
          >×</button>
        </div>

        <div class="meka-modal-content"></div>
      </div>
    `;

    modal.querySelector(
      ".meka-modal-title"
    ).textContent = options.title || "";

    const body = modal.querySelector(
      ".meka-modal-content"
    );

    if (content instanceof Node) {
      body.appendChild(content);
    } else {
      body.innerHTML = String(content || "");
    }

    document.body.appendChild(modal);

    requestAnimationFrame(() => {
      modal.classList.add("active");
    });

    modal.querySelector(
      ".meka-modal-close"
    ).addEventListener("click", MEKA.closeModal);

    modal.addEventListener("click", event => {
      if (
        event.target === modal &&
        options.closeOnBackdrop !== false
      ) {
        MEKA.closeModal();
      }
    });

    MEKA.state.activeModal = modal;

    MEKA.emit("modal-opened", {
      modal,
      options
    });

    return modal;
  };

  MEKA.closeModal = () => {
    const modal = document.getElementById(
      "mekaActiveModal"
    );

    if (!modal) return;

    modal.classList.remove("active");

    setTimeout(() => modal.remove(), 200);

    MEKA.state.activeModal = null;

    MEKA.emit("modal-closed");
  };

  window.mekaOpenModal = MEKA.openModal;
  window.mekaCloseModal = MEKA.closeModal;

  /* =======================================================
     CONFIRMATION DIALOG
  ======================================================= */

  MEKA.confirm = (message, options = {}) => {
    return new Promise(resolve => {
      const wrapper = document.createElement("div");

      wrapper.className = "meka-confirm";

      wrapper.innerHTML = `
        <p class="meka-confirm-message"></p>

        <div class="meka-confirm-actions">
          <button
            type="button"
            class="meka-confirm-cancel"
          >إلغاء</button>

          <button
            type="button"
            class="meka-confirm-accept"
          >تأكيد</button>
        </div>
      `;

      wrapper.querySelector(
        ".meka-confirm-message"
      ).textContent = message;

      const modal = MEKA.openModal(
        wrapper,
        {
          title: options.title || "تأكيد العملية"
        }
      );

      wrapper.querySelector(
        ".meka-confirm-cancel"
      ).addEventListener("click", () => {
        MEKA.closeModal();
        resolve(false);
      });

      wrapper.querySelector(
        ".meka-confirm-accept"
      ).addEventListener("click", () => {
        MEKA.closeModal();
        resolve(true);
      });

      modal.addEventListener("click", event => {
        if (event.target === modal) {
          resolve(false);
        }
      }, { once: true });
    });
  };

  window.mekaConfirm = MEKA.confirm;

  /* =======================================================
     SCREEN NAVIGATION
  ======================================================= */

  MEKA.normalizeScreen = (screen) => {
    return String(screen || "")
      .replace(/^#/, "")
      .trim()
      .toLowerCase();
  };

  MEKA.findScreen = (screenName) => {
    const name = MEKA.normalizeScreen(screenName);

    return (
      document.querySelector(
        `[data-screen="${name}"]`
      ) ||
      document.getElementById(name) ||
      document.querySelector(
        `[id="${name}-screen"]`
      )
    );
  };

  MEKA.hideAllScreens = () => {
    MEKA.$$(".screen, .app-screen, [data-screen]")
      .forEach(screen => {
        screen.classList.remove("active");
        screen.classList.remove("screen-active");

        screen.setAttribute("aria-hidden", "true");
      });
  };

  MEKA.navigate = (screenName, options = {}) => {
    const name = MEKA.normalizeScreen(screenName);

    if (!name) return false;

    const screen = MEKA.findScreen(name);

    if (!screen) {
      console.warn(
        "MEKA: Screen not found:",
        name
      );

      MEKA.emit("screen-not-found", {
        screen: name
      });

      return false;
    }

    const previous = MEKA.state.currentScreen;

    MEKA.hideAllScreens();

    screen.classList.add("active");
    screen.classList.add("screen-active");

    screen.removeAttribute("aria-hidden");

    MEKA.state.previousScreen = previous;
    MEKA.state.currentScreen = name;

    if (options.history !== false) {
      try {
        history.replaceState(
          { screen: name },
          "",
          "#" + encodeURIComponent(name)
        );
      } catch (error) {
        console.warn(error);
      }
    }

    MEKA.updateNavigation(name);

    MEKA.closeMenus();

    MEKA.emit("screen-changed", {
      screen: name,
      previous
    });

    window.scrollTo({
      top: 0,
      behavior: "instant"
    });

    return true;
  };

  MEKA.updateNavigation = (screenName) => {
    MEKA.$$(
      "[data-nav], [data-navigate]"
    ).forEach(button => {
      const target =
        button.dataset.nav ||
        button.dataset.navigate;

      const active =
        MEKA.normalizeScreen(target) === screenName;

      button.classList.toggle("active", active);

      if (active) {
        button.setAttribute(
          "aria-current",
          "page"
        );
      } else {
        button.removeAttribute("aria-current");
      }
    });
  };

  MEKA.goBack = () => {
    const previous = MEKA.state.previousScreen;

    if (previous) {
      return MEKA.navigate(previous);
    }

    return MEKA.navigate("home");
  };

  window.mekaNavigate = MEKA.navigate;
  window.mekaGoBack = MEKA.goBack;

  /* =======================================================
     MENU SYSTEM
  ======================================================= */

  MEKA.closeMenus = () => {
    MEKA.$$(".meka-menu.open, .dropdown-menu.open")
      .forEach(menu => {
        menu.classList.remove("open");
      });

    MEKA.state.activeMenu = null;
  };

  MEKA.toggleMenu = (menu) => {
    if (typeof menu === "string") {
      menu = document.querySelector(menu);
    }

    if (!menu) return false;

    const wasOpen = menu.classList.contains("open");

    MEKA.closeMenus();

    if (!wasOpen) {
      menu.classList.add("open");

      MEKA.state.activeMenu = menu;
    }

    return !wasOpen;
  };

  /* =======================================================
     THEME SYSTEM
  ======================================================= */

  MEKA.applyTheme = (theme) => {
    const allowed = ["dark", "light", "system"];

    if (!allowed.includes(theme)) {
      theme = "dark";
    }

    MEKA.state.theme = theme;

    localStorage.setItem("meka-theme", theme);

    let actualTheme = theme;

    if (theme === "system") {
      actualTheme = window.matchMedia(
        "(prefers-color-scheme: light)"
      ).matches ? "light" : "dark";
    }

    document.documentElement.dataset.theme =
      actualTheme;

    document.documentElement.classList.toggle(
      "light-theme",
      actualTheme === "light"
    );

    document.documentElement.classList.toggle(
      "dark-theme",
      actualTheme === "dark"
    );

    MEKA.emit("theme-changed", {
      theme,
      actualTheme
    });

    return actualTheme;
  };

  window.mekaSetTheme = MEKA.applyTheme;

  /* =======================================================
     LANGUAGE SYSTEM
  ======================================================= */

  MEKA.applyLanguage = (language) => {
    if (!window.mekaSetLanguage) {
      return false;
    }

    const result =
      window.mekaSetLanguage(language);

    if (!result) return false;

    MEKA.state.language = language;

    MEKA.emit("language-changed", {
      language
    });

    return true;
  };

  window.mekaSetLanguage = MEKA.applyLanguage;

  /* =======================================================
     NETWORK STATUS
  ======================================================= */

  MEKA.updateNetworkStatus = () => {
    MEKA.state.networkOnline = navigator.onLine;

    document.documentElement.classList.toggle(
      "offline",
      !navigator.onLine
    );

    const indicator = MEKA.getElement(
      "#networkStatus",
      "#connectionStatus",
      "[data-network-status]"
    );

    if (indicator) {
      indicator.textContent = navigator.onLine
        ? "متصل بالإنترنت"
        : "لا يوجد اتصال بالإنترنت";

      indicator.classList.toggle(
        "online",
        navigator.onLine
      );

      indicator.classList.toggle(
        "offline",
        !navigator.onLine
      );
    }

    MEKA.emit("network-changed", {
      online: navigator.onLine
    });
  };

  window.addEventListener(
    "online",
    MEKA.updateNetworkStatus
  );

  window.addEventListener(
    "offline",
    MEKA.updateNetworkStatus
  );

  /* =======================================================
     AUTHENTICATION STATE
  ======================================================= */

  MEKA.setUser = (user, session = null) => {
    MEKA.state.user = user || null;
    MEKA.state.session = session || null;
    MEKA.state.authenticated = !!user;

    MEKA.emit("user-changed", {
      user: MEKA.state.user,
      session: MEKA.state.session,
      authenticated: MEKA.state.authenticated
    });
  };

  MEKA.checkSession = async () => {
    if (!window.mekaSupabase) {
      MEKA.setUser(null);

      return {
        authenticated: false,
        reason: "database-unavailable"
      };
    }

    try {
      const {
        data,
        error
      } = await window.mekaSupabase.auth.getSession();

      if (error) throw error;

      const session = data.session;

      if (!session || !session.user) {
        MEKA.setUser(null);

        return {
          authenticated: false,
          reason: "no-session"
        };
      }

      MEKA.setUser(
        session.user,
        session
      );

      return {
        authenticated: true,
        user: session.user,
        session
      };

    } catch (error) {
      console.error(
        "MEKA session check failed:",
        error
      );

      MEKA.setUser(null);

      return {
        authenticated: false,
        reason: "session-error",
        error
      };
    }
  };

  MEKA.watchAuth = () => {
    if (!window.mekaSupabase) return;

    window.mekaSupabase.auth.onAuthStateChange(
      (event, session) => {
        MEKA.setUser(
          session?.user || null,
          session || null
        );

        MEKA.emit("auth-state-changed", {
          event,
          session
        });

        if (event === "SIGNED_OUT") {
          MEKA.navigate("welcome");
        }

        if (event === "SIGNED_IN") {
          MEKA.navigate("home");
        }

        if (event === "TOKEN_REFRESHED") {
          MEKA.emit("token-refreshed");
        }
      }
    );
  };

  /* =======================================================
     SPLASH SCREEN
  ======================================================= */

  MEKA.hideSplash = () => {
    const splash = MEKA.getElement(
      "#splashScreen",
      "#splash",
      ".splash-screen",
      "[data-splash]"
    );

    if (!splash) return;

    splash.classList.add("hide");

    setTimeout(() => {
      splash.style.display = "none";
      splash.setAttribute("aria-hidden", "true");
    }, 450);
  };

  MEKA.showSplash = () => {
    const splash = MEKA.getElement(
      "#splashScreen",
      "#splash",
      ".splash-screen",
      "[data-splash]"
    );

    if (!splash) return;

    splash.style.display = "flex";

    splash.classList.remove("hide");

    splash.removeAttribute("aria-hidden");
  };

  /* =======================================================
     INITIAL SCREEN ROUTING
  ======================================================= */

  MEKA.routeAfterStartup = async () => {
    const result = await MEKA.checkSession();

    if (result.authenticated) {
      const home = MEKA.findScreen("home");

      if (home) {
        MEKA.navigate("home");
      } else {
        MEKA.navigate("main");
      }

      MEKA.emit("application-authenticated", {
        user: result.user
      });

      return;
    }

    const welcome = MEKA.findScreen("welcome");

    if (welcome) {
      MEKA.navigate("welcome");
    } else if (MEKA.findScreen("login")) {
      MEKA.navigate("login");
    } else {
      MEKA.navigate("auth");
    }

    MEKA.emit("application-guest");
  };

  /* =======================================================
     SEARCH SYSTEM
  ======================================================= */

  MEKA.handleSearch = (query) => {
    MEKA.state.searchQuery =
      String(query || "").trim();

    MEKA.emit("search", {
      query: MEKA.state.searchQuery
    });
  };

  /* =======================================================
     GLOBAL CLICK EVENTS
  ======================================================= */

  MEKA.bindNavigation = () => {
    document.addEventListener("click", event => {
      const navigationButton = event.target.closest(
        "[data-nav], [data-navigate]"
      );

      if (navigationButton) {
        event.preventDefault();

        const target =
          navigationButton.dataset.nav ||
          navigationButton.dataset.navigate;

        MEKA.navigate(target);

        return;
      }

      const menuButton = event.target.closest(
        "[data-menu-toggle]"
      );

      if (menuButton) {
        event.preventDefault();

        const selector =
          menuButton.dataset.menuToggle;

        MEKA.toggleMenu(selector);

        return;
      }

      const closeButton = event.target.closest(
        "[data-close-modal]"
      );

      if (closeButton) {
        MEKA.closeModal();

        return;
      }

      const actionButton = event.target.closest(
        "[data-action]"
      );

      if (actionButton) {
        const action =
          actionButton.dataset.action;

        MEKA.emit("action", {
          action,
          element: actionButton,
          event
        });
      }
    });

    document.addEventListener("click", event => {
      if (
        !event.target.closest(
          ".meka-menu, .dropdown-menu, [data-menu-toggle]"
        )
      ) {
        MEKA.closeMenus();
      }
    });
  };

  /* =======================================================
     SEARCH INPUT EVENTS
  ======================================================= */

  MEKA.bindSearch = () => {
    document.addEventListener("input", event => {
      const input = event.target.closest(
        "[data-meka-search], #globalSearch, #searchInput"
      );

      if (!input) return;

      MEKA.handleSearch(input.value);
    });
  };

  /* =======================================================
     KEYBOARD SHORTCUTS
  ======================================================= */

  MEKA.bindKeyboard = () => {
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        MEKA.closeMenus();
        MEKA.closeModal();
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        const search = MEKA.getElement(
          "#globalSearch",
          "#searchInput",
          "[data-meka-search]"
        );

        if (search) {
          event.preventDefault();
          search.focus();
        }
      }
    });
  };

  /* =======================================================
     VISIBILITY
  ======================================================= */

  MEKA.bindVisibility = () => {
    document.addEventListener(
      "visibilitychange",
      () => {
        MEKA.emit("visibility-changed", {
          visible: !document.hidden
        });
      }
    );
  };

  /* =======================================================
     PROFILE CACHE
  ======================================================= */

  MEKA.profileCache = new Map();

  MEKA.getProfile = async (userId, force = false) => {
    if (!userId || !window.mekaSupabase) {
      return null;
    }

    if (
      !force &&
      MEKA.profileCache.has(userId)
    ) {
      return MEKA.profileCache.get(userId);
    }

    try {
      const {
        data,
        error
      } = await window.mekaSupabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        MEKA.profileCache.set(userId, data);
      }

      return data || null;

    } catch (error) {
      console.error(
        "MEKA profile loading failed:",
        error
      );

      return null;
    }
  };

  /* =======================================================
     DATABASE CONNECTION STATUS
  ======================================================= */

  MEKA.checkConnection = async () => {
    if (!window.mekaCheckDatabase) {
      return false;
    }

    const result =
      await window.mekaCheckDatabase();

    MEKA.emit("database-status", result);

    return result.connected;
  };

  /* =======================================================
     APPLICATION INITIALIZATION
  ======================================================= */

  MEKA.initialize = async () => {
    if (MEKA.state.initialized) return;

    MEKA.state.initialized = true;

    const startTime = Date.now();

    MEKA.applyTheme(MEKA.state.theme);

    MEKA.updateNetworkStatus();

    MEKA.bindNavigation();
    MEKA.bindSearch();
    MEKA.bindKeyboard();
    MEKA.bindVisibility();

    MEKA.watchAuth();

    MEKA.emit("application-starting");

    if (window.mekaSupabase) {
      await MEKA.routeAfterStartup();
    } else {
      console.warn(
        "MEKA: Supabase client is not available."
      );

      MEKA.navigate("welcome");

      MEKA.toast(
        "تعذر الاتصال بقاعدة البيانات. راجع إعدادات الاتصال.",
        "warning",
        5000
      );
    }

    const splashDuration =
      window.MEKA_CONFIG?.APP?.splashDuration || 5000;

    const elapsed = Date.now() - startTime;

    const remaining = Math.max(
      0,
      splashDuration - elapsed
    );

    setTimeout(() => {
      MEKA.hideSplash();

      MEKA.state.loading = false;

      MEKA.emit("application-ready");

    }, remaining);
  };

  /* =======================================================
     START APPLICATION
  ======================================================= */

  const start = () => {
    MEKA.initialize().catch(error => {
      console.error(
        "MEKA startup error:",
        error
      );

      MEKA.hideSplash();

      MEKA.toast(
        "حدث خطأ أثناء تشغيل التطبيق.",
        "error"
      );
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      start,
      { once: true }
    );
  } else {
    start();
  }

  /* =======================================================
     GLOBAL API
  ======================================================= */

  window.MEKA = MEKA;

  window.mekaApp = MEKA;

  window.mekaGetUser = () => MEKA.state.user;

  window.mekaIsAuthenticated = () =>
    MEKA.state.authenticated;

  window.mekaGetCurrentScreen = () =>
    MEKA.state.currentScreen;

  window.mekaGoHome = () =>
    MEKA.navigate("home");

  window.mekaShowWelcome = () =>
    MEKA.navigate("welcome");

  window.mekaShowLogin = () =>
    MEKA.navigate("login");

  window.mekaShowRegister = () =>
    MEKA.navigate("register");

})();
