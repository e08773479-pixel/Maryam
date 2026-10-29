/* ==========================================================
   MEKA X — AUTHENTICATION MODULE
   File: auth.js
   Authentication provider: Supabase Auth
   Safe fallback: works without Supabase configuration
   ========================================================== */

(function () {
  "use strict";

  if (window.MekaAuth) {
    console.warn("[MEKA X] Authentication module already loaded.");
    return;
  }

  const CONFIG = Object.freeze({
    supabaseUrl: window.MEKA_CONFIG?.SUPABASE_URL || "",
    supabaseAnonKey: window.MEKA_CONFIG?.SUPABASE_ANON_KEY || "",
    redirectAfterLogin: window.MEKA_CONFIG?.AUTH_REDIRECT_AFTER_LOGIN || "",
    redirectAfterLogout: window.MEKA_CONFIG?.AUTH_REDIRECT_AFTER_LOGOUT || "",
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  });

  const EVENTS = Object.freeze({
    READY: "meka:auth-ready",
    STATE_CHANGED: "meka:auth-state-changed",
    LOGIN: "meka:auth-login",
    SIGNUP: "meka:auth-signup",
    LOGOUT: "meka:auth-logout",
    ERROR: "meka:auth-error"
  });

  let supabaseClient = null;
  let currentUser = null;
  let currentSession = null;
  let initialized = false;
  let initializationPromise = null;
  let authSubscription = null;

  const pendingForms = new WeakSet();

  function dispatch(name, detail = {}) {
    window.dispatchEvent(
      new CustomEvent(name, {
        detail: {
          timestamp: new Date().toISOString(),
          ...detail
        }
      })
    );
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validatePassword(password) {
    if (typeof password !== "string") {
      return "اكتب كلمة المرور.";
    }

    if (password.length < 8) {
      return "كلمة المرور لازم تكون 8 أحرف على الأقل.";
    }

    if (password.length > 128) {
      return "كلمة المرور طويلة جدًا.";
    }

    return "";
  }

  function getFriendlyError(error) {
    const message = String(error?.message || "").toLowerCase();

    if (message.includes("invalid login credentials")) {
      return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
    }

    if (message.includes("email not confirmed")) {
      return "لازم تأكد بريدك الإلكتروني الأول.";
    }

    if (message.includes("user already registered")) {
      return "البريد الإلكتروني مسجل بالفعل.";
    }

    if (message.includes("password should be")) {
      return "كلمة المرور لا تستوفي شروط الأمان.";
    }

    if (message.includes("rate limit")) {
      return "محاولات كثيرة. استنى شوية وحاول تاني.";
    }

    if (
      message.includes("failed to fetch") ||
      message.includes("network")
    ) {
      return "في مشكلة اتصال بالإنترنت أو بخدمة تسجيل الدخول.";
    }

    if (message.includes("invalid email")) {
      return "البريد الإلكتروني غير صحيح.";
    }

    if (message.includes("signup is disabled")) {
      return "إنشاء الحسابات غير مفعّل حاليًا.";
    }

    return error?.message || "حصل خطأ غير متوقع. حاول تاني.";
  }

  function emitError(error, action = "unknown") {
    const result = {
      action,
      message: getFriendlyError(error),
      code: error?.code || null
    };

    dispatch(EVENTS.ERROR, result);
    return result;
  }

  function setCurrentAuthState(session) {
    currentSession = session || null;
    currentUser = session?.user || null;

    const detail = {
      authenticated: Boolean(currentUser),
      user: getPublicUser(),
      sessionAvailable: Boolean(currentSession)
    };

    dispatch(EVENTS.STATE_CHANGED, detail);

    updateAuthElements();
    return detail;
  }

  function getPublicUser() {
    if (!currentUser) return null;

    return {
      id: currentUser.id,
      email: currentUser.email || null,
      emailConfirmed: Boolean(currentUser.email_confirmed_at),
      createdAt: currentUser.created_at || null,
      lastSignInAt: currentUser.last_sign_in_at || null,
      userMetadata: {
        displayName:
          currentUser.user_metadata?.display_name ||
          currentUser.user_metadata?.full_name ||
          "",
        avatarUrl: currentUser.user_metadata?.avatar_url || ""
      }
    };
  }

  function requireClient() {
    if (!supabaseClient) {
      throw new Error(
        "Supabase غير متصل. اضبط SUPABASE_URL وSUPABASE_ANON_KEY أولًا."
      );
    }

    return supabaseClient;
  }

  function getSupabaseLibrary() {
    if (window.supabase?.createClient) {
      return window.supabase;
    }

    return null;
  }

  async function initialize(options = {}) {
    if (initialized) return getStatus();
    if (initializationPromise) return initializationPromise;

    initializationPromise = (async function () {
      const url = String(
        options.supabaseUrl ?? CONFIG.supabaseUrl
      ).trim();

      const anonKey = String(
        options.supabaseAnonKey ?? CONFIG.supabaseAnonKey
      ).trim();

      if (!url || !anonKey) {
        initialized = true;

        dispatch(EVENTS.READY, {
          configured: false,
          authenticated: false,
          message: "Supabase غير مُعدّ بعد."
        });

        updateAuthElements();
        return getStatus();
      }

      const library = getSupabaseLibrary();

      if (!library) {
        initialized = true;

        dispatch(EVENTS.READY, {
          configured: false,
          authenticated: false,
          message: "مكتبة Supabase غير محمّلة."
        });

        updateAuthElements();
        return getStatus();
      }

      try {
        supabaseClient = library.createClient(url, anonKey, {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
          }
        });

        const {
          data,
          error
        } = await supabaseClient.auth.getSession();

        if (error) throw error;

        setCurrentAuthState(data?.session || null);

        const {
          data: listenerData
        } = supabaseClient.auth.onAuthStateChange(
          (event, session) => {
            setCurrentAuthState(session);

            if (event === "SIGNED_IN") {
              dispatch(EVENTS.LOGIN, {
                user: getPublicUser()
              });
            }

            if (event === "SIGNED_OUT") {
              dispatch(EVENTS.LOGOUT, {
                successful: true
              });
            }
          }
        );

        authSubscription =
          listenerData?.subscription || null;

        initialized = true;

        dispatch(EVENTS.READY, {
          configured: true,
          authenticated: Boolean(currentUser),
          user: getPublicUser()
        });

        updateAuthElements();
        return getStatus();
      } catch (error) {
        supabaseClient = null;
        initialized = true;

        emitError(error, "initialize");

        dispatch(EVENTS.READY, {
          configured: false,
          authenticated: false,
          message: getFriendlyError(error)
        });

        updateAuthElements();
        return getStatus();
      }
    })();

    try {
      return await initializationPromise;
    } finally {
      initializationPromise = null;
    }
  }

  async function signIn(credentials = {}) {
    const email = normalizeEmail(credentials.email);
    const password = String(credentials.password || "");

    if (!email || !validateEmail(email)) {
      throw new Error("اكتب بريدًا إلكترونيًا صحيحًا.");
    }

    if (!password) {
      throw new Error("اكتب كلمة المرور.");
    }

    const client = requireClient();

    const {
      data,
      error
    } = await client.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      emitError(error, "signIn");
      throw new Error(getFriendlyError(error));
    }

    setCurrentAuthState(data.session);

    dispatch(EVENTS.LOGIN, {
      user: getPublicUser()
    });

    if (CONFIG.redirectAfterLogin) {
      window.location.assign(CONFIG.redirectAfterLogin);
    }

    return {
      success: true,
      user: getPublicUser()
    };
  }

  async function signUp(details = {}) {
    const email = normalizeEmail(details.email);
    const password = String(details.password || "");
    const displayName = String(
      details.displayName ||
      details.name ||
      ""
    ).trim();

    if (!email || !validateEmail(email)) {
      throw new Error("اكتب بريدًا إلكترونيًا صحيحًا.");
    }

    const passwordError = validatePassword(password);

    if (passwordError) {
      throw new Error(passwordError);
    }

    if (displayName.length > 80) {
      throw new Error("الاسم طويل جدًا.");
    }

    const client = requireClient();

    const {
      data,
      error
    } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName
        }
      }
    });

    if (error) {
      emitError(error, "signUp");
      throw new Error(getFriendlyError(error));
    }

    if (data.session) {
      setCurrentAuthState(data.session);
    }

    dispatch(EVENTS.SIGNUP, {
      success: true,
      confirmationRequired: !data.session,
      user: data.user
        ? {
            id: data.user.id,
            email: data.user.email || null
          }
        : null
    });

    return {
      success: true,
      confirmationRequired: !data.session,
      message: data.session
        ? "تم إنشاء الحساب بنجاح."
        : "تم إرسال طلب إنشاء الحساب. راجع بريدك الإلكتروني إذا طُلب منك التأكيد."
    };
  }

  async function signOut() {
    const client = requireClient();

    const {
      error
    } = await client.auth.signOut();

    if (error) {
      emitError(error, "signOut");
      throw new Error(getFriendlyError(error));
    }

    setCurrentAuthState(null);

    if (CONFIG.redirectAfterLogout) {
      window.location.assign(CONFIG.redirectAfterLogout);
    }

    return {
      success: true
    };
  }

  async function resetPassword(emailValue) {
    const email = normalizeEmail(emailValue);

    if (!validateEmail(email)) {
      throw new Error("اكتب البريد الإلكتروني بشكل صحيح.");
    }

    const client = requireClient();

    const redirectTo =
      window.location.origin +
      window.location.pathname;

    const {
      error
    } = await client.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    if (error) {
      emitError(error, "resetPassword");
      throw new Error(getFriendlyError(error));
    }

    return {
      success: true,
      message: "لو البريد مسجل، هتوصلك تعليمات استعادة كلمة المرور."
    };
  }

  async function updatePassword(newPassword) {
    const passwordError = validatePassword(newPassword);

    if (passwordError) {
      throw new Error(passwordError);
    }

    const client = requireClient();

    const {
      data,
      error
    } = await client.auth.updateUser({
      password: newPassword
    });

    if (error) {
      emitError(error, "updatePassword");
      throw new Error(getFriendlyError(error));
    }

    return {
      success: true,
      user: data?.user
        ? {
            id: data.user.id,
            email: data.user.email || null
          }
        : null
    };
  }

  async function signInWithGoogle() {
    const client = requireClient();

    const {
      data,
      error
    } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin +
          window.location.pathname
      }
    });

    if (error) {
      emitError(error, "googleSignIn");
      throw new Error(getFriendlyError(error));
    }

    return {
      success: true,
      data
    };
  }

  function getStatus() {
    return {
      initialized,
      configured: Boolean(supabaseClient),
      authenticated: Boolean(currentUser),
      user: getPublicUser()
    };
  }

  function getUser() {
    return getPublicUser();
  }

  function isAuthenticated() {
    return Boolean(currentUser);
  }

  function showFormMessage(form, message, type = "info") {
    if (!form) return;

    let output = form.querySelector("[data-auth-message]");

    if (!output) {
      output = document.createElement("div");
      output.setAttribute("data-auth-message", "");
      output.setAttribute("role", "status");
      output.setAttribute("aria-live", "polite");

      form.appendChild(output);
    }

    output.textContent = message;
    output.dataset.state = type;
  }

  function readField(form, name) {
    const field = form.querySelector(
      `[data-auth-field="${name}"]`
    );

    if (field) return field.value;

    const fallbackNames = {
      email: 'input[type="email"], input[name="email"]',
      password: 'input[name="password"], input[type="password"]',
      displayName:
        'input[name="displayName"], input[name="name"]',
      confirmPassword:
        'input[name="confirmPassword"], input[name="confirm-password"]'
    };

    const selector = fallbackNames[name];

    if (!selector) return "";

    const element = form.querySelector(selector);
    return element ? element.value : "";
  }

  function setFormBusy(form, busy) {
    if (!form) return;

    form.setAttribute("aria-busy", String(busy));

    const buttons = form.querySelectorAll(
      'button[type="submit"], [data-auth-submit]'
    );

    buttons.forEach((button) => {
      if (busy) {
        button.dataset.mekaPreviousDisabled =
          String(button.disabled);

        button.disabled = true;
      } else {
        button.disabled =
          button.dataset.mekaPreviousDisabled === "true";

        delete button.dataset.mekaPreviousDisabled;
      }
    });
  }

  async function handleAuthForm(form) {
    if (pendingForms.has(form)) return;

    pendingForms.add(form);
    setFormBusy(form, true);

    try {
      const type = String(
        form.dataset.authForm || ""
      ).toLowerCase();

      const email = readField(form, "email");
      const password = readField(form, "password");

      if (type === "login") {
        await signIn({
          email,
          password
        });

        showFormMessage(
          form,
          "تم تسجيل الدخول بنجاح.",
          "success"
        );
      } else if (
        type === "signup" ||
        type === "register"
      ) {
        const confirmPassword =
          readField(form, "confirmPassword");

        if (
          confirmPassword &&
          password !== confirmPassword
        ) {
          throw new Error("كلمتا المرور غير متطابقتين.");
        }

        const result = await signUp({
          email,
          password,
          displayName: readField(form, "displayName")
        });

        showFormMessage(
          form,
          result.message,
          "success"
        );
      } else if (
        type === "reset-password" ||
        type === "forgot-password"
      ) {
        const result = await resetPassword(email);

        showFormMessage(
          form,
          result.message,
          "success"
        );
      }
    } catch (error) {
      showFormMessage(
        form,
        getFriendlyError(error),
        "error"
      );

      dispatch(EVENTS.ERROR, {
        action: "form",
        message: getFriendlyError(error)
      });
    } finally {
      setFormBusy(form, false);
      pendingForms.delete(form);
    }
  }

  function updateAuthElements() {
    const authenticated = Boolean(currentUser);

    document.querySelectorAll(
      "[data-auth-show]"
    ).forEach((element) => {
      const mode = element.dataset.authShow;

      element.hidden =
        mode === "authenticated"
          ? !authenticated
          : mode === "guest"
            ? authenticated
            : false;
    });

    document.querySelectorAll(
      "[data-auth-user]"
    ).forEach((element) => {
      const field = element.dataset.authUser;

      if (!currentUser) {
        if (field === "email" || field === "name") {
          element.textContent = "";
        }

        return;
      }

      if (field === "email") {
        element.textContent = currentUser.email || "";
      } else if (field === "name") {
        element.textContent =
          currentUser.user_metadata?.display_name ||
          currentUser.user_metadata?.full_name ||
          currentUser.email ||
          "مستخدم MEKA X";
      } else if (field === "avatar") {
        const avatar =
          currentUser.user_metadata?.avatar_url || "";

        if (element instanceof HTMLImageElement && avatar) {
          element.src = avatar;
          element.alt = "الصورة الشخصية";
        }
      }
    });

    document.querySelectorAll(
      "[data-auth-action='logout']"
    ).forEach((button) => {
      button.hidden = !authenticated;
    });

    document.querySelectorAll(
      "[data-auth-action='login']"
    ).forEach((button) => {
      button.hidden = authenticated;
    });
  }

  function bindEvents() {
    document.addEventListener("submit", (event) => {
      const form = event.target.closest(
        "[data-auth-form]"
      );

      if (!form) return;

      event.preventDefault();
      handleAuthForm(form);
    });

    document.addEventListener("click", async (event) => {
      const button = event.target.closest(
        "[data-auth-action]"
      );

      if (!button) return;

      const action = button.dataset.authAction;

      if (action === "logout") {
        event.preventDefault();

        if (button.dataset.confirm === "true") {
          const confirmed = window.confirm(
            "هل تريد تسجيل الخروج؟"
          );

          if (!confirmed) return;
        }

        button.disabled = true;

        try {
          await signOut();
        } catch (error) {
          window.alert(getFriendlyError(error));
        } finally {
          button.disabled = false;
        }
      }

      if (action === "google-login") {
        event.preventDefault();
        button.disabled = true;

        try {
          await signInWithGoogle();
        } catch (error) {
          window.alert(getFriendlyError(error));
        } finally {
          button.disabled = false;
        }
      }
    });
  }

  function configure(options = {}) {
    if (supabaseClient) {
      throw new Error(
        "لا يمكن تغيير الإعدادات بعد الاتصال. أعد تحميل الصفحة أولًا."
      );
    }

    window.MEKA_CONFIG = {
      ...(window.MEKA_CONFIG || {}),
      ...options
    };

    return true;
  }

  function destroy() {
    if (authSubscription) {
      authSubscription.unsubscribe();
      authSubscription = null;
    }

    supabaseClient = null;
    currentSession = null;
    currentUser = null;
    initialized = false;
    initializationPromise = null;

    updateAuthElements();
  }

  window.MekaAuth = Object.freeze({
    initialize,
    configure,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    signInWithGoogle,
    getUser,
    getStatus,
    isAuthenticated,
    destroy,
    EVENTS
  });

  bindEvents();

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => initialize(),
      { once: true }
    );
  } else {
    initialize();
  }
})();
