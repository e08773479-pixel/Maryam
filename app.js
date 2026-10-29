"use strict";

/* =========================================================
   MEKA — APPLICATION CORE
   ========================================================= */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    mekaStart();
  }, { once: true });
} else {
  mekaStart();
}"use strict";

/* =========================================================
   MEKA — APPLICATION CORE
   Existing Supabase project integration
   ========================================================= */

const MEKA_CONFIG = Object.freeze({
  name: "MEKA",
  nameAr: "ميكا",

  supabaseUrl: "https://cxksushmcuyomuaywgfw.supabase.co",

  // Publishable key: safe for frontend use when RLS is configured.
  supabaseKey:
    "sb_publishable_6D7DE4aODAIqhG9Ls3gGfQ_Um-E-7f5",

  buckets: {
    avatars: "nova-avatars",
    covers: "nova-covers",
    messages: "nova-message-files",
    stories: "nova-stories",
    posts: "nova-post-media"
  },

  limits: {
    usernameMin: 3,
    usernameMax: 24,
    displayNameMax: 60,
    bioMax: 160,
    messageMax: 10000,
    attachmentMaxBytes: 100 * 1024 * 1024
  }
});

/* =========================================================
   APPLICATION STATE
   ========================================================= */

const MEKA = {
  db: null,

  session: null,
  user: null,
  profile: null,

  conversations: [],
  contacts: [],
  messages: [],

  activeConversation: null,
  messageChannel: null,
  authSubscription: null,

  loading: false,
  sending: false,
  initialized: false
};

window.MEKA = MEKA;

/* =========================================================
   GENERAL HELPERS
   ========================================================= */

const $ = (selector, root = document) =>
  root.querySelector(selector);

const $$ = (selector, root = document) =>
  [...root.querySelectorAll(selector)];

function mekaEscape(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function mekaToast(message, type = "info") {
  let container = $("#meka-toast-container");

  if (!container) {
    container = document.createElement("div");
    container.id = "meka-toast-container";

    Object.assign(container.style, {
      position: "fixed",
      zIndex: "99999",
      bottom: "24px",
      left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      width: "min(92%, 420px)",
      pointerEvents: "none"
    });

    document.body.appendChild(container);
  }

  const toast = document.createElement("div");

  const backgrounds = {
    success: "#123d35",
    error: "#51252d",
    warning: "#4a3b1c",
    info: "#172b45"
  };

  Object.assign(toast.style, {
    padding: "13px 17px",
    borderRadius: "14px",
    color: "#fff",
    background: backgrounds[type] || backgrounds.info,
    border: "1px solid rgba(255,255,255,.12)",
    boxShadow: "0 12px 40px rgba(0,0,0,.25)",
    fontSize: "14px",
    lineHeight: "1.6",
    direction: "rtl",
    opacity: "0",
    transform: "translateY(8px)",
    transition: "opacity .2s, transform .2s",
    pointerEvents: "auto"
  });

  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";

    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

function mekaSetStatus(message) {
  const element = $(
    "#auth-status, #login-status, #meka-status, [data-meka-status]"
  );

  if (element) element.textContent = message;
}

function mekaSetBusy(button, busy, busyText = "جارٍ التنفيذ...") {
  if (!button) return;

  if (busy) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = busyText;
  } else {
    button.disabled = false;

    if (button.dataset.originalText !== undefined) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }
}

function mekaInitials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);

  if (!parts.length) return "M";

  return parts
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();
}

function mekaFormatTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("ar-EG", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function mekaFormatDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("ar-EG", {
    day: "numeric",
    month: "short"
  }).format(date);
}

function mekaGetDisplayName(profile) {
  return (
    profile?.display_name ||
    profile?.full_name ||
    profile?.username ||
    "مستخدم ميكا"
  );
}

function mekaAvatar(profile, size = 44) {
  const image =
    profile?.avatar_url ||
    profile?.avatar_path ||
    "";

  const name = mekaGetDisplayName(profile);

  if (image && /^https:\/\//i.test(image)) {
    return `
      <img
        src="${mekaEscape(image)}"
        alt="${mekaEscape(name)}"
        width="${size}"
        height="${size}"
        loading="lazy"
        style="
          width:${size}px;
          height:${size}px;
          border-radius:50%;
          object-fit:cover;
          flex-shrink:0;
        "
      >
    `;
  }

  return `
    <div
      aria-label="${mekaEscape(name)}"
      style="
        width:${size}px;
        height:${size}px;
        border-radius:50%;
        display:grid;
        place-items:center;
        flex-shrink:0;
        color:#07111f;
        background:linear-gradient(135deg,#63f5db,#16bfa9);
        font-weight:800;
      "
    >${mekaEscape(mekaInitials(name))}</div>
  `;
}

/* =========================================================
   SUPABASE INITIALIZATION
   ========================================================= */

function mekaLoadSupabaseLibrary() {
  if (window.supabase?.createClient) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = $(
      'script[data-meka-supabase="true"]'
    );

    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("تعذر تحميل مكتبة Supabase.")),
        { once: true }
      );

      return;
    }

    const script = document.createElement("script");

    script.src =
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";

    script.async = true;
    script.dataset.mekaSupabase = "true";

    script.onload = resolve;

    script.onerror = () => {
      reject(new Error("تعذر تحميل مكتبة Supabase."));
    };

    document.head.appendChild(script);
  });
}

async function mekaInitializeSupabase() {
  await mekaLoadSupabaseLibrary();

  MEKA.db = window.supabase.createClient(
    MEKA_CONFIG.supabaseUrl,
    MEKA_CONFIG.supabaseKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce"
      },

      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    }
  );

  return MEKA.db;
}

/* =========================================================
   SCREEN NAVIGATION
   ========================================================= */

function mekaShowScreen(screenName) {
  const aliases = {
    splash: ["splash-screen", "splash"],
    auth: ["auth-screen", "login-screen", "auth"],
    onboarding: [
      "profile-setup-screen",
      "onboarding-screen",
      "profile-setup"
    ],
    main: ["main-screen", "app-screen", "main-app"]
  };

  const allScreens = new Set(
    Object.values(aliases).flat()
  );

  let targetId = aliases[screenName] || [screenName];

  $$(".screen, [data-meka-screen]").forEach(element => {
    const id = element.id;

    if (allScreens.has(id)) {
      element.hidden = true;
      element.classList.add("hidden");
    }
  });

  let target = null;

  for (const id of targetId) {
    target =
      document.getElementById(id) ||
      $(`[data-meka-screen="${id}"]`);

    if (target) break;
  }

  if (target) {
    target.hidden = false;
    target.classList.remove("hidden");
  }

  document.body.dataset.mekaScreen = screenName;

  window.dispatchEvent(
    new CustomEvent("meka:screenchange", {
      detail: { screen: screenName }
    })
  );
}

window.mekaShowScreen = mekaShowScreen;

/* =========================================================
   AUTHENTICATION — GOOGLE
   ========================================================= */

async function mekaSignInWithGoogle(button) {
  if (!MEKA.db) {
    mekaToast("الاتصال بقاعدة البيانات غير جاهز.", "error");
    return;
  }

  mekaSetBusy(button, true, "جارٍ فتح تسجيل الدخول...");
  mekaSetStatus("جارٍ الاتصال بحساب جوجل...");

  try {
    const redirectTo = new URL(
      "./",
      window.location.href
    ).href;

    const { error } = await MEKA.db.auth.signInWithOAuth({
      provider: "google",

      options: {
        redirectTo,

        queryParams: {
          prompt: "select_account"
        }
      }
    });

    if (error) throw error;
  } catch (error) {
    console.error("[MEKA] Google login error:", error);

    mekaToast(
      error.message || "تعذر تسجيل الدخول بجوجل.",
      "error"
    );

    mekaSetStatus("تعذر تسجيل الدخول. راجع إعدادات جوجل.");
    mekaSetBusy(button, false);
  }
}

async function mekaSignOut() {
  if (!MEKA.db) return;

  try {
    mekaStopMessageRealtime();

    const { error } = await MEKA.db.auth.signOut();

    if (error) throw error;

    MEKA.session = null;
    MEKA.user = null;
    MEKA.profile = null;

    MEKA.conversations = [];
    MEKA.contacts = [];
    MEKA.messages = [];
    MEKA.activeConversation = null;

    mekaShowScreen("auth");

    mekaToast("تم تسجيل الخروج.", "success");
  } catch (error) {
    console.error("[MEKA] Sign out error:", error);

    mekaToast("تعذر تسجيل الخروج.", "error");
  }
}

/* =========================================================
   PROFILE
   ========================================================= */

async function mekaLoadMyProfile() {
  if (!MEKA.db || !MEKA.user) return null;

  const { data, error } = await MEKA.db
    .from("profiles")
    .select("*")
    .eq("id", MEKA.user.id)
    .maybeSingle();

  if (error) {
    console.error("[MEKA] Profile loading error:", error);
    throw error;
  }

  MEKA.profile = data || null;

  return MEKA.profile;
}

async function mekaCreateProfile({
  username,
  displayName,
  bio = ""
}) {
  if (!MEKA.db || !MEKA.user) {
    throw new Error("يجب تسجيل الدخول أولًا.");
  }

  username = String(username || "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "");

  displayName = String(displayName || "").trim();
  bio = String(bio || "").trim();

  if (
    username.length < MEKA_CONFIG.limits.usernameMin ||
    username.length > MEKA_CONFIG.limits.usernameMax
  ) {
    throw new Error(
      "اسم المستخدم يجب أن يكون من 3 إلى 24 حرفًا."
    );
  }

  if (!/^[a-z0-9._]+$/.test(username)) {
    throw new Error(
      "اسم المستخدم يقبل الحروف الإنجليزية والأرقام والنقطة والشرطة السفلية."
    );
  }

  if (!displayName) {
    throw new Error("اكتب الاسم الذي سيظهر للآخرين.");
  }

  if (displayName.length > MEKA_CONFIG.limits.displayNameMax) {
    throw new Error("الاسم طويل جدًا.");
  }

  if (bio.length > MEKA_CONFIG.limits.bioMax) {
    throw new Error("النبذة الشخصية طويلة جدًا.");
  }

  const existing = await MEKA.db
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existing.error) throw existing.error;

  if (existing.data && existing.data.id !== MEKA.user.id) {
    throw new Error("اسم المستخدم مستخدم بالفعل.");
  }

  const existingProfile = await MEKA.db
    .from("profiles")
    .select("id")
    .eq("id", MEKA.user.id)
    .maybeSingle();

  if (existingProfile.error) {
    throw existingProfile.error;
  }

  const payload = {
    id: MEKA.user.id,
    username,
    display_name: displayName,
    full_name: displayName,
    bio
  };

  let result;

  if (existingProfile.data) {
    result = await MEKA.db
      .from("profiles")
      .update(payload)
      .eq("id", MEKA.user.id)
      .select("*")
      .single();
  } else {
    result = await MEKA.db
      .from("profiles")
      .insert(payload)
      .select("*")
      .single();
  }

  if (result.error) throw result.error;

  MEKA.profile = result.data;

  mekaRenderMyProfile();

  return MEKA.profile;
}

async function mekaUpdateProfile(changes) {
  if (!MEKA.db || !MEKA.user) {
    throw new Error("يجب تسجيل الدخول أولًا.");
  }

  const allowed = {};

  if (typeof changes.display_name === "string") {
    allowed.display_name =
      changes.display_name.trim().slice(
        0,
        MEKA_CONFIG.limits.displayNameMax
      );

    allowed.full_name = allowed.display_name;
  }

  if (typeof changes.bio === "string") {
    allowed.bio = changes.bio
      .trim()
      .slice(0, MEKA_CONFIG.limits.bioMax);
  }

  if (typeof changes.website === "string") {
    allowed.website = changes.website.trim();
  }

  if (typeof changes.phone === "string") {
    allowed.phone = changes.phone.trim();
  }

  if (typeof changes.is_private === "boolean") {
    allowed.is_private = changes.is_private;
  }

  if (!Object.keys(allowed).length) {
    throw new Error("لا توجد تعديلات لحفظها.");
  }

  const { data, error } = await MEKA.db
    .from("profiles")
    .update(allowed)
    .eq("id", MEKA.user.id)
    .select("*")
    .single();

  if (error) throw error;

  MEKA.profile = data;

  mekaRenderMyProfile();

  mekaToast("تم تحديث الملف الشخصي.", "success");

  return data;
}

function mekaRenderMyProfile() {
  const profile = MEKA.profile;

  if (!profile) return;

  const name = mekaGetDisplayName(profile);

  const nameSelectors = [
    "#profile-name",
    "#user-name",
    "#current-user-name",
    "[data-meka-profile-name]"
  ];

  nameSelectors.forEach(selector => {
    $$(selector).forEach(element => {
      element.textContent = name;
    });
  });

  const usernameSelectors = [
    "#profile-username",
    "#user-username",
    "[data-meka-profile-username]"
  ];

  usernameSelectors.forEach(selector => {
    $$(selector).forEach(element => {
      element.textContent = profile.username
        ? `@${profile.username}`
        : "";
    });
  });

  const bioSelectors = [
    "#profile-bio",
    "#user-bio",
    "[data-meka-profile-bio]"
  ];

  bioSelectors.forEach(selector => {
    $$(selector).forEach(element => {
      element.textContent = profile.bio || "";
    });
  });

  $$(".meka-my-avatar, [data-meka-my-avatar]").forEach(element => {
    element.innerHTML = mekaAvatar(profile, 48);
  });

  window.dispatchEvent(
    new CustomEvent("meka:profileloaded", {
      detail: { profile }
    })
  );
}

/* =========================================================
   SEARCH USERS
   ========================================================= */

async function mekaSearchUsers(query) {
  if (!MEKA.db || !MEKA.user) {
    throw new Error("سجّل الدخول لاستخدام البحث.");
  }

  query = String(query || "").trim().replace(/^@/, "");

  if (query.length < 2) return [];

  const { data, error } = await MEKA.db
    .from("profiles")
    .select(
      "id, username, display_name, full_name, bio, avatar_url, user_code"
    )
    .neq("id", MEKA.user.id)
    .or(
      `username.ilike.%${query}%,display_name.ilike.%${query}%,user_code.ilike.%${query}%`
    )
    .limit(25);

  if (error) {
    console.error("[MEKA] Search error:", error);
    throw error;
  }

  return data || [];
}

function mekaRenderSearchResults(users, container) {
  if (!container) return;

  if (!users.length) {
    container.innerHTML = `
      <div class="meka-empty-state">
        <strong>لا توجد نتائج</strong>
        <p>جرّب اسم مستخدم مختلفًا.</p>
      </div>
    `;

    return;
  }

  container.innerHTML = users.map(user => `
    <button
      type="button"
      class="meka-user-result"
      data-meka-user-id="${mekaEscape(user.id)}"
      style="
        display:flex;
        align-items:center;
        gap:12px;
        width:100%;
        padding:12px;
        border:0;
        border-radius:14px;
        background:transparent;
        color:inherit;
        text-align:right;
        cursor:pointer;
      "
    >
      ${mekaAvatar(user, 46)}

      <span style="min-width:0;flex:1">
        <strong style="display:block">
          ${mekaEscape(mekaGetDisplayName(user))}
        </strong>

        <small style="opacity:.7">
          ${user.username
            ? `@${mekaEscape(user.username)}`
            : "مستخدم ميكا"}
        </small>
      </span>

      <span aria-hidden="true">›</span>
    </button>
  `).join("");
}

/* =========================================================
   CONVERSATIONS
   ========================================================= */

async function mekaLoadConversations() {
  if (!MEKA.db || !MEKA.user) return [];

  const { data: memberships, error: memberError } =
    await MEKA.db
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", MEKA.user.id);

  if (memberError) throw memberError;

  const ids = [
    ...new Set(
      (memberships || [])
        .map(item => item.conversation_id)
        .filter(Boolean)
    )
  ];

  if (!ids.length) {
    MEKA.conversations = [];
    mekaRenderConversations();
    return [];
  }

  const { data: conversations, error: conversationError } =
    await MEKA.db
      .from("conversations")
      .select("*")
      .in("id", ids)
      .order("created_at", { ascending: false });

  if (conversationError) throw conversationError;

  MEKA.conversations = conversations || [];

  mekaRenderConversations();

  return MEKA.conversations;
}

async function mekaGetConversationMembers(conversationId) {
  const { data, error } = await MEKA.db
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId);

  if (error) throw error;

  return data || [];
}

async function mekaGetOtherMemberProfile(conversationId) {
  const members = await mekaGetConversationMembers(conversationId);

  const otherIds = members
    .map(member => member.user_id)
    .filter(id => id !== MEKA.user.id);

  if (!otherIds.length) return null;

  const { data, error } = await MEKA.db
    .from("profiles")
    .select("*")
    .in("id", otherIds)
    .limit(1);

  if (error) throw error;

  return data?.[0] || null;
}

function mekaConversationTitle(conversation) {
  return (
    conversation.title ||
    conversation.name ||
    (conversation.is_group ? "مجموعة ميكا" : "محادثة")
  );
}

async function mekaRenderConversations() {
  const containers = [
    $("#chat-list"),
    $("#conversation-list"),
    $("#chats-list"),
    $("[data-meka-conversations]")
  ].filter(Boolean);

  if (!containers.length) return;

  if (!MEKA.conversations.length) {
    const empty = `
      <div class="meka-empty-state" style="padding:24px;text-align:center">
        <strong>ابدأ أول محادثة</strong>
        <p>ابحث عن مستخدم لبدء التواصل معه.</p>
      </div>
    `;

    containers.forEach(container => {
      container.innerHTML = empty;
    });

    return;
  }

  const rows = await Promise.all(
    MEKA.conversations.map(async conversation => {
      let otherProfile = null;

      if (!conversation.is_group) {
        try {
          otherProfile = await mekaGetOtherMemberProfile(
            conversation.id
          );
        } catch (error) {
          console.warn(
            "[MEKA] Could not load conversation member:",
            error
          );
        }
      }

      const title = conversation.is_group
        ? mekaConversationTitle(conversation)
        : mekaGetDisplayName(otherProfile);

      return `
        <button
          type="button"
          class="meka-conversation-item"
          data-meka-conversation-id="${mekaEscape(conversation.id)}"
          style="
            display:flex;
            align-items:center;
            gap:12px;
            width:100%;
            padding:13px;
            border:0;
            border-radius:14px;
            background:transparent;
            color:inherit;
            text-align:right;
            cursor:pointer;
          "
        >
          ${mekaAvatar(otherProfile || { display_name: title }, 48)}

          <span style="flex:1;min-width:0">
            <strong style="display:block">
              ${mekaEscape(title)}
            </strong>

            <small style="opacity:.65">
              ${mekaEscape(mekaFormatDate(conversation.created_at))}
            </small>
          </span>
        </button>
      `;
    })
  );

  containers.forEach(container => {
    container.innerHTML = rows.join("");
  });
}

/* =========================================================
   OPEN OR CREATE DIRECT CONVERSATION
   ========================================================= */

async function mekaStartConversation(otherUserId) {
  if (!MEKA.db || !MEKA.user) {
    throw new Error("يجب تسجيل الدخول أولًا.");
  }

  if (!otherUserId || otherUserId === MEKA.user.id) {
    throw new Error("لا يمكنك بدء محادثة مع نفسك.");
  }

  const { data: memberships, error: memberError } =
    await MEKA.db
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", MEKA.user.id);

  if (memberError) throw memberError;

  for (const membership of memberships || []) {
    const conversationId = membership.conversation_id;

    const { data: otherMember, error } = await MEKA.db
      .from("conversation_members")
      .select("conversation_id")
      .eq("conversation_id", conversationId)
      .eq("user_id", otherUserId)
      .maybeSingle();

    if (error) throw error;

    if (!otherMember) continue;

    const { data: conversation, error: conversationError } =
      await MEKA.db
        .from("conversations")
        .select("*")
        .eq("id", conversationId)
        .maybeSingle();

    if (conversationError) throw conversationError;

    if (conversation && !conversation.is_group) {
      await mekaOpenConversation(conversation);
      return conversation;
    }
  }

  const { data: created, error: createError } =
    await MEKA.db
      .from("conversations")
      .insert({})
      .select("*")
      .single();

  if (createError) {
    console.error(
      "[MEKA] Conversation creation failed:",
      createError
    );

    throw new Error(
      "تعذر إنشاء المحادثة. قد يحتاج جدول conversations إلى حقول مطلوبة أو سياسة RLS مناسبة."
    );
  }

  const { error: insertMembersError } =
    await MEKA.db
      .from("conversation_members")
      .insert([
        {
          conversation_id: created.id,
          user_id: MEKA.user.id
        },
        {
          conversation_id: created.id,
          user_id: otherUserId
        }
      ]);

  if (insertMembersError) {
    console.error(
      "[MEKA] Adding conversation members failed:",
      insertMembersError
    );

    throw new Error(
      "تم إنشاء المحادثة، لكن تعذرت إضافة الأعضاء. راجع سياسات RLS."
    );
  }

  await mekaLoadConversations();
  await mekaOpenConversation(created);

  return created;
}

/* =========================================================
   MESSAGES
   ========================================================= */

async function mekaLoadMessages(conversationId) {
  if (!MEKA.db || !MEKA.user || !conversationId) return [];

  const { data, error } = await MEKA.db
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    console.error("[MEKA] Message loading error:", error);
    throw error;
  }

  MEKA.messages = data || [];

  mekaRenderMessages();

  return MEKA.messages;
}

function mekaRenderMessages() {
  const container = $(
    "#messages-container, #message-list, #chat-messages, [data-meka-messages]"
  );

  if (!container) return;

  if (!MEKA.messages.length) {
    container.innerHTML = `
      <div class="meka-empty-state" style="padding:24px;text-align:center">
        <p>لا توجد رسائل بعد. ابدأ المحادثة برسالة جديدة.</p>
      </div>
    `;

    return;
  }

  container.innerHTML = MEKA.messages.map(message => {
    const ownMessage = message.sender_id === MEKA.user?.id;

    return `
      <div
        class="meka-message ${ownMessage ? "is-own" : "is-other"}"
        style="
          display:flex;
          justify-content:${ownMessage ? "flex-start" : "flex-end"};
          margin:8px 0;
        "
      >
        <div
          style="
            max-width:min(80%, 560px);
            padding:10px 13px;
            border-radius:16px;
            background:${ownMessage ? "#155e54" : "#172b45"};
            color:#fff;
            overflow-wrap:anywhere;
            white-space:pre-wrap;
          "
        >
          <div>${mekaEscape(message.content || "")}</div>

          <small
            style="
              display:block;
              margin-top:5px;
              opacity:.65;
              font-size:11px;
              text-align:left;
            "
          >${mekaEscape(mekaFormatTime(message.created_at))}</small>
        </div>
      </div>
    `;
  }).join("");

  container.scrollTop = container.scrollHeight;
}

async function mekaSendMessage(text) {
  if (!MEKA.db || !MEKA.user) {
    throw new Error("يجب تسجيل الدخول أولًا.");
  }

  if (!MEKA.activeConversation) {
    throw new Error("افتح محادثة أولًا.");
  }

  text = String(text || "").trim();

  if (!text) return null;

  if (text.length > MEKA_CONFIG.limits.messageMax) {
    throw new Error("الرسالة أطول من الحد المسموح.");
  }

  if (MEKA.sending) return null;

  MEKA.sending = true;

  try {
    const { data, error } = await MEKA.db
      .from("messages")
      .insert({
        conversation_id: MEKA.activeConversation.id,
        sender_id: MEKA.user.id,
        content: text
      })
      .select("*")
      .single();

    if (error) throw error;

    MEKA.messages.push(data);

    mekaRenderMessages();

    return data;
  } finally {
    MEKA.sending = false;
  }
}

/* =========================================================
   REALTIME MESSAGES
   ========================================================= */

function mekaStopMessageRealtime() {
  if (!MEKA.db || !MEKA.messageChannel) return;

  MEKA.db.removeChannel(MEKA.messageChannel);

  MEKA.messageChannel = null;
}

function mekaStartMessageRealtime(conversationId) {
  mekaStopMessageRealtime();

  if (!MEKA.db || !conversationId) return;

  MEKA.messageChannel = MEKA.db
    .channel(`meka-messages-${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`
      },
      async payload => {
        if (
          MEKA.activeConversation?.id !== conversationId
        ) {
          return;
        }

        if (payload.eventType === "INSERT") {
          const exists = MEKA.messages.some(
            message => message.id === payload.new.id
          );

          if (!exists) {
            MEKA.messages.push(payload.new);
            mekaRenderMessages();
          }
        } else {
          await mekaLoadMessages(conversationId);
        }
      }
    )
    .subscribe(status => {
      if (status === "CHANNEL_ERROR") {
        console.warn(
          "[MEKA] Realtime channel error. Check publication and permissions."
        );
      }
    });
}

/* =========================================================
   OPEN CONVERSATION
   ========================================================= */

async function mekaOpenConversation(conversation) {
  if (!conversation?.id) return;

  MEKA.activeConversation = conversation;

  const titleElement = $(
    "#chat-title, #conversation-title, [data-meka-chat-title]"
  );

  if (titleElement) {
    titleElement.textContent =
      mekaConversationTitle(conversation);
  }

  const chatScreen = $(
    "#chat-screen, #conversation-screen, [data-meka-chat-screen]"
  );

  if (chatScreen) {
    chatScreen.hidden = false;
    chatScreen.classList.remove("hidden");
  }

  await mekaLoadMessages(conversation.id);

  mekaStartMessageRealtime(conversation.id);

  window.dispatchEvent(
    new CustomEvent("meka:conversationopened", {
      detail: { conversation }
    })
  );
}

/* =========================================================
   PROFILE SETUP FORM
   ========================================================= */

function mekaBindProfileForm() {
  const form = $(
    "#profile-setup-form, #onboarding-form, [data-meka-profile-form]"
  );

  if (!form) return;

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const usernameInput = $(
      "#setup-username, #username-input, [name='username']",
      form
    );

    const nameInput = $(
      "#setup-display-name, #display-name-input, [name='display_name']",
      form
    );

    const bioInput = $(
      "#setup-bio, #bio-input, [name='bio']",
      form
    );

    const submitButton = $("button[type='submit']", form);

    mekaSetBusy(submitButton, true, "جارٍ حفظ البيانات...");

    try {
      await mekaCreateProfile({
        username: usernameInput?.value,
        displayName: nameInput?.value,
        bio: bioInput?.value
      });

      mekaShowScreen("main");

      await mekaLoadConversations();

      mekaToast("أهلًا بك في ميكا.", "success");
    } catch (error) {
      console.error("[MEKA] Profile setup error:", error);

      mekaToast(
        error.message || "تعذر حفظ الملف الشخصي.",
        "error"
      );
    } finally {
      mekaSetBusy(submitButton, false);
    }
  });
}

/* =========================================================
   SEARCH FORM
   ========================================================= */

function mekaBindSearch() {
  const input = $(
    "#user-search, #search-users, [data-meka-search]"
  );

  const results = $(
    "#search-results, #user-search-results, [data-meka-search-results]"
  );

  if (!input || !results) return;

  let timer;

  input.addEventListener("input", () => {
    clearTimeout(timer);

    timer = setTimeout(async () => {
      const query = input.value.trim();

      if (query.length < 2) {
        results.innerHTML = "";
        return;
      }

      results.textContent = "جارٍ البحث...";

      try {
        const users = await mekaSearchUsers(query);

        mekaRenderSearchResults(users, results);
      } catch (error) {
        console.error("[MEKA] Search failed:", error);

        results.textContent =
          "تعذر البحث. تحقق من الاتصال وصلاحيات قاعدة البيانات.";
      }
    }, 300);
  });
}

/* =========================================================
   MESSAGE FORM
   ========================================================= */

function mekaBindMessageForm() {
  const form = $(
    "#message-form, #send-message-form, [data-meka-message-form]"
  );

  const input = $(
    "#message-input, #message-text, [data-meka-message-input]"
  );

  if (!form || !input) return;

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const button = $("button[type='submit']", form);
    const value = input.value;

    mekaSetBusy(button, true, "إرسال...");

    try {
      await mekaSendMessage(value);

      input.value = "";
      input.focus();
    } catch (error) {
      console.error("[MEKA] Sending message failed:", error);

      mekaToast(
        error.message || "تعذر إرسال الرسالة.",
        "error"
      );
    } finally {
      mekaSetBusy(button, false);
    }
  });
}

/* =========================================================
   CLICK HANDLERS
   ========================================================= */

function mekaBindActions() {
  document.addEventListener("click", async event => {
    const googleButton = event.target.closest(
      "#google-login, #google-sign-in, [data-meka-google-login]"
    );

    if (googleButton) {
      await mekaSignInWithGoogle(googleButton);
      return;
    }

    const signOutButton = event.target.closest(
      "#logout-button, #sign-out-button, [data-meka-signout]"
    );

    if (signOutButton) {
      await mekaSignOut();
      return;
    }

    const conversationButton = event.target.closest(
      "[data-meka-conversation-id]"
    );

    if (conversationButton) {
      const id = conversationButton.dataset.mekaConversationId;

      const conversation = MEKA.conversations.find(
        item => String(item.id) === String(id)
      );

      if (conversation) {
        try {
          await mekaOpenConversation(conversation);
        } catch (error) {
          console.error(error);
          mekaToast("تعذر فتح المحادثة.", "error");
        }
      }

      return;
    }

    const userButton = event.target.closest(
      "[data-meka-user-id]"
    );

    if (userButton) {
      try {
        await mekaStartConversation(
          userButton.dataset.mekaUserId
        );
      } catch (error) {
        console.error("[MEKA] Start conversation failed:", error);

        mekaToast(
          error.message || "تعذر بدء المحادثة.",
          "error"
        );
      }

      return;
    }

    const navigationButton = event.target.closest(
      "[data-meka-section]"
    );

    if (navigationButton) {
      const section = navigationButton.dataset.mekaSection;

      window.dispatchEvent(
        new CustomEvent("meka:navigate", {
          detail: { section }
        })
      );
    }
  });
}

/* =========================================================
   AUTH STATE ROUTING
   ========================================================= */

async function mekaRouteUser(user) {
  MEKA.user = user || null;

  if (!user) {
    MEKA.session = null;
    MEKA.profile = null;

    mekaStopMessageRealtime();
    mekaShowScreen("auth");

    return;
  }

  try {
    await mekaLoadMyProfile();

    if (!MEKA.profile) {
      mekaShowScreen("onboarding");
      return;
    }

    mekaRenderMyProfile();

    mekaShowScreen("main");

    await mekaLoadConversations();

    window.dispatchEvent(
      new CustomEvent("meka:ready", {
        detail: {
          user: MEKA.user,
          profile: MEKA.profile
        }
      })
    );
  } catch (error) {
    console.error("[MEKA] User routing error:", error);

    mekaToast(
      "تعذر تحميل الملف الشخصي. راجع اتصال قاعدة البيانات وصلاحياتها.",
      "error"
    );

    /*
      Do not sign the user out when profile loading fails.
      A database/RLS error does not mean the session is invalid.
    */
  }
}

/* =========================================================
   APPLICATION STARTUP
   ========================================================= */

async function mekaStart() {
  if (MEKA.initialized) return;

  MEKA.initialized = true;

  mekaBindActions();
  mekaBindProfileForm();
  mekaBindSearch();
  mekaBindMessageForm();

  try {
    await mekaInitializeSupabase();

    const {
      data: { session },
      error
    } = await MEKA.db.auth.getSession();

    if (error) throw error;

    MEKA.session = session;
    MEKA.user = session?.user || null;

    await mekaRouteUser(MEKA.user);

    const {
      data: { subscription }
    } = MEKA.db.auth.onAuthStateChange(
      (event, session) => {
        MEKA.session = session;
        MEKA.user = session?.user || null;

        if (event === "SIGNED_OUT") {
          MEKA.profile = null;
          MEKA.conversations = [];
          MEKA.messages = [];
          MEKA.activeConversation = null;

          mekaStopMessageRealtime();
          mekaShowScreen("auth");

          return;
        }

        if (
          event === "SIGNED_IN" ||
          event === "INITIAL_SESSION" ||
          event === "USER_UPDATED"
        ) {
          /*
            Defer database work so the auth callback does not
            hold up Supabase's internal auth processing.
          */
          setTimeout(() => {
            mekaRouteUser(session?.user || null);
          }, 0);
        }
      }
    );

    MEKA.authSubscription = subscription;

    console.info("[MEKA] Application initialized.");
  } catch (error) {
    console.error("[MEKA] Startup error:", error);

    mekaToast(
      "تعذر تشغيل ميكا. تحقق من الإنترنت ومكتبة Supabase.",
      "error"
    );

    mekaSetStatus("تعذر الاتصال. أعد تحميل الصفحة بعد التحقق من الإنترنت.");
  }
}

/* =========================================================
  /* MEKA Service Worker Registration */

if (
  "serviceWorker" in navigator &&
  (
    location.protocol === "https:" ||
    location.hostname === "localhost"
  )
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then(registration => {
        console.info(
          "[MEKA] Service Worker registered:",
          registration.scope
        );
      })
      .catch(error => {
        console.error(
          "[MEKA] Service Worker registration failed:",
          error
        );
      });
  });
}
/* =========================================================
   Start MEKA after the application has been initialized
   ========================================================= */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    mekaStart();
  }, { once: true });
} else {
  mekaStart();
}
