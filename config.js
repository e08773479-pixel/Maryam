/* =========================================================
   MEKA CHAT — DATABASE CONFIGURATION
   Connected to existing Supabase project.
   No new database will be created.
========================================================= */

"use strict";

(() => {
  const MEKA_CONFIG = {
    APP: {
      name: "MEKA CHAT",
      nameAr: "ميكا شات",
      version: "1.0.0",
      direction: "rtl",
      defaultLanguage: "ar",
      defaultTheme: "dark",
      splashDuration: 5000
    },

    SUPABASE: {
      url: "https://cxksushmcuyomuaywgfw.supabase.co",

      publishableKey:
        "sb_publishable_6D7DE4aODAIqhG9Ls3gGfQ_Um-E-7f5",

      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "meka-chat-auth"
      }
    },

    DATABASE: {
      schema: "public",

      tables: {
        profiles: "profiles",
        userSettings: "user_settings",
        userFollows: "user_follows",

        posts: "posts",
        postMedia: "post_media",
        postLikes: "post_likes",
        comments: "comments",

        stories: "stories",
        storyViews: "story_views",
        storyAudiences: "story_audiences",

        conversations: "conversations",
        conversationMembers: "conversation_members",
        messages: "messages",
        messageAttachments: "message_attachments",
        messageReactions: "message_reactions",
        messagePins: "message_pins",
        starredMessages: "starred_messages",
        messageReceipts: "message_receipts",
        conversationSettings: "conversation_settings",

        calls: "calls",
        callParticipants: "call_participants",

        communities: "communities",
        communityMembers: "community_members",

        notifications: "notifications",
        blocks: "blocks",
        reports: "reports",

        games: "games",
        gameRooms: "game_rooms",
        gameRoomMembers: "game_room_members",

        userPresence: "user_presence",

        aiConversations: "ai_conversations",
        aiMessages: "ai_messages",

        subscriptionPlans: "subscription_plans",
        userSubscriptions: "user_subscriptions",

        shortVideos: "short_videos",
        shortVideoLikes: "short_video_likes",
        shortVideoViews: "short_video_views",

        savedPosts: "saved_posts",
        savedShortVideos: "saved_short_videos",

        friendRequests: "friend_requests",

        polls: "polls",
        pollOptions: "poll_options",
        pollVotes: "poll_votes",

        userDevices: "user_devices",
        pushSubscriptions: "push_subscriptions"
      }
    },

    STORAGE: {
      buckets: {
        avatars: "nova-avatars",
        covers: "nova-covers",
        messages: "nova-message-files",
        posts: "nova-post-media",
        stories: "nova-stories"
      },

      limits: {
        avatar: 5 * 1024 * 1024,
        cover: 10 * 1024 * 1024,
        message: 100 * 1024 * 1024,
        post: 100 * 1024 * 1024,
        story: 100 * 1024 * 1024
      },

      allowedImages: [
        "image/jpeg",
        "image/png",
        "image/webp"
      ],

      allowedMedia: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "video/mp4",
        "video/webm",
        "audio/mpeg",
        "audio/mp4",
        "application/pdf"
      ]
    },

    REALTIME: {
      enabled: true,

      channels: {
        messages: "meka-messages",
        presence: "meka-presence",
        notifications: "meka-notifications",
        calls: "meka-calls",
        stories: "meka-stories",
        social: "meka-social"
      }
    },

    LANGUAGES: {
      default: "ar",

      supported: {
        ar: { name: "العربية", direction: "rtl" },
        en: { name: "English", direction: "ltr" },
        fr: { name: "Français", direction: "ltr" },
        es: { name: "Español", direction: "ltr" },
        de: { name: "Deutsch", direction: "ltr" },
        it: { name: "Italiano", direction: "ltr" },
        pt: { name: "Português", direction: "ltr" },
        ru: { name: "Русский", direction: "ltr" },
        tr: { name: "Türkçe", direction: "ltr" },
        zh: { name: "中文", direction: "ltr" },
        ja: { name: "日本語", direction: "ltr" },
        ko: { name: "한국어", direction: "ltr" },
        hi: { name: "हिन्दी", direction: "ltr" },
        ur: { name: "اردو", direction: "rtl" },
        fa: { name: "فارسی", direction: "rtl" },
        nl: { name: "Nederlands", direction: "ltr" },
        sv: { name: "Svenska", direction: "ltr" },
        no: { name: "Norsk", direction: "ltr" },
        da: { name: "Dansk", direction: "ltr" },
        fi: { name: "Suomi", direction: "ltr" },
        pl: { name: "Polski", direction: "ltr" },
        uk: { name: "Українська", direction: "ltr" },
        el: { name: "Ελληνικά", direction: "ltr" },
        he: { name: "עברית", direction: "rtl" },
        id: { name: "Bahasa Indonesia", direction: "ltr" },
        ms: { name: "Bahasa Melayu", direction: "ltr" },
        bn: { name: "বাংলা", direction: "ltr" }
      }
    },

    CALLS: {
      enabled: true,
      provider: "webrtc",

      configuration: {
        iceServers: [
          {
            urls: "stun:stun.l.google.com:19302"
          },
          {
            urls: "stun:stun1.l.google.com:19302"
          }
        ]
      }
    },

    STORIES: {
      durationHours: 24,
      maxTextLength: 700,
      maxVideoSize: 100 * 1024 * 1024
    },

    MESSAGING: {
      maxMessageLength: 10000,
      maxAttachments: 10,
      typingTimeout: 3000,
      realtimeEnabled: true
    },

    SOCIAL: {
      maxPostLength: 10000,
      maxCommentLength: 5000,
      shortVideoMaxSize: 100 * 1024 * 1024
    },

    SECURITY: {
      useRLS: true,
      neverExposeServiceRole: true,
      validateUploads: true,
      requireAuthenticatedUser: true
    },

    FEATURES: {
      authentication: true,
      googleLogin: true,
      directMessages: true,
      groupChats: true,
      stories: true,
      posts: true,
      shortVideos: true,
      communities: true,
      channels: true,
      voiceCalls: true,
      videoCalls: true,
      polls: true,
      notifications: true,
      games: true,
      aiConversations: true,
      subscriptions: true,
      realtime: true,
      fileUploads: true,
      multiLanguage: true
    }
  };

  /* =========================================
     GLOBAL EXPORT
  ========================================= */

  window.MEKA_CONFIG = MEKA_CONFIG;

  /* =========================================
     SUPABASE CLIENT
  ========================================= */

  window.mekaSupabase = null;
  window.mekaDatabaseReady = false;

  window.mekaInitializeSupabase = function () {
    if (window.mekaSupabase) {
      return window.mekaSupabase;
    }

    if (!window.supabase ||
        typeof window.supabase.createClient !== "function") {
      console.error(
        "MEKA CHAT: Supabase SDK is not loaded."
      );

      return null;
    }

    try {
      window.mekaSupabase =
        window.supabase.createClient(
          MEKA_CONFIG.SUPABASE.url,
          MEKA_CONFIG.SUPABASE.publishableKey,
          {
            auth: MEKA_CONFIG.SUPABASE.auth,

            realtime: {
              params: {
                eventsPerSecond: 10
              }
            },

            global: {
              headers: {
                "x-application-name": "MEKA-CHAT"
              }
            }
          }
        );

      window.mekaDatabaseReady = true;

      console.info(
        "MEKA CHAT: Database client initialized."
      );

      window.dispatchEvent(
        new CustomEvent("meka:database-ready")
      );

      return window.mekaSupabase;

    } catch (error) {
      console.error(
        "MEKA CHAT: Database initialization failed.",
        error
      );

      window.mekaDatabaseReady = false;

      return null;
    }
  };

  /* =========================================
     TABLE HELPERS
  ========================================= */

  window.mekaTable = function (tableKey) {
    const tableName =
      MEKA_CONFIG.DATABASE.tables[tableKey];

    if (!tableName) {
      throw new Error(
        "Unknown MEKA database table: " + tableKey
      );
    }

    if (!window.mekaSupabase) {
      throw new Error(
        "MEKA database is not initialized."
      );
    }

    return window.mekaSupabase
      .from(tableName);
  };

  window.mekaGetTableName = function (tableKey) {
    return MEKA_CONFIG.DATABASE.tables[tableKey] || null;
  };

  /* =========================================
     STORAGE HELPERS
  ========================================= */

  window.mekaGetBucketName = function (bucketKey) {
    return MEKA_CONFIG.STORAGE.buckets[bucketKey] || null;
  };

  window.mekaStorage = function (bucketKey) {
    const bucketName =
      window.mekaGetBucketName(bucketKey);

    if (!bucketName || !window.mekaSupabase) {
      throw new Error(
        "MEKA Storage bucket is unavailable: " + bucketKey
      );
    }

    return window.mekaSupabase
      .storage
      .from(bucketName);
  };

  /* =========================================
     LANGUAGE HELPERS
  ========================================= */

  window.mekaGetLanguage = function () {
    const saved =
      localStorage.getItem("meka-language");

    if (
      saved &&
      MEKA_CONFIG.LANGUAGES.supported[saved]
    ) {
      return saved;
    }

    return MEKA_CONFIG.LANGUAGES.default;
  };

  window.mekaGetDirection = function (language) {
    const item =
      MEKA_CONFIG.LANGUAGES.supported[language];

    return item ? item.direction : "rtl";
  };

  window.mekaSetLanguage = function (language) {
    if (!MEKA_CONFIG.LANGUAGES.supported[language]) {
      return false;
    }

    localStorage.setItem(
      "meka-language",
      language
    );

    document.documentElement.lang = language;

    document.documentElement.dir =
      window.mekaGetDirection(language);

    window.dispatchEvent(
      new CustomEvent("meka:language-changed", {
        detail: { language }
      })
    );

    return true;
  };

  /* =========================================
     FEATURE HELPERS
  ========================================= */

  window.mekaIsFeatureEnabled = function (name) {
    return MEKA_CONFIG.FEATURES[name] === true;
  };

  /* =========================================
     FILE VALIDATION
  ========================================= */

  window.mekaFormatFileSize = function (bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) {
      return "0 B";
    }

    if (bytes < 1024) {
      return bytes + " B";
    }

    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + " KB";
    }

    if (bytes < 1024 * 1024 * 1024) {
      return (
        bytes / (1024 * 1024)
      ).toFixed(1) + " MB";
    }

    return (
      bytes / (1024 * 1024 * 1024)
    ).toFixed(1) + " GB";
  };

  window.mekaValidateFile = function (
    file,
    category = "message"
  ) {
    if (!(file instanceof File)) {
      return {
        valid: false,
        error: "الملف غير صالح."
      };
    }

    const limits =
      MEKA_CONFIG.STORAGE.limits;

    const maxSize =
      limits[category] || limits.message;

    if (file.size > maxSize) {
      return {
        valid: false,
        error:
          "حجم الملف أكبر من الحد المسموح: " +
          window.mekaFormatFileSize(maxSize)
      };
    }

    let allowedTypes =
      MEKA_CONFIG.STORAGE.allowedMedia;

    if (category === "avatar" || category === "cover") {
      allowedTypes =
        MEKA_CONFIG.STORAGE.allowedImages;
    }

    if (
      file.type &&
      !allowedTypes.includes(file.type)
    ) {
      return {
        valid: false,
        error: "نوع الملف غير مسموح."
      };
    }

    return {
      valid: true,
      error: null
    };
  };

  /* =========================================
     AUTH HELPERS
  ========================================= */

  window.mekaGetCurrentUser = async function () {
    if (!window.mekaSupabase) {
      return null;
    }

    const {
      data,
      error
    } = await window.mekaSupabase.auth.getUser();

    if (error || !data.user) {
      return null;
    }

    return data.user;
  };

  window.mekaGetCurrentSession = async function () {
    if (!window.mekaSupabase) {
      return null;
    }

    const {
      data,
      error
    } = await window.mekaSupabase.auth.getSession();

    if (error) {
      console.error(error);
      return null;
    }

    return data.session;
  };

  /* =========================================
     DATABASE STATUS
  ========================================= */

  window.mekaCheckDatabase = async function () {
    const client =
      window.mekaInitializeSupabase();

    if (!client) {
      return {
        connected: false,
        message: "Supabase SDK is unavailable."
      };
    }

    try {
      const {
        error
      } = await client
        .from("profiles")
        .select("id")
        .limit(1);

      if (error) {
        console.error(
          "MEKA database check:",
          error
        );

        return {
          connected: false,
          message: error.message
        };
      }

      return {
        connected: true,
        message: "Database is reachable."
      };

    } catch (error) {
      return {
        connected: false,
        message: error.message
      };
    }
  };

  /* =========================================
     STARTUP
  ========================================= */

  document.documentElement.lang =
    window.mekaGetLanguage();

  document.documentElement.dir =
    window.mekaGetDirection(
      window.mekaGetLanguage()
    );

  window.mekaInitializeSupabase();

  console.info(
    "MEKA CHAT configuration loaded."
  );

})();
