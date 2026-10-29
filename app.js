/* =========================================================
   MEKA X — APPLICATION CORE
   File: app.js
   Version: 1.0.0
   ========================================================= */

(() => {
  "use strict";

  /* =======================================================
     1. APPLICATION CONFIGURATION
     ======================================================= */

  const MEKA = {
    name: "MEKA X",
    version: "1.0.0",
    storagePrefix: "meka_x_",
    splashDuration: 5000,

    selectors: {
      splash: [
        "#splashScreen",
        "#splash-screen",
        ".splash-screen",
        ".splash"
      ],

      app: [
        "#app",
        "#appContainer",
        "#mainApp",
        ".app-container",
        ".main-app"
      ],

      mainContent: [
        "#mainContent",
        "#main-content",
        ".main-content",
        "[data-main-content]"
      ],

      navigation: [
        "[data-page]",
        "[data-navigation]",
        ".nav-item",
        ".sidebar-link"
      ],

      menuToggle: [
        "[data-menu-toggle]",
        "#menuToggle",
        "#sidebarToggle",
        ".menu-toggle"
      ],

      sidebar: [
        "[data-sidebar]",
        "#sidebar",
        ".sidebar",
        ".app-sidebar"
      ],

      themeToggle: [
        "[data-theme-toggle]",
        "#themeToggle",
        "#theme-toggle"
      ],

      modalOpen: "[data-modal-open]",
      modalClose: "[data-modal-close]",

      search: [
        "[data-global-search]",
        "#globalSearch",
        "#searchInput"
      ],

      toastContainer: [
        "[data-toast-container]",
        "#toastContainer",
        ".toast-container"
      ]
    }
  };

  const state = {
    initialized: false,
    currentPage: null,
    sidebarOpen: false,
    activeModal: null,
    toastTimer: null,
    splashTimer: null,
    cleanupFunctions: [],
    pageHandlers: new Map()
  };

  /* =======================================================
     2. DOM HELPERS
     ======================================================= */

  function query(selector, root = document) {
    try {
      return root.querySelector(selector);
    } catch {
      return null;
    }
  }

  function queryAll(selector, root = document) {
    try {
      return Array.from(root.querySelectorAll(selector));
    } catch {
      return [];
    }
  }

  function findFirst(selectors, root = document) {
    for (const selector of selectors) {
      const element = query(selector, root);

      if (element) {
        return element;
      }
    }

    return null;
  }

  function findAll(selectors, root = document) {
    const elements = new Set();

    for (const selector of selectors) {
      queryAll(selector, root).forEach(element => {
        elements.add(element);
      });
    }

    return Array.from(elements);
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getStorage(key, fallback = null) {
    try {
      const value = localStorage.getItem(
        MEKA.storagePrefix + key
      );

      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function setStorage(key, value) {
    try {
      localStorage.setItem(
        MEKA.storagePrefix + key,
        String(value)
      );

      return true;
    } catch {
      return false;
    }
  }

  function removeStorage(key) {
    try {
      localStorage.removeItem(
        MEKA.storagePrefix + key
      );

      return true;
    } catch {
      return false;
    }
  }

  function dispatch(name, detail = {}) {
    document.dispatchEvent(
      new CustomEvent("meka:" + name, {
        detail
      })
    );
  }

  /* =======================================================
     3. ACCESSIBLE ANNOUNCEMENTS
     ======================================================= */

  function announce(message) {
    let region = query("#mekaLiveRegion");

    if (!region) {
      region = document.createElement("div");

      region.id = "mekaLiveRegion";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      region.setAttribute("aria-atomic", "true");

      Object.assign(region.style, {
        position: "absolute",
        width: "1px",
        height: "1px",
        padding: "0",
        margin: "-1px",
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        border: "0"
      });

      document.body.appendChild(region);
    }

    region.textContent = "";

    requestAnimationFrame(() => {
      region.textContent = String(message ?? "");
    });
  }

  /* =======================================================
     4. TOAST NOTIFICATIONS
     ======================================================= */

  function getToastContainer() {
    let container = findFirst(
      MEKA.selectors.toastContainer
    );

    if (!container) {
      container = document.createElement("div");

      container.id = "mekaToastContainer";
      container.className = "mx-toast-container";
      container.setAttribute("aria-live", "polite");
      container.setAttribute("aria-atomic", "false");

      Object.assign(container.style, {
        position: "fixed",
        zIndex: "99999",
        top: "20px",
        insetInlineEnd: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        width: "min(360px, calc(100vw - 32px))",
        pointerEvents: "none"
      });

      document.body.appendChild(container);
    }

    return container;
  }

  function toast(message, type = "info", duration = 3200) {
    const container = getToastContainer();
    const item = document.createElement("div");

    const allowedTypes = [
      "success",
      "error",
      "warning",
      "info"
    ];

    const safeType = allowedTypes.includes(type)
      ? type
      : "info";

    item.className =
      "mx-toast mx-toast-" + safeType;

    item.setAttribute("role", "status");

    Object.assign(item.style, {
      pointerEvents: "auto",
      padding: "13px 16px",
      borderRadius: "14px",
      background: "var(--mx-surface-raised, #161d31)",
      color: "var(--mx-text, #f5f7ff)",
      border: "1px solid var(--mx-border-light, #30364b)",
      boxShadow: "var(--mx-shadow-lg, 0 18px 48px #0004)",
      opacity: "0",
      transform: "translateY(-8px)",
      transition: "opacity 180ms ease, transform 180ms ease",
      overflowWrap: "anywhere"
    });

    item.textContent = String(message ?? "");

    container.appendChild(item);

    requestAnimationFrame(() => {
      item.style.opacity = "1";
      item.style.transform = "translateY(0)";
    });

    const timeout = window.setTimeout(() => {
      item.style.opacity = "0";
      item.style.transform = "translateY(-8px)";

      window.setTimeout(() => {
        item.remove();
      }, 200);
    }, Math.max(500, duration));

    state.cleanupFunctions.push(() => {
      clearTimeout(timeout);
      item.remove();
    });

    announce(message);

    dispatch("toast", {
      message,
      type: safeType
    });

    return item;
  }

  /* =======================================================
     5. LOADING INDICATOR
     ======================================================= */

  function setLoading(isLoading, message = "جارٍ التحميل...") {
    document.documentElement.classList.toggle(
      "is-loading",
      Boolean(isLoading)
    );

    const indicator = query(
      "[data-app-loading], #appLoading"
    );

    if (indicator) {
      indicator.hidden = !isLoading;
      indicator.setAttribute(
        "aria-hidden",
        String(!isLoading)
      );

      const label = query(
        "[data-loading-message]",
        indicator
      );

      if (label) {
        label.textContent = message;
      }
    }

    dispatch("loading", {
      loading: Boolean(isLoading),
      message
    });
  }

  /* =======================================================
     6. SPLASH SCREEN
     ======================================================= */

  function finishSplash() {
    const splash = findFirst(
      MEKA.selectors.splash
    );

    const app = findFirst(
      MEKA.selectors.app
    );

    if (splash) {
      splash.classList.add("is-hidden");
      splash.setAttribute("aria-hidden", "true");
      splash.style.pointerEvents = "none";

      window.setTimeout(() => {
        splash.hidden = true;
        splash.style.display = "none";
      }, 450);
    }

    if (app) {
      app.hidden = false;
      app.removeAttribute("aria-hidden");
      app.classList.add("is-ready");
    }

    document.documentElement.classList.remove(
      "is-starting"
    );

    document.documentElement.classList.add(
      "app-ready"
    );

    setStorage("hasOpened", "true");

    dispatch("splash-finished");

    if (!state.currentPage) {
      const firstNavigation = findAll(
        MEKA.selectors.navigation
      ).find(element => {
        return element.dataset.page;
      });

      const initialPage =
        firstNavigation?.dataset.page ||
        getStorage("lastPage", "home");

      navigate(initialPage, {
        updateHistory: false,
        silent: true
      });
    }
  }

  function initializeSplash() {
    document.documentElement.classList.add(
      "is-starting"
    );

    const splash = findFirst(
      MEKA.selectors.splash
    );

    const app = findFirst(
      MEKA.selectors.app
    );

    if (app) {
      app.hidden = false;
    }

    if (!splash) {
      finishSplash();
      return;
    }

    splash.hidden = false;
    splash.removeAttribute("aria-hidden");

    state.splashTimer = window.setTimeout(
      finishSplash,
      MEKA.splashDuration
    );

    const skipButton = query(
      "[data-skip-splash], #skipSplash"
    );

    if (skipButton) {
      skipButton.addEventListener(
        "click",
        () => {
          clearTimeout(state.splashTimer);
          finishSplash();
        },
        { once: true }
      );
    }
  }

  /* =======================================================
     7. PAGE REGISTRY
     ======================================================= */

  const defaultPages = {
    home: {
      title: "الرئيسية",
      selectors: [
        '[data-page-content="home"]',
        "#homePage",
        "#home"
      ]
    },

    feed: {
      title: "المنشورات",
      selectors: [
        '[data-page-content="feed"]',
        "#feedPage",
        "#feed"
      ]
    },

    explore: {
      title: "استكشف",
      selectors: [
        '[data-page-content="explore"]',
        "#explorePage",
        "#explore"
      ]
    },

    messages: {
      title: "الرسائل",
      selectors: [
        '[data-page-content="messages"]',
        "#messagesPage",
        "#messages"
      ]
    },

    chat: {
      title: "المحادثات",
      selectors: [
        '[data-page-content="chat"]',
        "#chatPage",
        "#chat"
      ]
    },

    ai: {
      title: "ميكا الذكي",
      selectors: [
        '[data-page-content="ai"]',
        "#aiPage",
        "#aiAssistant"
      ]
    },

    notifications: {
      title: "الإشعارات",
      selectors: [
        '[data-page-content="notifications"]',
        "#notificationsPage",
        "#notifications"
      ]
    },

    profile: {
      title: "الملف الشخصي",
      selectors: [
        '[data-page-content="profile"]',
        "#profilePage",
        "#profile"
      ]
    },

    settings: {
      title: "الإعدادات",
      selectors: [
        '[data-page-content="settings"]',
        "#settingsPage",
        "#settings"
      ]
    },

    premium: {
      title: "العضوية المميزة",
      selectors: [
        '[data-page-content="premium"]',
        "#premiumPage",
        "#premium"
      ]
    }
  };

  const pageRegistry = new Map(
    Object.entries(defaultPages)
  );

  function registerPage(name, configuration) {
    if (!name || typeof name !== "string") {
      throw new TypeError(
        "اسم الصفحة يجب أن يكون نصًا."
      );
    }

    if (!configuration || typeof configuration !== "object") {
      throw new TypeError(
        "إعدادات الصفحة غير صحيحة."
      );
    }

    pageRegistry.set(name, {
      title: configuration.title || name,
      selectors: Array.isArray(configuration.selectors)
        ? configuration.selectors
        : [],
      onEnter: configuration.onEnter,
      onLeave: configuration.onLeave
    });

    dispatch("page-registered", {
      name
    });
  }

  function getPageElement(name) {
    const page = pageRegistry.get(name);

    if (!page) {
      return null;
    }

    return findFirst(page.selectors);
  }

  function getPageTitle(name) {
    const page = pageRegistry.get(name);

    return page?.title || name;
  }

  /* =======================================================
     8. PAGE NAVIGATION
     ======================================================= */

  function updateNavigationActive(name) {
    const navigationItems = findAll(
      MEKA.selectors.navigation
    );

    navigationItems.forEach(item => {
      const active = item.dataset.page === name;

      item.classList.toggle("active", active);
      item.classList.toggle("is-active", active);

      if (active) {
        item.setAttribute("aria-current", "page");
      } else {
        item.removeAttribute("aria-current");
      }
    });
  }

  function updatePageTitle(name) {
    const titleElement = findFirst([
      "[data-page-title]",
      "#pageTitle",
      ".page-title"
    ]);

    if (titleElement) {
      titleElement.textContent = getPageTitle(name);
    }

    document.title =
      getPageTitle(name) + " | " + MEKA.name;
  }

  function navigate(
    name,
    options = {}
  ) {
    const {
      updateHistory = true,
      silent = false
    } = options;

    if (!name || typeof name !== "string") {
      return false;
    }

    const configuration = pageRegistry.get(name);

    if (!configuration) {
      if (!silent) {
        toast("القسم المطلوب غير مسجل داخل التطبيق.", "warning");
      }

      return false;
    }

    const target = getPageElement(name);

    if (!target) {
      dispatch("page-missing", {
        name
      });

      if (!silent) {
        toast(
          "القسم مسجل، لكن عنصر الصفحة غير موجود في HTML.",
          "warning"
        );
      }

      return false;
    }

    if (state.currentPage === name) {
      closeSidebar();
      return true;
    }

    const previousPage = state.currentPage;

    if (previousPage) {
      const previousConfig = pageRegistry.get(previousPage);

      if (
        previousConfig &&
        typeof previousConfig.onLeave === "function"
      ) {
        try {
          previousConfig.onLeave({
            from: previousPage,
            to: name
          });
        } catch (error) {
          console.error(
            "[MEKA X] Page leave error:",
            error
          );
        }
      }

      const previousElement = getPageElement(previousPage);

      if (previousElement) {
        previousElement.hidden = true;
        previousElement.setAttribute(
          "aria-hidden",
          "true"
        );

        previousElement.classList.remove(
          "page-entering",
          "page-active"
        );
      }
    }

    target.hidden = false;
    target.removeAttribute("aria-hidden");
    target.classList.add("page-active", "page-entering");

    requestAnimationFrame(() => {
      target.classList.remove("page-entering");
    });

    state.currentPage = name;

    updateNavigationActive(name);
    updatePageTitle(name);
    closeSidebar();

    setStorage("lastPage", name);

    if (updateHistory) {
      try {
        const url = new URL(window.location.href);

        url.searchParams.set("page", name);

        window.history.pushState(
          {
            mekaPage: name
          },
          "",
          url
        );
      } catch {
        // التنقل داخل التطبيق يستمر حتى لو تعذر تحديث الرابط.
      }
    }

    if (typeof configuration.onEnter === "function") {
      try {
        configuration.onEnter({
          from: previousPage,
          to: name,
          element: target
        });
      } catch (error) {
        console.error(
          "[MEKA X] Page enter error:",
          error
        );
      }
    }

    dispatch("navigate", {
      from: previousPage,
      to: name,
      element: target
    });

    if (!silent) {
      announce("تم فتح قسم " + getPageTitle(name));
    }

    return true;
  }

  function initializeNavigation() {
    document.addEventListener("click", event => {
      const item = event.target.closest(
        "[data-page]"
      );

      if (!item) {
        return;
      }

      const name = item.dataset.page;

      if (!name) {
        return;
      }

      event.preventDefault();

      navigate(name);
    });

    window.addEventListener("popstate", event => {
      let name = event.state?.mekaPage;

      if (!name) {
        try {
          name = new URL(
            window.location.href
          ).searchParams.get("page");
        } catch {
          name = null;
        }
      }

      if (name && pageRegistry.has(name)) {
        navigate(name, {
          updateHistory: false,
          silent: true
        });
      }
    });
  }

  /* =======================================================
     9. SIDEBAR
     ======================================================= */

  function openSidebar() {
    const sidebar = findFirst(
      MEKA.selectors.sidebar
    );

    if (!sidebar) {
      return false;
    }

    state.sidebarOpen = true;

    sidebar.classList.add("is-open", "open");
    sidebar.setAttribute("aria-expanded", "true");

    document.documentElement.classList.add(
      "sidebar-open"
    );

    const toggle = findFirst(
      MEKA.selectors.menuToggle
    );

    if (toggle) {
      toggle.setAttribute("aria-expanded", "true");
    }

    dispatch("sidebar-open");

    return true;
  }

  function closeSidebar() {
    const sidebar = findFirst(
      MEKA.selectors.sidebar
    );

    state.sidebarOpen = false;

    if (sidebar) {
      sidebar.classList.remove("is-open", "open");
      sidebar.setAttribute("aria-expanded", "false");
    }

    document.documentElement.classList.remove(
      "sidebar-open"
    );

    const toggle = findFirst(
      MEKA.selectors.menuToggle
    );

    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
    }

    dispatch("sidebar-close");
  }

  function toggleSidebar() {
    if (state.sidebarOpen) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  function initializeSidebar() {
    document.addEventListener("click", event => {
      const toggle = event.target.closest(
        MEKA.selectors.menuToggle.join(",")
      );

      if (toggle) {
        event.preventDefault();
        toggleSidebar();
        return;
      }

      const closeButton = event.target.closest(
        "[data-sidebar-close]"
      );

      if (closeButton) {
        event.preventDefault();
        closeSidebar();
        return;
      }

      const sidebar = findFirst(
        MEKA.selectors.sidebar
      );

      if (
        state.sidebarOpen &&
        sidebar &&
        !sidebar.contains(event.target)
      ) {
        const menuButton = findFirst(
          MEKA.selectors.menuToggle
        );

        if (!menuButton?.contains(event.target)) {
          closeSidebar();
        }
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && state.sidebarOpen) {
        closeSidebar();
      }
    });
  }

  /* =======================================================
     10. MODALS
     ======================================================= */

  function openModal(id) {
    if (!id) {
      return false;
    }

    const modal = query(
      "#" + CSS.escape(id)
    );

    if (!modal) {
      toast("النافذة المطلوبة غير موجودة.", "warning");
      return false;
    }

    state.activeModal = modal;

    modal.hidden = false;
    modal.removeAttribute("aria-hidden");
    modal.classList.add("is-open", "open");

    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    document.documentElement.classList.add(
      "modal-open"
    );

    const focusable = query(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      modal
    );

    if (focusable) {
      requestAnimationFrame(() => {
        focusable.focus();
      });
    }

    dispatch("modal-open", {
      id
    });

    return true;
  }

  function closeModal(modal = state.activeModal) {
    if (!modal) {
      return false;
    }

    modal.classList.remove("is-open", "open");
    modal.setAttribute("aria-hidden", "true");
    modal.hidden = true;

    state.activeModal = null;

    document.documentElement.classList.remove(
      "modal-open"
    );

    dispatch("modal-close", {
      id: modal.id
    });

    return true;
  }

  function initializeModals() {
    document.addEventListener("click", event => {
      const openButton = event.target.closest(
        MEKA.selectors.modalOpen
      );

      if (openButton) {
        event.preventDefault();

        const id =
          openButton.dataset.modalOpen;

        openModal(id);
        return;
      }

      const closeButton = event.target.closest(
        MEKA.selectors.modalClose
      );

      if (closeButton) {
        event.preventDefault();

        closeModal(
          closeButton.closest(
            '[role="dialog"], .mx-modal, [data-modal]'
          ) || state.activeModal
        );

        return;
      }

      if (
        state.activeModal &&
        event.target === state.activeModal &&
        state.activeModal.dataset.closeOnBackdrop !== "false"
      ) {
        closeModal(state.activeModal);
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && state.activeModal) {
        closeModal(state.activeModal);
      }
    });
  }

  /* =======================================================
     11. THEME SWITCHING
     ======================================================= */

  const allowedThemes = [
    "dark",
    "light",
    "purple",
    "ocean"
  ];

  function applyTheme(theme, persist = true) {
    const safeTheme = allowedThemes.includes(theme)
      ? theme
      : "dark";

    const root = document.documentElement;

    if (safeTheme === "dark") {
      root.removeAttribute("data-theme");
    } else {
      root.dataset.theme = safeTheme;
    }

    document.body.dataset.theme = safeTheme;

    root.style.colorScheme =
      safeTheme === "light" ? "light" : "dark";

    if (persist) {
      setStorage("theme", safeTheme);
    }

    findAll(MEKA.selectors.themeToggle).forEach(button => {
      button.setAttribute(
        "aria-pressed",
        String(safeTheme !== "dark")
      );

      button.dataset.currentTheme = safeTheme;
    });

    dispatch("theme-change", {
      theme: safeTheme
    });

    return safeTheme;
  }

  function initializeTheme() {
    const savedTheme = getStorage(
      "theme",
      "dark"
    );

    applyTheme(savedTheme, false);

    document.addEventListener("click", event => {
      const button = event.target.closest(
        MEKA.selectors.themeToggle.join(",")
      );

      if (!button) {
        return;
      }

      event.preventDefault();

      const current =
        document.documentElement.dataset.theme || "dark";

      const next = current === "dark"
        ? "light"
        : "dark";

      applyTheme(next);

      toast(
        next === "light"
          ? "تم تفعيل المظهر الفاتح."
          : "تم تفعيل المظهر الداكن.",
        "success"
      );
    });

    document.addEventListener("change", event => {
      const selector = event.target.closest(
        "[data-theme-select]"
      );

      if (!selector) {
        return;
      }

      applyTheme(selector.value);
    });
  }

  /* =======================================================
     12. GLOBAL SEARCH
     ======================================================= */

  function initializeSearch() {
    document.addEventListener("keydown", event => {
      const isShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k";

      if (!isShortcut) {
        return;
      }

      const search = findFirst(
        MEKA.selectors.search
      );

      if (!search) {
        return;
      }

      event.preventDefault();
      search.focus();
      search.select?.();
    });

    document.addEventListener("input", event => {
      const input = event.target.closest(
        MEKA.selectors.search.join(",")
      );

      if (!input) {
        return;
      }

      dispatch("search", {
        query: input.value.trim(),
        input
      });
    });

    document.addEventListener("keydown", event => {
      const input = event.target.closest(
        MEKA.selectors.search.join(",")
      );

      if (!input || event.key !== "Enter") {
        return;
      }

      dispatch("search-submit", {
        query: input.value.trim(),
        input
      });
    });
  }

  /* =======================================================
     13. PASSWORD VISIBILITY
     ======================================================= */

  function initializePasswordToggles() {
    document.addEventListener("click", event => {
      const button = event.target.closest(
        "[data-toggle-password]"
      );

      if (!button) {
        return;
      }

      const targetId =
        button.dataset.togglePassword;

      const input = targetId
        ? query("#" + CSS.escape(targetId))
        : button.parentElement?.querySelector(
            'input[type="password"], input[type="text"]'
          );

      if (!input) {
        return;
      }

      const reveal =
        input.type === "password";

      input.type = reveal
        ? "text"
        : "password";

      button.setAttribute(
        "aria-pressed",
        String(reveal)
      );

      button.setAttribute(
        "aria-label",
        reveal
          ? "إخفاء كلمة المرور"
          : "إظهار كلمة المرور"
      );
    });
  }

  /* =======================================================
     14. FORM VALIDATION
     ======================================================= */

  function initializeForms() {
    document.addEventListener("submit", event => {
      const form = event.target;

      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      if (!form.checkValidity()) {
        event.preventDefault();
        form.reportValidity();

        toast(
          "راجع البيانات المطلوبة قبل المتابعة.",
          "warning"
        );

        return;
      }

      /*
       * لا نمنع الإرسال الصحيح تلقائيًا.
       * النماذج المرتبطة بتسجيل الدخول أو قاعدة البيانات
       * يجب أن تُربط بوظيفتها الفعلية في ملفاتها المخصصة.
       */
      dispatch("form-valid", {
        form,
        formId: form.id || null
      });
    });
  }

  /* =======================================================
     15. DROPDOWN MENUS
     ======================================================= */

  function closeAllDropdowns(except = null) {
    queryAll("[data-dropdown]").forEach(dropdown => {
      if (dropdown === except) {
        return;
      }

      dropdown.classList.remove("is-open", "open");

      const trigger = query(
        "[data-dropdown-toggle]",
        dropdown
      );

      if (trigger) {
        trigger.setAttribute(
          "aria-expanded",
          "false"
        );
      }
    });
  }

  function initializeDropdowns() {
    document.addEventListener("click", event => {
      const trigger = event.target.closest(
        "[data-dropdown-toggle]"
      );

      if (trigger) {
        event.preventDefault();

        const dropdown = trigger.closest(
          "[data-dropdown]"
        );

        if (!dropdown) {
          return;
        }

        const isOpen =
          dropdown.classList.contains("is-open");

        closeAllDropdowns(dropdown);

        dropdown.classList.toggle(
          "is-open",
          !isOpen
        );

        dropdown.classList.toggle(
          "open",
          !isOpen
        );

        trigger.setAttribute(
          "aria-expanded",
          String(!isOpen)
        );

        return;
      }

      if (!event.target.closest("[data-dropdown]")) {
        closeAllDropdowns();
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeAllDropdowns();
      }
    });
  }

  /* =======================================================
     16. TABS
     ======================================================= */

  function initializeTabs() {
    document.addEventListener("click", event => {
      const tab = event.target.closest(
        "[data-tab-target]"
      );

      if (!tab) {
        return;
      }

      event.preventDefault();

      const targetSelector =
        tab.dataset.tabTarget;

      const target = targetSelector
        ? query(targetSelector)
        : null;

      if (!target) {
        return;
      }

      const group = tab.closest(
        "[data-tabs]"
      );

      const scope = group?.parentElement || document;

      if (group) {
        queryAll("[data-tab-target]", group).forEach(item => {
          const selected = item === tab;

          item.classList.toggle("active", selected);
          item.setAttribute(
            "aria-selected",
            String(selected)
          );

          item.setAttribute(
            "tabindex",
            selected ? "0" : "-1"
          );
        });
      }

      const panels = queryAll(
        "[data-tab-panel]",
        scope
      );

      panels.forEach(panel => {
        const active = panel === target;

        panel.hidden = !active;
        panel.classList.toggle("active", active);

        panel.setAttribute(
          "aria-hidden",
          String(!active)
        );
      });

      dispatch("tab-change", {
        tab,
        target
      });
    });
  }

  /* =======================================================
     17. TOOLTIP TEXT
     ======================================================= */

  function initializeTooltips() {
    document.addEventListener("mouseover", event => {
      const element = event.target.closest(
        "[data-tooltip]"
      );

      if (!element) {
        return;
      }

      const text = element.dataset.tooltip;

      if (!text) {
        return;
      }

      element.setAttribute(
        "aria-label",
        element.getAttribute("aria-label") || text
      );
    });
  }

  /* =======================================================
     18. BACK TO TOP
     ======================================================= */

  function initializeBackToTop() {
    document.addEventListener("click", event => {
      const button = event.target.closest(
        "[data-back-to-top]"
      );

      if (!button) {
        return;
      }

      event.preventDefault();

      window.scrollTo({
        top: 0,
        behavior: window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches
          ? "auto"
          : "smooth"
      });
    });
  }

  /* =======================================================
     19. NETWORK STATUS
     ======================================================= */

  function updateNetworkStatus() {
    const online = navigator.onLine;

    document.documentElement.classList.toggle(
      "is-online",
      online
    );

    document.documentElement.classList.toggle(
      "is-offline",
      !online
    );

    const indicators = queryAll(
      "[data-network-status]"
    );

    indicators.forEach(indicator => {
      indicator.textContent = online
        ? "متصل بالإنترنت"
        : "لا يوجد اتصال بالإنترنت";

      indicator.classList.toggle(
        "is-online",
        online
      );

      indicator.classList.toggle(
        "is-offline",
        !online
      );
    });

    dispatch("network-status", {
      online
    });
  }

  function initializeNetworkStatus() {
    window.addEventListener(
      "online",
      () => {
        updateNetworkStatus();

        toast(
          "عاد الاتصال بالإنترنت.",
          "success"
        );
      }
    );

    window.addEventListener(
      "offline",
      () => {
        updateNetworkStatus();

        toast(
          "الاتصال بالإنترنت غير متاح حاليًا.",
          "warning"
        );
      }
    );

    updateNetworkStatus();
  }

  /* =======================================================
     20. LOCAL PREFERENCES
     ======================================================= */

  function initializePreferences() {
    const reducedMotion = getStorage(
      "reducedMotion",
      null
    );

    if (reducedMotion !== null) {
      document.documentElement.classList.toggle(
        "reduce-motion",
        reducedMotion === "true"
      );
    }

    const compactMode = getStorage(
      "compactMode",
      "false"
    );

    document.documentElement.classList.toggle(
      "compact-mode",
      compactMode === "true"
    );

    document.addEventListener("change", event => {
      const control = event.target.closest(
        "[data-preference]"
      );

      if (!control) {
        return;
      }

      const preference =
        control.dataset.preference;

      if (!preference) {
        return;
      }

      if (control.type === "checkbox") {
        setStorage(
          "preference_" + preference,
          control.checked
        );
      } else {
        setStorage(
          "preference_" + preference,
          control.value
        );
      }

      dispatch("preference-change", {
        preference,
        value: control.type === "checkbox"
          ? control.checked
          : control.value
      });
    });
  }

  /* =======================================================
     21. CUSTOM PAGE HANDLERS
     ======================================================= */

  function on(name, handler) {
    if (
      typeof name !== "string" ||
      typeof handler !== "function"
    ) {
      return () => {};
    }

    const eventName = "meka:" + name;

    document.addEventListener(
      eventName,
      handler
    );

    const cleanup = () => {
      document.removeEventListener(
        eventName,
        handler
      );
    };

    state.cleanupFunctions.push(cleanup);

    return cleanup;
  }

  function onPage(name, handler) {
    if (
      typeof name !== "string" ||
      typeof handler !== "function"
    ) {
      return () => {};
    }

    if (!state.pageHandlers.has(name)) {
      state.pageHandlers.set(
        name,
        new Set()
      );
    }

    const handlers = state.pageHandlers.get(name);

    handlers.add(handler);

    return () => {
      handlers.delete(handler);
    };
  }

  /* =======================================================
     22. GLOBAL CLICK ACTIONS
     ======================================================= */

  function initializeGlobalActions() {
    document.addEventListener("click", event => {
      const action = event.target.closest(
        "[data-action]"
      );

      if (!action) {
        return;
      }

      const actionName = action.dataset.action;

      switch (actionName) {
        case "go-home":
          event.preventDefault();
          navigate("home");
          break;

        case "go-back":
          event.preventDefault();

          if (window.history.length > 1) {
            window.history.back();
          } else {
            navigate("home");
          }

          break;

        case "close-sidebar":
          event.preventDefault();
          closeSidebar();
          break;

        case "close-modal":
          event.preventDefault();
          closeModal();
          break;

        case "refresh-page":
          event.preventDefault();
          window.location.reload();
          break;

        case "scroll-top":
          event.preventDefault();

          window.scrollTo({
            top: 0,
            behavior: "smooth"
          });

          break;

        case "show-app-version":
          event.preventDefault();

          toast(
            MEKA.name + " — الإصدار " + MEKA.version,
            "info",
            4500
          );

          break;

        default:
          dispatch("action", {
            name: actionName,
            element: action
          });
      }
    });
  }

  /* =======================================================
     23. KEYBOARD SHORTCUTS
     ======================================================= */

  function initializeKeyboardShortcuts() {
    document.addEventListener("keydown", event => {
      const target = event.target;

      const typing =
        target instanceof HTMLElement &&
        (
          target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(
            target.tagName
          )
        );

      if (typing || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (event.key === "Escape") {
        closeSidebar();
        closeAllDropdowns();

        if (state.activeModal) {
          closeModal();
        }
      }
    });
  }

  /* =======================================================
     24. DOCUMENT INITIALIZATION
     ======================================================= */

  function initializeAccessibility() {
    queryAll("[data-menu-toggle]").forEach(button => {
      if (!button.hasAttribute("aria-expanded")) {
        button.setAttribute(
          "aria-expanded",
          "false"
        );
      }
    });

    queryAll("[data-dropdown-toggle]").forEach(button => {
      if (!button.hasAttribute("aria-expanded")) {
        button.setAttribute(
          "aria-expanded",
          "false"
        );
      }
    });

    queryAll("[data-tab-target]").forEach(tab => {
      if (!tab.hasAttribute("role")) {
        tab.setAttribute("role", "tab");
      }
    });
  }

  function initialize() {
    if (state.initialized) {
      return;
    }

    state.initialized = true;

    initializeAccessibility();
    initializeTheme();
    initializeNavigation();
    initializeSidebar();
    initializeModals();
    initializeSearch();
    initializePasswordToggles();
    initializeForms();
    initializeDropdowns();
    initializeTabs();
    initializeTooltips();
    initializeBackToTop();
    initializeNetworkStatus();
    initializePreferences();
    initializeGlobalActions();
    initializeKeyboardShortcuts();

    initializeSplash();

    dispatch("initialized", {
      version: MEKA.version
    });

    console.info(
      "[MEKA X] Application initialized:",
      MEKA.version
    );
  }

  /* =======================================================
     25. PUBLIC APPLICATION API
     ======================================================= */

  window.MEKA = Object.freeze({
    name: MEKA.name,
    version: MEKA.version,

    navigate,
    registerPage,
    getPageElement,
    getPageTitle,

    openSidebar,
    closeSidebar,
    toggleSidebar,

    openModal,
    closeModal,

    applyTheme,

    toast,
    announce,
    setLoading,

    getStorage,
    setStorage,
    removeStorage,

    on,
    onPage,

    getState() {
      return {
        initialized: state.initialized,
        currentPage: state.currentPage,
        sidebarOpen: state.sidebarOpen,
        activeModal: state.activeModal?.id || null
      };
    },

    finishSplash,

    refreshNetworkStatus: updateNetworkStatus
  });

  /* =======================================================
     26. START APPLICATION
     ======================================================= */

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
