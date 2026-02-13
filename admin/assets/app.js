(function () {
  const Vue = window.Vue;
  if (!Vue) {
    console.error("[Vue3Admin] Vue is missing");
    return;
  }

  const { createApp, ref, reactive, computed, onMounted, watch, nextTick, getCurrentInstance } = Vue;
  const V3A = window.V3A || {};

  const GROUP_LEVELS = {
    administrator: 0,
    editor: 1,
    contributor: 2,
    subscriber: 3,
    visitor: 4,
  };

  const SETTINGS_TIMEZONES = [
    { value: 0, label: "格林威治(子午线)标准时间 (GMT)" },
    { value: 3600, label: "中欧标准时间 阿姆斯特丹,荷兰,法国 (GMT +1)" },
    { value: 7200, label: "东欧标准时间 布加勒斯特,塞浦路斯,希腊 (GMT +2)" },
    { value: 10800, label: "莫斯科时间 伊拉克,埃塞俄比亚,马达加斯加 (GMT +3)" },
    { value: 14400, label: "第比利斯时间 阿曼,毛里塔尼亚,留尼汪岛 (GMT +4)" },
    { value: 18000, label: "新德里时间 巴基斯坦,马尔代夫 (GMT +5)" },
    { value: 21600, label: "科伦坡时间 孟加拉 (GMT +6)" },
    { value: 25200, label: "曼谷雅加达 柬埔寨,苏门答腊,老挝 (GMT +7)" },
    { value: 28800, label: "北京时间 香港,新加坡,越南 (GMT +8)" },
    { value: 32400, label: "东京平壤时间 西伊里安,马鲁加群岛 (GMT +9)" },
    { value: 36000, label: "悉尼关岛时间 塔斯马尼亚岛,新几内亚 (GMT +10)" },
    { value: 39600, label: "所罗门群岛 库页岛 (GMT +11)" },
    { value: 43200, label: "惠灵顿时间 新西兰,斐济群岛 (GMT +12)" },
    { value: -3600, label: "佛得尔群岛 亚速尔群岛,葡属几内亚 (GMT -1)" },
    { value: -7200, label: "大西洋中部时间 格陵兰 (GMT -2)" },
    { value: -10800, label: "布宜诺斯艾利斯 乌拉圭,法属圭亚那 (GMT -3)" },
    { value: -14400, label: "智利巴西 委内瑞拉,玻利维亚 (GMT -4)" },
    { value: -18000, label: "纽约渥太华 古巴,哥伦比亚,牙买加 (GMT -5)" },
    { value: -21600, label: "墨西哥城时间 温尼伯,危地马拉,休斯顿 (GMT -6)" },
    { value: -25200, label: "美国丹佛时间 (GMT -7)" },
    { value: -28800, label: "美国旧金山时间 (GMT -8)" },
    { value: -32400, label: "阿拉斯加时间 (GMT -9)" },
    { value: -36000, label: "夏威夷群岛 (GMT -10)" },
    { value: -39600, label: "东萨摩亚群岛 (GMT -11)" },
    { value: -43200, label: "艾尼威托克岛 (GMT -12)" },
  ];

  function v3aGroupLevel(group) {
    const g = String(group || "").trim();
    return Object.prototype.hasOwnProperty.call(GROUP_LEVELS, g)
      ? GROUP_LEVELS[g]
      : GROUP_LEVELS.subscriber;
  }

  function v3aCan(access) {
    const current = v3aGroupLevel(V3A.user && V3A.user.group ? V3A.user.group : "subscriber");
    const required = v3aGroupLevel(access || "subscriber");
    return current <= required;
  }

  function v3aAclValue(path) {
    const acl = V3A && V3A.acl && typeof V3A.acl === "object" ? V3A.acl : null;
    if (!acl) return undefined;

    const parts = String(path || "").split(".").filter(Boolean);
    let cur = acl;
    for (const key of parts) {
      if (!cur || typeof cur !== "object" || !Object.prototype.hasOwnProperty.call(cur, key)) {
        return undefined;
      }
      cur = cur[key];
    }
    return cur;
  }

  function v3aAclEnabled(path, fallback = true) {
    const v = v3aAclValue(path);
    if (v === undefined) return !!fallback;
    return Number(v) ? true : false;
  }

  function v3aAclAllowMenuKey(key) {
    const k = String(key || "");
    if (!k) return true;

    if (k === "dashboard" || k === "settings" || k === "posts" || k === "pages" || k === "maintenance") {
      return true;
    }

    if (k === "posts-manage") return v3aAclEnabled("posts.manage", true);
    if (k === "posts-write") return v3aAclEnabled("posts.write", true);
    if (k === "posts-taxonomy") return v3aAclEnabled("posts.taxonomy", true);

    if (k === "comments") return v3aAclEnabled("comments.manage", true);

    if (k === "pages-manage") return v3aAclEnabled("pages.manage", true);
    if (k === "pages-edit") return v3aAclEnabled("pages.manage", true);

    if (k === "files") return v3aAclEnabled("files.access", true);

    if (k === "friends") return v3aAclEnabled("friends.manage", true);
    if (k === "data") return v3aAclEnabled("data.manage", true);
    if (k === "users") return v3aAclEnabled("users.manage", true);

    if (k === "maintenance-backup") {
      return v3aAclEnabled("maintenance.manage", true);
    }
    if (k === "maintenance-upgrade") {
      return v3aAclEnabled("maintenance.manage", true);
    }

    return true;
  }

  function v3aAclAllowPath(path) {
    const p = String(path || "/");
    if (p === "/dashboard" || p === "/settings") return true;

    if (p === "/posts/manage") return v3aAclEnabled("posts.manage", true);
    if (p === "/posts/write") return v3aAclEnabled("posts.write", true);
    if (p === "/posts/taxonomy") return v3aAclEnabled("posts.taxonomy", true);

    if (p === "/comments") return v3aAclEnabled("comments.manage", true);
    if (p === "/pages/manage") return v3aAclEnabled("pages.manage", true);
    if (p === "/pages/edit") return v3aAclEnabled("pages.manage", true);
    if (p === "/files") return v3aAclEnabled("files.access", true);

    if (p === "/friends") return v3aAclEnabled("friends.manage", true);
    if (p === "/data") return v3aAclEnabled("data.manage", true);
    if (p === "/users") return v3aAclEnabled("users.manage", true);

    if (p.startsWith("/maintenance/")) return v3aAclEnabled("maintenance.manage", true);

    return true;
  }

  const v3aAssetBase = (() => {
    try {
      const src =
        document.currentScript && document.currentScript.src
          ? document.currentScript.src
          : "";
      if (src) return new URL(".", src).toString();
    } catch (e) {}

    try {
      const base = String(V3A.adminUrl || "").trim();
      if (base) return new URL("assets/", new URL(base, location.href)).toString();
    } catch (e) {}

    return "";
  })();

  const v3aAssetVer = (() => {
    try {
      const src =
        document.currentScript && document.currentScript.src
          ? document.currentScript.src
          : "";
      if (!src) return "";
      return new URL(src, location.href).searchParams.get("v") || "";
    } catch (e) {}
    return "";
  })();

  function v3aAssetUrl(relPath) {
    const p = String(relPath || "");
    if (!p) return "";
    try {
      const u = v3aAssetBase ? new URL(p, v3aAssetBase) : new URL(p, location.href);
      if (v3aAssetVer) u.searchParams.set("v", v3aAssetVer);
      return u.toString();
    } catch (e) {
      return p;
    }
  }
  const STORAGE_KEYS = {
    sidebarCollapsed: "v3a_sidebar_collapsed",
    sidebarExpanded: "v3a_sidebar_expanded",
    settingsKey: "v3a_settings_key",
    dashboardTourDone: "v3a_tour_dashboard_done",
    mainTourDone: "v3a_tour_main_done",
    themeMode: "v3a_theme_mode",
  };

  const ICONS = {
    dashboard: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-layout-grid-icon lucide-layout-grid"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>`,
    posts: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M8 9h2"/></svg>`,
    comments: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square-icon lucide-message-square"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/></svg>`,
    pages: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sticky-note-icon lucide-sticky-note"><path d="M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"/><path d="M15 3v5a1 1 0 0 0 1 1h5"/></svg>`,
    files: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-folder-icon lucide-folder"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`,
    friends: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-users-icon lucide-users"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/></svg>`,
    data: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-database-icon lucide-database"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>`,
    subscribe: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mail-icon lucide-mail"><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>`,
    settings: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings2-icon lucide-settings-2"><path d="M14 17H5"/><path d="M19 7h-9"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>`,
    gear: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings-icon lucide-settings"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>`,
    cable: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-cable-icon lucide-cable"><path d="M17 19a1 1 0 0 1-1-1v-2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a1 1 0 0 1-1 1z"/><path d="M17 21v-2"/><path d="M19 14V6.5a1 1 0 0 0-7 0v11a1 1 0 0 1-7 0V10"/><path d="M21 21v-2"/><path d="M3 5V3"/><path d="M4 10a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2z"/><path d="M7 5V3"/></svg>`,
    globe: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>`,
    fileText: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path><path d="M14 2v5a1 1 0 0 0 1 1h5"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path></svg>`,
    bell: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.268 21a2 2 0 0 0 3.464 0"></path><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path></svg>`,
    shield: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path></svg>`,
    bot: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bot-icon lucide-bot"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>`,
    codeXml: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-code-xml-icon lucide-code-xml"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>`,
    palette: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-palette-icon lucide-palette"><path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/></svg>`,
    blocks: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-blocks-icon lucide-blocks"><path d="M10 22V7a1 1 0 0 0-1-1H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a1 1 0 0 0-1-1H2"/><rect x="14" y="2" width="8" height="8" rx="1"/></svg>`,
    maintenance: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wrench-icon lucide-wrench"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/></svg>`,
    chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`,
    collapse: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`,
    expand: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`,
    panelTopClose: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-panel-top-close-icon lucide-panel-top-close"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="m9 16 3-3 3 3"/></svg>`,
    panelTopOpen: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-panel-top-open-icon lucide-panel-top-open"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="m15 14-3 3-3-3"/></svg>`,
    user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    activity: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49"/><path d="M7.76 7.76a6 6 0 0 0 0 8.49"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>`,
    trending: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
    pie: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z"/><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/></svg>`,
    refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>`,
    tag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 11 3H4v7l9.59 9.59a2 2 0 0 0 2.82 0l4.18-4.18a2 2 0 0 0 0-2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
    tags: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13.172 2a2 2 0 0 1 1.414.586l6.71 6.71a2.4 2.4 0 0 1 0 3.408l-4.592 4.592a2.4 2.4 0 0 1-3.408 0l-6.71-6.71A2 2 0 0 1 6 9.172V3a1 1 0 0 1 1-1z"/><path d="M2 7v6.172a2 2 0 0 0 .586 1.414l6.71 6.71a2.4 2.4 0 0 0 3.191.193"/><circle cx="10.5" cy="6.5" r=".5" fill="currentColor"/></svg>`,
    link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1"/><path d="M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1"/></svg>`,
    heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    eyeOff: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>`,
    search: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>`,
    code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-code-icon lucide-code"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
    plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`,
    copy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>`,
    externalLink: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>`,
    pencil: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pencil-icon lucide-pencil"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>`,
    checkCheck: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>`,
    square: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>`,
    squareCheck: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>`,
    upload: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>`,
    refreshCw: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>`,
    edit: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
    trash: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
    save: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-save-icon lucide-save"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>`,
    send: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-send-icon lucide-send"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"></path><path d="m21.854 2.147-10.94 10.939"></path></svg>`,
    close: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
    closeSmall: `<svg viewBox="0 0 12 12" version="1.1" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"><g fill="currentColor" fill-rule="nonzero"><path d="M2.08859116,2.2156945 L2.14644661,2.14644661 C2.32001296,1.97288026 2.58943736,1.95359511 2.7843055,2.08859116 L2.85355339,2.14644661 L6,5.293 L9.14644661,2.14644661 C9.34170876,1.95118446 9.65829124,1.95118446 9.85355339,2.14644661 C10.0488155,2.34170876 10.0488155,2.65829124 9.85355339,2.85355339 L6.707,6 L9.85355339,9.14644661 C10.0271197,9.32001296 10.0464049,9.58943736 9.91140884,9.7843055 L9.85355339,9.85355339 C9.67998704,10.0271197 9.41056264,10.0464049 9.2156945,9.91140884 L9.14644661,9.85355339 L6,6.707 L2.85355339,9.85355339 C2.65829124,10.0488155 2.34170876,10.0488155 2.14644661,9.85355339 C1.95118446,9.65829124 1.95118446,9.34170876 2.14644661,9.14644661 L5.293,6 L2.14644661,2.85355339 C1.97288026,2.67998704 1.95359511,2.41056264 2.08859116,2.2156945 L2.14644661,2.14644661 L2.08859116,2.2156945 Z"></path></g></g></svg>`,
    toastInfo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z\" clip-rule=\"evenodd\"/></svg>`,
    toastSuccess: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 00-1.06 1.06l2.5 2.5a.75.75 0 001.137-.089l4-5.5z\" clip-rule=\"evenodd\"/></svg>`,
    toastWarn: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.72-1.36 3.485 0l6.518 11.586c.75 1.334-.214 2.99-1.742 2.99H3.48c-1.528 0-2.492-1.656-1.742-2.99L8.257 3.1zM11 14a1 1 0 10-2 0 1 1 0 002 0zm-.25-2.75a.75.75 0 01-1.5 0V7a.75.75 0 011.5 0v4.25z\" clip-rule=\"evenodd\"/></svg>`,
    toastError: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm2.53-10.47a.75.75 0 10-1.06-1.06L10 8.94 8.53 7.47a.75.75 0 10-1.06 1.06L8.94 10l-1.47 1.47a.75.75 0 101.06 1.06L10 11.06l1.47 1.47a.75.75 0 101.06-1.06L11.06 10l1.47-1.47z\" clip-rule=\"evenodd\"/></svg>`,
    thumbsUp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/><path d="M7 10v12"/></svg>`,
    check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>`,
    clock: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>`,
    shieldAlert: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>`,
    mapPin: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
    monitor: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"></rect><line x1="8" x2="16" y1="21" y2="21"></line><line x1="12" x2="12" y1="17" y2="21"></line></svg>`,
    smartphone: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" x2="12.01" y1="18" y2="18"></line></svg>`,
    monitorSmartphone: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-monitor-smartphone-icon lucide-monitor-smartphone"><path d="M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8"></path><path d="M10 19v-3.96 3.15"></path><path d="M7 19h5"></path><rect width="6" height="10" x="16" y="12" rx="2"></rect></svg>`,
    moon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-moon-icon lucide-moon"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>`,
    sun: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sun-icon lucide-sun"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
    smilePlus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11v1a10 10 0 1 1-9-10"></path><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" x2="9.01" y1="9" y2="9"></line><line x1="15" x2="15.01" y1="9" y2="9"></line><path d="M16 5h6"></path><path d="M19 2v6"></path></svg>`,
    info: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>`,
    home: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-house-icon lucide-house"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`,
    logout: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-door-open-icon lucide-door-open"><path d="M11 20H2"/><path d="M11 4.562v16.157a1 1 0 0 0 1.242.97L19 20V5.562a2 2 0 0 0-1.515-1.94l-4-1A2 2 0 0 0 11 4.561z"/><path d="M11 4H8a2 2 0 0 0-2 2v14"/><path d="M14 12h.01"/><path d="M22 20h-3"/></svg>`,
    github: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-github-icon lucide-github"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>`,
    hardDriveDownload: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-hard-drive-download-icon lucide-hard-drive-download"><path d="M12 2v8"/><path d="m16 6-4 4-4-4"/><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6 18h.01"/><path d="M10 18h.01"/></svg>`,
    wifiCog: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wifi-cog-icon lucide-wifi-cog"><path d="m14.305 19.53.923-.382"/><path d="m15.228 16.852-.923-.383"/><path d="m16.852 15.228-.383-.923"/><path d="m16.852 20.772-.383.924"/><path d="m19.148 15.228.383-.923"/><path d="m19.53 21.696-.382-.924"/><path d="M2 7.82a15 15 0 0 1 20 0"/><path d="m20.772 16.852.924-.383"/><path d="m20.772 19.148.924.383"/><path d="M5 11.858a10 10 0 0 1 11.5-1.785"/><path d="M8.5 15.429a5 5 0 0 1 2.413-1.31"/><circle cx="18" cy="18" r="3"/></svg>`,
    filePen: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-pen-icon lucide-file-pen"><path d="M12.659 22H18a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v9.34"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10.378 12.622a1 1 0 0 1 3 3.003L8.36 20.637a2 2 0 0 1-.854.506l-2.867.837a.5.5 0 0 1-.62-.62l.836-2.869a2 2 0 0 1 .506-.853z"/></svg>`,
    filePenLine: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-pen-line-icon lucide-file-pen-line"><path d="m18.226 5.226-2.52-2.52A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-.351"/><path d="M21.378 12.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/><path d="M8 18h1"/></svg>`,
    squarePen: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-pen-icon lucide-square-pen"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/></svg>`,
    cloud: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-cloud-icon lucide-cloud"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path></svg>`,
  };

  const SETTINGS = [
    { key: "user", label: "用户", icon: "user", subtitle: "个人资料", access: "subscriber" },
    { key: "site", label: "网站", icon: "globe", subtitle: "站点地址、SEO", access: "administrator" },
    { key: "content", label: "内容", icon: "fileText", subtitle: "阅读、评论、文本", access: "administrator" },
    { key: "acl", label: "权限", icon: "shieldAlert", subtitle: "角色权限、上传限制", access: "administrator" },
    { key: "notify", label: "通知", icon: "bell", subtitle: "邮件、推送", access: "administrator" },
    { key: "ai", label: "AI", icon: "bot", subtitle: "配置AI、启用AI", access: "administrator" },
    {
      key: "theme",
      label: "主题",
      icon: "palette",
      subtitle: "主题、外观",
      access: "administrator",
      children: [
        { key: "theme.activate", label: "主题启用", access: "administrator" },
        { key: "theme.edit", label: "主题编辑", access: "administrator" },
        { key: "theme.config", label: "主题设置", access: "administrator" },
      ],
    },
    { key: "plugins", label: "插件", icon: "blocks", subtitle: "扩展、插件", access: "administrator" },
    { key: "storage", label: "存储", icon: "data", subtitle: "附件、备份、图床", access: "administrator" },
    { key: "system", label: "永久链接", icon: "settings", subtitle: "URL 规则、重写", access: "administrator" },
    { key: "security", label: "账号安全", icon: "shield", subtitle: "密码、凭证、安全", access: "subscriber" },
  ];

  const MENU = [
    { key: "dashboard", label: "仪表盘", icon: "dashboard", to: "/dashboard", access: "subscriber" },
    {
      key: "posts",
      label: "博文",
      icon: "posts",
      access: "contributor",
      children: [
        { key: "posts-manage", label: "管理", to: "/posts/manage", access: "contributor" },
        { key: "posts-write", label: "撰写", to: "/posts/write", access: "contributor" },
        { key: "posts-taxonomy", label: "分类/标签", to: "/posts/taxonomy", access: "editor" },
      ],
    },
    { key: "drafts", label: "草稿箱", icon: "filePen", to: "/drafts", access: "contributor" },
    { key: "comments", label: "评论", icon: "comments", to: "/comments", badgeKey: "commentsWaiting", access: "editor" },
    {
      key: "pages",
      label: "页面",
      icon: "pages",
      access: "editor",
      children: [
        { key: "pages-manage", label: "管理", to: "/pages/manage", access: "editor" },
        { key: "pages-edit", label: "编辑", to: "/pages/edit", access: "editor" },
      ],
    },
    { key: "files", label: "文件", icon: "files", to: "/files", access: "contributor" },
    { key: "friends", label: "朋友们", icon: "friends", to: "/friends", access: "administrator" },
    { key: "data", label: "数据", icon: "data", to: "/data", access: "administrator" },
    { key: "users", label: "用户", icon: "user", to: "/users", access: "administrator" },
    { key: "settings", label: "设定", icon: "settings", action: "openSettings", access: "subscriber" },
    {
      key: "extras",
      label: "额外功能",
      icon: "cable",
      access: "subscriber",
      children: (() => {
        const extras = V3A && V3A.extras && typeof V3A.extras === "object" ? V3A.extras : {};
        const panels = Array.isArray(extras.panels) ? extras.panels : [];
        const out = [];

        const ai = extras.ai && typeof extras.ai === "object" ? extras.ai : {};
        const aiEnabled = Number(ai.enabled || 0) ? true : false;
        const aiFeatures = ai && typeof ai.features === "object" ? ai.features : {};
        if (aiEnabled && Number(aiFeatures.summary || 0)) {
          out.push({
            key: "extras-ai-summary",
            label: "AI摘要",
            to: "/extras/ai-summary",
            access: "contributor",
          });
        }
        if (aiEnabled && Number(aiFeatures.translate || 0)) {
          out.push({
            key: "extras-ai-translate",
            label: "AI翻译",
            to: "/extras/ai-translate",
            access: "contributor",
          });
        }

        if (extras.shouTuTaEnabled) {
          out.push({
            key: "extras-shoutu",
            label: "守兔塔",
            to: "/extras/shoutu",
            access: "administrator",
          });
        }

        // Reserved: Creative Workshop (Craft-Typecho)
        out.push({
          key: "extras-workshop",
          label: "创意工坊",
          to: "/extras/workshop",
          access: "administrator",
        });

        for (const p of panels) {
          const panel = p && typeof p === "object" ? String(p.panel || "") : "";
          if (!panel) continue;
          const title = p && typeof p === "object" ? String(p.title || p.panel || "") : panel;
          const access = p && typeof p === "object" ? String(p.access || "administrator") : "administrator";
          out.push({
            key: `extras-panel-${panel}`,
            label: title || panel,
            to: "/extras/panel",
            panel,
            access,
          });
        }

        return out;
      })(),
    },
    {
      key: "maintenance",
      label: "维护",
      icon: "maintenance",
      access: "administrator",
      children: [
        { key: "maintenance-backup", label: "备份", to: "/maintenance/backup", access: "administrator" },
        { key: "maintenance-upgrade", label: "升级", to: "/maintenance/upgrade", access: "administrator" },
      ],
    },
    { key: "about", label: "关于", icon: "info", to: "/about", access: "subscriber" },
  ];

  function v3aRouteExists(path) {
    const p = String(path || "/");
    if (p === "/settings") return true;

    for (const top of MENU) {
      if (!top) continue;
      if (top.to && top.to === p) return true;
      const children = Array.isArray(top.children) ? top.children : [];
      for (const child of children) {
        if (child && child.to === p) return true;
      }
    }

    return false;
  }

  function v3aMenuAccessForPath(path) {
    const p = String(path || "/");
    if (p === "/settings") return "subscriber";

    for (const top of MENU) {
      if (!top) continue;
      if (top.to && top.to === p) return top.access || "subscriber";
      const children = Array.isArray(top.children) ? top.children : [];
      for (const child of children) {
        if (child && child.to === p) {
          return child.access || top.access || "subscriber";
        }
      }
    }

    return "subscriber";
  }

  function v3aNormalizeRoute(routeStr) {
    const raw = String(routeStr || "/dashboard");
    const p = raw.split("?")[0] || "/";
    if (!v3aRouteExists(p)) return "/dashboard";
    const access = v3aMenuAccessForPath(p);
    if (!v3aCan(access)) return "/dashboard";
    if (!v3aAclAllowPath(p)) return "/dashboard";
    return raw;
  }

  function v3aFilterMenu(items) {
    const out = [];
    for (const item of Array.isArray(items) ? items : []) {
      if (!item) continue;

      const itemAccess = item.access || "subscriber";
      if (!v3aCan(itemAccess)) continue;

      const next = Object.assign({}, item);
      if (Array.isArray(item.children) && item.children.length) {
        const children = item.children.filter((c) => {
          if (!c) return false;
          if (!v3aCan((c && c.access) || itemAccess)) return false;
          return v3aAclAllowMenuKey(c.key);
        });
        if (!children.length) continue;
        next.children = children;
      } else if (!v3aAclAllowMenuKey(item.key)) {
        continue;
      }

      out.push(next);
    }
    return out;
  }

  function v3aFilterSettings(items) {
    const out = [];
    for (const item of Array.isArray(items) ? items : []) {
      if (!item) continue;

      const itemAccess = item.access || "subscriber";
      if (!v3aCan(itemAccess)) continue;

      const next = Object.assign({}, item);
      if (Array.isArray(item.children) && item.children.length) {
        const children = item.children.filter((c) =>
          v3aCan((c && c.access) || itemAccess)
        );
        next.children = children;
      }

      out.push(next);
    }
    return out;
  }

  function initTooltips() {
    if (window.__V3A_TOOLTIP_READY__) return;
    window.__V3A_TOOLTIP_READY__ = true;

    const tooltip = document.createElement("div");
    tooltip.className = "v3a-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.style.display = "none";
    document.body.appendChild(tooltip);

    const titleStore = new WeakMap();
    let activeEl = null;
    let observer = null;

    function readTooltipText(el) {
      return "";
    }

    function stealTitle(el) {
      if (!el) return;
      const title = el.getAttribute("title");
      if (!title) return;
      titleStore.set(el, title);
      el.removeAttribute("title");
    }

    function positionTooltip(el) {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const margin = 8;
      const offset = 10;

      const w = tooltip.offsetWidth;
      const h = tooltip.offsetHeight;
      const vw = document.documentElement.clientWidth || window.innerWidth || 0;
      const vh = document.documentElement.clientHeight || window.innerHeight || 0;

      let left = rect.left + rect.width / 2 - w / 2;
      left = Math.max(margin, Math.min(left, vw - w - margin));

      let top = rect.top - h - offset;
      if (top < margin) {
        top = rect.bottom + offset;
      }
      top = Math.max(margin, Math.min(top, vh - h - margin));

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    }

    function updateTooltip() {
      if (!activeEl) return;
      stealTitle(activeEl);
      const text = readTooltipText(activeEl);
      if (!text) {
        tooltip.classList.remove("show");
        tooltip.style.display = "none";
        return;
      }

      tooltip.textContent = text;
      tooltip.style.display = "block";
      positionTooltip(activeEl);
      tooltip.classList.add("show");
    }

    function show(el) {
      if (!el || !(el instanceof Element)) return;
      if (el === tooltip || tooltip.contains(el)) return;
      if (activeEl === el) {
        updateTooltip();
        return;
      }

      hide();
      activeEl = el;
      updateTooltip();

      observer = new MutationObserver(() => updateTooltip());
      observer.observe(el, {
        attributes: true,
        attributeFilter: ["title", "data-tooltip", "aria-label", "disabled", "aria-disabled"],
      });
    }

    function hide() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      tooltip.classList.remove("show");
      tooltip.style.display = "none";
      if (activeEl) {
        const stored = titleStore.get(activeEl);
        if (
          stored &&
          !activeEl.getAttribute("data-tooltip") &&
          !activeEl.getAttribute("title")
        ) {
          activeEl.setAttribute("title", stored);
        }
      }
      activeEl = null;
    }

    document.addEventListener(
      "pointerover",
      (e) => {
        const target = e.target && e.target.closest ? e.target.closest("[data-tooltip],[title],[aria-label]") : null;
        if (!target) return;
        show(target);
      },
      true
    );

    document.addEventListener(
      "pointerout",
      (e) => {
        if (!activeEl) return;
        const related = e.relatedTarget;
        if (related && activeEl.contains && activeEl.contains(related)) return;
        hide();
      },
      true
    );

    document.addEventListener(
      "focusin",
      (e) => {
        const target = e.target && e.target.closest ? e.target.closest("[data-tooltip],[title],[aria-label]") : null;
        if (!target) return;
        show(target);
      },
      true
    );

    document.addEventListener(
      "focusout",
      () => {
        hide();
      },
      true
    );

    document.addEventListener(
      "scroll",
      () => {
        hide();
      },
      true
    );

    window.addEventListener("resize", hide);
  }

  initTooltips();

  function formatNumber(num) {
    const n = Number(num || 0);
    return n.toLocaleString("zh-CN");
  }

  function formatTime(ts, tzSeconds) {
    const n = Number(ts || 0);
    if (!n) return "—";

    const tzRaw = Number.isFinite(Number(tzSeconds))
      ? Number(tzSeconds)
      : Number(V3A && Object.prototype.hasOwnProperty.call(V3A, "timezone") ? V3A.timezone : NaN);

    const pad = (v) => String(v).padStart(2, "0");

    if (!Number.isFinite(tzRaw)) {
      const d = new Date(n * 1000);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
        d.getDate()
      )} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    const d = new Date((n + tzRaw) * 1000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
      d.getUTCDate()
    )} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  }

  function formatTimeAgo(ts) {
    const n = Number(ts || 0);
    if (!n) return "—";

    const now = Math.floor(Date.now() / 1000);
    let diff = now - n;
    if (!Number.isFinite(diff)) return "—";
    if (diff < 0) diff = 0;

    if (diff < 60) return "刚刚";
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`;
    if (diff < 31536000) return `${Math.floor(diff / 2592000)} 个月前`;
    return `${Math.floor(diff / 31536000)} 年前`;
  }

  function formatTimeAgoFine(ts) {
    const n = Number(ts || 0);
    if (!n) return "—";

    const now = Math.floor(Date.now() / 1000);
    let diff = now - n;
    if (!Number.isFinite(diff)) return "—";
    if (diff < 0) diff = 0;

    if (diff < 3) return "刚刚";
    if (diff < 60) return `${diff} 秒前`;
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`;
    if (diff < 31536000) return `${Math.floor(diff / 2592000)} 个月前`;
    return `${Math.floor(diff / 31536000)} 年前`;
  }

  function getRoute() {
    const raw = (location.hash || "#/dashboard").replace(/^#/, "");
    return raw.startsWith("/") ? raw : "/" + raw;
  }

  function setRoute(path) {
    location.hash = "#" + path;
  }

  function findRouteTitle(routeStr, settingsOpen, settingsActiveKey) {
    const raw = String(routeStr || "/");
    const path = raw.split("?")[0] || "/";

    if (path === "/settings") {
      const item = SETTINGS.find((s) => s.key === settingsActiveKey);
      if (item) return `设定 / ${item.label}`;
      for (const top of SETTINGS) {
        const children = Array.isArray(top?.children) ? top.children : [];
        const child = children.find((c) => c && c.key === settingsActiveKey);
        if (child) return `设定 / ${top.label} / ${child.label}`;
      }
      return "设定";
    }

    if (path === "/extras/panel") {
      let panel = "";
      try {
        const idx = raw.indexOf("?");
        const qs = idx >= 0 ? raw.slice(idx + 1) : "";
        const sp = new URLSearchParams(qs);
        panel = String(sp.get("panel") || "");
      } catch (e) {}

      if (panel) {
        const extras = V3A && V3A.extras && typeof V3A.extras === "object" ? V3A.extras : {};
        const panels = Array.isArray(extras.panels) ? extras.panels : [];
        const hit = panels.find((p) => p && typeof p === "object" && String(p.panel || "") === panel);
        const title = hit ? String(hit.title || hit.panel || "") : "";
        if (title) return `额外功能 / ${title}`;
      }

      return "额外功能 / 插件面板";
    }

    if (path === "/extras/shoutu") {
      return "额外功能 / 守兔塔";
    }

    for (const top of MENU) {
      const topPath = top.to ? String(top.to).split("?")[0] : "";
      if (topPath && topPath === path) return top.label;
      if (top.children) {
        for (const child of top.children) {
          const childPath = child && child.to ? String(child.to).split("?")[0] : "";
          if (childPath && childPath === path) return `${top.label} / ${child.label}`;
        }
      }
    }
    return "Vue3Admin";
  }

  createApp({
    setup() {
      const sidebarCollapsed = ref(false);
      const settingsOpen = ref(false);
      const settingsActiveKey = ref("user");
      const settingsThemeOpen = ref(false);
      const lastThemeSettingsKey = ref("theme.activate");
      const writeSidebarOpen = ref(false);
      const permissionInfoOpen = ref(false);
      const isNarrowScreen = ref(false);
      const mobileNavOpen = ref(false);
      const mobileNavTab = ref(0);

      function setMobileNavTab(next) {
        const n = Number(next || 0);
        mobileNavTab.value = n >= 1 ? 1 : 0;
      }

      let mobileNavSwipeActive = false;
      let mobileNavSwipeStartX = 0;
      let mobileNavSwipeStartY = 0;

      function onMobileNavSwipeStart(e) {
        if (!mobileNavHasSettingsPanel.value || !mobileNavOpen.value) return;
        const t = e?.touches?.[0];
        if (!t) return;
        mobileNavSwipeActive = true;
        mobileNavSwipeStartX = t.clientX;
        mobileNavSwipeStartY = t.clientY;
      }

      function onMobileNavSwipeEnd(e) {
        if (!mobileNavSwipeActive) return;
        mobileNavSwipeActive = false;
        if (!mobileNavHasSettingsPanel.value) return;
        const t = e?.changedTouches?.[0];
        if (!t) return;
        const dx = t.clientX - mobileNavSwipeStartX;
        const dy = t.clientY - mobileNavSwipeStartY;
        if (Math.abs(dx) < 60) return;
        if (Math.abs(dx) < Math.abs(dy) * 1.2) return;
        if (dx < 0) setMobileNavTab(1);
        else setMobileNavTab(0);
      }

      function onMobileNavSwipeCancel() {
        mobileNavSwipeActive = false;
      }

      function closeMobileNav() {
        mobileNavOpen.value = false;
        setMobileNavTab(0);
      }

      function syncNarrowScreen() {
        let next = false;
        try {
          next = !!(window.matchMedia && window.matchMedia("(max-width: 48rem)").matches);
        } catch (e) {}

        if (!next) {
          try {
            next = (document.documentElement?.clientWidth || 0) <= 768;
          } catch (e) {}
        }

        if (isNarrowScreen.value !== next) {
          isNarrowScreen.value = next;
        }

        if (!next) {
          closeMobileNav();
        }
      }

      syncNarrowScreen();
      onMounted(() => {
        syncNarrowScreen();
        try {
          window.addEventListener("resize", syncNarrowScreen, { passive: true });
        } catch (e) {}
      });

      const sidebarToggleIcon = computed(() => {
        if (isNarrowScreen.value) {
          return mobileNavOpen.value ? ICONS.panelTopOpen : ICONS.panelTopClose;
        }
        return sidebarCollapsed.value ? ICONS.expand : ICONS.collapse;
      });

      const sidebarToggleTitle = computed(() => {
        if (isNarrowScreen.value) {
          return mobileNavOpen.value ? "收起菜单" : "拉起菜单";
        }
        return sidebarCollapsed.value ? "展开" : "收起";
      });

      function openPermissionInfo() {
        permissionInfoOpen.value = true;
      }

      function closePermissionInfo() {
        permissionInfoOpen.value = false;
      }

      const isThemeSettingsActive = computed(() =>
        String(settingsActiveKey.value || "").startsWith("theme.")
      );

      function normalizeSettingsKey(key) {
        const k = String(key || "");
        if (!k) return "";
        if (k === "theme") return "theme.activate";
        return k;
      }

      const menuItems = computed(() => v3aFilterMenu(MENU));
      const settingsItems = computed(() => v3aFilterSettings(SETTINGS));
      const mobileNavHasSettingsPanel = computed(
        () => isNarrowScreen.value && settingsOpen.value && (settingsItems.value || []).length > 0
      );

      function settingsKeyExists(key) {
        const k = normalizeSettingsKey(key);
        if (!k) return false;
        for (const top of settingsItems.value) {
          if (top && top.key === k) return true;
          const children = Array.isArray(top?.children) ? top.children : [];
          if (children.some((c) => c && c.key === k)) return true;
        }
        return false;
      }

      const expanded = ref({
        posts: true,
        pages: false,
        extras: false,
        maintenance: false,
      });

      const route = ref(v3aNormalizeRoute(getRoute()));
      const routePath = computed(() => {
        const raw = String(route.value || "/");
        return raw.split("?")[0] || "/";
      });
      const routeQuery = computed(() => {
        const raw = String(route.value || "");
        const idx = raw.indexOf("?");
        if (idx < 0) return {};
        const qs = raw.slice(idx + 1);
        const out = {};
        try {
          const sp = new URLSearchParams(qs);
          for (const [k, v] of sp.entries()) {
            out[k] = v;
          }
        } catch (e) {}
        return out;
      });

      // Extras (plugin panels / reserved pages)
      const extrasPanelIframe = ref(null);
      const extrasPanelUrl = computed(() => {
        const panel = String(routeQuery.value.panel || "");
        if (!panel) return "";

        try {
          const base = String(V3A.adminUrl || "").trim();
          const adminBase = base ? new URL(base, location.href) : new URL(".", location.href);
          const url = new URL("extending.php", adminBase);
          url.searchParams.set("panel", panel);
          return url.toString();
        } catch (e) {
          const base = String(location.href || "").split("#")[0];
          const dir = base.replace(/[^/]*$/, "");
          return dir + "extending.php?panel=" + encodeURIComponent(panel);
        }
      });

      function styleExtrasPanelIframe() {
        const el = extrasPanelIframe.value;
        if (!el) return;
        try {
          const doc = el.contentDocument;
          if (!doc) return;
          const id = "__v3a_extras_panel_style__";
          if (doc.getElementById(id)) return;
          const style = doc.createElement("style");
          style.id = id;
          style.textContent = `
            header.typecho-head-nav { display: none !important; }
            body { padding: 12px !important; background: transparent !important; }
            html { background: transparent !important; }
          `;
          (doc.head || doc.documentElement).appendChild(style);
        } catch (e) {}
      }

      function resizeExtrasPanelIframe() {
        const el = extrasPanelIframe.value;
        if (!el) return;
        try {
          const doc = el.contentDocument;
          if (!doc || !doc.body) return;
          const h = Math.max(240, doc.body.scrollHeight || 0);
          el.style.height = `${h}px`;
        } catch (e) {}
      }

      function onExtrasPanelIframeLoad() {
        styleExtrasPanelIframe();
        resizeExtrasPanelIframe();
        setTimeout(resizeExtrasPanelIframe, 60);
        setTimeout(resizeExtrasPanelIframe, 300);
        setTimeout(resizeExtrasPanelIframe, 1000);
      }

      function reloadExtrasPanelIframe() {
        const el = extrasPanelIframe.value;
        if (!el) return;
        try {
          if (el.contentWindow && el.contentWindow.location) {
            el.contentWindow.location.reload();
            return;
          }
        } catch (e) {}

        try {
          if (extrasPanelUrl.value) el.src = extrasPanelUrl.value;
        } catch (e) {}
      }

      watch(
        () => extrasPanelUrl.value,
        async () => {
          await nextTick();
          setTimeout(resizeExtrasPanelIframe, 30);
          setTimeout(resizeExtrasPanelIframe, 300);
          setTimeout(resizeExtrasPanelIframe, 1000);
        }
      );

      // Creative Workshop (Craft-Typecho)
      const workshopRepoUrl = "https://github.com/TGU-HansJack/Craft-Typecho";
      const workshopListUrl = "https://github.com/TGU-HansJack/Craft-Typecho/repo.json";
      const workshopLoginUrl = "https://github.com/login";

      const workshopLoading = ref(false);
      const workshopError = ref("");
      const workshopItems = ref([]);
      const workshopMeta = ref({});
      const workshopInstallingId = ref("");
      const workshopSearch = ref("");
      const workshopTypeFilter = ref("all");
      const workshopFilteredItems = computed(() => {
        const items = Array.isArray(workshopItems.value) ? workshopItems.value : [];
        const q = String(workshopSearch.value || "").trim().toLowerCase();
        const t = String(workshopTypeFilter.value || "all").trim().toLowerCase();

        return items.filter((row) => {
          if (!row || typeof row !== "object") return false;
          if (t && t !== "all" && String(row.type || "").toLowerCase() !== t) return false;
          if (!q) return true;

          const hay = [
            row.name,
            row.description,
            row.author,
            row.type,
            row.link,
            row.version,
            row.dir,
          ]
            .map((v) => String(v || "").toLowerCase())
            .join(" ");
          return hay.includes(q);
        });
      });

      function applyWorkshopFilters() {
        workshopSearch.value = String(workshopSearch.value || "").trim();
      }

      function workshopTypeLabel(type) {
        const t = String(type || "").toLowerCase();
        if (t === "plugin") return "插件";
        if (t === "theme") return "主题";
        if (!t) return "—";
        return t;
      }

      function workshopTypeTone(type) {
        const t = String(type || "").toLowerCase();
        if (t === "plugin") return "info";
        if (t === "theme") return "success";
        return "";
      }

      function workshopTypechoText(v) {
        if (v === null || v === undefined) return "";
        if (Array.isArray(v)) {
          return v
            .map((x) => String(x || "").trim())
            .filter(Boolean)
            .join(", ");
        }
        if (typeof v === "object") {
          const min = String(v.min || v.from || "").trim();
          const max = String(v.max || v.to || "").trim();
          if (min && max) return `${min} - ${max}`;
          if (min) return `>= ${min}`;
          if (max) return `<= ${max}`;
          return String(v.range || v.text || "").trim();
        }
        return String(v || "").trim();
      }

      async function fetchWorkshopProjects(force) {
        if (workshopLoading.value) return;
        workshopLoading.value = true;
        workshopError.value = "";
        try {
          const data = await apiGet("workshop.list", { force: force ? 1 : 0 });
          workshopItems.value = data && Array.isArray(data.items) ? data.items : [];
          workshopMeta.value = data && data.meta && typeof data.meta === "object" ? data.meta : {};
        } catch (e) {
          workshopError.value = e && e.message ? e.message : "加载失败";
        } finally {
          workshopLoading.value = false;
        }
      }

      async function installWorkshopProject(row) {
        const item = row && typeof row === "object" ? row : null;
        if (!item) return;
        if (!item.canInstall) return;
        if (workshopInstallingId.value) return;

        const id = String(item.id || item.name || item.link || "");
        const name = String(item.name || "").trim() || "该项目";
        const installed = !!item.installed;
        const ok = installed
          ? confirm(`已检测到“${name}”可能已安装，是否覆盖安装？`)
          : confirm(`确认安装“${name}”？`);
        if (!ok) return;

        workshopInstallingId.value = id;
        try {
          await apiPost("workshop.install", {
            id: item.id || "",
            type: item.type || "",
            link: item.link || "",
            branch: item.branch || "",
            subdir: item.subdir || "",
            dir: item.dir || "",
            overwrite: installed ? 1 : 0,
          });
          toastSuccess("安装完成");
          await fetchWorkshopProjects(true);
        } catch (e) {
          toastError(e && e.message ? e.message : "安装失败");
        } finally {
          workshopInstallingId.value = "";
        }
      }

      const shouTuTaEnabled = computed(() => !!(V3A && V3A.extras && V3A.extras.shouTuTaEnabled));
      const shouTuTaLoading = ref(false);
      const shouTuTaError = ref("");
      const shouTuTaStats = ref({
        total_blocks: 0,
        cc_blocks: 0,
        sqli_blocks: 0,
        xss_blocks: 0,
        file_inclusion_blocks: 0,
        php_code_blocks: 0,
      });
      const shouTuTaLists = ref({ whitelist: 0, banlist: 0, cidr: 0 });
      const shouTuTaBanLog = ref([]);
      const shouTuTaGlobalWhitelist = ref([]);
      const shouTuTaCidrItems = ref([]);
      const shouTuTaUpdatedAt = ref(0);
      const shouTuTaAnalyticsEnabled = ref(0);
      const shouTuTaAnalyticsAvailable = ref(0);
      const shouTuTaVisitToday = ref({ requests: 0, uv: 0 });
      const shouTuTaVisitYesterday = ref({ requests: 0, uv: 0 });
      const shouTuTaTopPages = ref([]);
      const shouTuTaTopIps = ref([]);
      const shouTuTaTrend24h = ref([]);
      const shouTuTaTrendMax = computed(() => {
        const rows = Array.isArray(shouTuTaTrend24h.value) ? shouTuTaTrend24h.value : [];
        let max = 0;
        for (const r of rows) {
          max = Math.max(max, Number(r && r.count ? r.count : 0) || 0);
        }
        return max || 1;
      });
      const shouTuTaLogs = ref([]);
      const shouTuTaLastId = ref(0);
      const shouTuTaThreatTop = ref([]);

      const shouTuTaActing = ref(false);
      const shouTuTaStreamPaused = ref(false);
      const shouTuTaIpQuery = ref("");
      const shouTuTaPurgeIpInput = ref("");
      const shouTuTaIpModalOpen = ref(false);
      const shouTuTaIpModalIp = ref("");
      const shouTuTaIpModalLoading = ref(false);
      const shouTuTaIpModalLogs = ref([]);
      const shouTuTaIpModalAbuse = ref(null);
      const shouTuTaIpModalAbuseLoading = ref(false);

      const shouTuTaGlobalWhitelistOpen = ref(false);
      const shouTuTaGlobalWhitelistForm = reactive({ ip: "", remark: "" });
      const shouTuTaCidrOpen = ref(false);
      const shouTuTaCidrList = ref("");

      let shouTuTaPollTimer = null;

      async function fetchShouTuTaStats() {
        if (!shouTuTaEnabled.value) {
          shouTuTaError.value = "插件未启用";
          return;
        }
        if (shouTuTaLoading.value) return;

        shouTuTaLoading.value = true;
        shouTuTaError.value = "";
        try {
          const data = await apiGet("shoutu.stats");
          const stats = data && typeof data === "object" && data.stats && typeof data.stats === "object" ? data.stats : {};
          shouTuTaStats.value = Object.assign({}, shouTuTaStats.value, stats);

          const lists = data && typeof data === "object" && data.lists && typeof data.lists === "object" ? data.lists : {};
          shouTuTaLists.value = Object.assign({}, shouTuTaLists.value, lists);

          shouTuTaBanLog.value = data && typeof data === "object" && Array.isArray(data.banLog) ? data.banLog.map(String) : [];
          shouTuTaUpdatedAt.value = Number(data && typeof data === "object" ? data.updatedAt : 0) || 0;

          const globalWhitelist = data && typeof data === "object" && Array.isArray(data.globalWhitelist) ? data.globalWhitelist : [];
          shouTuTaGlobalWhitelist.value = globalWhitelist
            .map((v) => ({
              ip: String(v && typeof v === "object" ? v.ip || "" : "").trim(),
              remark: String(v && typeof v === "object" ? v.remark || "" : "").trim(),
            }))
            .filter((v) => !!v.ip);

          shouTuTaCidrItems.value = data && typeof data === "object" && Array.isArray(data.cidrList) ? data.cidrList.map((v) => String(v || "").trim()).filter(Boolean) : [];

          const analytics = data && typeof data === "object" && data.analytics && typeof data.analytics === "object" ? data.analytics : null;
          shouTuTaAnalyticsEnabled.value = analytics ? Number(analytics.enabled || 0) : 0;
          shouTuTaAnalyticsAvailable.value = analytics ? Number(analytics.available || 0) : 0;
          shouTuTaVisitToday.value = analytics && analytics.today ? { requests: Number(analytics.today.requests || 0) || 0, uv: Number(analytics.today.uv || 0) || 0 } : { requests: 0, uv: 0 };
          shouTuTaVisitYesterday.value = analytics && analytics.yesterday ? { requests: Number(analytics.yesterday.requests || 0) || 0, uv: Number(analytics.yesterday.uv || 0) || 0 } : { requests: 0, uv: 0 };
          shouTuTaTopPages.value = analytics && Array.isArray(analytics.topPages) ? analytics.topPages : [];
          shouTuTaTopIps.value = analytics && Array.isArray(analytics.topIps) ? analytics.topIps : [];
          shouTuTaTrend24h.value = analytics && Array.isArray(analytics.trend24h) ? analytics.trend24h : [];
          shouTuTaLogs.value = analytics && Array.isArray(analytics.logs) ? analytics.logs : [];
          shouTuTaLastId.value = analytics ? Number(analytics.lastId || 0) || 0 : 0;
          shouTuTaThreatTop.value = analytics && Array.isArray(analytics.threatTop) ? analytics.threatTop : [];
        } catch (e) {
          shouTuTaError.value = e && e.message ? e.message : "加载失败";
        } finally {
          shouTuTaLoading.value = false;
        }
      }

      async function fetchShouTuTaLogsSince() {
        if (!shouTuTaEnabled.value) return;
        if (!shouTuTaAnalyticsAvailable.value) return;
        const lastId = Number(shouTuTaLastId.value || 0) || 0;

        try {
          const data = await apiGet("shoutu.logs.since", { last_id: lastId });
          const logs = data && typeof data === "object" && Array.isArray(data.logs) ? data.logs : [];
          const nextLastId = data && typeof data === "object" ? Number(data.lastId || 0) || 0 : lastId;
          if (!logs.length) {
            shouTuTaLastId.value = Math.max(shouTuTaLastId.value, nextLastId);
            return;
          }

          const merged = shouTuTaLogs.value.concat(logs);
          shouTuTaLogs.value = merged.length > 200 ? merged.slice(merged.length - 200) : merged;
          shouTuTaLastId.value = Math.max(shouTuTaLastId.value, nextLastId);
        } catch (e) {}
      }

      function stopShouTuTaPolling() {
        if (shouTuTaPollTimer) {
          clearInterval(shouTuTaPollTimer);
          shouTuTaPollTimer = null;
        }
      }

      function startShouTuTaPolling() {
        if (shouTuTaPollTimer) return;
        if (routePath.value !== "/extras/shoutu") return;
        if (!shouTuTaEnabled.value) return;
        if (!shouTuTaAnalyticsAvailable.value) return;
        if (shouTuTaStreamPaused.value) return;

        shouTuTaPollTimer = setInterval(() => {
          if (routePath.value !== "/extras/shoutu") {
            stopShouTuTaPolling();
            return;
          }
          fetchShouTuTaLogsSince();
        }, 5000);
      }

      async function openShouTuTaIpModal(ip) {
        const v = String(ip || "").trim();
        if (!v) return;
        shouTuTaIpModalIp.value = v;
        shouTuTaIpModalOpen.value = true;
        shouTuTaIpModalLogs.value = [];
        shouTuTaIpModalAbuse.value = null;
        shouTuTaIpModalAbuseLoading.value = false;

        if (!shouTuTaEnabled.value || !shouTuTaAnalyticsAvailable.value) return;

        shouTuTaIpModalLoading.value = true;
        try {
          const data = await apiGet("shoutu.ip.logs", { ip: v });
          shouTuTaIpModalLogs.value = data && typeof data === "object" && Array.isArray(data.logs) ? data.logs : [];
        } catch (e) {
          toastError(e && e.message ? e.message : "加载失败");
        } finally {
          shouTuTaIpModalLoading.value = false;
        }
      }

      function closeShouTuTaIpModal() {
        shouTuTaIpModalOpen.value = false;
        shouTuTaIpModalLoading.value = false;
        shouTuTaIpModalIp.value = "";
        shouTuTaIpModalLogs.value = [];
        shouTuTaIpModalAbuse.value = null;
        shouTuTaIpModalAbuseLoading.value = false;
      }

      async function shouTuTaCheckAbuseIpdb(ip) {
        const v = String(ip || "").trim();
        if (!v) return;
        shouTuTaIpModalAbuseLoading.value = true;
        try {
          const data = await apiGet("shoutu.abuseipdb.check", { ip: v });
          shouTuTaIpModalAbuse.value = data && typeof data === "object" ? data : null;
        } catch (e) {
          toastError(e && e.message ? e.message : "查询失败");
        } finally {
          shouTuTaIpModalAbuseLoading.value = false;
        }
      }

      async function shouTuTaUnblock(ip) {
        const v = String(ip || "").trim();
        if (!v || shouTuTaActing.value) return;
        if (!confirm(`确认解除拦截：${v} ?`)) return;
        shouTuTaActing.value = true;
        try {
          await apiPost("shoutu.unblock", { ip: v });
          toastSuccess("已解除拦截");
          await fetchShouTuTaStats();
        } catch (e) {
          toastError(e && e.message ? e.message : "操作失败");
        } finally {
          shouTuTaActing.value = false;
        }
      }

      async function shouTuTaWhitelistAdd(ip) {
        const v = String(ip || "").trim();
        if (!v || shouTuTaActing.value) return;
        if (!confirm(`确认加入白名单：${v} ?`)) return;
        shouTuTaActing.value = true;
        try {
          await apiPost("shoutu.whitelist.add", { ip: v });
          toastSuccess("已加入白名单");
          await fetchShouTuTaStats();
        } catch (e) {
          toastError(e && e.message ? e.message : "操作失败");
        } finally {
          shouTuTaActing.value = false;
        }
      }

      async function shouTuTaPermBan(ip) {
        const v = String(ip || "").trim();
        if (!v || shouTuTaActing.value) return;
        if (!confirm(`警告：确认永久封禁：${v} ?`)) return;
        shouTuTaActing.value = true;
        try {
          await apiPost("shoutu.ban.perm", { ip: v });
          toastSuccess("已永久封禁");
          await fetchShouTuTaStats();
        } catch (e) {
          toastError(e && e.message ? e.message : "操作失败");
        } finally {
          shouTuTaActing.value = false;
        }
      }

      function openShouTuTaGlobalWhitelist() {
        shouTuTaGlobalWhitelistForm.ip = shouTuTaIpModalIp.value || "";
        shouTuTaGlobalWhitelistForm.remark = "";
        shouTuTaGlobalWhitelistOpen.value = true;
      }

      function closeShouTuTaGlobalWhitelist() {
        shouTuTaGlobalWhitelistOpen.value = false;
      }

      async function submitShouTuTaGlobalWhitelist() {
        if (shouTuTaActing.value) return;
        const ip = String(shouTuTaGlobalWhitelistForm.ip || "").trim();
        const remark = String(shouTuTaGlobalWhitelistForm.remark || "").trim();
        if (!ip) {
          toastError("请输入IP");
          return;
        }
        shouTuTaActing.value = true;
        try {
          await apiPost("shoutu.globalWhitelist.add", { ip, remark });
          toastSuccess("已添加全局白名单");
          shouTuTaGlobalWhitelistOpen.value = false;
          await fetchShouTuTaStats();
        } catch (e) {
          toastError(e && e.message ? e.message : "操作失败");
        } finally {
          shouTuTaActing.value = false;
        }
      }

      function openShouTuTaCidr() {
        shouTuTaCidrList.value = "";
        shouTuTaCidrOpen.value = true;
      }

      function closeShouTuTaCidr() {
        shouTuTaCidrOpen.value = false;
      }

      async function submitShouTuTaCidr() {
        if (shouTuTaActing.value) return;
        const list = String(shouTuTaCidrList.value || "").trim();
        if (!list) {
          toastError("请输入IP或CIDR");
          return;
        }
        shouTuTaActing.value = true;
        try {
          const res = await apiPost("shoutu.cidr.add", { cidr_list: list });
          toastSuccess(`已添加 ${Number(res?.added || 0) || 0} 条`);
          shouTuTaCidrOpen.value = false;
          await fetchShouTuTaStats();
        } catch (e) {
          toastError(e && e.message ? e.message : "操作失败");
        } finally {
          shouTuTaActing.value = false;
        }
      }

      function submitShouTuTaIpQuery() {
        const v = String(shouTuTaIpQuery.value || "").trim();
        if (!v) return;
        openShouTuTaIpModal(v);
      }

      function toggleShouTuTaStream() {
        if (shouTuTaStreamPaused.value) {
          shouTuTaStreamPaused.value = false;
          startShouTuTaPolling();
        } else {
          shouTuTaStreamPaused.value = true;
          stopShouTuTaPolling();
        }
      }

      function shouTuTaStatusTone(code) {
        const c = Number(code || 0) || 0;
        if (c === 403) return "danger";
        if (c === 418) return "warn";
        if (c === 503) return "warn";
        if (c >= 400) return "danger";
        return "success";
      }

      function shouTuTaStatusText(code) {
        const c = Number(code || 0) || 0;
        if (c === 403) return "拦截";
        if (c === 418) return "边缘";
        if (c === 503) return "维护";
        if (!c) return "—";
        if (c >= 200 && c < 400) return "正常";
        return String(c);
      }

      async function shouTuTaGlobalWhitelistRemove(ip) {
        const v = String(ip || "").trim();
        if (!v || shouTuTaActing.value) return;
        if (!confirm(`确定从全局白名单中移除：${v} ?`)) return;
        shouTuTaActing.value = true;
        try {
          await apiPost("shoutu.globalWhitelist.remove", { ip: v });
          toastSuccess("已移除");
          await fetchShouTuTaStats();
        } catch (e) {
          toastError(e && e.message ? e.message : "操作失败");
        } finally {
          shouTuTaActing.value = false;
        }
      }

      async function shouTuTaPurgeIp(ip) {
        const v = String(ip || "").trim();
        if (!v || shouTuTaActing.value) return;
        if (!confirm(`警告：该操作不可逆，将彻底清除 IP: ${v} 的相关数据。\n确认继续？`)) return;
        shouTuTaActing.value = true;
        try {
          await apiPost("shoutu.purge_ip", { ip: v });
          toastSuccess("已清除");
          if (String(shouTuTaPurgeIpInput.value || "").trim() === v) {
            shouTuTaPurgeIpInput.value = "";
          }
          if (String(shouTuTaIpModalIp.value || "").trim() === v) {
            closeShouTuTaIpModal();
          }
          await fetchShouTuTaStats();
        } catch (e) {
          toastError(e && e.message ? e.message : "操作失败");
        } finally {
          shouTuTaActing.value = false;
        }
      }

      function openShouTuTaSettings() {
        openPluginConfig({ name: "ShouTuTa", title: "守兔塔" });
      }

      const jsonExample = '{"a":1}';

      // Toasts (mx-admin like / sonner style)
      const toasts = ref([]);
      let toastSeq = 1;
      const toastTimers = new Map();

      function toastIcon(type) {
        if (type === "success") return ICONS.toastSuccess;
        if (type === "warn") return ICONS.toastWarn;
        if (type === "error") return ICONS.toastError;
        return ICONS.toastInfo;
      }

      function clearToastTimer(id) {
        const t = toastTimers.get(id);
        if (!t) return;
        clearTimeout(t);
        toastTimers.delete(id);
      }

      function dismissToast(id) {
        clearToastTimer(id);
        const idx = toasts.value.findIndex((t) => t.id === id);
        if (idx >= 0) toasts.value.splice(idx, 1);
      }

      function pushToast(opts) {
        const o = opts && typeof opts === "object" ? opts : {};
        const id = toastSeq++;
        const item = {
          id,
          type: String(o.type || "info"),
          title: String(o.title || ""),
          description: o.description ? String(o.description) : "",
          actionLabel: o.actionLabel ? String(o.actionLabel) : "",
          action: typeof o.action === "function" ? o.action : null,
          duration: Number.isFinite(Number(o.duration))
            ? Number(o.duration)
            : 3000,
          dismissible: o.dismissible !== false,
        };

        if (toasts.value.length >= 5) {
          const removed = toasts.value.shift();
          if (removed) clearToastTimer(removed.id);
        }

        toasts.value.push(item);

        if (item.duration > 0) {
          const timer = setTimeout(() => dismissToast(id), item.duration);
          toastTimers.set(id, timer);
        }

        return id;
      }

      function runToastAction(t) {
        if (!t) return;
        try {
          if (typeof t.action === "function") t.action();
        } finally {
          dismissToast(t.id);
        }
      }

      function toastInfo(title, opts) {
        return pushToast(Object.assign({}, opts || {}, { type: "info", title }));
      }

      function toastSuccess(title, opts) {
        return pushToast(Object.assign({}, opts || {}, { type: "success", title }));
      }

      function toastWarn(title, opts) {
        return pushToast(Object.assign({}, opts || {}, { type: "warn", title }));
      }

      function toastError(title, opts) {
        return pushToast(Object.assign({}, opts || {}, { type: "error", title }));
      }

      function v3aParseCookies() {
        const out = {};
        const raw = String(document.cookie || "");
        if (!raw) return out;
        const pairs = raw.split(";");
        for (const pair of pairs) {
          if (!pair) continue;
          const idx = pair.indexOf("=");
          if (idx <= 0) continue;
          const name = pair.slice(0, idx).trim();
          const value = pair.slice(idx + 1).trim();
          if (!name) continue;
          out[name] = value;
        }
        return out;
      }

      function v3aDecodeCookieValue(value) {
        const raw = String(value || "");
        if (!raw) return "";
        try {
          return decodeURIComponent(raw);
        } catch (e) {
          return raw;
        }
      }

      function v3aCookieDeletePaths() {
        const paths = new Set(["/"]);
        try {
          const adminPath = String(new URL(String(V3A.adminUrl || "/"), location.href).pathname || "/");
          if (adminPath) {
            paths.add(adminPath);
            paths.add(adminPath.endsWith("/") ? adminPath.slice(0, -1) : adminPath + "/");
          }
        } catch (e) {}
        try {
          const current = String(location.pathname || "/");
          if (current) {
            paths.add(current);
            const slash = current.lastIndexOf("/");
            if (slash > 0) {
              paths.add(current.slice(0, slash + 1));
            }
          }
        } catch (e) {}
        return Array.from(paths).filter(Boolean);
      }

      function v3aDeleteCookie(name) {
        const n = String(name || "").trim();
        if (!n) return;
        const expires = "Thu, 01 Jan 1970 00:00:00 GMT";
        for (const path of v3aCookieDeletePaths()) {
          document.cookie = `${n}=; expires=${expires}; path=${path}; SameSite=Lax`;
        }
      }

      function v3aStripHtml(input) {
        return String(input || "").replace(/<[^>]*>/g, "");
      }

      function v3aIsRegisterNoticeMessage(message) {
        const s = String(message || "");
        return /成功注册/.test(s) && /密码/.test(s);
      }

      function consumeLegacyNoticeCookies() {
        const cookies = v3aParseCookies();
        const entries = Object.entries(cookies);
        if (!entries.length) return;

        const noticeEntry = entries.find(([name]) => name.endsWith("__typecho_notice"));
        if (!noticeEntry) return;
        const typeEntry = entries.find(([name]) => name.endsWith("__typecho_notice_type"));

        const noticeName = noticeEntry[0];
        const noticeTypeName = typeEntry ? typeEntry[0] : "";
        const noticeRaw = v3aDecodeCookieValue(noticeEntry[1]);
        const noticeTypeRaw = v3aDecodeCookieValue(typeEntry ? typeEntry[1] : "").toLowerCase();

        let messages = [];
        try {
          const parsed = JSON.parse(noticeRaw);
          if (Array.isArray(parsed)) {
            messages = parsed;
          } else if (parsed !== null && parsed !== undefined) {
            messages = [parsed];
          }
        } catch (e) {
          if (noticeRaw) messages = [noticeRaw];
        }

        const normalizedMessages = messages
          .map((item) => v3aStripHtml(String(item || "")).replace(/\s+/g, " ").trim())
          .filter(Boolean);

        if (normalizedMessages.length) {
          const toastType =
            noticeTypeRaw === "success"
              ? "success"
              : noticeTypeRaw === "error"
              ? "error"
              : "warn";
          for (const message of normalizedMessages) {
            if (v3aIsRegisterNoticeMessage(message)) continue;
            pushToast({ type: toastType, title: message, duration: 9000 });
          }
        }

        v3aDeleteCookie(noticeName);
        if (noticeTypeName) v3aDeleteCookie(noticeTypeName);
      }

      const registerFlash = ref(null);
      const registerFlashOpen = ref(false);
      try {
        const raw = V3A && V3A.registerFlash && typeof V3A.registerFlash === "object"
          ? V3A.registerFlash
          : null;
        const name = raw ? String(raw.name || "").trim() : "";
        const mail = raw ? String(raw.mail || "").trim() : "";
        const password = raw ? String(raw.password || "") : "";
        const time = raw ? Number(raw.time || 0) || 0 : 0;
        if (name && password) {
          registerFlash.value = { name, mail, password, time };
          registerFlashOpen.value = true;
        }
      } catch (e) {}

      function closeRegisterFlash() {
        registerFlashOpen.value = false;
      }

      // Persisted UI state (mx-admin like)
      try {
        sidebarCollapsed.value =
          localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === "1";
      } catch (e) {}

      try {
        const raw = localStorage.getItem(STORAGE_KEYS.settingsKey);
        const key = normalizeSettingsKey(raw);
        if (key && settingsKeyExists(key)) {
          settingsActiveKey.value = key;
        }
      } catch (e) {}

      try {
        const raw = localStorage.getItem(STORAGE_KEYS.sidebarExpanded);
        const obj = raw ? JSON.parse(raw) : null;
        if (obj && typeof obj === "object") {
          expanded.value.posts = !!obj.posts;
          expanded.value.pages = !!obj.pages;
          expanded.value.extras = !!obj.extras;
          expanded.value.maintenance = !!obj.maintenance;
        }
      } catch (e) {}

      // Theme mode: system / light / dark
      const themeMode = ref("system");
      function normalizeThemeMode(raw) {
        const v = String(raw || "")
          .trim()
          .toLowerCase();
        if (v === "dark" || v === "night") return "dark";
        if (v === "light" || v === "day") return "light";
        if (v === "system" || v === "auto" || v === "browser" || v === "follow") return "system";
        return "system";
      }

      const themeEffective = computed(() => {
        const mode = String(themeMode.value || "system");
        if (mode === "dark" || mode === "light") return mode;
        let prefersDark = false;
        try {
          prefersDark = !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
        } catch (e) {}
        return prefersDark ? "dark" : "light";
      });

      let themeRefreshTimer = null;
      function scheduleThemeRefresh() {
        try {
          if (themeRefreshTimer) clearTimeout(themeRefreshTimer);
        } catch (e) {}
        themeRefreshTimer = setTimeout(async () => {
          themeRefreshTimer = null;
          const p = String(route.value || "/").split("?")[0] || "/";

          try {
            if (p === "/dashboard") {
              await nextTick();
              renderCharts();
            }
          } catch (e) {}

          try {
            if (p === "/posts/write" && postVditor) {
              const value = String(postForm.text || "");
              destroyPostVditor();
              await nextTick();
              initPostVditor();
              setTimeout(() => setPostEditorValue(value, true), 0);
              v3aUpdateVditorToolbarStickyTop();
            }
          } catch (e) {}

          try {
            if (p === "/pages/edit" && pageVditor) {
              const value = String(pageForm.text || "");
              destroyPageVditor();
              await nextTick();
              initPageVditor();
              setTimeout(() => setPageEditorValue(value, true), 0);
              v3aUpdateVditorToolbarStickyTop();
            }
          } catch (e) {}
        }, 0);
      }

      let themeEffectiveApplied = "";
      let themeBooted = false;
      onMounted(() => {
        themeBooted = true;
      });

      function applyThemeMode() {
        try {
          const root = document && document.documentElement;
          if (!root || !root.classList) return;
          const eff = String(themeEffective.value || "light");
          root.classList.toggle("dark", eff === "dark");
          root.dataset.v3aThemeMode = String(themeMode.value || "system");
          if (eff !== themeEffectiveApplied) {
            themeEffectiveApplied = eff;
            if (themeBooted) scheduleThemeRefresh();
          }
        } catch (e) {}
      }

      function setThemeMode(next) {
        themeMode.value = normalizeThemeMode(next);
        try {
          localStorage.setItem(STORAGE_KEYS.themeMode, themeMode.value);
        } catch (e) {}
        applyThemeMode();
      }

      function cycleThemeMode() {
        const cur = String(themeMode.value || "system");
        if (cur === "system") return setThemeMode("light");
        if (cur === "light") return setThemeMode("dark");
        return setThemeMode("system");
      }

      const themeToggleIcon = computed(() => {
        const cur = String(themeMode.value || "system");
        if (cur === "dark") return ICONS.moon || ICONS.monitor;
        if (cur === "light") return ICONS.sun || ICONS.monitor;
        return ICONS.monitorSmartphone || ICONS.monitor;
      });

      const themeToggleTitle = computed(() => {
        const cur = String(themeMode.value || "system");
        if (cur === "dark") return "主题：夜间（点击切换）";
        if (cur === "light") return "主题：日间（点击切换）";
        return "主题：跟随浏览器（点击切换）";
      });

      try {
        themeMode.value = normalizeThemeMode(localStorage.getItem(STORAGE_KEYS.themeMode));
      } catch (e) {}
      applyThemeMode();

      try {
        const mq = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
        if (mq) {
          const handler = () => {
            if (String(themeMode.value || "system") !== "system") return;
            applyThemeMode();
          };
          if (typeof mq.addEventListener === "function") mq.addEventListener("change", handler);
          else if (typeof mq.addListener === "function") mq.addListener(handler);
        }
      } catch (e) {}

      settingsThemeOpen.value = isThemeSettingsActive.value;
      if (isThemeSettingsActive.value) {
        lastThemeSettingsKey.value = String(settingsActiveKey.value || "theme.activate");
      }

      watch(
        () => settingsActiveKey.value,
        (v) => {
          const key = String(v || "");
          if (key.startsWith("theme.")) {
            settingsThemeOpen.value = true;
            lastThemeSettingsKey.value = key;
          } else {
            settingsThemeOpen.value = false;
          }
        }
      );

      function persistExpanded() {
        try {
          localStorage.setItem(
            STORAGE_KEYS.sidebarExpanded,
            JSON.stringify(expanded.value)
          );
        } catch (e) {}
      }

      function ensureExpandedForRoute(path) {
        if (path.startsWith("/posts/")) expanded.value.posts = true;
        if (path.startsWith("/pages/")) expanded.value.pages = true;
        if (path.startsWith("/extras/")) expanded.value.extras = true;
        if (path.startsWith("/maintenance/")) expanded.value.maintenance = true;
      }

      const frontendUrl = computed(() => String(V3A.siteUrl || "").trim() || "/");

      // Step-by-step tours
      const TOURS = {
        dashboard: {
          storageKey: STORAGE_KEYS.dashboardTourDone,
          steps: [
            {
              route: "/dashboard",
              selector: "[data-tour='sidebar']",
              title: "侧边栏导航",
              description: "这里是后台主要入口，可快速切换到博文、页面、评论与设定等功能。",
            },
            {
              route: "/dashboard",
              selector: "[data-tour='dash-realtime']",
              title: "实时数据",
              description: "查看当前在线、今日访客、今日最高在线等实时指标，快速掌握站点状态。",
            },
            {
              route: "/dashboard",
              selector: "[data-tour='dash-quick']",
              title: "快速操作",
              description: "常用功能一键直达：撰写/管理博文与页面，处理评论等。",
            },
            {
              route: "/dashboard",
              selector: "[data-tour='dash-metrics']",
              title: "数据统计",
              description: "网站核心统计汇总；点击卡片可跳转到对应管理页面。",
            },
            {
              route: "/dashboard",
              selector: "[data-tour='dash-actions']",
              title: "右侧快捷按钮",
              description: "随时打开使用教程、进入前台查看站点，或退出登录。",
            },
          ],
        },
        main: {
          storageKey: STORAGE_KEYS.mainTourDone,
          steps: [
            {
              route: "/dashboard",
              selector: "[data-tour='sidebar']",
              title: "侧边栏导航",
              description: "从这里进入各模块；建议先熟悉整体结构再深入具体页面。",
            },
            {
              route: "/dashboard",
              selector: "[data-tour='menu-dashboard']",
              title: "仪表盘入口",
              description: "汇总关键指标与快捷操作，适合每日打开快速巡检。",
            },
            {
              route: "/dashboard",
              selector: "[data-tour='dash-realtime']",
              title: "实时数据",
              description: "查看在线、今日访客、最高在线等实时指标，快速掌握站点状态。",
            },
            {
              route: "/dashboard",
              selector: "[data-tour='dash-quick']",
              title: "快速操作",
              description: "常用入口一键直达：撰写/管理博文与页面，处理评论等。",
            },
            {
              route: "/dashboard",
              selector: "[data-tour='dash-metrics']",
              title: "数据统计",
              description: "网站核心统计汇总；点击卡片可跳转到对应管理页面。",
            },
            {
              route: "/dashboard",
              selector: "[data-tour='dash-actions']",
              title: "右侧快捷按钮",
              description: "手动启动引导、进入前台查看站点，或退出登录。",
            },
            {
              route: "/dashboard",
              selector: "[data-tour='menu-posts']",
              title: "博文菜单",
              description: "展开后可进入：管理 / 撰写 / 分类与标签。",
              onEnter: () => {
                try {
                  expanded.value.posts = true;
                  persistExpanded();
                } catch (e) {}
              },
            },
            {
              route: "/posts/manage",
              selector: "[data-tour='posts-manage-filters']",
              title: "博文管理：筛选与搜索",
              description: "按标题关键词、状态、范围筛选文章。",
            },
            {
              route: "/posts/manage",
              selector: "[data-tour='posts-manage-actions']",
              title: "博文管理：批量操作",
              description: "支持删除、批量发布/隐藏、新增文章等。",
            },
            {
              route: "/posts/manage",
              selector: "[data-tour='posts-manage-table']",
              title: "博文管理：列表",
              description: "点击标题进入编辑；可查看评论数、状态与时间等。",
            },
            {
              route: "/posts/write",
              selector: "[data-tour='write-post-title']",
              title: "撰写文章：标题",
              description: "输入文章标题；建议简洁清晰。",
              onEnter: () => toggleWriteSidebar(false),
            },
            {
              route: "/posts/write",
              selector: "[data-tour='write-post-slug']",
              title: "撰写文章：链接（slug）",
              description: "不填将自动使用 cid；也支持自定义 slug。",
              onEnter: () => toggleWriteSidebar(false),
            },
            {
              route: "/posts/write",
              selector: "[data-tour='write-post-editor']",
              title: "撰写文章：正文编辑器",
              description: "支持 Markdown / 纯文本编辑。",
              onEnter: () => toggleWriteSidebar(false),
            },
            {
              route: "/posts/write",
              selector: "[data-tour='write-post-actions']",
              title: "撰写文章：保存与发布",
              description: "保存草稿/发布/删除等操作都在这里。",
              onEnter: () => toggleWriteSidebar(false),
            },
            {
              route: "/posts/write",
              selector: "[data-tour='write-side-toggle']",
              title: "发布设置侧栏",
              description: "展开右侧发布设置（分类、标签、权限等）。",
            },
            {
              route: "/posts/write",
              selector: "[data-tour='write-post-drawer']",
              title: "文章设置面板",
              description: "这里可以设置分类、标签、可见性、权限等。",
              onEnter: () => toggleWriteSidebar(true),
            },
            {
              route: "/posts/write",
              selector: "[data-tour='write-post-permissions']",
              title: "文章权限",
              description: "允许评论/引用/聚合等，按需求调整。",
              onEnter: () => toggleWriteSidebar(true),
            },
            {
              route: "/posts/write",
              selector: "[data-tour='write-post-taxonomy']",
              title: "分类与标签",
              description: "分类用于归档，标签用于更细粒度检索。",
              onEnter: () => toggleWriteSidebar(true),
            },
            {
              route: "/posts/taxonomy",
              selector: "[data-tour='taxonomy-actions']",
              title: "分类/标签：操作",
              description: "刷新、新建分类/标签等管理入口。",
              onEnter: () => {
                try {
                  expanded.value.posts = true;
                  persistExpanded();
                } catch (e) {}
              },
            },
            {
              route: "/posts/taxonomy",
              selector: "[data-tour='taxonomy-categories']",
              title: "分类管理",
              description: "支持多级分类、默认分类设置、编辑与删除。",
            },
            {
              route: "/posts/taxonomy",
              selector: "[data-tour='taxonomy-tags']",
              title: "标签管理",
              description: "用于更细粒度检索；支持编辑与删除。",
            },
            {
              route: "/posts/write",
              selector: "[data-tour='menu-pages']",
              title: "页面菜单",
              description: "页面常用于关于、独立页面等；展开后可进入管理/编辑。",
              onEnter: () => {
                try {
                  expanded.value.pages = true;
                  persistExpanded();
                } catch (e) {}
              },
            },
            {
              route: "/pages/manage",
              selector: "[data-tour='pages-manage-actions']",
              title: "页面管理：操作",
              description: "新增页面、刷新列表等。",
            },
            {
              route: "/pages/manage",
              selector: "[data-tour='pages-manage-table']",
              title: "页面管理：列表",
              description: "点击标题进入编辑；支持删除等操作。",
            },
            {
              route: "/pages/edit",
              selector: "[data-tour='write-page-title']",
              title: "编辑页面：标题",
              description: "页面标题将显示在前台导航/列表中。",
              onEnter: () => toggleWriteSidebar(false),
            },
            {
              route: "/pages/edit",
              selector: "[data-tour='write-page-slug']",
              title: "编辑页面：链接（slug）",
              description: "不填将自动使用 cid；也支持自定义 slug。",
              onEnter: () => toggleWriteSidebar(false),
            },
            {
              route: "/pages/edit",
              selector: "[data-tour='write-page-editor']",
              title: "编辑页面：正文",
              description: "支持 Markdown / 纯文本编辑。",
              onEnter: () => toggleWriteSidebar(false),
            },
            {
              route: "/pages/edit",
              selector: "[data-tour='write-side-toggle']",
              title: "页面设置侧栏",
              description: "展开右侧页面设定（父级/模板/权限/字段）。",
            },
            {
              route: "/pages/edit",
              selector: "[data-tour='write-page-permissions']",
              title: "页面权限",
              description: "允许评论/引用/聚合等，按需求调整。",
              onEnter: () => toggleWriteSidebar(true),
            },
            {
              route: "/pages/edit",
              selector: "[data-tour='write-page-fields']",
              title: "页面字段",
              description: "主题字段与自定义字段可用于扩展模板能力。",
              onEnter: () => toggleWriteSidebar(true),
            },
            {
              route: "/comments",
              selector: "[data-tour='comments-filters']",
              title: "评论：状态筛选",
              description: "快速切换待审核/已通过/垃圾等。",
            },
            {
              route: "/comments",
              selector: "[data-tour='comments-search']",
              title: "评论：搜索",
              description: "可按作者/邮箱/内容搜索。",
            },
            {
              route: "/comments",
              selector: "[data-tour='comments-list']",
              title: "评论：列表",
              description: "点击任意评论查看详情与操作。",
            },
            {
              route: "/comments",
              selector: "[data-tour='comments-detail']",
              title: "评论：详情面板",
              description: "在这里审核、回复、删除，并查看来源与访问信息。",
            },
            {
              route: "/files",
              selector: "[data-tour='files-actions']",
              title: "文件：快捷操作",
              description: "上传、刷新、多选删除、复制链接等。",
            },
            {
              route: "/files",
              selector: "[data-tour='files-grid']",
              title: "文件：网格列表",
              description: "悬停可复制链接/打开/删除；多选模式可批量管理。",
            },
            {
              route: "/friends",
              selector: "[data-tour='friends-actions']",
              title: "朋友们：操作",
              description: "新增友链、检查可用性、迁移头像与设置。",
            },
            {
              route: "/friends",
              selector: "[data-tour='friends-tabs']",
              title: "朋友们：状态",
              description: "切换朋友们/待审核/封禁等状态列表。",
            },
            {
              route: "/friends",
              selector: "[data-tour='friends-table']",
              title: "朋友们：列表",
              description: "管理友链信息、审核申请、封禁与移除等。",
            },
            {
              route: "/data",
              selector: "[data-tour='data-actions']",
              title: "数据：刷新",
              description: "刷新访问日志与统计数据。",
            },
            {
              route: "/data",
              selector: "[data-tour='data-filters']",
              title: "数据：访问日志筛选",
              description: "搜索 IP / 路径 / 来源，快速定位异常访问。",
            },
            {
              route: "/data",
              selector: "[data-tour='data-table']",
              title: "数据：访问日志",
              description: "查看访问来源与设备信息；可跳转到对应页面。",
            },
            {
              route: "/users",
              selector: "[data-tour='users-actions']",
              title: "用户：操作",
              description: "刷新、批量删除、查看权限说明等。",
            },
            {
              route: "/users",
              selector: "[data-tour='users-table']",
              title: "用户：列表",
              description: "查看用户组与文章数；支持设置与删除。",
            },
            {
              route: "/settings",
              selector: "[data-tour='settings-nav']",
              title: "设定：导航",
              description: "左侧选择要配置的模块（用户/网站/内容/插件等）。",
              onEnter: () => selectSettings("user"),
            },
            {
              route: "/settings",
              selector: "[data-tour='settings-savebar']",
              title: "设定：保存提示",
              description: "有未保存修改时会提示；可一键保存全部。",
            },
            {
              route: "/settings",
              selector: "[data-tour='settings-user-head']",
              title: "设定：个人资料",
              description: "头像、昵称、邮箱、主页等信息在这里维护。",
              onEnter: () => selectSettings("user"),
            },
            {
              route: "/settings",
              selector: "[data-tour='settings-site-timezone']",
              title: "设定：时区",
              description: "影响后台时间显示与统计口径。",
              onEnter: () => selectSettings("site"),
            },
            {
              route: "/settings",
              selector: "[data-tour='settings-plugins-active']",
              title: "设定：插件管理",
              description: "启用/禁用插件；有设置项的插件可打开配置弹窗。",
              onEnter: () => selectSettings("plugins"),
            },
            {
              route: "/settings",
              selector: "[data-tour='plugin-config-modal']",
              title: "插件配置弹窗",
              description: "这里展示插件设置项；标题项会以红色高亮区分。",
              onEnter: async () => {
                selectSettings("plugins");
                if (typeof fetchPlugins === "function") {
                  try {
                    await fetchPlugins();
                  } catch (e) {}
                }

                const list = Array.isArray(pluginsActivated?.value) ? pluginsActivated.value : [];
                const preferred =
                  list.find((p) => p && (String(p.name || "") === "ShouTuTa" || String(p.title || "").includes("守兔塔"))) ||
                  list.find((p) => p && p.config && !p.missing) ||
                  null;
                if (preferred && typeof openPluginConfig === "function") {
                  try {
                    await openPluginConfig(preferred);
                  } catch (e) {}
                }
              },
            },
            {
              route: "/settings",
              selector: "[data-tour='settings-plugins-active']",
              title: "返回插件列表",
              description: "关闭弹窗后继续下一步（或直接下一步）。",
              onEnter: () => {
                try {
                  if (typeof closePluginConfig === "function") closePluginConfig();
                } catch (e) {}
                selectSettings("plugins");
              },
            },
            {
              route: "/maintenance/backup",
              selector: "[data-tour='backup-actions']",
              title: "维护：备份",
              description: "可一键备份、恢复、下载与删除备份文件。",
              onEnter: () => {
                try {
                  if (typeof closePluginConfig === "function") closePluginConfig();
                } catch (e) {}
              },
            },
            {
              route: "/maintenance/backup",
              selector: "[data-tour='backup-table']",
              title: "备份列表",
              description: "服务器备份文件列表与操作入口。",
            },
            {
              route: "/extras/shoutu",
              selector: "[data-tour='shoutu-actions']",
              title: "守兔塔：快捷操作",
              description: "可打开设置、刷新数据。",
            },
            {
              route: "/extras/shoutu",
              selector: "[data-tour='shoutu-metrics']",
              title: "守兔塔：防护统计",
              description: "查看累计拦截、SQL/XSS 等细分指标。",
            },
            {
              route: "/extras/shoutu",
              selector: "[data-tour='shoutu-ip-query']",
              title: "守兔塔：IP 查询",
              description: "输入 IP 可查看详情并进行白名单/封禁等操作。",
            },
            {
              route: "/dashboard",
              selector: "[data-tour='dash-actions']",
              title: "完成",
              description: "你已了解后台主要结构与操作入口；可随时点击“使用教程”重新查看。",
            },
          ],
        },
      };

      function v3aStorageGet(key) {
        try {
          return localStorage.getItem(String(key || ""));
        } catch (e) {
          return null;
        }
      }

      function v3aStorageSet(key, value) {
        try {
          localStorage.setItem(String(key || ""), String(value ?? ""));
        } catch (e) {}
      }

      function getTourConfig(id) {
        const key = String(id || "").trim();
        return Object.prototype.hasOwnProperty.call(TOURS, key) ? TOURS[key] : null;
      }

      function isTourDone(id) {
        const cfg = getTourConfig(id);
        if (!cfg || !cfg.storageKey) return false;
        return v3aStorageGet(cfg.storageKey) === "1";
      }

      function setTourDone(id) {
        const cfg = getTourConfig(id);
        if (!cfg || !cfg.storageKey) return;
        v3aStorageSet(cfg.storageKey, "1");
      }

      const tourOpen = ref(false);
      const tourId = ref("");
      const tourStepIndex = ref(0);
      const tourSteps = ref([]);
      const tourStepEnterSig = ref("");
      const tourBubbleEl = ref(null);
      const tourHighlight = reactive({ top: 0, left: 0, width: 0, height: 0 });
      const tourBubblePos = reactive({ top: 0, left: 0 });
      const tourBubbleMax = reactive({ width: 360, height: 520 });

      const tourCurrent = computed(() => tourSteps.value[tourStepIndex.value] || null);
      const tourIsLast = computed(
        () => tourStepIndex.value >= tourSteps.value.length - 1
      );
      const tourTitle = computed(() => String(tourCurrent.value?.title || ""));
      const tourDescription = computed(() =>
        String(tourCurrent.value?.description || "")
      );

      const tourSpotlightStyle = computed(() => ({
        top: `${Math.max(0, tourHighlight.top)}px`,
        left: `${Math.max(0, tourHighlight.left)}px`,
        width: `${Math.max(0, tourHighlight.width)}px`,
        height: `${Math.max(0, tourHighlight.height)}px`,
      }));
      const tourBubbleStyle = computed(() => ({
        top: `${Math.max(0, tourBubblePos.top)}px`,
        left: `${Math.max(0, tourBubblePos.left)}px`,
        maxWidth: `${Math.max(0, tourBubbleMax.width)}px`,
        maxHeight: `${Math.max(0, tourBubbleMax.height)}px`,
      }));

      function resetTourRects() {
        tourHighlight.top = 0;
        tourHighlight.left = 0;
        tourHighlight.width = 0;
        tourHighlight.height = 0;
        tourBubblePos.top = 12;
        tourBubblePos.left = 12;
        tourBubbleMax.width = 360;
        tourBubbleMax.height = 520;
      }

      function findTourTargetEl(step) {
        const selector = step && typeof step === "object" ? String(step.selector || "") : "";
        if (!selector) return null;
        try {
          return document.querySelector(selector);
        } catch (e) {
          return null;
        }
      }

      function updateTourLayout() {
        if (!tourOpen.value) return;

        const step = tourCurrent.value;
        const target = findTourTargetEl(step);
        if (!target) {
          resetTourRects();
          return;
        }

        let rect;
        try {
          rect = target.getBoundingClientRect();
        } catch (e) {
          resetTourRects();
          return;
        }

        const vw = Math.max(0, window.innerWidth || 0);
        const vh = Math.max(0, window.innerHeight || 0);
        const pad = 10;
        const margin = 12;

        const top = Math.max(margin, Number(rect.top || 0) - pad);
        const left = Math.max(margin, Number(rect.left || 0) - pad);
        const maxW = Math.max(0, vw - left - margin);
        const maxH = Math.max(0, vh - top - margin);
        const width = Math.max(24, Math.min(Number(rect.width || 0) + pad * 2, maxW));
        const height = Math.max(
          24,
          Math.min(Number(rect.height || 0) + pad * 2, maxH)
        );

        tourHighlight.top = top;
        tourHighlight.left = left;
        tourHighlight.width = width;
        tourHighlight.height = height;

        let bubbleW = 360;
        let bubbleH = 180;
        const bubbleEl = tourBubbleEl.value;
        if (bubbleEl && typeof bubbleEl.getBoundingClientRect === "function") {
          const b = bubbleEl.getBoundingClientRect();
          bubbleW = Math.max(200, Number(b.width || bubbleW) || bubbleW);
          bubbleH = Math.max(120, Number(b.height || bubbleH) || bubbleH);
        }

        const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
        const gap = 14;

        const hl = {
          top,
          left,
          right: left + width,
          bottom: top + height,
        };
        const hcx = (hl.left + hl.right) / 2;
        const hcy = (hl.top + hl.bottom) / 2;

        function rectOverlapArea(a, b) {
          const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
          const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          return x * y;
        }

        const maxBubbleW = Math.max(0, vw - margin * 2);
        const maxBubbleH = Math.max(0, vh - margin * 2);
        const spaceRight = Math.max(0, vw - (hl.right + gap) - margin);
        const spaceLeft = Math.max(0, hl.left - gap - margin);
        const spaceBottom = Math.max(0, vh - (hl.bottom + gap) - margin);
        const spaceTop = Math.max(0, hl.top - gap - margin);

        const baseBubbleW = Math.min(bubbleW, maxBubbleW || bubbleW);
        const baseBubbleH = Math.min(bubbleH, maxBubbleH || bubbleH);

        const bubbleMinW = 180;
        const bubbleMinH = 140;

        function makeCandidate(name, maxW, maxH, pos) {
          const candMaxW = Math.max(0, Math.min(maxBubbleW || 0, Number(maxW || 0)));
          const candMaxH = Math.max(0, Math.min(maxBubbleH || 0, Number(maxH || 0)));

          const w = Math.max(1, Math.min(baseBubbleW, candMaxW || baseBubbleW));
          const h = Math.max(1, Math.min(baseBubbleH, candMaxH || baseBubbleH));

          const maxLeft = Math.max(margin, vw - w - margin);
          const maxTop = Math.max(margin, vh - h - margin);
          const bLeft = clamp(Number(pos.left || 0), margin, maxLeft);
          const bTop = clamp(Number(pos.top || 0), margin, maxTop);
          const br = { top: bTop, left: bLeft, right: bLeft + w, bottom: bTop + h };

          const overlap = rectOverlapArea(br, hl);
          const dx = bLeft + w / 2 - hcx;
          const dy = bTop + h / 2 - hcy;
          const dist = dx * dx + dy * dy;
          const shrink = (baseBubbleW - w) * (baseBubbleW - w) + (baseBubbleH - h) * (baseBubbleH - h);
          const tinyPenalty =
            (w < bubbleMinW ? (bubbleMinW - w) * 1_000_000 : 0) +
            (h < bubbleMinH ? (bubbleMinH - h) * 1_000_000 : 0);
          const score = (overlap > 0 ? 1_000_000_000_000 + overlap : 0) + tinyPenalty + shrink + dist;

          return {
            name,
            top: bTop,
            left: bLeft,
            maxW: candMaxW || maxBubbleW || baseBubbleW,
            maxH: candMaxH || maxBubbleH || baseBubbleH,
            score,
          };
        }

        const candidates = [];
        candidates.push(
          makeCandidate("right", Math.min(spaceRight, maxBubbleW), maxBubbleH, {
            left: hl.right + gap,
            top: hcy - baseBubbleH / 2,
          })
        );
        candidates.push(
          makeCandidate("left", Math.min(spaceLeft, maxBubbleW), maxBubbleH, {
            left: hl.left - gap - Math.min(baseBubbleW, Math.min(spaceLeft, maxBubbleW) || baseBubbleW),
            top: hcy - baseBubbleH / 2,
          })
        );
        candidates.push(
          makeCandidate("bottom", maxBubbleW, Math.min(spaceBottom, maxBubbleH), {
            left: hcx - baseBubbleW / 2,
            top: hl.bottom + gap,
          })
        );
        candidates.push(
          makeCandidate("top", maxBubbleW, Math.min(spaceTop, maxBubbleH), {
            left: hcx - baseBubbleW / 2,
            top: hl.top - baseBubbleH - gap,
          })
        );

        const cornerW = Math.max(1, Math.min(baseBubbleW, maxBubbleW || baseBubbleW));
        const cornerH = Math.max(1, Math.min(baseBubbleH, maxBubbleH || baseBubbleH));
        const viewportCorners = [
          { name: "vpTopLeft", left: margin, top: margin },
          { name: "vpTopRight", left: vw - cornerW - margin, top: margin },
          { name: "vpBottomRight", left: vw - cornerW - margin, top: vh - cornerH - margin },
          { name: "vpBottomLeft", left: margin, top: vh - cornerH - margin },
        ];
        for (const c of viewportCorners) {
          candidates.push(makeCandidate(c.name, maxBubbleW, maxBubbleH, c));
        }

        let best = null;
        for (const c of candidates) {
          if (!best || c.score < best.score) best = c;
        }

        tourBubblePos.top = best ? best.top : margin;
        tourBubblePos.left = best ? best.left : margin;
        tourBubbleMax.width = best ? best.maxW : Math.max(160, maxBubbleW || 360);
        tourBubbleMax.height = best ? best.maxH : Math.max(140, maxBubbleH || 520);
      }

      function ensureTourStepTarget(guard = 0) {
        if (!tourOpen.value) return;
        const total = tourSteps.value.length;
        if (!total) {
          resetTourRects();
          return;
        }

        const guardLimit = Math.max(12, total * 3);
        if (guard > guardLimit) {
          updateTourLayout();
          return;
        }

        const step = tourCurrent.value;

        // Route-aware steps (optional)
        const desiredRoute =
          step && typeof step === "object" ? String(step.route || "").trim() : "";
        if (desiredRoute) {
          const desiredPath = desiredRoute.split("?")[0] || "/";
          const normalized = v3aNormalizeRoute(desiredRoute);
          const normalizedPath = String(normalized || "/").split("?")[0] || "/";
          if (normalizedPath !== desiredPath) {
            // Can't access this route -> skip step
            if (tourStepIndex.value < total - 1) {
              tourStepIndex.value += 1;
              nextTick(() => ensureTourStepTarget(guard + 1));
              return;
            }
          } else if (routePath.value !== desiredPath) {
            navTo(desiredRoute);
            nextTick(() => ensureTourStepTarget(guard + 1));
            return;
          }
        }

        // Step enter hooks (run once per step)
        const sig = `${String(tourId.value || "")}:${tourStepIndex.value}`;
        if (tourStepEnterSig.value !== sig) {
          tourStepEnterSig.value = sig;
          const onEnter = step && typeof step === "object" ? step.onEnter : null;
          if (typeof onEnter === "function") {
            let res;
            try {
              res = onEnter();
            } catch (e) {}

            if (res && typeof res.then === "function") {
              Promise.resolve(res)
                .catch(() => {})
                .finally(() => nextTick(() => ensureTourStepTarget(guard + 1)));
              return;
            }

            nextTick(() => ensureTourStepTarget(guard + 1));
            return;
          }
        }

        const target = findTourTargetEl(step);
        if (!target) {
          if (tourStepIndex.value < total - 1) {
            tourStepIndex.value += 1;
            nextTick(() => ensureTourStepTarget(guard + 1));
            return;
          }
          updateTourLayout();
          return;
        }

        try {
          if (typeof target.scrollIntoView === "function") {
            target.scrollIntoView({
              block: "center",
              inline: "nearest",
              behavior: "smooth",
            });
          }
        } catch (e) {}

        updateTourLayout();
        setTimeout(updateTourLayout, 80);
        setTimeout(updateTourLayout, 240);
        setTimeout(updateTourLayout, 700);
      }

      function openTour(id, opts = {}) {
        const key = String(id || "").trim();
        const cfg = getTourConfig(key);
        if (!cfg) return;
        const force = !!opts.force;
        if (!force && isTourDone(key)) return;

        tourId.value = key;
        tourSteps.value = Array.isArray(cfg.steps) ? cfg.steps : [];
        tourStepIndex.value = 0;
        tourStepEnterSig.value = "";
        tourOpen.value = true;

        updateTourLayout();
        nextTick(() => ensureTourStepTarget());
      }

      function closeTour(opts = {}) {
        const markDone = !!opts.markDone;
        const id = String(tourId.value || "");
        if (markDone && id) {
          setTourDone(id);
        }

        tourOpen.value = false;
        tourId.value = "";
        tourStepIndex.value = 0;
        tourSteps.value = [];
        tourStepEnterSig.value = "";
        resetTourRects();
      }

      function tourPrev() {
        if (!tourOpen.value) return;
        tourStepIndex.value = Math.max(0, tourStepIndex.value - 1);
        nextTick(() => ensureTourStepTarget());
      }

      function tourNext() {
        if (!tourOpen.value) return;
        tourStepIndex.value = Math.min(
          Math.max(0, tourSteps.value.length - 1),
          tourStepIndex.value + 1
        );
        nextTick(() => ensureTourStepTarget());
      }

      function tourSkip() {
        closeTour({ markDone: true });
      }

      function tourFinish() {
        closeTour({ markDone: true });
      }

      function openDashboardTour() {
        openTour("main", { force: true });
      }

      function logout() {
        const url = String(V3A.logoutUrl || "").trim();
        if (!url) {
          toastError("缺少退出登录地址");
          return;
        }
        location.href = url;
      }

      function maybeAutoOpenDashboardTour() {
        if (tourOpen.value) return;
        if (routePath.value !== "/dashboard") return;
        if (isTourDone("dashboard")) return;
        if (settingsOpen.value || writeSidebarOpen.value || permissionInfoOpen.value) return;
        openTour("dashboard", { force: false });
      }

      function onTourKeydown(e) {
        if (!tourOpen.value) return;
        if (e && e.key === "Escape") {
          try {
            e.preventDefault();
          } catch (err) {}
          tourSkip();
        }
      }

      watch(
        () => tourOpen.value,
        (open) => {
          if (open) {
            try {
              window.addEventListener("resize", updateTourLayout, { passive: true });
              window.addEventListener("scroll", updateTourLayout, true);
              window.addEventListener("keydown", onTourKeydown);
            } catch (e) {}
            nextTick(() => ensureTourStepTarget());
          } else {
            try {
              window.removeEventListener("resize", updateTourLayout);
              window.removeEventListener("scroll", updateTourLayout, true);
              window.removeEventListener("keydown", onTourKeydown);
            } catch (e) {}
          }
        }
      );

      watch(
        () => routePath.value,
        (p) => {
          if (String(p || "") === "/dashboard") {
            nextTick(() => {
              setTimeout(maybeAutoOpenDashboardTour, 260);
            });
          } else if (tourOpen.value && tourId.value === "dashboard") {
            closeTour({ markDone: false });
          }

          if (tourOpen.value) {
            nextTick(() => ensureTourStepTarget());
          }
        }
      );

      onMounted(() => {
        if (routePath.value === "/dashboard") {
          setTimeout(maybeAutoOpenDashboardTour, 360);
        }
      });

      const loadingDashboard = ref(false);
      const dashboardError = ref("");

      const summary = ref({
        posts: 0,
        pages: 0,
        comments: 0,
        commentsWaiting: 0,
        categories: 0,
        tags: 0,
        totalChars: 0,
        visitPv: 0,
        visitUv: 0,
        todayUv: 0,
        apiCalls: 0,
        friendLinks: 0,
        friendLinkApply: 0,
        postLikes: 0,
        siteLikes: 0,
      });

      const realtime = ref({
        onlineNow: 0,
        todayVisitors: 0,
        todayMaxOnline: 0,
      });

      const visitWeekTrend = ref([]);
      const publishTrend = ref([]);
      const pageTrend = ref([]);
      const commentActivity = ref([]);
      const categoryDistribution = ref([]);
      const hotPosts = ref([]);
      const tagTop = ref([]);
      const tagGraph = ref({ nodes: [], links: [] });
      const systemInfo = ref({
        typechoVersion: "",
        phpVersion: "",
        serverTime: 0,
        timezone: "",
      });
      const recentPosts = ref([]);
      const recentComments = ref([]);

      // Posts (manage/write)
      const postsLoading = ref(false);
      const postsError = ref("");
      const postsItems = ref([]);
      const postsFilters = reactive({
        keywords: "",
        status: "all", // all|publish|draft|waiting|private|hidden
        category: 0,
        scope: "mine", // mine|all (editors only)
      });
      const postsPagination = reactive({
        page: 1,
        pageSize: 20,
        total: 0,
        pageCount: 1,
      });
      const postsSelectedCids = ref([]);
      const postsSelectAllEl = ref(null);
      const postsPageJump = ref(1);

      // Draft box
      const draftsKeywords = ref("");
      const draftsScope = ref("mine"); // mine|all (editors only)
      const draftsPostsLoading = ref(false);
      const draftsPostsError = ref("");
      const draftsPostsItems = ref([]);
      const draftsPostsPagination = reactive({
        page: 1,
        pageSize: 20,
        total: 0,
        pageCount: 1,
      });
      const draftsPostsPageJump = ref(1);

      const draftsPagesLoading = ref(false);
      const draftsPagesError = ref("");
      const draftsPagesItems = ref([]);

      const draftsActiveKey = ref("");

      function draftsItemAt(item) {
        const created = Number(item?.created || 0) || 0;
        const modified = Number(item?.modified || 0) || 0;
        return modified && modified > created ? modified : created;
      }

      function draftsItemTitle(item) {
        const title = String(item?.title || "").trim();
        if (title) return title;
        const cid = Number(item?.cid || 0) || 0;
        const t = String(item?._draftType || item?.type || "");
        if (t === "page") return cid > 0 ? `#${cid}` : "（无标题）";
        return "（无标题）";
      }

      const draftsListItems = computed(() => {
        const posts = (draftsPostsItems.value || [])
          .map((p) => ({
            ...p,
            _draftType: "post",
            _draftKey: `post:${Number(p?.cid || 0) || 0}`,
            _draftAt: draftsItemAt(p),
          }))
          .filter((p) => Number(p?.cid || 0) > 0);

        const pages = (draftsPagesItems.value || [])
          .map((p) => ({
            ...p,
            _draftType: "page",
            _draftKey: `page:${Number(p?.cid || 0) || 0}`,
            _draftAt: draftsItemAt(p),
          }))
          .filter((p) => Number(p?.cid || 0) > 0);

        const merged = posts.concat(pages);
        merged.sort((a, b) => Number(b?._draftAt || 0) - Number(a?._draftAt || 0));
        return merged;
      });

      const draftsCountText = computed(
        () =>
          `${formatNumber((draftsPostsPagination.total || 0) + (draftsPagesItems.value || []).length)} 个`
      );

      const draftsActiveItem = computed(() => {
        const key = String(draftsActiveKey.value || "");
        if (!key) return null;
        return (draftsListItems.value || []).find((d) => d && d._draftKey === key) || null;
      });

      function draftsOpenActiveDraft() {
        const d = draftsActiveItem.value;
        if (!d) return;
        if (d._draftType === "page") {
          openPageEditor(d.cid);
          return;
        }
        openPostEditor(d.cid);
      }

      async function draftsDeleteActiveDraft() {
        const d = draftsActiveItem.value;
        if (!d) return;
        if (d._draftType === "page") {
          await deletePage(d.cid);
          return;
        }
        await deletePost(d.cid);
      }

      const draftsPreviewLoading = ref(false);
      const draftsPreviewError = ref("");
      const draftsPreviewText = ref("");
      const draftsPreviewCache = new Map();
      let draftsPreviewToken = 0;

      watch(
        () => [routePath.value, draftsActiveKey.value].join("|"),
        async () => {
          if (routePath.value !== "/drafts") return;

          const key = String(draftsActiveKey.value || "");
          draftsPreviewError.value = "";

          if (!key) {
            draftsPreviewLoading.value = false;
            draftsPreviewText.value = "";
            return;
          }

          if (draftsPreviewCache.has(key)) {
            draftsPreviewLoading.value = false;
            draftsPreviewText.value = String(draftsPreviewCache.get(key) || "");
            return;
          }

          const d = draftsActiveItem.value;
          if (!d) {
            draftsPreviewLoading.value = false;
            draftsPreviewText.value = "";
            return;
          }

          const token = ++draftsPreviewToken;
          draftsPreviewLoading.value = true;
          draftsPreviewText.value = "";
          try {
            let text = "";
            if (d._draftType === "page") {
              const data = await apiGet("pages.get", { cid: d.cid || "", parent: "" });
              text = String(data?.page?.text || "");
            } else {
              const data = await apiGet("posts.get", { cid: d.cid || "" });
              text = String(data?.post?.text || "");
            }

            draftsPreviewCache.set(key, text);
            if (token !== draftsPreviewToken) return;
            draftsPreviewText.value = text;
          } catch (e) {
            if (token !== draftsPreviewToken) return;
            draftsPreviewError.value = e && e.message ? e.message : "加载失败";
          } finally {
            if (token === draftsPreviewToken) draftsPreviewLoading.value = false;
          }
        },
        { immediate: true }
      );

      watch(
        () => [routePath.value, (draftsListItems.value || []).map((d) => d._draftKey).join(",")].join("|"),
        () => {
          if (routePath.value !== "/drafts") return;
          if (draftsActiveItem.value) return;
          const first = (draftsListItems.value || [])[0];
          draftsActiveKey.value = first ? String(first._draftKey || "") : "";
        },
        { immediate: true }
      );

      const postsSelectedAll = computed(() => {
        const items = postsItems.value || [];
        return items.length > 0 && postsSelectedCids.value.length === items.length;
      });

      const postsSelectedIndeterminate = computed(() => {
        const items = postsItems.value || [];
        const n = postsSelectedCids.value.length;
        return n > 0 && n < items.length;
      });

      const postLoading = ref(false);
      const postSaving = ref(false);
      const postError = ref("");
      const postMessage = ref("");
      const postCapabilities = ref({
        markdownEnabled: !!V3A.markdownEnabled,
        canPublish: !!V3A.canPublish,
      });

      const postForm = reactive({
        cid: 0,
        title: "",
        slug: "",
        text: "",
        tags: "",
        created: 0,
        modified: 0,
        visibility: "publish", // publish|hidden|private|waiting|password
        password: "",
        allowComment: true,
        allowPing: true,
        allowFeed: true,
        markdown: true,
        categories: [],
        fields: [],
      });
      const postDefaultFields = ref([]);

      // Post draft auto-save (enabled via settings: userOptions.autoSave)
      const postDraftSaveState = ref("idle"); // idle|saving|saved|error
      const postDraftLastSavedAt = ref(0); // unix seconds
      const postDraftLastSavedHash = ref("");
      const postDraftSaveError = ref("");
      let postDraftAutoSaveTimer = null;
      const postDraftNowTick = ref(0);
      let postDraftNowTimer = null;
      let postDraftSavingPromise = null;
      let postDraftSaveQueued = false;
      let postDraftBeaconSent = false;

      function postDraftHashValue() {
        const cats = Array.isArray(postForm.categories)
          ? postForm.categories
              .map((c) => Number(c || 0))
              .filter((n) => n > 0)
              .sort((a, b) => a - b)
              .join(",")
          : "";
        const fields = Array.isArray(postForm.fields)
          ? postForm.fields
              .map((f) => {
                if (!f || typeof f !== "object") return "";
                const name = String(f.name || "");
                if (!name) return "";
                const type = String(f.type || "str");
                const value = String(f.value ?? "");
                return `${name}@${type}=${value}`;
              })
              .filter(Boolean)
              .join("|")
          : "";
        const pwd =
          String(postForm.visibility || "") === "password"
            ? String(postForm.password || "")
            : "";
        return [
          String(postForm.cid || 0),
          String(postForm.title || ""),
          String(postForm.slug || ""),
          String(postForm.text || ""),
          String(postForm.tags || ""),
          String(postForm.visibility || ""),
          pwd,
          postForm.markdown ? "1" : "0",
          cats,
          fields,
        ].join("\u0001");
      }

      function markPostDraftSaved(ts, savedHash) {
        postDraftSaveState.value = "saved";
        postDraftSaveError.value = "";
        postDraftLastSavedAt.value = Number(ts || 0) || Math.floor(Date.now() / 1000);
        if (typeof savedHash === "string") {
          postDraftLastSavedHash.value = savedHash;
        } else {
          postDraftLastSavedHash.value = postDraftHashValue();
        }
      }

      function markPostDraftSaving() {
        postDraftSaveState.value = "saving";
        postDraftSaveError.value = "";
      }

      function markPostDraftError(err) {
        postDraftSaveState.value = "error";
        postDraftSaveError.value = String(err || "保存失败");
      }

      function patchPostDraftHash(hash, patch) {
        const sep = "\u0001";
        const parts = String(hash || "").split(sep);
        if (!parts.length) return String(hash || "");

        const p = patch && typeof patch === "object" ? patch : {};
        if (Object.prototype.hasOwnProperty.call(p, "cid")) {
          parts[0] = String(Number(p.cid || 0) || 0);
        }
        if (Object.prototype.hasOwnProperty.call(p, "slug")) {
          parts[2] = String(p.slug ?? "");
        }
        return parts.join(sep);
      }

      function clearPostDraftAutoSaveTimer() {
        if (!postDraftAutoSaveTimer) return;
        try {
          clearTimeout(postDraftAutoSaveTimer);
        } catch (e) {}
        postDraftAutoSaveTimer = null;
      }

      function startPostDraftNowTicker() {
        if (postDraftNowTimer) return;
        postDraftNowTick.value = Date.now();
        postDraftNowTimer = setInterval(() => {
          postDraftNowTick.value = Date.now();
        }, 1000);
      }

      function stopPostDraftNowTicker() {
        if (!postDraftNowTimer) return;
        try {
          clearInterval(postDraftNowTimer);
        } catch (e) {}
        postDraftNowTimer = null;
      }

      function schedulePostDraftAutoSave(delayMs = 1800) {
        if (!postAutoSaveEnabled.value) return;
        if (routePath.value !== "/posts/write") return;
        if (postLoading.value) return;
        clearPostDraftAutoSaveTimer();
        const d = Math.max(400, Number(delayMs || 0) || 0);
        postDraftAutoSaveTimer = setTimeout(() => {
          runPostDraftAutoSave("auto");
        }, d);
      }

      async function flushPostDraftAutoSave(source) {
        if (!postAutoSaveEnabled.value) return;
        if (routePath.value !== "/posts/write") return;
        clearPostDraftAutoSaveTimer();
        await runPostDraftAutoSave(source || "exit");
      }

      async function runPostDraftAutoSave(source) {
        if (!postAutoSaveEnabled.value) return;
        if (routePath.value !== "/posts/write") return;
        if (postLoading.value) return;
        if (postSaving.value) {
          clearPostDraftAutoSaveTimer();
          postDraftAutoSaveTimer = setTimeout(() => {
            runPostDraftAutoSave(source);
          }, 1200);
          return;
        }

        syncPostTextFromEditor();
        const hash = postDraftHashValue();
        if (hash && hash === postDraftLastSavedHash.value) return;

        await savePostDraftSilently(source || "auto", hash);
      }

      async function savePostDraftSilently(source, hashToSave) {
        if (!postAutoSaveEnabled.value) return;
        if (routePath.value !== "/posts/write") return;
        if (postLoading.value) return;
        if (postSaving.value) return;

        const titleTrim = String(postForm.title || "").trim();
        const textTrim = String(postForm.text || "").trim();
        if (!titleTrim && !textTrim) return;

        if (postDraftSavingPromise) {
          postDraftSaveQueued = true;
          return postDraftSavingPromise;
        }

        markPostDraftSaving();

        const baseHash = typeof hashToSave === "string" ? hashToSave : postDraftHashValue();

        const slugWasEmpty = !String(postForm.slug || "").trim();
        const currentCid = Number(postForm.cid || 0) || 0;
        const payloadSlug =
          slugWasEmpty && currentCid > 0 ? String(currentCid) : String(postForm.slug ?? "");

        const postFieldsMap = new Map();
        const postDefaults = Array.isArray(postDefaultFields.value) ? postDefaultFields.value : [];
        for (const f of postDefaults) {
          if (!f || typeof f !== "object") continue;
          const name = String(f.name || "");
          if (!name) continue;
          const v = f.value;
          const isObj = v !== null && typeof v === "object";
          postFieldsMap.set(name, {
            name,
            type: isObj ? "json" : "str",
            value: isObj ? v : String(v ?? ""),
          });
        }
        for (const f of postForm.fields) {
          if (!f || typeof f !== "object") continue;
          const name = String(f.name || "");
          if (!name) continue;
          const type = String(f.type || "str");
          postFieldsMap.set(name, {
            name,
            type,
            value: type === "json" ? safeJsonParse(f.value) : f.value,
          });
        }

        const payload = {
          cid: currentCid || 0,
          title: postForm.title,
          slug: payloadSlug,
          text: postForm.text,
          tags: postForm.tags,
          visibility: postForm.visibility,
          password: postForm.visibility === "password" ? postForm.password : "",
          allowComment: postForm.allowComment,
          allowPing: postForm.allowPing,
          allowFeed: postForm.allowFeed,
          markdown: postForm.markdown ? 1 : 0,
          category: postForm.categories,
          fields: Array.from(postFieldsMap.values()),
          source: String(source || "auto"),
        };

        postDraftSavingPromise = (async () => {
          try {
            const data = await apiPost("posts.save", payload);
            const savedCid = Number(data.cid || 0) || 0;
            const savedSlugRaw = Object.prototype.hasOwnProperty.call(data || {}, "slug")
              ? String(data.slug ?? "").trim()
              : "";
            const savedSlug =
              slugWasEmpty && savedCid > 0
                ? (savedSlugRaw || String(savedCid))
                : String(payload.slug ?? "");
            const savedHash = patchPostDraftHash(baseHash, { cid: savedCid || currentCid, slug: savedSlug });

            if (routePath.value === "/posts/write") {
              if (savedCid > 0) {
                postForm.cid = savedCid;
              }
              if (slugWasEmpty && savedSlug) {
                postForm.slug = savedSlug;
              }

              if (savedCid > 0) {
                const currentCidInRoute = Number(routeQuery.value?.cid || 0);
                if (!currentCidInRoute || currentCidInRoute !== savedCid) {
                  skipNextWriteLoad = true;
                  navTo(`/posts/write?cid=${encodeURIComponent(String(savedCid))}`);
                }
              }

              markPostDraftSaved(Math.floor(Date.now() / 1000), savedHash);
            }
          } catch (e) {
            if (routePath.value === "/posts/write") {
              markPostDraftError(e && e.message ? e.message : "保存失败");
            }
          } finally {
            postDraftSavingPromise = null;
            if (postDraftSaveQueued) {
              postDraftSaveQueued = false;
              schedulePostDraftAutoSave(600);
            }
          }
        })();

        return postDraftSavingPromise;
      }

      function beaconSavePostDraft(source) {
        try {
          if (!postAutoSaveEnabled.value) return;
          if (routePath.value !== "/posts/write") return;
          if (postLoading.value) return;
          if (postDraftBeaconSent) return;

          syncPostTextFromEditor();
          const hash = postDraftHashValue();
          if (hash && hash === postDraftLastSavedHash.value) return;

          const titleTrim = String(postForm.title || "").trim();
          const textTrim = String(postForm.text || "").trim();
          if (!titleTrim && !textTrim) return;

          const slugWasEmpty = !String(postForm.slug || "").trim();
          const currentCid = Number(postForm.cid || 0) || 0;
          const payloadSlug =
            slugWasEmpty && currentCid > 0 ? String(currentCid) : String(postForm.slug ?? "");

          const postFieldsMap = new Map();
          const postDefaults = Array.isArray(postDefaultFields.value) ? postDefaultFields.value : [];
          for (const f of postDefaults) {
            if (!f || typeof f !== "object") continue;
            const name = String(f.name || "");
            if (!name) continue;
            const v = f.value;
            const isObj = v !== null && typeof v === "object";
            postFieldsMap.set(name, {
              name,
              type: isObj ? "json" : "str",
              value: isObj ? v : String(v ?? ""),
            });
          }
          for (const f of postForm.fields) {
            if (!f || typeof f !== "object") continue;
            const name = String(f.name || "");
            if (!name) continue;
            const type = String(f.type || "str");
            postFieldsMap.set(name, {
              name,
              type,
              value: type === "json" ? safeJsonParse(f.value) : f.value,
            });
          }

          const payload = {
            cid: currentCid || 0,
            title: postForm.title,
            slug: payloadSlug,
            text: postForm.text,
            tags: postForm.tags,
            visibility: postForm.visibility,
            password: postForm.visibility === "password" ? postForm.password : "",
            allowComment: postForm.allowComment,
            allowPing: postForm.allowPing,
            allowFeed: postForm.allowFeed,
            markdown: postForm.markdown ? 1 : 0,
            category: postForm.categories,
            fields: Array.from(postFieldsMap.values()),
            source: String(source || "exit"),
          };

          const url = buildApiUrl("posts.save", null, true);
          const body = JSON.stringify(payload || {});
          postDraftBeaconSent = true;

          if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
            const blob = new Blob([body], { type: "application/json" });
            navigator.sendBeacon(url, blob);
            return;
          }

          fetch(url, {
            method: "POST",
            credentials: "same-origin",
            keepalive: true,
            headers: {
              "Content-Type": "application/json",
              "X-Requested-With": "XMLHttpRequest",
              Accept: "application/json",
            },
            body,
          });
        } catch (e) {}
      }

      watch(
        () => postForm.title,
        () => {
          schedulePostDraftAutoSave();
        }
      );
      watch(
        () => postForm.tags,
        () => {
          schedulePostDraftAutoSave();
        }
      );
      watch(
        () => postForm.slug,
        () => {
          schedulePostDraftAutoSave();
        }
      );
      watch(
        () => postForm.visibility,
        () => {
          schedulePostDraftAutoSave();
        }
      );
      watch(
        () => postForm.password,
        () => {
          schedulePostDraftAutoSave();
        }
      );
      watch(
        () => (Array.isArray(postForm.categories) ? postForm.categories.slice().join(",") : ""),
        () => {
          schedulePostDraftAutoSave();
        }
      );
      watch(
        () =>
          Array.isArray(postForm.fields)
            ? postForm.fields
                .map((f) => {
                  if (!f || typeof f !== "object") return "";
                  const name = String(f.name || "");
                  if (!name) return "";
                  return `${name}@${String(f.type || "str")}=${String(f.value ?? "")}`;
                })
                .filter(Boolean)
                .join("|")
            : "",
        () => {
          schedulePostDraftAutoSave();
        }
      );

      const postTextEl = ref(null);
      const postEditorType = ref("vditor");
      let postVditor = null;
      let postVditorSyncing = false;
      const pageTextEl = ref(null);
      const pageEditorType = ref("vditor");
      let pageVditor = null;
      let pageVditorSyncing = false;

      function vditorUploadFormat(files, responseText) {
        const list = Array.isArray(files) ? files : [];
        const names = list
          .map((f) => (f && f.name ? String(f.name) : ""))
          .filter(Boolean);

        const fail = (msg) =>
          JSON.stringify({
            code: 1,
            msg: String(msg || "上传失败"),
            data: { errFiles: names, succMap: {} },
          });

        try {
          const raw = String(responseText || "").trim();
          if (!raw) return fail("上传失败");
          const json = JSON.parse(raw);
          if (json === false) return fail("上传失败");

          // Vue3Admin API: {code, message, data:{url}}
          if (json && typeof json === "object" && json.code !== undefined) {
            if (Number(json.code) === 0 && json.data && json.data.url) {
              const url = String(json.data.url || "");
              if (!url) return fail("上传失败");
              const filename = names[0] || url;
              return JSON.stringify({
                code: 0,
                msg: "",
                data: { errFiles: [], succMap: { [filename]: url } },
              });
            }
            return fail(json.message || "上传失败");
          }

          // Typecho upload action returns: [url, meta]
          if (Array.isArray(json) && json[0]) {
            const url = String(json[0] || "");
            if (!url) return fail("上传失败");
            const filename = names[0] || url;
            return JSON.stringify({
              code: 0,
              msg: "",
              data: { errFiles: [], succMap: { [filename]: url } },
            });
          }

          // Generic {url: "..."} fallback
          if (json && typeof json === "object" && json.url) {
            const url = String(json.url || "");
            if (!url) return fail("上传失败");
            const filename = names[0] || url;
            return JSON.stringify({
              code: 0,
              msg: "",
              data: { errFiles: [], succMap: { [filename]: url } },
            });
          }
        } catch (e) {
          return fail("上传失败");
        }

        return fail("上传失败");
      }

      function destroyPostVditor() {
        if (!postVditor) return;
        try {
          postVditor.destroy();
        } catch (e) {}
        postVditor = null;
      }

      function syncPostTextFromEditor() {
        if (postEditorType.value !== "vditor") return;
        if (!postVditor) return;
        try {
          if (postForm.markdown || typeof postVditor.getHTML !== "function") {
            if (typeof postVditor.getValue === "function") {
              postForm.text = String(postVditor.getValue() || "");
            }
          } else {
            postForm.text = String(postVditor.getHTML() || "");
          }
        } catch (e) {}
      }

      function setPostEditorValue(value, clearStack) {
        if (postEditorType.value !== "vditor") return;
        if (!postVditor || typeof postVditor.setValue !== "function") return;
        postVditorSyncing = true;
        try {
          postVditor.setValue(String(value || ""), !!clearStack);
        } catch (e) {}
        postVditorSyncing = false;
      }

      // AI: write helpers (polish + slug)
      const aiRuntimeConfig = computed(() => {
        try {
          const extras = V3A && V3A.extras && typeof V3A.extras === "object" ? V3A.extras : {};
          const ai = extras.ai && typeof extras.ai === "object" ? extras.ai : {};
          return ai;
        } catch (e) {
          return {};
        }
      });

      const aiPolishAvailable = computed(() => {
        const ai = aiRuntimeConfig.value && typeof aiRuntimeConfig.value === "object" ? aiRuntimeConfig.value : {};
        const enabled = Number(ai.enabled || 0) ? 1 : 0;
        const hasKey = Number(ai.hasApiKey || 0) ? 1 : 0;
        const features = ai && typeof ai.features === "object" ? ai.features : {};
        const ok = enabled && hasKey && Number(features.polish || 0);
        return ok ? true : false;
      });

      const aiSlugAvailable = computed(() => {
        const ai = aiRuntimeConfig.value && typeof aiRuntimeConfig.value === "object" ? aiRuntimeConfig.value : {};
        const enabled = Number(ai.enabled || 0) ? 1 : 0;
        const hasKey = Number(ai.hasApiKey || 0) ? 1 : 0;
        const features = ai && typeof ai.features === "object" ? ai.features : {};
        const ok = enabled && hasKey && Number(features.slug || 0);
        return ok ? true : false;
      });

      const aiSlugLoading = ref(false);

      async function generateAiSlug(title) {
        const t = String(title || "").trim();
        if (!t) {
          throw new Error("请先输入标题");
        }
        const data = await apiPost("ai.slug", { title: t });
        const slug = data && typeof data === "object" ? String(data.slug || "").trim() : "";
        if (!slug) {
          throw new Error("生成失败");
        }
        return slug;
      }

      async function generateAiSlugForPost() {
        if (aiSlugLoading.value) return;
        aiSlugLoading.value = true;
        try {
          const slug = await generateAiSlug(postForm.title);
          postForm.slug = slug;
          toastSuccess("已生成 slug");
        } catch (e) {
          toastError(e && e.message ? e.message : "生成失败");
        } finally {
          aiSlugLoading.value = false;
        }
      }

      async function generateAiSlugForPage() {
        if (aiSlugLoading.value) return;
        aiSlugLoading.value = true;
        try {
          const slug = await generateAiSlug(pageForm.title);
          pageForm.slug = slug;
          toastSuccess("已生成 slug");
        } catch (e) {
          toastError(e && e.message ? e.message : "生成失败");
        } finally {
          aiSlugLoading.value = false;
        }
      }

      const aiPolishModalOpen = ref(false);
      const aiPolishLoading = ref(false);
      const aiPolishError = ref("");
      const aiPolishModel = ref("");
      const aiPolishText = ref("");
      const aiPolishPreviewEl = ref(null);

      async function openAiPolishModal() {
        if (aiPolishLoading.value) return;

        syncPostTextFromEditor();
        const text = String(postForm.text || "");
        if (!text.trim()) {
          toastError("请先输入正文");
          return;
        }

        aiPolishModalOpen.value = true;
        aiPolishLoading.value = true;
        aiPolishError.value = "";
        aiPolishModel.value = "";
        aiPolishText.value = "";
        try {
          const data = await apiPost("ai.polish", { text });
          aiPolishText.value = data && typeof data === "object" ? String(data.text || "") : "";
          aiPolishModel.value = data && typeof data === "object" ? String(data.model || "") : "";
          await nextTick();
          await v3aPreviewMarkdown(aiPolishPreviewEl.value, aiPolishText.value);
        } catch (e) {
          aiPolishError.value = e && e.message ? e.message : "润色失败";
        } finally {
          aiPolishLoading.value = false;
        }
      }

      function closeAiPolishModal() {
        aiPolishModalOpen.value = false;
        aiPolishLoading.value = false;
        aiPolishError.value = "";
        aiPolishModel.value = "";
        aiPolishText.value = "";
        if (aiPolishPreviewEl.value) aiPolishPreviewEl.value.innerHTML = "";
      }

      function applyAiPolishReplace() {
        if (!aiPolishText.value) return;
        postForm.text = String(aiPolishText.value || "");
        setPostEditorValue(postForm.text, true);
        closeAiPolishModal();
        toastSuccess("已替换正文");
      }

      function initPostVditor() {
        const VditorCtor =
          typeof window !== "undefined" ? window.Vditor : undefined;
        if (!VditorCtor) {
          postEditorType.value = "textarea";
          destroyPostVditor();
          return;
        }

        postEditorType.value = "vditor";
        const host = document.getElementById("v3a-post-vditor");
        if (!host) return;

        if (postVditor) {
          setPostEditorValue(postForm.text, true);
          return;
        }

        const isDark = document.documentElement.classList.contains("dark");
        const theme = isDark ? "dark" : "classic";
        const cdn =
          String((V3A.vditor && V3A.vditor.cdn) || "").trim() ||
          "https://cdn.jsdelivr.net/npm/vditor@3.11.2";

        try {
          const canUpload =
            !V3A.acl || !V3A.acl.files || Number(V3A.acl.files.upload || 0);
          const uploadUrl = canUpload ? buildApiUrl("files.upload", { cid: postForm.cid || "" }, true) : "";

          postVditor = new VditorCtor("v3a-post-vditor", {
            height: "auto",
            mode: "ir",
            lang: "zh_CN",
            cdn,
            theme,
            cache: { enable: false },
            value: String(postForm.text || ""),
            placeholder: "",
            toolbarConfig: { pin: false },
            input: (value) => {
              if (postVditorSyncing) return;
              postForm.text = String(value || "");
              schedulePostDraftAutoSave();
            },
            blur: (value) => {
              if (postVditorSyncing) return;
              postForm.text = String(value || "");
              schedulePostDraftAutoSave(600);
            },
            upload: uploadUrl
              ? {
                  url: String(uploadUrl || ""),
                  fieldName: "file",
                  multiple: false,
                  withCredentials: true,
                  headers: {
                    "X-Requested-With": "XMLHttpRequest",
                    Accept: "application/json",
                  },
                  format: vditorUploadFormat,
                }
              : { url: "" },
            after: () => {
              setPostEditorValue(postForm.text, true);
            },
          });
        } catch (e) {
          postEditorType.value = "textarea";
          postVditor = null;
        }
      }

      function destroyPageVditor() {
        if (!pageVditor) return;
        try {
          pageVditor.destroy();
        } catch (e) {}
        pageVditor = null;
      }

      function syncPageTextFromEditor() {
        if (pageEditorType.value !== "vditor") return;
        if (!pageVditor) return;
        try {
          if (pageForm.markdown || typeof pageVditor.getHTML !== "function") {
            if (typeof pageVditor.getValue === "function") {
              pageForm.text = String(pageVditor.getValue() || "");
            }
          } else {
            pageForm.text = String(pageVditor.getHTML() || "");
          }
        } catch (e) {}
      }

      function setPageEditorValue(value, clearStack) {
        if (pageEditorType.value !== "vditor") return;
        if (!pageVditor || typeof pageVditor.setValue !== "function") return;
        pageVditorSyncing = true;
        try {
          pageVditor.setValue(String(value || ""), !!clearStack);
        } catch (e) {}
        pageVditorSyncing = false;
      }

      function initPageVditor() {
        const VditorCtor =
          typeof window !== "undefined" ? window.Vditor : undefined;
        if (!VditorCtor) {
          pageEditorType.value = "textarea";
          destroyPageVditor();
          return;
        }

        pageEditorType.value = "vditor";
        const host = document.getElementById("v3a-page-vditor");
        if (!host) return;

        if (pageVditor) {
          setPageEditorValue(pageForm.text, true);
          return;
        }

        const isDark = document.documentElement.classList.contains("dark");
        const theme = isDark ? "dark" : "classic";
        const cdn =
          String((V3A.vditor && V3A.vditor.cdn) || "").trim() ||
          "https://cdn.jsdelivr.net/npm/vditor@3.11.2";

        try {
          const canUpload =
            !V3A.acl || !V3A.acl.files || Number(V3A.acl.files.upload || 0);
          const uploadUrl = canUpload ? buildApiUrl("files.upload", { cid: pageForm.cid || "" }, true) : "";

          pageVditor = new VditorCtor("v3a-page-vditor", {
            height: "auto",
            mode: "ir",
            lang: "zh_CN",
            cdn,
            theme,
            cache: { enable: false },
            value: String(pageForm.text || ""),
            placeholder: "",
            toolbarConfig: { pin: false },
            input: (value) => {
              if (pageVditorSyncing) return;
              pageForm.text = String(value || "");
            },
            blur: (value) => {
              if (pageVditorSyncing) return;
              pageForm.text = String(value || "");
            },
            upload: uploadUrl
              ? {
                  url: String(uploadUrl || ""),
                  fieldName: "file",
                  multiple: false,
                  withCredentials: true,
                  headers: {
                    "X-Requested-With": "XMLHttpRequest",
                    Accept: "application/json",
                  },
                  format: vditorUploadFormat,
                }
              : { url: "" },
            after: () => {
              setPageEditorValue(pageForm.text, true);
            },
          });
        } catch (e) {
          pageEditorType.value = "textarea";
          pageVditor = null;
        }
      }

      function v3aSetVditorToolbarStickyTop(px) {
        try {
          const el = document && document.documentElement;
          if (!el || typeof el.style?.setProperty !== "function") return;
          const h = Math.max(0, Math.round(Number(px || 0) || 0));
          el.style.setProperty("--v3a-vditor-toolbar-top", `${h}px`);
        } catch (e) {}
      }

      function v3aUpdateVditorToolbarStickyTop() {
        try {
          const head = document.querySelector(
            ".v3a-container-write > .v3a-pagehead.v3a-pagehead-sticky"
          );
          const h = head ? head.offsetHeight || 0 : 0;
          v3aSetVditorToolbarStickyTop(h);
        } catch (e) {
          v3aSetVditorToolbarStickyTop(0);
        }
      }

      function v3aAutoGrowTextarea(el) {
        if (!el) return;
        el.style.height = "";
        const baseHeight = el.clientHeight || 0;
        el.style.height = "auto";
        const nextHeight = el.scrollHeight || 0;
        el.style.height = nextHeight > baseHeight ? `${nextHeight}px` : "";
      }

      function autoSizePostText() {
        nextTick(() => v3aAutoGrowTextarea(postTextEl.value));
      }

      function autoSizePageText() {
        nextTick(() => v3aAutoGrowTextarea(pageTextEl.value));
      }

      function v3aDecodeRule(rule) {
        return String(rule || "").replace(/\[([_a-z0-9-]+)[^\]]*\]/gi, "{$1}");
      }

      function v3aCommonUrl(path, prefix) {
        const p = String(prefix || "");
        const cleanPrefix = p.replace(/\/+$/, "");
        const rawPath = String(path || "");
        const cleanPath = rawPath.startsWith("./") ? rawPath.slice(2) : rawPath;
        const normalizedPath = cleanPath.replace(/^\/+/, "").replace(/\/{2,}/g, "/");
        if (!cleanPrefix) return normalizedPath;
        return `${cleanPrefix}/${normalizedPath}`;
      }

      function v3aPad2(n) {
        return String(n).padStart(2, "0");
      }

      function v3aGetPostTimestamp() {
        const created = Number(postForm.created || 0);
        if (created > 0) return created;
        const serverTime = Number(systemInfo.value?.serverTime || 0);
        if (serverTime > 0) return serverTime;
        return Math.floor(Date.now() / 1000);
      }

      function v3aFindCategory(mid) {
        const id = Number(mid || 0);
        if (id <= 0) return null;
        const list = Array.isArray(categoriesAll.value) ? categoriesAll.value : [];
        return list.find((c) => Number(c?.mid || 0) === id) || null;
      }

      function v3aGetPrimaryCategory() {
        const ids = Array.isArray(postForm.categories) ? postForm.categories : [];
        const id = Number(ids[0] || 0) || Number(defaultCategoryId.value || 0) || 0;
        return v3aFindCategory(id);
      }

      function v3aGetCategoryDirectory(category) {
        const cat = category && typeof category === "object" ? category : null;
        if (!cat) return "";

        const list = Array.isArray(categoriesAll.value) ? categoriesAll.value : [];
        const map = new Map(list.map((c) => [Number(c?.mid || 0), c]));

        const parts = [];
        const seen = new Set();
        let current = cat;

        while (current) {
          const mid = Number(current?.mid || 0);
          if (mid <= 0 || seen.has(mid)) break;
          seen.add(mid);

          const slug = String(current?.slug || "").trim();
          if (slug) parts.push(slug);

          const parent = Number(current?.parent || 0);
          current = parent > 0 ? map.get(parent) : null;
        }

        parts.reverse();
        return parts.join("/");
      }

      function v3aFillPostPermalinkParams(template) {
        const raw = String(template || "");
        if (!raw) return "";

        const hasPost = Number(postForm.cid || 0) > 0;
        if (!hasPost) {
          // Align with old Typecho admin: only fill router params when the post already exists.
          return raw;
        }

        const ts = v3aGetPostTimestamp();
        const tz = (() => {
          const v = settingsData?.site?.timezone;
          if (Number.isFinite(Number(v))) return Number(v);
          const vv = V3A && Object.prototype.hasOwnProperty.call(V3A, "timezone") ? V3A.timezone : NaN;
          if (Number.isFinite(Number(vv))) return Number(vv);
          return 0;
        })();
        const date = new Date((ts + tz) * 1000);
        const year = String(date.getUTCFullYear());
        const month = v3aPad2(date.getUTCMonth() + 1);
        const day = v3aPad2(date.getUTCDate());

        const cid = Number(postForm.cid || 0);
        const cat = v3aGetPrimaryCategory();
        const categorySlug = String(cat?.slug || "").trim();
        const directory = v3aGetCategoryDirectory(cat);

        return raw.replace(/\{([_a-z0-9-]+)\}/gi, (match, keyRaw) => {
          const key = String(keyRaw || "").toLowerCase();
          if (key === "slug") return match;
          if (key === "cid") return cid > 0 ? String(cid) : match;
          if (key === "category") {
            return categorySlug ? categorySlug : match;
          }
          if (key === "directory") {
            return directory ? directory : match;
          }
          if (key === "year") return year;
          if (key === "month") return month;
          if (key === "day") return day;
          return match;
        });
      }

      const permalinkPostUrl = ref(String(V3A?.permalink?.postUrl || ""));

      const postSlugPreview = computed(() => {
        const basePrefix = String(V3A.indexUrl || V3A.siteUrl || "").trim();
        const rule = v3aDecodeRule(String(permalinkPostUrl.value || ""));

        if (!basePrefix || !rule) {
          const base = String(V3A.siteUrl || "").trim();
          if (!base) return { prefix: "", suffix: "", hasSlug: true };
          return { prefix: base.endsWith("/") ? base : `${base}/`, suffix: "", hasSlug: true };
        }

        const template = v3aCommonUrl(rule, basePrefix);
        const filled = v3aFillPostPermalinkParams(template);

        const match = filled.match(/\{slug\}/i);
        if (!match || match.index == null) {
          return { prefix: filled, suffix: "", hasSlug: false };
        }

        const idx = match.index;
        const placeholder = match[0];
        return {
          prefix: filled.slice(0, idx),
          suffix: filled.slice(idx + placeholder.length),
          hasSlug: true,
        };
      });

      const postSlugPrefix = computed(() => postSlugPreview.value.prefix);
      const postSlugSuffix = computed(() => postSlugPreview.value.suffix);
      const postSlugHasSlug = computed(() => !!postSlugPreview.value.hasSlug);

      const postSlugInputWidth = computed(() => {
        const len = String(postForm.slug || "").length;
        const placeholderLen = 4; // "slug"
        const width = Math.max(placeholderLen, len || placeholderLen);
        return Math.min(28, width);
      });

      const permalinkPagePattern = computed(() => {
        const raw = String(settingsData?.permalink?.pagePattern || "").trim();
        return raw ? raw : "/{slug}.html";
      });

      function v3aFillPagePermalinkParams(raw) {
        const tpl = String(raw || "");
        const cid = Number(pageForm.cid || 0);
        return tpl.replace(/\{cid\}/gi, (m) => (cid > 0 ? String(cid) : m));
      }

      const pageSlugPreview = computed(() => {
        const basePrefix = String(V3A.indexUrl || V3A.siteUrl || "").trim();
        const rule = v3aDecodeRule(String(permalinkPagePattern.value || ""));

        if (!basePrefix || !rule) {
          const base = String(V3A.siteUrl || "").trim();
          if (!base) return { prefix: "", suffix: "", hasSlug: true };
          return {
            prefix: base.endsWith("/") ? base : `${base}/`,
            suffix: "",
            hasSlug: true,
          };
        }

        const template = v3aCommonUrl(rule, basePrefix);
        const filled = v3aFillPagePermalinkParams(template);

        const match = filled.match(/\{slug\}/i);
        if (!match || match.index == null) {
          return { prefix: filled, suffix: "", hasSlug: false };
        }

        const idx = match.index;
        const placeholder = match[0];
        return {
          prefix: filled.slice(0, idx),
          suffix: filled.slice(idx + placeholder.length),
          hasSlug: true,
        };
      });

      const pageSlugPrefix = computed(() => pageSlugPreview.value.prefix);
      const pageSlugSuffix = computed(() => pageSlugPreview.value.suffix);
      const pageSlugHasSlug = computed(() => !!pageSlugPreview.value.hasSlug);

      const pageSlugInputWidth = computed(() => {
        const len = String(pageForm.slug || "").length;
        const placeholderLen = 4; // "slug"
        const width = Math.max(placeholderLen, len || placeholderLen);
        return Math.min(28, width);
      });

      const postTagInput = ref("");
      const postTagEditorOpen = ref(false);
      const postTagFocused = ref(false);
      const postTagActiveIndex = ref(-1);
      const postTagInputEl = ref(null);

      function splitTagsText(text) {
        const raw = String(text || "");
        const parts = raw.split(/[,，\s]+/u);
        const out = [];
        for (const part of parts) {
          const t = String(part || "").trim();
          if (!t) continue;
          out.push(t);
        }
        return out;
      }

      const postTags = computed(() => {
        const tags = splitTagsText(postForm.tags);
        return Array.from(new Set(tags));
      });

      function setPostTags(tags) {
        const uniq = Array.from(new Set((tags || []).map((t) => String(t || "").trim()).filter(Boolean)));
        postForm.tags = uniq.join(",");
      }

      function addPostTag() {
        const toAdd = splitTagsText(postTagInput.value);
        postTagInput.value = "";
        if (!toAdd.length) return;
        setPostTags([...(postTags.value || []), ...toAdd]);
      }

      function removePostTag(tag) {
        const t = String(tag || "").trim();
        if (!t) return;
        setPostTags((postTags.value || []).filter((x) => x !== t));
      }

      const postTagSuggestions = computed(() => {
        if (!postTagFocused.value) return [];
        const q = String(postTagInput.value || "").trim();
        if (!q) return [];

        const existing = new Set((postTags.value || []).map((t) => String(t || "")));
        const all = Array.isArray(tagsAll.value) ? tagsAll.value : [];
        const out = [];
        const lowered = q.toLowerCase();

        for (const row of all) {
          const name = row && typeof row === "object" ? String(row.name || "") : "";
          if (!name) continue;
          if (existing.has(name)) continue;
          if (!name.toLowerCase().includes(lowered)) continue;
          out.push(name);
          if (out.length >= 8) break;
        }

        return out;
      });

      watch(postTagInput, () => {
        if (!postTagFocused.value) return;
        postTagActiveIndex.value = 0;
      });

      function selectTagSuggestion(name) {
        const t = String(name || "").trim();
        if (!t) return;
        setPostTags([...(postTags.value || []), t]);
        postTagInput.value = "";
        postTagActiveIndex.value = -1;
        nextTick(() => {
          const el = postTagInputEl.value;
          if (el && typeof el.focus === "function") el.focus();
        });
      }

      function onPostTagFocus() {
        postTagFocused.value = true;
        if (postTagSuggestions.value.length) {
          postTagActiveIndex.value = 0;
        }
      }

      function onPostTagBlur() {
        addPostTag();
        postTagFocused.value = false;
        postTagActiveIndex.value = -1;
        postTagEditorOpen.value = false;
      }

      function openPostTagEditor() {
        postTagEditorOpen.value = true;
        nextTick(() => {
          const el = postTagInputEl.value;
          if (el && typeof el.focus === "function") el.focus();
        });
      }

      function onPostTagKeydown(e) {
        const key = e && e.key ? String(e.key) : "";
        const list = postTagSuggestions.value || [];

        if (key === "ArrowDown" && list.length) {
          e.preventDefault();
          const next = postTagActiveIndex.value < 0 ? 0 : postTagActiveIndex.value + 1;
          postTagActiveIndex.value = next >= list.length ? 0 : next;
          return;
        }

        if (key === "ArrowUp" && list.length) {
          e.preventDefault();
          const next = postTagActiveIndex.value <= 0 ? list.length - 1 : postTagActiveIndex.value - 1;
          postTagActiveIndex.value = next;
          return;
        }

        if (key === "Enter") {
          e.preventDefault();
          const raw = String(postTagInput.value || "");
          const single = !/[,，\s]/.test(raw);
          if (single && list.length && postTagActiveIndex.value >= 0 && postTagActiveIndex.value < list.length) {
            selectTagSuggestion(list[postTagActiveIndex.value]);
            return;
          }
          addPostTag();
          return;
        }

        if (key === "Escape") {
          postTagInput.value = "";
          postTagActiveIndex.value = -1;
        }
      }

      const categorySelectOpen = ref(false);
      const categorySelectEl = ref(null);

      const postSelectedCategories = computed(() => {
        const ids = Array.isArray(postForm.categories) ? postForm.categories : [];
        const seen = new Set();
        const out = [];
        for (const raw of ids) {
          const id = Number(raw || 0);
          if (id <= 0 || seen.has(id)) continue;
          seen.add(id);
          const cat = v3aFindCategory(id);
          if (cat) out.push(cat);
        }
        return out;
      });

      function toggleCategorySelect(force) {
        if (typeof force === "boolean") {
          categorySelectOpen.value = force;
          return;
        }
        categorySelectOpen.value = !categorySelectOpen.value;
      }

      function isPostCategorySelected(mid) {
        const id = Number(mid || 0);
        if (id <= 0) return false;
        return Array.isArray(postForm.categories) && postForm.categories.some((x) => Number(x || 0) === id);
      }

      function togglePostCategory(mid) {
        const id = Number(mid || 0);
        if (id <= 0) return;

        const idx = Array.isArray(postForm.categories)
          ? postForm.categories.findIndex((x) => Number(x || 0) === id)
          : -1;

        if (idx >= 0) {
          postForm.categories.splice(idx, 1);
          return;
        }

        postForm.categories.push(id);
      }

      function removePostCategory(mid) {
        const id = Number(mid || 0);
        if (id <= 0) return;
        postForm.categories.splice(
          0,
          postForm.categories.length,
          ...(postForm.categories || []).filter((x) => Number(x || 0) !== id)
        );
      }

      // Files
      const filesLoading = ref(false);
      const filesError = ref("");
      const filesUploading = ref(false);
      const filesKeywords = ref("");
      const filesItems = ref([]);
      const filesPagination = reactive({
        page: 1,
        pageSize: 20,
        total: 0,
        pageCount: 1,
      });
      const filePreviewOpen = ref(false);
      const filePreviewItem = ref(null);

      function fileUrlFor(item) {
        const it = item && typeof item === "object" ? item : null;
        return it && it.file && it.file.url ? String(it.file.url || "") : "";
      }

      function fileTitleFor(item) {
        const it = item && typeof item === "object" ? item : null;
        if (!it) return "";
        return (
          String(it.title || "") ||
          (it.file && it.file.name ? String(it.file.name || "") : "") ||
          `附件 #${Number(it.cid || 0) || 0}`
        );
      }

      function fileMimeFor(item) {
        const it = item && typeof item === "object" ? item : null;
        if (!it || !it.file) return "";
        return String(it.file.mime || it.file.type || "");
      }

      function fileBytesFor(item) {
        const it = item && typeof item === "object" ? item : null;
        if (!it || !it.file) return "";
        return String(it.file.bytes || "");
      }

      function fileMetaFor(item) {
        const mime = fileMimeFor(item) || "—";
        const bytes = fileBytesFor(item) || "—";
        return `${mime} · ${bytes}`;
      }

      function isFileImage(item) {
        const it = item && typeof item === "object" ? item : null;
        if (!it || !it.file) return false;
        if (it.file.isImage) return true;
        const mime = fileMimeFor(it).toLowerCase();
        return mime.startsWith("image/");
      }

      function isFileVideo(item) {
        const it = item && typeof item === "object" ? item : null;
        if (!it || !it.file) return false;
        const mime = fileMimeFor(it).toLowerCase();
        return mime.startsWith("video/");
      }

      const filePreviewUrl = computed(() => fileUrlFor(filePreviewItem.value));
      const filePreviewIsImage = computed(() => isFileImage(filePreviewItem.value));
      const filePreviewIsVideo = computed(() => isFileVideo(filePreviewItem.value));

      function openFilePreview(item) {
        const it = item && typeof item === "object" ? item : null;
        if (!it) return;
        const url = fileUrlFor(it);
        if (!url) return;
        if (isFileImage(it) || isFileVideo(it)) {
          filePreviewItem.value = it;
          filePreviewOpen.value = true;
          return;
        }
        openFile(url);
      }

      function closeFilePreview() {
        filePreviewOpen.value = false;
        filePreviewItem.value = null;
      }

      const filesSelectMode = ref(false);
      const filesSelectedIds = ref([]);
      const filesUploadModalOpen = ref(false);
      const filesUploadDragging = ref(false);
      const filesUploadInputEl = ref(null);

      function toggleFilesSelectMode() {
        filesSelectMode.value = !filesSelectMode.value;
        filesSelectedIds.value = [];
      }

      function isFileSelected(cid) {
        const id = Number(cid || 0);
        if (!id) return false;
        return filesSelectedIds.value.includes(id);
      }

      function toggleFileSelected(cid) {
        const id = Number(cid || 0);
        if (!id) return;
        const list = filesSelectedIds.value;
        const idx = list.indexOf(id);
        if (idx >= 0) {
          list.splice(idx, 1);
        } else {
          list.push(id);
        }
      }

      function onFileItemActivate(file) {
        if (filesSelectMode.value) {
          toggleFileSelected(file && file.cid);
          return;
        }
        openFilePreview(file);
      }

      async function deleteSelectedFiles() {
        const ids = (filesSelectedIds.value || [])
          .map((x) => Number(x || 0))
          .filter((x) => x > 0);
        if (!ids.length) return;
        if (!confirm(`确认删除选中的 ${ids.length} 个文件吗？此操作不可恢复。`)) return;

        filesError.value = "";
        try {
          await apiPost("files.delete", { cids: ids });
          filesSelectedIds.value = [];
          await fetchFiles();
        } catch (e) {
          filesError.value = e && e.message ? e.message : "删除失败";
        }
      }

      function refreshFiles() {
        fetchFiles();
      }

      function openFilesUploadModal() {
        filesUploadModalOpen.value = true;
        filesUploadDragging.value = false;
      }

      function closeFilesUploadModal() {
        filesUploadModalOpen.value = false;
        filesUploadDragging.value = false;
      }

      async function uploadFilesFromModal(fileList) {
        await uploadFiles(fileList);
        if (!filesError.value) {
          closeFilesUploadModal();
        }
      }

      function onFilesUploadDrop(e) {
        filesUploadDragging.value = false;
        const dt = e && e.dataTransfer ? e.dataTransfer : null;
        const files = dt && dt.files ? dt.files : null;
        if (!files || !files.length) return;
        uploadFilesFromModal(files);
      }

      function onFilesUploadInputChange(e) {
        const files = e && e.target && e.target.files ? e.target.files : null;
        if (e && e.target) e.target.value = "";
        if (!files || !files.length) return;
        uploadFilesFromModal(files);
      }

      // Friends (mx-admin like)
      const friendsLoading = ref(false);
      const friendsError = ref("");
      const friendsItems = ref([]);
      const friendsPagination = reactive({
        page: 1,
        pageSize: 50,
        total: 0,
        pageCount: 1,
      });
      const friendsPageJump = ref(1);

      const friendsState = ref(0); // 0=friends,1=audit,2=outdate,3=reject,4=banned
      const friendsStateCount = reactive({
        friends: 0,
        audit: 0,
        outdate: 0,
        reject: 0,
        banned: 0,
      });

      const friendsHealth = ref({});
      const friendsHealthChecking = ref(false);
      const friendsMigrateWorking = ref(false);

      function normalizeFriendsState(v) {
        const n = Number(v);
        if (!Number.isFinite(n)) return 0;
        const i = Math.floor(n);
        if (i < 0 || i > 4) return 0;
        return i;
      }

      function friendTypeLabel(type) {
        const t = String(type || "");
        if (t === "friend") return "朋友";
        if (t === "collection") return "收藏";
        return t || "—";
      }

      function friendInitial(name) {
        const s = String(name || "").trim();
        if (!s) return "—";
        return s.slice(0, 1);
      }

      async function fetchFriendsStateCount() {
        try {
          const data = await apiGet("friends.stateCount");
          Object.assign(friendsStateCount, data || {});

          // Keep dashboard badges in sync (best-effort)
          summary.value.friendLinks = Number(friendsStateCount.friends || 0) || 0;
          summary.value.friendLinkApply = Number(friendsStateCount.audit || 0) || 0;
        } catch (e) {
        }
      }

      async function fetchFriends() {
        friendsLoading.value = true;
        friendsError.value = "";
        try {
          const data = await apiGet("friends.list", {
            state: friendsState.value,
            page: friendsPagination.page,
            pageSize: friendsPagination.pageSize,
          });
          friendsItems.value = Array.isArray(data?.items) ? data.items : [];
          Object.assign(friendsPagination, data?.pagination || {});
          friendsPageJump.value = Number(friendsPagination.page || 1) || 1;
        } catch (e) {
          friendsItems.value = [];
          friendsError.value = e && e.message ? e.message : "加载失败";
        } finally {
          friendsLoading.value = false;
        }
      }

      async function initFriendsFromRoute() {
        const nextState = normalizeFriendsState(routeQuery.value?.state);
        const shouldOpenNew = String(routeQuery.value?.new || "") === "1";

        if (friendsState.value !== nextState) {
          friendsState.value = nextState;
          friendsPagination.page = 1;
          friendsPageJump.value = 1;
        }

        await fetchFriendsStateCount();
        await fetchFriends();

        if (shouldOpenNew) {
          openFriendEditor(null);
        }
      }

      function setFriendsState(state) {
        const s = normalizeFriendsState(state);
        navTo(`/friends?state=${s}`);
      }

      function friendsGoPage(page) {
        const p = Number(page || 1);
        if (!Number.isFinite(p)) return;
        const next = Math.max(1, Math.min(friendsPagination.pageCount || 1, p));
        if (next === friendsPagination.page) return;
        friendsPagination.page = next;
        friendsPageJump.value = next;
        fetchFriends();
      }

      const friendEditorOpen = ref(false);
      const friendEditorSaving = ref(false);
      const friendEditorError = ref("");
      const friendEditorForm = reactive({
        id: 0,
        name: "",
        url: "",
        avatar: "",
        description: "",
        type: "friend",
        email: "",
        status: 1,
      });

      function resetFriendEditorForm() {
        friendEditorForm.id = 0;
        friendEditorForm.name = "";
        friendEditorForm.url = "";
        friendEditorForm.avatar = "";
        friendEditorForm.description = "";
        friendEditorForm.type = "friend";
        friendEditorForm.email = "";
        friendEditorForm.status = 1;
      }

      function openFriendEditor(row) {
        friendEditorError.value = "";
        resetFriendEditorForm();

        if (row && typeof row === "object") {
          friendEditorForm.id = Number(row.id || 0) || 0;
          friendEditorForm.name = String(row.name || "");
          friendEditorForm.url = String(row.url || "");
          friendEditorForm.avatar = String(row.avatar || "");
          friendEditorForm.description = String(row.description || "");
          friendEditorForm.type = String(row.type || "friend") || "friend";
          friendEditorForm.email = String(row.email || "");
          friendEditorForm.status = Number(row.status || 1) || 1;
        }

        friendEditorOpen.value = true;
      }

      function closeFriendEditor() {
        friendEditorOpen.value = false;
        friendEditorError.value = "";
      }

      async function submitFriendEditor() {
        friendEditorSaving.value = true;
        friendEditorError.value = "";
        try {
          const payload = {
            id: friendEditorForm.id,
            name: friendEditorForm.name,
            url: friendEditorForm.url,
            avatar: friendEditorForm.avatar,
            description: friendEditorForm.description,
            type: friendEditorForm.type,
            email: friendEditorForm.email,
            status: friendEditorForm.status,
          };

          await apiPost("friends.save", payload);
          friendEditorOpen.value = false;
          toastSuccess("保存成功");
          await fetchFriendsStateCount();
          await fetchFriends();
        } catch (e) {
          friendEditorError.value = e && e.message ? e.message : "保存失败";
        } finally {
          friendEditorSaving.value = false;
        }
      }

      async function deleteFriend(row) {
        const id = Number(row && row.id ? row.id : 0);
        if (!id) return;
        if (!confirm(`确认移除友链「${String(row?.name || "") || "#" + id}」吗？`)) return;

        friendsError.value = "";
        try {
          await apiPost("friends.delete", { id });
          toastSuccess("已移除");
          await fetchFriendsStateCount();
          await fetchFriends();
        } catch (e) {
          friendsError.value = e && e.message ? e.message : "移除失败";
        }
      }

      async function deleteFriendApply(row) {
        const id = Number(row && row.id ? row.id : 0);
        if (!id) return;
        if (
          !confirm(
            `确认移除友链申请「${String(row?.name || "") || "#" + id}」吗？`
          )
        )
          return;

        friendsError.value = "";
        try {
          await apiPost("friends.apply.delete", { id });
          toastSuccess("已移除");
          await fetchFriendsStateCount();
          await fetchFriends();
        } catch (e) {
          friendsError.value = e && e.message ? e.message : "移除失败";
        }
      }

      async function auditFriendApply(row, action) {
        const id = Number(row && row.id ? row.id : 0);
        if (!id) return;
        const name = String(row?.name || "") || "#" + id;
        const act = String(action || "");
        if (act === "pass") {
          if (!confirm(`确认通过「${name}」的友链申请吗？`)) return;
        } else if (act === "reject") {
          if (!confirm(`确认拒绝「${name}」的友链申请吗？`)) return;
        } else {
          return;
        }

        friendsError.value = "";
        try {
          await apiPost("friends.apply.audit", { id, action: act });
          toastSuccess("操作成功");
          await fetchFriendsStateCount();
          await fetchFriends();
        } catch (e) {
          friendsError.value = e && e.message ? e.message : "操作失败";
        }
      }

      async function checkFriendsHealth() {
        friendsHealthChecking.value = true;
        friendsError.value = "";
        try {
          const data = await apiPost("friends.checkHealth", {
            timeoutMs: 8000,
            limit: 200,
          });
          friendsHealth.value = data && typeof data === "object" ? data : {};
          toastSuccess("检查完成");
        } catch (e) {
          friendsError.value = e && e.message ? e.message : "检查失败";
        } finally {
          friendsHealthChecking.value = false;
        }
      }

      async function migrateFriendAvatars() {
        if (!confirm("迁移头像会把远程头像转为内嵌数据，是否继续？")) return;
        friendsMigrateWorking.value = true;
        friendsError.value = "";
        try {
          const data = await apiPost("friends.migrateAvatars", {
            timeoutMs: 15000,
            limit: 200,
            maxBytes: 60000,
          });
          toastSuccess(`迁移完成：${Number(data?.migrated || 0) || 0} 个`);
          await fetchFriends();
        } catch (e) {
          friendsError.value = e && e.message ? e.message : "迁移失败";
        } finally {
          friendsMigrateWorking.value = false;
        }
      }

      // Friends settings (front-end apply templates)
      const friendsSettingsOpen = ref(false);
      const friendsSettingsLoading = ref(false);
      const friendsSettingsSaving = ref(false);
      const friendsSettingsError = ref("");
      const friendsSettingsForm = reactive({
        allowTypeSelect: 0,
        defaultType: "friend",
        allowedTypes: {
          friend: 1,
          collection: 0,
        },
        required: {
          email: 0,
          avatar: 0,
          description: 0,
          message: 0,
        },
      });

      function normalizeFriendsSettingsForm() {
        friendsSettingsForm.allowTypeSelect = Number(friendsSettingsForm.allowTypeSelect)
          ? 1
          : 0;

        friendsSettingsForm.allowedTypes.friend = Number(
          friendsSettingsForm.allowedTypes.friend
        )
          ? 1
          : 0;
        friendsSettingsForm.allowedTypes.collection = Number(
          friendsSettingsForm.allowedTypes.collection
        )
          ? 1
          : 0;

        if (
          !friendsSettingsForm.allowedTypes.friend &&
          !friendsSettingsForm.allowedTypes.collection
        ) {
          friendsSettingsForm.allowedTypes.friend = 1;
        }

        const dt = String(friendsSettingsForm.defaultType || "friend");
        friendsSettingsForm.defaultType =
          dt === "collection" ? "collection" : "friend";

        if (!friendsSettingsForm.allowedTypes[friendsSettingsForm.defaultType]) {
          friendsSettingsForm.defaultType = friendsSettingsForm.allowedTypes.friend
            ? "friend"
            : "collection";
        }

        friendsSettingsForm.required.email = Number(friendsSettingsForm.required.email)
          ? 1
          : 0;
        friendsSettingsForm.required.avatar = Number(
          friendsSettingsForm.required.avatar
        )
          ? 1
          : 0;
        friendsSettingsForm.required.description = Number(
          friendsSettingsForm.required.description
        )
          ? 1
          : 0;
        friendsSettingsForm.required.message = Number(
          friendsSettingsForm.required.message
        )
          ? 1
          : 0;
      }

      function applyFriendsSettings(data) {
        const d = data && typeof data === "object" ? data : {};
        friendsSettingsForm.allowTypeSelect = Number(d.allowTypeSelect || 0) ? 1 : 0;

        const at = d.allowedTypes && typeof d.allowedTypes === "object" ? d.allowedTypes : {};
        friendsSettingsForm.allowedTypes.friend = Number(at.friend || 0) ? 1 : 0;
        friendsSettingsForm.allowedTypes.collection = Number(at.collection || 0) ? 1 : 0;

        const dt = String(d.defaultType || "friend");
        friendsSettingsForm.defaultType = dt === "collection" ? "collection" : "friend";

        const req = d.required && typeof d.required === "object" ? d.required : {};
        friendsSettingsForm.required.email = Number(req.email || 0) ? 1 : 0;
        friendsSettingsForm.required.avatar = Number(req.avatar || 0) ? 1 : 0;
        friendsSettingsForm.required.description = Number(req.description || 0) ? 1 : 0;
        friendsSettingsForm.required.message = Number(req.message || 0) ? 1 : 0;

        normalizeFriendsSettingsForm();
      }

      async function openFriendsSettings() {
        friendsSettingsError.value = "";
        friendsSettingsLoading.value = true;
        friendsSettingsOpen.value = true;
        try {
          const data = await apiGet("friends.settings.get");
          applyFriendsSettings(data);
        } catch (e) {
          friendsSettingsError.value =
            e && e.message ? e.message : "加载失败";
        } finally {
          friendsSettingsLoading.value = false;
        }
      }

      function closeFriendsSettings() {
        friendsSettingsOpen.value = false;
      }

      async function saveFriendsSettings() {
        normalizeFriendsSettingsForm();
        friendsSettingsSaving.value = true;
        friendsSettingsError.value = "";
        try {
          const data = await apiPost("friends.settings.save", friendsSettingsForm);
          applyFriendsSettings(data);
          toastSuccess("已保存");
          friendsSettingsOpen.value = false;
        } catch (e) {
          friendsSettingsError.value =
            e && e.message ? e.message : "保存失败";
        } finally {
          friendsSettingsSaving.value = false;
        }
      }

      // Data (IP / PV)
      const dataVisitLoading = ref(false);
      const dataVisitError = ref("");
      const dataVisitItems = ref([]);
      const dataVisitTraffic = ref({
        windowDays: 14,
        trend: [],
        referringSites: [],
        popularContent: [],
      });
      const dataVisitFilters = reactive({
        keywords: "",
        onlyPosts: false,
      });
      const dataVisitPagination = reactive({
        page: 1,
        pageSize: 20,
        total: 0,
        pageCount: 1,
      });
      const dataVisitPageJump = ref(1);

      function dataDeviceTone(type) {
        const t = String(type || "");
        if (t === "bot") return "danger";
        if (t === "mobile") return "warn";
        if (t === "tablet") return "";
        if (t === "desktop") return "success";
        return "";
      }

      async function fetchDataVisits() {
        dataVisitLoading.value = true;
        dataVisitError.value = "";
        try {
          const data = await apiGet("data.visit.list", {
            page: dataVisitPagination.page,
            pageSize: dataVisitPagination.pageSize,
            keywords: dataVisitFilters.keywords,
            onlyPosts: dataVisitFilters.onlyPosts ? 1 : 0,
          });
          dataVisitItems.value = Array.isArray(data?.items) ? data.items : [];
          const traffic =
            data && typeof data === "object" && data.traffic && typeof data.traffic === "object"
              ? data.traffic
              : null;
          dataVisitTraffic.value = {
            windowDays: traffic ? Number(traffic.windowDays || 14) || 14 : 14,
            trend: traffic && Array.isArray(traffic.trend) ? traffic.trend : [],
            referringSites:
              traffic && Array.isArray(traffic.referringSites) ? traffic.referringSites : [],
            popularContent:
              traffic && Array.isArray(traffic.popularContent) ? traffic.popularContent : [],
          };
          Object.assign(dataVisitPagination, data?.pagination || {});
          dataVisitPageJump.value = Number(dataVisitPagination.page || 1) || 1;
        } catch (e) {
          dataVisitItems.value = [];
          dataVisitTraffic.value = { windowDays: 14, trend: [], referringSites: [], popularContent: [] };
          dataVisitError.value = e && e.message ? e.message : "加载失败";
        } finally {
          dataVisitLoading.value = false;
        }
      }

      function applyDataVisitFilters() {
        dataVisitPagination.page = 1;
        fetchDataVisits();
      }

      function dataVisitGoPage(p) {
        const pageCount = Number(dataVisitPagination.pageCount || 1) || 1;
        const next = Math.max(1, Math.min(Number(p || 1) || 1, pageCount));
        dataVisitPagination.page = next;
        fetchDataVisits();
      }

      async function refreshData() {
        await fetchDataVisits();
        await nextTick();
        renderCharts();
      }

      // Backup (maintenance)
      const backupLoading = ref(false);
      const backupWorking = ref(false);
      const backupError = ref("");
      const backupDir = ref("");
      const backupItems = ref([]);
      const backupRestoreMode = ref("upload"); // upload|server
      const backupUploadEl = ref(null);
      const backupUploadFile = ref(null);

      function formatBytes(bytes) {
        const n = Number(bytes || 0);
        if (!Number.isFinite(n) || n <= 0) return "—";
        const units = ["B", "KB", "MB", "GB", "TB"];
        let v = n;
        let i = 0;
        while (v >= 1024 && i < units.length - 1) {
          v /= 1024;
          i++;
        }
        const fixed = i === 0 ? 0 : v >= 100 ? 0 : v >= 10 ? 1 : 2;
        return `${v.toFixed(fixed)} ${units[i]}`;
      }

      function backupDownloadUrl(file) {
        const f = String(file || "").trim();
        if (!f) return "";
        return buildApiUrl("backup.download", { file: f }, true);
      }

      async function fetchBackups() {
        backupLoading.value = true;
        backupError.value = "";
        try {
          const data = await apiGet("backup.list");
          backupDir.value = String(data?.dir || "");
          backupItems.value = Array.isArray(data?.items) ? data.items : [];
        } catch (e) {
          backupItems.value = [];
          backupError.value = e && e.message ? e.message : "加载失败";
        } finally {
          backupLoading.value = false;
        }
      }

      async function exportBackup() {
        if (backupWorking.value) return;
        if (!confirm("开始备份？将生成 .dat 文件用于恢复数据。")) return;
        backupWorking.value = true;
        backupError.value = "";
        try {
          const data = await apiPost("backup.export", {});
          const file = String(data?.file || "");
          await fetchBackups();
          toastSuccess("备份已生成");
          const url = backupDownloadUrl(file);
          if (url) window.open(url, "_blank", "noreferrer");
        } catch (e) {
          backupError.value = e && e.message ? e.message : "备份失败";
          toastError(backupError.value);
        } finally {
          backupWorking.value = false;
        }
      }

      function downloadBackup(file) {
        const url = backupDownloadUrl(file);
        if (!url) return;
        window.open(url, "_blank", "noreferrer");
      }

      async function deleteBackup(file) {
        const f = String(file || "").trim();
        if (!f) return;
        if (!confirm(`确认删除备份文件：${f}？`)) return;
        backupWorking.value = true;
        backupError.value = "";
        try {
          await apiPost("backup.delete", { file: f });
          await fetchBackups();
          toastSuccess("已删除");
        } catch (e) {
          backupError.value = e && e.message ? e.message : "删除失败";
          toastError(backupError.value);
        } finally {
          backupWorking.value = false;
        }
      }

      async function restoreBackupFromServer(file) {
        const f = String(file || "").trim();
        if (!f) return;
        if (!confirm("恢复操作将清除所有现有数据，是否继续？")) return;
        backupWorking.value = true;
        backupError.value = "";
        try {
          await apiPost("backup.import", { file: f });
          toastSuccess("恢复完成（建议刷新页面）");
        } catch (e) {
          backupError.value = e && e.message ? e.message : "恢复失败";
          toastError(backupError.value);
        } finally {
          backupWorking.value = false;
        }
      }

      function onBackupUploadChange(e) {
        const files = e && e.target && e.target.files ? e.target.files : null;
        backupUploadFile.value = files && files.length ? files[0] : null;
      }

      async function restoreBackupFromUpload() {
        const file = backupUploadFile.value;
        if (!file) {
          toastError("请选择备份文件");
          return;
        }
        if (!confirm("恢复操作将清除所有现有数据，是否继续？")) return;

        backupWorking.value = true;
        backupError.value = "";
        try {
          const url = buildApiUrl("backup.import", null, true);
          const form = new FormData();
          form.append("file", file, file.name);

          const res = await fetch(url, {
            method: "POST",
            credentials: "same-origin",
            headers: { "X-Requested-With": "XMLHttpRequest", Accept: "application/json" },
            body: form,
          });
          const json = await readApiJson(res);
          if (!json || json.code !== 0) {
            throw new Error(json?.message || "恢复失败");
          }

          backupUploadFile.value = null;
          try {
            if (backupUploadEl.value) backupUploadEl.value.value = "";
          } catch (e) {}

          toastSuccess("恢复完成（建议刷新页面）");
        } catch (e) {
          backupError.value = e && e.message ? e.message : "恢复失败";
          toastError(backupError.value);
        } finally {
          backupWorking.value = false;
        }
      }

      // System Ops (maintenance/upgrade)
      const v3aDataModalOpen = ref(false);
      const v3aDataWorking = ref(false);
      const v3aDataImportEl = ref(null);
      const v3aDataImportFile = ref(null);
      const v3aDataExportFile = ref("");

      function openV3aDataModal() {
        v3aDataModalOpen.value = true;
      }

      function closeV3aDataModal() {
        if (v3aDataWorking.value) return;
        v3aDataModalOpen.value = false;
      }

      function onV3aDataImportChange(e) {
        const files = e && e.target && e.target.files ? e.target.files : null;
        v3aDataImportFile.value = files && files.length ? files[0] : null;
      }

      function v3aDataDownloadUrl(file) {
        const f = String(file || "").trim();
        if (!f) return "";
        return buildApiUrl("v3a.data.download", { file: f }, true);
      }

      async function exportV3aData() {
        if (v3aDataWorking.value) return;
        v3aDataWorking.value = true;
        try {
          const data = await apiPost("v3a.data.export", {});
          const file = String(data?.file || "");
          v3aDataExportFile.value = file;
          toastSuccess("导出完成");
          const url = v3aDataDownloadUrl(file);
          if (url) window.open(url, "_blank", "noreferrer");
        } catch (e) {
          toastError(e && e.message ? e.message : "导出失败");
        } finally {
          v3aDataWorking.value = false;
        }
      }

      async function importV3aData() {
        const file = v3aDataImportFile.value;
        if (!file) {
          toastError("请选择 .zip 文件");
          return;
        }
        if (!confirm("导入将覆盖当前本地数据（会自动备份旧数据），是否继续？")) return;

        v3aDataWorking.value = true;
        try {
          const url = buildApiUrl("v3a.data.import", null, true);
          const form = new FormData();
          form.append("file", file, file.name);

          const res = await fetch(url, {
            method: "POST",
            credentials: "same-origin",
            headers: { "X-Requested-With": "XMLHttpRequest", Accept: "application/json" },
            body: form,
          });
          const json = await readApiJson(res);
          if (!json || json.code !== 0) {
            throw new Error(json?.message || "导入失败");
          }

          v3aDataImportFile.value = null;
          try {
            if (v3aDataImportEl.value) v3aDataImportEl.value.value = "";
          } catch (e) {}

          toastSuccess("导入完成（建议刷新页面）");
          v3aDataModalOpen.value = false;
        } catch (e) {
          toastError(e && e.message ? e.message : "导入失败");
        } finally {
          v3aDataWorking.value = false;
        }
      }

      const v3aLegacyModalOpen = ref(false);
      const v3aLegacyWorking = ref(false);

      function openV3aLegacyModal() {
        v3aLegacyModalOpen.value = true;
      }

      function closeV3aLegacyModal() {
        if (v3aLegacyWorking.value) return;
        v3aLegacyModalOpen.value = false;
      }

      async function runV3aLegacyMaintenance() {
        if (v3aLegacyWorking.value) return;
        if (!confirm("将迁移旧版本数据库表数据到本地存储，并删除旧表（不可逆），是否继续？")) return;

        v3aLegacyWorking.value = true;
        try {
          const data = await apiPost("v3a.legacy.maintain", {});
          if (!Number(data?.migrated || 0)) {
            toastInfo("未发现旧版本 v3a_* 数据表，未执行迁移");
            v3aLegacyModalOpen.value = false;
            return;
          }

          const counts = data?.counts || {};
          const visit = Number(counts.visit || 0) || 0;
          const friend = Number(counts.friend || 0) || 0;
          const api = Number(counts.api || 0) || 0;
          const apply = Number(counts.apply || 0) || 0;
          const subscribe = Number(counts.subscribe || 0) || 0;
          const like = Number(counts.like || 0) || 0;
          const total = visit + friend + api + apply + subscribe + like;
          const backup = String(data?.backup || "");
          const msg = `维护完成（visit: ${visit}, friends: ${friend}${backup ? `, backup: ${backup}` : ""}）`;

          if (total <= 0) {
            toastInfo("维护完成，但未迁移到任何数据（可能旧表为空/表前缀不一致）");
          } else {
            toastSuccess(msg);
          }
          v3aLegacyModalOpen.value = false;
        } catch (e) {
          toastError(e && e.message ? e.message : "维护失败");
        } finally {
          v3aLegacyWorking.value = false;
        }
      }

      // Upgrade (maintenance)
      const upgradeLoading = ref(false);
      const upgradeWorking = ref(false);
      const upgradeError = ref("");
      const upgradeCurrent = ref(null);
      const upgradeLatest = ref(null);
      const upgradeReleases = ref([]);
      const upgradeUpdateAvailable = ref(0);
      const upgradeLatestCommit = ref(null);
      const upgradeStrictUpdateAvailable = ref(0);

      const upgradeConfirmOpen = ref(false);
      const upgradeSettingsOpen = ref(false);
	      const upgradeSettingsLoading = ref(false);
	      const upgradeSettingsSaving = ref(false);
	      const upgradeSettingsForm = reactive({
	        strict: 0,
	        globalReplace: 0,
	        network: "github",
	      });

      const upgradeModeLabel = computed(() =>
        upgradeSettingsForm.strict ? "严格升级（commit）" : "Release 升级"
      );
      const upgradeReplaceLabel = computed(() =>
        upgradeSettingsForm.globalReplace ? "开启全局替换" : "关闭全局替换"
      );

	      async function fetchUpgradeSettings() {
	        if (upgradeSettingsLoading.value) return;
	        upgradeSettingsLoading.value = true;
	        try {
	          const data = await apiGet("upgrade.settings.get");
	          upgradeSettingsForm.strict = Number(data?.strict || 0) ? 1 : 0;
	          upgradeSettingsForm.globalReplace = Number(data?.globalReplace || 0) ? 1 : 0;
	          const network = String(data?.network || "").trim();
	          upgradeSettingsForm.network = ["gitcode", "github", "ghfast"].includes(network)
	            ? network
	            : "github";
	        } catch (e) {
	          // ignore, keep defaults
	        } finally {
	          upgradeSettingsLoading.value = false;
	        }
	      }

      async function fetchUpgradeInfo() {
        if (upgradeLoading.value) return;
        upgradeLoading.value = true;
        upgradeError.value = "";
	        try {
	          const data = await apiGet("upgrade.releases", {
	            strict: upgradeSettingsForm.strict ? 1 : 0,
	            network: upgradeSettingsForm.network || "github",
	          });
	          upgradeCurrent.value = data?.current || null;
	          upgradeLatest.value = data?.latest || null;
	          upgradeReleases.value = Array.isArray(data?.releases) ? data.releases : [];
	          upgradeUpdateAvailable.value = Number(data?.updateAvailable || 0) ? 1 : 0;
          upgradeLatestCommit.value = data?.latestCommit || null;
          upgradeStrictUpdateAvailable.value = Number(data?.strictUpdateAvailable || 0) ? 1 : 0;
        } catch (e) {
          upgradeError.value = e && e.message ? e.message : "加载失败";
        } finally {
          upgradeLoading.value = false;
        }
      }

      function isoToTs(iso) {
        const s = String(iso || "").trim();
        if (!s) return 0;
        const ms = Date.parse(s);
        if (!Number.isFinite(ms)) return 0;
        return Math.floor(ms / 1000);
      }

      function openExternal(url) {
        const u = String(url || "").trim();
        if (!u) return;
        try {
          window.open(u, "_blank", "noreferrer");
        } catch (e) {}
      }

      function openUpgradeConfirm() {
        if (upgradeWorking.value) return;

        const hasUpdate = upgradeSettingsForm.strict
          ? !!upgradeStrictUpdateAvailable.value
          : !!upgradeUpdateAvailable.value;
        if (!hasUpdate) {
          toastInfo("当前已是最新版本");
          return;
        }

        upgradeConfirmOpen.value = true;
      }

      function closeUpgradeConfirm() {
        upgradeConfirmOpen.value = false;
      }

      async function confirmUpgrade() {
        if (upgradeWorking.value) return;
        upgradeConfirmOpen.value = false;
        await doUpgrade();
      }

      async function doUpgrade() {
        if (upgradeWorking.value) return;

        const hasUpdate = upgradeSettingsForm.strict
          ? !!upgradeStrictUpdateAvailable.value
          : !!upgradeUpdateAvailable.value;
        if (!hasUpdate) {
          toastInfo("当前已是最新版本");
          return;
        }

        const strict = upgradeSettingsForm.strict ? 1 : 0;
        const globalReplace = upgradeSettingsForm.globalReplace ? 1 : 0;

        upgradeWorking.value = true;
        try {
	        const data = await apiPost("upgrade.run", {
	            strict,
	            globalReplace,
	            network: upgradeSettingsForm.network || "github",
	          });

          toastSuccess("升级完成", {
            actionLabel: "刷新页面",
            action: () => {
              try {
                location.reload();
              } catch (e) {}
            },
            duration: 0,
          });

          if (data?.message) {
            toastInfo(String(data.message || ""), { duration: 6000 });
          }

          await fetchUpgradeSettings();
          await fetchUpgradeInfo();
        } catch (e) {
          toastError(e && e.message ? e.message : "升级失败", { duration: 0 });
        } finally {
          upgradeWorking.value = false;
        }
      }

      function runUpgrade() {
        openUpgradeConfirm();
      }

      async function openUpgradeSettings() {
        upgradeSettingsOpen.value = true;
        await fetchUpgradeSettings();
      }

      function closeUpgradeSettings() {
        upgradeSettingsOpen.value = false;
      }

      async function saveUpgradeSettings() {
        if (upgradeSettingsSaving.value) return;
        upgradeSettingsSaving.value = true;
	        try {
	          const data = await apiPost("upgrade.settings.save", {
	            strict: upgradeSettingsForm.strict ? 1 : 0,
	            globalReplace: upgradeSettingsForm.globalReplace ? 1 : 0,
	            network: upgradeSettingsForm.network || "github",
	          });
	          upgradeSettingsForm.strict = Number(data?.strict || 0) ? 1 : 0;
	          upgradeSettingsForm.globalReplace = Number(data?.globalReplace || 0) ? 1 : 0;
	          const network = String(data?.network || "").trim();
	          upgradeSettingsForm.network = ["gitcode", "github", "ghfast"].includes(network)
	            ? network
	            : "github";
	          toastSuccess("已保存");
	          upgradeSettingsOpen.value = false;
	          await fetchUpgradeInfo();
	        } catch (e) {
          toastError(e && e.message ? e.message : "保存失败");
        } finally {
          upgradeSettingsSaving.value = false;
        }
      }

      // Users
      const usersLoading = ref(false);
      const usersError = ref("");
      const usersItems = ref([]);
      const usersFilters = reactive({
        keywords: "",
        group: "all", // all|administrator|editor|contributor|subscriber|visitor
      });
      const usersPagination = reactive({
        page: 1,
        pageSize: 20,
        total: 0,
        pageCount: 1,
      });
      const usersSelectedUids = ref([]);
      const usersSelectAllEl = ref(null);
      const usersPageJump = ref(1);

      const usersSelectedAll = computed(() => {
        const items = usersItems.value || [];
        return items.length > 0 && usersSelectedUids.value.length === items.length;
      });

      const usersSelectedIndeterminate = computed(() => {
        const items = usersItems.value || [];
        const n = usersSelectedUids.value.length;
        return n > 0 && n < items.length;
      });

      function userGroupLabel(group) {
        const g = String(group || "");
        if (g === "administrator") return "管理员";
        if (g === "editor") return "编辑";
        if (g === "contributor") return "贡献者";
        if (g === "subscriber") return "关注者";
        if (g === "visitor") return "访问者";
        return g || "—";
      }

      function userGroupTone(group) {
        const g = String(group || "");
        if (g === "administrator") return "danger";
        if (g === "editor") return "warn";
        return "";
      }

      function isUserSelected(uid) {
        const id = Number(uid || 0);
        return id > 0 && usersSelectedUids.value.includes(id);
      }

      function toggleUserSelection(uid, checked) {
        const id = Number(uid || 0);
        if (!id) return;
        const set = new Set(usersSelectedUids.value);
        if (checked) {
          set.add(id);
        } else {
          set.delete(id);
        }
        usersSelectedUids.value = Array.from(set);
      }

      function toggleUsersSelectAll(checked) {
        if (checked) {
          usersSelectedUids.value = (usersItems.value || [])
            .map((u) => Number(u.uid || 0))
            .filter((v) => v > 0);
        } else {
          usersSelectedUids.value = [];
        }
      }

      const userEditorOpen = ref(false);
      const userEditorSaving = ref(false);
      const userEditorError = ref("");
      const userEditorForm = reactive({
        uid: 0,
        name: "",
        screenName: "",
        mail: "",
        url: "",
        group: "subscriber",
        password: "",
        confirm: "",
      });

      function openUserEditor(u) {
        const item = u || {};
        userEditorError.value = "";
        userEditorForm.uid = Number(item.uid || 0) || 0;
        userEditorForm.name = String(item.name || "");
        userEditorForm.screenName = String(item.screenName || "");
        userEditorForm.mail = String(item.mail || "");
        userEditorForm.url = String(item.url || "");
        userEditorForm.group = String(item.group || "subscriber");
        userEditorForm.password = "";
        userEditorForm.confirm = "";
        userEditorOpen.value = true;
      }

      function closeUserEditor() {
        userEditorOpen.value = false;
        userEditorSaving.value = false;
        userEditorError.value = "";
        userEditorForm.password = "";
        userEditorForm.confirm = "";
      }

      async function saveUserEditor() {
        const uid = Number(userEditorForm.uid || 0) || 0;
        if (!uid) return;

        const mail = String(userEditorForm.mail || "").trim();
        if (!mail) {
          userEditorError.value = "邮箱不能为空";
          return;
        }

        const password = String(userEditorForm.password || "");
        const confirm = String(userEditorForm.confirm || "");
        if (password) {
          if (password.length < 6) {
            userEditorError.value = "密码至少 6 位";
            return;
          }
          if (confirm !== password) {
            userEditorError.value = "两次输入的密码不一致";
            return;
          }
        }

        userEditorSaving.value = true;
        userEditorError.value = "";
        try {
          const payload = {
            uid,
            screenName: String(userEditorForm.screenName || ""),
            mail,
            url: String(userEditorForm.url || ""),
            group: String(userEditorForm.group || "subscriber"),
            password,
            confirm,
          };
          await apiPost("users.update", payload);
          closeUserEditor();
          toastSuccess("已保存");
          fetchUsers();
        } catch (e) {
          userEditorError.value = e && e.message ? e.message : "保存失败";
        } finally {
          userEditorSaving.value = false;
        }
      }

      async function deleteUser(uid) {
        const id = Number(uid || 0) || 0;
        if (!id) return;
        if (!confirm("确认删除该用户吗？")) return;

        usersError.value = "";
        try {
          await apiPost("users.delete", { uids: [id] });
          toastSuccess("已删除");
          fetchUsers();
        } catch (e) {
          usersError.value = e && e.message ? e.message : "删除失败";
        }
      }

      async function fetchUsers() {
        usersLoading.value = true;
        usersError.value = "";
        try {
          const data = await apiGet("users.list", {
            page: usersPagination.page,
            pageSize: usersPagination.pageSize,
            keywords: usersFilters.keywords,
            group: usersFilters.group,
          });
          usersItems.value = data.items || [];
          const p = data.pagination || {};
          usersPagination.page = Number(p.page || usersPagination.page) || 1;
          usersPagination.pageSize =
            Number(p.pageSize || usersPagination.pageSize) || 20;
          usersPagination.total = Number(p.total || 0) || 0;
          usersPagination.pageCount = Number(p.pageCount || 1) || 1;
        } catch (e) {
          usersError.value = e && e.message ? e.message : "加载失败";
        } finally {
          usersLoading.value = false;
        }
      }

      function applyUsersFilters() {
        usersPagination.page = 1;
        fetchUsers();
      }

      function usersGoPage(p) {
        const next = Math.max(1, Math.min(usersPagination.pageCount || 1, p));
        if (next === usersPagination.page) return;
        usersPagination.page = next;
        fetchUsers();
      }

      async function deleteSelectedUsers() {
        const ids = (usersSelectedUids.value || []).slice();
        if (!ids.length) return;
        if (!confirm(`确认删除选中的 ${ids.length} 个用户吗？`)) return;

        usersError.value = "";
        try {
          await apiPost("users.delete", { uids: ids });
          usersSelectedUids.value = [];
          fetchUsers();
        } catch (e) {
          usersError.value = e && e.message ? e.message : "删除失败";
        }
      }

      watch(usersItems, () => {
        usersSelectedUids.value = [];
      });

      watch(
        () => usersPagination.page,
        (p) => {
          usersPageJump.value = Number(p || 1) || 1;
        },
        { immediate: true }
      );

      watch(
        [usersSelectedIndeterminate, usersSelectAllEl],
        ([indeterminate, el]) => {
          if (el) {
            el.indeterminate = !!indeterminate;
          }
        },
        { immediate: true }
      );

      // Taxonomy (categories/tags)
      const taxonomyLoading = ref(false);
      const taxonomySaving = ref(false);
      const taxonomyError = ref("");
      const categoriesAll = ref([]);
      const defaultCategoryId = ref(0);
      const tagsAll = ref([]);

      const categoryEditorOpen = ref(false);
      const tagEditorOpen = ref(false);
      const categoryNameEl = ref(null);
      const tagNameEl = ref(null);
      const categoryNameError = ref("");
      const tagNameError = ref("");
      const categoryForm = reactive({
        mid: 0,
        name: "",
        slug: "",
        parent: 0,
        description: "",
      });
      const tagForm = reactive({
        mid: 0,
        name: "",
        slug: "",
      });

      // Comments
      const commentsLoading = ref(false);
      const commentsError = ref("");
      const commentsItems = ref([]);
      const commentsFilters = reactive({
        keywords: "",
        status: "approved", // approved|waiting|spam|hold|all
        scope:
          V3A.canPublish &&
          (!V3A.acl || !V3A.acl.comments || Number(V3A.acl.comments.scopeAll))
            ? "all"
            : "mine", // mine|all (editors only)
      });
      const commentsPagination = reactive({
        page: 1,
        pageSize: 20,
        total: 0,
        pageCount: 1,
      });

      // Comments UI (master-detail split, mx-admin like)
      const commentsSplitLeftWidth = ref(360);
      function clampCommentsSplitLeftWidth(w) {
        const n = Number(w);
        if (!Number.isFinite(n)) return 360;
        return Math.max(280, Math.min(520, n));
      }
      function startCommentsSplitResize(event) {
        const e = event;
        if (!e || typeof e.clientX !== "number") return;
        try {
          e.preventDefault();
        } catch (err) {}
        const startX = e.clientX;
        const startW = clampCommentsSplitLeftWidth(commentsSplitLeftWidth.value);

        const onMove = (ev) => {
          if (!ev || typeof ev.clientX !== "number") return;
          commentsSplitLeftWidth.value = clampCommentsSplitLeftWidth(
            startW + (ev.clientX - startX)
          );
        };

        const onUp = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      }

      // AI Extras (Translate / Summary)
      const aiExtrasContentType = ref("post"); // post|page
      const aiExtrasKeywords = ref("");
      const aiExtrasLoading = ref(false);
      const aiExtrasError = ref("");
      const aiExtrasItems = ref([]);
      const aiExtrasPagination = reactive({
        page: 1,
        pageSize: 20,
        total: 0,
        pageCount: 1,
      });
      const aiExtrasPageJump = ref(1);
      const aiExtrasSelectedCid = ref(0);
      const aiExtrasLang = ref("");

      const aiExtrasLanguageOptions = computed(() => {
        try {
          const extras = V3A && V3A.extras && typeof V3A.extras === "object" ? V3A.extras : {};
          const ai = extras.ai && typeof extras.ai === "object" ? extras.ai : {};
          const langs = Array.isArray(ai.languages) ? ai.languages : [];
          return langs.map((v) => String(v || "").trim()).filter(Boolean);
        } catch (e) {
          return [];
        }
      });

      function ensureAiExtrasLang() {
        const current = String(aiExtrasLang.value || "").trim();
        if (current) return;
        const opts = Array.isArray(aiExtrasLanguageOptions.value) ? aiExtrasLanguageOptions.value : [];
        aiExtrasLang.value = opts.length ? String(opts[0] || "en") : "en";
      }

      // Split (reuse comments layout styles)
      const aiExtrasSplitLeftWidth = ref(360);
      function clampAiExtrasSplitLeftWidth(w) {
        const n = Number(w);
        if (!Number.isFinite(n)) return 360;
        return Math.max(280, Math.min(520, n));
      }
      function startAiExtrasSplitResize(event) {
        const e = event;
        if (!e || typeof e.clientX !== "number") return;
        try {
          e.preventDefault();
        } catch (err) {}
        const startX = e.clientX;
        const startW = clampAiExtrasSplitLeftWidth(aiExtrasSplitLeftWidth.value);

        const onMove = (ev) => {
          if (!ev || typeof ev.clientX !== "number") return;
          aiExtrasSplitLeftWidth.value = clampAiExtrasSplitLeftWidth(startW + (ev.clientX - startX));
        };

        const onUp = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      }

      const aiTranslateLoading = ref(false);
      const aiTranslateGenerating = ref(false);
      const aiTranslateSaving = ref(false);
      const aiTranslateError = ref("");
      const aiTranslateItem = ref(null);
      const aiTranslatePreviewEl = ref(null);
      const aiTranslateForm = reactive({
        title: "",
        text: "",
      });

      const aiSummaryLoading = ref(false);
      const aiSummaryGenerating = ref(false);
      const aiSummarySaving = ref(false);
      const aiSummaryError = ref("");
      const aiSummaryItem = ref(null);
      const aiSummaryPreviewEl = ref(null);
      const aiSummaryForm = reactive({
        summary: "",
      });

      const aiTranslateDirty = computed(() => {
        const item = aiTranslateItem.value && typeof aiTranslateItem.value === "object" ? aiTranslateItem.value : null;
        if (!item) return false;
        return (
          String(aiTranslateForm.title || "") !== String(item.title || "") ||
          String(aiTranslateForm.text || "") !== String(item.text || "")
        );
      });

      const aiSummaryDirty = computed(() => {
        const item = aiSummaryItem.value && typeof aiSummaryItem.value === "object" ? aiSummaryItem.value : null;
        if (!item) return false;
        return String(aiSummaryForm.summary || "") !== String(item.summary || "");
      });

      function syncAiTranslateFormFromItem() {
        const item = aiTranslateItem.value && typeof aiTranslateItem.value === "object" ? aiTranslateItem.value : null;
        aiTranslateForm.title = item ? String(item.title || "") : "";
        aiTranslateForm.text = item ? String(item.text || "") : "";
      }

      function syncAiSummaryFormFromItem() {
        const item = aiSummaryItem.value && typeof aiSummaryItem.value === "object" ? aiSummaryItem.value : null;
        aiSummaryForm.summary = item ? String(item.summary || "") : "";
      }

      async function v3aPreviewMarkdown(hostEl, markdown) {
        const host = hostEl && typeof hostEl === "object" ? hostEl : null;
        if (!host) return;

        const raw = String(markdown || "");
        if (!raw.trim()) {
          host.innerHTML = `<div style="padding: 14px 16px;" class="v3a-muted">暂无内容</div>`;
          return;
        }

        const VditorCtor = typeof window !== "undefined" ? window.Vditor : undefined;
        if (VditorCtor && typeof VditorCtor.preview === "function") {
          try {
            host.innerHTML = "";
            const maybe = VditorCtor.preview(host, raw);
            if (maybe && typeof maybe.then === "function") {
              await maybe;
            }
            return;
          } catch (e) {}
        }

        host.textContent = raw;
      }

      function resetAiExtrasResults() {
        aiTranslateError.value = "";
        aiTranslateItem.value = null;
        syncAiTranslateFormFromItem();
        aiSummaryError.value = "";
        aiSummaryItem.value = null;
        syncAiSummaryFormFromItem();
        if (aiTranslatePreviewEl.value) aiTranslatePreviewEl.value.innerHTML = "";
        if (aiSummaryPreviewEl.value) aiSummaryPreviewEl.value.innerHTML = "";
      }

      async function fetchAiExtrasContents() {
        aiExtrasLoading.value = true;
        aiExtrasError.value = "";
        try {
          ensureAiExtrasLang();

          const ctype = String(aiExtrasContentType.value || "post");
          const keywords = String(aiExtrasKeywords.value || "").trim();

          if (ctype === "page") {
            const data = await apiGet("pages.list", { keywords, status: "all" });
            aiExtrasItems.value = Array.isArray(data && data.items) ? data.items : [];
            aiExtrasPagination.page = 1;
            aiExtrasPagination.pageCount = 1;
            aiExtrasPagination.total = aiExtrasItems.value.length;
            return;
          }

          const scopeAllAllowed =
            !!V3A.canPublish && (!V3A.acl || !V3A.acl.posts || Number(V3A.acl.posts.scopeAll));
          const scope = scopeAllAllowed ? "all" : "mine";

          const data = await apiGet("posts.list", {
            page: aiExtrasPagination.page,
            pageSize: aiExtrasPagination.pageSize,
            status: "all",
            keywords,
            scope,
          });
          aiExtrasItems.value = data.items || [];
          const p = data.pagination || {};
          aiExtrasPagination.page = Number(p.page || aiExtrasPagination.page) || 1;
          aiExtrasPagination.pageSize = Number(p.pageSize || aiExtrasPagination.pageSize) || 20;
          aiExtrasPagination.total = Number(p.total || 0) || 0;
          aiExtrasPagination.pageCount = Number(p.pageCount || 1) || 1;
        } catch (e) {
          aiExtrasError.value = e && e.message ? e.message : "加载失败";
        } finally {
          aiExtrasLoading.value = false;
        }
      }

      async function aiExtrasApplyFilters() {
        await flushAiExtrasDraftOnSwitch(routePath.value);
        aiExtrasPagination.page = 1;
        aiExtrasPageJump.value = 1;
        aiExtrasSelectedCid.value = 0;
        resetAiExtrasResults();
        await fetchAiExtrasContents();
      }

      async function aiExtrasGoPage(p) {
        await flushAiExtrasDraftOnSwitch(routePath.value);
        const next = Math.max(1, Math.min(aiExtrasPagination.pageCount || 1, p));
        if (next === aiExtrasPagination.page) return;
        aiExtrasPagination.page = next;
        await fetchAiExtrasContents();
      }

      function openAiExtrasEditor() {
        const cid = Number(aiExtrasSelectedCid.value || 0);
        if (!cid) return;
        if (String(aiExtrasContentType.value || "post") === "page") {
          openPageEditor(cid);
        } else {
          openPostEditor(cid);
        }
      }

      async function renderAiTranslatePreview() {
        const host = aiTranslatePreviewEl.value;
        const t = aiTranslateItem.value && typeof aiTranslateItem.value === "object" ? aiTranslateItem.value : null;
        const text = t ? String(aiTranslateForm.text || "") : "";
        if (!host) return;
        await v3aPreviewMarkdown(host, text);
      }

      async function renderAiSummaryPreview() {
        const host = aiSummaryPreviewEl.value;
        const t = aiSummaryItem.value && typeof aiSummaryItem.value === "object" ? aiSummaryItem.value : null;
        const text = t ? String(aiSummaryForm.summary || "") : "";
        if (!host) return;
        await v3aPreviewMarkdown(host, text);
      }

      function aiExtrasNormalizeCtype(raw) {
        return String(raw || "post") === "page" ? "page" : "post";
      }

      async function loadAiTranslation() {
        aiTranslateError.value = "";
        aiTranslateItem.value = null;
        syncAiTranslateFormFromItem();
        if (aiTranslatePreviewEl.value) aiTranslatePreviewEl.value.innerHTML = "";

        const cid = Number(aiExtrasSelectedCid.value || 0);
        const lang = String(aiExtrasLang.value || "").trim();
        const ctype = String(aiExtrasContentType.value || "post") === "page" ? "page" : "post";
        if (!cid) {
          aiTranslateError.value = "请先从左侧选择内容";
          return;
        }
        if (!lang) {
          aiTranslateError.value = "请选择语言";
          return;
        }

        aiTranslateLoading.value = true;
        try {
          const data = await apiGet("ai.translate.get", { cid, lang, ctype });
          aiTranslateItem.value = data && typeof data === "object" ? data.translation || null : null;
          syncAiTranslateFormFromItem();
          await nextTick();
          await renderAiTranslatePreview();
        } catch (e) {
          aiTranslateError.value = e && e.message ? e.message : "加载失败";
        } finally {
          aiTranslateLoading.value = false;
        }
      }

      async function generateAiTranslation() {
        aiTranslateError.value = "";
        const cid = Number(aiExtrasSelectedCid.value || 0);
        const lang = String(aiExtrasLang.value || "").trim();
        const ctype = String(aiExtrasContentType.value || "post") === "page" ? "page" : "post";
        if (!cid) {
          aiTranslateError.value = "请先从左侧选择内容";
          return;
        }
        if (!lang) {
          aiTranslateError.value = "请选择语言";
          return;
        }

        aiTranslateGenerating.value = true;
        try {
          const data = await apiPost("ai.translate.generate", { cid, lang, ctype });
          aiTranslateItem.value = data && typeof data === "object" ? data.translation || null : null;
          syncAiTranslateFormFromItem();
          await nextTick();
          await renderAiTranslatePreview();
          toastSuccess("已生成翻译");
        } catch (e) {
          aiTranslateError.value = e && e.message ? e.message : "生成失败";
        } finally {
          aiTranslateGenerating.value = false;
        }
      }

      async function loadAiSummary() {
        aiSummaryError.value = "";
        aiSummaryItem.value = null;
        syncAiSummaryFormFromItem();
        if (aiSummaryPreviewEl.value) aiSummaryPreviewEl.value.innerHTML = "";

        const cid = Number(aiExtrasSelectedCid.value || 0);
        const lang = String(aiExtrasLang.value || "").trim();
        const ctype = String(aiExtrasContentType.value || "post") === "page" ? "page" : "post";
        if (!cid) {
          aiSummaryError.value = "请先从左侧选择内容";
          return;
        }
        if (!lang) {
          aiSummaryError.value = "请选择语言";
          return;
        }

        aiSummaryLoading.value = true;
        try {
          const data = await apiGet("ai.summary.get", { cid, lang, ctype });
          aiSummaryItem.value = data && typeof data === "object" ? data.summary || null : null;
          syncAiSummaryFormFromItem();
          await nextTick();
          await renderAiSummaryPreview();
        } catch (e) {
          aiSummaryError.value = e && e.message ? e.message : "加载失败";
        } finally {
          aiSummaryLoading.value = false;
        }
      }

      async function generateAiSummary() {
        aiSummaryError.value = "";
        const cid = Number(aiExtrasSelectedCid.value || 0);
        const lang = String(aiExtrasLang.value || "").trim();
        const ctype = String(aiExtrasContentType.value || "post") === "page" ? "page" : "post";
        if (!cid) {
          aiSummaryError.value = "请先从左侧选择内容";
          return;
        }
        if (!lang) {
          aiSummaryError.value = "请选择语言";
          return;
        }

        aiSummaryGenerating.value = true;
        try {
          const data = await apiPost("ai.summary.generate", { cid, lang, ctype });
          aiSummaryItem.value = data && typeof data === "object" ? data.summary || null : null;
          syncAiSummaryFormFromItem();
          await nextTick();
          await renderAiSummaryPreview();
          toastSuccess("已生成摘要");
        } catch (e) {
          aiSummaryError.value = e && e.message ? e.message : "生成失败";
        } finally {
          aiSummaryGenerating.value = false;
        }
      }

      async function saveAiTranslation(silent, forceCtype) {
        aiTranslateError.value = "";
        const cid = Number(aiExtrasSelectedCid.value || 0);
        const lang = String(aiExtrasLang.value || "").trim();
        const ctype = aiExtrasNormalizeCtype(forceCtype !== undefined ? forceCtype : aiExtrasContentType.value);
        if (!cid || !lang) {
          return false;
        }
        if (!aiTranslateItem.value) {
          return false;
        }
        if (!aiTranslateDirty.value) {
          return true;
        }

        aiTranslateSaving.value = true;
        try {
          const model = aiTranslateItem.value && typeof aiTranslateItem.value === "object"
            ? String(aiTranslateItem.value.model || "")
            : "";
          const data = await apiPost("ai.translate.save", {
            cid,
            lang,
            ctype,
            title: String(aiTranslateForm.title || ""),
            text: String(aiTranslateForm.text || ""),
            model,
          });
          aiTranslateItem.value = data && typeof data === "object" ? data.translation || null : null;
          syncAiTranslateFormFromItem();
          await nextTick();
          await renderAiTranslatePreview();
          if (!silent) toastSuccess("已保存翻译");
          return true;
        } catch (e) {
          aiTranslateError.value = e && e.message ? e.message : "保存失败";
          return false;
        } finally {
          aiTranslateSaving.value = false;
        }
      }

      async function saveAiSummary(silent, forceCtype) {
        aiSummaryError.value = "";
        const cid = Number(aiExtrasSelectedCid.value || 0);
        const lang = String(aiExtrasLang.value || "").trim();
        const ctype = aiExtrasNormalizeCtype(forceCtype !== undefined ? forceCtype : aiExtrasContentType.value);
        if (!cid || !lang) {
          return false;
        }
        if (!aiSummaryItem.value) {
          return false;
        }
        if (!aiSummaryDirty.value) {
          return true;
        }

        aiSummarySaving.value = true;
        try {
          const model = aiSummaryItem.value && typeof aiSummaryItem.value === "object"
            ? String(aiSummaryItem.value.model || "")
            : "";
          const data = await apiPost("ai.summary.save", {
            cid,
            lang,
            ctype,
            summary: String(aiSummaryForm.summary || ""),
            model,
          });
          aiSummaryItem.value = data && typeof data === "object" ? data.summary || null : null;
          syncAiSummaryFormFromItem();
          await nextTick();
          await renderAiSummaryPreview();
          if (!silent) toastSuccess("已保存摘要");
          return true;
        } catch (e) {
          aiSummaryError.value = e && e.message ? e.message : "保存失败";
          return false;
        } finally {
          aiSummarySaving.value = false;
        }
      }

      async function flushAiExtrasDraftOnSwitch(pathname, forceCtype) {
        const path = String(pathname || routePath.value || "");
        if (path === "/extras/ai-translate") {
          if (aiTranslateDirty.value && aiTranslateItem.value && !aiTranslateSaving.value && !aiTranslateLoading.value && !aiTranslateGenerating.value) {
            await saveAiTranslation(true, forceCtype);
          }
          return;
        }
        if (path === "/extras/ai-summary") {
          if (aiSummaryDirty.value && aiSummaryItem.value && !aiSummarySaving.value && !aiSummaryLoading.value && !aiSummaryGenerating.value) {
            await saveAiSummary(true, forceCtype);
          }
        }
      }

      async function selectAiExtrasContent(cid) {
        const id = Number(cid || 0);
        if (!id) return;
        await flushAiExtrasDraftOnSwitch(routePath.value);
        aiExtrasSelectedCid.value = id;
        resetAiExtrasResults();

        if (routePath.value === "/extras/ai-translate") {
          await loadAiTranslation();
        } else if (routePath.value === "/extras/ai-summary") {
          await loadAiSummary();
        }
      }

      watch(
        () => String(aiExtrasContentType.value || "post"),
        async (t, oldT) => {
          if (!routePath.value.startsWith("/extras/ai-")) return;
          await flushAiExtrasDraftOnSwitch(routePath.value, oldT);
          aiExtrasPagination.page = 1;
          aiExtrasPageJump.value = 1;
          aiExtrasSelectedCid.value = 0;
          resetAiExtrasResults();
          await fetchAiExtrasContents();
        }
      );

      watch(
        () => String(aiExtrasLang.value || ""),
        async () => {
          if (!routePath.value.startsWith("/extras/ai-")) return;
          if (!aiExtrasSelectedCid.value) return;
          const hasOptions = Array.isArray(aiExtrasLanguageOptions.value) && aiExtrasLanguageOptions.value.length;
          if (!hasOptions) return;
          await flushAiExtrasDraftOnSwitch(routePath.value);
          if (routePath.value === "/extras/ai-translate") await loadAiTranslation();
          else if (routePath.value === "/extras/ai-summary") await loadAiSummary();
        }
      );

      watch(
        () => String(routePath.value || ""),
        async (to, from) => {
          const leavingTranslate = from === "/extras/ai-translate" && to !== "/extras/ai-translate";
          const leavingSummary = from === "/extras/ai-summary" && to !== "/extras/ai-summary";
          if (leavingTranslate || leavingSummary) {
            await flushAiExtrasDraftOnSwitch(from);
          }
        }
      );

      watch(
        () => String(aiTranslateForm.text || ""),
        () => {
          if (!aiTranslateItem.value) return;
          if (routePath.value !== "/extras/ai-translate") return;
          renderAiTranslatePreview();
        }
      );

      watch(
        () => String(aiSummaryForm.summary || ""),
        () => {
          if (!aiSummaryItem.value) return;
          if (routePath.value !== "/extras/ai-summary") return;
          renderAiSummaryPreview();
        }
      );

      const commentEditorOpen = ref(false);
      const commentEditorLoading = ref(false);
      const commentEditorSaving = ref(false);
      const commentEditorError = ref("");
      const commentEditorPost = ref(null);
      const commentForm = reactive({
        coid: 0,
        cid: 0,
        author: "",
        mail: "",
        avatar: "",
        url: "",
        created: 0,
        text: "",
        status: "",
        ip: "",
        agent: "",
        parent: 0,
      });
      const commentReplyText = ref("");
      const commentReplyEl = ref(null);
      const commentReplyEmojiOpen = ref(false);
      const commentReplyEmojis = [
        "😀",
        "😁",
        "😂",
        "🤣",
        "😊",
        "😍",
        "🤠",
        "👍",
        "🙏",
        "🎉",
        "❤️",
      ];

      const commentDetailPostUrl = computed(() => {
        const cid = Number(commentForm.cid || 0);
        if (!cid) return "";
        let base = String(V3A.indexUrl || V3A.siteUrl || "").trim();
        if (!base) return "";
        base = base.replace(/\/+$/, "");
        if (!base) return "";
        return `${base}/archives/${cid}/`;
      });

      const commentDetailAuthorUrl = computed(() => {
        const raw = String(commentForm.url || "").trim();
        if (!raw) return "";
        const href = v3aSanitizeHref(raw);
        return href || "";
      });

      const commentDetailDeviceLabel = computed(() => {
        const ua = String(commentForm.agent || "").trim();
        if (!ua) return "";
        const head = ua.split(" ")[0] || ua;
        return head;
      });

      const commentDetailDeviceIcon = computed(() => {
        const ua = String(commentForm.agent || "").toLowerCase();
        const isMobile =
          ua.includes("mobile") ||
          ua.includes("android") ||
          ua.includes("iphone") ||
          ua.includes("ipad");
        return isMobile ? ICONS.smartphone : ICONS.monitor;
      });

      function toggleCommentReplyEmoji() {
        commentReplyEmojiOpen.value = !commentReplyEmojiOpen.value;
      }

      function insertCommentReplyEmoji(emoji) {
        const em = String(emoji || "");
        if (!em) return;
        const el = commentReplyEl.value;
        const text = String(commentReplyText.value || "");
        if (el && typeof el.selectionStart === "number") {
          const start = el.selectionStart || 0;
          const end =
            typeof el.selectionEnd === "number" ? el.selectionEnd : start;
          commentReplyText.value = text.slice(0, start) + em + text.slice(end);
          nextTick(() => {
            try {
              el.focus();
              const pos = start + em.length;
              el.setSelectionRange(pos, pos);
            } catch (e) {}
          });
        } else {
          commentReplyText.value = text + em;
        }
        commentReplyEmojiOpen.value = false;
      }

      function onCommentReplyKeyDown(e) {
        const ev = e;
        if (!ev || ev.key !== "Enter") return;
        if (ev.ctrlKey || ev.metaKey) {
          try {
            ev.preventDefault();
          } catch (err) {}
          submitCommentReply();
        }
      }

      // Pages (manage/edit)
      const pagesLoading = ref(false);
      const pagesError = ref("");
      const pagesItems = ref([]);
      const pagesFilters = reactive({
        keywords: "",
        status: "all", // all|publish|hidden|draft
      });

      const pageLoading = ref(false);
      const pageSaving = ref(false);
      const pageError = ref("");
      const pageMessage = ref("");
      const pageCapabilities = ref({
        markdownEnabled: !!V3A.markdownEnabled,
        canPublish: !!V3A.canPublish,
      });
      const pageTemplates = ref([]);
      const pageParentOptions = ref([]);
      const pageForm = reactive({
        cid: 0,
        title: "",
        slug: "",
        text: "",
        visibility: "publish", // publish|hidden
        template: "",
        order: 0,
        parent: 0,
        allowComment: true,
        allowPing: true,
        allowFeed: true,
        markdown: true,
        fields: [],
      });
      const pageDefaultFields = ref([]);

      // Settings
      const settingsLoading = ref(false);
      const settingsSaving = ref(false);
      const settingsError = ref("");
      const settingsMessage = ref("");
      const settingsBatchSaving = ref(false);
      const settingsData = reactive({
        isAdmin: false,
        profile: {
          uid: 0,
          name: "",
          screenName: "",
          mail: "",
          url: "",
          group: "",
        },
        userOptions: {
          markdown: 0,
          xmlrpcMarkdown: 0,
          autoSave: 0,
          defaultAllowComment: 0,
          defaultAllowPing: 0,
          defaultAllowFeed: 0,
        },
        site: {
          siteUrl: "",
          siteUrlLocked: false,
          title: "",
          description: "",
          keywords: "",
          loginStyle: "",
          loginBackground: "",
          allowRegister: 0,
          defaultRegisterGroup: "subscriber",
          allowXmlRpc: 0,
          lang: "zh_CN",
          timezone: Number(V3A.timezone ?? 28800),
        },
        storage: {
          attachmentTypes: "",
        },
        reading: {
          postDateFormat: "",
          frontPage: "recent",
          frontPageType: "recent",
          frontPageValue: "",
          frontArchive: 0,
          archivePattern: "",
          pageSize: 10,
          postsListSize: 10,
          feedFullText: 0,
        },
        discussion: {},
        notify: {},
        ai: {},
        permalink: {},
        lists: { langs: [], frontPagePages: [], frontPageFiles: [], timezones: SETTINGS_TIMEZONES },
      });

      const userOptionsLoaded = ref(false);

      async function ensureUserOptionsLoaded() {
        if (userOptionsLoaded.value) return;
        try {
          const data = await apiGet("settings.get");
          Object.assign(settingsData.userOptions, data.userOptions || {});
          userOptionsLoaded.value = true;
        } catch (e) {}
      }

      const postAutoSaveEnabled = computed(() => Number(settingsData.userOptions.autoSave || 0) ? true : false);

      watch(
        [postAutoSaveEnabled, routePath],
        ([enabled, p]) => {
          if (enabled && String(p || "") === "/posts/write") {
            startPostDraftNowTicker();
            return;
          }
          stopPostDraftNowTicker();
        },
        { immediate: true }
      );

      const postDraftTimeAgo = computed(() => {
        postDraftNowTick.value;
        const ts = Number(postDraftLastSavedAt.value || 0);
        return ts > 0 ? formatTimeAgoFine(ts) : "";
      });

      const postDraftStatusText = computed(() => {
        const st = String(postDraftSaveState.value || "idle");
        if (st === "saving") return "保存中";
        if (st === "saved") return "已保存草稿";
        if (st === "error") return "保存失败";
        return "未保存草稿";
      });

      const settingsProfileForm = reactive({
        screenName: "",
        mail: "",
        url: "",
      });
      const settingsUserOptionsForm = reactive({
        markdown: 0,
        xmlrpcMarkdown: 0,
        autoSave: 0,
        defaultAllow: [],
      });
      const settingsPasswordForm = reactive({
        password: "",
        confirm: "",
      });
      const settingsSiteForm = reactive({
        siteUrl: "",
        title: "",
        description: "",
        keywords: "",
        loginStyle: "",
        loginBackground: "",
        allowRegister: 0,
        defaultRegisterGroup: "subscriber",
        allowXmlRpc: 0,
        lang: "zh_CN",
        timezone: Number(V3A.timezone ?? 28800),
      });
      const settingsSiteXmlRpcLast = ref(1);
      watch(
        () => Number(settingsSiteForm.allowXmlRpc || 0),
        (v) => {
          const n = Number(v || 0) || 0;
          if (n === 1 || n === 2) settingsSiteXmlRpcLast.value = n;
        }
      );
      const settingsSiteXmlRpcEnabled = computed({
        get() {
          return Number(settingsSiteForm.allowXmlRpc || 0) ? 1 : 0;
        },
        set(v) {
          const enabled = Number(v || 0) ? 1 : 0;
          const current = Number(settingsSiteForm.allowXmlRpc || 0) || 0;
          if (enabled) {
            if (current) return;
            const next = Number(settingsSiteXmlRpcLast.value || 1) || 1;
            settingsSiteForm.allowXmlRpc = next === 2 ? 2 : 1;
            return;
          }
          if (current) settingsSiteXmlRpcLast.value = current;
          settingsSiteForm.allowXmlRpc = 0;
        },
      });
      const settingsStorageForm = reactive({
        attachmentTypes: [],
        attachmentTypesOther: "",
      });
      const settingsReadingForm = reactive({
        postDateFormat: "",
        frontPageType: "recent",
        frontPagePage: 0,
        frontPageFile: "",
        frontArchive: 0,
        archivePattern: "",
        pageSize: 10,
        postsListSize: 10,
        feedFullText: 0,
      });
      const DEFAULT_NOTIFY_COMMENT_TEMPLATE = `
<div style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif; font-size: 14px; color: #111; line-height: 1.6;">
  <div style="border: 1px solid rgba(0,0,0,.08); border-radius: 10px; overflow: hidden;">
    <div style="padding: 14px 16px; background: #fafafa; border-bottom: 1px solid rgba(0,0,0,.06);">
      <div style="font-weight: 700;">{{siteTitle}}</div>
      <div style="font-size: 12px; color: #666;">收到一条新的评论</div>
    </div>
    <div style="padding: 14px 16px;">
      <div style="margin-bottom: 8px;"><strong>文章：</strong><a href="{{postUrl}}" target="_blank" rel="noreferrer" style="color:#2563eb; text-decoration:none;">{{postTitle}}</a></div>
      <div style="margin-bottom: 8px;"><strong>作者：</strong>{{commentAuthor}}</div>
      <div style="margin-bottom: 8px;"><strong>状态：</strong>{{commentStatus}}</div>
      <div style="margin-bottom: 12px;"><strong>时间：</strong>{{commentTime}}</div>
      <div style="padding: 12px; background: #fff; border: 1px solid rgba(0,0,0,.06); border-radius: 10px;">{{commentText}}</div>
    </div>
      <div style="padding: 12px 16px; background: #fafafa; border-top: 1px solid rgba(0,0,0,.06); font-size: 12px; color: #666;">
      请登录后台查看并处理。
    </div>
  </div>
</div>
`.trim();
      const DEFAULT_NOTIFY_FRIENDLINK_TEMPLATE = `
<div style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif; font-size: 14px; color: #111; line-height: 1.6;">
  <div style="border: 1px solid rgba(0,0,0,.08); border-radius: 10px; overflow: hidden;">
    <div style="padding: 14px 16px; background: #fafafa; border-bottom: 1px solid rgba(0,0,0,.06);">
      <div style="font-weight: 700;">{{siteTitle}}</div>
      <div style="font-size: 12px; color: #666;">收到一条新的友链申请</div>
    </div>
    <div style="padding: 14px 16px;">
      <div style="margin-bottom: 8px;"><strong>名称：</strong>{{linkName}}</div>
      <div style="margin-bottom: 8px;"><strong>网址：</strong><a href="{{linkUrl}}" target="_blank" rel="noreferrer" style="color:#2563eb; text-decoration:none;">{{linkUrl}}</a></div>
      <div style="margin-bottom: 8px;"><strong>类型：</strong>{{linkType}}</div>
      <div style="margin-bottom: 8px;"><strong>邮箱：</strong>{{linkEmail}}</div>
      <div style="margin-bottom: 8px;"><strong>头像：</strong>{{linkAvatar}}</div>
      <div style="margin-bottom: 8px;"><strong>描述：</strong>{{linkDescription}}</div>
      <div style="margin-bottom: 12px;"><strong>时间：</strong>{{applyTime}}</div>
      <div style="padding: 12px; background: #fff; border: 1px solid rgba(0,0,0,.06); border-radius: 10px;">{{linkMessage}}</div>
    </div>
    <div style="padding: 12px 16px; background: #fafafa; border-top: 1px solid rgba(0,0,0,.06); font-size: 12px; color: #666;">
      <a href="{{reviewUrl}}" target="_blank" rel="noreferrer" style="color:#2563eb; text-decoration:none;">前往审核</a>
    </div>
  </div>
</div>
`.trim();

      const DEFAULT_NOTIFY_FRIENDLINK_AUDIT_PASS_TEMPLATE = `
<div style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif; font-size: 14px; color: #111; line-height: 1.6;">
  <div style="border: 1px solid rgba(0,0,0,.08); border-radius: 10px; overflow: hidden;">
    <div style="padding: 14px 16px; background: #fafafa; border-bottom: 1px solid rgba(0,0,0,.06);">
      <div style="font-weight: 700;">{{siteTitle}}</div>
      <div style="font-size: 12px; color: #666;">你的友链申请已通过</div>
    </div>
    <div style="padding: 14px 16px;">
      <div style="margin-bottom: 8px;"><strong>结果：</strong>{{auditResult}}</div>
      <div style="margin-bottom: 12px;"><strong>审核时间：</strong>{{auditTime}}</div>
      <div style="margin-bottom: 8px;"><strong>名称：</strong>{{linkName}}</div>
      <div style="margin-bottom: 8px;"><strong>网址：</strong><a href="{{linkUrl}}" target="_blank" rel="noreferrer" style="color:#2563eb; text-decoration:none;">{{linkUrl}}</a></div>
      <div style="margin-bottom: 8px;"><strong>类型：</strong>{{linkType}}</div>
      <div style="margin-bottom: 8px;"><strong>邮箱：</strong>{{linkEmail}}</div>
      <div style="margin-bottom: 8px;"><strong>头像：</strong>{{linkAvatar}}</div>
      <div style="margin-bottom: 8px;"><strong>描述：</strong>{{linkDescription}}</div>
      <div style="margin-bottom: 12px;"><strong>申请时间：</strong>{{applyTime}}</div>
      <div style="padding: 12px; background: #fff; border: 1px solid rgba(0,0,0,.06); border-radius: 10px;">{{linkMessage}}</div>
    </div>
    <div style="padding: 12px 16px; background: #fafafa; border-top: 1px solid rgba(0,0,0,.06); font-size: 12px; color: #666;">
      感谢你的申请！
    </div>
  </div>
</div>
`.trim();

      const DEFAULT_NOTIFY_FRIENDLINK_AUDIT_REJECT_TEMPLATE = `
<div style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif; font-size: 14px; color: #111; line-height: 1.6;">
  <div style="border: 1px solid rgba(0,0,0,.08); border-radius: 10px; overflow: hidden;">
    <div style="padding: 14px 16px; background: #fafafa; border-bottom: 1px solid rgba(0,0,0,.06);">
      <div style="font-weight: 700;">{{siteTitle}}</div>
      <div style="font-size: 12px; color: #666;">你的友链申请未通过</div>
    </div>
    <div style="padding: 14px 16px;">
      <div style="margin-bottom: 8px;"><strong>结果：</strong>{{auditResult}}</div>
      <div style="margin-bottom: 12px;"><strong>审核时间：</strong>{{auditTime}}</div>
      <div style="margin-bottom: 8px;"><strong>名称：</strong>{{linkName}}</div>
      <div style="margin-bottom: 8px;"><strong>网址：</strong><a href="{{linkUrl}}" target="_blank" rel="noreferrer" style="color:#2563eb; text-decoration:none;">{{linkUrl}}</a></div>
      <div style="margin-bottom: 8px;"><strong>类型：</strong>{{linkType}}</div>
      <div style="margin-bottom: 8px;"><strong>邮箱：</strong>{{linkEmail}}</div>
      <div style="margin-bottom: 8px;"><strong>头像：</strong>{{linkAvatar}}</div>
      <div style="margin-bottom: 8px;"><strong>描述：</strong>{{linkDescription}}</div>
      <div style="margin-bottom: 12px;"><strong>申请时间：</strong>{{applyTime}}</div>
      <div style="padding: 12px; background: #fff; border: 1px solid rgba(0,0,0,.06); border-radius: 10px;">{{linkMessage}}</div>
    </div>
    <div style="padding: 12px 16px; background: #fafafa; border-top: 1px solid rgba(0,0,0,.06); font-size: 12px; color: #666;">
      如需修改信息后重新申请，请回复本邮件或通过网站提交。
    </div>
  </div>
</div>
`.trim();

      const DEFAULT_NOTIFY_COMMENT_WAITING_TEMPLATE = `
<div style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif; font-size: 14px; color: #111; line-height: 1.6;">
  <div style="border: 1px solid rgba(0,0,0,.08); border-radius: 10px; overflow: hidden;">
    <div style="padding: 14px 16px; background: #fafafa; border-bottom: 1px solid rgba(0,0,0,.06);">
      <div style="font-weight: 700;">{{siteTitle}}</div>
      <div style="font-size: 12px; color: #666;">收到一条待审核评论</div>
    </div>
    <div style="padding: 14px 16px;">
      <div style="margin-bottom: 8px;"><strong>文章：</strong><a href="{{postUrl}}" target="_blank" rel="noreferrer" style="color:#2563eb; text-decoration:none;">{{postTitle}}</a></div>
      <div style="margin-bottom: 8px;"><strong>作者：</strong>{{commentAuthor}}</div>
      <div style="margin-bottom: 8px;"><strong>状态：</strong>{{commentStatus}}</div>
      <div style="margin-bottom: 12px;"><strong>时间：</strong>{{commentTime}}</div>
      <div style="padding: 12px; background: #fff; border: 1px solid rgba(0,0,0,.06); border-radius: 10px;">{{commentText}}</div>
    </div>
    <div style="padding: 12px 16px; background: #fafafa; border-top: 1px solid rgba(0,0,0,.06); font-size: 12px; color: #666;">
      <a href="{{reviewUrl}}" target="_blank" rel="noreferrer" style="color:#2563eb; text-decoration:none;">前往审核</a>
    </div>
  </div>
</div>
`.trim();

      const DEFAULT_NOTIFY_COMMENT_REPLY_TEMPLATE = `
<div style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif; font-size: 14px; color: #111; line-height: 1.6;">
  <div style="border: 1px solid rgba(0,0,0,.08); border-radius: 10px; overflow: hidden;">
    <div style="padding: 14px 16px; background: #fafafa; border-bottom: 1px solid rgba(0,0,0,.06);">
      <div style="font-weight: 700;">{{siteTitle}}</div>
      <div style="font-size: 12px; color: #666;">你的评论有了新的回复</div>
    </div>
    <div style="padding: 14px 16px;">
      <div style="margin-bottom: 8px;"><strong>文章：</strong><a href="{{postUrl}}" target="_blank" rel="noreferrer" style="color:#2563eb; text-decoration:none;">{{postTitle}}</a></div>
      <div style="margin-bottom: 12px; font-size: 12px; color: #666;">
        <div><strong>你的昵称：</strong>{{parentAuthor}}</div>
        <div><strong>你的评论时间：</strong>{{parentTime}}</div>
        <div><strong>回复时间：</strong>{{replyTime}}</div>
      </div>
      <div style="margin-bottom: 8px;"><strong>你的评论：</strong></div>
      <div style="padding: 12px; background: #fff; border: 1px solid rgba(0,0,0,.06); border-radius: 10px; margin-bottom: 12px;">{{parentText}}</div>
      <div style="margin-bottom: 8px;"><strong>{{replyAuthor}}</strong> 回复说：</div>
      <div style="padding: 12px; background: #fff; border: 1px solid rgba(0,0,0,.06); border-radius: 10px;">{{replyText}}</div>
    </div>
    <div style="padding: 12px 16px; background: #fafafa; border-top: 1px solid rgba(0,0,0,.06); font-size: 12px; color: #666;">
      <a href="{{postUrl}}" target="_blank" rel="noreferrer" style="color:#2563eb; text-decoration:none;">查看完整内容</a>
    </div>
  </div>
</div>
`.trim();

      // Presets (borrowed from CommentNotifier templates, with Vue3Admin placeholder syntax).
      const CN_DEFAULT_NOTIFY_COMMENT_TEMPLATE = `
<style type="text/css">.qmbox style, .qmbox script, .qmbox head, .qmbox link, .qmbox meta {display: none !important;}.emailz{background-color:white;border-top:2px solid #12ADDB;box-shadow:0 1px 3px #AAAAAA;line-height:180%;padding:0 15px 12px;width:500px;margin:35px auto;color:#555555;font-family:'Century Gothic','Trebuchet MS','Hiragino Sans GB',微软雅黑,'Microsoft Yahei',Tahoma,Helvetica,Arial,'SimSun',sans-serif;font-size:14px;}@media(max-width:767px){.emailz{width: 88%;}}</style>
<div class="emailz">
  <h2 style="border-bottom:1px solid #DDD;font-size:14px;font-weight:normal;padding:13px 0 10px 8px;">
    <span style="color: #12ADDB;font-weight: bold;">&gt; </span>
    您的<a style="text-decoration:none;color: #12ADDB;" href="{{postUrl}}" target="_blank" rel="noopener">[{{postTitle}}]</a>的文章中有了新的评论~
  </h2>
  <div style="padding:0 12px 0 12px;margin-top:18px">
    <p>时间：<span style="border-bottom:1px dashed #ccc;">{{commentTime}}</span></p>
    <div style="background-color: #f5f5f5;border: 0px solid #DDD;padding: 10px 15px;margin:18px 0">{{commentText}}</div>
    <p>评论者:<span style="color: #12ADDB;">{{commentAuthor}}</span></p>
    <p style="background-color: #f5f5f5;border: 0px solid #DDD;padding: 10px 15px;margin:18px 0">{{commentMail}}</p>
    <p>您可以点击 <a style="text-decoration:none; color:#12addb" href="{{postUrl}}" target="_blank" rel="noopener">查看回复的完整內容</a>，欢迎再次光临 <a style="text-decoration:none; color:#12addb" href="{{siteUrl}}" target="_blank" rel="noopener">{{siteTitle}}</a>。</p>
  </div>
</div>
`.trim();

      const CN_DEFAULT_NOTIFY_COMMENT_WAITING_TEMPLATE = `
<style type="text/css">.qmbox style, .qmbox script, .qmbox head, .qmbox link, .qmbox meta {display: none !important;}.emailz{background-color:white;border-top:2px solid #12ADDB;box-shadow:0 1px 3px #AAAAAA;line-height:180%;padding:0 15px 12px;width:500px;margin:35px auto;color:#555555;font-family:'Century Gothic','Trebuchet MS','Hiragino Sans GB',微软雅黑,'Microsoft Yahei',Tahoma,Helvetica,Arial,'SimSun',sans-serif;font-size:14px;}@media(max-width:767px){.emailz{width: 88%;}}</style>
<div class="emailz">
  <h2 style="border-bottom:1px solid #DDD;font-size:14px;font-weight:normal;padding:13px 0 10px 8px;">
    <span style="color: #12ADDB;font-weight: bold;">&gt; </span>
    在<a style="text-decoration:none;color: #12ADDB;" href="{{postUrl}}" target="_blank" rel="noopener">[{{postTitle}}]</a>文章中待审核评论如下
  </h2>
  <div style="padding:0 12px 0 12px;margin-top:18px">
    <p>时间：<span style="border-bottom:1px dashed #ccc;">{{commentTime}}</span></p>
    <div style="background-color: #f5f5f5;border: 0px solid #DDD;padding: 10px 15px;margin:18px 0">{{commentText}}</div>
    <p>评论者:<span style="color: #12ADDB;">{{commentAuthor}}</span></p>
    <p style="background-color: #f5f5f5;border: 0px solid #DDD;padding: 10px 15px;margin:18px 0">{{commentMail}}</p>
    <p>您可以点击 <a style="text-decoration:none; color:#12addb" href="{{reviewUrl}}" target="_blank" rel="noopener">前往审核</a>，欢迎再次光临 <a style="text-decoration:none; color:#12addb" href="{{siteUrl}}" target="_blank" rel="noopener">{{siteTitle}}</a>。</p>
  </div>
</div>
`.trim();

      const CN_DEFAULT_NOTIFY_COMMENT_REPLY_TEMPLATE = `
<style type="text/css">.qmbox style, .qmbox script, .qmbox head, .qmbox link, .qmbox meta {display: none !important;}.emailz{background-color:white;border-top:2px solid #12ADDB;box-shadow:0 1px 3px #AAAAAA;line-height:180%;padding:0 15px 12px;width:500px;margin:35px auto;color:#555555;font-family:'Century Gothic','Trebuchet MS','Hiragino Sans GB',微软雅黑,'Microsoft Yahei',Tahoma,Helvetica,Arial,'SimSun',sans-serif;font-size:14px;}@media(max-width:767px){.emailz{width: 88%;}}</style>
<div class="emailz">
  <h2 style="border-bottom:1px solid #DDD;font-size:14px;font-weight:normal;padding:13px 0 10px 8px;">
    <span style="color: #12ADDB;font-weight: bold;">&gt; </span>
    您({{parentAuthor}})在<a style="text-decoration:none;color: #12ADDB;" href="{{postUrl}}" target="_blank" rel="noopener">[{{postTitle}}]</a>的评论有了新的回复
  </h2>
  <div style="padding:0 12px 0 12px;margin-top:18px">
    <p>时间：<span style="border-bottom:1px dashed #ccc;">{{replyTime}}</span></p>
    <p>你的评论:</p>
    <div style="background-color: #f5f5f5;border: 0px solid #DDD;padding: 10px 15px;margin:18px 0">{{parentText}}</div>
    <p><strong>{{replyAuthor}}</strong>&nbsp;回复说：</p>
    <div style="background-color: #f5f5f5;border: 0px solid #DDD;padding: 10px 15px;margin:18px 0">{{replyText}}</div>
    <p>您可以点击 <a style="text-decoration:none; color:#12addb" href="{{postUrl}}" target="_blank" rel="noopener">查看回复的完整內容</a>，欢迎再次光临 <a style="text-decoration:none; color:#12addb" href="{{siteUrl}}" target="_blank" rel="noopener">{{siteTitle}}</a>。</p>
  </div>
</div>
`.trim();

      const CN_DEFAULT_NOTIFY_FRIENDLINK_TEMPLATE = `
<style type="text/css">.qmbox style, .qmbox script, .qmbox head, .qmbox link, .qmbox meta {display: none !important;}.emailz{background-color:white;border-top:2px solid #12ADDB;box-shadow:0 1px 3px #AAAAAA;line-height:180%;padding:0 15px 12px;width:500px;margin:35px auto;color:#555555;font-family:'Century Gothic','Trebuchet MS','Hiragino Sans GB',微软雅黑,'Microsoft Yahei',Tahoma,Helvetica,Arial,'SimSun',sans-serif;font-size:14px;}@media(max-width:767px){.emailz{width: 88%;}}</style>
<div class="emailz">
  <h2 style="border-bottom:1px solid #DDD;font-size:14px;font-weight:normal;padding:13px 0 10px 8px;">
    <span style="color: #12ADDB;font-weight: bold;">&gt; </span>
    收到一条新的友链申请
  </h2>
  <div style="padding:0 12px 0 12px;margin-top:18px">
    <p>名称：<span style="color:#12ADDB;">{{linkName}}</span></p>
    <p>网址：<a style="text-decoration:none;color:#12ADDB;" href="{{linkUrl}}" target="_blank" rel="noopener">{{linkUrl}}</a></p>
    <p>类型：{{linkType}}</p>
    <p>邮箱：{{linkEmail}}</p>
    <p>时间：{{applyTime}}</p>
    <div style="background-color:#f5f5f5;border:0px solid #DDD;padding:10px 15px;margin:18px 0">{{linkMessage}}</div>
    <p>您可以点击 <a style="text-decoration:none; color:#12addb" href="{{reviewUrl}}" target="_blank" rel="noopener">前往审核</a>，欢迎再次光临 <a style="text-decoration:none; color:#12addb" href="{{siteUrl}}" target="_blank" rel="noopener">{{siteTitle}}</a>。</p>
  </div>
</div>
`.trim();

      const CN_DEFAULT_NOTIFY_FRIENDLINK_AUDIT_PASS_TEMPLATE = `
<style type="text/css">.qmbox style, .qmbox script, .qmbox head, .qmbox link, .qmbox meta {display: none !important;}.emailz{background-color:white;border-top:2px solid #12ADDB;box-shadow:0 1px 3px #AAAAAA;line-height:180%;padding:0 15px 12px;width:500px;margin:35px auto;color:#555555;font-family:'Century Gothic','Trebuchet MS','Hiragino Sans GB',微软雅黑,'Microsoft Yahei',Tahoma,Helvetica,Arial,'SimSun',sans-serif;font-size:14px;}@media(max-width:767px){.emailz{width: 88%;}}</style>
<div class="emailz">
  <h2 style="border-bottom:1px solid #DDD;font-size:14px;font-weight:normal;padding:13px 0 10px 8px;">
    <span style="color: #12ADDB;font-weight: bold;">&gt; </span>
    你的友链申请已通过
  </h2>
  <div style="padding:0 12px 0 12px;margin-top:18px">
    <p>结果：{{auditResult}}</p>
    <p>审核时间：{{auditTime}}</p>
    <p>名称：<span style="color:#12ADDB;">{{linkName}}</span></p>
    <p>网址：<a style="text-decoration:none;color:#12ADDB;" href="{{linkUrl}}" target="_blank" rel="noopener">{{linkUrl}}</a></p>
    <p>类型：{{linkType}}</p>
    <p>申请时间：{{applyTime}}</p>
    <div style="background-color:#f5f5f5;border:0px solid #DDD;padding:10px 15px;margin:18px 0">{{linkMessage}}</div>
    <p>感谢你的申请！欢迎再次光临 <a style="text-decoration:none; color:#12addb" href="{{siteUrl}}" target="_blank" rel="noopener">{{siteTitle}}</a>。</p>
  </div>
</div>
`.trim();

      const CN_DEFAULT_NOTIFY_FRIENDLINK_AUDIT_REJECT_TEMPLATE = `
<style type="text/css">.qmbox style, .qmbox script, .qmbox head, .qmbox link, .qmbox meta {display: none !important;}.emailz{background-color:white;border-top:2px solid #12ADDB;box-shadow:0 1px 3px #AAAAAA;line-height:180%;padding:0 15px 12px;width:500px;margin:35px auto;color:#555555;font-family:'Century Gothic','Trebuchet MS','Hiragino Sans GB',微软雅黑,'Microsoft Yahei',Tahoma,Helvetica,Arial,'SimSun',sans-serif;font-size:14px;}@media(max-width:767px){.emailz{width: 88%;}}</style>
<div class="emailz">
  <h2 style="border-bottom:1px solid #DDD;font-size:14px;font-weight:normal;padding:13px 0 10px 8px;">
    <span style="color: #12ADDB;font-weight: bold;">&gt; </span>
    你的友链申请未通过
  </h2>
  <div style="padding:0 12px 0 12px;margin-top:18px">
    <p>结果：{{auditResult}}</p>
    <p>审核时间：{{auditTime}}</p>
    <p>名称：<span style="color:#12ADDB;">{{linkName}}</span></p>
    <p>网址：<a style="text-decoration:none;color:#12ADDB;" href="{{linkUrl}}" target="_blank" rel="noopener">{{linkUrl}}</a></p>
    <p>类型：{{linkType}}</p>
    <p>申请时间：{{applyTime}}</p>
    <div style="background-color:#f5f5f5;border:0px solid #DDD;padding:10px 15px;margin:18px 0">{{linkMessage}}</div>
    <p>如需修改信息后重新申请，请回复本邮件或通过网站提交。欢迎再次光临 <a style="text-decoration:none; color:#12addb" href="{{siteUrl}}" target="_blank" rel="noopener">{{siteTitle}}</a>。</p>
  </div>
</div>
`.trim();

      const CN_PURE_NOTIFY_COMMENT_TEMPLATE = `
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f6f6f6">
  <tr>
    <td align="center" style="padding:48px 0;">
      <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;">
        <tr>
          <td style="padding:40px 40px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;color:#333333;font-size:15px;line-height:28px;">
            <div style="color:#aaaaaa;font-size:12px;letter-spacing:1px;margin-bottom:18px;">Owner · 评论回复</div>
            <div style="font-size:26px;line-height:36px;margin-bottom:10px;">您的文章有了新的评论</div>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;"><tr><td width="96" height="8" bgcolor="#ea868f" style="border-radius:6px;font-size:0;"></td></tr></table>
            <div style="margin:0 0 18px 0;">
              <a href="{{postUrl}}" style="color:#ea868f;text-decoration:none;">《{{postTitle}}》</a>
            </div>
            <div style="color:#666666;font-size:13px;margin-bottom:14px;">
              <strong style="color:#333333;">{{commentAuthor}}</strong> · {{commentTime}} · {{commentMail}}
            </div>
            <div style="background:#f6f6f6;border-radius:12px;padding:14px 16px;color:#333333;margin-bottom:18px;">{{commentText}}</div>
            <div style="margin-top:22px;">
              <a href="{{postUrl}}" style="display:inline-block;background:#ea868f;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:10px;font-size:14px;">查看详情</a>
            </div>
            <div style="margin-top:26px;color:#999999;font-size:12px;line-height:20px;">
              {{siteTitle}}<br>
              <a href="{{siteUrl}}" style="color:#999999;text-decoration:none;">{{siteUrl}}</a>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`.trim();

      const CN_PURE_NOTIFY_COMMENT_WAITING_TEMPLATE = `
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f6f6f6">
  <tr>
    <td align="center" style="padding:48px 0;">
      <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;">
        <tr>
          <td style="padding:40px 40px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;color:#333333;font-size:15px;line-height:28px;">
            <div style="color:#aaaaaa;font-size:12px;letter-spacing:1px;margin-bottom:18px;">Notice · 待审核评论</div>
            <div style="font-size:26px;line-height:36px;margin-bottom:10px;">有一条评论待审核</div>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;"><tr><td width="96" height="8" bgcolor="#ea868f" style="border-radius:6px;font-size:0;"></td></tr></table>
            <div style="margin:0 0 18px 0;">
              <a href="{{postUrl}}" style="color:#ea868f;text-decoration:none;">《{{postTitle}}》</a>
            </div>
            <div style="color:#666666;font-size:13px;margin-bottom:14px;">
              <strong style="color:#333333;">{{commentAuthor}}</strong> · {{commentTime}} · {{commentMail}}
            </div>
            <div style="background:#f6f6f6;border-radius:12px;padding:14px 16px;color:#333333;margin-bottom:18px;">{{commentText}}</div>
            <div style="margin-top:22px;">
              <a href="{{reviewUrl}}" style="display:inline-block;background:#ea868f;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:10px;font-size:14px;">前往审核</a>
            </div>
            <div style="margin-top:26px;color:#999999;font-size:12px;line-height:20px;">
              {{siteTitle}}<br>
              <a href="{{siteUrl}}" style="color:#999999;text-decoration:none;">{{siteUrl}}</a>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`.trim();

      const CN_PURE_NOTIFY_COMMENT_REPLY_TEMPLATE = `
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f6f6f6">
  <tr>
    <td align="center" style="padding:48px 0;">
      <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;">
        <tr>
          <td style="padding:40px 40px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;color:#333333;font-size:15px;line-height:28px;">
            <div style="color:#aaaaaa;font-size:12px;letter-spacing:1px;margin-bottom:18px;">Guest · 评论回复</div>
            <div style="font-size:26px;line-height:36px;margin-bottom:10px;">你的评论有了新的回复</div>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;"><tr><td width="96" height="8" bgcolor="#ea868f" style="border-radius:6px;font-size:0;"></td></tr></table>
            <div style="margin:0 0 18px 0;">
              <a href="{{postUrl}}" style="color:#ea868f;text-decoration:none;">《{{postTitle}}》</a>
            </div>
            <div style="color:#666666;font-size:13px;margin-bottom:14px;">
              <strong style="color:#333333;">{{replyAuthor}}</strong> · {{replyTime}}
            </div>
            <div style="background:#f6f6f6;border-radius:12px;padding:14px 16px;color:#333333;margin-bottom:12px;">{{replyText}}</div>
            <div style="color:#999999;font-size:12px;margin-bottom:10px;">回复给 <strong>{{parentAuthor}}</strong>（你）</div>
            <div style="background:#f6f6f6;border-radius:12px;padding:14px 16px;color:#333333;margin-bottom:18px;">{{parentText}}</div>
            <div style="margin-top:22px;">
              <a href="{{postUrl}}" style="display:inline-block;background:#ea868f;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:10px;font-size:14px;">查看详情</a>
            </div>
            <div style="margin-top:26px;color:#999999;font-size:12px;line-height:20px;">
              {{siteTitle}}<br>
              <a href="{{siteUrl}}" style="color:#999999;text-decoration:none;">{{siteUrl}}</a>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`.trim();

      const CN_PURE_NOTIFY_FRIENDLINK_TEMPLATE = `
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f6f6f6">
  <tr>
    <td align="center" style="padding:48px 0;">
      <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;">
        <tr>
          <td style="padding:40px 40px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;color:#333333;font-size:15px;line-height:28px;">
            <div style="color:#aaaaaa;font-size:12px;letter-spacing:1px;margin-bottom:18px;">Notice · 友链申请</div>
            <div style="font-size:26px;line-height:36px;margin-bottom:10px;">有一条友链申请待审核</div>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;"><tr><td width="96" height="8" bgcolor="#ea868f" style="border-radius:6px;font-size:0;"></td></tr></table>
            <div style="margin:0 0 18px 0;">
              <strong style="color:#333333;">{{linkName}}</strong> · <a href="{{linkUrl}}" style="color:#ea868f;text-decoration:none;">{{linkUrl}}</a>
            </div>
            <div style="color:#666666;font-size:13px;margin-bottom:14px;">
              {{linkType}} · {{linkEmail}} · {{applyTime}}
            </div>
            <div style="background:#f6f6f6;border-radius:12px;padding:14px 16px;color:#333333;margin-bottom:18px;">{{linkMessage}}</div>
            <div style="margin-top:22px;">
              <a href="{{reviewUrl}}" style="display:inline-block;background:#ea868f;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:10px;font-size:14px;">前往审核</a>
            </div>
            <div style="margin-top:26px;color:#999999;font-size:12px;line-height:20px;">
              {{siteTitle}}<br>
              <a href="{{siteUrl}}" style="color:#999999;text-decoration:none;">{{siteUrl}}</a>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`.trim();

      const CN_PURE_NOTIFY_FRIENDLINK_AUDIT_PASS_TEMPLATE = `
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f6f6f6">
  <tr>
    <td align="center" style="padding:48px 0;">
      <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;">
        <tr>
          <td style="padding:40px 40px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;color:#333333;font-size:15px;line-height:28px;">
            <div style="color:#aaaaaa;font-size:12px;letter-spacing:1px;margin-bottom:18px;">Notice · 友链审核</div>
            <div style="font-size:26px;line-height:36px;margin-bottom:10px;">你的友链申请已通过</div>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;"><tr><td width="96" height="8" bgcolor="#ea868f" style="border-radius:6px;font-size:0;"></td></tr></table>
            <div style="color:#666666;font-size:13px;margin-bottom:14px;">
              {{auditResult}} · {{auditTime}}
            </div>
            <div style="margin:0 0 18px 0;">
              <strong style="color:#333333;">{{linkName}}</strong> · <a href="{{linkUrl}}" style="color:#ea868f;text-decoration:none;">{{linkUrl}}</a>
            </div>
            <div style="color:#666666;font-size:13px;margin-bottom:14px;">
              {{linkType}} · {{applyTime}}
            </div>
            <div style="background:#f6f6f6;border-radius:12px;padding:14px 16px;color:#333333;margin-bottom:18px;">{{linkMessage}}</div>
            <div style="margin-top:26px;color:#999999;font-size:12px;line-height:20px;">
              {{siteTitle}}<br>
              <a href="{{siteUrl}}" style="color:#999999;text-decoration:none;">{{siteUrl}}</a>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`.trim();

      const CN_PURE_NOTIFY_FRIENDLINK_AUDIT_REJECT_TEMPLATE = `
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f6f6f6">
  <tr>
    <td align="center" style="padding:48px 0;">
      <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;">
        <tr>
          <td style="padding:40px 40px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;color:#333333;font-size:15px;line-height:28px;">
            <div style="color:#aaaaaa;font-size:12px;letter-spacing:1px;margin-bottom:18px;">Notice · 友链审核</div>
            <div style="font-size:26px;line-height:36px;margin-bottom:10px;">你的友链申请未通过</div>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;"><tr><td width="96" height="8" bgcolor="#ea868f" style="border-radius:6px;font-size:0;"></td></tr></table>
            <div style="color:#666666;font-size:13px;margin-bottom:14px;">
              {{auditResult}} · {{auditTime}}
            </div>
            <div style="margin:0 0 18px 0;">
              <strong style="color:#333333;">{{linkName}}</strong> · <a href="{{linkUrl}}" style="color:#ea868f;text-decoration:none;">{{linkUrl}}</a>
            </div>
            <div style="color:#666666;font-size:13px;margin-bottom:14px;">
              {{linkType}} · {{applyTime}}
            </div>
            <div style="background:#f6f6f6;border-radius:12px;padding:14px 16px;color:#333333;margin-bottom:18px;">{{linkMessage}}</div>
            <div style="margin-top:26px;color:#999999;font-size:12px;line-height:20px;">
              {{siteTitle}}<br>
              <a href="{{siteUrl}}" style="color:#999999;text-decoration:none;">{{siteUrl}}</a>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`.trim();

      const NOTIFY_TEMPLATE_STYLES = [
        {
          value: "v3a",
          label: "简约卡片（Vue3Admin）",
          templates: {
            comment: DEFAULT_NOTIFY_COMMENT_TEMPLATE,
            commentWaiting: DEFAULT_NOTIFY_COMMENT_WAITING_TEMPLATE,
            commentReply: DEFAULT_NOTIFY_COMMENT_REPLY_TEMPLATE,
            friendLink: DEFAULT_NOTIFY_FRIENDLINK_TEMPLATE,
            friendLinkAuditPass: DEFAULT_NOTIFY_FRIENDLINK_AUDIT_PASS_TEMPLATE,
            friendLinkAuditReject: DEFAULT_NOTIFY_FRIENDLINK_AUDIT_REJECT_TEMPLATE,
          },
        },
        {
          value: "cn_default",
          label: "默认（CommentNotifier）",
          templates: {
            comment: CN_DEFAULT_NOTIFY_COMMENT_TEMPLATE,
            commentWaiting: CN_DEFAULT_NOTIFY_COMMENT_WAITING_TEMPLATE,
            commentReply: CN_DEFAULT_NOTIFY_COMMENT_REPLY_TEMPLATE,
            friendLink: CN_DEFAULT_NOTIFY_FRIENDLINK_TEMPLATE,
            friendLinkAuditPass: CN_DEFAULT_NOTIFY_FRIENDLINK_AUDIT_PASS_TEMPLATE,
            friendLinkAuditReject: CN_DEFAULT_NOTIFY_FRIENDLINK_AUDIT_REJECT_TEMPLATE,
          },
        },
        {
          value: "cn_pure",
          label: "PureMail（CommentNotifier）",
          templates: {
            comment: CN_PURE_NOTIFY_COMMENT_TEMPLATE,
            commentWaiting: CN_PURE_NOTIFY_COMMENT_WAITING_TEMPLATE,
            commentReply: CN_PURE_NOTIFY_COMMENT_REPLY_TEMPLATE,
            friendLink: CN_PURE_NOTIFY_FRIENDLINK_TEMPLATE,
            friendLinkAuditPass: CN_PURE_NOTIFY_FRIENDLINK_AUDIT_PASS_TEMPLATE,
            friendLinkAuditReject: CN_PURE_NOTIFY_FRIENDLINK_AUDIT_REJECT_TEMPLATE,
          },
        },
      ];
      const settingsDiscussionForm = reactive({
        commentDateFormat: "",
        commentsListSize: 20,
        commentsShowCommentOnly: 0,
        commentsMarkdown: 0,
        commentsShowUrl: 0,
        commentsUrlNofollow: 0,
        commentsAvatar: 0,
        commentsAvatarRating: "G",
        commentsPageBreak: 0,
        commentsPageSize: 10,
        commentsPageDisplay: "last",
        commentsThreaded: 0,
        commentsMaxNestingLevels: 3,
        commentsOrder: "DESC",
        commentsRequireModeration: 0,
        commentsWhitelist: 0,
        commentsRequireMail: 0,
        commentsRequireUrl: 0,
        commentsCheckReferer: 0,
        commentsAntiSpam: 0,
        commentsAutoClose: 0,
        commentsPostTimeoutDays: 0,
        commentsPostIntervalEnable: 0,
        commentsPostIntervalMins: 0,
        commentsHTMLTagAllowed: "",
      });
      const settingsNotifyForm = reactive({
        mailEnabled: 0,
        commentNotifyEnabled: 0,
        commentWaitingNotifyEnabled: 0,
        commentReplyNotifyEnabled: 0,
        friendLinkNotifyEnabled: 0,
        friendLinkAuditNotifyEnabled: 0,
        templateStyle: "v3a",
        adminTo: "",
        smtpFrom: "",
        smtpHost: "",
        smtpPort: 465,
        smtpUser: "",
        smtpPass: "",
        smtpSecure: 1,
        commentTemplate: DEFAULT_NOTIFY_COMMENT_TEMPLATE,
        commentWaitingTemplate: DEFAULT_NOTIFY_COMMENT_WAITING_TEMPLATE,
        commentReplyTemplate: DEFAULT_NOTIFY_COMMENT_REPLY_TEMPLATE,
        friendLinkTemplate: DEFAULT_NOTIFY_FRIENDLINK_TEMPLATE,
        friendLinkAuditPassTemplate: DEFAULT_NOTIFY_FRIENDLINK_AUDIT_PASS_TEMPLATE,
        friendLinkAuditRejectTemplate: DEFAULT_NOTIFY_FRIENDLINK_AUDIT_REJECT_TEMPLATE,
      });
      const settingsNotifyTesting = ref(false);
      const settingsNotifyTemplateEditorOpen = ref(false);
      const settingsNotifyTemplateKind = ref("comment"); // comment|commentWaiting|commentReply|friendLink|friendLinkAuditPass|friendLinkAuditReject
      const settingsNotifyTemplateDraft = ref("");
      const settingsNotifyTemplatePreviewHtml = computed(() => {
        const tpl = String(
          settingsNotifyForm.commentTemplate || DEFAULT_NOTIFY_COMMENT_TEMPLATE
        );
        const siteTitle = String(settingsData.site.title || "我的站点");
        const siteUrlRaw = String(settingsData.site.siteUrl || "https://example.com");
        const siteUrl = siteUrlRaw.replace(/\/+$/, "");
        const now = new Date();
        const sample = {
          siteTitle,
          siteUrl,
          postTitle: "示例文章标题",
          postUrl: siteUrl ? siteUrl + "/archives/1/" : "https://example.com/archives/1/",
          commentAuthor: "访客",
          commentMail: "guest@example.com",
          commentStatus: "approved",
          commentTime: now.toLocaleString(),
          commentText: escapeHtml("这是一条示例评论内容。\\n支持换行。").replace(
            /\\n/g,
            "<br />"
          ),
          reviewUrl: siteUrl ? siteUrl + "/Vue3Admin/#/comments" : "https://example.com/Vue3Admin/#/comments",
        };
        return renderMailTemplate(tpl, sample);
      });
      const settingsNotifyCommentWaitingTemplatePreviewHtml = computed(() => {
        const tpl = String(
          settingsNotifyForm.commentWaitingTemplate ||
            DEFAULT_NOTIFY_COMMENT_WAITING_TEMPLATE
        );
        const siteTitle = String(settingsData.site.title || "我的站点");
        const siteUrlRaw = String(settingsData.site.siteUrl || "https://example.com");
        const siteUrl = siteUrlRaw.replace(/\/+$/, "");
        const now = new Date();
        const sample = {
          siteTitle,
          siteUrl,
          postTitle: "示例文章标题",
          postUrl: siteUrl ? siteUrl + "/archives/1/" : "https://example.com/archives/1/",
          commentAuthor: "访客",
          commentMail: "guest@example.com",
          commentStatus: "waiting",
          commentTime: now.toLocaleString(),
          commentText: escapeHtml("这是一条示例待审核评论内容。\\n支持换行。").replace(
            /\\n/g,
            "<br />"
          ),
          reviewUrl: siteUrl
            ? siteUrl + "/Vue3Admin/#/comments"
            : "https://example.com/Vue3Admin/#/comments",
        };
        return renderMailTemplate(tpl, sample);
      });
      const settingsNotifyCommentReplyTemplatePreviewHtml = computed(() => {
        const tpl = String(
          settingsNotifyForm.commentReplyTemplate ||
            DEFAULT_NOTIFY_COMMENT_REPLY_TEMPLATE
        );
        const siteTitle = String(settingsData.site.title || "我的站点");
        const siteUrlRaw = String(settingsData.site.siteUrl || "https://example.com");
        const siteUrl = siteUrlRaw.replace(/\/+$/, "");
        const now = new Date();
        const sample = {
          siteTitle,
          siteUrl,
          postTitle: "示例文章标题",
          postUrl: siteUrl ? siteUrl + "/archives/1/" : "https://example.com/archives/1/",
          parentAuthor: "访客A",
          parentTime: now.toLocaleString(),
          parentText: escapeHtml("这是你之前发表的评论。\\n支持换行。").replace(
            /\\n/g,
            "<br />"
          ),
          replyAuthor: "访客B",
          replyTime: now.toLocaleString(),
          replyText: escapeHtml("这是对你评论的回复。\\n支持换行。").replace(
            /\\n/g,
            "<br />"
          ),
          reviewUrl: siteUrl
            ? siteUrl + "/Vue3Admin/#/comments"
            : "https://example.com/Vue3Admin/#/comments",
        };
        return renderMailTemplate(tpl, sample);
      });
      const settingsNotifyFriendLinkTemplatePreviewHtml = computed(() => {
        const tpl = String(
          settingsNotifyForm.friendLinkTemplate || DEFAULT_NOTIFY_FRIENDLINK_TEMPLATE
        );
        const siteTitle = String(settingsData.site.title || "我的站点");
        const siteUrlRaw = String(settingsData.site.siteUrl || "https://example.com");
        const siteUrl = siteUrlRaw.replace(/\/+$/, "");
        const now = new Date();
        const sample = {
          siteTitle,
          siteUrl,
          linkName: "示例友链名称",
          linkUrl: "https://example.com",
          linkType: "朋友",
          linkEmail: "friend@example.com",
          linkAvatar: "https://example.com/avatar.png",
          linkDescription: "这是一个示例友链描述。",
          applyTime: now.toLocaleString(),
          linkMessage: escapeHtml("这是一条示例申请留言。\\n支持换行。").replace(
            /\\n/g,
            "<br />"
          ),
          reviewUrl: siteUrl
            ? siteUrl + "/Vue3Admin/#/friends?state=1"
            : "https://example.com/Vue3Admin/#/friends?state=1",
        };
        return renderMailTemplate(tpl, sample);
      });

      const settingsNotifyFriendLinkAuditPassTemplatePreviewHtml = computed(() => {
        const tpl = String(
          settingsNotifyForm.friendLinkAuditPassTemplate ||
            DEFAULT_NOTIFY_FRIENDLINK_AUDIT_PASS_TEMPLATE
        );
        const siteTitle = String(settingsData.site.title || "我的站点");
        const siteUrlRaw = String(settingsData.site.siteUrl || "https://example.com");
        const siteUrl = siteUrlRaw.replace(/\/+$/, "");
        const now = new Date();
        const sample = {
          siteTitle,
          siteUrl,
          auditResult: "通过",
          auditTime: now.toLocaleString(),
          linkName: "示例友链名称",
          linkUrl: "https://example.com",
          linkType: "朋友",
          linkEmail: "friend@example.com",
          linkAvatar: "https://example.com/avatar.png",
          linkDescription: "这是一个示例友链描述。",
          applyTime: now.toLocaleString(),
          linkMessage: escapeHtml("这是一条示例申请留言。\\n支持换行。").replace(
            /\\n/g,
            "<br />"
          ),
        };
        return renderMailTemplate(tpl, sample);
      });

      const settingsNotifyFriendLinkAuditRejectTemplatePreviewHtml = computed(() => {
        const tpl = String(
          settingsNotifyForm.friendLinkAuditRejectTemplate ||
            DEFAULT_NOTIFY_FRIENDLINK_AUDIT_REJECT_TEMPLATE
        );
        const siteTitle = String(settingsData.site.title || "我的站点");
        const siteUrlRaw = String(settingsData.site.siteUrl || "https://example.com");
        const siteUrl = siteUrlRaw.replace(/\/+$/, "");
        const now = new Date();
        const sample = {
          siteTitle,
          siteUrl,
          auditResult: "拒绝",
          auditTime: now.toLocaleString(),
          linkName: "示例友链名称",
          linkUrl: "https://example.com",
          linkType: "朋友",
          linkEmail: "friend@example.com",
          linkAvatar: "https://example.com/avatar.png",
          linkDescription: "这是一个示例友链描述。",
          applyTime: now.toLocaleString(),
          linkMessage: escapeHtml("这是一条示例申请留言。\\n支持换行。").replace(
            /\\n/g,
            "<br />"
          ),
        };
        return renderMailTemplate(tpl, sample);
      });

      const notifyTemplateStyles = NOTIFY_TEMPLATE_STYLES;
      function applySettingsNotifyTemplateStyle() {
        const value = String(settingsNotifyForm.templateStyle || "v3a");
        const found = notifyTemplateStyles.find((s) => String(s.value) === value);
        if (!found) return;
        if (!confirm("应用该样式将覆盖当前模板内容（评论/友链），是否继续？")) return;
        const templates = found.templates || {};
        settingsNotifyForm.commentTemplate = String(
          templates.comment || DEFAULT_NOTIFY_COMMENT_TEMPLATE
        );
        settingsNotifyForm.commentWaitingTemplate = String(
          templates.commentWaiting || DEFAULT_NOTIFY_COMMENT_WAITING_TEMPLATE
        );
        settingsNotifyForm.commentReplyTemplate = String(
          templates.commentReply || DEFAULT_NOTIFY_COMMENT_REPLY_TEMPLATE
        );
        settingsNotifyForm.friendLinkTemplate = String(
          templates.friendLink || DEFAULT_NOTIFY_FRIENDLINK_TEMPLATE
        );
        settingsNotifyForm.friendLinkAuditPassTemplate = String(
          templates.friendLinkAuditPass || DEFAULT_NOTIFY_FRIENDLINK_AUDIT_PASS_TEMPLATE
        );
        settingsNotifyForm.friendLinkAuditRejectTemplate = String(
          templates.friendLinkAuditReject || DEFAULT_NOTIFY_FRIENDLINK_AUDIT_REJECT_TEMPLATE
        );
      }

      function openSettingsNotifyTemplateEditor(kind = "comment") {
        const k = String(kind || "comment");
        settingsNotifyTemplateKind.value =
          k === "friendLinkAuditPass"
            ? "friendLinkAuditPass"
            : k === "friendLinkAuditReject"
              ? "friendLinkAuditReject"
              : k === "friendLink"
                ? "friendLink"
                : k === "commentWaiting"
                  ? "commentWaiting"
                  : k === "commentReply"
                    ? "commentReply"
                    : "comment";

        const tpl =
          settingsNotifyTemplateKind.value === "friendLinkAuditPass"
            ? settingsNotifyForm.friendLinkAuditPassTemplate ||
              DEFAULT_NOTIFY_FRIENDLINK_AUDIT_PASS_TEMPLATE
            : settingsNotifyTemplateKind.value === "friendLinkAuditReject"
              ? settingsNotifyForm.friendLinkAuditRejectTemplate ||
                DEFAULT_NOTIFY_FRIENDLINK_AUDIT_REJECT_TEMPLATE
              : settingsNotifyTemplateKind.value === "friendLink"
                ? settingsNotifyForm.friendLinkTemplate ||
                  DEFAULT_NOTIFY_FRIENDLINK_TEMPLATE
                : settingsNotifyTemplateKind.value === "commentWaiting"
                  ? settingsNotifyForm.commentWaitingTemplate ||
                    DEFAULT_NOTIFY_COMMENT_WAITING_TEMPLATE
                  : settingsNotifyTemplateKind.value === "commentReply"
                    ? settingsNotifyForm.commentReplyTemplate ||
                      DEFAULT_NOTIFY_COMMENT_REPLY_TEMPLATE
                    : settingsNotifyForm.commentTemplate ||
                      DEFAULT_NOTIFY_COMMENT_TEMPLATE;
        settingsNotifyTemplateDraft.value = String(tpl);
        settingsNotifyTemplateEditorOpen.value = true;
      }
      function closeSettingsNotifyTemplateEditor() {
        settingsNotifyTemplateEditorOpen.value = false;
      }
      function applySettingsNotifyTemplateDraft() {
        const next = String(settingsNotifyTemplateDraft.value || "").trim();
        if (settingsNotifyTemplateKind.value === "friendLinkAuditPass") {
          settingsNotifyForm.friendLinkAuditPassTemplate =
            next || DEFAULT_NOTIFY_FRIENDLINK_AUDIT_PASS_TEMPLATE;
        } else if (settingsNotifyTemplateKind.value === "friendLinkAuditReject") {
          settingsNotifyForm.friendLinkAuditRejectTemplate =
            next || DEFAULT_NOTIFY_FRIENDLINK_AUDIT_REJECT_TEMPLATE;
        } else if (settingsNotifyTemplateKind.value === "friendLink") {
          settingsNotifyForm.friendLinkTemplate = next || DEFAULT_NOTIFY_FRIENDLINK_TEMPLATE;
        } else if (settingsNotifyTemplateKind.value === "commentWaiting") {
          settingsNotifyForm.commentWaitingTemplate =
            next || DEFAULT_NOTIFY_COMMENT_WAITING_TEMPLATE;
        } else if (settingsNotifyTemplateKind.value === "commentReply") {
          settingsNotifyForm.commentReplyTemplate =
            next || DEFAULT_NOTIFY_COMMENT_REPLY_TEMPLATE;
        } else {
          settingsNotifyForm.commentTemplate = next || DEFAULT_NOTIFY_COMMENT_TEMPLATE;
        }
        settingsNotifyTemplateEditorOpen.value = false;
      }

      const settingsAiForm = reactive({
        enabled: 0,
        baseUrl: "",
        model: "",
        temperature: 0.2,
        timeout: 60,
        languages: "",
        apiKey: "",
        translateEnabled: 0,
        summaryEnabled: 0,
        commentEnabled: 0,
        polishEnabled: 0,
        slugEnabled: 0,
      });
      try {
        const inst = typeof getCurrentInstance === "function" ? getCurrentInstance() : null;
        if (inst && inst.proxy && inst.proxy.settingsAiForm === undefined) {
          inst.proxy.settingsAiForm = settingsAiForm;
        }
      } catch (e) {}

      const settingsPermalinkForm = reactive({
        rewrite: 0,
        postPattern: "",
        customPattern: "",
        pagePattern: "",
        categoryPattern: "",
      });
      const settingsPermalinkRewriteError = ref("");
      const settingsPermalinkEnableRewriteAnyway = ref(0);

      watch(
        () => Number(settingsPermalinkForm.rewrite || 0),
        (v) => {
          if (!v) {
            settingsPermalinkRewriteError.value = "";
            settingsPermalinkEnableRewriteAnyway.value = 0;
          }
        }
      );
      const permalinkPostPatternOptions = [
        { value: "/archives/[cid:digital]/", label: "默认风格", example: "/archives/{cid}/" },
        { value: "/archives/[slug].html", label: "wordpress风格", example: "/archives/{slug}.html" },
        {
          value: "/[year:digital:4]/[month:digital:2]/[day:digital:2]/[slug].html",
          label: "按日期归档",
          example: "/{year}/{month}/{day}/{slug}.html",
        },
        { value: "/[category]/[slug].html", label: "按分类归档", example: "/{category}/{slug}.html" },
        { value: "custom", label: "个性化定义", example: "" },
      ];

      // Settings: ACL
      const settingsAclLoading = ref(false);
      const settingsAclLoaded = ref(false);
      const settingsAclGroup = ref("contributor");
      const settingsAclForm = reactive({
        version: 1,
        groups: {},
      });
      const settingsAclOriginal = ref("");
      const settingsAclGroupLevel = computed(() => v3aGroupLevel(settingsAclGroup.value));

      // Settings: Themes & Plugins
      const themesLoading = ref(false);
      const themesError = ref("");
      const themesItems = ref([]);
      const themeCurrent = ref("");
      const themeSelected = ref("");
      const themeActivating = ref(false);

      const themeFilesLoading = ref(false);
      const themeFilesTheme = ref("");
      const themeFiles = ref([]);
      const themeFile = ref("");
      const themeFileLoading = ref(false);
      const themeFileContent = ref("");
      const themeFileBase = ref(null);
      const themeFileWriteable = ref(0);
      const themeFileSaving = ref(false);

      // Theme editor UI (split + tree)
      const themeEditSearch = ref("");
      const themeEditTreeOpen = ref("");
      const themeEditLeftWidth = ref(260);
      const themeEditPendingFile = ref("");

      const themeEditFilesFiltered = computed(() => {
        const q = String(themeEditSearch.value || "").trim().toLowerCase();
        const files = Array.isArray(themeFiles.value) ? themeFiles.value : [];
        if (!q) return files;
        return files.filter((f) => String(f || "").toLowerCase().includes(q));
      });

      function toggleThemeEditTree(themeName) {
        const name = String(themeName || "");
        if (!name) return;
        if (themeEditTreeOpen.value === name) {
          themeEditTreeOpen.value = "";
          return;
        }
        if (themeSelected.value !== name && themeFileDirty.value) {
          if (!confirm("当前文件有未保存的修改，确定要切换主题吗？")) return;
        }
        themeEditTreeOpen.value = name;
        if (themeSelected.value !== name) themeSelected.value = name;
      }

      function openThemeEditFile(themeName, fileName) {
        const theme = String(themeName || "");
        const file = String(fileName || "");
        if (!theme || !file) return;
        const switchingTheme = themeSelected.value !== theme;
        const switchingFile = !switchingTheme && String(themeFile.value || "") !== file;
        if ((switchingTheme || switchingFile) && themeFileDirty.value) {
          if (!confirm("当前文件有未保存的修改，确定要切换吗？")) return;
        }
        themeEditTreeOpen.value = theme;
        themeEditPendingFile.value = file;
        if (switchingTheme) {
          themeSelected.value = theme;
          return;
        }
        themeFile.value = file;
      }

      function clampThemeEditLeftWidth(w) {
        const n = Number(w);
        if (!Number.isFinite(n)) return 260;
        return Math.max(200, Math.min(460, n));
      }

      function startThemeEditResize(event) {
        const e = event;
        if (!e || typeof e.clientX !== "number") return;
        try {
          e.preventDefault();
        } catch (err) {}
        const startX = e.clientX;
        const startW = clampThemeEditLeftWidth(themeEditLeftWidth.value);

        const onMove = (ev) => {
          if (!ev || typeof ev.clientX !== "number") return;
          themeEditLeftWidth.value = clampThemeEditLeftWidth(
            startW + (ev.clientX - startX)
          );
        };

        const onUp = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      }

      // Theme editor: CodeMirror 6 (bundled locally, loaded on demand)
      const themeEditEditorEl = ref(null);
      const themeEditEditorFailed = ref(0);
      let themeEditEditorView = null;
      let themeEditEditorApplying = false;
      let themeEditEditorLangCompartment = null;
      let themeEditEditorEditableCompartment = null;
      let themeEditEditorCm = null;

      let cm6Cache = null;
      let cm6Promise = null;

      async function ensureCodeMirror6() {
        if (cm6Cache) return cm6Cache;
        if (cm6Promise) return cm6Promise;
        const localUrl = v3aAssetUrl("vendor/codemirror6.bundle.js");
        cm6Promise = import(localUrl)
          .then((cm) => {
            cm6Cache = cm;
            return cm6Cache;
          })
          .catch((e) => {
            cm6Promise = null;
            throw e;
          });
        return cm6Promise;
      }

      function themeEditEditorLanguageForFile(fileName) {
        const cm = themeEditEditorCm;
        if (!cm) return [];
        const file = String(fileName || "").toLowerCase();
        if (file.endsWith(".php")) return cm.php();
        if (file.endsWith(".js")) return cm.javascript();
        if (file.endsWith(".ts")) return cm.javascript({ typescript: true });
        if (file.endsWith(".css")) return cm.css();
        if (file.endsWith(".json")) return cm.json();
        if (file.endsWith(".md")) return cm.markdown();
        if (file.endsWith(".html") || file.endsWith(".htm")) return cm.html();
        if (file.endsWith(".xml")) return cm.html();
        return [];
      }

      function destroyThemeEditEditor() {
        try {
          if (themeEditEditorView) themeEditEditorView.destroy();
        } catch (e) {}
        themeEditEditorView = null;
        themeEditEditorLangCompartment = null;
        themeEditEditorEditableCompartment = null;
        themeEditEditorCm = null;
      }

      async function initThemeEditEditor() {
        if (themeEditEditorFailed.value) return;
        if (themeEditEditorView) return;
        const el = themeEditEditorEl.value;
        if (!el) return;

        try {
          const cm = await ensureCodeMirror6();
          themeEditEditorCm = cm;

          const { EditorView, EditorState, Compartment } = cm;
          const languageCompartment = new Compartment();
          const editableCompartment = new Compartment();
          themeEditEditorLangCompartment = languageCompartment;
          themeEditEditorEditableCompartment = editableCompartment;

          const updateListener = EditorView.updateListener.of((update) => {
            if (!update || !update.docChanged) return;
            if (themeEditEditorApplying) return;
            themeEditEditorApplying = true;
            try {
              themeFileContent.value = update.state.doc.toString();
            } finally {
              themeEditEditorApplying = false;
            }
          });

          const editorTheme = EditorView.theme({
            "&": { height: "100%" },
            ".cm-scroller": { overflow: "auto" },
          });

           const state = EditorState.create({
             doc: String(themeFileContent.value ?? ""),
             extensions: [
               cm.basicSetup,
               EditorView.lineWrapping,
               cm.syntaxHighlighting(cm.defaultHighlightStyle, { fallback: true }),
               languageCompartment.of(themeEditEditorLanguageForFile(themeFile.value)),
               editableCompartment.of(EditorView.editable.of(!!themeFileWriteable.value)),
               cm.keymap.of([
                 {
                  key: "Mod-s",
                  preventDefault: true,
                  run: () => {
                    saveThemeFile();
                    return true;
                  },
                },
              ]),
              updateListener,
              editorTheme,
            ],
          });

          themeEditEditorView = new EditorView({
            state,
            parent: el,
          });
        } catch (e) {
          console.error(e);
          themeEditEditorFailed.value = 1;
          destroyThemeEditEditor();
        }
      }

      function updateThemeEditEditorContent() {
        const view = themeEditEditorView;
        if (!view) return;
        if (themeEditEditorApplying) return;
        const next = String(themeFileContent.value ?? "");
        const current = view.state.doc.toString();
        if (next === current) return;
        themeEditEditorApplying = true;
        try {
          view.dispatch({
            changes: { from: 0, to: current.length, insert: next },
          });
        } finally {
          themeEditEditorApplying = false;
        }
      }

      function updateThemeEditEditorLanguage() {
        const view = themeEditEditorView;
        const c = themeEditEditorLangCompartment;
        if (!view || !c) return;
        try {
          view.dispatch({
            effects: c.reconfigure(themeEditEditorLanguageForFile(themeFile.value)),
          });
        } catch (e) {}
      }

      function updateThemeEditEditorEditable() {
        const view = themeEditEditorView;
        const c = themeEditEditorEditableCompartment;
        const cm = themeEditEditorCm;
        if (!view || !c || !cm) return;
        try {
          view.dispatch({
            effects: c.reconfigure(cm.EditorView.editable.of(!!themeFileWriteable.value)),
          });
        } catch (e) {}
      }

      const themeConfigLoading = ref(false);
      const themeConfigTheme = ref("");
      const themeConfigExists = ref(0);
      const themeConfigFields = ref([]);
      const themeConfigForm = reactive({});
      const themeConfigBase = ref(null);
      const themeConfigSaving = ref(false);
      const themeConfigHtml = ref("");

      const pluginsLoading = ref(false);
      const pluginsError = ref("");
      const pluginsActivated = ref([]);
      const pluginsInactive = ref([]);
      const pluginsActing = ref(false);

      const pluginConfigOpen = ref(false);
      const pluginConfigLoading = ref(false);
      const pluginConfigSaving = ref(false);
      const pluginConfigName = ref("");
      const pluginConfigTitle = ref("");
      const pluginConfigExists = ref(0);
      const pluginConfigHtml = ref("");
      const pluginConfigLegacyEl = ref(null);
      const pluginConfigLoadedScripts = new Set();
      let pluginConfigRenderToken = 0;

      function v3aStableStringify(value) {
        if (value === undefined) return "null";
        if (value === null) return "null";
        if (typeof value !== "object") return JSON.stringify(value);
        if (Array.isArray(value)) {
          return `[${value.map((v) => v3aStableStringify(v)).join(",")}]`;
        }
        const keys = Object.keys(value).sort();
        return `{${keys
          .map((k) => `${JSON.stringify(k)}:${v3aStableStringify(value[k])}`)
          .join(",")}}`;
      }

      function v3aEscapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, (ch) => {
          switch (ch) {
            case "&":
              return "&amp;";
            case "<":
              return "&lt;";
            case ">":
              return "&gt;";
            case '"':
              return "&quot;";
            case "'":
              return "&#39;";
            default:
              return ch;
          }
        });
      }

      function v3aEscapeAttr(value) {
        return v3aEscapeHtml(value).replace(/`/g, "&#96;");
      }

      function v3aSanitizeHref(href) {
        const raw = String(href ?? "").trim();
        if (!raw) return "";
        const lower = raw.toLowerCase();
        if (
          lower.startsWith("javascript:") ||
          lower.startsWith("data:") ||
          lower.startsWith("vbscript:")
        ) {
          return "";
        }
        if (raw.startsWith("#") || raw.startsWith("/")) return raw;
        try {
          const url = new URL(raw, window.location.origin);
          const proto = String(url.protocol || "").toLowerCase();
          if (proto === "http:" || proto === "https:" || proto === "mailto:") {
            return url.href;
          }
          return raw;
        } catch (e) {
          return raw;
        }
      }

      function v3aSimpleLinkHtml(inputHtml) {
        const html = String(inputHtml ?? "");
        if (!html) return "";

        let doc = null;
        try {
          doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
        } catch (e) {
          return v3aEscapeHtml(html);
        }

        const root = doc.body && doc.body.firstChild ? doc.body.firstChild : doc.body;
        const out = [];

        function walk(node) {
          if (!node) return;
          if (node.nodeType === 3) {
            out.push(v3aEscapeHtml(node.textContent || ""));
            return;
          }
          if (node.nodeType !== 1) return;

          const tag = String(node.tagName || "").toLowerCase();
          if (tag === "a") {
            const href = v3aSanitizeHref(node.getAttribute("href") || "");
            const text = node.textContent || href;
            if (href) {
              out.push(
                `<a class="v3a-link" href="${v3aEscapeAttr(
                  href
                )}" target="_blank" rel="noreferrer noopener">${v3aEscapeHtml(
                  text
                )}</a>`
              );
            } else {
              out.push(v3aEscapeHtml(text));
            }
            return;
          }

          if (tag === "br") {
            out.push("<br>");
            return;
          }

          const children = Array.from(node.childNodes || []);
          for (const child of children) walk(child);
          if (tag === "p" || tag === "div") out.push("<br>");
        }

        const children = Array.from((root && root.childNodes) || []);
        for (const child of children) walk(child);

        let result = out.join("");
        result = result.replace(/(<br>)+$/g, "");
        return result;
      }

      const themeFileDirty = computed(() => {
        if (themeFileLoading.value) return false;
        if (themeFileBase.value === null) return false;
        return String(themeFileContent.value ?? "") !== String(themeFileBase.value ?? "");
      });

      const themeConfigDirty = computed(() => {
        if (themeConfigLoading.value) return false;
        if (themeConfigBase.value === null) return false;
        return v3aStableStringify(themeConfigForm) !== themeConfigBase.value;
      });

      const themeConfigIframe = ref(null);
      const themeConfigLegacyUrl = computed(() => {
        const theme = String(themeCurrent.value || themeSelected.value || "");
        if (!theme) return "";
        try {
          const url = new URL("theme-config.php", location.href);
          url.searchParams.set("theme", theme);
          return url.toString();
        } catch (e) {
          const base = String(location.href || "").split("#")[0];
          const dir = base.replace(/[^/]*$/, "");
          return dir + "theme-config.php?theme=" + encodeURIComponent(theme);
        }
      });

      function resizeThemeConfigIframe() {
        const el = themeConfigIframe.value;
        if (!el) return;
        try {
          const doc = el.contentDocument;
          if (!doc || !doc.body) return;
          const h = Math.max(100, doc.body.scrollHeight || 0);
          el.style.height = `${h}px`;
        } catch (e) {}
      }

      watch(
        () => themeConfigLegacyUrl.value,
        async () => {
          await nextTick();
          setTimeout(resizeThemeConfigIframe, 30);
          setTimeout(resizeThemeConfigIframe, 300);
          setTimeout(resizeThemeConfigIframe, 1000);
        }
      );

      function v3aAdminStaticUrl(pathname) {
        const p = String(pathname || "").replace(/^\/+/, "");
        if (!p) return "";
        try {
          return new URL(p, location.href).toString();
        } catch (e) {
          const base = String(location.href || "").split("#")[0];
          const dir = base.replace(/[^/]*$/, "");
          return dir + p;
        }
      }

      function v3aScriptCacheKey(src, type) {
        const raw = String(src || "");
        let key = raw;
        try {
          const u = new URL(raw, location.href);
          u.searchParams.delete("v");
          key = u.toString();
        } catch (e) {}
        return type ? `${type}:${key}` : key;
      }

      function v3aLoadScriptOnce(src, attrs = {}) {
        const raw = String(src || "");
        if (!raw) return Promise.resolve(false);

        const type = attrs && attrs.type ? String(attrs.type) : "";
        const key = v3aScriptCacheKey(raw, type);
        if (pluginConfigLoadedScripts.has(key)) return Promise.resolve(true);
        pluginConfigLoadedScripts.add(key);

        return new Promise((resolve) => {
          const s = document.createElement("script");
          s.src = raw;
          if (type) s.type = type;
          if (attrs && attrs.noModule) s.noModule = true;
          if (attrs && attrs.crossorigin) s.crossOrigin = String(attrs.crossorigin);
          if (attrs && attrs.referrerpolicy)
            s.referrerPolicy = String(attrs.referrerpolicy);
          if (attrs && attrs.integrity) s.integrity = String(attrs.integrity);
          s.async = false;
          s.onload = () => resolve(true);
          s.onerror = () => resolve(false);
          document.head.appendChild(s);
        });
      }

      async function v3aEnsureAdminDepsLoaded() {
        await v3aLoadScriptOnce(v3aAdminStaticUrl("js/jquery.js"));
        await v3aLoadScriptOnce(v3aAdminStaticUrl("js/jquery-ui.js"));
        await v3aLoadScriptOnce(v3aAdminStaticUrl("js/typecho.js"));
      }

      async function v3aExecuteScriptsIn(root) {
        if (!root) return;

        // Ensure base deps for most legacy plugins.
        await v3aEnsureAdminDepsLoaded();

        const scripts = Array.from(root.querySelectorAll("script"));
        for (const oldScript of scripts) {
          const parent = oldScript.parentNode;
          if (parent) parent.removeChild(oldScript);

          const src = oldScript.getAttribute("src");
          const type = oldScript.getAttribute("type");
          const attrs = {
            type: type ? String(type) : "",
            noModule: oldScript.hasAttribute("nomodule"),
            crossorigin: oldScript.getAttribute("crossorigin") || "",
            referrerpolicy: oldScript.getAttribute("referrerpolicy") || "",
            integrity: oldScript.getAttribute("integrity") || "",
          };

          if (src) {
            let abs = "";
            try {
              abs = new URL(src, location.href).toString();
            } catch (e) {
              abs = src;
            }
            const absLower = String(abs).toLowerCase();
            const isAdminCore =
              absLower.includes("/js/jquery.js") ||
              absLower.includes("/js/jquery-ui.js") ||
              absLower.includes("/js/typecho.js");

            if (isAdminCore) {
              await v3aLoadScriptOnce(abs, attrs);
            } else {
              await new Promise((resolve) => {
                try {
                  const s = document.createElement("script");
                  s.src = abs;
                  if (attrs.type) s.type = attrs.type;
                  if (attrs.noModule) s.noModule = true;
                  if (attrs.crossorigin) s.crossOrigin = String(attrs.crossorigin);
                  if (attrs.referrerpolicy)
                    s.referrerPolicy = String(attrs.referrerpolicy);
                  if (attrs.integrity) s.integrity = String(attrs.integrity);
                  s.async = false;
                  s.onload = () => resolve(true);
                  s.onerror = () => resolve(false);
                  root.appendChild(s);
                } catch (e) {
                  resolve(false);
                }
              });
            }
            continue;
          }

          const code = oldScript.textContent || "";
          if (!code.trim()) continue;

          try {
            const s = document.createElement("script");
            if (attrs.type) s.type = attrs.type;
            s.textContent = code;
            root.appendChild(s);
          } catch (e) {}
        }
      }

      let chartVisitWeek = null;
      let chartPublish = null;
      let chartCategory = null;
      let chartComment = null;
      let chartTag = null;
      let chartDataTrafficTrend = null;
      let chartDataTrafficReferring = null;
      let chartDataTrafficPopular = null;
      let resizeBound = false;
      let skipNextWriteLoad = false;
      let skipNextPageLoad = false;

      const crumb = computed(() =>
        findRouteTitle(
          route.value,
          settingsOpen.value,
          settingsActiveKey.value
        )
      );
      const crumbParts = computed(() => {
        const text = String(crumb.value || "").trim();
        if (!text) return { path: "", current: "" };
        const sep = " / ";
        const segs = text
          .split(sep)
          .map((s) => String(s || "").trim())
          .filter(Boolean);
        if (segs.length <= 1) return { path: "", current: text };
        const current = String(segs.pop() || "").trim();
        return { path: segs.join(sep), current: current || text };
      });
      const crumbPath = computed(() => crumbParts.value.path);
      const crumbCurrent = computed(() => crumbParts.value.current);

      const username = computed(() =>
        V3A.user && V3A.user.name ? String(V3A.user.name) : "Typecho"
      );
      const userInitial = computed(() => {
        const name = username.value.trim();
        return name ? name.slice(0, 1).toUpperCase() : "U";
      });

      const aboutRepoUrl = "https://github.com/TGU-HansJack/Vue3Admin-Typecho";
      const aboutWebsiteUrl = "https://www.hansjack.com";
      const aboutQqGroup = "556339740";
      const aboutVersion = computed(() =>
        V3A && V3A.version ? String(V3A.version) : ""
      );
      const aboutBuildTime = computed(() => {
        const v = Number(v3aAssetVer || 0);
        if (!v) return "";
        try {
          const d = new Date(v * 1000);
          if (Number.isNaN(d.getTime())) return "";
          return d.toLocaleString();
        } catch (e) {
          return "";
        }
      });
      const aboutSponsorUrl = computed(() => v3aAssetUrl("sponsor.png"));
      const aboutBadges = (() => {
        const repo = "TGU-HansJack/Vue3Admin-Typecho";
        return [
          {
            alt: "Stars",
            src: `https://img.shields.io/github/stars/${repo}?style=social`,
            href: `${aboutRepoUrl}/stargazers`,
          },
          {
            alt: "Issues",
            src: `https://img.shields.io/github/issues/${repo}`,
            href: `${aboutRepoUrl}/issues`,
          },
          {
            alt: "Latest Release",
            src: `https://img.shields.io/github/v/release/${repo}`,
            href: `${aboutRepoUrl}/releases`,
          },
          {
            alt: "License",
            src: `https://img.shields.io/github/license/${repo}`,
            href: `${aboutRepoUrl}`,
          },
        ];
      })();
      const aboutThanks = [
        {
          name: "mx-space / mx-admin",
          url: "https://github.com/mx-space/mx-admin",
          scope: "界面参考与布局实现",
          desc: "Vue3Admin 的后台视觉与交互中，存在基于 mx-admin 的结构化参考与适配实现。",
          refs:
            "Vue3Admin: admin/assets/app.css, admin/assets/app.js; 来源参考: mx-admin/src/components/sidebar/index.module.css, mx-admin/src/layouts/sidebar/index.module.css, mx-admin/src/layouts/sidebar/index.tsx, mx-admin/src/index.css",
          adopted:
            "侧边栏/内容区变量体系（--sidebar-width、--page-bg、--content-shadow 等）、折叠与移动端遮罩布局思路、Toast 的 sonner 风格层次、评论页 master-detail 分栏交互、Dashboard/Settings 的间距与尺寸标尺映射。",
        },
        {
          name: "Typecho",
          url: "https://typecho.org/",
          scope: "宿主框架",
          desc: "提供插件体系、Widget、路由与后台能力，是 Vue3Admin 的运行基础。",
          refs: "Plugin.php / admin/api.php / admin/index.php",
        },
        {
          name: "Vue 3",
          url: "https://vuejs.org/",
          scope: "前端框架",
          desc: "后台 SPA 的响应式状态、组件渲染与交互逻辑基于 Vue 3。",
          refs: "admin/index.php (vueCdn) / admin/assets/app.js",
        },
        {
          name: "Apache ECharts",
          url: "https://echarts.apache.org/",
          scope: "图表引擎",
          desc: "用于仪表盘访问趋势、分类/发布数据等可视化图表。",
          refs: "admin/index.php (echartsCdn) / admin/assets/app.js",
        },
        {
          name: "ECharts WordCloud",
          url: "https://github.com/ecomfe/echarts-wordcloud",
          scope: "图表扩展",
          desc: "用于标签词云等扩展图表能力。",
          refs: "admin/index.php (echarts-wordcloud.min.js)",
          commits: "af8099f",
        },
        {
          name: "Vditor",
          url: "https://b3log.org/vditor/",
          scope: "Markdown 编辑器",
          desc: "文章/页面编辑、预览与上传流程支持。",
          refs: "Plugin.php (vditorCdn*) / admin/index.php / admin/assets/app.js",
          commits: "04c69f8, d168d4f",
        },
        {
          name: "CodeMirror 6",
          url: "https://codemirror.net/6/",
          scope: "代码编辑器",
          desc: "用于主题编辑器与 JSON 字段编辑弹窗。",
          refs: "admin/assets/vendor/codemirror6.bundle.js / admin/assets/app.js",
          commits: "d6a1d56",
        },
        {
          name: "PHPMailer",
          url: "https://github.com/PHPMailer/PHPMailer",
          scope: "邮件发送",
          desc: "评论通知、友链通知、测试邮件等 SMTP 发送能力。",
          refs: "lib/PHPMailer/* / Plugin.php",
          commits: "995dd7c, f202efb, 33c2a7a",
        },
        {
          name: "jQuery",
          url: "https://jquery.com/",
          scope: "兼容层",
          desc: "兼容旧版后台插件配置页与脚本执行环境。",
          refs: "admin/js/jquery.js / admin/assets/app.js",
        },
        {
          name: "jQuery UI",
          url: "https://jqueryui.com/",
          scope: "兼容层",
          desc: "为旧后台依赖的 UI 组件与交互提供兼容支持。",
          refs: "admin/js/jquery-ui.js / admin/assets/app.js",
        },
        {
          name: "DOMPurify",
          url: "https://github.com/cure53/DOMPurify",
          scope: "安全清洗",
          desc: "用于 HTML 内容清洗，降低富文本渲染风险。",
          refs: "admin/js/purify.js",
        },
        {
          name: "HyperDown",
          url: "https://github.com/hyperdown/hyperdown",
          scope: "Markdown 兼容",
          desc: "沿用 Typecho 传统后台的 Markdown 相关处理能力。",
          refs: "admin/js/hyperdown.js",
        },
        {
          name: "PageDown",
          url: "https://github.com/StackExchange/pagedown",
          scope: "Markdown 兼容",
          desc: "沿用 Typecho 传统后台编辑链路中的解析与工具能力。",
          refs: "admin/js/pagedown.js",
        },
        {
          name: "Normalize.css",
          url: "https://necolas.github.io/normalize.css/",
          scope: "样式基础",
          desc: "统一浏览器默认样式基线，减少后台页面差异。",
          refs: "admin/css/normalize.css",
        },
        {
          name: "Lucide Icons",
          url: "https://lucide.dev/",
          scope: "图标系统",
          desc: "后台导航与操作图标的主要来源。",
          refs: "admin/assets/app.js (ICONS)",
        },
        {
          name: "ShouTuTa（守兔塔）",
          url: "",
          scope: "插件联动",
          desc: "对已安装守兔塔插件进行状态读取、统计查询与管理联动。",
          refs: "admin/api.php / admin/index.php / admin/assets/app.js",
          commits: "1b12a6f, c149dfc",
        },
        {
          name: "AbuseIPDB",
          url: "https://www.abuseipdb.com/",
          scope: "威胁情报",
          desc: "在守兔塔联动场景中提供 IP 信誉查询能力。",
          refs: "admin/api.php / admin/assets/app.js",
        },
        {
          name: "Gravatar",
          url: "https://gravatar.com/",
          scope: "头像服务",
          desc: "用户头像展示与镜像配置支持。",
          refs: "admin/assets/app.js / admin/api.php",
          commits: "aadac7c",
        },
      ];
      const aboutChangelog = computed(() => {
        const build = aboutBuildTime.value ? `Build ${aboutBuildTime.value}` : "";
        return [
          {
            version: "本地定制",
            date: build,
            items: [
              "通知设置对齐旧版清单：新评论/待审核/评论回复/友链申请/友链审核结果邮件",
              "补齐旧版后台的评论设置项（日期格式、分页、反垃圾、HTML 白名单等）",
              "新增“关于”页面（介绍、更新日志、版权、致谢、赞助）",
            ],
          },
          {
            version: "1.2.4",
            date: "2026-02-09",
            items: [
              "修复序列化选项数据格式并优化选项处理逻辑",
              "添加管理员目录重定向与路径处理改进",
              "发布版本号更新至 1.2.4",
            ],
          },
          {
            version: "1.2.3",
            date: "2026-02-07",
            items: [
              "实现本地存储替代数据库表，优化遗留数据迁移",
              "文章永久链接支持，移动端表格显示优化",
              "浅色主题内容区背景样式优化",
            ],
          },
          {
            version: "1.2.1",
            date: "2026-02-06",
            items: [
              "升级设置新增网络源选择",
              "API 代码风格整理（匿名函数改传统函数语法）",
            ],
          },
          {
            version: "1.2.0",
            date: "2026-02-06",
            items: [
              "移动端侧边栏/滑动交互体验优化",
              "创意工坊功能支持与 UI/过滤完善",
              "主题夜间模式与样式变量完善",
            ],
          },
          {
            version: "1.1.0",
            date: "2026-02-04",
            items: [
              "版本管理与升级功能、确认对话框与错误处理改进",
              "邮件发送状态记录与测试功能",
            ],
          },
          { version: "1.0.0", date: "2026-02-04", items: ["首个发布版本"] },
        ];
      });

      function isActive(path) {
        return routePath.value === path;
      }

      function isSubMenuItemActive(child) {
        if (!child) return false;
        const to = String(child.to || "");
        if (to === "/extras/panel") {
          const panel = String(child.panel || "");
          if (!panel) return routePath.value === "/extras/panel";
          return routePath.value === "/extras/panel" && String(routeQuery.value.panel || "") === panel;
        }
        return isActive(to);
      }

      function handleSubMenuClick(child) {
        if (!child) return;
        const to = String(child.to || "");
        if (to === "/extras/panel") {
          const panel = String(child.panel || "");
          if (panel) {
            navTo(`${to}?panel=${encodeURIComponent(panel)}`);
          } else {
            navTo(to);
          }
          closeMobileNav();
          return;
        }
        navTo(to);
        closeMobileNav();
      }

      function isMenuItemActive(item) {
        if (!item) return false;
        if (item.key === "settings") return routePath.value === "/settings";
        if (item.to) return isActive(item.to);
        if (item.children && item.children.length) {
          return item.children.some((c) => c && c.to && isActive(c.to));
        }
        return false;
      }

      function toggleSidebar() {
        if (isNarrowScreen.value) {
          const nextOpen = !mobileNavOpen.value;
           mobileNavOpen.value = nextOpen;
           if (nextOpen) {
             setMobileNavTab(mobileNavHasSettingsPanel.value ? 1 : 0);
           }
           return;
         }
        sidebarCollapsed.value = !sidebarCollapsed.value;
        try {
          localStorage.setItem(
            STORAGE_KEYS.sidebarCollapsed,
            sidebarCollapsed.value ? "1" : "0"
          );
        } catch (e) {}
      }

      function toggleWriteSidebar(force) {
        if (typeof force === "boolean") {
          writeSidebarOpen.value = force;
          return;
        }
        writeSidebarOpen.value = !writeSidebarOpen.value;
      }

      function toggleGroup(key) {
        if (
          expanded.value[key] &&
          ((key === "posts" && route.value.startsWith("/posts/")) ||
            (key === "pages" && route.value.startsWith("/pages/")) ||
            (key === "extras" && route.value.startsWith("/extras/")) ||
            (key === "maintenance" &&
              route.value.startsWith("/maintenance/")))
        ) {
          return;
        }

        expanded.value[key] = !expanded.value[key];
        persistExpanded();
      }

      function openSettings() {
        navTo("/settings");
      }

      function selectSettings(key) {
        const nextKey = normalizeSettingsKey(key);
        if (!settingsKeyExists(nextKey)) return;
        settingsActiveKey.value = nextKey;
        try {
          localStorage.setItem(STORAGE_KEYS.settingsKey, nextKey);
        } catch (e) {}
        navTo("/settings");
      }

      function toggleThemeSettings() {
        if (!isThemeSettingsActive.value) {
          settingsThemeOpen.value = true;
          selectSettings(lastThemeSettingsKey.value || "theme.activate");
          return;
        }
        settingsThemeOpen.value = !settingsThemeOpen.value;
      }

      function navTo(path) {
        const raw = String(path || "/dashboard");
        const normalized = v3aNormalizeRoute(raw);
        if (normalized !== raw) {
          toastError("禁止访问");
        }

        const p = normalized.split("?")[0] || "/";
        const from = routePath.value;
        if (from === "/posts/write" && p !== "/posts/write") {
          flushPostDraftAutoSave("nav");
        }
        settingsOpen.value = p === "/settings";
        ensureExpandedForRoute(p);
        persistExpanded();
        route.value = normalized;
        setRoute(normalized);
      }

      function buildApiUrl(action, params, withCsrf) {
        if (!V3A.apiUrl) return "";
        let u;
        try {
          u = new URL(V3A.apiUrl, location.href);
        } catch (e) {
          const glue = V3A.apiUrl.includes("?") ? "&" : "?";
          return (
            V3A.apiUrl +
            glue +
            "do=" +
            encodeURIComponent(action || "") +
            (withCsrf && V3A.csrfToken
              ? `&${encodeURIComponent(V3A.csrfParam || "_")}=${encodeURIComponent(
                  V3A.csrfToken
                )}`
              : "")
            + (withCsrf && V3A.csrfRef
              ? `&csrfRef=${encodeURIComponent(V3A.csrfRef)}`
              : "")
          );
        }

        u.searchParams.set("do", action || "");

        if (params && typeof params === "object") {
          for (const [k, v] of Object.entries(params)) {
            if (v === undefined || v === null || v === "") continue;
            u.searchParams.delete(k);
            if (Array.isArray(v)) {
              for (const item of v) {
                if (item === undefined || item === null || item === "") continue;
                u.searchParams.append(k, String(item));
              }
            } else {
              u.searchParams.set(k, String(v));
            }
          }
        }

        if (withCsrf && V3A.csrfToken) {
          u.searchParams.set(V3A.csrfParam || "_", V3A.csrfToken);
        }
        if (withCsrf && V3A.csrfRef) {
          u.searchParams.set("csrfRef", V3A.csrfRef);
        }

        return u.toString();
      }

      async function readApiJson(res) {
        const text = await res.text();
        const raw = String(text || "");
        const trimmed = raw.trim();
        if (!trimmed) return null;
        try {
          return JSON.parse(trimmed);
        } catch (e) {
          const snippet = trimmed.slice(0, 300);
          throw new Error(
            `API返回了非JSON响应 (HTTP ${res.status || 0}): ${snippet || "[empty]"}`
          );
        }
      }

      async function apiGet(action, params) {
        const url = buildApiUrl(action, params, false);
        const res = await fetch(url, {
          credentials: "same-origin",
          headers: { "X-Requested-With": "XMLHttpRequest", Accept: "application/json" },
        });
        const json = await readApiJson(res);
        if (!json || json.code !== 0) {
          const err = new Error(json?.message || "API error");
          err.apiCode = json?.code;
          err.apiData = json?.data;
          err.httpStatus = res.status;
          throw err;
        }
        return json.data;
      }

      async function apiPost(action, payload) {
        const url = buildApiUrl(action, null, true);
        const res = await fetch(url, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            Accept: "application/json",
          },
          body: JSON.stringify(payload || {}),
        });
        const json = await readApiJson(res);
        if (!json || json.code !== 0) {
          const err = new Error(json?.message || "API error");
          err.apiCode = json?.code;
          err.apiData = json?.data;
          err.httpStatus = res.status;
          throw err;
        }
        return json.data;
      }

      async function fetchDashboard() {
        if (!V3A.apiUrl) return;

        loadingDashboard.value = true;
        dashboardError.value = "";
        try {
          const url = V3A.apiUrl + "?do=dashboard";
          const res = await fetch(url, {
            credentials: "same-origin",
            headers: { "X-Requested-With": "XMLHttpRequest", Accept: "application/json" },
          });
          const json = await readApiJson(res);
          if (!json || json.code !== 0) throw new Error(json?.message || "API error");

          summary.value = Object.assign(summary.value, json.data.summary || {});
          visitWeekTrend.value = json.data.visitWeekTrend || [];
          publishTrend.value = json.data.publishTrend || [];
          pageTrend.value = json.data.pageTrend || [];
          commentActivity.value = json.data.commentActivity || [];
          categoryDistribution.value = json.data.categoryDistribution || [];
          hotPosts.value = json.data.hotPosts || [];
          tagTop.value = json.data.tagTop || [];
          tagGraph.value = json.data.tagGraph || { nodes: [], links: [] };
          realtime.value = Object.assign(realtime.value, json.data.realtime || {});
          systemInfo.value = Object.assign(
            systemInfo.value,
            json.data.system || {}
          );
          recentPosts.value = json.data.recentPosts || [];
          recentComments.value = json.data.recentComments || [];

          await nextTick();
          renderCharts();
        } catch (e) {
          dashboardError.value = e && e.message ? e.message : "加载失败";
        } finally {
          loadingDashboard.value = false;
        }
      }

      function getPostBadge(item) {
        if (!item) return { text: "—", tone: "" };
        const type = String(item.type || "");
        const status = String(item.status || "");
        const hasPassword = !!(item.password && String(item.password).length > 0);

        if (type === "post_draft") return { text: "草稿", tone: "warn" };
        if (status === "waiting") return { text: "待审核", tone: "warn" };
        if (status === "private") return { text: "私密", tone: "danger" };
        if (status === "hidden") return { text: "隐藏", tone: "" };
        if (hasPassword) return { text: "密码", tone: "" };
        return { text: "已发布", tone: "success" };
      }

      async function fetchPosts() {
        postsLoading.value = true;
        postsError.value = "";
        try {
          const scopeAllAllowed =
            !!V3A.canPublish &&
            (!V3A.acl || !V3A.acl.posts || Number(V3A.acl.posts.scopeAll));
          let scope = postsFilters.scope;
          if (String(scope || "mine") === "all" && !scopeAllAllowed) {
            scope = "mine";
            postsFilters.scope = "mine";
          }

          const data = await apiGet("posts.list", {
            page: postsPagination.page,
            pageSize: postsPagination.pageSize,
            status: postsFilters.status,
            keywords: postsFilters.keywords,
            category: postsFilters.category || "",
            scope,
          });
          postsItems.value = data.items || [];
          const p = data.pagination || {};
          postsPagination.page = Number(p.page || postsPagination.page) || 1;
          postsPagination.pageSize =
            Number(p.pageSize || postsPagination.pageSize) || 20;
          postsPagination.total = Number(p.total || 0) || 0;
          postsPagination.pageCount = Number(p.pageCount || 1) || 1;
        } catch (e) {
          postsError.value = e && e.message ? e.message : "加载失败";
        } finally {
          postsLoading.value = false;
        }
      }

      function applyPostsFilters() {
        postsPagination.page = 1;
        fetchPosts();
      }

      function postsGoPage(p) {
        const next = Math.max(1, Math.min(postsPagination.pageCount || 1, p));
        if (next === postsPagination.page) return;
        postsPagination.page = next;
        fetchPosts();
      }

      function postsPickCategory(mid) {
        const id = Number(mid || 0);
        postsFilters.category = id > 0 ? id : 0;
        postsPagination.page = 1;
        fetchPosts();
      }

      function openPostEditor(cid) {
        const id = Number(cid || 0);
        if (!id) {
          navTo("/posts/write");
          return;
        }
        navTo(`/posts/write?cid=${encodeURIComponent(String(id))}`);
      }

      async function fetchDraftsPosts() {
        draftsPostsLoading.value = true;
        draftsPostsError.value = "";
        try {
          const scopeAllAllowed =
            !!V3A.canPublish &&
            (!V3A.acl || !V3A.acl.posts || Number(V3A.acl.posts.scopeAll));
          let scope = String(draftsScope.value || "mine");
          if (scope === "all" && !scopeAllAllowed) {
            scope = "mine";
            draftsScope.value = "mine";
          }

          const data = await apiGet("posts.list", {
            page: draftsPostsPagination.page,
            pageSize: draftsPostsPagination.pageSize,
            status: "draft",
            keywords: draftsKeywords.value,
            scope,
          });
          draftsPostsItems.value = data.items || [];
          const p = data.pagination || {};
          draftsPostsPagination.page = Number(p.page || draftsPostsPagination.page) || 1;
          draftsPostsPagination.pageSize =
            Number(p.pageSize || draftsPostsPagination.pageSize) || 20;
          draftsPostsPagination.total = Number(p.total || 0) || 0;
          draftsPostsPagination.pageCount = Number(p.pageCount || 1) || 1;
        } catch (e) {
          draftsPostsError.value = e && e.message ? e.message : "加载失败";
        } finally {
          draftsPostsLoading.value = false;
        }
      }

      async function fetchDraftsPages() {
        draftsPagesLoading.value = true;
        draftsPagesError.value = "";
        try {
          const data = await apiGet("pages.list", {
            keywords: draftsKeywords.value,
            status: "draft",
          });
          draftsPagesItems.value = data.items || [];
        } catch (e) {
          draftsPagesError.value = e && e.message ? e.message : "加载失败";
        } finally {
          draftsPagesLoading.value = false;
        }
      }

      async function fetchDrafts() {
        await Promise.all([fetchDraftsPosts(), fetchDraftsPages()]);
      }

      function applyDraftsFilters() {
        draftsPostsPagination.page = 1;
        draftsPostsPageJump.value = 1;
        fetchDrafts();
      }

      function draftsPostsGoPage(p) {
        const next = Math.max(1, Math.min(draftsPostsPagination.pageCount || 1, p));
        if (next === draftsPostsPagination.page) return;
        draftsPostsPagination.page = next;
        fetchDraftsPosts();
      }

      function isPostSelected(cid) {
        const id = Number(cid || 0);
        return id > 0 && postsSelectedCids.value.includes(id);
      }

      function togglePostSelection(cid, checked) {
        const id = Number(cid || 0);
        if (!id) return;
        const set = new Set(postsSelectedCids.value);
        if (checked) {
          set.add(id);
        } else {
          set.delete(id);
        }
        postsSelectedCids.value = Array.from(set);
      }

      function togglePostsSelectAll(checked) {
        if (checked) {
          postsSelectedCids.value = (postsItems.value || [])
            .map((p) => Number(p.cid || 0))
            .filter((v) => v > 0);
        } else {
          postsSelectedCids.value = [];
        }
      }

      async function deleteSelectedPosts() {
        const ids = (postsSelectedCids.value || []).slice();
        if (!ids.length) return;
        if (
          !confirm(
            `确认删除选中的 ${ids.length} 篇文章吗？此操作不可恢复。`
          )
        ) {
          return;
        }

        postsError.value = "";
        try {
          await apiPost("posts.delete", { cids: ids });
          postsSelectedCids.value = [];
          fetchPosts();
        } catch (e) {
          postsError.value = e && e.message ? e.message : "删除失败";
        }
      }

      async function updateSelectedPostsStatus(status) {
        const s = String(status || "");
        const ids = (postsSelectedCids.value || []).slice();
        if (!ids.length) return;
        if (!["publish", "hidden", "private", "waiting"].includes(s)) return;
        if (s === "publish" && !V3A.canPublish) return;

        const label =
          s === "publish"
            ? "已发布"
            : s === "hidden"
              ? "隐藏"
              : s === "private"
                ? "私密"
                : "待审核";

        if (!confirm(`确认将选中的 ${ids.length} 篇文章设为「${label}」吗？`)) {
          return;
        }

        postsError.value = "";
        try {
          await apiPost("posts.status", { cids: ids, status: s });
          postsSelectedCids.value = [];
          fetchPosts();
        } catch (e) {
          postsError.value = e && e.message ? e.message : "操作失败";
        }
      }

      function postStatusIcon(item) {
        if (!item) return ICONS.eye;
        const type = String(item.type || "");
        const status = String(item.status || "");
        const hasPassword = !!(item.password && String(item.password).length > 0);

        if (type === "post_draft") return ICONS.posts;
        if (status === "hidden" || status === "private" || status === "waiting" || hasPassword) {
          return ICONS.eyeOff;
        }
        return ICONS.eye;
      }

      watch(postsItems, () => {
        postsSelectedCids.value = [];
      });

      watch(
        () => postsPagination.page,
        (p) => {
          postsPageJump.value = Number(p || 1) || 1;
        },
        { immediate: true }
      );

      watch(
        () => draftsPostsPagination.page,
        (p) => {
          draftsPostsPageJump.value = Number(p || 1) || 1;
        },
        { immediate: true }
      );

      watch(
        [postsSelectedIndeterminate, postsSelectAllEl],
        ([indeterminate, el]) => {
          if (el) {
            el.indeterminate = !!indeterminate;
          }
        },
        { immediate: true }
      );

      watch(
        [routePath, () => postForm.text],
        ([path]) => {
          if (path !== "/posts/write") return;
          autoSizePostText();
        },
        { immediate: true }
      );

      function resetPostForm() {
        postForm.cid = 0;
        postForm.title = "";
        postForm.slug = "";
        postForm.text = "";
        postForm.tags = "";
        postForm.created = 0;
        postForm.modified = 0;
        postTagInput.value = "";
        postTagEditorOpen.value = false;
        postTagFocused.value = false;
        postTagActiveIndex.value = -1;
        categorySelectOpen.value = false;
        postForm.visibility = "publish";
        postForm.password = "";
        postForm.allowComment = true;
        postForm.allowPing = true;
        postForm.allowFeed = true;
        postForm.markdown = !!V3A.markdownEnabled;
        postForm.categories.splice(0, postForm.categories.length);
        const def = Number(defaultCategoryId.value || 0);
        if (def > 0) {
          postForm.categories.push(def);
        }
        postForm.fields.splice(0, postForm.fields.length);
        postError.value = "";
        postMessage.value = "";
      }

      function setPostCategoriesFromText(text) {
        const raw = String(text || "");
        const parts = raw.split(/[,，\s]+/u);
        const ids = [];
        for (const part of parts) {
          const n = Number(String(part).trim());
          if (n > 0) ids.push(n);
        }
        const uniq = Array.from(new Set(ids));
        postForm.categories.splice(0, postForm.categories.length, ...uniq);
      }

      function addPostField() {
        postForm.fields.push({ name: "", type: "str", value: "" });
      }

      function removePostField(index) {
        const i = Number(index || 0);
        if (i < 0 || i >= postForm.fields.length) return;
        postForm.fields.splice(i, 1);
      }

      async function loadPostEditorFromRoute() {
        postLoading.value = true;
        postError.value = "";
        postMessage.value = "";
        clearPostDraftAutoSaveTimer();
        try {
          await ensureCategoriesLoaded();
          await ensureTagsLoaded();
          const cidRaw = routeQuery.value && routeQuery.value.cid;
          const cid = Number(cidRaw || 0);

          postDefaultFields.value = [];
          const data = await apiGet("posts.get", { cid: cid || "" });
          const p = data.post || {};
          const cap = data.capabilities || {};
          postCapabilities.value = {
            markdownEnabled: !!cap.markdownEnabled,
            canPublish: !!cap.canPublish,
          };
          postDefaultFields.value = Array.isArray(data.defaultFields) ? data.defaultFields : [];

          if (!cid) {
            resetPostForm();
            if (!postCapabilities.value.markdownEnabled) {
              postForm.markdown = false;
            }
            postDraftSaveState.value = "idle";
            postDraftSaveError.value = "";
            postDraftLastSavedAt.value = 0;
            postDraftLastSavedHash.value = postDraftHashValue();
            return;
          }

          postForm.cid = Number(p.cid || cid) || cid;
          postForm.title = String(p.title || "");
          postForm.slug = String(p.slug ?? "");
          if (!String(postForm.slug || "").trim() && Number(postForm.cid || 0) > 0) {
            postForm.slug = String(postForm.cid);
          }
          postForm.text = String(p.text || "");
          postForm.tags = String(p.tags || "");
          postForm.created = Number(p.created || 0) || 0;
          postForm.modified = Number(p.modified || 0) || 0;
          postTagInput.value = "";
          postTagEditorOpen.value = false;
          postTagFocused.value = false;
          postTagActiveIndex.value = -1;
          categorySelectOpen.value = false;
          postForm.password = String(p.password || "");
          postForm.visibility = String(p.visibility || p.status || "publish");
          postForm.allowComment = !!Number(p.allowComment || 0);
          postForm.allowPing = !!Number(p.allowPing || 0);
          postForm.allowFeed = !!Number(p.allowFeed || 0);
          postForm.markdown = !!p.isMarkdown;

          postForm.categories.splice(0, postForm.categories.length);
          const cats = Array.isArray(p.categories) ? p.categories : [];
          for (const c of cats) {
            const id = Number(c || 0);
            if (id > 0) postForm.categories.push(id);
          }

          postForm.fields.splice(0, postForm.fields.length);
          const fields = Array.isArray(p.fields) ? p.fields : [];
          for (const f of fields) {
            if (!f || typeof f !== "object") continue;
            postForm.fields.push({
              name: String(f.name || ""),
              type: String(f.type || "str"),
              value:
                typeof f.value === "string" || typeof f.value === "number"
                  ? String(f.value)
                  : JSON.stringify(f.value ?? ""),
            });
          }

          postDraftSaveState.value = "saved";
          postDraftSaveError.value = "";
          postDraftLastSavedAt.value = Number(postForm.modified || 0) || Math.floor(Date.now() / 1000);
          postDraftLastSavedHash.value = postDraftHashValue();
        } catch (e) {
          postError.value = e && e.message ? e.message : "加载失败";
        } finally {
          postLoading.value = false;
        }
      }

      async function submitPost(mode) {
        if (postSaving.value) return;
        postSaving.value = true;
        postError.value = "";
        postMessage.value = "";
        try {
          syncPostTextFromEditor();

          const slugWasEmpty = !String(postForm.slug || "").trim();
          if (slugWasEmpty && Number(postForm.cid || 0) > 0) {
            postForm.slug = String(postForm.cid);
          }

          const postFieldsMap = new Map();
          const postDefaults = Array.isArray(postDefaultFields.value) ? postDefaultFields.value : [];
          for (const f of postDefaults) {
            if (!f || typeof f !== "object") continue;
            const name = String(f.name || "");
            if (!name) continue;
            const v = f.value;
            const isObj = v !== null && typeof v === "object";
            postFieldsMap.set(name, {
              name,
              type: isObj ? "json" : "str",
              value: isObj ? v : String(v ?? ""),
            });
          }
          for (const f of postForm.fields) {
            if (!f || typeof f !== "object") continue;
            const name = String(f.name || "");
            if (!name) continue;
            const type = String(f.type || "str");
            postFieldsMap.set(name, {
              name,
              type,
              value: type === "json" ? safeJsonParse(f.value) : f.value,
            });
          }

          const payload = {
            cid: postForm.cid || 0,
            title: postForm.title,
            slug: postForm.slug,
            text: postForm.text,
            tags: postForm.tags,
            visibility: postForm.visibility,
            password: postForm.visibility === "password" ? postForm.password : "",
            allowComment: postForm.allowComment,
            allowPing: postForm.allowPing,
            allowFeed: postForm.allowFeed,
            markdown: postForm.markdown ? 1 : 0,
            category: postForm.categories,
            fields: Array.from(postFieldsMap.values()),
          };

          const action = mode === "publish" ? "posts.publish" : "posts.save";
          const data = await apiPost(action, payload);
          const cid = Number(data.cid || 0);
          if (cid > 0) {
            postForm.cid = cid;
            if (slugWasEmpty) {
              const nextSlug = Object.prototype.hasOwnProperty.call(data || {}, "slug")
                ? String(data.slug ?? "").trim()
                : "";
              postForm.slug = nextSlug ? nextSlug : String(cid);
            }
            if (routePath.value === "/posts/write") {
              const currentCid = Number(routeQuery.value?.cid || 0);
              if (!currentCid || currentCid !== cid) {
                skipNextWriteLoad = true;
                navTo(`/posts/write?cid=${encodeURIComponent(String(cid))}`);
              }
            }
          }

          postMessage.value =
            mode === "publish"
              ? "发布已提交"
              : "草稿已保存";
          if (mode !== "publish" && postAutoSaveEnabled.value) {
            markPostDraftSaved(Math.floor(Date.now() / 1000));
          }

          if (routePath.value === "/posts/manage") {
            fetchPosts();
          }
        } catch (e) {
          postError.value = e && e.message ? e.message : "提交失败";
        } finally {
          postSaving.value = false;
        }
      }

      async function deletePost(cid) {
        const id = Number(cid || 0);
        if (!id) return;
        if (!confirm("确认删除该文章吗？此操作不可恢复。")) return;

         postsError.value = "";
         try {
           await apiPost("posts.delete", { cids: [id] });
           if (routePath.value === "/drafts") {
             await fetchDrafts();
           }
           if (routePath.value === "/posts/manage") {
             fetchPosts();
           }
           if (routePath.value === "/posts/write") {
             const currentCid = Number(routeQuery.value?.cid || 0);
            if (currentCid === id) {
              navTo("/posts/manage");
            }
          }
        } catch (e) {
          postsError.value = e && e.message ? e.message : "删除失败";
        }
      }

      async function fetchFiles() {
        filesLoading.value = true;
        filesError.value = "";
        try {
          const PAGE_SIZE = 20;
          const data = await apiGet("files.list", {
            page: filesPagination.page,
            pageSize: PAGE_SIZE,
            keywords: filesKeywords.value,
          });
          filesItems.value = data.items || [];
          const p = data.pagination || {};
          filesPagination.page = Number(p.page || filesPagination.page) || 1;
          filesPagination.pageSize = PAGE_SIZE;
          filesPagination.total = Number(p.total || 0) || 0;
          filesPagination.pageCount = Number(p.pageCount || 1) || 1;
        } catch (e) {
          filesError.value = e && e.message ? e.message : "加载失败";
        } finally {
          filesLoading.value = false;
        }
      }

      function applyFilesFilters() {
        filesPagination.page = 1;
        fetchFiles();
      }

      function filesGoPage(p) {
        const next = Math.max(1, Math.min(filesPagination.pageCount || 1, p));
        if (next === filesPagination.page) return;
        filesPagination.page = next;
        fetchFiles();
      }

      async function uploadFiles(fileList) {
        if (!V3A.apiUrl) {
          filesError.value = "缺少上传地址（apiUrl）";
          return;
        }
        const files = Array.from(fileList || []);
        if (!files.length) return;

        const aclFiles =
          V3A.acl && typeof V3A.acl === "object" && V3A.acl.files && typeof V3A.acl.files === "object"
            ? V3A.acl.files
            : null;
        if (aclFiles && !Number(aclFiles.upload || 0)) {
          filesError.value = "当前用户组已禁用上传";
          return;
        }

        const maxSizeMb = aclFiles ? Number(aclFiles.maxSizeMb || 0) : 0;
        const allowedTypes =
          aclFiles && Array.isArray(aclFiles.types)
            ? aclFiles.types.map((t) => String(t || "").toLowerCase().replace(/^\\./, "")).filter(Boolean)
            : [];

        filesUploading.value = true;
        filesError.value = "";
        const uploadUrl = buildApiUrl("files.upload", null, true);
        try {
          for (const file of files) {
            if (maxSizeMb > 0 && Number.isFinite(file.size) && file.size > maxSizeMb * 1024 * 1024) {
              throw new Error(`文件过大：${file.name}（上限 ${maxSizeMb}MB）`);
            }

            if (allowedTypes.length) {
              const parts = String(file.name || "").split(".");
              const ext = parts.length > 1 ? String(parts[parts.length - 1] || "").toLowerCase() : "";
              if (!ext || !allowedTypes.includes(ext)) {
                throw new Error(`不允许的文件类型：${file.name}`);
              }
            }

            const form = new FormData();
            form.append("file", file, file.name);

            const res = await fetch(uploadUrl, {
              method: "POST",
              credentials: "same-origin",
              headers: { "X-Requested-With": "XMLHttpRequest", Accept: "application/json" },
              body: form,
            });

            const json = await readApiJson(res);
            if (json && typeof json === "object" && json.code !== undefined) {
              if (Number(json.code) !== 0) {
                throw new Error(json.message || "上传失败");
              }
              if (!json.data || !json.data.url) {
                throw new Error("上传失败");
              }
            } else if (json === false) {
              throw new Error("上传失败（文件类型或权限）");
            }
            if (!json) {
              throw new Error("上传失败");
            }
          }
          await fetchFiles();
        } catch (e) {
          filesError.value = e && e.message ? e.message : "上传失败";
        } finally {
          filesUploading.value = false;
        }
      }

      async function deleteFile(cid) {
        const id = Number(cid || 0);
        if (!id) return;
        if (!confirm("确认删除该文件吗？此操作不可恢复。")) return;

        filesError.value = "";
        try {
          await apiPost("files.delete", { cids: [id] });
          await fetchFiles();
        } catch (e) {
          filesError.value = e && e.message ? e.message : "删除失败";
        }
      }

      function openFile(url) {
        const u = String(url || "");
        if (!u) return;
        window.open(u, "_blank", "noreferrer");
      }

      async function copyText(text) {
        const t = String(text || "");
        if (!t) return;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(t);
            return true;
          }
        } catch (e) {}

        try {
          const ta = document.createElement("textarea");
          ta.value = t;
          ta.style.position = "fixed";
          ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          return true;
        } catch (e) {}

        prompt("复制链接：", t);
        return false;
      }

      async function ensureCategoriesLoaded() {
        if (categoriesAll.value && categoriesAll.value.length) return;
        try {
          const data = await apiGet("metas.categories");
          categoriesAll.value = data.items || [];
          defaultCategoryId.value = Number(data.defaultCategory || 0) || 0;
        } catch (e) {}
      }

      async function ensureTagsLoaded() {
        if (tagsAll.value && tagsAll.value.length) return;
        try {
          const data = await apiGet("metas.tags");
          tagsAll.value = data.items || [];
        } catch (e) {}
      }

      async function fetchTaxonomy() {
        taxonomyLoading.value = true;
        taxonomyError.value = "";
        try {
          const [catData, tagData] = await Promise.all([
            apiGet("metas.categories"),
            apiGet("metas.tags"),
          ]);
          categoriesAll.value = catData.items || [];
          defaultCategoryId.value = Number(catData.defaultCategory || 0) || 0;
          tagsAll.value = tagData.items || [];
        } catch (e) {
          taxonomyError.value = e && e.message ? e.message : "加载失败";
        } finally {
          taxonomyLoading.value = false;
        }
      }

      function openCategoryEditor(category) {
        const c = category && typeof category === "object" ? category : null;
        categoryForm.mid = c ? Number(c.mid || 0) : 0;
        categoryForm.name = c ? String(c.name || "") : "";
        categoryForm.slug = c ? String(c.slug || "") : "";
        categoryForm.parent = c ? Number(c.parent || 0) : 0;
        categoryForm.description = c ? String(c.description || "") : "";
        categoryNameError.value = "";
        categoryEditorOpen.value = true;
        nextTick(() => {
          if (categoryNameEl.value && typeof categoryNameEl.value.focus === "function") {
            categoryNameEl.value.focus();
          }
        });
      }

      function closeCategoryEditor() {
        categoryEditorOpen.value = false;
        categoryNameError.value = "";
      }

      async function saveCategory() {
        if (taxonomySaving.value) return;
        const name = String(categoryForm.name || "").trim();
        if (!name) {
          categoryNameError.value = "请输入分类名称";
          nextTick(() => {
            if (categoryNameEl.value && typeof categoryNameEl.value.focus === "function") {
              categoryNameEl.value.focus();
            }
          });
          return;
        }
        categoryNameError.value = "";
        taxonomySaving.value = true;
        taxonomyError.value = "";
        try {
          await apiPost("metas.category.save", {
            mid: categoryForm.mid || 0,
            name,
            slug: String(categoryForm.slug || "").trim(),
            parent: categoryForm.parent || 0,
            description: String(categoryForm.description || "").trim(),
          });
          await fetchTaxonomy();
          categoryEditorOpen.value = false;
        } catch (e) {
          taxonomyError.value = e && e.message ? e.message : "保存失败";
        } finally {
          taxonomySaving.value = false;
        }
      }

      async function deleteCategory(mid) {
        const id = Number(mid || 0);
        if (!id) return;
        if (!confirm("确认删除该分类吗？")) return;
        taxonomyError.value = "";
        try {
          await apiPost("metas.category.delete", { mids: [id] });
          await fetchTaxonomy();
        } catch (e) {
          taxonomyError.value = e && e.message ? e.message : "删除失败";
        }
      }

      async function setDefaultCategory(mid) {
        if (taxonomySaving.value) return;
        const id = Number(mid || 0);
        if (!id) return;
        const current = Number(defaultCategoryId.value || 0) || 0;
        if (id === current) return;

        taxonomySaving.value = true;
        taxonomyError.value = "";
        try {
          const data = await apiPost("metas.category.default", { mid: id });
          defaultCategoryId.value = Number(data?.defaultCategory || id) || id;
          toastSuccess("已设置默认分类");
        } catch (e) {
          taxonomyError.value = e && e.message ? e.message : "设置失败";
        } finally {
          taxonomySaving.value = false;
        }
      }

      function openTagEditor(tag) {
        const t = tag && typeof tag === "object" ? tag : null;
        tagForm.mid = t ? Number(t.mid || 0) : 0;
        tagForm.name = t ? String(t.name || "") : "";
        tagForm.slug = t ? String(t.slug || "") : "";
        tagNameError.value = "";
        tagEditorOpen.value = true;
        nextTick(() => {
          if (tagNameEl.value && typeof tagNameEl.value.focus === "function") {
            tagNameEl.value.focus();
          }
        });
      }

      function closeTagEditor() {
        tagEditorOpen.value = false;
        tagNameError.value = "";
      }

      async function saveTag() {
        if (taxonomySaving.value) return;
        const name = String(tagForm.name || "").trim();
        if (!name) {
          tagNameError.value = "请输入标签名称";
          nextTick(() => {
            if (tagNameEl.value && typeof tagNameEl.value.focus === "function") {
              tagNameEl.value.focus();
            }
          });
          return;
        }
        tagNameError.value = "";
        taxonomySaving.value = true;
        taxonomyError.value = "";
        try {
          await apiPost("metas.tag.save", {
            mid: tagForm.mid || 0,
            name,
            slug: String(tagForm.slug || "").trim(),
          });
          await fetchTaxonomy();
          tagEditorOpen.value = false;
        } catch (e) {
          taxonomyError.value = e && e.message ? e.message : "保存失败";
        } finally {
          taxonomySaving.value = false;
        }
      }

      async function deleteTag(mid) {
        const id = Number(mid || 0);
        if (!id) return;
        if (!confirm("确认删除该标签吗？")) return;
        taxonomyError.value = "";
        try {
          await apiPost("metas.tag.delete", { mids: [id] });
          await fetchTaxonomy();
        } catch (e) {
          taxonomyError.value = e && e.message ? e.message : "删除失败";
        }
      }

      // Comments
      function getCommentBadge(item) {
        const s = String(item?.status || "");
        if (s === "approved") return { text: "已通过", tone: "success" };
        if (s === "waiting") return { text: "待审核", tone: "warn" };
        if (s === "spam") return { text: "垃圾", tone: "danger" };
        if (s === "hold") return { text: "未通过", tone: "warn" };
        return { text: s || "—", tone: "" };
      }

      async function fetchComments() {
        commentsLoading.value = true;
        commentsError.value = "";
        try {
          const scopeAllAllowed =
            !!V3A.canPublish &&
            (!V3A.acl || !V3A.acl.comments || Number(V3A.acl.comments.scopeAll));
          let scope = commentsFilters.scope;
          if (String(scope || "mine") === "all" && !scopeAllAllowed) {
            scope = "mine";
            commentsFilters.scope = "mine";
          }

          const data = await apiGet("comments.list", {
            page: commentsPagination.page,
            pageSize: commentsPagination.pageSize,
            status: commentsFilters.status,
            keywords: commentsFilters.keywords,
            scope,
          });
          commentsItems.value = data.items || [];
          const p = data.pagination || {};
          commentsPagination.page = Number(p.page || commentsPagination.page) || 1;
          commentsPagination.pageSize =
            Number(p.pageSize || commentsPagination.pageSize) || 20;
          commentsPagination.total = Number(p.total || 0) || 0;
          commentsPagination.pageCount = Number(p.pageCount || 1) || 1;
        } catch (e) {
          commentsError.value = e && e.message ? e.message : "加载失败";
        } finally {
          commentsLoading.value = false;
        }
      }

      function applyCommentsFilters() {
        commentsPagination.page = 1;
        fetchComments();
      }

      function commentsGoPage(p) {
        const next = Math.max(1, Math.min(commentsPagination.pageCount || 1, p));
        if (next === commentsPagination.page) return;
        commentsPagination.page = next;
        fetchComments();
      }

      function quickSetCommentsStatus(status) {
        commentsFilters.status = status;
        applyCommentsFilters();
      }

      function resetCommentEditor() {
        commentForm.coid = 0;
        commentForm.cid = 0;
        commentForm.author = "";
        commentForm.mail = "";
        commentForm.avatar = "";
        commentForm.url = "";
        commentForm.created = 0;
        commentForm.text = "";
        commentForm.status = "";
        commentForm.ip = "";
        commentForm.agent = "";
        commentForm.parent = 0;
        commentReplyText.value = "";
        commentReplyEmojiOpen.value = false;
        commentEditorPost.value = null;
        commentEditorError.value = "";
      }

      async function openCommentEditor(coid) {
        const id = Number(coid || 0);
        if (!id) return;
        commentEditorOpen.value = true;
        commentEditorLoading.value = true;
        commentEditorError.value = "";
        resetCommentEditor();
        commentForm.coid = id;
        try {
          const data = await apiGet("comments.get", { coid: id });
          const c = data.comment || {};
          commentForm.coid = Number(c.coid || id) || id;
          commentForm.cid = Number(c.cid || 0) || 0;
          commentForm.author = String(c.author || "");
          commentForm.mail = String(c.mail || "");
          commentForm.avatar = String(c.avatar || "");
          commentForm.url = String(c.url || "");
          commentForm.created = Number(c.created || 0) || 0;
          commentForm.text = String(c.text || "");
          commentForm.status = String(c.status || "");
          commentForm.ip = String(c.ip || "");
          commentForm.agent = String(c.agent || "");
          commentForm.parent = Number(c.parent || 0) || 0;
          commentEditorPost.value = data.post || null;
        } catch (e) {
          commentEditorError.value = e && e.message ? e.message : "加载失败";
        } finally {
          commentEditorLoading.value = false;
        }
      }

      function closeCommentEditor() {
        commentEditorOpen.value = false;
        resetCommentEditor();
      }

      async function saveCommentEdit() {
        if (!commentForm.coid) return;
        commentEditorSaving.value = true;
        commentEditorError.value = "";
        try {
          await apiPost("comments.edit", {
            coid: commentForm.coid,
            author: commentForm.author,
            mail: commentForm.mail,
            url: commentForm.url,
            created: commentForm.created || 0,
            text: commentForm.text,
          });
          await fetchComments();
        } catch (e) {
          commentEditorError.value = e && e.message ? e.message : "保存失败";
        } finally {
          commentEditorSaving.value = false;
        }
      }

      async function submitCommentReply() {
        if (!commentForm.coid) return;
        const text = String(commentReplyText.value || "").trim();
        if (!text) return;
        commentEditorSaving.value = true;
        commentEditorError.value = "";
        try {
          await apiPost("comments.reply", { coid: commentForm.coid, text });
          commentReplyText.value = "";
          await fetchComments();
        } catch (e) {
          commentEditorError.value = e && e.message ? e.message : "回复失败";
        } finally {
          commentEditorSaving.value = false;
        }
      }

      async function markComment(coid, status) {
        const id = Number(coid || 0);
        if (!id) return;
        const st = String(status || "");
        commentsError.value = "";
        try {
          await apiPost("comments.mark", { coids: [id], status: st });
          if (commentEditorOpen.value && Number(commentForm.coid || 0) === id) {
            commentForm.status = st;
          }
          await fetchComments();
          await fetchDashboard();
        } catch (e) {
          commentsError.value = e && e.message ? e.message : "操作失败";
        }
      }

      async function deleteComment(coid) {
        const id = Number(coid || 0);
        if (!id) return;
        if (!confirm("确认删除该评论吗？此操作不可恢复。")) return;
        commentsError.value = "";
        try {
          await apiPost("comments.delete", { coids: [id] });
          if (commentEditorOpen.value && Number(commentForm.coid || 0) === id) {
            closeCommentEditor();
          }
          await fetchComments();
          await fetchDashboard();
        } catch (e) {
          commentsError.value = e && e.message ? e.message : "删除失败";
        }
      }

      // Pages
      function getPageBadge(item) {
        if (!item) return { text: "—", tone: "" };
        const type = String(item.type || "");
        const status = String(item.status || "");
        if (type === "page_draft") return { text: "草稿", tone: "warn" };
        if (status === "hidden") return { text: "隐藏", tone: "" };
        return { text: "已发布", tone: "success" };
      }

      async function fetchPages() {
        pagesLoading.value = true;
        pagesError.value = "";
        try {
          const data = await apiGet("pages.list", {
            keywords: pagesFilters.keywords,
            status: pagesFilters.status,
          });
          pagesItems.value = data.items || [];
        } catch (e) {
          pagesError.value = e && e.message ? e.message : "加载失败";
        } finally {
          pagesLoading.value = false;
        }
      }

      function applyPagesFilters() {
        fetchPages();
      }

      function openPageEditor(cid) {
        const id = Number(cid || 0);
        if (!id) {
          navTo("/pages/edit");
          return;
        }
        navTo(`/pages/edit?cid=${encodeURIComponent(String(id))}`);
      }

      function resetPageForm(parentId) {
        pageForm.cid = 0;
        pageForm.title = "";
        pageForm.slug = "";
        pageForm.text = "";
        pageForm.visibility = "publish";
        pageForm.template = "";
        pageForm.order = 0;
        pageForm.parent = Number(parentId || 0) || 0;
        pageForm.allowComment = true;
        pageForm.allowPing = true;
        pageForm.allowFeed = true;
        pageForm.markdown = !!V3A.markdownEnabled;
        pageForm.fields.splice(0, pageForm.fields.length);
        pageError.value = "";
        pageMessage.value = "";
      }

      function addPageField() {
        pageForm.fields.push({ name: "", type: "str", value: "" });
      }

      function removePageField(index) {
        const i = Number(index || 0);
        if (i < 0 || i >= pageForm.fields.length) return;
        pageForm.fields.splice(i, 1);
      }

      // Custom field editor: JSON (CodeMirror 6 modal)
      const jsonFieldEditorOpen = ref(false);
      const jsonFieldEditorKind = ref(""); // post|page
      const jsonFieldEditorIndex = ref(-1);
      const jsonFieldEditorValueType = ref(""); // str|int|float|json
      const jsonFieldEditorDraft = ref("");
      const jsonFieldEditorError = ref("");
      const jsonFieldEditorEl = ref(null);
      let jsonFieldEditorView = null;
      let jsonFieldEditorApplying = false;

      function getJsonFieldEditorTarget() {
        const kind = String(jsonFieldEditorKind.value || "");
        const idx = Number(jsonFieldEditorIndex.value || 0);
        const list = kind === "page" ? pageForm.fields : postForm.fields;
        if (!Array.isArray(list) || idx < 0 || idx >= list.length) return null;
        const f = list[idx];
        if (!f || typeof f !== "object") return null;
        return f;
      }

      function destroyJsonFieldEditor() {
        try {
          if (jsonFieldEditorView) jsonFieldEditorView.destroy();
        } catch (e) {}
        jsonFieldEditorView = null;
      }

      async function initJsonFieldEditor() {
        if (jsonFieldEditorView) return;
        const el = jsonFieldEditorEl.value;
        if (!el) return;
        try {
          const cm = await ensureCodeMirror6();
          const { EditorView, EditorState } = cm;

          const updateListener = EditorView.updateListener.of((update) => {
            if (!update || !update.docChanged) return;
            if (jsonFieldEditorApplying) return;
            jsonFieldEditorApplying = true;
            try {
              jsonFieldEditorDraft.value = update.state.doc.toString();
              jsonFieldEditorError.value = "";
            } finally {
              jsonFieldEditorApplying = false;
            }
          });

          const editorTheme = EditorView.theme({
            "&": { height: "100%" },
            ".cm-scroller": { overflow: "auto" },
          });

          const valueType = String(jsonFieldEditorValueType.value || "");
          const langExt = valueType === "json" ? cm.json() : null;

          const state = EditorState.create({
            doc: String(jsonFieldEditorDraft.value ?? ""),
            extensions: [
              cm.basicSetup,
              EditorView.lineWrapping,
              cm.syntaxHighlighting(cm.defaultHighlightStyle, { fallback: true }),
              ...(langExt ? [langExt] : []),
              cm.keymap.of([
                {
                  key: "Mod-s",
                  preventDefault: true,
                  run: () => {
                    applyJsonFieldEditor();
                    return true;
                  },
                },
              ]),
              updateListener,
              editorTheme,
            ],
          });

          jsonFieldEditorView = new EditorView({
            state,
            parent: el,
          });
        } catch (e) {
          console.error(e);
          destroyJsonFieldEditor();
        }
      }

      function updateJsonFieldEditorContent() {
        const view = jsonFieldEditorView;
        if (!view) return;
        if (jsonFieldEditorApplying) return;

        const next = String(jsonFieldEditorDraft.value ?? "");
        const current = view.state.doc.toString();
        if (next === current) return;

        jsonFieldEditorApplying = true;
        try {
          view.dispatch({
            changes: { from: 0, to: current.length, insert: next },
          });
        } finally {
          jsonFieldEditorApplying = false;
        }
      }

      async function openJsonFieldEditor(kind, index) {
        const k = kind === "page" ? "page" : "post";
        const idx = Number(index || 0);
        const list = k === "page" ? pageForm.fields : postForm.fields;
        if (!Array.isArray(list) || idx < 0 || idx >= list.length) return;
        const f = list[idx];
        if (!f || typeof f !== "object") return;

        jsonFieldEditorKind.value = k;
        jsonFieldEditorIndex.value = idx;
        jsonFieldEditorValueType.value = String(f.type || "str");
        jsonFieldEditorDraft.value = String(f.value ?? "");
        jsonFieldEditorError.value = "";
        jsonFieldEditorOpen.value = true;

        await nextTick();
        await initJsonFieldEditor();
        updateJsonFieldEditorContent();
        try {
          if (jsonFieldEditorView) jsonFieldEditorView.focus();
        } catch (e) {}
      }

      function closeJsonFieldEditor() {
        jsonFieldEditorOpen.value = false;
        jsonFieldEditorKind.value = "";
        jsonFieldEditorIndex.value = -1;
        jsonFieldEditorValueType.value = "";
        jsonFieldEditorDraft.value = "";
        jsonFieldEditorError.value = "";
        destroyJsonFieldEditor();
      }

      function applyJsonFieldEditor() {
        const target = getJsonFieldEditorTarget();
        if (!target) {
          closeJsonFieldEditor();
          return;
        }

        const raw = String(jsonFieldEditorDraft.value ?? "");
        const s = raw.trim();

        if (String(target.type || "") === "json") {
          if (s && (s.startsWith("{") || s.startsWith("["))) {
            try {
              JSON.parse(s);
            } catch (e) {
              jsonFieldEditorError.value = "JSON 格式错误，请检查后再保存。";
              return;
            }
          }
        }

        target.value = raw;
        closeJsonFieldEditor();
      }

      async function loadPageEditorFromRoute() {
        pageLoading.value = true;
        pageError.value = "";
        pageMessage.value = "";
        try {
          const cidRaw = routeQuery.value && routeQuery.value.cid;
          const parentRaw = routeQuery.value && routeQuery.value.parent;
          const cid = Number(cidRaw || 0);
          const parent = Number(parentRaw || 0);

          pageDefaultFields.value = [];
          const data = await apiGet("pages.get", {
            cid: cid ? cid : "",
            parent: parent ? parent : "",
          });

          pageTemplates.value = data.templates || [];
          pageParentOptions.value = data.parentOptions || [];
          pageDefaultFields.value = Array.isArray(data.defaultFields) ? data.defaultFields : [];
          const p = data.page || {};
          const cap = data.capabilities || {};
          pageCapabilities.value = {
            markdownEnabled: !!cap.markdownEnabled,
            canPublish: !!cap.canPublish,
          };

          if (!cid) {
            resetPageForm(parent);
            if (!pageCapabilities.value.markdownEnabled) {
              pageForm.markdown = false;
            }
            return;
          }

          pageForm.cid = Number(p.cid || cid) || cid || 0;
          pageForm.title = String(p.title || "");
          pageForm.slug = String(p.slug ?? "");
          if (!String(pageForm.slug || "").trim() && Number(pageForm.cid || 0) > 0) {
            pageForm.slug = String(pageForm.cid);
          }
          pageForm.text = String(p.text || "");
          pageForm.visibility = String(p.visibility || p.status || "publish");
          if (pageForm.visibility !== "hidden") pageForm.visibility = "publish";
          pageForm.template = String(p.template || "");
          pageForm.order = Number(p.order || 0) || 0;
          pageForm.parent = Number(p.parent || 0) || 0;
          if (!cid && parent > 0) {
            pageForm.parent = parent;
          }
          pageForm.allowComment = !!Number(p.allowComment || 0);
          pageForm.allowPing = !!Number(p.allowPing || 0);
          pageForm.allowFeed = !!Number(p.allowFeed || 0);
          pageForm.markdown = cid ? !!p.isMarkdown : !!V3A.markdownEnabled;

          pageForm.fields.splice(0, pageForm.fields.length);
          const fs = Array.isArray(p.fields) ? p.fields : [];
          for (const row of fs) {
            if (!row || typeof row !== "object") continue;
            pageForm.fields.push({
              name: String(row.name || ""),
              type: String(row.type || "str"),
              value:
                row.type === "json" && typeof row.value === "object"
                  ? JSON.stringify(row.value)
                  : row.value ?? "",
            });
          }
        } catch (e) {
          pageError.value = e && e.message ? e.message : "加载失败";
        } finally {
          pageLoading.value = false;
        }
      }

      async function submitPage(mode) {
        const m = mode === "publish" ? "publish" : "save";
        if (pageSaving.value) return;
        pageSaving.value = true;
        pageError.value = "";
        pageMessage.value = "";
        try {
          syncPageTextFromEditor();

          const slugWasEmpty = !String(pageForm.slug || "").trim();
          if (slugWasEmpty && Number(pageForm.cid || 0) > 0) {
            pageForm.slug = String(pageForm.cid);
          }

          const pageFieldsMap = new Map();
          const pageDefaults = Array.isArray(pageDefaultFields.value) ? pageDefaultFields.value : [];
          for (const f of pageDefaults) {
            if (!f || typeof f !== "object") continue;
            const name = String(f.name || "");
            if (!name) continue;
            const v = f.value;
            const isObj = v !== null && typeof v === "object";
            pageFieldsMap.set(name, {
              name,
              type: isObj ? "json" : "str",
              value: isObj ? v : String(v ?? ""),
            });
          }
          for (const f of pageForm.fields || []) {
            if (!f || typeof f !== "object") continue;
            const name = String(f.name || "").trim();
            if (!name) continue;
            const type = String(f.type || "str");
            pageFieldsMap.set(name, {
              name,
              type,
              value: type === "json" ? safeJsonParse(f.value) : f.value,
            });
          }

          const payload = {
            cid: pageForm.cid || 0,
            title: pageForm.title,
            slug: pageForm.slug,
            text: pageForm.text,
            template: pageForm.template,
            order: Number(pageForm.order || 0),
            parent: Number(pageForm.parent || 0),
            visibility: pageForm.visibility,
            allowComment: pageForm.allowComment ? 1 : 0,
            allowPing: pageForm.allowPing ? 1 : 0,
            allowFeed: pageForm.allowFeed ? 1 : 0,
            markdown: pageForm.markdown ? 1 : 0,
            fields: Array.from(pageFieldsMap.values()),
          };
          const data = await apiPost(m === "publish" ? "pages.publish" : "pages.save", payload);
          const newCid = Number(data?.cid || pageForm.cid || 0) || 0;
          pageForm.cid = newCid;
          if (slugWasEmpty && newCid > 0) {
            const nextSlug = Object.prototype.hasOwnProperty.call(data || {}, "slug")
              ? String(data.slug ?? "").trim()
              : "";
            pageForm.slug = nextSlug ? nextSlug : String(newCid);
          }
          pageMessage.value = m === "publish" ? "页面已发布" : "草稿已保存";

          if (newCid && Number(routeQuery.value?.cid || 0) !== newCid) {
            skipNextPageLoad = true;
            navTo(`/pages/edit?cid=${encodeURIComponent(String(newCid))}`);
          }

          await fetchPages();
          await fetchDashboard();
        } catch (e) {
          pageError.value = e && e.message ? e.message : "提交失败";
        } finally {
          pageSaving.value = false;
        }
      }

      async function deletePage(cid) {
        const id = Number(cid || 0);
        if (!id) return;
        if (!confirm("确认删除该页面吗？此操作不可恢复。")) return;

         pagesError.value = "";
         try {
           await apiPost("pages.delete", { cids: [id] });
           if (routePath.value === "/pages/edit") {
             const currentCid = Number(routeQuery.value?.cid || 0);
             if (currentCid === id) {
               navTo("/pages/manage");
             }
           }
           if (routePath.value === "/drafts") {
             await fetchDrafts();
           } else {
             await fetchPages();
             await fetchDashboard();
           }
         } catch (e) {
           pagesError.value = e && e.message ? e.message : "删除失败";
         }
       }

      // Settings
      function parseAttachmentTypesValue(raw) {
        const s = String(raw || "");
        const parts = s
          .split(",")
          .map((x) => String(x).trim())
          .filter(Boolean);
        const selected = [];
        const other = [];
        for (const p of parts) {
          if (p === "@image@" || p === "@media@" || p === "@doc@") {
            if (!selected.includes(p)) selected.push(p);
          } else if (p.startsWith("@")) {
            // ignore unknown markers
          } else {
            other.push(p);
          }
        }
        if (other.length && !selected.includes("@other@")) selected.push("@other@");
        return { selected, other: other.join(",") };
      }

      function escapeHtml(value) {
        return String(value ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      function renderMailTemplate(template, vars) {
        let html = String(template || "");
        for (const [key, value] of Object.entries(vars || {})) {
          html = html.split(`{{${key}}}`).join(String(value ?? ""));
        }
        return html;
      }

      async function fetchSettings() {
        settingsLoading.value = true;
        settingsError.value = "";
        settingsMessage.value = "";
        settingsPermalinkRewriteError.value = "";
        settingsPermalinkEnableRewriteAnyway.value = 0;
        try {
          const data = await apiGet("settings.get");
          settingsData.isAdmin = !!data.isAdmin;
          Object.assign(settingsData.profile, data.profile || {});
          Object.assign(settingsData.userOptions, data.userOptions || {});
          userOptionsLoaded.value = true;
          Object.assign(settingsData.site, data.site || {});
          Object.assign(settingsData.storage, data.storage || {});
          Object.assign(settingsData.reading, data.reading || {});
          settingsData.discussion = Object.assign({}, data.discussion || {});
          settingsData.notify = Object.assign({}, data.notify || {});
          settingsData.ai = Object.assign({}, data.ai || {});
          settingsData.permalink = Object.assign({}, data.permalink || {});
          settingsData.lists = Object.assign(
            {
              langs: [],
              frontPagePages: [],
              frontPageFiles: [],
              timezones: SETTINGS_TIMEZONES,
            },
            data.lists || {}
          );

          settingsProfileForm.screenName = String(
            settingsData.profile.screenName || ""
          );
          settingsProfileForm.mail = String(settingsData.profile.mail || "");
          settingsProfileForm.url = String(settingsData.profile.url || "");

          settingsUserOptionsForm.markdown = Number(
            settingsData.userOptions.markdown || 0
          );
          settingsUserOptionsForm.xmlrpcMarkdown = Number(
            settingsData.userOptions.xmlrpcMarkdown || 0
          );
          settingsUserOptionsForm.autoSave = Number(
            settingsData.userOptions.autoSave || 0
          );
          const allow = [];
          if (Number(settingsData.userOptions.defaultAllowComment || 0))
            allow.push("comment");
          if (Number(settingsData.userOptions.defaultAllowPing || 0))
            allow.push("ping");
          if (Number(settingsData.userOptions.defaultAllowFeed || 0))
            allow.push("feed");
          settingsUserOptionsForm.defaultAllow = allow;

          settingsSiteForm.siteUrl = String(settingsData.site.siteUrl || "");
          settingsSiteForm.title = String(settingsData.site.title || "");
          settingsSiteForm.description = String(settingsData.site.description || "");
          settingsSiteForm.keywords = String(settingsData.site.keywords || "");
          settingsSiteForm.loginStyle = String(settingsData.site.loginStyle || "");
          settingsSiteForm.loginBackground = String(settingsData.site.loginBackground || "");
          settingsSiteForm.allowRegister = Number(
            settingsData.site.allowRegister || 0
          );
          settingsSiteForm.defaultRegisterGroup = String(
            settingsData.site.defaultRegisterGroup || "subscriber"
          );
          settingsSiteForm.allowXmlRpc = Number(settingsData.site.allowXmlRpc || 0);
          settingsSiteForm.lang = String(settingsData.site.lang || "zh_CN");
          settingsSiteForm.timezone = Number(settingsData.site.timezone ?? 28800);

          const at = parseAttachmentTypesValue(
            settingsData.storage.attachmentTypes || ""
          );
          settingsStorageForm.attachmentTypes = at.selected;
          settingsStorageForm.attachmentTypesOther = at.other;

          settingsReadingForm.postDateFormat = String(
            settingsData.reading.postDateFormat || ""
          );
          settingsReadingForm.frontPageType = String(
            settingsData.reading.frontPageType || "recent"
          );
          settingsReadingForm.frontPagePage =
            settingsReadingForm.frontPageType === "page"
              ? Number(settingsData.reading.frontPageValue || 0)
              : 0;
          settingsReadingForm.frontPageFile =
            settingsReadingForm.frontPageType === "file"
              ? String(settingsData.reading.frontPageValue || "")
              : "";
          settingsReadingForm.frontArchive = Number(
            settingsData.reading.frontArchive || 0
          );
          settingsReadingForm.archivePattern = String(
            settingsData.reading.archivePattern || ""
          );
          settingsReadingForm.pageSize = Number(settingsData.reading.pageSize || 10);
          settingsReadingForm.postsListSize = Number(
            settingsData.reading.postsListSize || 10
          );
          settingsReadingForm.feedFullText = Number(
            settingsData.reading.feedFullText || 0
          );

          Object.assign(settingsDiscussionForm, settingsData.discussion || {});

          settingsNotifyForm.mailEnabled = Number(
            settingsData.notify.mailEnabled || 0
          );
          settingsNotifyForm.commentNotifyEnabled = Number(
            settingsData.notify.commentNotifyEnabled || 0
          );
          settingsNotifyForm.commentWaitingNotifyEnabled = Number(
            settingsData.notify.commentWaitingNotifyEnabled ??
              settingsData.notify.commentNotifyEnabled ??
              0
          );
          settingsNotifyForm.commentReplyNotifyEnabled = Number(
            settingsData.notify.commentReplyNotifyEnabled || 0
          );
          settingsNotifyForm.friendLinkNotifyEnabled = Number(
            settingsData.notify.friendLinkNotifyEnabled || 0
          );
          settingsNotifyForm.friendLinkAuditNotifyEnabled = Number(
            settingsData.notify.friendLinkAuditNotifyEnabled || 0
          );
          settingsNotifyForm.templateStyle = String(
            settingsData.notify.templateStyle || "v3a"
          );
          settingsNotifyForm.adminTo = String(settingsData.notify.adminTo || "");
          settingsNotifyForm.smtpFrom = String(settingsData.notify.smtpFrom || "");
          settingsNotifyForm.smtpHost = String(settingsData.notify.smtpHost || "");
          settingsNotifyForm.smtpPort = Number(settingsData.notify.smtpPort || 465);
          settingsNotifyForm.smtpUser = String(settingsData.notify.smtpUser || "");
          settingsNotifyForm.smtpPass = String(settingsData.notify.smtpPass || "");
          settingsNotifyForm.smtpSecure =
            Number(settingsData.notify.smtpSecure ?? 1) ? 1 : 0;
          settingsNotifyForm.commentTemplate = String(
            settingsData.notify.commentTemplate || DEFAULT_NOTIFY_COMMENT_TEMPLATE
          );
          settingsNotifyForm.commentWaitingTemplate = String(
            settingsData.notify.commentWaitingTemplate ||
              DEFAULT_NOTIFY_COMMENT_WAITING_TEMPLATE
          );
          settingsNotifyForm.commentReplyTemplate = String(
            settingsData.notify.commentReplyTemplate ||
              DEFAULT_NOTIFY_COMMENT_REPLY_TEMPLATE
          );
          settingsNotifyForm.friendLinkTemplate = String(
            settingsData.notify.friendLinkTemplate || DEFAULT_NOTIFY_FRIENDLINK_TEMPLATE
          );
          settingsNotifyForm.friendLinkAuditPassTemplate = String(
            settingsData.notify.friendLinkAuditPassTemplate ||
              DEFAULT_NOTIFY_FRIENDLINK_AUDIT_PASS_TEMPLATE
          );
          settingsNotifyForm.friendLinkAuditRejectTemplate = String(
            settingsData.notify.friendLinkAuditRejectTemplate ||
              DEFAULT_NOTIFY_FRIENDLINK_AUDIT_REJECT_TEMPLATE
          );

          settingsAiForm.enabled = Number(settingsData.ai.enabled || 0);
          settingsAiForm.baseUrl = String(settingsData.ai.baseUrl || "");
          settingsAiForm.model = String(settingsData.ai.model || "");
          settingsAiForm.temperature = Number(settingsData.ai.temperature ?? 0.2);
          settingsAiForm.timeout = Number(settingsData.ai.timeout || 60);
          settingsAiForm.languages = Array.isArray(settingsData.ai.languages)
            ? settingsData.ai.languages.join(",")
            : String(settingsData.ai.languages || "");
          settingsAiForm.apiKey = "";
          const aiFeatures = settingsData.ai.features || {};
          settingsAiForm.translateEnabled = Number(aiFeatures.translate || 0);
          settingsAiForm.summaryEnabled = Number(aiFeatures.summary || 0);
          settingsAiForm.commentEnabled = Number(aiFeatures.comment || 0);
          settingsAiForm.polishEnabled = Number(aiFeatures.polish || 0);
          settingsAiForm.slugEnabled = Number(aiFeatures.slug || 0);

          settingsPermalinkForm.rewrite = Number(settingsData.permalink.rewrite || 0);
          const postUrlRaw = String(settingsData.permalink.postUrl || "");
          const postUrl = postUrlRaw
            ? postUrlRaw.startsWith("/")
              ? postUrlRaw
              : "/" + postUrlRaw
            : "";
          const knownPostPattern = permalinkPostPatternOptions.some(
            (o) => o.value !== "custom" && o.value === postUrl
          );
          settingsPermalinkForm.postPattern = knownPostPattern ? postUrl : "custom";
          settingsPermalinkForm.customPattern = String(
            settingsData.permalink.customPattern || ""
          );
          settingsPermalinkForm.pagePattern = String(
            settingsData.permalink.pagePattern || ""
          );
          settingsPermalinkForm.categoryPattern = String(
            settingsData.permalink.categoryPattern || ""
          );

          if (postUrl) {
            permalinkPostUrl.value = postUrl;
          }
        } catch (e) {
          settingsError.value = e && e.message ? e.message : "加载失败";
        } finally {
          settingsLoading.value = false;
        }
      }

      function v3aApplyAclConfig(config) {
        const normalized = v3aAclNormalizeConfig(config);
        settingsAclForm.version = normalized.version;
        settingsAclForm.groups = normalized.groups;
        settingsAclOriginal.value = JSON.stringify(normalized);
        settingsAclLoaded.value = true;

        const current = String(settingsAclGroup.value || "contributor");
        if (!settingsAclForm.groups || !settingsAclForm.groups[current]) {
          settingsAclGroup.value = "contributor";
        }
      }

      async function fetchSettingsAcl() {
        if (!settingsData.isAdmin) return;
        if (settingsAclLoading.value) return;

        settingsAclLoading.value = true;
        settingsError.value = "";
        settingsMessage.value = "";
        try {
          const data = await apiGet("acl.get");
          v3aApplyAclConfig(data && data.config ? data.config : data);
        } catch (e) {
          settingsError.value = e && e.message ? e.message : "加载失败";
        } finally {
          settingsAclLoading.value = false;
        }
      }

      async function saveSettingsProfile() {
        settingsSaving.value = true;
        settingsError.value = "";
        settingsMessage.value = "";
        try {
          const data = await apiPost(
            "settings.user.profile.save",
            Object.assign({}, settingsProfileForm)
          );
          if (data && data.profile) {
            Object.assign(settingsData.profile, data.profile);
            settingsProfileForm.screenName = String(settingsData.profile.screenName || "");
            settingsProfileForm.mail = String(settingsData.profile.mail || "");
            settingsProfileForm.url = String(settingsData.profile.url || "");
          }
          settingsPermalinkRewriteError.value = "";
          settingsPermalinkEnableRewriteAnyway.value = 0;
          if (!settingsBatchSaving.value) settingsMessage.value = "已保存";
        } catch (e) {
          const apiData = e && e.apiData ? e.apiData : null;
          if (apiData && apiData.rewriteCheck && apiData.rewriteCheck.ok === false) {
            settingsPermalinkRewriteError.value = String(
              apiData.rewriteCheck.message || e.message || ""
            );
            return;
          }
          settingsError.value = e && e.message ? e.message : "保存失败";
        } finally {
          settingsSaving.value = false;
        }
      }

      async function saveSettingsUserOptions() {
        settingsSaving.value = true;
        settingsError.value = "";
        settingsMessage.value = "";
        try {
          const payload = {
            markdown: settingsUserOptionsForm.markdown ? 1 : 0,
            xmlrpcMarkdown: settingsUserOptionsForm.xmlrpcMarkdown ? 1 : 0,
            autoSave: settingsUserOptionsForm.autoSave ? 1 : 0,
            defaultAllow: settingsUserOptionsForm.defaultAllow || [],
          };
          const data = await apiPost("settings.user.options.save", payload);
          if (data && data.userOptions) {
            Object.assign(settingsData.userOptions, data.userOptions);
            settingsUserOptionsForm.markdown = Number(settingsData.userOptions.markdown || 0);
            settingsUserOptionsForm.xmlrpcMarkdown = Number(
              settingsData.userOptions.xmlrpcMarkdown || 0
            );
            settingsUserOptionsForm.autoSave = Number(settingsData.userOptions.autoSave || 0);
            settingsUserOptionsForm.defaultAllow = v3aUserOptionsAllowFromData(
              settingsData.userOptions
            );
            V3A.markdownEnabled = !!Number(settingsData.userOptions.markdown || 0);
          }
          if (!settingsBatchSaving.value) settingsMessage.value = "已保存";
        } catch (e) {
          settingsError.value = e && e.message ? e.message : "保存失败";
        } finally {
          settingsSaving.value = false;
        }
      }

      async function saveSettingsPassword() {
        settingsSaving.value = true;
        settingsError.value = "";
        settingsMessage.value = "";
        try {
          await apiPost("settings.user.password.save", {
            password: settingsPasswordForm.password,
            confirm: settingsPasswordForm.confirm,
          });
          settingsPasswordForm.password = "";
          settingsPasswordForm.confirm = "";
          settingsMessage.value = "密码已更新";
        } catch (e) {
          settingsError.value = e && e.message ? e.message : "保存失败";
        } finally {
          settingsSaving.value = false;
        }
      }

      async function saveSettingsSite() {
        settingsSaving.value = true;
        settingsError.value = "";
        settingsMessage.value = "";
        try {
          const payload = Object.assign({}, settingsSiteForm);
          const data = await apiPost("settings.site.save", payload);
          if (data && data.site) {
            Object.assign(settingsData.site, data.site);
            settingsSiteForm.siteUrl = String(settingsData.site.siteUrl || "");
            settingsSiteForm.title = String(settingsData.site.title || "");
            settingsSiteForm.description = String(settingsData.site.description || "");
            settingsSiteForm.keywords = String(settingsData.site.keywords || "");
            settingsSiteForm.loginStyle = String(settingsData.site.loginStyle || "");
            settingsSiteForm.loginBackground = String(settingsData.site.loginBackground || "");
            settingsSiteForm.allowRegister = Number(settingsData.site.allowRegister || 0);
            settingsSiteForm.defaultRegisterGroup = String(
              settingsData.site.defaultRegisterGroup || "subscriber"
            );
            settingsSiteForm.allowXmlRpc = Number(settingsData.site.allowXmlRpc || 0);
            settingsSiteForm.lang = String(settingsData.site.lang || "zh_CN");
            settingsSiteForm.timezone = Number(settingsData.site.timezone ?? 28800);
          }
          if (!settingsBatchSaving.value) settingsMessage.value = "已保存";
        } catch (e) {
          settingsError.value = e && e.message ? e.message : "保存失败";
        } finally {
          settingsSaving.value = false;
        }
      }

      async function saveSettingsStorage() {
        settingsSaving.value = true;
        settingsError.value = "";
        settingsMessage.value = "";
        try {
          const payload = {
            attachmentTypes: settingsStorageForm.attachmentTypes || [],
            attachmentTypesOther: settingsStorageForm.attachmentTypesOther || "",
          };
          const data = await apiPost("settings.storage.save", payload);
          if (data && data.storage) {
            Object.assign(settingsData.storage, data.storage);
            const at = parseAttachmentTypesValue(
              settingsData.storage.attachmentTypes || ""
            );
            settingsStorageForm.attachmentTypes = at.selected;
            settingsStorageForm.attachmentTypesOther = at.other;
          }
          if (!settingsBatchSaving.value) settingsMessage.value = "已保存";
        } catch (e) {
          settingsError.value = e && e.message ? e.message : "保存失败";
        } finally {
          settingsSaving.value = false;
        }
      }

      async function saveSettingsReading() {
        settingsSaving.value = true;
        settingsError.value = "";
        settingsMessage.value = "";
        try {
          const payload = Object.assign({}, settingsReadingForm);
          const data = await apiPost("settings.content.save", payload);
          if (data && data.reading) {
            Object.assign(settingsData.reading, data.reading);

            const frontPage = String(settingsData.reading.frontPage || "recent");
            let frontPageType = "recent";
            let frontPageValue = "";
            if (frontPage.includes(":")) {
              const parts = frontPage.split(":", 2);
              frontPageType = String(parts[0] || "recent");
              frontPageValue = String(parts[1] || "");
            } else if (frontPage) {
              frontPageType = frontPage;
            }
            if (
              frontPageType !== "recent" &&
              frontPageType !== "page" &&
              frontPageType !== "file"
            ) {
              frontPageType = "recent";
              frontPageValue = "";
            }
            settingsData.reading.frontPageType = frontPageType;
            settingsData.reading.frontPageValue = frontPageValue;

            settingsReadingForm.postDateFormat = String(
              settingsData.reading.postDateFormat || ""
            );
            settingsReadingForm.frontPageType = frontPageType;
            settingsReadingForm.frontPagePage =
              frontPageType === "page" ? Number(frontPageValue || 0) : 0;
            settingsReadingForm.frontPageFile =
              frontPageType === "file" ? String(frontPageValue || "") : "";
            settingsReadingForm.frontArchive = Number(
              settingsData.reading.frontArchive || 0
            );
            settingsReadingForm.pageSize = Number(settingsData.reading.pageSize || 10);
            settingsReadingForm.postsListSize = Number(
              settingsData.reading.postsListSize || 10
            );
            settingsReadingForm.feedFullText = Number(
              settingsData.reading.feedFullText || 0
            );
            if (
              settingsReadingForm.frontArchive &&
              settingsReadingForm.frontPageType !== "recent"
            ) {
              const archivePattern = String(settingsReadingForm.archivePattern || "").trim();
              settingsData.reading.archivePattern = archivePattern;
              settingsReadingForm.archivePattern = archivePattern;
            } else {
              settingsReadingForm.frontArchive = 0;
            }
          }
          if (!settingsBatchSaving.value) settingsMessage.value = "已保存";
        } catch (e) {
          settingsError.value = e && e.message ? e.message : "保存失败";
        } finally {
          settingsSaving.value = false;
        }
      }

      async function saveSettingsDiscussion() {
        settingsSaving.value = true;
        settingsError.value = "";
        settingsMessage.value = "";
        try {
          const payload = Object.assign({}, settingsDiscussionForm);
          if (!Number(payload.commentsShowUrl || 0)) payload.commentsUrlNofollow = 0;
          if (!Number(payload.commentsAutoClose || 0)) payload.commentsPostTimeoutDays = 0;
          if (!Number(payload.commentsPostIntervalEnable || 0))
            payload.commentsPostIntervalMins = 0;
          const data = await apiPost("settings.discussion.save", payload);
          if (data && data.discussion) {
            const d = Object.assign({}, data.discussion);
            const timeoutSeconds = Number(d.commentsPostTimeout || 0) || 0;
            const intervalSeconds = Number(d.commentsPostInterval || 0) || 0;
            const next = Object.assign({}, settingsData.discussion || {}, d, {
              commentsPostTimeoutDays: Math.max(
                0,
                Math.floor(timeoutSeconds / (24 * 3600))
              ),
              commentsPostIntervalMins: Math.max(
                0,
                Math.round((intervalSeconds / 60) * 10) / 10
              ),
            });
            settingsData.discussion = next;
            Object.assign(settingsDiscussionForm, settingsData.discussion || {});
          }
          if (!settingsBatchSaving.value) settingsMessage.value = "已保存";
        } catch (e) {
          settingsError.value = e && e.message ? e.message : "保存失败";
        } finally {
          settingsSaving.value = false;
        }
      }

      async function saveSettingsNotify() {
        settingsSaving.value = true;
        settingsError.value = "";
        settingsMessage.value = "";
        try {
          const payload = Object.assign({}, settingsNotifyForm);
          const data = await apiPost("settings.notify.save", payload);
          if (data && data.notify) {
            settingsData.notify = Object.assign({}, settingsData.notify || {}, data.notify);
            settingsNotifyForm.mailEnabled = Number(data.notify.mailEnabled || 0);
            settingsNotifyForm.commentNotifyEnabled = Number(
              data.notify.commentNotifyEnabled || 0
            );
            settingsNotifyForm.commentWaitingNotifyEnabled = Number(
              data.notify.commentWaitingNotifyEnabled ?? data.notify.commentNotifyEnabled ?? 0
            );
            settingsNotifyForm.commentReplyNotifyEnabled = Number(
              data.notify.commentReplyNotifyEnabled || 0
            );
            settingsNotifyForm.friendLinkNotifyEnabled = Number(
              data.notify.friendLinkNotifyEnabled || 0
            );
            settingsNotifyForm.friendLinkAuditNotifyEnabled = Number(
              data.notify.friendLinkAuditNotifyEnabled || 0
            );
            settingsNotifyForm.templateStyle = String(
              data.notify.templateStyle || "v3a"
            );
            settingsNotifyForm.adminTo = String(data.notify.adminTo || "");
            settingsNotifyForm.smtpFrom = String(data.notify.smtpFrom || "");
            settingsNotifyForm.smtpHost = String(data.notify.smtpHost || "");
            settingsNotifyForm.smtpPort = Number(data.notify.smtpPort || 465);
            settingsNotifyForm.smtpUser = String(data.notify.smtpUser || "");
            settingsNotifyForm.smtpPass = "";
            settingsNotifyForm.smtpSecure =
              Number(data.notify.smtpSecure ?? 1) ? 1 : 0;
            settingsNotifyForm.commentTemplate = String(
              data.notify.commentTemplate || DEFAULT_NOTIFY_COMMENT_TEMPLATE
            );
            settingsNotifyForm.commentWaitingTemplate = String(
              data.notify.commentWaitingTemplate ||
                DEFAULT_NOTIFY_COMMENT_WAITING_TEMPLATE
            );
            settingsNotifyForm.commentReplyTemplate = String(
              data.notify.commentReplyTemplate || DEFAULT_NOTIFY_COMMENT_REPLY_TEMPLATE
            );
            settingsNotifyForm.friendLinkTemplate = String(
              data.notify.friendLinkTemplate || DEFAULT_NOTIFY_FRIENDLINK_TEMPLATE
            );
            settingsNotifyForm.friendLinkAuditPassTemplate = String(
              data.notify.friendLinkAuditPassTemplate ||
                DEFAULT_NOTIFY_FRIENDLINK_AUDIT_PASS_TEMPLATE
            );
            settingsNotifyForm.friendLinkAuditRejectTemplate = String(
              data.notify.friendLinkAuditRejectTemplate ||
                DEFAULT_NOTIFY_FRIENDLINK_AUDIT_REJECT_TEMPLATE
            );
          } else {
            settingsNotifyForm.smtpPass = "";
          }
          if (!settingsBatchSaving.value) settingsMessage.value = "已保存";
        } catch (e) {
          settingsError.value = e && e.message ? e.message : "保存失败";
        } finally {
          settingsSaving.value = false;
        }
      }

      async function saveSettingsAi() {
        settingsSaving.value = true;
        settingsError.value = "";
        settingsMessage.value = "";
        try {
          const payload = {
            enabled: settingsAiForm.enabled ? 1 : 0,
            baseUrl: settingsAiForm.baseUrl || "",
            model: settingsAiForm.model || "",
            temperature: settingsAiForm.temperature,
            timeout: settingsAiForm.timeout,
            languages: settingsAiForm.languages || "",
            apiKey: settingsAiForm.apiKey || "",
            translateEnabled: settingsAiForm.translateEnabled ? 1 : 0,
            summaryEnabled: settingsAiForm.summaryEnabled ? 1 : 0,
            commentEnabled: settingsAiForm.commentEnabled ? 1 : 0,
            polishEnabled: settingsAiForm.polishEnabled ? 1 : 0,
            slugEnabled: settingsAiForm.slugEnabled ? 1 : 0,
          };
          const data = await apiPost("settings.ai.save", payload);
          if (data && data.ai) {
            settingsData.ai = Object.assign({}, data.ai || {});
            settingsAiForm.enabled = Number(settingsData.ai.enabled || 0);
            settingsAiForm.baseUrl = String(settingsData.ai.baseUrl || "");
            settingsAiForm.model = String(settingsData.ai.model || "");
            settingsAiForm.temperature = Number(settingsData.ai.temperature ?? 0.2);
            settingsAiForm.timeout = Number(settingsData.ai.timeout || 60);
            settingsAiForm.languages = Array.isArray(settingsData.ai.languages)
              ? settingsData.ai.languages.join(",")
              : String(settingsData.ai.languages || "");
            settingsAiForm.apiKey = "";
            const aiFeatures = settingsData.ai.features || {};
            settingsAiForm.translateEnabled = Number(aiFeatures.translate || 0);
            settingsAiForm.summaryEnabled = Number(aiFeatures.summary || 0);
            settingsAiForm.commentEnabled = Number(aiFeatures.comment || 0);
            settingsAiForm.polishEnabled = Number(aiFeatures.polish || 0);
            settingsAiForm.slugEnabled = Number(aiFeatures.slug || 0);
            try {
              if (!V3A.extras || typeof V3A.extras !== "object") V3A.extras = {};
              V3A.extras.ai = Object.assign({}, settingsData.ai || {});
            } catch (e) {}
          } else {
            settingsAiForm.apiKey = "";
          }
          if (!settingsBatchSaving.value) settingsMessage.value = "已保存";
        } catch (e) {
          settingsError.value = e && e.message ? e.message : "保存失败";
        } finally {
          settingsSaving.value = false;
        }
      }

      async function testSettingsNotify() {
        if (settingsNotifyTesting.value) return;

        settingsNotifyTesting.value = true;
        settingsError.value = "";
        settingsMessage.value = "";
        try {
          const data = await apiPost("settings.notify.test", {});
          if (data && data.notify) {
            settingsData.notify = Object.assign(
              {},
              settingsData.notify || {},
              data.notify
            );
          }

          const msg = String((data && data.message) || "");
          settingsMessage.value = msg || "测试邮件已发送";
        } catch (e) {
          try {
            const apiData = e && e.apiData ? e.apiData : null;
            if (apiData && apiData.notify) {
              settingsData.notify = Object.assign(
                {},
                settingsData.notify || {},
                apiData.notify
              );
            }
          } catch (e2) {
          }
          settingsError.value = e && e.message ? e.message : "发送失败";
        } finally {
          settingsNotifyTesting.value = false;
        }
      }

      async function saveSettingsPermalink() {
        settingsSaving.value = true;
        settingsError.value = "";
        settingsMessage.value = "";
        settingsPermalinkRewriteError.value = "";
        try {
          let postPattern = String(settingsPermalinkForm.postPattern || "").trim();
          if (!postPattern) postPattern = "custom";
          if (postPattern !== "custom" && !postPattern.startsWith("/")) {
            postPattern = "/" + postPattern;
          }
          const payload = {
            rewrite: settingsPermalinkForm.rewrite ? 1 : 0,
            enableRewriteAnyway: settingsPermalinkEnableRewriteAnyway.value ? 1 : 0,
            postPattern,
            customPattern: settingsPermalinkForm.customPattern || "",
            pagePattern: settingsPermalinkForm.pagePattern || "",
            categoryPattern: settingsPermalinkForm.categoryPattern || "",
          };
          const data = await apiPost("settings.system.save", payload);
          if (data && data.permalink) {
            settingsData.permalink = Object.assign(
              {},
              settingsData.permalink || {},
              data.permalink
            );

            const postUrlRaw = String(data.permalink.postUrl || "");
            const postUrl = postUrlRaw
              ? postUrlRaw.startsWith("/")
                ? postUrlRaw
                : "/" + postUrlRaw
              : "";
            if (postUrl) {
              permalinkPostUrl.value = postUrl;
              const knownPostPattern = permalinkPostPatternOptions.some(
                (o) => o.value !== "custom" && o.value === postUrl
              );
              settingsPermalinkForm.postPattern = knownPostPattern ? postUrl : "custom";
            }

            settingsPermalinkForm.rewrite = Number(data.permalink.rewrite || 0);
            if (data.permalink.pagePattern !== undefined) {
              settingsPermalinkForm.pagePattern = String(data.permalink.pagePattern || "");
            }
            if (data.permalink.categoryPattern !== undefined) {
              settingsPermalinkForm.categoryPattern = String(
                data.permalink.categoryPattern || ""
              );
            }
            if (data.permalink.customPattern !== undefined) {
              settingsPermalinkForm.customPattern = String(
                data.permalink.customPattern || ""
              );
            }
          }
          settingsPermalinkEnableRewriteAnyway.value = 0;
          if (!settingsBatchSaving.value) settingsMessage.value = "已保存";
        } catch (e) {
          settingsError.value = e && e.message ? e.message : "保存失败";
        } finally {
          settingsSaving.value = false;
        }
      }

      async function saveSettingsAcl() {
        if (!settingsData.isAdmin) return;
        if (settingsSaving.value) return;
        if (!settingsAclLoaded.value) return;

        settingsSaving.value = true;
        settingsError.value = "";
        settingsMessage.value = "";
        try {
          const config = v3aAclNormalizeConfig(settingsAclForm);
          const data = await apiPost("acl.save", { config });
          v3aApplyAclConfig(data && data.config ? data.config : data);
          if (!settingsBatchSaving.value) settingsMessage.value = "已保存（刷新后生效）";
        } catch (e) {
          settingsError.value = e && e.message ? e.message : "保存失败";
        } finally {
          settingsSaving.value = false;
        }
      }

      async function fetchThemes() {
        themesLoading.value = true;
        themesError.value = "";
        try {
          const data = await apiGet("themes.list");
          themeCurrent.value = String(data.current || "");
          themesItems.value = Array.isArray(data.themes) ? data.themes : [];

          const selected = String(themeSelected.value || "");
          const exists =
            selected &&
            themesItems.value.some((t) => String(t?.name || "") === selected);
          if (!selected || !exists) {
            themeSelected.value = themeCurrent.value || String(themesItems.value?.[0]?.name || "");
          }
        } catch (e) {
          themesError.value = e && e.message ? e.message : "加载失败";
        } finally {
          themesLoading.value = false;
        }
      }

      function handleThemeRowClick(themeName, event) {
        const name = String(themeName || "");
        if (!name) return;
        try {
          const target = event && event.target ? event.target : null;
          if (target && typeof target.closest === "function") {
            if (target.closest("a")) return;
          }
        } catch (e) {}
        themeSelected.value = name;
      }

      async function activateTheme(themeName) {
        const theme = String(themeName || "").trim();
        if (!theme || themeActivating.value) return;
        themeActivating.value = true;
        try {
          await apiPost("themes.activate", { theme });
          toastSuccess("主题已启用");
          themeSelected.value = theme;
          await fetchThemes();
        } catch (e) {
          toastError(e && e.message ? e.message : "启用失败");
        } finally {
          themeActivating.value = false;
        }
      }

      async function fetchThemeFiles() {
        const theme = String(themeSelected.value || "");
        if (!theme) return;
        if (themeFilesLoading.value) return;

        themeFilesLoading.value = true;
        try {
          const data = await apiGet("themes.files", { theme });
          themeFilesTheme.value = theme;
          themeFiles.value = Array.isArray(data.files) ? data.files : [];

          themeEditTreeOpen.value = theme;
          const current = String(themeFile.value || "");
          const pending = String(themeEditPendingFile.value || "");
          const next =
            pending && themeFiles.value.includes(pending)
              ? pending
              : current && themeFiles.value.includes(current)
                ? current
                : themeFiles.value.includes("index.php")
                  ? "index.php"
                  : String(themeFiles.value?.[0] || "");
          themeEditPendingFile.value = "";
          themeFile.value = next;
        } catch (e) {
          toastError(e && e.message ? e.message : "加载失败");
        } finally {
          themeFilesLoading.value = false;
        }
      }

      async function fetchThemeFile() {
        const theme = String(themeSelected.value || "");
        const file = String(themeFile.value || "");
        if (!theme || !file) return;

        themeFileLoading.value = true;
        try {
          const data = await apiGet("themes.file.get", { theme, file });
          themeFileContent.value = String(data.content ?? "");
          themeFileBase.value = themeFileContent.value;
          themeFileWriteable.value = Number(data.writeable || 0) ? 1 : 0;
        } catch (e) {
          toastError(e && e.message ? e.message : "加载失败");
        } finally {
          themeFileLoading.value = false;
        }
      }

      async function saveThemeFile() {
        const theme = String(themeSelected.value || "");
        const file = String(themeFile.value || "");
        if (
          !theme ||
          !file ||
          themeFileSaving.value ||
          !themeFileWriteable.value ||
          !themeFileDirty.value
        ) {
          return;
        }

        themeFileSaving.value = true;
        try {
          await apiPost("themes.file.save", {
            theme,
            file,
            content: String(themeFileContent.value ?? ""),
          });
          themeFileBase.value = String(themeFileContent.value ?? "");
          if (!settingsBatchSaving.value) toastSuccess("文件已保存");
        } catch (e) {
          if (settingsBatchSaving.value) {
            settingsError.value = e && e.message ? e.message : "保存失败";
          } else {
            toastError(e && e.message ? e.message : "保存失败");
          }
        } finally {
          themeFileSaving.value = false;
        }
      }

      async function fetchThemeConfig() {
        const theme = String(themeSelected.value || "");
        if (!theme) return;
        if (themeConfigLoading.value) return;

        themeConfigHtml.value = "";
        themeConfigLoading.value = true;
        try {
          const data = await apiGet("themes.config.get", { theme });
          themeConfigTheme.value = theme;
          themeConfigExists.value = Number(data.exists || 0) ? 1 : 0;
          themeConfigFields.value = Array.isArray(data.fields) ? data.fields : [];
          themeConfigHtml.value = String(data.html || "");

          for (const k of Object.keys(themeConfigForm)) {
            delete themeConfigForm[k];
          }
          for (const f of themeConfigFields.value) {
            const name = String(f?.name || "");
            if (!name) continue;
            const type = String(f?.type || "text");
            let v = f?.value;
            if (type === "checkbox") {
              if (Array.isArray(v)) {
                v = v.map(String);
              } else if (v === null || v === undefined || v === "") {
                v = [];
              } else {
                v = [String(v)];
              }
            } else if (type === "number") {
              v = v === null || v === undefined ? "" : String(v);
            } else {
              v = v === null || v === undefined ? "" : String(v);
            }
            themeConfigForm[name] = v;
          }
          themeConfigBase.value = v3aStableStringify(themeConfigForm);
        } catch (e) {
          toastError(e && e.message ? e.message : "加载失败");
        } finally {
          themeConfigLoading.value = false;
        }
      }

      async function saveThemeConfig() {
        const theme = String(themeSelected.value || "");
        if (
          !theme ||
          !themeConfigExists.value ||
          themeConfigSaving.value ||
          !themeConfigDirty.value
        ) {
          return;
        }

        themeConfigSaving.value = true;
        try {
          await apiPost("themes.config.save", {
            theme,
            values: Object.assign({}, themeConfigForm),
          });
          if (!settingsBatchSaving.value) toastSuccess("主题设置已保存");
          await fetchThemeConfig();
        } catch (e) {
          if (settingsBatchSaving.value) {
            settingsError.value = e && e.message ? e.message : "保存失败";
          } else {
            toastError(e && e.message ? e.message : "保存失败");
          }
        } finally {
          themeConfigSaving.value = false;
        }
      }

      async function fetchPlugins() {
        pluginsLoading.value = true;
        pluginsError.value = "";
        try {
          const data = await apiGet("plugins.list");
          pluginsActivated.value = Array.isArray(data.activated) ? data.activated : [];
          pluginsInactive.value = Array.isArray(data.inactive) ? data.inactive : [];
        } catch (e) {
          pluginsError.value = e && e.message ? e.message : "加载失败";
        } finally {
          pluginsLoading.value = false;
        }
      }

      function closePluginConfig() {
        pluginConfigOpen.value = false;
        pluginConfigLoading.value = false;
        pluginConfigSaving.value = false;
        pluginConfigName.value = "";
        pluginConfigTitle.value = "";
        pluginConfigExists.value = 0;
        pluginConfigHtml.value = "";
        pluginConfigRenderToken++;
      }

      async function initPluginConfigLegacyDom(token) {
        if (!pluginConfigOpen.value) return;
        if (token !== pluginConfigRenderToken) return;
        if (!pluginConfigExists.value) return;

        await nextTick();
        if (token !== pluginConfigRenderToken) return;

        const root = pluginConfigLegacyEl.value;
        if (!root) return;

        try {
          root
            .querySelectorAll(
              "ul.typecho-option.typecho-option-submit, ul.typecho-option-submit"
            )
            .forEach((n) => n && n.remove && n.remove());
        } catch (e) {}

        try {
          root.querySelectorAll("label.typecho-label").forEach((label) => {
            if (!label || !label.querySelector) return;
            if (!label.querySelector("h2, h3")) return;
            label.classList.add("v3a-typecho-label-heading");
            const li = label.closest ? label.closest("li") : null;
            if (li && li.classList) li.classList.add("v3a-typecho-option-heading");
          });
        } catch (e) {}

        try {
          const form = root.querySelector("form");
          if (form && !form.__v3aBound) {
            form.__v3aBound = true;
            form.addEventListener("submit", (e) => {
              e.preventDefault();
              savePluginConfig();
            });
          }
        } catch (e) {}

        await v3aExecuteScriptsIn(root);
      }

      async function fetchPluginConfigHtml() {
        const plugin = String(pluginConfigName.value || "");
        if (!plugin) return;

        const token = ++pluginConfigRenderToken;
        pluginConfigLoading.value = true;
        pluginConfigExists.value = 0;
        pluginConfigHtml.value = "";

        try {
          const data = await apiGet("plugins.config.html", { plugin });
          if (token !== pluginConfigRenderToken) return;
          pluginConfigExists.value = Number(data.exists || 0) ? 1 : 0;
          pluginConfigHtml.value = String(data.html || "");
        } catch (e) {
          if (token !== pluginConfigRenderToken) return;
          pluginConfigExists.value = 0;
          pluginConfigHtml.value = "";
          toastError(e && e.message ? e.message : "加载失败");
        } finally {
          if (token === pluginConfigRenderToken) {
            pluginConfigLoading.value = false;
            await initPluginConfigLegacyDom(token);
          }
        }
      }

      async function savePluginConfig() {
        const plugin = String(pluginConfigName.value || "");
        if (!plugin || !pluginConfigExists.value || pluginConfigSaving.value) return;

        const root = pluginConfigLegacyEl.value;
        const form = root ? root.querySelector("form") : null;
        if (!form) {
          toastError("找不到插件设置表单");
          return;
        }

        const values = {};
        const checkboxKeys = new Set();

        try {
          const elements = Array.from(form.elements || []);
          for (const el of elements) {
            if (!el || !el.name) continue;
            if (el.disabled) continue;

            const rawName = String(el.name || "");
            if (!rawName) continue;

            // Skip internal/irrelevant fields.
            if (rawName === "_" || rawName === "csrfRef" || rawName === "do") continue;

            const name = rawName.endsWith("[]") ? rawName.slice(0, -2) : rawName;
            const tag = String(el.tagName || "").toLowerCase();
            const type = String(el.type || "").toLowerCase();

            if (type === "checkbox") {
              checkboxKeys.add(name);
              if (!Array.isArray(values[name])) values[name] = [];
              if (el.checked) values[name].push(String(el.value ?? "1"));
              continue;
            }

            if (type === "radio") {
              if (el.checked) values[name] = String(el.value ?? "");
              continue;
            }

            if (tag === "select" && el.multiple) {
              values[name] = Array.from(el.selectedOptions || []).map((o) =>
                String(o && o.value !== undefined ? o.value : "")
              );
              continue;
            }

            values[name] = String(el.value ?? "");
          }
        } catch (e) {}

        for (const k of checkboxKeys) {
          if (!Array.isArray(values[k])) values[k] = [];
        }

        pluginConfigSaving.value = true;
        try {
          await apiPost("plugins.config.save", { plugin, values });
          toastSuccess("插件设置已保存");
          await fetchPluginConfigHtml();
        } catch (e) {
          toastError(e && e.message ? e.message : "保存失败");
        } finally {
          pluginConfigSaving.value = false;
        }
      }

      async function openPluginConfig(p) {
        const name = String(p?.name || "");
        if (!name) return;

        pluginConfigTitle.value = String(p?.title || p?.name || "");
        pluginConfigName.value = name;
        pluginConfigOpen.value = true;
        pluginConfigSaving.value = false;
        await fetchPluginConfigHtml();
      }

      async function activatePlugin(p) {
        const name = String(p?.name || "");
        if (!name || pluginsActing.value) return;
        pluginsActing.value = true;
        try {
          await apiPost("plugins.activate", { plugin: name });
          toastSuccess("插件已启动");
          await fetchPlugins();
        } catch (e) {
          toastError(e && e.message ? e.message : "操作失败");
        } finally {
          pluginsActing.value = false;
        }
      }

      async function deactivatePlugin(p) {
        const name = String(p?.name || "");
        if (!name || pluginsActing.value) return;
        if (!confirm("确认移除（停用）该插件吗？")) return;
        pluginsActing.value = true;
        try {
          await apiPost("plugins.deactivate", { plugin: name });
          toastSuccess("插件已移除");
          await fetchPlugins();
        } catch (e) {
          toastError(e && e.message ? e.message : "操作失败");
        } finally {
          pluginsActing.value = false;
        }
      }

      async function maybeFetchSettingsExtras() {
        if (routePath.value !== "/settings") return;

        const activeKey = String(settingsActiveKey.value || "");
        if (activeKey === "acl") {
          if (!settingsAclLoaded.value && !settingsAclLoading.value) {
            await fetchSettingsAcl();
          }
          return;
        }
        if (activeKey.startsWith("theme.")) {
          if (!themesItems.value.length && !themesLoading.value) {
            await fetchThemes();
          }

          const theme = String(themeSelected.value || "");
          if (!theme) return;

          if (activeKey === "theme.edit") {
            themeEditTreeOpen.value = themeEditTreeOpen.value || theme;
            if (themeFilesTheme.value !== theme) {
              await fetchThemeFiles();
              return;
            }
            if (themeFile.value && themeFileBase.value === null && !themeFileLoading.value) {
              await fetchThemeFile();
            }
            return;
          }
        }

        if (activeKey === "plugins") {
          if (
            !pluginsLoading.value &&
            !pluginsActivated.value.length &&
            !pluginsInactive.value.length
          ) {
            await fetchPlugins();
          }
        }
      }

      function v3aNormStr(v) {
        return String(v ?? "").trim();
      }

      function v3aNormNum(v, fallback = 0) {
        const n = Number(v);
        return Number.isFinite(n) ? n : fallback;
      }

      function v3aSortedArrayStrings(arr) {
        return (Array.isArray(arr) ? arr : []).map(String).sort();
      }

      function v3aArrayEqual(a, b) {
        const aa = v3aSortedArrayStrings(a);
        const bb = v3aSortedArrayStrings(b);
        if (aa.length !== bb.length) return false;
        for (let i = 0; i < aa.length; i++) {
          if (aa[i] !== bb[i]) return false;
        }
        return true;
      }

      function v3aUserOptionsAllowFromData(userOptions) {
        const allow = [];
        if (v3aNormNum(userOptions?.defaultAllowComment || 0)) allow.push("comment");
        if (v3aNormNum(userOptions?.defaultAllowPing || 0)) allow.push("ping");
        if (v3aNormNum(userOptions?.defaultAllowFeed || 0)) allow.push("feed");
        return allow;
      }

      function v3aNormPermalinkPattern(v) {
        let s = v3aNormStr(v);
        if (!s) return "";
        if (!s.startsWith("/")) s = "/" + s;
        return s;
      }

      const V3A_ACL_GROUPS = [
        "administrator",
        "editor",
        "contributor",
        "subscriber",
        "visitor",
      ];

      function v3aAclNormalizeTypes(types) {
        const raw = Array.isArray(types) ? types : [];
        const cleaned = raw
          .map((t) => String(t || "").trim().toLowerCase().replace(/^\\./, ""))
          .filter(Boolean);
        return Array.from(new Set(cleaned)).sort();
      }

      function v3aAclNormalizeGroup(group) {
        const g = group && typeof group === "object" ? group : {};
        const normBool = (v, fallback = 0) => (Number(v) ? 1 : 0) || fallback;

        const posts = g.posts && typeof g.posts === "object" ? g.posts : {};
        const comments = g.comments && typeof g.comments === "object" ? g.comments : {};
        const pages = g.pages && typeof g.pages === "object" ? g.pages : {};
        const files = g.files && typeof g.files === "object" ? g.files : {};
        const friends = g.friends && typeof g.friends === "object" ? g.friends : {};
        const data = g.data && typeof g.data === "object" ? g.data : {};
        const users = g.users && typeof g.users === "object" ? g.users : {};
        const maintenance = g.maintenance && typeof g.maintenance === "object" ? g.maintenance : {};

        const maxSizeMbRaw = Number(files.maxSizeMb ?? 0);
        const maxSizeMb = Number.isFinite(maxSizeMbRaw)
          ? Math.max(0, Math.min(2048, Math.floor(maxSizeMbRaw)))
          : 0;

        return {
          posts: {
            write: normBool(posts.write),
            manage: normBool(posts.manage),
            taxonomy: normBool(posts.taxonomy),
            scopeAll: normBool(posts.scopeAll),
          },
          comments: {
            manage: normBool(comments.manage),
            scopeAll: normBool(comments.scopeAll),
          },
          pages: {
            manage: normBool(pages.manage),
          },
          files: {
            access: normBool(files.access),
            upload: normBool(files.upload),
            scopeAll: normBool(files.scopeAll),
            maxSizeMb,
            types: v3aAclNormalizeTypes(files.types),
          },
          friends: { manage: normBool(friends.manage) },
          data: { manage: normBool(data.manage) },
          users: { manage: normBool(users.manage) },
          maintenance: { manage: normBool(maintenance.manage) },
        };
      }

      function v3aAclNormalizeConfig(config) {
        const cfg = config && typeof config === "object" ? config : {};
        const rawGroups = cfg.groups && typeof cfg.groups === "object" ? cfg.groups : {};

        const out = { version: 1, groups: {} };
        const version = Number(cfg.version || 1);
        out.version = Number.isFinite(version) && version > 0 ? Math.floor(version) : 1;

        for (const key of V3A_ACL_GROUPS) {
          out.groups[key] = v3aAclNormalizeGroup(rawGroups[key]);
        }

        return out;
      }

      const settingsDirtyState = computed(() => {
        if (settingsLoading.value) {
          return {
            profile: false,
            userOptions: false,
            site: false,
            storage: false,
            reading: false,
            discussion: false,
            notify: false,
            ai: false,
            permalink: false,
            acl: false,
          };
        }

        const profile = {
          screenName: v3aNormStr(settingsData.profile?.screenName || ""),
          mail: v3aNormStr(settingsData.profile?.mail || ""),
          url: v3aNormStr(settingsData.profile?.url || ""),
        };
        const profileDirty =
          v3aNormStr(settingsProfileForm.screenName) !== profile.screenName ||
          v3aNormStr(settingsProfileForm.mail) !== profile.mail ||
          v3aNormStr(settingsProfileForm.url) !== profile.url;

        const userOptions = settingsData.userOptions || {};
        const userOptionsDefaultAllow = v3aUserOptionsAllowFromData(userOptions);
        const userOptionsDirty =
          v3aNormNum(settingsUserOptionsForm.markdown) !== v3aNormNum(userOptions.markdown) ||
          v3aNormNum(settingsUserOptionsForm.xmlrpcMarkdown) !==
            v3aNormNum(userOptions.xmlrpcMarkdown) ||
          v3aNormNum(settingsUserOptionsForm.autoSave) !== v3aNormNum(userOptions.autoSave) ||
          !v3aArrayEqual(settingsUserOptionsForm.defaultAllow, userOptionsDefaultAllow);

        const isAdmin = !!settingsData.isAdmin;
        if (!isAdmin) {
          return {
            profile: profileDirty,
            userOptions: userOptionsDirty,
            site: false,
            storage: false,
            reading: false,
            discussion: false,
            notify: false,
            ai: false,
            permalink: false,
            acl: false,
          };
        }

        const site = settingsData.site || {};
        const siteDirty =
          v3aNormStr(settingsSiteForm.siteUrl) !== v3aNormStr(site.siteUrl || "") ||
          v3aNormStr(settingsSiteForm.title) !== v3aNormStr(site.title || "") ||
          v3aNormStr(settingsSiteForm.description) !== v3aNormStr(site.description || "") ||
          v3aNormStr(settingsSiteForm.keywords) !== v3aNormStr(site.keywords || "") ||
          v3aNormStr(settingsSiteForm.loginStyle) !== v3aNormStr(site.loginStyle || "") ||
          v3aNormStr(settingsSiteForm.loginBackground) !== v3aNormStr(site.loginBackground || "") ||
          v3aNormNum(settingsSiteForm.allowRegister) !== v3aNormNum(site.allowRegister) ||
          v3aNormStr(settingsSiteForm.defaultRegisterGroup) !==
            v3aNormStr(site.defaultRegisterGroup || "subscriber") ||
          v3aNormNum(settingsSiteForm.allowXmlRpc) !== v3aNormNum(site.allowXmlRpc) ||
          v3aNormStr(settingsSiteForm.lang) !== v3aNormStr(site.lang || "zh_CN") ||
          v3aNormNum(settingsSiteForm.timezone, 28800) !== v3aNormNum(site.timezone, 28800);

        const storage = settingsData.storage || {};
        const at = parseAttachmentTypesValue(storage.attachmentTypes || "");
        const storageHasOther = (settingsStorageForm.attachmentTypes || []).includes(
          "@other@"
        );
        const storageDirty =
          !v3aArrayEqual(settingsStorageForm.attachmentTypes, at.selected) ||
          (storageHasOther
            ? v3aNormStr(settingsStorageForm.attachmentTypesOther) !==
              v3aNormStr(at.other || "")
            : false);

        const reading = settingsData.reading || {};
        const frontPageType = v3aNormStr(settingsReadingForm.frontPageType || "recent") || "recent";
        let frontPageValue = "";
        if (frontPageType === "page") {
          frontPageValue = String(v3aNormNum(settingsReadingForm.frontPagePage || 0, 0));
        } else if (frontPageType === "file") {
          frontPageValue = v3aNormStr(settingsReadingForm.frontPageFile || "");
        }
        const readingFrontArchiveEnabled =
          frontPageType !== "recent" && v3aNormNum(settingsReadingForm.frontArchive);
        const readingDirty =
          v3aNormStr(settingsReadingForm.postDateFormat) !== v3aNormStr(reading.postDateFormat) ||
          frontPageType !== v3aNormStr(reading.frontPageType || "recent") ||
          v3aNormStr(frontPageValue) !== v3aNormStr(reading.frontPageValue || "") ||
          (frontPageType !== "recent"
            ? v3aNormNum(settingsReadingForm.frontArchive) !== v3aNormNum(reading.frontArchive)
            : false) ||
          (readingFrontArchiveEnabled
            ? v3aNormStr(settingsReadingForm.archivePattern) !==
              v3aNormStr(reading.archivePattern)
            : false) ||
          v3aNormNum(settingsReadingForm.pageSize) !== v3aNormNum(reading.pageSize, 10) ||
          v3aNormNum(settingsReadingForm.postsListSize) !== v3aNormNum(reading.postsListSize, 10) ||
          v3aNormNum(settingsReadingForm.feedFullText) !== v3aNormNum(reading.feedFullText);

        const discussion = settingsData.discussion || {};
        const discussionPageBreakEnabled = v3aNormNum(
          settingsDiscussionForm.commentsPageBreak
        );
        const discussionThreadedEnabled = v3aNormNum(
          settingsDiscussionForm.commentsThreaded
        );
        const discussionShowUrlEnabled = v3aNormNum(
          settingsDiscussionForm.commentsShowUrl
        );
        const discussionAvatarEnabled = v3aNormNum(settingsDiscussionForm.commentsAvatar);
        const discussionAutoCloseEnabled = v3aNormNum(
          settingsDiscussionForm.commentsAutoClose
        );
        const discussionIntervalEnabled = v3aNormNum(
          settingsDiscussionForm.commentsPostIntervalEnable
        );
        const discussionDirty =
          v3aNormStr(settingsDiscussionForm.commentDateFormat) !==
            v3aNormStr(discussion.commentDateFormat) ||
          v3aNormNum(settingsDiscussionForm.commentsListSize) !==
            v3aNormNum(discussion.commentsListSize) ||
          v3aNormNum(settingsDiscussionForm.commentsShowCommentOnly) !==
            v3aNormNum(discussion.commentsShowCommentOnly) ||
          v3aNormNum(settingsDiscussionForm.commentsMarkdown) !==
            v3aNormNum(discussion.commentsMarkdown) ||
          v3aNormNum(settingsDiscussionForm.commentsShowUrl) !==
            v3aNormNum(discussion.commentsShowUrl) ||
          (discussionShowUrlEnabled
            ? v3aNormNum(settingsDiscussionForm.commentsUrlNofollow) !==
              v3aNormNum(discussion.commentsUrlNofollow)
            : false) ||
          v3aNormNum(settingsDiscussionForm.commentsAvatar) !==
            v3aNormNum(discussion.commentsAvatar) ||
          (discussionAvatarEnabled
            ? v3aNormStr(settingsDiscussionForm.commentsAvatarRating) !==
              v3aNormStr(discussion.commentsAvatarRating || "G")
            : false) ||
          v3aNormNum(settingsDiscussionForm.commentsPageBreak) !==
            v3aNormNum(discussion.commentsPageBreak) ||
          (discussionPageBreakEnabled
            ? v3aNormNum(settingsDiscussionForm.commentsPageSize) !==
                v3aNormNum(discussion.commentsPageSize) ||
                v3aNormStr(settingsDiscussionForm.commentsPageDisplay) !==
                  v3aNormStr(discussion.commentsPageDisplay || "last")
            : false) ||
          v3aNormNum(settingsDiscussionForm.commentsThreaded) !==
            v3aNormNum(discussion.commentsThreaded) ||
          (discussionThreadedEnabled
            ? v3aNormNum(settingsDiscussionForm.commentsMaxNestingLevels) !==
              v3aNormNum(discussion.commentsMaxNestingLevels, 3)
            : false) ||
          v3aNormStr(settingsDiscussionForm.commentsOrder) !== v3aNormStr(discussion.commentsOrder) ||
          v3aNormNum(settingsDiscussionForm.commentsRequireModeration) !==
            v3aNormNum(discussion.commentsRequireModeration) ||
          v3aNormNum(settingsDiscussionForm.commentsWhitelist) !==
            v3aNormNum(discussion.commentsWhitelist) ||
          v3aNormNum(settingsDiscussionForm.commentsRequireMail) !==
            v3aNormNum(discussion.commentsRequireMail) ||
          v3aNormNum(settingsDiscussionForm.commentsRequireUrl) !==
            v3aNormNum(discussion.commentsRequireUrl) ||
          v3aNormNum(settingsDiscussionForm.commentsCheckReferer) !==
            v3aNormNum(discussion.commentsCheckReferer) ||
          v3aNormNum(settingsDiscussionForm.commentsAntiSpam) !==
            v3aNormNum(discussion.commentsAntiSpam) ||
          v3aNormNum(settingsDiscussionForm.commentsAutoClose) !==
            v3aNormNum(discussion.commentsAutoClose) ||
          (discussionAutoCloseEnabled
            ? v3aNormNum(settingsDiscussionForm.commentsPostTimeoutDays) !==
              v3aNormNum(discussion.commentsPostTimeoutDays)
            : false) ||
          v3aNormNum(settingsDiscussionForm.commentsPostIntervalEnable) !==
            v3aNormNum(discussion.commentsPostIntervalEnable) ||
          (discussionIntervalEnabled
            ? v3aNormNum(settingsDiscussionForm.commentsPostIntervalMins) !==
              v3aNormNum(discussion.commentsPostIntervalMins)
            : false) ||
          v3aNormStr(settingsDiscussionForm.commentsHTMLTagAllowed) !==
            v3aNormStr(discussion.commentsHTMLTagAllowed);

        const notify = settingsData.notify || {};
        const notifyDirty =
          v3aNormNum(settingsNotifyForm.mailEnabled) !== v3aNormNum(notify.mailEnabled) ||
          v3aNormNum(settingsNotifyForm.commentNotifyEnabled) !==
            v3aNormNum(notify.commentNotifyEnabled) ||
          v3aNormNum(settingsNotifyForm.commentWaitingNotifyEnabled) !==
            v3aNormNum(notify.commentWaitingNotifyEnabled ?? notify.commentNotifyEnabled) ||
          v3aNormNum(settingsNotifyForm.commentReplyNotifyEnabled) !==
            v3aNormNum(notify.commentReplyNotifyEnabled) ||
          v3aNormNum(settingsNotifyForm.friendLinkNotifyEnabled) !==
            v3aNormNum(notify.friendLinkNotifyEnabled) ||
          v3aNormNum(settingsNotifyForm.friendLinkAuditNotifyEnabled) !==
            v3aNormNum(notify.friendLinkAuditNotifyEnabled) ||
          v3aNormStr(settingsNotifyForm.templateStyle) !== v3aNormStr(notify.templateStyle || "v3a") ||
          v3aNormStr(settingsNotifyForm.adminTo) !== v3aNormStr(notify.adminTo) ||
          v3aNormStr(settingsNotifyForm.smtpFrom) !== v3aNormStr(notify.smtpFrom) ||
          v3aNormStr(settingsNotifyForm.smtpHost) !== v3aNormStr(notify.smtpHost) ||
          v3aNormNum(settingsNotifyForm.smtpPort, 465) !== v3aNormNum(notify.smtpPort, 465) ||
          v3aNormStr(settingsNotifyForm.smtpUser) !== v3aNormStr(notify.smtpUser) ||
          v3aNormNum(settingsNotifyForm.smtpSecure) !==
            (v3aNormNum(notify.smtpSecure ?? 1) ? 1 : 0) ||
          v3aNormStr(settingsNotifyForm.commentTemplate) !==
            v3aNormStr(notify.commentTemplate || DEFAULT_NOTIFY_COMMENT_TEMPLATE) ||
          v3aNormStr(settingsNotifyForm.commentWaitingTemplate) !==
            v3aNormStr(
              notify.commentWaitingTemplate || DEFAULT_NOTIFY_COMMENT_WAITING_TEMPLATE
            ) ||
          v3aNormStr(settingsNotifyForm.commentReplyTemplate) !==
            v3aNormStr(
              notify.commentReplyTemplate || DEFAULT_NOTIFY_COMMENT_REPLY_TEMPLATE
            ) ||
          v3aNormStr(settingsNotifyForm.friendLinkTemplate) !==
            v3aNormStr(
              notify.friendLinkTemplate || DEFAULT_NOTIFY_FRIENDLINK_TEMPLATE
            ) ||
          v3aNormStr(settingsNotifyForm.friendLinkAuditPassTemplate) !==
            v3aNormStr(
              notify.friendLinkAuditPassTemplate ||
                DEFAULT_NOTIFY_FRIENDLINK_AUDIT_PASS_TEMPLATE
            ) ||
          v3aNormStr(settingsNotifyForm.friendLinkAuditRejectTemplate) !==
            v3aNormStr(
              notify.friendLinkAuditRejectTemplate ||
                DEFAULT_NOTIFY_FRIENDLINK_AUDIT_REJECT_TEMPLATE
            ) ||
          v3aNormStr(settingsNotifyForm.smtpPass) !== "";

        const ai = settingsData.ai || {};
        const aiFeatures = ai.features || {};
        const aiLanguages = Array.isArray(ai.languages)
          ? ai.languages.join(",")
          : String(ai.languages || "");
        const aiDirty =
          v3aNormNum(settingsAiForm.enabled) !== v3aNormNum(ai.enabled) ||
          v3aNormStr(settingsAiForm.baseUrl) !== v3aNormStr(ai.baseUrl || "") ||
          v3aNormStr(settingsAiForm.model) !== v3aNormStr(ai.model || "") ||
          v3aNormNum(settingsAiForm.temperature, 0.2) !== v3aNormNum(ai.temperature, 0.2) ||
          v3aNormNum(settingsAiForm.timeout, 60) !== v3aNormNum(ai.timeout, 60) ||
          v3aNormStr(settingsAiForm.languages) !== v3aNormStr(aiLanguages) ||
          v3aNormNum(settingsAiForm.translateEnabled) !== v3aNormNum(aiFeatures.translate) ||
          v3aNormNum(settingsAiForm.summaryEnabled) !== v3aNormNum(aiFeatures.summary) ||
          v3aNormNum(settingsAiForm.commentEnabled) !== v3aNormNum(aiFeatures.comment) ||
          v3aNormNum(settingsAiForm.polishEnabled) !== v3aNormNum(aiFeatures.polish) ||
          v3aNormNum(settingsAiForm.slugEnabled) !== v3aNormNum(aiFeatures.slug) ||
          v3aNormStr(settingsAiForm.apiKey) !== "";

        const permalink = settingsData.permalink || {};
        const permalinkRewrite = v3aNormNum(permalink.rewrite || 0) ? 1 : 0;
        const permalinkPostUrl = v3aNormPermalinkPattern(permalink.postUrl || "");
        const permalinkKnown = permalinkPostPatternOptions.some(
          (o) => o.value !== "custom" && v3aNormPermalinkPattern(o.value) === permalinkPostUrl
        );
        const basePostSelection = permalinkKnown ? permalinkPostUrl : "custom";
        const baseCustomPattern = v3aNormStr(permalink.customPattern || "");
        const currentPostSelection = v3aNormStr(settingsPermalinkForm.postPattern || "custom");
        const currentCustomPattern = v3aNormStr(settingsPermalinkForm.customPattern || "");
        const permalinkDirty =
          v3aNormNum(settingsPermalinkForm.rewrite) !== permalinkRewrite ||
          v3aNormPermalinkPattern(settingsPermalinkForm.pagePattern) !==
            v3aNormPermalinkPattern(permalink.pagePattern || "") ||
          v3aNormPermalinkPattern(settingsPermalinkForm.categoryPattern) !==
            v3aNormPermalinkPattern(permalink.categoryPattern || "") ||
          (basePostSelection === "custom"
            ? currentPostSelection !== "custom" ||
              v3aNormPermalinkPattern(currentCustomPattern) !==
                v3aNormPermalinkPattern(baseCustomPattern || permalinkPostUrl)
            : currentPostSelection !== basePostSelection);

        const aclDirty =
          settingsAclLoaded.value &&
          settingsAclOriginal.value !==
            JSON.stringify(v3aAclNormalizeConfig(settingsAclForm));

        return {
          profile: profileDirty,
          userOptions: userOptionsDirty,
          site: siteDirty,
          storage: storageDirty,
          reading: readingDirty,
          discussion: discussionDirty,
          notify: notifyDirty,
          ai: aiDirty,
          permalink: permalinkDirty,
          acl: aclDirty,
        };
      });

      const settingsDirtyCount = computed(() => {
        const s = settingsDirtyState.value || {};
        return Object.values(s).filter(Boolean).length;
      });

      async function saveSettingsAll() {
        if (settingsLoading.value || settingsSaving.value || settingsBatchSaving.value) return;

        const dirty = settingsDirtyState.value || {};
        const reloadAfterSave = !!dirty.ai;
        const tasks = [];
        if (dirty.profile) tasks.push(saveSettingsProfile);
        if (dirty.userOptions) tasks.push(saveSettingsUserOptions);
        if (dirty.site) tasks.push(saveSettingsSite);
        if (dirty.storage) tasks.push(saveSettingsStorage);
        if (dirty.reading) tasks.push(saveSettingsReading);
        if (dirty.discussion) tasks.push(saveSettingsDiscussion);
        if (dirty.notify) tasks.push(saveSettingsNotify);
        if (dirty.ai) tasks.push(saveSettingsAi);
        if (dirty.permalink) tasks.push(saveSettingsPermalink);
        if (dirty.acl) tasks.push(saveSettingsAcl);
        if (!tasks.length) return;

        settingsBatchSaving.value = true;
        try {
          for (const fn of tasks) {
            await fn();
            if (settingsError.value) break;
          }
        } finally {
          settingsBatchSaving.value = false;
        }

        if (!settingsError.value) {
          settingsMessage.value = tasks.length > 1 ? "已保存全部" : "已保存";
          if (reloadAfterSave) {
            setTimeout(() => {
              try {
                location.reload();
              } catch (e) {}
            }, 600);
          }
        }
      }

      function safeJsonParse(value) {
        if (value === null || value === undefined) return value;
        if (typeof value !== "string") return value;
        const s = value.trim();
        if (!s) return "";
        if (!(s.startsWith("{") || s.startsWith("["))) return value;
        try {
          return JSON.parse(s);
        } catch (e) {
          return value;
        }
      }

      function renderCharts() {
        if (!window.echarts) return;

        const visitEl = document.getElementById("v3a-chart-visit-week");
        const publishEl = document.getElementById("v3a-chart-publish");
        const categoryEl = document.getElementById("v3a-chart-category");
        const commentEl = document.getElementById("v3a-chart-comment");
        const tagEl = document.getElementById("v3a-chart-tag");
        const dataTrafficTrendEl = document.getElementById("v3a-chart-data-traffic-trend");
        const dataTrafficReferringEl = document.getElementById("v3a-chart-data-traffic-referring");
        const dataTrafficPopularEl = document.getElementById("v3a-chart-data-traffic-popular");

        const isDark = document.documentElement.classList.contains("dark");
        const axisLabelColor = isDark ? "#a3a3a3" : "#525252"; // mx-admin chartTheme.textColor
        const axisStrokeColor = "#737373"; // mx-admin chartTheme axis stroke
        const gridColor = isDark ? "#404040" : "#e5e5e5"; // mx-admin chartTheme grid stroke
        const palette = [
          "#5B8FF9",
          "#5AD8A6",
          "#5D7092",
          "#F6BD16",
          "#6F5EF9",
          "#6DC8EC",
          "#945FB9",
          "#FF9845",
          "#1E9493",
          "#FF99C3",
        ];

        if (visitEl) {
          chartVisitWeek =
            window.echarts.getInstanceByDom(visitEl) ||
            window.echarts.init(visitEl);

          const fallbackDays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
          const rows = visitWeekTrend.value && visitWeekTrend.value.length
            ? visitWeekTrend.value
            : fallbackDays.map((d) => ({ day: d, ip: 0, pv: 0 }));

          const xData = rows.map((i) => String(i.day || i.date || ""));
          const ipData = rows.map((i) => Number(i.ip || 0));
          const pvData = rows.map((i) => Number(i.pv || 0));

          chartVisitWeek.setOption(
            {
              color: [palette[0], palette[1]],
              legend: {
                left: 0,
                top: 0,
                itemWidth: 10,
                itemHeight: 10,
                textStyle: { color: axisLabelColor, fontSize: 12 },
                data: ["IP", "PV"],
              },
              // Keep y-axis labels inside canvas (avoid being clipped on narrow cards).
              grid: { left: 44, right: 24, top: 36, bottom: 36, containLabel: true },
              tooltip: {
                trigger: "axis",
                axisPointer: { type: "cross" },
              },
              xAxis: {
                type: "category",
                boundaryGap: false,
                data: xData,
                axisLabel: { color: axisLabelColor },
                axisLine: { lineStyle: { color: axisStrokeColor } },
                axisTick: {
                  show: true,
                  alignWithLabel: true,
                  lineStyle: { color: axisStrokeColor },
                },
              },
              yAxis: {
                type: "value",
                axisLabel: { color: axisLabelColor },
                axisLine: { show: true, lineStyle: { color: axisStrokeColor } },
                axisTick: { show: true, lineStyle: { color: axisStrokeColor } },
                splitLine: { lineStyle: { color: gridColor } },
              },
              series: [
                {
                  name: "IP",
                  type: "line",
                  smooth: true,
                  showSymbol: true,
                  symbol: "circle",
                  symbolSize: 4,
                  lineStyle: { width: 2 },
                  data: ipData,
                },
                {
                  name: "PV",
                  type: "line",
                  smooth: true,
                  showSymbol: true,
                  symbol: "circle",
                  symbolSize: 4,
                  lineStyle: { width: 2 },
                  data: pvData,
                },
              ],
            },
            { notMerge: true }
          );
        }

        if (dataTrafficTrendEl) {
          chartDataTrafficTrend =
            window.echarts.getInstanceByDom(dataTrafficTrendEl) ||
            window.echarts.init(dataTrafficTrendEl);

          const traffic = dataVisitTraffic.value || {};
          const trend = Array.isArray(traffic.trend) ? traffic.trend : [];
          const tz = settingsData && settingsData.site ? settingsData.site.timezone : undefined;

          if (!trend.length) {
            try {
              chartDataTrafficTrend.clear();
            } catch (e) {}
          } else {
            const xData = trend.map((i) =>
              formatTime(Number(i.ts || 0), tz).slice(5, 10).replace("-", "/")
            );
            const viewsData = trend.map((i) => Number(i.views || 0));
            const uvData = trend.map((i) => Number(i.uv || 0));

            chartDataTrafficTrend.setOption(
              {
                color: [palette[1], palette[0]],
                legend: {
                  left: 0,
                  top: 0,
                  itemWidth: 10,
                  itemHeight: 10,
                  textStyle: { color: axisLabelColor, fontSize: 12 },
                  data: ["Views", "UV"],
                },
                // Keep y-axis labels inside canvas (avoid being clipped on narrow cards).
                grid: { left: 44, right: 24, top: 36, bottom: 36, containLabel: true },
                tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
                xAxis: {
                  type: "category",
                  boundaryGap: false,
                  data: xData,
                  axisLabel: {
                    color: axisLabelColor,
                    interval: (index) => index % 2 === 0,
                  },
                  axisLine: { lineStyle: { color: axisStrokeColor } },
                  axisTick: {
                    show: true,
                    alignWithLabel: true,
                    lineStyle: { color: axisStrokeColor },
                    interval: (index) => index % 2 === 0,
                  },
                },
                yAxis: {
                  type: "value",
                  axisLabel: { color: axisLabelColor },
                  axisLine: { show: true, lineStyle: { color: axisStrokeColor } },
                  axisTick: { show: true, lineStyle: { color: axisStrokeColor } },
                  splitLine: { lineStyle: { color: gridColor } },
                },
                series: [
                  {
                    name: "Views",
                    type: "line",
                    smooth: true,
                    showSymbol: true,
                    symbol: "circle",
                    symbolSize: 4,
                    lineStyle: { width: 2 },
                    data: viewsData,
                  },
                  {
                    name: "UV",
                    type: "line",
                    smooth: true,
                    showSymbol: true,
                    symbol: "circle",
                    symbolSize: 4,
                    lineStyle: { width: 2 },
                    data: uvData,
                  },
                ],
              },
              { notMerge: true }
            );
          }
        }

        const shortLabel = (v, max = 18) => {
          const s = String(v || "");
          if (!s) return "—";
          if (s.length <= max) return s;
          return `${s.slice(0, Math.max(1, max - 3))}...`;
        };

        if (dataTrafficReferringEl) {
          chartDataTrafficReferring =
            window.echarts.getInstanceByDom(dataTrafficReferringEl) ||
            window.echarts.init(dataTrafficReferringEl);

          const traffic = dataVisitTraffic.value || {};
          const rows = Array.isArray(traffic.referringSites) ? traffic.referringSites : [];
          const items = rows.slice(0, 10);
          if (!items.length) {
            try {
              chartDataTrafficReferring.clear();
            } catch (e) {}
          } else {
            const yData = items.map((i) => String(i.site || "—"));
            const xData = items.map((i) => Number(i.views || 0));
            chartDataTrafficReferring.setOption(
              {
                color: [palette[0]],
                // Leave a bit more room for long y-axis labels.
                grid: { left: 100, right: 24, top: 16, bottom: 24, containLabel: true },
                tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
                xAxis: {
                  type: "value",
                  axisLabel: { color: axisLabelColor },
                  axisLine: { show: true, lineStyle: { color: axisStrokeColor } },
                  axisTick: { show: true, lineStyle: { color: axisStrokeColor } },
                  splitLine: { lineStyle: { color: gridColor } },
                },
                yAxis: {
                  type: "category",
                  data: yData,
                  axisLabel: {
                    color: axisLabelColor,
                    formatter: (v) => shortLabel(v, 16),
                  },
                  axisLine: { show: true, lineStyle: { color: axisStrokeColor } },
                  axisTick: { show: true, lineStyle: { color: axisStrokeColor } },
                },
                series: [
                  {
                    type: "bar",
                    data: xData,
                    barWidth: 12,
                    itemStyle: { borderRadius: [0, 6, 6, 0] },
                  },
                ],
              },
              { notMerge: true }
            );
          }
        }

        if (dataTrafficPopularEl) {
          chartDataTrafficPopular =
            window.echarts.getInstanceByDom(dataTrafficPopularEl) ||
            window.echarts.init(dataTrafficPopularEl);

          const traffic = dataVisitTraffic.value || {};
          const rows = Array.isArray(traffic.popularContent) ? traffic.popularContent : [];
          const items = rows.slice(0, 10);
          if (!items.length) {
            try {
              chartDataTrafficPopular.clear();
            } catch (e) {}
          } else {
            const yData = items.map((i) => String(i.title || i.uri || "—"));
            const xData = items.map((i) => Number(i.views || 0));
            chartDataTrafficPopular.setOption(
              {
                color: [palette[1]],
                // Leave a bit more room for long y-axis labels.
                grid: { left: 130, right: 24, top: 16, bottom: 24, containLabel: true },
                tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
                xAxis: {
                  type: "value",
                  axisLabel: { color: axisLabelColor },
                  axisLine: { show: true, lineStyle: { color: axisStrokeColor } },
                  axisTick: { show: true, lineStyle: { color: axisStrokeColor } },
                  splitLine: { lineStyle: { color: gridColor } },
                },
                yAxis: {
                  type: "category",
                  data: yData,
                  axisLabel: {
                    color: axisLabelColor,
                    formatter: (v) => shortLabel(v, 18),
                  },
                  axisLine: { show: true, lineStyle: { color: axisStrokeColor } },
                  axisTick: { show: true, lineStyle: { color: axisStrokeColor } },
                },
                series: [
                  {
                    type: "bar",
                    data: xData,
                    barWidth: 12,
                    itemStyle: { borderRadius: [0, 6, 6, 0] },
                  },
                ],
              },
              { notMerge: true }
            );
          }
        }

        if (publishEl) {
          chartPublish =
            window.echarts.getInstanceByDom(publishEl) ||
            window.echarts.init(publishEl);

          const xData = publishTrend.value.map((i) => String(i.date).slice(5));
          const postData = publishTrend.value.map((i) => Number(i.count || 0));
          const pageData = pageTrend.value.map((i) => Number(i.count || 0));

          chartPublish.setOption(
            {
              color: [palette[0], palette[1]],
              legend: {
                left: 0,
                top: 0,
                itemWidth: 10,
                itemHeight: 10,
                textStyle: { color: axisLabelColor, fontSize: 12 },
                data: ["博文", "页面"],
              },
              // Keep y-axis labels inside canvas (avoid being clipped on narrow cards).
              grid: { left: 44, right: 24, top: 36, bottom: 36, containLabel: true },
              tooltip: {
                trigger: "axis",
                axisPointer: { type: "cross" },
              },
              xAxis: {
                type: "category",
                boundaryGap: false,
                data: xData,
                axisLabel: {
                  color: axisLabelColor,
                  interval: (index) => index % 3 === 0,
                },
                axisLine: { lineStyle: { color: axisStrokeColor } },
                axisTick: {
                  show: true,
                  alignWithLabel: true,
                  lineStyle: { color: axisStrokeColor },
                  interval: (index) => index % 3 === 0,
                },
              },
              yAxis: {
                type: "value",
                axisLabel: { color: axisLabelColor },
                axisLine: { show: true, lineStyle: { color: axisStrokeColor } },
                axisTick: { show: true, lineStyle: { color: axisStrokeColor } },
                splitLine: { lineStyle: { color: gridColor } },
              },
              series: [
                {
                  name: "博文",
                  type: "line",
                  smooth: true,
                  showSymbol: true,
                  symbol: "circle",
                  symbolSize: 4,
                  lineStyle: { width: 2 },
                  data: postData,
                },
                {
                  name: "页面",
                  type: "line",
                  smooth: true,
                  showSymbol: true,
                  symbol: "circle",
                  symbolSize: 4,
                  lineStyle: { width: 2 },
                  data: pageData.length ? pageData : postData.map(() => 0),
                },
              ],
            },
            { notMerge: true }
          );
        }

        if (categoryEl) {
          chartCategory =
            window.echarts.getInstanceByDom(categoryEl) ||
            window.echarts.init(categoryEl);

          const data = categoryDistribution.value
            .slice(0, 10)
            .map((i) => ({ name: i.name, value: Number(i.count || 0) }));

          chartCategory.setOption(
            {
              color: palette,
              tooltip: {
                trigger: "item",
                formatter: (p) => {
                  const value = formatNumber(p.value);
                  const percent =
                    typeof p.percent === "number" ? `${p.percent.toFixed(0)}%` : "0%";
                  return `${p.name}<br/>${value} 篇 (${percent})`;
                },
              },
              legend: {
                orient: "vertical",
                right: 0,
                top: "middle",
                icon: "circle",
                itemWidth: 10,
                itemHeight: 10,
                textStyle: { color: axisLabelColor, fontSize: 12 },
              },
              series: [
                {
                  type: "pie",
                  radius: ["55%", "85%"],
                  center: ["38%", "50%"],
                  avoidLabelOverlap: true,
                  label: { show: false },
                  labelLine: { show: false },
                  itemStyle: { borderColor: "#fff", borderWidth: 2 },
                  data,
                },
              ],
            },
            { notMerge: true }
          );
        }

        if (commentEl) {
          chartComment =
            window.echarts.getInstanceByDom(commentEl) ||
            window.echarts.init(commentEl);

          chartComment.setOption(
            {
              color: ["#8884d8"], // mx-admin fixed color
              // Keep y-axis labels inside canvas (avoid being clipped on narrow cards).
              grid: { left: 44, right: 24, top: 24, bottom: 36, containLabel: true },
              tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
              xAxis: {
                type: "category",
                boundaryGap: false,
                data: commentActivity.value.map((i) => String(i.date).slice(5)),
                axisLabel: { color: axisLabelColor },
                axisLine: { lineStyle: { color: axisStrokeColor } },
                axisTick: { show: true, lineStyle: { color: axisStrokeColor } },
              },
              yAxis: {
                type: "value",
                axisLabel: { color: axisLabelColor },
                axisLine: { show: true, lineStyle: { color: axisStrokeColor } },
                axisTick: { show: true, lineStyle: { color: axisStrokeColor } },
                splitLine: { lineStyle: { color: gridColor } },
              },
              series: [
                {
                  name: "评论",
                  type: "line",
                  smooth: true,
                  showSymbol: false,
                  lineStyle: { width: 2, color: "#8884d8" },
                  areaStyle: { color: "#8884d8", opacity: 0.4 },
                  data: commentActivity.value.map((i) => Number(i.count || 0)),
                },
              ],
            },
            { notMerge: true }
          );
        }

        if (tagEl) {
          chartTag =
            window.echarts.getInstanceByDom(tagEl) || window.echarts.init(tagEl);

          const graph = tagGraph.value || {};
          const rawNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
          const rawLinks = Array.isArray(graph.links) ? graph.links : [];

          if (!rawNodes.length) {
            try {
              chartTag.clear();
            } catch (e) {}
          } else {
            const deg = new Map();
            const links = [];
            for (const l of rawLinks) {
              const source = l && l.source ? String(l.source) : "";
              const target = l && l.target ? String(l.target) : "";
              if (!source || !target) continue;
              links.push({ source, target });
              deg.set(source, (deg.get(source) || 0) + 1);
              deg.set(target, (deg.get(target) || 0) + 1);
            }

            const isTagNode = (n) =>
              (n && typeof n === "object" && String(n.kind || "") === "tag") ||
              Number(n && n.category) === 0;

            const tagFill = isDark ? "#e5e5e5" : "#171717";
            const tagText = isDark ? "#171717" : "#ffffff";
            const postFill = isDark ? "#737373" : "#a3a3a3";
            const edgeColor = gridColor;
            const nodeLabelColor = isDark ? "#e5e5e5" : "#171717";

            const nodes = rawNodes
              .map((n) => {
                const node = n && typeof n === "object" ? n : {};
                const id = String(node.id || "");
                if (!id) return null;

                const tag = isTagNode(node);
                const degree = deg.get(id) || 0;
                const symbolSize = tag
                  ? Math.min(46, 10 + Math.sqrt(Math.max(1, degree)) * 6)
                  : 10;

                const name = String(node.name || "");
                const short = String(node.short || "");

                return {
                  id,
                  cid: tag ? 0 : Number(node.cid || 0),
                  mid: tag ? Number(node.mid || 0) : 0,
                  name,
                  short,
                  category: tag ? 0 : 1,
                  symbol: "circle",
                  symbolSize,
                  draggable: true,
                  itemStyle: {
                    color: tag ? tagFill : postFill,
                    opacity: tag ? 0.92 : 0.72,
                  },
                  label: tag
                    ? {
                        show: true,
                        position: "bottom",
                        distance: 3,
                        color: nodeLabelColor,
                        fontSize: 12,
                        fontWeight: 600,
                      }
                    : { show: false },
                  emphasis: tag
                    ? undefined
                    : {
                        label: {
                          show: true,
                          position: "bottom",
                          distance: 3,
                          color: isDark ? "#ffffff" : "#171717",
                          backgroundColor: isDark
                            ? "rgba(0,0,0,0.65)"
                            : "rgba(255,255,255,0.92)",
                          borderRadius: 6,
                          padding: [4, 6],
                          width: 220,
                          overflow: "truncate",
                          formatter: (p) => (p && p.name ? p.name : ""),
                        },
                      },
                  value: tag ? Number(node.count || 0) : degree,
                };
              })
              .filter(Boolean);

            try {
              chartTag.setOption(
                {
                  tooltip: { show: false },
                  series: [
                    {
                      type: "graph",
                      layout: "force",
                      data: nodes,
                      links,
                      categories: [{ name: "标签" }, { name: "文章" }],
                      roam: true,
                      draggable: true,
                      lineStyle: { color: edgeColor, opacity: 0.35, width: 1 },
                      force: {
                        repulsion: 180,
                        edgeLength: [40, 140],
                        gravity: 0.08,
                      },
                      labelLayout: { hideOverlap: true },
                      emphasis: {
                        focus: "adjacency",
                        lineStyle: { width: 2, opacity: 0.9 },
                        label: {
                          show: true,
                          position: "bottom",
                          distance: 3,
                          color: isDark ? "#ffffff" : "#171717",
                          backgroundColor: isDark
                            ? "rgba(0,0,0,0.65)"
                            : "rgba(255,255,255,0.92)",
                          borderRadius: 6,
                          padding: [4, 6],
                          formatter: (p) => (p && p.name ? p.name : ""),
                        },
                      },
                      blur: {
                        lineStyle: { opacity: 0.08 },
                        itemStyle: { opacity: 0.2 },
                        label: { opacity: 0.2 },
                      },
                    },
                  ],
                },
                { notMerge: true }
              );

              chartTag.off("click");
              chartTag.on("click", (params) => {
                if (!params || params.dataType !== "node") return;
                const data =
                  params.data && typeof params.data === "object" ? params.data : {};
                if (Number(data.category) !== 1) return;

                let cid = Number(data.cid || 0);
                if (!cid) {
                  const id = String(data.id || "");
                  if (id.startsWith("p:")) cid = Number(id.slice(2)) || 0;
                }
                if (cid > 0) openPostEditor(cid);
              });
            } catch (e) {
              try {
                chartTag.clear();
              } catch (e2) {}
            }
          }
        }

        if (!resizeBound) {
          resizeBound = true;
          window.addEventListener("resize", () => {
            try {
              chartVisitWeek && chartVisitWeek.resize();
              chartPublish && chartPublish.resize();
              chartCategory && chartCategory.resize();
              chartComment && chartComment.resize();
              chartTag && chartTag.resize();
              chartDataTrafficTrend && chartDataTrafficTrend.resize();
              chartDataTrafficReferring && chartDataTrafficReferring.resize();
              chartDataTrafficPopular && chartDataTrafficPopular.resize();
            } catch (e) {}
          });
        }
      }

      function listenHash() {
        window.addEventListener("hashchange", () => {
          const desired = getRoute();
          const normalized = v3aNormalizeRoute(desired);
          if (normalized !== desired) {
            toastError("禁止访问");
            if (getRoute() !== normalized) setRoute(normalized);
            return;
          }

          route.value = normalized;
          const p = String(normalized || "/").split("?")[0] || "/";
          settingsOpen.value = p === "/settings";
          ensureExpandedForRoute(p);
          persistExpanded();
        });
      }

      watch(
        () => route.value,
        async (r) => {
          const p = String(r || "/").split("?")[0] || "/";
          v3aUpdateVditorToolbarStickyTop();

          if (p !== "/posts/write") {
            destroyPostVditor();
          }
          if (p !== "/pages/edit") {
            destroyPageVditor();
          }

          document.title = `${crumb.value} - Vue3Admin`;
          if (p === "/dashboard") {
            await nextTick();
            renderCharts();
          }
          if (p === "/posts/manage") {
            await fetchPosts();
          }
          if (p === "/posts/write") {
            await ensureUserOptionsLoaded();
            if (skipNextWriteLoad) {
              skipNextWriteLoad = false;
            } else {
              await loadPostEditorFromRoute();
            }
            await nextTick();
            initPostVditor();
            v3aUpdateVditorToolbarStickyTop();
          }
          if (p === "/files") {
            await fetchFiles();
          }
          if (p === "/friends") {
            await initFriendsFromRoute();
          }
          if (p === "/users") {
            await fetchUsers();
          }
          if (p === "/data") {
            await refreshData();
          }
          if (p === "/posts/taxonomy") {
            await fetchTaxonomy();
          }
          if (p === "/drafts") {
            await fetchDrafts();
          }
          if (p === "/comments") {
            await fetchComments();
          }
          if (p === "/pages/manage") {
            await fetchPages();
          }
          if (p === "/pages/edit") {
            if (skipNextPageLoad) {
              skipNextPageLoad = false;
            } else {
              await loadPageEditorFromRoute();
            }
            await nextTick();
            initPageVditor();
            v3aUpdateVditorToolbarStickyTop();
          }
          if (p === "/settings") {
            await fetchSettings();
            await maybeFetchSettingsExtras();
          }
          if (p === "/maintenance/backup") {
            await fetchBackups();
          }
          if (p === "/maintenance/upgrade") {
            await fetchUpgradeSettings();
            await fetchUpgradeInfo();
          }
          if (p === "/extras/workshop") {
            await fetchWorkshopProjects();
          }
          if (p === "/extras/shoutu") {
            await fetchShouTuTaStats();
            startShouTuTaPolling();
          } else {
            stopShouTuTaPolling();
          }
        }
      );

      watch(
        () => settingsActiveKey.value,
        async () => {
          await maybeFetchSettingsExtras();
        }
      );

      watch(
        () => themeSelected.value,
        async (v, prev) => {
          if (routePath.value !== "/settings") return;
          if (!isThemeSettingsActive.value) return;
          const next = String(v || "");
          const before = String(prev || "");
          if (next === before) return;

          themeFilesTheme.value = "";
          themeFiles.value = [];
          themeFile.value = "";
          themeFileContent.value = "";
          themeFileBase.value = null;
          themeFileWriteable.value = 0;

          themeConfigTheme.value = "";
          themeConfigExists.value = 0;
          themeConfigFields.value = [];
          for (const k of Object.keys(themeConfigForm)) {
            delete themeConfigForm[k];
          }
          themeConfigBase.value = null;
          themeConfigHtml.value = "";

          await maybeFetchSettingsExtras();
        }
      );

      watch(
        () => themeFile.value,
        async (v, prev) => {
          if (routePath.value !== "/settings") return;
          if (settingsActiveKey.value !== "theme.edit") return;
          const next = String(v || "");
          const before = String(prev || "");
          if (!next || next === before) return;
          await initThemeEditEditor();
          updateThemeEditEditorLanguage();
          await fetchThemeFile();
          updateThemeEditEditorEditable();
          updateThemeEditEditorContent();
        }
      );

      watch(
        () => themeFileContent.value,
        () => {
          if (routePath.value !== "/settings") return;
          if (settingsActiveKey.value !== "theme.edit") return;
          updateThemeEditEditorContent();
        }
      );

      watch(
        () => themeFileWriteable.value,
        () => {
          if (routePath.value !== "/settings") return;
          if (settingsActiveKey.value !== "theme.edit") return;
          updateThemeEditEditorEditable();
        }
      );

      watch(
        () => settingsActiveKey.value,
        async (v, prev) => {
          if (routePath.value !== "/settings") return;
          const next = String(v || "");
          const before = String(prev || "");
          if (next === before) return;
          if (next === "theme.edit") {
            await nextTick();
            await initThemeEditEditor();
            updateThemeEditEditorLanguage();
            updateThemeEditEditorEditable();
            updateThemeEditEditorContent();
          } else if (before === "theme.edit") {
            destroyThemeEditEditor();
          }
        }
      );

      onMounted(async () => {
        document.addEventListener("pointerdown", (event) => {
          const target = event?.target;
          const el = categorySelectEl.value;
          if (categorySelectOpen.value && el && target && !el.contains(target)) {
            categorySelectOpen.value = false;
          }
        });
        window.addEventListener("resize", v3aUpdateVditorToolbarStickyTop, {
          passive: true,
        });
        try {
          window.addEventListener("pagehide", () => beaconSavePostDraft("pagehide"));
          window.addEventListener("beforeunload", () => beaconSavePostDraft("unload"));
        } catch (e) {}

        listenHash();
        const desired = getRoute();
        const normalized = v3aNormalizeRoute(desired);
        route.value = normalized;
        if (normalized !== desired) {
          setRoute(normalized);
        }
        settingsOpen.value = routePath.value === "/settings";
        ensureExpandedForRoute(routePath.value);
        document.title = `${crumb.value} - Vue3Admin`;
        consumeLegacyNoticeCookies();
        await fetchDashboard();
        if (routePath.value === "/posts/manage") {
          await fetchPosts();
        }
        if (routePath.value === "/posts/write") {
          await ensureUserOptionsLoaded();
          await loadPostEditorFromRoute();
          await nextTick();
          initPostVditor();
          v3aUpdateVditorToolbarStickyTop();
        }
        if (routePath.value === "/files") {
          await fetchFiles();
        }
        if (routePath.value === "/friends") {
          await initFriendsFromRoute();
        }
        if (routePath.value === "/users") {
          await fetchUsers();
        }
        if (routePath.value === "/data") {
          await refreshData();
        }
        if (routePath.value === "/posts/taxonomy") {
          await fetchTaxonomy();
        }
        if (routePath.value === "/drafts") {
          await fetchDrafts();
        }
        if (routePath.value === "/comments") {
          await fetchComments();
        }
        if (routePath.value === "/pages/manage") {
          await fetchPages();
        }
        if (routePath.value === "/pages/edit") {
          await loadPageEditorFromRoute();
          await nextTick();
          initPageVditor();
          v3aUpdateVditorToolbarStickyTop();
        }
        if (routePath.value === "/settings") {
          await fetchSettings();
          await maybeFetchSettingsExtras();
        }
        if (routePath.value === "/maintenance/backup") {
          await fetchBackups();
        }
        if (routePath.value === "/maintenance/upgrade") {
          await fetchUpgradeSettings();
          await fetchUpgradeInfo();
        }
        if (routePath.value === "/extras/ai-translate" || routePath.value === "/extras/ai-summary") {
          ensureAiExtrasLang();
          await fetchAiExtrasContents();
          if (aiExtrasSelectedCid.value) {
            if (routePath.value === "/extras/ai-translate") await loadAiTranslation();
            else await loadAiSummary();
          }
        }
        if (routePath.value === "/extras/workshop") {
          await fetchWorkshopProjects();
        }
        if (routePath.value === "/extras/shoutu") {
          await fetchShouTuTaStats();
          startShouTuTaPolling();
        }
      });

      function handleMenuClick(item) {
        if (item.action === "openSettings") {
          openSettings();
          if (isNarrowScreen.value) {
            setMobileNavTab(1);
            return;
          }
          closeMobileNav();
          return;
        }

        if (item.children && item.children.length) {
          if (sidebarCollapsed.value && !isNarrowScreen.value) {
            handleSubMenuClick(item.children[0]);
            return;
          }
          toggleGroup(item.key);
          return;
        }

        if (item.to) {
          navTo(item.to);
          closeMobileNav();
        }
      }

      function badgeValue(item) {
        if (!item.badgeKey) return "";
        const n = Number(summary.value[item.badgeKey] || 0);
        return n > 0 ? String(n) : "";
      }

      // Toast bindings: replace legacy alert/card notices
      const toastErrorRefs = [
        dashboardError,
        postsError,
        postError,
        taxonomyError,
        commentsError,
        commentEditorError,
        pagesError,
        pageError,
        filesError,
        friendsError,
        settingsError,
        themesError,
        pluginsError,
      ];
      for (const r of toastErrorRefs) {
        watch(r, (v) => {
          if (v) toastError(v);
        });
      }

      const toastSuccessRefs = [postMessage, pageMessage, settingsMessage];
      for (const r of toastSuccessRefs) {
        watch(r, (v) => {
          if (v) toastSuccess(v);
        });
      }

      watch(
        () => Number(summary.value.commentsWaiting || 0),
        (n, prev) => {
          const count = Number(n || 0) || 0;
          const before = Number(prev || 0) || 0;
          if (count <= 0 || count <= before) return;

          toastInfo(`有${count}条评论需要审核`, {
            duration: 0,
            actionLabel: "查看",
            action: () => {
              commentsFilters.status = "waiting";
              commentsPagination.page = 1;
              if (routePath.value !== "/comments") {
                navTo("/comments");
              } else {
                applyCommentsFilters();
              }
            },
          });
        }
      );

      watch(
        () => Number(summary.value.friendLinkApply || 0),
        (n, prev) => {
          if (!v3aCan(v3aMenuAccessForPath("/friends"))) return;
          if (!v3aAclEnabled("friends.manage", true)) return;

          const count = Number(n || 0) || 0;
          const before = Number(prev || 0) || 0;
          if (count <= 0 || count <= before) return;

          toastInfo(`有${count}条友链申请需要审核`, {
            duration: 0,
            actionLabel: "查看",
            action: () => {
              const state = normalizeFriendsState(routeQuery.value?.state);
              if (routePath.value !== "/friends" || state !== 1) {
                navTo("/friends?state=1");
                return;
              }

              friendsPagination.page = 1;
              friendsPageJump.value = 1;
              fetchFriendsStateCount();
              fetchFriends();
            },
          });
        }
      );

      return {
        V3A,
        ICONS,
        MENU,
        menuItems,
        SETTINGS,
        settingsItems,
        jsonExample,
        jsonFieldEditorOpen,
        jsonFieldEditorError,
        jsonFieldEditorEl,
        openJsonFieldEditor,
        closeJsonFieldEditor,
        applyJsonFieldEditor,
        toasts,
        toastIcon,
        dismissToast,
        runToastAction,
        registerFlash,
        registerFlashOpen,
        closeRegisterFlash,
        route,
        routePath,
        routeQuery,
        crumb,
        crumbPath,
        crumbCurrent,
        aboutVersion,
        aboutBuildTime,
        aboutRepoUrl,
        aboutWebsiteUrl,
        aboutQqGroup,
        aboutSponsorUrl,
        aboutBadges,
        aboutChangelog,
        aboutThanks,
        themeToggleIcon,
        themeToggleTitle,
        cycleThemeMode,
        sidebarCollapsed,
        isNarrowScreen,
        mobileNavOpen,
        mobileNavTab,
        closeMobileNav,
        onMobileNavSwipeStart,
        onMobileNavSwipeEnd,
        onMobileNavSwipeCancel,
        sidebarToggleIcon,
        sidebarToggleTitle,
        mobileNavHasSettingsPanel,
        settingsOpen,
        settingsActiveKey,
        isThemeSettingsActive,
        settingsThemeOpen,
        writeSidebarOpen,
        expanded,
        summary,
        realtime,
        hotPosts,
        tagTop,
        tagGraph,
        systemInfo,
        recentPosts,
        recentComments,
        loadingDashboard,
        dashboardError,
        postsLoading,
        postsError,
        postsItems,
        postsFilters,
        postsPagination,
        postsSelectedCids,
        postsSelectedAll,
        postsSelectAllEl,
        postsPageJump,
        draftsKeywords,
        draftsScope,
        draftsPostsLoading,
        draftsPostsError,
        draftsPostsItems,
        draftsPostsPagination,
        draftsPostsPageJump,
        draftsPagesLoading,
        draftsPagesError,
        draftsPagesItems,
        draftsCountText,
        draftsActiveKey,
        draftsListItems,
        draftsActiveItem,
        draftsItemAt,
        draftsItemTitle,
        draftsOpenActiveDraft,
        draftsDeleteActiveDraft,
        draftsPreviewLoading,
        draftsPreviewError,
        draftsPreviewText,
        fetchDrafts,
        applyDraftsFilters,
        draftsPostsGoPage,
        getPostBadge,
        postStatusIcon,
        applyPostsFilters,
        postsGoPage,
        postsPickCategory,
        openPostEditor,
        deletePost,
        isPostSelected,
        togglePostSelection,
        togglePostsSelectAll,
        deleteSelectedPosts,
        updateSelectedPostsStatus,
        postLoading,
        postSaving,
        postError,
        postMessage,
        postCapabilities,
        postAutoSaveEnabled,
        postDraftSaveState,
        postDraftLastSavedAt,
        postDraftStatusText,
        postDraftTimeAgo,
        postForm,
        postDefaultFields,
        postSlugPrefix,
        postSlugSuffix,
        postSlugHasSlug,
        postSlugInputWidth,
        postTags,
        postTagInput,
        postTagEditorOpen,
        postTagFocused,
        postTagActiveIndex,
        postTextEl,
        postEditorType,
        aiPolishAvailable,
        aiSlugAvailable,
        aiSlugLoading,
        generateAiSlugForPost,
        generateAiSlugForPage,
        aiPolishModalOpen,
        aiPolishLoading,
        aiPolishError,
        aiPolishModel,
        aiPolishText,
        aiPolishPreviewEl,
        openAiPolishModal,
        closeAiPolishModal,
        applyAiPolishReplace,
        autoSizePostText,
        addPostTag,
        removePostTag,
        postTagInputEl,
        postTagSuggestions,
        onPostTagFocus,
        onPostTagBlur,
        onPostTagKeydown,
        selectTagSuggestion,
        openPostTagEditor,
        categorySelectOpen,
        categorySelectEl,
        postSelectedCategories,
        toggleCategorySelect,
        isPostCategorySelected,
        togglePostCategory,
        removePostCategory,
        setPostCategoriesFromText,
        addPostField,
        removePostField,
        submitPost,
        filesLoading,
        filesError,
        filesUploading,
        filesKeywords,
        filesItems,
        filesPagination,
        applyFilesFilters,
        filesGoPage,
        uploadFiles,
        deleteFile,
        openFile,
        filePreviewOpen,
        filePreviewItem,
        filePreviewUrl,
        filePreviewIsImage,
        filePreviewIsVideo,
        openFilePreview,
        closeFilePreview,
        filesSelectMode,
        filesSelectedIds,
        toggleFilesSelectMode,
        isFileSelected,
        toggleFileSelected,
        onFileItemActivate,
        deleteSelectedFiles,
        refreshFiles,
        friendsLoading,
        friendsError,
        friendsItems,
        friendsPagination,
        friendsPageJump,
        friendsState,
        friendsStateCount,
        friendsHealth,
        friendsHealthChecking,
        friendsMigrateWorking,
        setFriendsState,
        friendsGoPage,
        friendTypeLabel,
        friendInitial,
        checkFriendsHealth,
        migrateFriendAvatars,
        friendsSettingsOpen,
        friendsSettingsLoading,
        friendsSettingsSaving,
        friendsSettingsError,
        friendsSettingsForm,
        openFriendsSettings,
        closeFriendsSettings,
        saveFriendsSettings,
        friendEditorOpen,
        friendEditorSaving,
        friendEditorError,
        friendEditorForm,
        openFriendEditor,
        closeFriendEditor,
        submitFriendEditor,
        deleteFriend,
        deleteFriendApply,
        auditFriendApply,
        dataVisitLoading,
        dataVisitError,
        dataVisitItems,
        dataVisitTraffic,
        dataVisitFilters,
        dataVisitPagination,
        dataVisitPageJump,
        dataDeviceTone,
        applyDataVisitFilters,
        dataVisitGoPage,
        refreshData,
        backupLoading,
        backupWorking,
        backupError,
        backupDir,
        backupItems,
        backupRestoreMode,
        backupUploadEl,
        backupUploadFile,
        formatBytes,
        fetchBackups,
        exportBackup,
        downloadBackup,
        deleteBackup,
        restoreBackupFromServer,
        onBackupUploadChange,
        restoreBackupFromUpload,
        v3aDataModalOpen,
        v3aDataWorking,
        v3aDataImportEl,
        v3aDataImportFile,
        v3aDataExportFile,
        openV3aDataModal,
        closeV3aDataModal,
        onV3aDataImportChange,
        importV3aData,
        exportV3aData,
        v3aLegacyModalOpen,
        v3aLegacyWorking,
        openV3aLegacyModal,
        closeV3aLegacyModal,
        runV3aLegacyMaintenance,
        upgradeLoading,
        upgradeWorking,
        upgradeError,
        upgradeCurrent,
        upgradeLatest,
        upgradeReleases,
        upgradeUpdateAvailable,
        upgradeLatestCommit,
        upgradeStrictUpdateAvailable,
        upgradeConfirmOpen,
        upgradeModeLabel,
        upgradeReplaceLabel,
        upgradeSettingsOpen,
        upgradeSettingsLoading,
        upgradeSettingsSaving,
        upgradeSettingsForm,
        fetchUpgradeInfo,
        isoToTs,
        openExternal,
        runUpgrade,
        openUpgradeConfirm,
        closeUpgradeConfirm,
        confirmUpgrade,
        openUpgradeSettings,
        closeUpgradeSettings,
        saveUpgradeSettings,
        usersLoading,
        usersError,
        usersItems,
        usersFilters,
        usersPagination,
        usersSelectedUids,
        usersSelectedAll,
        usersSelectAllEl,
        usersPageJump,
        userGroupLabel,
        userGroupTone,
        applyUsersFilters,
        usersGoPage,
        deleteSelectedUsers,
        userEditorOpen,
        userEditorSaving,
        userEditorError,
        userEditorForm,
        openUserEditor,
        closeUserEditor,
        saveUserEditor,
        deleteUser,
        isUserSelected,
        toggleUserSelection,
        toggleUsersSelectAll,
        filesUploadModalOpen,
        filesUploadDragging,
        filesUploadInputEl,
        openFilesUploadModal,
        closeFilesUploadModal,
        onFilesUploadDrop,
        onFilesUploadInputChange,
        fileTitleFor,
        fileMetaFor,
        fileUrlFor,
        isFileImage,
        isFileVideo,
        copyText,
        taxonomyLoading,
        taxonomySaving,
        taxonomyError,
        categoriesAll,
        defaultCategoryId,
        tagsAll,
        categoryEditorOpen,
        tagEditorOpen,
        categoryNameEl,
        tagNameEl,
        categoryNameError,
        tagNameError,
        categoryForm,
        tagForm,
        fetchTaxonomy,
        openCategoryEditor,
        closeCategoryEditor,
        saveCategory,
        deleteCategory,
        setDefaultCategory,
        openTagEditor,
        closeTagEditor,
        saveTag,
        deleteTag,
        commentsLoading,
        commentsError,
        commentsItems,
        commentsFilters,
        commentsPagination,
        commentsSplitLeftWidth,
        startCommentsSplitResize,
        getCommentBadge,
        applyCommentsFilters,
        commentsGoPage,
        quickSetCommentsStatus,
        aiExtrasContentType,
        aiExtrasKeywords,
        aiExtrasLoading,
        aiExtrasError,
        aiExtrasItems,
        aiExtrasPagination,
        aiExtrasSplitLeftWidth,
        startAiExtrasSplitResize,
        aiExtrasPageJump,
        aiExtrasSelectedCid,
        aiExtrasLang,
        aiExtrasLanguageOptions,
        fetchAiExtrasContents,
        aiExtrasApplyFilters,
        aiExtrasGoPage,
        selectAiExtrasContent,
        openAiExtrasEditor,
        aiTranslateLoading,
        aiTranslateGenerating,
        aiTranslateSaving,
        aiTranslateError,
        aiTranslateItem,
        aiTranslateForm,
        aiTranslateDirty,
        aiTranslatePreviewEl,
        loadAiTranslation,
        generateAiTranslation,
        saveAiTranslation,
        aiSummaryLoading,
        aiSummaryGenerating,
        aiSummarySaving,
        aiSummaryError,
        aiSummaryItem,
        aiSummaryForm,
        aiSummaryDirty,
        aiSummaryPreviewEl,
        loadAiSummary,
        generateAiSummary,
        saveAiSummary,
        commentEditorOpen,
        commentEditorLoading,
        commentEditorSaving,
        commentEditorError,
        commentEditorPost,
        commentForm,
        commentReplyText,
        commentReplyEl,
        commentReplyEmojiOpen,
        commentReplyEmojis,
        toggleCommentReplyEmoji,
        insertCommentReplyEmoji,
        onCommentReplyKeyDown,
        commentDetailPostUrl,
        commentDetailAuthorUrl,
        commentDetailDeviceLabel,
        commentDetailDeviceIcon,
        openCommentEditor,
        closeCommentEditor,
        saveCommentEdit,
        submitCommentReply,
        markComment,
        deleteComment,
        pagesLoading,
        pagesError,
        pagesItems,
        pagesFilters,
        getPageBadge,
        applyPagesFilters,
        openPageEditor,
        deletePage,
        pageLoading,
        pageSaving,
        pageError,
        pageMessage,
        pageCapabilities,
        pageTemplates,
        pageParentOptions,
        pageForm,
        pageDefaultFields,
        pageSlugPrefix,
        pageSlugSuffix,
        pageSlugHasSlug,
        pageSlugInputWidth,
        pageTextEl,
        pageEditorType,
        autoSizePageText,
        addPageField,
        removePageField,
        submitPage,
        settingsLoading,
        settingsSaving,
        settingsBatchSaving,
        settingsError,
        settingsMessage,
        settingsDirtyCount,
        settingsData,
        settingsProfileForm,
        settingsUserOptionsForm,
        settingsPasswordForm,
        settingsSiteForm,
        settingsSiteXmlRpcEnabled,
        settingsStorageForm,
        settingsReadingForm,
        settingsDiscussionForm,
        settingsNotifyForm,
        settingsAiForm,
        settingsNotifyTesting,
        settingsNotifyTemplateEditorOpen,
        settingsNotifyTemplateKind,
        settingsNotifyTemplateDraft,
        settingsNotifyTemplatePreviewHtml,
        settingsNotifyCommentWaitingTemplatePreviewHtml,
        settingsNotifyCommentReplyTemplatePreviewHtml,
        settingsNotifyFriendLinkTemplatePreviewHtml,
        settingsNotifyFriendLinkAuditPassTemplatePreviewHtml,
        settingsNotifyFriendLinkAuditRejectTemplatePreviewHtml,
        settingsPermalinkForm,
        settingsPermalinkRewriteError,
        settingsPermalinkEnableRewriteAnyway,
        permalinkPostPatternOptions,
        settingsAclLoading,
        settingsAclLoaded,
        settingsAclGroup,
        settingsAclGroupLevel,
        settingsAclForm,
        fetchSettings,
        fetchSettingsAcl,
        saveSettingsProfile,
        saveSettingsUserOptions,
        saveSettingsPassword,
        saveSettingsSite,
        saveSettingsStorage,
        saveSettingsReading,
        saveSettingsDiscussion,
        saveSettingsNotify,
        testSettingsNotify,
        openSettingsNotifyTemplateEditor,
        closeSettingsNotifyTemplateEditor,
        applySettingsNotifyTemplateDraft,
        notifyTemplateStyles,
        applySettingsNotifyTemplateStyle,
        saveSettingsPermalink,
        saveSettingsAcl,
        saveSettingsAll,
        themesLoading,
        themesError,
        themesItems,
        themeCurrent,
        themeSelected,
        themeActivating,
        themeFilesLoading,
        themeFilesTheme,
        themeFiles,
        themeEditSearch,
        themeEditTreeOpen,
        themeEditLeftWidth,
        themeEditFilesFiltered,
        themeFile,
        themeFileLoading,
        themeFileContent,
        themeFileWriteable,
        themeFileSaving,
        themeFileDirty,
        saveThemeFile,
        themeEditEditorEl,
        themeEditEditorFailed,
        toggleThemeEditTree,
        openThemeEditFile,
        startThemeEditResize,
        themeConfigLoading,
        themeConfigExists,
        themeConfigFields,
        themeConfigForm,
        themeConfigDirty,
        themeConfigSaving,
        themeConfigHtml,
        themeConfigLegacyUrl,
        themeConfigIframe,
        resizeThemeConfigIframe,
        v3aSimpleLinkHtml,
        pluginsLoading,
        pluginsError,
        pluginsActivated,
        pluginsInactive,
        pluginsActing,
        pluginConfigOpen,
        pluginConfigLoading,
        pluginConfigSaving,
        pluginConfigName,
        pluginConfigTitle,
        pluginConfigExists,
        pluginConfigHtml,
        pluginConfigLegacyEl,
        savePluginConfig,
        fetchThemes,
        handleThemeRowClick,
        activateTheme,
        fetchThemeFiles,
        fetchThemeFile,
        saveThemeFile,
        fetchThemeConfig,
        saveThemeConfig,
        fetchPlugins,
        openPluginConfig,
        closePluginConfig,
        activatePlugin,
        deactivatePlugin,
        username,
        userInitial,
        formatNumber,
        formatTime,
        formatTimeAgo,
        isActive,
        isSubMenuItemActive,
        isMenuItemActive,
        handleSubMenuClick,
        toggleSidebar,
        frontendUrl,
        openDashboardTour,
        logout,
        tourOpen,
        tourSteps,
        tourStepIndex,
        tourIsLast,
        tourTitle,
        tourDescription,
        tourSpotlightStyle,
        tourBubbleStyle,
        tourBubbleEl,
        tourPrev,
        tourNext,
        tourSkip,
        tourFinish,
        toggleWriteSidebar,
        permissionInfoOpen,
        openPermissionInfo,
        closePermissionInfo,
        handleMenuClick,
        navTo,
        openSettings,
        selectSettings,
        toggleThemeSettings,
        badgeValue,
        fetchDashboard,
        extrasPanelIframe,
        extrasPanelUrl,
        onExtrasPanelIframeLoad,
        reloadExtrasPanelIframe,
        workshopRepoUrl,
        workshopListUrl,
        workshopLoginUrl,
        workshopLoading,
        workshopError,
        workshopItems,
        workshopMeta,
        workshopInstallingId,
        workshopSearch,
        workshopTypeFilter,
        workshopFilteredItems,
        applyWorkshopFilters,
        fetchWorkshopProjects,
        installWorkshopProject,
        workshopTypeLabel,
        workshopTypeTone,
        workshopTypechoText,
        shouTuTaEnabled,
        shouTuTaLoading,
        shouTuTaError,
        shouTuTaStats,
        shouTuTaLists,
        shouTuTaBanLog,
        shouTuTaGlobalWhitelist,
        shouTuTaCidrItems,
        shouTuTaUpdatedAt,
        shouTuTaAnalyticsEnabled,
        shouTuTaAnalyticsAvailable,
        shouTuTaVisitToday,
        shouTuTaVisitYesterday,
        shouTuTaTopPages,
        shouTuTaTopIps,
        shouTuTaTrend24h,
        shouTuTaTrendMax,
        shouTuTaLogs,
        shouTuTaLastId,
        shouTuTaThreatTop,
        shouTuTaActing,
        shouTuTaStreamPaused,
        shouTuTaIpQuery,
        shouTuTaPurgeIpInput,
        shouTuTaIpModalOpen,
        shouTuTaIpModalIp,
        shouTuTaIpModalLoading,
        shouTuTaIpModalLogs,
        shouTuTaIpModalAbuse,
        shouTuTaIpModalAbuseLoading,
        shouTuTaGlobalWhitelistOpen,
        shouTuTaGlobalWhitelistForm,
        shouTuTaCidrOpen,
        shouTuTaCidrList,
        fetchShouTuTaStats,
        fetchShouTuTaLogsSince,
        openShouTuTaIpModal,
        closeShouTuTaIpModal,
        shouTuTaCheckAbuseIpdb,
        shouTuTaUnblock,
        shouTuTaWhitelistAdd,
        shouTuTaPermBan,
        openShouTuTaGlobalWhitelist,
        closeShouTuTaGlobalWhitelist,
        submitShouTuTaGlobalWhitelist,
        openShouTuTaCidr,
        closeShouTuTaCidr,
        submitShouTuTaCidr,
        submitShouTuTaIpQuery,
        toggleShouTuTaStream,
        shouTuTaStatusTone,
        shouTuTaStatusText,
        shouTuTaGlobalWhitelistRemove,
        shouTuTaPurgeIp,
        openShouTuTaSettings,
      };
    },
      template: `
       <div class="v3a-app">
        <div v-if="isNarrowScreen && mobileNavOpen" class="v3a-mobile-nav-mask" @click="closeMobileNav()"></div>
        <aside class="v3a-sidebar" data-tour="sidebar" :class="{ collapsed: sidebarCollapsed && !isNarrowScreen, open: isNarrowScreen && mobileNavOpen }">
          <div v-if="isNarrowScreen" class="v3a-mobile-nav-handle" @click="closeMobileNav()" role="button" aria-label="收起菜单">
            <div class="v3a-mobile-nav-handle-bar"></div>
          </div>
           <nav
             class="v3a-menu"
            :class="{ 'v3a-menu--swipe': mobileNavHasSettingsPanel }"
             @touchstart="onMobileNavSwipeStart"
             @touchend="onMobileNavSwipeEnd"
             @touchcancel="onMobileNavSwipeCancel"
           >
            <div class="v3a-menu-swipe" :style="{ transform: mobileNavHasSettingsPanel ? 'translate3d(-' + (mobileNavTab * 100) + '%,0,0)' : '' }">
              <div class="v3a-menu-panel v3a-menu-panel--main">
                <div v-for="item in menuItems" :key="item.key">
                  <div
                      class="v3a-menu-item"
                      :data-tour="'menu-' + item.key"
                      :class="{ active: isMenuItemActive(item) }"
                      @click="handleMenuClick(item)"
                    >
                    <div class="v3a-menu-left">
                      <span class="v3a-icon" v-html="ICONS[item.icon]"></span>
                      <span class="v3a-menu-label" v-show="isNarrowScreen || !sidebarCollapsed">{{ item.label }}</span>
                    </div>
                    <span class="v3a-menu-right" v-show="isNarrowScreen || !sidebarCollapsed">
                      <span class="v3a-badge" v-if="badgeValue(item)">{{ badgeValue(item) }}</span>
                      <span v-if="item.children" class="v3a-chev" :class="{ open: expanded[item.key] }">
                        <span class="v3a-icon" v-html="ICONS.chevron"></span>
                      </span>
                    </span>
                  </div>

                  <div class="v3a-sub" v-if="item.children" v-show="expanded[item.key] && (isNarrowScreen || !sidebarCollapsed)">
                    <div
                      class="v3a-subitem"
                      v-for="child in item.children"
                      :key="child.key"
                      :data-tour="'submenu-' + child.key"
                      :class="{ active: isSubMenuItemActive(child) }"
                      @click="handleSubMenuClick(child)"
                    >
                      {{ child.label }}
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="mobileNavHasSettingsPanel" class="v3a-menu-panel v3a-menu-panel--settings">
                <div class="v3a-subsidebar-bd">
                  <template v-for="s in settingsItems" :key="s.key">
                    <template v-if="s.key === 'theme'">
                      <button
                        class="v3a-subsidebar-item"
                        :class="{ active: isThemeSettingsActive }"
                        type="button"
                        @click="toggleThemeSettings"
                      >
                        <div class="v3a-subsidebar-item-icon" :class="{ active: isThemeSettingsActive }">
                          <span class="v3a-icon" v-html="ICONS[s.icon] || ICONS.settings"></span>
                        </div>
                        <div class="v3a-subsidebar-item-text">
                          <div class="v3a-subsidebar-item-title">{{ s.label }}</div>
                          <div class="v3a-subsidebar-item-subtitle">{{ s.subtitle }}</div>
                        </div>
                        <span class="v3a-chev" :class="{ open: settingsThemeOpen }">
                          <span class="v3a-icon" v-html="ICONS.chevron"></span>
                        </span>
                      </button>

                      <div class="v3a-subsidebar-sub" v-show="settingsThemeOpen">
                        <button
                          class="v3a-subsidebar-subitem"
                          v-for="child in s.children"
                          :key="child.key"
                          :class="{ active: settingsActiveKey === child.key }"
                          type="button"
                          @click="selectSettings(child.key); closeMobileNav();"
                        >
                          {{ child.label }}
                        </button>
                      </div>
                    </template>

                    <button
                      v-else
                      class="v3a-subsidebar-item"
                      :class="{ active: settingsActiveKey === s.key }"
                      type="button"
                      @click="selectSettings(s.key); closeMobileNav();"
                    >
                      <div class="v3a-subsidebar-item-icon" :class="{ active: settingsActiveKey === s.key }">
                        <span class="v3a-icon" v-html="ICONS[s.icon] || ICONS.settings"></span>
                      </div>
                      <div class="v3a-subsidebar-item-text">
                        <div class="v3a-subsidebar-item-title">{{ s.label }}</div>
                        <div class="v3a-subsidebar-item-subtitle">{{ s.subtitle }}</div>
                      </div>
                    </button>
                  </template>
                </div>
              </div>
            </div>
          </nav>
          <div class="v3a-sidebar-footer">
            <button class="v3a-actionbtn v3a-theme-toggle-btn" type="button" :title="themeToggleTitle" @click="cycleThemeMode()">
              <span class="v3a-icon" v-html="themeToggleIcon"></span>
            </button>
          </div>
        </aside>

        <aside class="v3a-subsidebar" v-show="settingsOpen && !sidebarCollapsed && !isNarrowScreen" data-tour="settings-nav">
          <div class="v3a-subsidebar-bd">
            <template v-for="s in settingsItems" :key="s.key">
              <template v-if="s.key === 'theme'">
                <button
                  class="v3a-subsidebar-item"
                  :class="{ active: isThemeSettingsActive }"
                  type="button"
                  @click="toggleThemeSettings"
                >
                  <div class="v3a-subsidebar-item-icon" :class="{ active: isThemeSettingsActive }">
                    <span class="v3a-icon" v-html="ICONS[s.icon] || ICONS.settings"></span>
                  </div>
                  <div class="v3a-subsidebar-item-text">
                    <div class="v3a-subsidebar-item-title">{{ s.label }}</div>
                    <div class="v3a-subsidebar-item-subtitle">{{ s.subtitle }}</div>
                  </div>
                  <span class="v3a-chev" :class="{ open: settingsThemeOpen }">
                    <span class="v3a-icon" v-html="ICONS.chevron"></span>
                  </span>
                </button>

                <div class="v3a-subsidebar-sub" v-show="settingsThemeOpen">
                  <button
                    class="v3a-subsidebar-subitem"
                    v-for="child in s.children"
                    :key="child.key"
                    :class="{ active: settingsActiveKey === child.key }"
                    type="button"
                    @click="selectSettings(child.key)"
                  >
                    {{ child.label }}
                  </button>
                </div>
              </template>

              <button
                v-else
                class="v3a-subsidebar-item"
                :class="{ active: settingsActiveKey === s.key }"
                type="button"
                @click="selectSettings(s.key)"
              >
                <div class="v3a-subsidebar-item-icon" :class="{ active: settingsActiveKey === s.key }">
                  <span class="v3a-icon" v-html="ICONS[s.icon] || ICONS.settings"></span>
                </div>
                <div class="v3a-subsidebar-item-text">
                  <div class="v3a-subsidebar-item-title">{{ s.label }}</div>
                  <div class="v3a-subsidebar-item-subtitle">{{ s.subtitle }}</div>
                </div>
              </button>
            </template>
          </div>
        </aside>

        <main class="v3a-main">
          <section class="v3a-content">
            <template v-if="routePath === '/dashboard'">
              <div class="v3a-container">
                <div class="v3a-dash-head">
                  <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarToggleTitle">
                    <span class="v3a-icon" v-html="sidebarToggleIcon"></span>
                  </button>
                  <div class="v3a-dash-title">欢迎回来</div>
                  <div class="v3a-posts-actions v3a-dash-actions" data-tour="dash-actions">
                    <button class="v3a-actionbtn" type="button" title="使用教程" @click="openDashboardTour()">
                      <span class="v3a-icon" v-html="ICONS.info"></span>
                    </button>
                    <a class="v3a-actionbtn" :href="frontendUrl" target="_blank" rel="noreferrer" title="进入前台">
                      <span class="v3a-icon" v-html="ICONS.home"></span>
                    </a>
                    <button class="v3a-actionbtn danger" type="button" title="退出登录" @click="logout()">
                      <span class="v3a-icon" v-html="ICONS.logout"></span>
                    </button>
                  </div>
                </div>

                <div class="v3a-section" data-tour="dash-realtime">
                  <div class="v3a-section-hd">
                    <div class="v3a-section-title">实时数据</div>
                  </div>
                  <div class="v3a-section-line"></div>

                  <div class="v3a-realtime-grid">
                    <div class="v3a-realtime-card">
                      <div class="v3a-realtime-icon online">
                        <span class="dot"></span>
                        <span class="v3a-icon" v-html="ICONS.activity"></span>
                      </div>
                      <div class="v3a-realtime-meta">
                        <div class="v3a-realtime-value">{{ formatNumber(realtime.onlineNow) }}</div>
                        <div class="v3a-realtime-label">当前在线访客</div>
                      </div>
                    </div>

                    <div class="v3a-realtime-card">
                      <div class="v3a-realtime-icon">
                        <span class="v3a-icon" v-html="ICONS.user"></span>
                      </div>
                      <div class="v3a-realtime-meta">
                        <div class="v3a-realtime-value">{{ formatNumber(realtime.todayVisitors) }}</div>
                        <div class="v3a-realtime-label">今日访客</div>
                      </div>
                    </div>

                    <div class="v3a-realtime-card">
                      <div class="v3a-realtime-icon">
                        <span class="v3a-icon" v-html="ICONS.trending"></span>
                      </div>
                      <div class="v3a-realtime-meta">
                        <div class="v3a-realtime-value">{{ formatNumber(realtime.todayMaxOnline) }}</div>
                        <div class="v3a-realtime-label">今日最高在线</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="v3a-section" data-tour="dash-quick">
                  <div class="v3a-section-hd">
                    <div class="v3a-section-title">快速操作</div>
                  </div>
                  <div class="v3a-section-line"></div>

                  <div class="v3a-quick-grid">
                    <div class="v3a-quick-item">
                      <div class="v3a-quick-top">
                        <div class="v3a-quick-name">博文</div>
                        <span class="v3a-quick-icon" v-html="ICONS.posts"></span>
                      </div>
                      <div class="v3a-quick-count">{{ formatNumber(summary.posts) }}</div>
                      <div class="v3a-quick-btns">
                        <button class="v3a-mini-btn primary" type="button" @click="navTo('/posts/write')">撰写</button>
                        <button class="v3a-mini-btn" type="button" @click="navTo('/posts/manage')">管理</button>
                      </div>
                    </div>

                    <div class="v3a-quick-item">
                      <div class="v3a-quick-top">
                        <div class="v3a-quick-name">页面</div>
                        <span class="v3a-quick-icon" v-html="ICONS.pages"></span>
                      </div>
                      <div class="v3a-quick-count">{{ formatNumber(summary.pages) }}</div>
                      <div class="v3a-quick-btns">
                        <button class="v3a-mini-btn primary" type="button" @click="navTo('/pages/edit')">新建</button>
                        <button class="v3a-mini-btn" type="button" @click="navTo('/pages/manage')">管理</button>
                      </div>
                    </div>

                    <div class="v3a-quick-item">
                      <div class="v3a-quick-top">
                        <div class="v3a-quick-name">评论</div>
                        <span class="v3a-quick-icon" v-html="ICONS.comments"></span>
                      </div>
                      <div class="v3a-quick-count">{{ formatNumber(summary.commentsWaiting) }}</div>
                      <div class="v3a-quick-btns">
                        <button class="v3a-mini-btn primary" type="button" @click="navTo('/comments')">审核</button>
                        <button class="v3a-mini-btn" type="button" @click="navTo('/comments')">管理</button>
                      </div>
                    </div>

                    <div class="v3a-quick-item">
                      <div class="v3a-quick-top">
                        <div class="v3a-quick-name">友链</div>
                        <span class="v3a-quick-icon" v-html="ICONS.link"></span>
                      </div>
                      <div class="v3a-quick-count">{{ formatNumber(summary.friendLinks) }}</div>
                      <div class="v3a-quick-btns">
                        <button class="v3a-mini-btn primary" type="button" @click="navTo('/friends?new=1')">新增</button>
                        <button class="v3a-mini-btn" type="button" @click="navTo('/friends')">管理</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="v3a-section" data-tour="dash-metrics">
                  <div class="v3a-section-hd split">
                    <div class="v3a-section-title">数据统计</div>
                    <div class="v3a-section-tools">
                      <span class="v3a-muted">更新于 {{ formatTime(systemInfo.serverTime, settingsData.site.timezone) }}</span>
                      <button class="v3a-iconbtn" type="button" @click="fetchDashboard()" title="刷新">
                        <span class="v3a-icon" v-html="ICONS.refresh"></span>
                      </button>
                    </div>
                  </div>
                  <div class="v3a-section-line"></div>

                  <div class="v3a-metric-grid">
                    <div class="v3a-metric-item" @click="navTo('/pages/manage')">
                      <span class="v3a-metric-icon" v-html="ICONS.pages"></span>
                      <div class="v3a-metric-meta">
                        <div class="v3a-metric-label">页面</div>
                        <div class="v3a-metric-value">{{ formatNumber(summary.pages) }}</div>
                      </div>
                    </div>
                    <div class="v3a-metric-item" @click="navTo('/posts/taxonomy')">
                      <span class="v3a-metric-icon" v-html="ICONS.tag"></span>
                      <div class="v3a-metric-meta">
                        <div class="v3a-metric-label">分类</div>
                        <div class="v3a-metric-value">{{ formatNumber(summary.categories) }}</div>
                      </div>
                    </div>
                    <div class="v3a-metric-item" @click="navTo('/comments')">
                      <span class="v3a-metric-icon" v-html="ICONS.comments"></span>
                      <div class="v3a-metric-meta">
                        <div class="v3a-metric-label">全部评论</div>
                        <div class="v3a-metric-value">{{ formatNumber(summary.comments) }}</div>
                      </div>
                    </div>
                    <div class="v3a-metric-item" @click="navTo('/comments')">
                      <span class="v3a-metric-icon" v-html="ICONS.comments"></span>
                      <div class="v3a-metric-meta">
                        <div class="v3a-metric-label">未读评论</div>
                        <div class="v3a-metric-value">{{ formatNumber(summary.commentsWaiting) }}</div>
                      </div>
                    </div>
                    <div class="v3a-metric-item" @click="navTo('/friends')">
                      <span class="v3a-metric-icon" v-html="ICONS.link"></span>
                      <div class="v3a-metric-meta">
                        <div class="v3a-metric-label">友链</div>
                        <div class="v3a-metric-value">{{ formatNumber(summary.friendLinks) }}</div>
                      </div>
                    </div>
                    <div class="v3a-metric-item" @click="navTo('/friends?state=1')">
                      <span class="v3a-metric-icon" v-html="ICONS.link"></span>
                      <div class="v3a-metric-meta">
                        <div class="v3a-metric-label">友链申请</div>
                        <div class="v3a-metric-value">{{ formatNumber(summary.friendLinkApply) }}</div>
                      </div>
                    </div>

                    <div class="v3a-metric-item" @click="navTo('/data')">
                      <span class="v3a-metric-icon" v-html="ICONS.data"></span>
                      <div class="v3a-metric-meta">
                        <div class="v3a-metric-label">API 调用</div>
                        <div class="v3a-metric-value">{{ formatNumber(summary.apiCalls) }}</div>
                      </div>
                    </div>
                    <div class="v3a-metric-item" @click="navTo('/data')">
                      <span class="v3a-metric-icon" v-html="ICONS.user"></span>
                      <div class="v3a-metric-meta">
                        <div class="v3a-metric-label">今日 IP 访问</div>
                        <div class="v3a-metric-value">{{ formatNumber(summary.todayUv) }}</div>
                      </div>
                    </div>
                    <div class="v3a-metric-item" @click="navTo('/data')">
                      <span class="v3a-metric-icon" v-html="ICONS.posts"></span>
                      <div class="v3a-metric-meta">
                        <div class="v3a-metric-label">全站字符数</div>
                        <div class="v3a-metric-value">{{ formatNumber(summary.totalChars) }}</div>
                      </div>
                    </div>
                    <div class="v3a-metric-item" @click="navTo('/data')">
                      <span class="v3a-metric-icon" v-html="ICONS.eye"></span>
                      <div class="v3a-metric-meta">
                        <div class="v3a-metric-label">总阅读量</div>
                        <div class="v3a-metric-value">{{ formatNumber(summary.visitPv) }}</div>
                      </div>
                    </div>
                    <div class="v3a-metric-item" @click="navTo('/data')">
                      <span class="v3a-metric-icon" v-html="ICONS.heart"></span>
                      <div class="v3a-metric-meta">
                        <div class="v3a-metric-label">文章点赞</div>
                        <div class="v3a-metric-value">{{ formatNumber(summary.postLikes) }}</div>
                      </div>
                    </div>
                    <div class="v3a-metric-item" @click="navTo('/data')">
                      <span class="v3a-metric-icon" v-html="ICONS.heart"></span>
                      <div class="v3a-metric-meta">
                        <div class="v3a-metric-label">站点点赞</div>
                        <div class="v3a-metric-value">{{ formatNumber(summary.siteLikes) }}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="v3a-section">
                  <div class="v3a-section-hd">
                    <div class="v3a-section-title">数据图表</div>
                  </div>
                  <div class="v3a-section-line"></div>

                  <div class="v3a-chartsgrid">
                    <div class="v3a-chartcard">
                      <div class="v3a-charthead">
                        <div class="v3a-charttitle">发布趋势</div>
                        <span class="v3a-charticon" v-html="ICONS.trending"></span>
                      </div>
                      <div id="v3a-chart-publish" class="v3a-chart"></div>
                    </div>

                    <div class="v3a-chartcard">
                      <div class="v3a-charthead">
                        <div class="v3a-charttitle">分类分布</div>
                        <span class="v3a-charticon" v-html="ICONS.pie"></span>
                      </div>
                      <div id="v3a-chart-category" class="v3a-chart"></div>
                    </div>

                    <div class="v3a-chartcard">
                      <div class="v3a-charthead">
                        <div class="v3a-charttitle">评论活跃度（近30天）</div>
                        <span class="v3a-charticon" v-html="ICONS.comments"></span>
                      </div>
                      <div id="v3a-chart-comment" class="v3a-chart"></div>
                    </div>

                    <div class="v3a-chartcard">
                      <div class="v3a-charthead">
                        <div class="v3a-charttitle">热门文章 Top 10</div>
                      </div>
                      <div class="v3a-list">
                        <div class="row" v-for="(p, idx) in hotPosts" :key="p.cid">
                          <div class="row-left">
                            <span class="v3a-rank" :class="{ top: idx < 3 }">{{ idx + 1 }}</span>
                            <template v-if="p.permalink">
                              <a class="row-title" :href="p.permalink" target="_blank" rel="noreferrer">{{ p.title }}</a>
                            </template>
                            <span v-else class="row-title">{{ p.title }}</span>
                          </div>
                          <span class="v3a-badge">
                            <span class="v3a-icon" v-html="ICONS.comments"></span>
                            {{ formatNumber(p.comments) }}
                          </span>
                        </div>
                        <div v-if="!hotPosts.length" class="v3a-empty">暂无数据</div>
                      </div>
                    </div>

                    <div class="v3a-chartcard">
                      <div class="v3a-charthead">
                        <div class="v3a-charttitle">关系图谱</div>
                        <span class="v3a-charticon" v-html="ICONS.tags"></span>
                      </div>
                      <div id="v3a-chart-tag" class="v3a-chart"></div>
                      <div v-if="!tagGraph.nodes.length" class="v3a-empty">暂无数据</div>
                    </div>

                    <div class="v3a-chartcard">
                      <div class="v3a-charthead">
                        <div class="v3a-charttitle">本周访问趋势</div>
                        <span class="v3a-muted">PV / IP 对比</span>
                      </div>
                      <div id="v3a-chart-visit-week" class="v3a-chart"></div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="routePath === '/posts/manage'">
              <div class="v3a-container">
                <div class="v3a-posts-head">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarToggleTitle">
                      <span class="v3a-icon" v-html="sidebarToggleIcon"></span>
                    </button>
                    <div class="v3a-posts-title">管理</div>
                  </div>
                  <div class="v3a-posts-actions" data-tour="posts-manage-actions">
                    <button class="v3a-actionbtn danger" type="button" title="删除多条" :disabled="!postsSelectedCids.length" @click="deleteSelectedPosts()">
                      <span class="v3a-icon" v-html="ICONS.trash"></span>
                    </button>
                    <button v-if="V3A.canPublish" class="v3a-actionbtn success" type="button" title="批量发布" :disabled="!postsSelectedCids.length" @click="updateSelectedPostsStatus('publish')">
                      <span class="v3a-icon" v-html="ICONS.eye"></span>
                    </button>
                    <button class="v3a-actionbtn warn" type="button" title="批量隐藏" :disabled="!postsSelectedCids.length" @click="updateSelectedPostsStatus('hidden')">
                      <span class="v3a-icon" v-html="ICONS.eyeOff"></span>
                    </button>
                    <button class="v3a-actionbtn" type="button" title="新增文章" @click="openPostEditor(0)">
                      <span class="v3a-icon" v-html="ICONS.plus"></span>
                    </button>
                  </div>
                </div>

                <div class="v3a-posts-search" data-tour="posts-manage-filters">
                  <div class="v3a-searchbox">
                    <span class="v3a-searchbox-icon" v-html="ICONS.search"></span>
                    <input class="v3a-input" v-model="postsFilters.keywords" @keyup.enter="applyPostsFilters()" placeholder="搜索标题..." />
                  </div>
                  <select class="v3a-select" v-model="postsFilters.status" @change="applyPostsFilters()" style="width: 140px;">
                    <option value="all">全部状态</option>
                    <option value="publish">已发布</option>
                    <option value="draft">草稿</option>
                    <option value="waiting">待审核</option>
                    <option value="private">私密</option>
                    <option value="hidden">隐藏</option>
                  </select>
                  <select v-if="V3A.canPublish && (!V3A.acl || !V3A.acl.posts || Number(V3A.acl.posts.scopeAll))" class="v3a-select" v-model="postsFilters.scope" @change="applyPostsFilters()" style="width: 140px;">
                    <option value="mine">我的文章</option>
                    <option value="all">全部文章</option>
                  </select>
                  <button class="v3a-btn" type="button" @click="applyPostsFilters()" :disabled="postsLoading">搜索</button>
                  <div class="v3a-muted">{{ formatNumber(postsPagination.total) }} 篇</div>
                </div>

                <div class="v3a-card" data-tour="posts-manage-table">
                  <div class="bd" style="padding: 0;">
                    <div v-if="postsLoading" class="v3a-muted" style="padding: 16px;">正在加载…</div>

                    <template v-else>
                      <template v-if="isNarrowScreen">
                        <div class="v3a-posts-narrow-toolbar">
                          <label class="v3a-posts-narrow-selectall">
                            <input ref="postsSelectAllEl" class="v3a-check" type="checkbox" :checked="postsSelectedAll" @change="togglePostsSelectAll($event.target.checked)" />
                            <span class="v3a-muted">全选</span>
                          </label>
                          <span v-if="postsSelectedCids.length" class="v3a-muted">已选 {{ formatNumber(postsSelectedCids.length) }}</span>
                        </div>

                        <div v-if="!postsItems.length" class="v3a-muted" style="padding: 16px;">暂无文章</div>

                        <div v-else class="v3a-posts-narrow-list">
                          <div class="v3a-posts-narrow-item" v-for="p in postsItems" :key="p.cid">
                            <input class="v3a-check v3a-posts-narrow-check" type="checkbox" :checked="isPostSelected(p.cid)" @change="togglePostSelection(p.cid, $event.target.checked)" />

                            <div class="v3a-posts-narrow-left">
                              <div class="v3a-posts-narrow-title">
                                <a href="###" @click.prevent="openPostEditor(p.cid)">{{ p.title || '（无标题）' }}</a>
                              </div>

                              <div class="v3a-posts-narrow-meta">
                                <span>{{ (p.categories && p.categories.length) ? p.categories[0].name : '—' }}</span>
                                <span class="v3a-posts-narrow-metric" title="评论">
                                  <span class="v3a-icon" v-html="ICONS.comments"></span>
                                  <span>{{ formatNumber(p.commentsNum) }}</span>
                                </span>
                                <span class="v3a-posts-narrow-metric" title="点赞">
                                  <span class="v3a-icon" v-html="ICONS.thumbsUp"></span>
                                  <span>{{ formatNumber(p.likes) }}</span>
                                </span>
                                <span>· {{ formatTimeAgo(p.created) }}</span>
                                <span class="v3a-pill" :class="getPostBadge(p).tone">
                                  <span class="v3a-icon" v-html="postStatusIcon(p)"></span>
                                  {{ getPostBadge(p).text }}
                                </span>
                              </div>
                            </div>

                            <div class="v3a-posts-narrow-actions">
                              <a v-if="p.permalink" class="v3a-iconaction v3a-iconaction-sm" :href="p.permalink" target="_blank" rel="noreferrer" title="打开文章" @click.stop>
                                <span class="v3a-icon" v-html="ICONS.externalLink"></span>
                              </a>
                              <button class="v3a-iconaction v3a-iconaction-sm" type="button" title="编辑" @click="openPostEditor(p.cid)">
                                <span class="v3a-icon" v-html="ICONS.pencil"></span>
                              </button>
                              <button class="v3a-iconaction v3a-iconaction-sm danger" type="button" title="删除" @click="deletePost(p.cid)">
                                <span class="v3a-icon" v-html="ICONS.trash"></span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </template>

                      <table v-else class="v3a-table v3a-posts-table">
                        <thead>
                          <tr>
                            <th>
                              <input ref="postsSelectAllEl" class="v3a-check" type="checkbox" :checked="postsSelectedAll" @change="togglePostsSelectAll($event.target.checked)" />
                            </th>
                            <th>标题</th>
                            <th v-if="V3A.canPublish && postsFilters.scope === 'all' && (!V3A.acl || !V3A.acl.posts || Number(V3A.acl.posts.scopeAll))">作者</th>
                            <th>分类</th>
                            <th>标签</th>
                            <th class="v3a-posts-col-comments" title="评论"><span class="v3a-icon" v-html="ICONS.comments"></span></th>
                            <th>创建于</th>
                            <th>修改于</th>
                            <th>状态</th>
                            <th>操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="p in postsItems" :key="p.cid">
                            <td>
                              <input class="v3a-check" type="checkbox" :checked="isPostSelected(p.cid)" @change="togglePostSelection(p.cid, $event.target.checked)" />
                            </td>
                            <td>
                              <div class="v3a-posts-titlecell">
                                <a href="###" @click.prevent="openPostEditor(p.cid)">{{ p.title || '（无标题）' }}</a>
                                <a v-if="p.permalink" class="v3a-posts-open" :href="p.permalink" target="_blank" rel="noreferrer" title="打开文章" @click.stop>
                                  <span class="v3a-icon" v-html="ICONS.externalLink"></span>
                                </a>
                              </div>
                            </td>
                            <td v-if="V3A.canPublish && postsFilters.scope === 'all' && (!V3A.acl || !V3A.acl.posts || Number(V3A.acl.posts.scopeAll))" class="v3a-muted">
                              {{ (p.author && p.author.name) ? p.author.name : '—' }}
                            </td>
                            <td>{{ (p.categories && p.categories.length) ? p.categories[0].name : '—' }}</td>
                            <td>{{ (p.tags && p.tags.length) ? p.tags.map(t => t.name).join(', ') : '—' }}</td>
                            <td class="v3a-posts-col-comments">{{ formatNumber(p.commentsNum) }}</td>
                            <td>{{ formatTimeAgo(p.created) }}</td>
                            <td>{{ (p.modified && p.modified > p.created) ? formatTimeAgo(p.modified) : '-' }}</td>
                            <td>
                              <span class="v3a-pill" :class="getPostBadge(p).tone">
                                <span class="v3a-icon" v-html="postStatusIcon(p)"></span>
                                {{ getPostBadge(p).text }}
                              </span>
                            </td>
                            <td>
                              <a href="###" class="v3a-link-danger" @click.prevent="deletePost(p.cid)">删除</a>
                            </td>
                          </tr>
                          <tr v-if="!postsItems.length">
                            <td :colspan="(V3A.canPublish && postsFilters.scope === 'all' && (!V3A.acl || !V3A.acl.posts || Number(V3A.acl.posts.scopeAll))) ? 10 : 9" class="v3a-muted" style="padding: 16px;">暂无文章</td>
                          </tr>
                        </tbody>
                      </table>
                    </template>
                  </div>
                </div>

                <div class="v3a-pagination">
                  <button class="v3a-pagebtn" type="button" @click="postsGoPage(postsPagination.page - 1)" :disabled="postsPagination.page <= 1">
                    <span class="v3a-icon" v-html="ICONS.collapse"></span>
                  </button>
                  <div class="v3a-pagecurrent">{{ postsPagination.page }}</div>
                  <button class="v3a-pagebtn" type="button" @click="postsGoPage(postsPagination.page + 1)" :disabled="postsPagination.page >= postsPagination.pageCount">
                    <span class="v3a-icon" v-html="ICONS.expand"></span>
                  </button>
                  <span class="v3a-muted">跳至</span>
                  <input class="v3a-pagejump" type="number" min="1" :max="postsPagination.pageCount" v-model.number="postsPageJump" @keyup.enter="postsGoPage(postsPageJump)" @blur="postsGoPage(postsPageJump)" />
                </div>
              </div>
            </template>

            <template v-else-if="routePath === '/posts/write'">
              <div class="v3a-container v3a-container-write">
                <div class="v3a-pagehead v3a-pagehead-sticky">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarToggleTitle">
                      <span class="v3a-icon" v-html="sidebarToggleIcon"></span>
                    </button>
                    <div class="v3a-pagehead-title v3a-pagehead-title--path" :title="crumb">
                      <span v-if="crumbPath" class="v3a-pagehead-title-path">{{ crumbPath }}</span>
                      <span v-if="crumbPath" class="v3a-pagehead-title-sep"> / </span>
                      <span class="v3a-pagehead-title-current">{{ crumbCurrent || crumb }}</span>
                    </div>
                    <div v-if="postAutoSaveEnabled" class="v3a-draft-status" :class="postDraftSaveState">
                      <span class="v3a-icon" v-html="ICONS.cloud"></span>
                      <span>{{ postDraftStatusText }}</span>
                      <span v-if="postDraftTimeAgo" class="v3a-draft-status-time">· {{ postDraftTimeAgo }}</span>
                    </div>
                  </div>
                  <div class="v3a-pagehead-actions" data-tour="write-post-actions">
                    <button class="v3a-iconbtn v3a-write-side-toggle" type="button" @click="toggleWriteSidebar()" :title="writeSidebarOpen ? '收起发布设置' : '展开发布设置'" data-tour="write-side-toggle">
                      <span class="v3a-icon" v-html="ICONS.settings"></span>
                    </button>
                    <button v-if="aiPolishAvailable" class="v3a-iconaction" type="button" @click="openAiPolishModal()" :disabled="postSaving || postLoading || aiPolishLoading" aria-label="AI润色" data-tooltip="AI润色">
                      <span class="v3a-icon" v-html="ICONS.bot"></span>
                    </button>
                    <button class="v3a-iconaction" type="button" @click="submitPost('save')" :disabled="postSaving || postLoading" aria-label="保存草稿" data-tooltip="保存草稿">
                      <span class="v3a-icon" v-html="ICONS.save"></span>
                    </button>
                    <button class="v3a-iconaction primary" type="button" @click="submitPost('publish')" :disabled="postSaving || postLoading" aria-label="发布" data-tooltip="发布">
                      <span class="v3a-icon" v-html="ICONS.send"></span>
                    </button>
                    <button v-if="postForm.cid" class="v3a-actionbtn danger" type="button" @click="deletePost(postForm.cid)" :disabled="postSaving || postLoading" aria-label="删除" data-tooltip="删除">
                      <span class="v3a-icon" v-html="ICONS.trash"></span>
                    </button>
                  </div>
                </div>

                <div v-if="postLoading" class="v3a-muted">正在加载…</div>

                <div v-else class="v3a-write-shell" :class="{ 'side-open': writeSidebarOpen }">
                  <div class="v3a-write-main">
                    <div class="v3a-write-editor">
                      <div class="v3a-write-editor-header">
                        <input class="v3a-write-title" v-model="postForm.title" placeholder="输入标题..." data-tour="write-post-title" />
                        <div class="v3a-write-subtitle">
                          <div class="v3a-write-subline">
                            <span class="v3a-write-baseurl">{{ postSlugPrefix }}</span>
                            <template v-if="postSlugHasSlug">
                              <input class="v3a-write-slug" v-model="postForm.slug" placeholder="slug" :style="{ width: postSlugInputWidth + 'ch' }" data-tour="write-post-slug" />
                              <button v-if="aiSlugAvailable" class="v3a-iconaction v3a-iconaction-sm" type="button" @click="generateAiSlugForPost()" :disabled="aiSlugLoading || !String(postForm.title || '').trim()" aria-label="AI生成slug" data-tooltip="AI生成slug">
                                <span class="v3a-icon" v-html="ICONS.codeXml"></span>
                              </button>
                              <span v-if="postSlugSuffix" class="v3a-write-baseurl v3a-write-baseurl-suffix">{{ postSlugSuffix }}</span>
                            </template>
                          </div>
                        </div>
                      </div>
                      <div class="v3a-write-editor-content" data-tour="write-post-editor">
                        <div v-if="postEditorType === 'vditor'" id="v3a-post-vditor" class="v3a-vditor"></div>
                        <textarea v-else id="v3a-post-text" ref="postTextEl" class="v3a-write-textarea" v-model="postForm.text" @input="autoSizePostText"></textarea>
                      </div>
                    </div>
                  </div>

                  <div class="v3a-write-side-mask" v-if="writeSidebarOpen" @click="toggleWriteSidebar(false)"></div>
                  <div class="v3a-write-side" :class="{ open: writeSidebarOpen }" data-tour="write-post-drawer">
                      <div class="v3a-write-drawer-header">
                        <div class="v3a-write-drawer-title" role="heading" aria-level="1">文章设定</div>
                        <button class="v3a-write-drawer-close" type="button" @click="toggleWriteSidebar(false)" aria-label="close" data-tooltip="关闭">
                          <span class="v3a-icon" v-html="ICONS.closeSmall"></span>
                        </button>
                      </div>
                    <div class="v3a-write-drawer-body">
                      <div class="v3a-write-section" data-tour="write-post-taxonomy">
                        <div class="v3a-write-section-head">
                          <span class="v3a-icon" v-html="ICONS.files"></span>
                          <span class="v3a-write-section-title">分类与标签</span>
                        </div>

                        <div class="v3a-write-formitem">
                          <label class="v3a-write-label">分类<span class="v3a-required">*</span></label>
                          <div v-if="categoriesAll && categoriesAll.length" ref="categorySelectEl" class="v3a-write-tags v3a-write-category-tags">
                            <span v-for="c in postSelectedCategories" :key="c.mid" class="v3a-write-tag">
                              {{ c.name }}
                              <button class="v3a-write-tag-remove" type="button" @click="removePostCategory(c.mid)" :aria-label="'删除分类 ' + c.name" data-tooltip="删除">
                                <span class="v3a-icon" v-html="ICONS.closeSmall"></span>
                              </button>
                            </span>

                            <span v-if="!postSelectedCategories.length" class="v3a-write-placeholder">请选择分类</span>

                            <button class="v3a-write-tags-add" type="button" @click="toggleCategorySelect()" :aria-expanded="categorySelectOpen" data-tooltip="添加分类">
                              <span class="v3a-icon" v-html="ICONS.plus"></span>
                            </button>

                            <div v-if="categorySelectOpen" class="v3a-write-select-menu">
                              <button v-for="c in categoriesAll" :key="c.mid" class="v3a-write-select-option" :class="{ selected: isPostCategorySelected(c.mid) }" type="button" @click="togglePostCategory(c.mid)">
                                <span class="v3a-write-select-option-label" :style="{ paddingLeft: (Number(c.levels || 0) * 12) + 'px' }">{{ c.name }}</span>
                              </button>
                            </div>
                          </div>
                          <input v-else class="v3a-input" :value="postForm.categories.join(',')" @input="setPostCategoriesFromText($event.target.value)" placeholder="多个用逗号分隔（例如：1,2）" />
                        </div>

                        <div class="v3a-write-formitem">
                          <label class="v3a-write-label">标签</label>
                          <div class="v3a-write-tags">
                            <span v-for="t in postTags" :key="t" class="v3a-write-tag">
                              {{ t }}
                              <button class="v3a-write-tag-remove" type="button" @click="removePostTag(t)" :aria-label="'删除标签 ' + t" data-tooltip="删除">
                                <span class="v3a-icon" v-html="ICONS.closeSmall"></span>
                              </button>
                            </span>
                            <div v-if="postTagEditorOpen" class="v3a-write-tag-editor">
                              <input ref="postTagInputEl" class="v3a-write-tags-input" v-model="postTagInput" placeholder="" @focus="onPostTagFocus()" @blur="onPostTagBlur()" @keydown="onPostTagKeydown" />
                              <div v-if="postTagSuggestions.length" class="v3a-write-select-menu v3a-write-tag-suggest">
                                <button v-for="(t, idx) in postTagSuggestions" :key="t" class="v3a-write-select-option" :class="{ active: idx === postTagActiveIndex }" type="button" @mousedown.prevent="selectTagSuggestion(t)">
                                  <span class="v3a-write-select-option-label">{{ t }}</span>
                                </button>
                              </div>
                            </div>
                            <button class="v3a-write-tags-add" type="button" @click="openPostTagEditor()" :aria-expanded="postTagEditorOpen" data-tooltip="添加标签">
                              <span class="v3a-icon" v-html="ICONS.plus"></span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div class="v3a-divider"></div>

                      <div class="v3a-kv">
                        <div class="v3a-write-section-head" style="grid-column: 1 / -1;">
                          <span class="v3a-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings-icon lucide-settings"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg></span>
                          <span class="v3a-write-section-title">内容选项</span>
                        </div>

                        <div class="v3a-muted">可见性</div>
                        <select class="v3a-select" v-model="postForm.visibility">
                          <option value="publish">公开</option>
                          <option value="hidden">隐藏</option>
                          <option value="private">私密</option>
                          <option value="waiting">待审核</option>
                          <option value="password">密码保护</option>
                        </select>

                        <div class="v3a-muted">内容密码</div>
                        <input class="v3a-input" v-model="postForm.password" :disabled="postForm.visibility !== 'password'" placeholder="仅当选择密码保护时生效" />

                        <div class="v3a-muted">Markdown</div>
                        <label class="v3a-remember" style="justify-content:flex-start;">
                          <input class="v3a-check" type="checkbox" v-model="postForm.markdown" :disabled="!postCapabilities.markdownEnabled" />
                          <span>{{ postCapabilities.markdownEnabled ? '启用' : '未开启' }}</span>
                        </label>

                        <div class="v3a-kv-span" data-tour="write-post-permissions">
                          <div class="v3a-muted">权限</div>
                          <div class="v3a-kv-inline">
                            <label class="v3a-remember" style="margin: 0;">
                              <input class="v3a-check" type="checkbox" v-model="postForm.allowComment" />
                              <span>允许评论</span>
                            </label>
                            <label class="v3a-remember" style="margin: 0;">
                              <input class="v3a-check" type="checkbox" v-model="postForm.allowPing" />
                              <span>允许引用</span>
                            </label>
                            <label class="v3a-remember" style="margin: 0;">
                              <input class="v3a-check" type="checkbox" v-model="postForm.allowFeed" />
                              <span>允许聚合</span>
                            </label>
                          </div>
                        </div>
                      </div>

                      <div class="v3a-divider"></div>

                      <template v-if="postDefaultFields.length">
                        <div class="v3a-write-section-head" style="margin-top: calc(var(--spacing) * 6);">
                          <span class="v3a-icon" v-html="ICONS.settings"></span>
                          <span class="v3a-write-section-title">主题字段</span>
                        </div>

                        <div v-for="f in postDefaultFields" :key="'post-df-' + f.name" class="v3a-write-formitem">
                          <label class="v3a-write-label">{{ f.label || f.name }}</label>

                          <input
                            v-if="f.inputType === 'text' || f.inputType === 'url' || f.inputType === 'password' || f.inputType === 'number'"
                            class="v3a-input"
                            :type="f.inputType === 'number' ? 'number' : f.inputType"
                            v-model="f.value"
                            :placeholder="f.placeholder || ''"
                          />
                          <textarea
                            v-else-if="f.inputType === 'textarea'"
                            class="v3a-textarea v3a-modal-textarea"
                            style="min-height: 90px;"
                            v-model="f.value"
                            :placeholder="f.placeholder || ''"
                          ></textarea>
                          <select v-else-if="f.inputType === 'select' || f.inputType === 'radio'" class="v3a-select" v-model="f.value">
                            <option v-for="opt in (f.options || [])" :key="String(opt.value)" :value="opt.value">{{ opt.label }}</option>
                          </select>
                          <div v-else-if="f.inputType === 'checkbox'" style="display:flex; flex-direction: column; gap: 8px;">
                            <label v-for="opt in (f.options || [])" :key="String(opt.value)" class="v3a-remember" style="justify-content:flex-start; margin: 0;">
                              <input class="v3a-check" type="checkbox" :value="opt.value" v-model="f.value" />
                              <span>{{ opt.label }}</span>
                            </label>
                          </div>
                          <input v-else class="v3a-input" v-model="f.value" :placeholder="f.placeholder || ''" />

                          <div v-if="f.description" class="v3a-muted" style="font-size: 12px;">{{ f.description }}</div>
                        </div>
                      </template>

                      <div :style="{ marginTop: postDefaultFields.length ? '12px' : 'calc(var(--spacing) * 6)' }" style="display:flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <div class="v3a-write-section-head" style="margin: 0;">
                          <span class="v3a-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-hash-icon lucide-hash"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg></span>
                          <span class="v3a-write-section-title">自定义字段</span>
                        </div>
                        <button class="v3a-mini-btn" type="button" @click="addPostField()">新增字段</button>
                      </div>

                      <div class="v3a-card" style="margin-top: 12px;">
                        <div class="bd" style="padding: 0;">
                          <table class="v3a-table">
                            <thead>
                              <tr>
                                <th>名称</th>
                                <th style="width: 90px;">类型</th>
                                <th>值</th>
                                <th style="width: 80px;">操作</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr v-for="(f, idx) in postForm.fields" :key="idx">
                                <td><input class="v3a-input" v-model="f.name" placeholder="字段名（a-z0-9_）" /></td>
                                <td>
                                  <select class="v3a-select" v-model="f.type">
                                    <option value="str">文本</option>
                                    <option value="int">整数</option>
                                    <option value="float">小数</option>
                                    <option value="json">JSON</option>
                                  </select>
                                </td>
                                <td>
                                  <button class="v3a-mini-btn" type="button" @click="openJsonFieldEditor('post', idx)">编辑</button>
                                </td>
                                <td>
                                  <button class="v3a-mini-btn" type="button" style="color: var(--v3a-danger);" @click="removePostField(idx)">删除</button>
                                </td>
                              </tr>
                              <tr v-if="!postForm.fields.length">
                                <td colspan="4" class="v3a-muted">暂无自定义字段</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div class="v3a-muted" style="margin: calc(var(--spacing) * 4) 0;">发布权限：{{ postCapabilities.canPublish ? '可直接发布' : '将以待审核方式提交' }}</div>
                    </div>
                  </div>

                  <div v-if="aiPolishModalOpen" class="v3a-modal-mask" @click.self="closeAiPolishModal()">
                    <div class="v3a-modal-card v3a-scroll-modal" role="dialog" aria-modal="true">
                      <button class="v3a-modal-close" type="button" aria-label="关闭" @click="closeAiPolishModal()">
                        <span class="v3a-icon" v-html="ICONS.closeSmall"></span>
                      </button>

                      <div class="v3a-modal-head">
                        <div class="v3a-modal-title">AI 润色</div>
                        <div class="v3a-modal-subtitle">Markdown 渲染预览</div>
                      </div>

                      <div class="v3a-modal-body">
                        <div v-if="aiPolishError" class="v3a-alert" style="margin-bottom: 12px;">{{ aiPolishError }}</div>
                        <div v-if="aiPolishLoading" class="v3a-muted">正在生成…</div>
                        <template v-else>
                          <div v-if="aiPolishModel" class="v3a-muted" style="margin-bottom: 10px;">模型：{{ aiPolishModel }}</div>
                          <div ref="aiPolishPreviewEl" class="v3a-ai-preview"></div>
                        </template>
                      </div>

                      <div class="v3a-modal-actions">
                        <button class="v3a-btn v3a-modal-btn" type="button" @click="closeAiPolishModal()" :disabled="aiPolishLoading">取消</button>
                        <button class="v3a-btn primary v3a-modal-btn" type="button" @click="applyAiPolishReplace()" :disabled="aiPolishLoading || !String(aiPolishText || '').trim()">一键替换</button>
                      </div>
                    </div>
                  </div>
              </div>
            </template>

            <template v-else-if="routePath === '/posts/taxonomy'">
              <div class="v3a-container">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarToggleTitle">
                      <span class="v3a-icon" v-html="sidebarToggleIcon"></span>
                    </button>
                    <div class="v3a-pagehead-title v3a-pagehead-title--path" :title="crumb">
                      <span v-if="crumbPath" class="v3a-pagehead-title-path">{{ crumbPath }}</span>
                      <span v-if="crumbPath" class="v3a-pagehead-title-sep"> / </span>
                      <span class="v3a-pagehead-title-current">{{ crumbCurrent || crumb }}</span>
                    </div>
                  </div>
                  <div class="v3a-pagehead-actions" data-tour="taxonomy-actions">
                    <button class="v3a-btn" type="button" @click="fetchTaxonomy()" :disabled="taxonomyLoading">刷新</button>
                    <button class="v3a-btn" type="button" @click="openCategoryEditor(null)">新建分类</button>
                    <button class="v3a-btn primary" type="button" @click="openTagEditor(null)">新建标签</button>
                  </div>
                </div>

                <div class="v3a-grid">
                  <div class="v3a-card" data-tour="taxonomy-categories">
                    <div class="bd" style="padding: 0;">
                      <table class="v3a-table v3a-taxonomy-table v3a-taxonomy-table-cats">
                        <thead><tr><th>名称</th><th>默认分类</th><th>缩略名</th><th>描述</th><th>数量</th><th>操作</th></tr></thead>
                        <tbody>
                          <tr v-for="c in categoriesAll" :key="c.mid">
                            <td>
                              <div style="display:flex; align-items:center; gap: 8px;">
                                <span :style="{ paddingLeft: (Number(c.levels || 0) * 12) + 'px' }">{{ c.name }}</span>
                              </div>
                            </td>
                            <td>
                              <span v-if="Number(c.mid) === Number(defaultCategoryId)" class="v3a-pill success">默认</span>
                              <button
                                v-else
                                class="v3a-pill v3a-taxonomy-default-btn"
                                type="button"
                                @click.stop="setDefaultCategory(c.mid)"
                                :disabled="taxonomySaving || taxonomyLoading"
                              >默认</button>
                            </td>
                            <td class="v3a-muted">{{ c.slug }}</td>
                            <td class="v3a-muted">
                              <span class="v3a-taxonomy-desc" :title="c.description || ''">{{ c.description || '—' }}</span>
                            </td>
                            <td>{{ formatNumber(c.count) }}</td>
                            <td style="white-space: nowrap;">
                              <button class="v3a-mini-btn" type="button" @click="openCategoryEditor(c)">编辑</button>
                              <button class="v3a-mini-btn" type="button" style="color: var(--v3a-danger);" @click="deleteCategory(c.mid)" :disabled="Number(c.mid) === Number(defaultCategoryId)">删除</button>
                            </td>
                          </tr>
                          <tr v-if="!categoriesAll.length">
                            <td colspan="6" class="v3a-muted">暂无分类</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div class="v3a-card" data-tour="taxonomy-tags">
                    <div class="bd" style="padding: 0;">
                      <table class="v3a-table v3a-taxonomy-table v3a-taxonomy-table-tags">
                        <thead><tr><th>名称</th><th>缩略名</th><th>引用</th><th>操作</th></tr></thead>
                        <tbody>
                          <tr v-for="t in tagsAll" :key="t.mid">
                            <td>{{ t.name }}</td>
                            <td class="v3a-muted">{{ t.slug }}</td>
                            <td>{{ formatNumber(t.count) }}</td>
                            <td style="white-space: nowrap;">
                              <button class="v3a-mini-btn" type="button" @click="openTagEditor(t)">编辑</button>
                              <button class="v3a-mini-btn" type="button" style="color: var(--v3a-danger);" @click="deleteTag(t.mid)">删除</button>
                            </td>
                          </tr>
                          <tr v-if="!tagsAll.length">
                            <td colspan="4" class="v3a-muted">暂无标签</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div v-if="categoryEditorOpen" class="v3a-modal-mask" @click.self="closeCategoryEditor()">
                  <div class="v3a-modal-card" role="dialog" aria-modal="true">
                    <button class="v3a-modal-close" type="button" aria-label="关闭" @click="closeCategoryEditor()">
                      <span class="v3a-icon" v-html="ICONS.closeSmall"></span>
                    </button>

                    <div class="v3a-modal-head">
                      <div class="v3a-modal-title">{{ categoryForm.mid ? '编辑分类' : '新建分类' }}</div>
                    </div>

                    <div class="v3a-modal-body">
                      <div class="v3a-modal-form">
                        <div class="v3a-modal-item">
                          <label class="v3a-modal-label">名称<span class="v3a-required">*</span></label>
                          <input
                            ref="categoryNameEl"
                            class="v3a-input v3a-modal-input"
                            :class="{ 'v3a-input-error': categoryNameError }"
                            v-model="categoryForm.name"
                            placeholder="输入分类名称..."
                            @input="categoryNameError = ''"
                          />
                          <div v-if="categoryNameError" class="v3a-modal-feedback">{{ categoryNameError }}</div>
                        </div>

                        <div class="v3a-modal-item">
                          <label class="v3a-modal-label">缩略名</label>
                          <input class="v3a-input v3a-modal-input" v-model="categoryForm.slug" placeholder="可留空（自动生成）" />
                        </div>

                        <div class="v3a-modal-item">
                          <label class="v3a-modal-label">父级</label>
                          <select class="v3a-select v3a-modal-input" v-model.number="categoryForm.parent">
                            <option :value="0">无</option>
                            <template v-for="c in categoriesAll" :key="c.mid">
                              <option v-if="c.mid !== categoryForm.mid" :value="c.mid">
                                {{ (c.levels ? '—'.repeat(Number(c.levels)) + ' ' : '') + c.name }}
                              </option>
                            </template>
                          </select>
                        </div>

                        <div class="v3a-modal-item">
                          <label class="v3a-modal-label">描述</label>
                          <textarea class="v3a-textarea v3a-modal-textarea" v-model="categoryForm.description" placeholder="可选"></textarea>
                        </div>
                      </div>

                      <div class="v3a-modal-actions">
                        <button class="v3a-btn v3a-modal-btn" type="button" @click="closeCategoryEditor()">取消</button>
                        <button class="v3a-btn primary v3a-modal-btn" type="button" @click="saveCategory()" :disabled="taxonomySaving">确定</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-if="tagEditorOpen" class="v3a-modal-mask" @click.self="closeTagEditor()">
                  <div class="v3a-modal-card" role="dialog" aria-modal="true">
                    <button class="v3a-modal-close" type="button" aria-label="关闭" @click="closeTagEditor()">
                      <span class="v3a-icon" v-html="ICONS.closeSmall"></span>
                    </button>

                    <div class="v3a-modal-head">
                      <div class="v3a-modal-title">{{ tagForm.mid ? '编辑标签' : '新建标签' }}</div>
                    </div>

                    <div class="v3a-modal-body">
                      <div class="v3a-modal-form">
                        <div class="v3a-modal-item">
                          <label class="v3a-modal-label">名称<span class="v3a-required">*</span></label>
                          <input
                            ref="tagNameEl"
                            class="v3a-input v3a-modal-input"
                            :class="{ 'v3a-input-error': tagNameError }"
                            v-model="tagForm.name"
                            placeholder="输入标签名称..."
                            @input="tagNameError = ''"
                          />
                          <div v-if="tagNameError" class="v3a-modal-feedback">{{ tagNameError }}</div>
                        </div>

                        <div class="v3a-modal-item">
                          <label class="v3a-modal-label">缩略名</label>
                          <input class="v3a-input v3a-modal-input" v-model="tagForm.slug" placeholder="可留空（自动生成）" />
                        </div>
                      </div>

                      <div class="v3a-modal-actions">
                        <button class="v3a-btn v3a-modal-btn" type="button" @click="closeTagEditor()">取消</button>
                        <button class="v3a-btn primary v3a-modal-btn" type="button" @click="saveTag()" :disabled="taxonomySaving">确定</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="routePath === '/drafts'">
              <div class="v3a-container v3a-container-drafts">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarToggleTitle">
                      <span class="v3a-icon" v-html="sidebarToggleIcon"></span>
                    </button>
                    <div class="v3a-pagehead-title v3a-pagehead-title--path" :title="crumb">
                      <span v-if="crumbPath" class="v3a-pagehead-title-path">{{ crumbPath }}</span>
                      <span v-if="crumbPath" class="v3a-pagehead-title-sep"> / </span>
                      <span class="v3a-pagehead-title-current">{{ crumbCurrent || crumb }}</span>
                    </div>
                  </div>
                  <div class="v3a-pagehead-actions">
                    <button class="v3a-actionbtn" type="button" title="刷新" :disabled="draftsPostsLoading || draftsPagesLoading" @click="fetchDrafts()">
                      <span class="v3a-icon" v-html="ICONS.refreshCw"></span>
                    </button>
                    <button class="v3a-actionbtn" type="button" title="新增文章" @click="openPostEditor(0)">
                      <span class="v3a-icon" v-html="ICONS.filePenLine"></span>
                    </button>
                    <button class="v3a-actionbtn" type="button" title="新增页面" @click="openPageEditor(0)">
                      <span class="v3a-icon" v-html="ICONS.squarePen"></span>
                    </button>
                  </div>
                </div>

                <div class="v3a-drafts-split">
                  <div class="v3a-drafts-left">
                    <div class="v3a-drafts-left-head">
                      <select v-if="V3A.canPublish && (!V3A.acl || !V3A.acl.posts || Number(V3A.acl.posts.scopeAll))" class="v3a-select" v-model="draftsScope" @change="applyDraftsFilters()" style="width: 128px;">
                        <option value="mine">我的</option>
                        <option value="all">全部</option>
                      </select>
                      <span class="v3a-muted">{{ draftsCountText }}</span>
                    </div>

                    <div class="v3a-drafts-toolbar">
                      <div class="v3a-searchbox v3a-searchbox-full">
                        <span class="v3a-searchbox-icon" v-html="ICONS.search"></span>
                        <input class="v3a-input" v-model="draftsKeywords" @keyup.enter="applyDraftsFilters()" placeholder="搜索标题..." />
                      </div>
                      <button class="v3a-btn" type="button" @click="applyDraftsFilters()" :disabled="draftsPostsLoading || draftsPagesLoading">搜索</button>
                    </div>

                    <div class="v3a-drafts-list">
                      <div v-if="draftsPostsLoading || draftsPagesLoading" class="v3a-drafts-empty">
                        <div class="v3a-muted">正在加载…</div>
                      </div>
                      <div v-else-if="draftsPostsError || draftsPagesError" class="v3a-drafts-empty">
                        <div class="v3a-muted">{{ draftsPostsError || draftsPagesError }}</div>
                      </div>
                      <div v-else-if="!draftsListItems.length" class="v3a-drafts-empty">
                        <div class="v3a-muted">暂无草稿</div>
                      </div>
                      <div v-else>
                        <div
                          v-for="d in draftsListItems"
                          :key="d._draftKey"
                          class="v3a-drafts-item"
                          :class="{ active: draftsActiveKey === d._draftKey }"
                          role="button"
                          tabindex="0"
                          @click="draftsActiveKey = d._draftKey"
                          @keyup.enter="draftsActiveKey = d._draftKey"
                        >
                          <div class="v3a-drafts-item-main">
                            <div class="v3a-drafts-item-title-row">
                              <div class="v3a-drafts-item-title">{{ draftsItemTitle(d) }}</div>
                              <span class="v3a-drafts-item-id">#{{ d.cid }}</span>
                            </div>
                            <div class="v3a-drafts-item-meta">
                              <span class="v3a-pill info v3a-drafts-type-pill">
                                <span class="v3a-icon" v-html="d._draftType === 'page' ? ICONS.pages : ICONS.posts"></span>
                                {{ d._draftType === 'page' ? '页面' : '文章' }}
                              </span>
                              <span class="v3a-pill warn">草稿</span>
                            </div>
                          </div>
                          <div class="v3a-drafts-item-time">{{ formatTimeAgo(d._draftAt) }}</div>
                        </div>
                      </div>
                    </div>

                    <div v-if="draftsPostsPagination.pageCount > 1" class="v3a-pagination v3a-drafts-pagination">
                      <button class="v3a-pagebtn" type="button" @click="draftsPostsGoPage(draftsPostsPagination.page - 1)" :disabled="draftsPostsPagination.page <= 1">
                        <span class="v3a-icon" v-html="ICONS.collapse"></span>
                      </button>
                      <div class="v3a-pagecurrent">{{ draftsPostsPagination.page }}</div>
                      <button class="v3a-pagebtn" type="button" @click="draftsPostsGoPage(draftsPostsPagination.page + 1)" :disabled="draftsPostsPagination.page >= draftsPostsPagination.pageCount">
                        <span class="v3a-icon" v-html="ICONS.expand"></span>
                      </button>
                      <span class="v3a-muted">跳至</span>
                      <input class="v3a-pagejump" type="number" min="1" :max="draftsPostsPagination.pageCount" v-model.number="draftsPostsPageJump" @keyup.enter="draftsPostsGoPage(draftsPostsPageJump)" @blur="draftsPostsGoPage(draftsPostsPageJump)" />
                    </div>
                  </div>

                  <div class="v3a-drafts-right">
                    <div class="v3a-drafts-right-head">
                      <div class="v3a-drafts-right-titles">
                        <template v-if="draftsActiveItem">
                          <div class="v3a-drafts-right-title">{{ draftsItemTitle(draftsActiveItem) }}</div>
                          <div class="v3a-drafts-right-sub v3a-muted">
                            <span>{{ draftsActiveItem._draftType === 'page' ? '页面' : '文章' }}</span>
                            <span>·</span>
                            <span>#{{ draftsActiveItem.cid }}</span>
                            <template v-if="draftsActiveItem._draftType === 'post' && draftsActiveItem.author && draftsActiveItem.author.name && draftsScope === 'all'">
                              <span>·</span>
                              <span>{{ draftsActiveItem.author.name }}</span>
                            </template>
                            <span>·</span>
                            <span>{{ formatTimeAgo(draftsItemAt(draftsActiveItem)) }}</span>
                          </div>
                        </template>
                        <template v-else>
                          <div class="v3a-drafts-right-title">草稿详情</div>
                          <div class="v3a-drafts-right-sub v3a-muted">选择一个草稿查看详情</div>
                        </template>
                      </div>
                      <div class="v3a-drafts-right-actions">
                        <button v-if="draftsActiveItem" class="v3a-btn" type="button" @click="draftsOpenActiveDraft()">
                          <span class="v3a-icon" v-html="ICONS.edit"></span>
                          编辑
                        </button>
                        <button v-if="draftsActiveItem" class="v3a-btn" type="button" style="color: var(--v3a-danger);" @click="draftsDeleteActiveDraft()">
                          <span class="v3a-icon" v-html="ICONS.trash"></span>
                          删除
                        </button>
                      </div>
                    </div>

                    <div class="v3a-drafts-right-body">
                      <div v-if="!draftsActiveItem" class="v3a-drafts-empty">
                        <span class="v3a-icon v3a-drafts-empty-icon" v-html="ICONS.filePen"></span>
                        <div class="v3a-muted">选择一个草稿查看详情</div>
                      </div>
                      <div v-else class="v3a-card v3a-drafts-detail-card">
                        <div class="bd">
                          <div v-if="draftsPreviewLoading" class="v3a-muted">正在加载…</div>
                          <div v-else-if="draftsPreviewError" class="v3a-muted" style="color: var(--v3a-danger);">{{ draftsPreviewError }}</div>
                          <div v-else class="v3a-drafts-preview-text">{{ draftsPreviewText || '（无内容）' }}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="routePath === '/drafts-old'">
              <div class="v3a-container">
                <div class="v3a-pagehead v3a-pagehead-sticky">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarToggleTitle">
                      <span class="v3a-icon" v-html="sidebarToggleIcon"></span>
                    </button>
                    <div class="v3a-pagehead-title v3a-pagehead-title--path" :title="crumb">
                      <span v-if="crumbPath" class="v3a-pagehead-title-path">{{ crumbPath }}</span>
                      <span v-if="crumbPath" class="v3a-pagehead-title-sep"> / </span>
                      <span class="v3a-pagehead-title-current">{{ crumbCurrent || crumb }}</span>
                    </div>
                  </div>
                  <div class="v3a-pagehead-actions">
                    <button class="v3a-actionbtn" type="button" title="刷新" :disabled="draftsPostsLoading || draftsPagesLoading" @click="fetchDrafts()">
                      <span class="v3a-icon" v-html="ICONS.refreshCw"></span>
                    </button>
                    <button class="v3a-actionbtn" type="button" title="新增文章" @click="openPostEditor(0)">
                      <span class="v3a-icon" v-html="ICONS.filePenLine"></span>
                    </button>
                    <button class="v3a-actionbtn" type="button" title="新增页面" @click="openPageEditor(0)">
                      <span class="v3a-icon" v-html="ICONS.squarePen"></span>
                    </button>
                  </div>
                </div>

                <div class="v3a-posts-search">
                  <div class="v3a-searchbox">
                    <span class="v3a-searchbox-icon" v-html="ICONS.search"></span>
                    <input class="v3a-input" v-model="draftsKeywords" @keyup.enter="applyDraftsFilters()" placeholder="搜索标题..." />
                  </div>
                  <select v-if="V3A.canPublish && (!V3A.acl || !V3A.acl.posts || Number(V3A.acl.posts.scopeAll))" class="v3a-select" v-model="draftsScope" @change="applyDraftsFilters()" style="width: 140px;">
                    <option value="mine">我的草稿</option>
                    <option value="all">全部草稿</option>
                  </select>
                  <button class="v3a-btn" type="button" @click="applyDraftsFilters()" :disabled="draftsPostsLoading || draftsPagesLoading">搜索</button>
                  <div class="v3a-muted">{{ formatNumber(draftsPostsPagination.total) }} 篇 · {{ formatNumber(draftsPagesItems.length) }} 页</div>
                </div>

                <div class="v3a-drafts-grid">
                  <div class="v3a-card">
                    <div class="hd"><div class="title">文章草稿</div></div>
                    <div class="bd" style="padding: 0;">
                      <div v-if="draftsPostsLoading" class="v3a-muted" style="padding: 16px;">正在加载…</div>
                      <div v-else-if="draftsPostsError" class="v3a-muted" style="padding: 16px;">{{ draftsPostsError }}</div>
                      <table v-else class="v3a-table">
                        <thead>
                          <tr>
                            <th>标题</th>
                            <th v-if="V3A.canPublish && draftsScope === 'all' && (!V3A.acl || !V3A.acl.posts || Number(V3A.acl.posts.scopeAll))">作者</th>
                            <th>修改于</th>
                            <th>状态</th>
                            <th>操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="p in draftsPostsItems" :key="p.cid">
                            <td>
                              <a href="###" @click.prevent="openPostEditor(p.cid)">{{ p.title || '（无标题）' }}</a>
                            </td>
                            <td v-if="V3A.canPublish && draftsScope === 'all' && (!V3A.acl || !V3A.acl.posts || Number(V3A.acl.posts.scopeAll))" class="v3a-muted">
                              {{ (p.author && p.author.name) ? p.author.name : '—' }}
                            </td>
                            <td>{{ (p.modified && p.modified > p.created) ? formatTimeAgo(p.modified) : formatTimeAgo(p.created) }}</td>
                            <td>
                              <span class="v3a-pill" :class="getPostBadge(p).tone">
                                <span class="v3a-icon" v-html="postStatusIcon(p)"></span>
                                {{ getPostBadge(p).text }}
                              </span>
                            </td>
                            <td style="white-space: nowrap;">
                              <button class="v3a-mini-btn" type="button" @click="openPostEditor(p.cid)">编辑</button>
                              <button class="v3a-mini-btn" type="button" style="color: var(--v3a-danger);" @click="deletePost(p.cid)">删除</button>
                            </td>
                          </tr>
                          <tr v-if="!draftsPostsItems.length">
                            <td :colspan="(V3A.canPublish && draftsScope === 'all' && (!V3A.acl || !V3A.acl.posts || Number(V3A.acl.posts.scopeAll))) ? 5 : 4" class="v3a-muted" style="padding: 16px;">暂无文章草稿</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div class="v3a-card">
                    <div class="hd"><div class="title">页面草稿</div></div>
                    <div class="bd" style="padding: 0;">
                      <div v-if="draftsPagesLoading" class="v3a-muted" style="padding: 16px;">正在加载…</div>
                      <div v-else-if="draftsPagesError" class="v3a-muted" style="padding: 16px;">{{ draftsPagesError }}</div>
                      <table v-else class="v3a-table">
                        <thead><tr><th>标题</th><th>状态</th><th>日期</th><th>操作</th></tr></thead>
                        <tbody>
                          <tr v-for="p in draftsPagesItems" :key="p.cid">
                            <td>
                              <a href="###" @click.prevent="openPageEditor(p.cid)" :style="{ display: 'inline-block', paddingLeft: (Number(p.levels || 0) * 12) + 'px' }">{{ p.title || ('#' + p.cid) }}</a>
                            </td>
                            <td>
                              <span class="v3a-pill" :class="getPageBadge(p).tone">{{ getPageBadge(p).text }}</span>
                            </td>
                            <td>{{ formatTime(p.created, settingsData.site.timezone) }}</td>
                            <td style="white-space: nowrap;">
                              <button class="v3a-mini-btn" type="button" @click="openPageEditor(p.cid)">编辑</button>
                              <button class="v3a-mini-btn" type="button" style="color: var(--v3a-danger);" @click="deletePage(p.cid)">删除</button>
                            </td>
                          </tr>
                          <tr v-if="!draftsPagesItems.length">
                            <td colspan="4" class="v3a-muted" style="padding: 16px;">暂无页面草稿</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div class="v3a-pagination">
                  <button class="v3a-pagebtn" type="button" @click="draftsPostsGoPage(draftsPostsPagination.page - 1)" :disabled="draftsPostsPagination.page <= 1">
                    <span class="v3a-icon" v-html="ICONS.collapse"></span>
                  </button>
                  <div class="v3a-pagecurrent">{{ draftsPostsPagination.page }}</div>
                  <button class="v3a-pagebtn" type="button" @click="draftsPostsGoPage(draftsPostsPagination.page + 1)" :disabled="draftsPostsPagination.page >= draftsPostsPagination.pageCount">
                    <span class="v3a-icon" v-html="ICONS.expand"></span>
                  </button>
                  <span class="v3a-muted">跳至</span>
                  <input class="v3a-pagejump" type="number" min="1" :max="draftsPostsPagination.pageCount" v-model.number="draftsPostsPageJump" @keyup.enter="draftsPostsGoPage(draftsPostsPageJump)" @blur="draftsPostsGoPage(draftsPostsPageJump)" />
                </div>
              </div>
            </template>

            <template v-else-if="routePath === '/comments'">
              <div class="v3a-container v3a-container-comments">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarToggleTitle">
                      <span class="v3a-icon" v-html="sidebarToggleIcon"></span>
                    </button>
                    <div class="v3a-pagehead-title v3a-pagehead-title--path" :title="crumb">
                      <span v-if="crumbPath" class="v3a-pagehead-title-path">{{ crumbPath }}</span>
                      <span v-if="crumbPath" class="v3a-pagehead-title-sep"> / </span>
                      <span class="v3a-pagehead-title-current">{{ crumbCurrent || crumb }}</span>
                    </div>
                  </div>
                  <div class="v3a-pagehead-actions">
                    <button class="v3a-actionbtn" type="button" title="刷新" :disabled="commentsLoading" @click="applyCommentsFilters()">
                      <span class="v3a-icon" v-html="ICONS.refreshCw"></span>
                    </button>
                  </div>
                </div>

                <div class="v3a-comments-split" :style="{ '--v3a-comments-left': commentsSplitLeftWidth + 'px' }">
                  <div class="v3a-comments-left">
                      <div class="v3a-card v3a-comments-panel">
                      <div class="hd">
                        <div class="v3a-comments-tabs" aria-label="评论状态" data-tour="comments-filters">
                          <select class="v3a-select v3a-comments-filter" :value="commentsFilters.status" @change="quickSetCommentsStatus($event.target.value)" aria-label="评论状态">
                            <option value="waiting">待审核</option>
                            <option value="approved">已通过</option>
                            <option value="spam">垃圾</option>
                            <option value="all">全部</option>
                          </select>
                        </div>
                        <div class="v3a-comments-count v3a-muted">{{ formatNumber(commentsPagination.total) }} 条</div>
                      </div>

                      <div class="bd" style="padding: 0;">
                        <div class="v3a-comments-toolbar" data-tour="comments-search">
                          <div class="v3a-searchbox v3a-searchbox-full">
                            <span class="v3a-searchbox-icon" v-html="ICONS.search"></span>
                            <input class="v3a-input" v-model="commentsFilters.keywords" @keyup.enter="applyCommentsFilters()" placeholder="搜索作者 / 邮箱 / 内容..." />
                          </div>
                          <button class="v3a-btn" type="button" @click="applyCommentsFilters()" :disabled="commentsLoading">搜索</button>
                        </div>

                        <div v-if="commentsError" class="v3a-alert v3a-comments-alert">{{ commentsError }}</div>

                        <div class="v3a-comments-list" data-tour="comments-list">
                          <div v-if="commentsLoading" class="v3a-comments-empty">
                            <div class="v3a-muted">正在加载…</div>
                          </div>
                          <div v-else-if="!commentsItems.length" class="v3a-comments-empty">
                            <span class="v3a-icon v3a-comments-empty-icon" v-html="ICONS.comments"></span>
                            <div class="v3a-muted">暂无评论</div>
                          </div>
                          <div v-else>
                            <div
                              v-for="c in commentsItems"
                              :key="c.coid"
                              class="v3a-comment-item"
                              :class="{ active: commentEditorOpen && Number(commentForm.coid) === Number(c.coid) }"
                              role="button"
                              tabindex="0"
                              @click="openCommentEditor(c.coid)"
                              @keyup.enter="openCommentEditor(c.coid)"
                            >
                              <div class="v3a-comment-avatar" :title="c.mail || ''">
                                <img v-if="c.avatar" :src="c.avatar" :alt="c.author || ''" loading="lazy" referrerpolicy="no-referrer" @error="c.avatar = ''" />
                                <template v-else>
                                  {{ (String(c.author || '?').trim() || '?').slice(0, 1).toUpperCase() }}
                                </template>
                              </div>
                              <div class="v3a-comment-body">
                                <div class="v3a-comment-top">
                                  <span class="v3a-comment-author">{{ c.author || '—' }}</span>
                                  <span v-if="Number(c.parent || 0) > 0" class="v3a-comment-reply v3a-muted">回复</span>
                                  <span class="v3a-comment-time v3a-muted">{{ formatTimeAgo(c.created) }}</span>
                                </div>
                                <div class="v3a-comment-excerpt">{{ c.excerpt || '—' }}</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div class="v3a-comments-footer">
                          <button class="v3a-pagebtn" type="button" @click="commentsGoPage(commentsPagination.page - 1)" :disabled="commentsPagination.page <= 1">
                            <span class="v3a-icon" v-html="ICONS.collapse"></span>
                          </button>
                          <div class="v3a-pagecurrent">{{ commentsPagination.page }}</div>
                          <button class="v3a-pagebtn" type="button" @click="commentsGoPage(commentsPagination.page + 1)" :disabled="commentsPagination.page >= commentsPagination.pageCount">
                            <span class="v3a-icon" v-html="ICONS.expand"></span>
                          </button>
                          <div class="v3a-muted v3a-comments-pagehint">共 {{ commentsPagination.pageCount }} 页 · {{ formatNumber(commentsPagination.total) }} 条</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="v3a-comments-resizer" @pointerdown="startCommentsSplitResize"></div>

                  <div class="v3a-comments-right">
                    <div class="v3a-card v3a-comments-panel">
                      <div class="hd">
                        <div class="title">评论详情</div>
                        <div class="v3a-comments-detail-actions" v-if="commentEditorOpen">
                          <button v-if="commentForm.status !== 'approved'" class="v3a-comments-iconbtn" type="button" aria-label="通过" data-tooltip="通过" @click="markComment(commentForm.coid, 'approved')" :disabled="commentEditorSaving || commentEditorLoading">
                            <span class="v3a-icon" v-html="ICONS.check"></span>
                          </button>
                          <button v-if="commentForm.status !== 'waiting'" class="v3a-comments-iconbtn" type="button" aria-label="待审核" data-tooltip="待审核" @click="markComment(commentForm.coid, 'waiting')" :disabled="commentEditorSaving || commentEditorLoading">
                            <span class="v3a-icon" v-html="ICONS.clock"></span>
                          </button>
                          <button v-if="commentForm.status !== 'spam'" class="v3a-comments-iconbtn" type="button" aria-label="垃圾" data-tooltip="垃圾" @click="markComment(commentForm.coid, 'spam')" :disabled="commentEditorSaving || commentEditorLoading">
                            <span class="v3a-icon" v-html="ICONS.shieldAlert"></span>
                          </button>
                          <button class="v3a-comments-iconbtn danger" type="button" aria-label="删除" data-tooltip="删除" @click="deleteComment(commentForm.coid)" :disabled="commentEditorSaving || commentEditorLoading">
                            <span class="v3a-icon" v-html="ICONS.trash"></span>
                          </button>
                          <button class="v3a-comments-iconbtn" type="button" aria-label="关闭" data-tooltip="关闭" @click="closeCommentEditor()">
                            <span class="v3a-icon" v-html="ICONS.closeSmall"></span>
                          </button>
                        </div>
                      </div>

                      <div class="bd v3a-comments-detail-shell" data-tour="comments-detail">
                        <div v-if="!commentEditorOpen" class="v3a-comments-empty">
                          <span class="v3a-icon v3a-comments-empty-icon" v-html="ICONS.comments"></span>
                          <div class="v3a-muted">选择一条评论查看详情</div>
                        </div>

                        <template v-else>
                          <div v-if="commentEditorLoading" class="v3a-comments-empty">
                            <div class="v3a-muted">正在加载…</div>
                          </div>

                          <template v-else>
                            <div class="v3a-comments-detail-scroll">
                              <div class="v3a-comments-detail-inner">
                                <div v-if="commentEditorError" class="v3a-alert">{{ commentEditorError }}</div>

                                <div class="v3a-comments-main">
                                  <div class="v3a-comments-main-head">
                                    <div class="v3a-comments-avatar" :title="commentForm.mail || ''">
                                      <img v-if="commentForm.avatar" :src="commentForm.avatar" :alt="commentForm.author || ''" loading="lazy" referrerpolicy="no-referrer" @error="commentForm.avatar = ''" />
                                      <template v-else>
                                        {{ (String(commentForm.author || '?').trim() || '?').slice(0, 1).toUpperCase() }}
                                      </template>
                                    </div>
                                    <div class="v3a-comments-main-meta">
                                      <div class="v3a-comments-main-author">
                                        <span class="v3a-comments-main-name">{{ commentForm.author || '—' }}</span>
                                        <span v-if="Number(commentForm.parent || 0) > 0" class="v3a-comments-main-reply">回复</span>
                                      </div>
                                      <div class="v3a-comments-main-time">{{ formatTimeAgo(commentForm.created) }}</div>
                                    </div>
                                  </div>

                                  <div class="v3a-comments-content" v-html="v3aSimpleLinkHtml(commentForm.text)"></div>

                                  <a v-if="commentEditorPost && commentDetailPostUrl" class="v3a-comments-source" :href="commentDetailPostUrl" target="_blank" rel="noreferrer">
                                    <span class="v3a-comments-source-label">来源:</span>
                                    <span class="v3a-comments-source-title">{{ commentEditorPost.title || ('#' + commentForm.cid) }}</span>
                                    <span class="v3a-icon v3a-comments-source-arrow" v-html="ICONS.expand"></span>
                                  </a>
                                  <div v-else-if="commentEditorPost" class="v3a-comments-source">
                                    <span class="v3a-comments-source-label">来源:</span>
                                    <span class="v3a-comments-source-title">{{ commentEditorPost.title || ('#' + commentForm.cid) }}</span>
                                  </div>
                                </div>

                                <div class="v3a-comments-info-grid">
                                  <div v-if="commentForm.ip" class="v3a-comments-info-item">
                                    <div class="v3a-comments-info-label">IP 地址</div>
                                    <div class="v3a-comments-info-value">
                                      <span class="v3a-icon v3a-comments-info-icon" v-html="ICONS.mapPin"></span>
                                      <span class="v3a-comments-info-text">{{ commentForm.ip }}</span>
                                    </div>
                                  </div>
                                  <div v-if="commentDetailDeviceLabel" class="v3a-comments-info-item">
                                    <div class="v3a-comments-info-label">访问设备</div>
                                    <div class="v3a-comments-info-value">
                                      <span class="v3a-icon v3a-comments-info-icon" v-html="commentDetailDeviceIcon"></span>
                                      <span class="v3a-comments-info-text">{{ commentDetailDeviceLabel }}</span>
                                    </div>
                                  </div>
                                  <div v-if="commentForm.mail" class="v3a-comments-info-item">
                                    <div class="v3a-comments-info-label">电子邮箱</div>
                                    <a class="v3a-comments-info-link" :href="'mailto:' + commentForm.mail">
                                      <span class="v3a-icon v3a-comments-info-icon" v-html="ICONS.subscribe"></span>
                                      <span class="v3a-comments-info-text">{{ commentForm.mail }}</span>
                                    </a>
                                  </div>
                                  <div v-if="commentDetailAuthorUrl" class="v3a-comments-info-item">
                                    <div class="v3a-comments-info-label">站点地址</div>
                                    <a class="v3a-comments-info-link" :href="commentDetailAuthorUrl" target="_blank" rel="noreferrer">
                                      <span class="v3a-icon v3a-comments-info-icon" v-html="ICONS.globe"></span>
                                      <span class="v3a-comments-info-text">{{ commentForm.url }}</span>
                                    </a>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div class="v3a-comments-replybar">
                              <div class="v3a-comments-replywrap">
                                <div class="v3a-comments-replybox">
                                  <textarea ref="commentReplyEl" class="v3a-comments-replytextarea" rows="3" v-model="commentReplyText" placeholder="写下你的回复..." @keydown="onCommentReplyKeyDown"></textarea>
                                  <div class="v3a-comments-replycontrols">
                                    <div class="v3a-comments-emoji">
                                      <button class="v3a-comments-emoji-btn" type="button" aria-label="表情" data-tooltip="表情" @click="toggleCommentReplyEmoji()">
                                        <span class="v3a-icon" v-html="ICONS.smilePlus"></span>
                                      </button>
                                      <div v-if="commentReplyEmojiOpen" class="v3a-comments-emoji-panel">
                                        <button v-for="em in commentReplyEmojis" :key="em" class="v3a-comments-emoji-item" type="button" @click="insertCommentReplyEmoji(em)">{{ em }}</button>
                                      </div>
                                    </div>
                                    <div class="v3a-comments-send">
                                      <span class="v3a-comments-send-hint">Ctrl/⌘ + Enter 发送</span>
                                      <button class="v3a-btn primary v3a-btn-sm" type="button" @click="submitCommentReply()" :disabled="commentEditorSaving || !commentReplyText.trim()">发送回复</button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </template>
                        </template>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="routePath === '/pages/manage'">
              <div class="v3a-container">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarToggleTitle">
                      <span class="v3a-icon" v-html="sidebarToggleIcon"></span>
                    </button>
                    <div class="v3a-pagehead-title v3a-pagehead-title--path" :title="crumb">
                      <span v-if="crumbPath" class="v3a-pagehead-title-path">{{ crumbPath }}</span>
                      <span v-if="crumbPath" class="v3a-pagehead-title-sep"> / </span>
                      <span class="v3a-pagehead-title-current">{{ crumbCurrent || crumb }}</span>
                    </div>
                  </div>
                  <div class="v3a-pagehead-actions" data-tour="pages-manage-actions">
                    <button class="v3a-btn" type="button" @click="applyPagesFilters()" :disabled="pagesLoading">刷新</button>
                    <button class="v3a-actionbtn" type="button" title="新增页面" @click="openPageEditor(0)">
                      <span class="v3a-icon" v-html="ICONS.plus"></span>
                    </button>
                  </div>
                </div>

                <div class="v3a-posts-search">
                  <div class="v3a-searchbox">
                    <span class="v3a-searchbox-icon" v-html="ICONS.search"></span>
                    <input class="v3a-input" v-model="pagesFilters.keywords" @keyup.enter="applyPagesFilters()" placeholder="搜索标题..." />
                  </div>
                </div>

                <div class="v3a-card" data-tour="pages-manage-table">
                  <div class="bd" style="padding: 0;">
                    <div v-if="pagesLoading" class="v3a-muted" style="padding: 16px;">正在加载…</div>
                    <table v-else class="v3a-table">
                      <thead><tr><th>标题</th><th>状态</th><th>模板</th><th>日期</th><th>操作</th></tr></thead>
                      <tbody>
                        <tr v-for="p in pagesItems" :key="p.cid">
                          <td>
                            <a href="###" @click.prevent="openPageEditor(p.cid)" :style="{ display: 'inline-block', paddingLeft: (Number(p.levels || 0) * 12) + 'px' }">{{ p.title || ('#' + p.cid) }}</a>
                          </td>
                          <td>
                            <span class="v3a-pill" :class="getPageBadge(p).tone">{{ getPageBadge(p).text }}</span>
                          </td>
                          <td class="v3a-muted">{{ p.template || '—' }}</td>
                          <td>{{ formatTime(p.created, settingsData.site.timezone) }}</td>
                          <td style="white-space: nowrap;">
                            <button class="v3a-mini-btn" type="button" style="color: var(--v3a-danger);" @click="deletePage(p.cid)">删除</button>
                          </td>
                        </tr>
                        <tr v-if="!pagesItems.length">
                          <td colspan="5" class="v3a-muted" style="padding: 16px;">暂无页面</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="routePath === '/pages/edit'">
              <div class="v3a-container v3a-container-write">
                <div class="v3a-pagehead v3a-pagehead-sticky">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarToggleTitle">
                      <span class="v3a-icon" v-html="sidebarToggleIcon"></span>
                    </button>
                    <div class="v3a-pagehead-title v3a-pagehead-title--path" :title="crumb">
                      <span v-if="crumbPath" class="v3a-pagehead-title-path">{{ crumbPath }}</span>
                      <span v-if="crumbPath" class="v3a-pagehead-title-sep"> / </span>
                      <span class="v3a-pagehead-title-current">{{ crumbCurrent || crumb }}</span>
                    </div>
                  </div>
                  <div class="v3a-pagehead-actions">
                    <button class="v3a-iconbtn v3a-write-side-toggle" type="button" @click="toggleWriteSidebar()" :title="writeSidebarOpen ? '收起发布设置' : '展开发布设置'" data-tour="write-side-toggle">
                      <span class="v3a-icon" v-html="ICONS.settings"></span>
                    </button>
                    <button class="v3a-iconaction" type="button" @click="submitPage('save')" :disabled="pageSaving || pageLoading" aria-label="保存草稿" data-tooltip="保存草稿">
                      <span class="v3a-icon" v-html="ICONS.save"></span>
                    </button>
                    <button class="v3a-iconaction primary" type="button" @click="submitPage('publish')" :disabled="pageSaving || pageLoading" aria-label="发布" data-tooltip="发布">
                      <span class="v3a-icon" v-html="ICONS.send"></span>
                    </button>
                    <button v-if="pageForm.cid" class="v3a-actionbtn danger" type="button" @click="deletePage(pageForm.cid)" :disabled="pageSaving || pageLoading" aria-label="删除" data-tooltip="删除">
                      <span class="v3a-icon" v-html="ICONS.trash"></span>
                    </button>
                  </div>
                </div>

                <div v-if="pageLoading" class="v3a-muted">正在加载…</div>

                <div v-else class="v3a-write-shell" :class="{ 'side-open': writeSidebarOpen }">
                  <div class="v3a-write-main">
                    <div class="v3a-write-editor">
                      <div class="v3a-write-editor-header">
                        <input class="v3a-write-title" v-model="pageForm.title" placeholder="输入标题..." data-tour="write-page-title" />
                        <div class="v3a-write-subtitle">
                          <div class="v3a-write-subline">
                            <span class="v3a-write-baseurl">{{ pageSlugPrefix }}</span>
                            <template v-if="pageSlugHasSlug">
                              <input class="v3a-write-slug" v-model="pageForm.slug" placeholder="slug" :style="{ width: pageSlugInputWidth + 'ch' }" data-tour="write-page-slug" />
                              <button v-if="aiSlugAvailable" class="v3a-iconaction v3a-iconaction-sm" type="button" @click="generateAiSlugForPage()" :disabled="aiSlugLoading || !String(pageForm.title || '').trim()" aria-label="AI生成slug" data-tooltip="AI生成slug">
                                <span class="v3a-icon" v-html="ICONS.codeXml"></span>
                              </button>
                              <span v-if="pageSlugSuffix" class="v3a-write-baseurl v3a-write-baseurl-suffix">{{ pageSlugSuffix }}</span>
                            </template>
                          </div>
                        </div>
                      </div>
                      <div class="v3a-write-editor-content" data-tour="write-page-editor">
                        <div v-if="pageEditorType === 'vditor'" id="v3a-page-vditor" class="v3a-vditor"></div>
                        <textarea v-else id="v3a-page-text" ref="pageTextEl" class="v3a-write-textarea" v-model="pageForm.text" @input="autoSizePageText"></textarea>
                      </div>
                    </div>
                  </div>

                  <div class="v3a-write-side-mask" v-if="writeSidebarOpen" @click="toggleWriteSidebar(false)"></div>
                  <div class="v3a-write-side" :class="{ open: writeSidebarOpen }">
                    <div class="v3a-write-drawer-header">
                      <div class="v3a-write-drawer-title" role="heading" aria-level="1">页面设定</div>
                      <button class="v3a-write-drawer-close" type="button" @click="toggleWriteSidebar(false)" aria-label="close">
                        <span class="v3a-icon" v-html="ICONS.closeSmall"></span>
                      </button>
                    </div>
                    <div class="v3a-write-drawer-body">
                      <div class="v3a-write-section">
                        <div class="v3a-write-section-head">
                          <span class="v3a-icon" v-html="ICONS.files"></span>
                          <span class="v3a-write-section-title">页面设置</span>
                        </div>

                        <div class="v3a-write-formitem">
                          <label class="v3a-write-label">父级页面</label>
                          <select class="v3a-select" v-model.number="pageForm.parent">
                            <option v-for="p in pageParentOptions" :key="p.cid" :value="p.cid">
                              {{ (p.levels ? '—'.repeat(Number(p.levels)) + ' ' : '') + p.title }}
                            </option>
                          </select>
                        </div>

                        <div class="v3a-write-formitem">
                          <label class="v3a-write-label">自定义模板</label>
                          <select class="v3a-select" v-model="pageForm.template">
                            <option value="">默认</option>
                            <option v-for="t in pageTemplates" :key="t.value" :value="t.value">{{ t.label }}</option>
                          </select>
                        </div>

                        <div class="v3a-write-formitem">
                          <label class="v3a-write-label">排序</label>
                          <input class="v3a-input" type="number" v-model.number="pageForm.order" />
                        </div>
                      </div>

                      <div class="v3a-divider"></div>

                      <div class="v3a-kv">
                        <div class="v3a-write-section-head" style="grid-column: 1 / -1;">
                          <span class="v3a-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings-icon lucide-settings"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg></span>
                          <span class="v3a-write-section-title">内容选项</span>
                        </div>

                        <div class="v3a-muted">可见性</div>
                        <select class="v3a-select" v-model="pageForm.visibility">
                          <option value="publish">公开</option>
                          <option value="hidden">隐藏</option>
                        </select>

                        <div class="v3a-muted">Markdown</div>
                        <label class="v3a-remember" style="justify-content:flex-start;">
                          <input class="v3a-check" type="checkbox" v-model="pageForm.markdown" :disabled="!pageCapabilities.markdownEnabled" />
                          <span>{{ pageCapabilities.markdownEnabled ? '启用' : '未开启' }}</span>
                        </label>

                        <div class="v3a-kv-span" data-tour="write-page-permissions">
                          <div class="v3a-muted">权限</div>
                          <div class="v3a-kv-inline">
                            <label class="v3a-remember" style="margin: 0;">
                              <input class="v3a-check" type="checkbox" v-model="pageForm.allowComment" />
                              <span>允许评论</span>
                            </label>
                            <label class="v3a-remember" style="margin: 0;">
                              <input class="v3a-check" type="checkbox" v-model="pageForm.allowPing" />
                              <span>允许引用</span>
                            </label>
                            <label class="v3a-remember" style="margin: 0;">
                              <input class="v3a-check" type="checkbox" v-model="pageForm.allowFeed" />
                              <span>允许聚合</span>
                            </label>
                          </div>
                        </div>
                      </div>

                      <div class="v3a-divider"></div>
                      <div class="v3a-muted" style="margin: calc(var(--spacing) * 4) 0;">发布权限：{{ pageCapabilities.canPublish ? '可直接发布' : '无权限' }}</div>

                      <div data-tour="write-page-fields">
                      <template v-if="pageDefaultFields.length">
                        <div class="v3a-write-section-head" style="margin-top: calc(var(--spacing) * 6);">
                          <span class="v3a-icon" v-html="ICONS.settings"></span>
                          <span class="v3a-write-section-title">主题字段</span>
                        </div>

                        <div v-for="f in pageDefaultFields" :key="'page-df-' + f.name" class="v3a-write-formitem">
                          <label class="v3a-write-label">{{ f.label || f.name }}</label>

                          <input
                            v-if="f.inputType === 'text' || f.inputType === 'url' || f.inputType === 'password' || f.inputType === 'number'"
                            class="v3a-input"
                            :type="f.inputType === 'number' ? 'number' : f.inputType"
                            v-model="f.value"
                            :placeholder="f.placeholder || ''"
                          />
                          <textarea
                            v-else-if="f.inputType === 'textarea'"
                            class="v3a-textarea v3a-modal-textarea"
                            style="min-height: 90px;"
                            v-model="f.value"
                            :placeholder="f.placeholder || ''"
                          ></textarea>
                          <select v-else-if="f.inputType === 'select' || f.inputType === 'radio'" class="v3a-select" v-model="f.value">
                            <option v-for="opt in (f.options || [])" :key="String(opt.value)" :value="opt.value">{{ opt.label }}</option>
                          </select>
                          <div v-else-if="f.inputType === 'checkbox'" style="display:flex; flex-direction: column; gap: 8px;">
                            <label v-for="opt in (f.options || [])" :key="String(opt.value)" class="v3a-remember" style="justify-content:flex-start; margin: 0;">
                              <input class="v3a-check" type="checkbox" :value="opt.value" v-model="f.value" />
                              <span>{{ opt.label }}</span>
                            </label>
                          </div>
                          <input v-else class="v3a-input" v-model="f.value" :placeholder="f.placeholder || ''" />

                          <div v-if="f.description" class="v3a-muted" style="font-size: 12px;">{{ f.description }}</div>
                        </div>
                      </template>

                      <div style="display:flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <div class="v3a-write-section-head" style="margin: 0;">
                          <span class="v3a-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-hash-icon lucide-hash"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg></span>
                          <span class="v3a-write-section-title">自定义字段</span>
                        </div>
                        <button class="v3a-mini-btn" type="button" @click="addPageField()">新增字段</button>
                      </div>

                      <div class="v3a-card" style="margin-top: 12px;">
                        <div class="bd" style="padding: 0;">
                          <table class="v3a-table">
                            <thead>
                              <tr>
                                <th>名称</th>
                                <th style="width: 90px;">类型</th>
                                <th>值</th>
                                <th style="width: 80px;">操作</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr v-for="(f, idx) in pageForm.fields" :key="idx">
                                <td><input class="v3a-input" v-model="f.name" placeholder="字段名（a-z0-9_）" /></td>
                                <td>
                                  <select class="v3a-select" v-model="f.type">
                                    <option value="str">文本</option>
                                    <option value="int">整数</option>
                                    <option value="float">小数</option>
                                    <option value="json">JSON</option>
                                  </select>
                                </td>
                                <td>
                                  <button class="v3a-mini-btn" type="button" @click="openJsonFieldEditor('page', idx)">编辑</button>
                                </td>
                                <td>
                                  <button class="v3a-mini-btn" type="button" style="color: var(--v3a-danger);" @click="removePageField(idx)">删除</button>
                                </td>
                              </tr>
                              <tr v-if="!pageForm.fields.length">
                                <td colspan="4" class="v3a-muted">暂无自定义字段</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="routePath === '/files'">
              <div class="v3a-container v3a-container-files">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarToggleTitle">
                      <span class="v3a-icon" v-html="sidebarToggleIcon"></span>
                    </button>
                    <div class="v3a-pagehead-title v3a-pagehead-title--path" :title="crumb">
                      <span v-if="crumbPath" class="v3a-pagehead-title-path">{{ crumbPath }}</span>
                      <span v-if="crumbPath" class="v3a-pagehead-title-sep"> / </span>
                      <span class="v3a-pagehead-title-current">{{ crumbCurrent || crumb }}</span>
                    </div>
                  </div>
                  <div class="v3a-pagehead-actions" data-tour="files-actions">
                    <button
                      class="v3a-actionbtn primary"
                      type="button"
                      :class="{ active: filesSelectMode }"
                      :title="filesSelectMode ? '退出多选' : '多选'"
                      @click="toggleFilesSelectMode()"
                    >
                      <span class="v3a-icon" v-html="ICONS.checkCheck"></span>
                    </button>
                    <button class="v3a-actionbtn danger" type="button" title="删除多条" :disabled="!filesSelectMode || !filesSelectedIds.length" @click="deleteSelectedFiles()">
                      <span class="v3a-icon" v-html="ICONS.trash"></span>
                    </button>
                    <button v-if="!V3A.acl || !V3A.acl.files || Number(V3A.acl.files.upload)" class="v3a-actionbtn primary" type="button" title="上传文件" :disabled="filesUploading" @click="openFilesUploadModal()">
                      <span class="v3a-icon" v-html="ICONS.upload"></span>
                    </button>
                    <button class="v3a-actionbtn" type="button" title="刷新" :disabled="filesLoading" @click="refreshFiles()">
                      <span class="v3a-icon" v-html="ICONS.refreshCw"></span>
                    </button>
                    <button class="v3a-actionbtn" type="button" title="编辑（占位）" disabled>
                      <span class="v3a-icon" v-html="ICONS.edit"></span>
                    </button>
                  </div>
                </div>

                <div class="v3a-posts-search">
                  <div class="v3a-searchbox">
                    <span class="v3a-searchbox-icon" v-html="ICONS.search"></span>
                    <input class="v3a-input" v-model="filesKeywords" @keyup.enter="applyFilesFilters()" placeholder="搜索文件名..." />
                  </div>
                </div>

                <div class="v3a-card v3a-files-card">
                  <div class="v3a-files-scroll">
                    <div v-if="filesLoading" class="v3a-muted">正在加载…</div>

                    <div v-else class="v3a-filegrid" data-tour="files-grid">
                      <div
                        class="v3a-fileitem"
                        v-for="f in filesItems"
                        :key="f.cid"
                        :class="{ 'select-mode': filesSelectMode, selected: filesSelectMode && isFileSelected(f.cid) }"
                        @click="onFileItemActivate(f)"
                        @keydown.enter.self.prevent="onFileItemActivate(f)"
                        @keydown.space.self.prevent="onFileItemActivate(f)"
                        role="button"
                        tabindex="0"
                        :aria-label="fileTitleFor(f)"
                      >
                        <img v-if="isFileImage(f) && fileUrlFor(f)" :src="fileUrlFor(f)" alt="" loading="lazy" />
                        <video v-else-if="isFileVideo(f) && fileUrlFor(f)" :src="fileUrlFor(f)" muted playsinline preload="metadata"></video>
                        <div v-else class="v3a-filethumb-fallback">
                          <span class="v3a-icon" v-html="ICONS.files"></span>
                        </div>

                        <button
                          v-if="filesSelectMode"
                          class="v3a-fileselect"
                          type="button"
                          :class="{ selected: isFileSelected(f.cid) }"
                          :aria-label="isFileSelected(f.cid) ? '取消选择' : '选择'"
                          @click.stop="toggleFileSelected(f.cid)"
                          v-html="isFileSelected(f.cid) ? ICONS.squareCheck : ICONS.square"
                        ></button>

                        <div class="v3a-filethumb-overlay">
                          <div class="v3a-filethumb-name">{{ fileTitleFor(f) }}</div>
                          <div class="v3a-filethumb-actions">
                            <button class="v3a-filethumb-action" type="button" aria-label="Copy link" @click.stop="copyText(fileUrlFor(f))">
                              <span class="v3a-icon" v-html="ICONS.copy"></span>
                            </button>
                            <a class="v3a-filethumb-action" :href="fileUrlFor(f)" target="_blank" rel="noreferrer" aria-label="Open" @click.stop>
                              <span class="v3a-icon" v-html="ICONS.externalLink"></span>
                            </a>
                            <button class="v3a-filethumb-action danger" type="button" aria-label="Delete" @click.stop="deleteFile(f.cid)">
                              <span class="v3a-icon" v-html="ICONS.trash"></span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div v-if="!filesLoading && !filesItems.length" class="v3a-muted" style="margin-top: 10px;">暂无文件</div>

                  </div>

                  <div class="v3a-files-pager">
                      <button class="v3a-btn" type="button" @click="filesGoPage(filesPagination.page - 1)" :disabled="filesPagination.page <= 1">上一页</button>
                      <div class="v3a-muted">第 {{ filesPagination.page }} / {{ filesPagination.pageCount }} 页 · 共 {{ formatNumber(filesPagination.total) }} 条</div>
                      <button class="v3a-btn" type="button" @click="filesGoPage(filesPagination.page + 1)" :disabled="filesPagination.page >= filesPagination.pageCount">下一页</button>
                    </div>
                </div>

                <div v-if="filePreviewOpen" class="v3a-modal-mask" @click.self="closeFilePreview()">
                  <div class="v3a-modal-card v3a-file-preview-modal" role="dialog" aria-modal="true">
                    <button class="v3a-modal-close" type="button" aria-label="关闭" @click="closeFilePreview()">
                      <span class="v3a-icon" v-html="ICONS.closeSmall"></span>
                    </button>
                    <div class="v3a-modal-head">
                      <div class="v3a-modal-title">{{ fileTitleFor(filePreviewItem) }}</div>
                    </div>
                    <div class="v3a-modal-body">
                      <div class="v3a-file-preview-body">
                        <img v-if="filePreviewIsImage" :src="filePreviewUrl" alt="" />
                        <video v-else-if="filePreviewIsVideo" :src="filePreviewUrl" controls playsinline></video>
                      </div>
                      <div class="v3a-muted" style="text-align:center; margin-top: 12px;">
                        {{ fileMetaFor(filePreviewItem) }}
                      </div>
                    </div>
                  </div>
                </div>

                <div v-if="filesUploadModalOpen" class="v3a-modal-mask" @click.self="closeFilesUploadModal()">
                  <div class="v3a-modal-card v3a-files-upload-modal" role="dialog" aria-modal="true">
                    <button class="v3a-modal-close" type="button" aria-label="关闭" @click="closeFilesUploadModal()">
                      <span class="v3a-icon" v-html="ICONS.closeSmall"></span>
                    </button>
                    <div class="v3a-modal-head">
                      <div class="v3a-modal-title">上传文件</div>
                    </div>
                    <div class="v3a-modal-body">
                      <div
                        class="v3a-files-upload-dragger"
                        :class="{ dragging: filesUploadDragging, busy: filesUploading }"
                        @click="filesUploadInputEl && filesUploadInputEl.click()"
                        @dragenter.prevent="filesUploadDragging = true"
                        @dragover.prevent="filesUploadDragging = true"
                        @dragleave.prevent="filesUploadDragging = false"
                        @drop.prevent="onFilesUploadDrop($event)"
                      >
                        <input ref="filesUploadInputEl" type="file" multiple style="display:none;" @change="onFilesUploadInputChange($event)" />
                        <div class="v3a-files-upload-icon" v-html="ICONS.upload"></div>
                        <div class="v3a-files-upload-title">点击或拖动文件到该区域来上传</div>
                        <div class="v3a-muted">支持图片/媒体/文档（由 Typecho 允许的附件类型决定）</div>
                      </div>
                      <div v-if="filesError" class="v3a-feedback" style="margin-top: 12px;">{{ filesError }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="routePath === '/friends'">
              <div class="v3a-container v3a-container-friends">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarToggleTitle">
                      <span class="v3a-icon" v-html="sidebarToggleIcon"></span>
                    </button>
                    <div class="v3a-pagehead-title v3a-pagehead-title--path" :title="crumb">
                      <span v-if="crumbPath" class="v3a-pagehead-title-path">{{ crumbPath }}</span>
                      <span v-if="crumbPath" class="v3a-pagehead-title-sep"> / </span>
                      <span class="v3a-pagehead-title-current">{{ crumbCurrent || crumb }}</span>
                    </div>
                  </div>
                  <div class="v3a-pagehead-actions" data-tour="friends-actions">
                    <button class="v3a-iconaction primary" type="button" title="新增友链" @click="openFriendEditor(null)">
                      <span class="v3a-icon" v-html="ICONS.plus"></span>
                    </button>
                    <button class="v3a-actionbtn primary" type="button" title="检查友链可用性" :disabled="friendsHealthChecking" @click="checkFriendsHealth()">
                      <span class="v3a-icon" v-html="ICONS.check"></span>
                    </button>
                    <button class="v3a-actionbtn primary" type="button" title="迁移头像" :disabled="friendsMigrateWorking" @click="migrateFriendAvatars()">
                      <span class="v3a-icon" v-html="ICONS.refreshCw"></span>
                    </button>
                    <button class="v3a-actionbtn" type="button" title="设置" @click="openFriendsSettings()">
                      <span class="v3a-icon" v-html="ICONS.gear"></span>
                    </button>
                  </div>
                </div>

                <div class="v3a-friends-tabs" data-tour="friends-tabs">
                  <button class="v3a-friends-tab" :class="{ active: friendsState === 0 }" type="button" @click="setFriendsState(0)">
                    <span>朋友们</span>
                    <span class="v3a-friends-count">{{ formatNumber(friendsStateCount.friends || 0) }}</span>
                  </button>
                  <button class="v3a-friends-tab" :class="{ active: friendsState === 1 }" type="button" @click="setFriendsState(1)">
                    <span>待审核</span>
                    <span class="v3a-friends-count danger">{{ formatNumber(friendsStateCount.audit || 0) }}</span>
                  </button>
                  <button class="v3a-friends-tab" :class="{ active: friendsState === 2 }" type="button" @click="setFriendsState(2)">
                    <span>过时的</span>
                    <span class="v3a-friends-count">{{ formatNumber(friendsStateCount.outdate || 0) }}</span>
                  </button>
                  <button class="v3a-friends-tab" :class="{ active: friendsState === 3 }" type="button" @click="setFriendsState(3)">
                    <span>已拒绝</span>
                    <span class="v3a-friends-count">{{ formatNumber(friendsStateCount.reject || 0) }}</span>
                  </button>
                  <button class="v3a-friends-tab" :class="{ active: friendsState === 4 }" type="button" @click="setFriendsState(4)">
                    <span>封禁的</span>
                    <span class="v3a-friends-count">{{ formatNumber(friendsStateCount.banned || 0) }}</span>
                  </button>
                </div>

                <div class="v3a-card v3a-friends-tablecard" data-tour="friends-table">
                  <div class="bd" style="padding: 0;">
                    <div v-if="friendsError" class="v3a-alert" style="margin: 16px;">{{ friendsError }}</div>
                    <div v-else-if="friendsLoading" class="v3a-muted" style="padding: 16px;">正在加载…</div>

                    <table v-else class="v3a-table v3a-friends-table">
                      <thead>
                        <tr>
                          <th style="width: 80px;">头像</th>
                          <th>名称</th>
                          <th style="width: 250px;">描述</th>
                          <th>网址</th>
                          <th style="width: 80px;">类型</th>
                          <th>对方邮箱</th>
                          <th style="width: 80px;">结识时间</th>
                          <th style="width: 150px; text-align: right;">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="row in friendsItems" :key="row.source + '-' + row.id">
                          <td style="width: 80px;">
                            <div class="v3a-friends-avatar">
                              <img v-if="row.avatar" :src="row.avatar" alt="" loading="eager" />
                              <span v-else class="v3a-friends-avatar-text">{{ friendInitial(row.name) }}</span>
                            </div>
                          </td>
                          <td>
                            <a v-if="row.url" :href="row.url" target="_blank" rel="noreferrer" class="v3a-friends-name">{{ row.name || '—' }}</a>
                            <span v-else>{{ row.name || '—' }}</span>
                          </td>
                          <td style="width: 250px;">
                            <div class="v3a-friends-desc">{{ row.description || '—' }}</div>
                            <div v-if="row.source === 'apply' && row.message" class="v3a-muted v3a-friends-message">{{ row.message }}</div>
                          </td>
                          <td style="word-break: break-all;">
                            <a v-if="row.url" :href="row.url" target="_blank" rel="noreferrer">{{ row.url }}</a>
                            <span v-else class="v3a-muted">—</span>
                            <div v-if="friendsHealth && friendsHealth[row.id]" class="v3a-muted v3a-friends-health">{{ friendsHealth[row.id].message || '' }}</div>
                          </td>
                          <td style="width: 80px;">{{ friendTypeLabel(row.type) }}</td>
                          <td>
                            <a v-if="row.email" :href="'mailto:' + row.email" class="v3a-muted">{{ row.email }}</a>
                            <span v-else class="v3a-muted">—</span>
                          </td>
                          <td style="width: 80px;"><span>{{ formatTimeAgo(row.created) }}</span></td>
                          <td style="width: 150px; text-align: right;">
                            <template v-if="friendsState === 1">
                              <button class="v3a-mini-btn primary" type="button" @click="auditFriendApply(row, 'pass')">通过</button>
                              <button class="v3a-mini-btn v3a-link-danger" type="button" @click="auditFriendApply(row, 'reject')">拒绝</button>
                            </template>
                            <template v-else-if="friendsState === 3">
                              <button class="v3a-mini-btn v3a-link-danger" type="button" @click="deleteFriendApply(row)">移除</button>
                            </template>
                            <template v-else>
                              <button class="v3a-mini-btn" type="button" @click="openFriendEditor(row)">编辑</button>
                              <button class="v3a-mini-btn v3a-link-danger" type="button" @click="deleteFriend(row)">移除</button>
                            </template>
                          </td>
                        </tr>
                        <tr v-if="!friendsItems.length">
                          <td colspan="8" class="v3a-muted" style="padding: 16px;">暂无数据</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div class="v3a-pagination">
                  <button class="v3a-pagebtn" type="button" @click="friendsGoPage(friendsPagination.page - 1)" :disabled="friendsPagination.page <= 1">
                    <span class="v3a-icon" v-html="ICONS.collapse"></span>
                  </button>
                  <div class="v3a-pagecurrent">{{ friendsPagination.page }}</div>
                  <button class="v3a-pagebtn" type="button" @click="friendsGoPage(friendsPagination.page + 1)" :disabled="friendsPagination.page >= friendsPagination.pageCount">
                    <span class="v3a-icon" v-html="ICONS.expand"></span>
                  </button>
                  <span class="v3a-muted">跳至</span>
                  <input class="v3a-pagejump" type="number" min="1" :max="friendsPagination.pageCount" v-model.number="friendsPageJump" @keyup.enter="friendsGoPage(friendsPageJump)" @blur="friendsGoPage(friendsPageJump)" />
                </div>

                <div v-if="friendsSettingsOpen" class="v3a-modal-mask" @click.self="closeFriendsSettings()">
                  <div class="v3a-modal-card" role="dialog" aria-modal="true">
                    <button class="v3a-modal-close" type="button" aria-label="关闭" @click="closeFriendsSettings()">
                      <span class="v3a-icon" v-html="ICONS.closeSmall"></span>
                    </button>
                    <div class="v3a-modal-head">
                      <div class="v3a-modal-title">友链设置</div>
                    </div>
                    <div class="v3a-modal-body">
                      <div v-if="friendsSettingsError" class="v3a-feedback" style="margin-bottom: 12px;">{{ friendsSettingsError }}</div>
                      <div v-else-if="friendsSettingsLoading" class="v3a-muted" style="margin-bottom: 12px;">正在加载…</div>

                      <div class="v3a-modal-form">
                        <div class="v3a-modal-item">
                          <label class="v3a-modal-label">允许访客选择类型</label>
                          <label class="v3a-switch">
                            <input type="checkbox" v-model="friendsSettingsForm.allowTypeSelect" :true-value="1" :false-value="0" />
                            <span class="v3a-switch-ui"></span>
                          </label>
                          <div class="v3a-muted" style="font-size: 12px;">关闭时，前台申请将使用默认类型。</div>
                        </div>

                        <div class="v3a-modal-item">
                          <label class="v3a-modal-label">允许的类型</label>
                          <div style="display: flex; flex-wrap: wrap; gap: 14px;">
                            <label style="display: inline-flex; align-items: center; gap: 8px;">
                              <input class="v3a-check" type="checkbox" v-model="friendsSettingsForm.allowedTypes.friend" :true-value="1" :false-value="0" />
                              <span>朋友</span>
                            </label>
                            <label style="display: inline-flex; align-items: center; gap: 8px;">
                              <input class="v3a-check" type="checkbox" v-model="friendsSettingsForm.allowedTypes.collection" :true-value="1" :false-value="0" />
                              <span>收藏</span>
                            </label>
                          </div>
                          <div class="v3a-muted" style="font-size: 12px;">至少保留一种类型。</div>
                        </div>

                        <div class="v3a-modal-item">
                          <label class="v3a-modal-label">默认类型</label>
                          <select class="v3a-select v3a-modal-input" v-model="friendsSettingsForm.defaultType">
                            <option value="friend" :disabled="!friendsSettingsForm.allowedTypes.friend">朋友</option>
                            <option value="collection" :disabled="!friendsSettingsForm.allowedTypes.collection">收藏</option>
                          </select>
                        </div>

                        <div class="v3a-modal-item">
                          <label class="v3a-modal-label">前台申请必填项</label>
                          <div class="v3a-muted" style="font-size: 12px;">名称/网址始终必填。</div>
                          <div style="display: flex; flex-wrap: wrap; gap: 14px;">
                            <label style="display: inline-flex; align-items: center; gap: 8px;">
                              <input class="v3a-check" type="checkbox" v-model="friendsSettingsForm.required.email" :true-value="1" :false-value="0" />
                              <span>邮箱</span>
                            </label>
                            <label style="display: inline-flex; align-items: center; gap: 8px;">
                              <input class="v3a-check" type="checkbox" v-model="friendsSettingsForm.required.avatar" :true-value="1" :false-value="0" />
                              <span>头像</span>
                            </label>
                            <label style="display: inline-flex; align-items: center; gap: 8px;">
                              <input class="v3a-check" type="checkbox" v-model="friendsSettingsForm.required.description" :true-value="1" :false-value="0" />
                              <span>描述</span>
                            </label>
                            <label style="display: inline-flex; align-items: center; gap: 8px;">
                              <input class="v3a-check" type="checkbox" v-model="friendsSettingsForm.required.message" :true-value="1" :false-value="0" />
                              <span>留言</span>
                            </label>
                          </div>
                        </div>
                      </div>

                      <div class="v3a-modal-actions">
                        <button class="v3a-btn v3a-modal-btn" type="button" @click="closeFriendsSettings()" :disabled="friendsSettingsSaving">取消</button>
                        <button class="v3a-btn primary v3a-modal-btn" type="button" @click="saveFriendsSettings()" :disabled="friendsSettingsSaving || friendsSettingsLoading">{{ friendsSettingsSaving ? '保存中…' : '确定' }}</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-if="friendEditorOpen" class="v3a-modal-mask" @click.self="closeFriendEditor()">
                  <div class="v3a-modal-card" role="dialog" aria-modal="true">
                    <button class="v3a-modal-close" type="button" aria-label="关闭" @click="closeFriendEditor()">
                      <span class="v3a-icon" v-html="ICONS.closeSmall"></span>
                    </button>
                    <div class="v3a-modal-head">
                      <div class="v3a-modal-title">{{ friendEditorForm.id ? '编辑友链' : '新增友链' }}</div>
                    </div>
                    <div class="v3a-modal-body">
                      <div class="v3a-modal-form">
                        <div class="v3a-modal-item">
                          <label class="v3a-modal-label">名称<span class="v3a-required">*</span></label>
                          <input class="v3a-input v3a-modal-input" v-model="friendEditorForm.name" placeholder="输入名称..." />
                        </div>
                        <div class="v3a-modal-item">
                          <label class="v3a-modal-label">网址<span class="v3a-required">*</span></label>
                          <input class="v3a-input v3a-modal-input" v-model="friendEditorForm.url" placeholder="https://example.com" />
                        </div>
                        <div class="v3a-modal-item">
                          <label class="v3a-modal-label">描述</label>
                          <input class="v3a-input v3a-modal-input" v-model="friendEditorForm.description" placeholder="可留空..." />
                        </div>
                        <div class="v3a-modal-item">
                          <label class="v3a-modal-label">头像</label>
                          <input class="v3a-input v3a-modal-input" v-model="friendEditorForm.avatar" placeholder="https://... 或 data:image/..." />
                        </div>
                        <div class="v3a-modal-item">
                          <label class="v3a-modal-label">邮箱</label>
                          <input class="v3a-input v3a-modal-input" v-model="friendEditorForm.email" placeholder="可留空..." />
                        </div>
                        <div class="v3a-modal-item">
                          <label class="v3a-modal-label">类型</label>
                          <select class="v3a-select v3a-modal-input" v-model="friendEditorForm.type">
                            <option value="friend">朋友</option>
                            <option value="collection">收藏</option>
                          </select>
                        </div>
                        <div class="v3a-modal-item">
                          <label class="v3a-modal-label">状态</label>
                          <select class="v3a-select v3a-modal-input" v-model.number="friendEditorForm.status">
                            <option :value="1">朋友们</option>
                            <option :value="2">过时的</option>
                            <option :value="3">封禁的</option>
                          </select>
                        </div>
                      </div>

                      <div v-if="friendEditorError" class="v3a-feedback" style="margin-top: 12px;">{{ friendEditorError }}</div>

                      <div class="v3a-modal-actions">
                        <button class="v3a-btn v3a-modal-btn" type="button" @click="closeFriendEditor()" :disabled="friendEditorSaving">取消</button>
                        <button class="v3a-btn primary v3a-modal-btn" type="button" @click="submitFriendEditor()" :disabled="friendEditorSaving">{{ friendEditorSaving ? '保存中…' : '确定' }}</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="routePath === '/data'">
              <div class="v3a-container">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarToggleTitle">
                      <span class="v3a-icon" v-html="sidebarToggleIcon"></span>
                    </button>
                    <div class="v3a-pagehead-title v3a-pagehead-title--path" :title="crumb">
                      <span v-if="crumbPath" class="v3a-pagehead-title-path">{{ crumbPath }}</span>
                      <span v-if="crumbPath" class="v3a-pagehead-title-sep"> / </span>
                      <span class="v3a-pagehead-title-current">{{ crumbCurrent || crumb }}</span>
                    </div>
                  </div>
                  <div class="v3a-pagehead-actions" data-tour="data-actions">
                    <button class="v3a-actionbtn" type="button" title="刷新" :disabled="dataVisitLoading" @click="refreshData()">
                      <span class="v3a-icon" v-html="ICONS.refreshCw"></span>
                    </button>
                  </div>
                </div>

                <div class="v3a-posts-search" data-tour="data-filters">
                  <div class="v3a-searchbox">
                    <span class="v3a-searchbox-icon" v-html="ICONS.search"></span>
                    <input class="v3a-input" v-model="dataVisitFilters.keywords" @keyup.enter="applyDataVisitFilters()" placeholder="搜索 IP / 路径 / 来源..." />
                  </div>
                  <select class="v3a-select" v-model="dataVisitFilters.onlyPosts" @change="applyDataVisitFilters()" style="width: 140px;">
                    <option :value="false">全部访问</option>
                    <option :value="true">仅文章</option>
                  </select>
                  <button class="v3a-btn" type="button" @click="applyDataVisitFilters()" :disabled="dataVisitLoading">搜索</button>
                  <div class="v3a-muted">{{ formatNumber(dataVisitPagination.total) }} 条</div>
                </div>

                <div class="v3a-section">
                  <div class="v3a-section-hd">
                    <div class="v3a-section-title">数据图表</div>
                  </div>
                  <div class="v3a-section-line"></div>

                  <div class="v3a-chartsgrid">
                    <div class="v3a-chartcard">
                      <div class="v3a-charthead">
                        <div class="v3a-charttitle">发布趋势</div>
                        <span class="v3a-charticon" v-html="ICONS.trending"></span>
                      </div>
                      <div id="v3a-chart-publish" class="v3a-chart"></div>
                    </div>

                    <div class="v3a-chartcard">
                      <div class="v3a-charthead">
                        <div class="v3a-charttitle">分类分布</div>
                        <span class="v3a-charticon" v-html="ICONS.pie"></span>
                      </div>
                      <div id="v3a-chart-category" class="v3a-chart"></div>
                    </div>

                    <div class="v3a-chartcard">
                      <div class="v3a-charthead">
                        <div class="v3a-charttitle">评论活跃度（近30天）</div>
                        <span class="v3a-charticon" v-html="ICONS.comments"></span>
                      </div>
                      <div id="v3a-chart-comment" class="v3a-chart"></div>
                    </div>

                    <div class="v3a-chartcard">
                      <div class="v3a-charthead">
                        <div class="v3a-charttitle">关系图谱</div>
                        <span class="v3a-charticon" v-html="ICONS.tags"></span>
                      </div>
                      <div id="v3a-chart-tag" class="v3a-chart"></div>
                      <div v-if="!tagGraph.nodes.length" class="v3a-empty">暂无数据</div>
                    </div>

                    <div class="v3a-chartcard">
                      <div class="v3a-charthead">
                        <div class="v3a-charttitle">本周访问趋势</div>
                        <span class="v3a-muted">PV / IP 对比</span>
                      </div>
                      <div id="v3a-chart-visit-week" class="v3a-chart"></div>
                    </div>

                    <div class="v3a-chartcard">
                      <div class="v3a-charthead">
                        <div class="v3a-charttitle">最近 {{ dataVisitTraffic.windowDays || 14 }} 天访问趋势</div>
                        <span class="v3a-muted">Views / UV 对比</span>
                      </div>
                      <div id="v3a-chart-data-traffic-trend" class="v3a-chart"></div>
                      <div v-if="dataVisitLoading" class="v3a-empty">正在加载…</div>
                      <div v-else-if="!dataVisitTraffic.trend || !dataVisitTraffic.trend.length" class="v3a-empty">暂无数据</div>
                    </div>

                    <div class="v3a-chartcard">
                      <div class="v3a-charthead">
                        <div class="v3a-charttitle">Referring sites（最近 {{ dataVisitTraffic.windowDays || 14 }} 天）</div>
                        <span class="v3a-charticon" v-html="ICONS.globe"></span>
                      </div>
                      <div id="v3a-chart-data-traffic-referring" class="v3a-chart"></div>
                      <div v-if="dataVisitLoading" class="v3a-empty">正在加载…</div>
                      <div v-else-if="!dataVisitTraffic.referringSites || !dataVisitTraffic.referringSites.length" class="v3a-empty">暂无数据</div>
                    </div>

                    <div class="v3a-chartcard">
                      <div class="v3a-charthead">
                        <div class="v3a-charttitle">Popular content（最近 {{ dataVisitTraffic.windowDays || 14 }} 天）</div>
                        <span class="v3a-charticon" v-html="ICONS.posts"></span>
                      </div>
                      <div id="v3a-chart-data-traffic-popular" class="v3a-chart"></div>
                      <div v-if="dataVisitLoading" class="v3a-empty">正在加载…</div>
                      <div v-else-if="!dataVisitTraffic.popularContent || !dataVisitTraffic.popularContent.length" class="v3a-empty">暂无数据</div>
                    </div>
                  </div>
                </div>

                <div class="v3a-grid two" style="margin-bottom: 12px;">
                  <div>
                    <div class="v3a-muted" style="font-weight: 500; margin-bottom: 8px;">Referring sites（最近 {{ dataVisitTraffic.windowDays || 14 }} 天）</div>
                    <div class="v3a-card">
                      <div class="bd" style="padding: 0;">
                        <div v-if="dataVisitLoading" class="v3a-muted" style="padding: 16px;">正在加载…</div>
                        <div v-else-if="!dataVisitTraffic.referringSites || !dataVisitTraffic.referringSites.length" class="v3a-muted" style="padding: 16px;">暂无来源数据</div>
                        <table v-else class="v3a-table">
                          <thead>
                            <tr>
                              <th>Site</th>
                              <th style="text-align:right;">Views</th>
                              <th style="text-align:right;">Unique Visitors</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="(s, idx) in dataVisitTraffic.referringSites" :key="(s && s.site ? s.site : '') + ':' + idx">
                              <td style="word-break: break-all;">
                                <a :href="'https://' + (s && s.site ? s.site : '')" target="_blank" rel="noreferrer">{{ s && s.site ? s.site : '—' }}</a>
                              </td>
                              <td style="text-align:right; white-space: nowrap;">{{ formatNumber(s && s.views ? s.views : 0) }}</td>
                              <td style="text-align:right; white-space: nowrap;">{{ formatNumber(s && s.uv ? s.uv : 0) }}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div class="v3a-muted" style="font-weight: 500; margin-bottom: 8px;">Popular content（最近 {{ dataVisitTraffic.windowDays || 14 }} 天）</div>
                    <div class="v3a-card">
                      <div class="bd" style="padding: 0;">
                        <div v-if="dataVisitLoading" class="v3a-muted" style="padding: 16px;">正在加载…</div>
                        <div v-else-if="!dataVisitTraffic.popularContent || !dataVisitTraffic.popularContent.length" class="v3a-muted" style="padding: 16px;">暂无热门内容</div>
                        <table v-else class="v3a-table">
                          <thead>
                            <tr>
                              <th>Content</th>
                              <th style="text-align:right;">Views</th>
                              <th style="text-align:right;">Unique Visitors</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="(p, idx) in dataVisitTraffic.popularContent" :key="(p && p.cid ? p.cid : (p && p.uri ? p.uri : '')) + ':' + idx">
                              <td style="word-break: break-all;">
                                <a v-if="p && p.uri" :href="p.uri" target="_blank" rel="noreferrer">{{ p && p.title ? p.title : (p && p.uri ? p.uri : '—') }}</a>
                                <span v-else>{{ p && p.title ? p.title : '—' }}</span>
                              </td>
                              <td style="text-align:right; white-space: nowrap;">{{ formatNumber(p && p.views ? p.views : 0) }}</td>
                              <td style="text-align:right; white-space: nowrap;">{{ formatNumber(p && p.uv ? p.uv : 0) }}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="v3a-card" data-tour="data-table">
                  <div class="bd" style="padding: 0;">
                    <div v-if="dataVisitError" class="v3a-alert" style="margin: 16px;">{{ dataVisitError }}</div>
                    <div v-else-if="dataVisitLoading" class="v3a-muted" style="padding: 16px;">正在加载…</div>

                    <table v-else class="v3a-table v3a-posts-table">
                      <thead>
                        <tr>
                          <th>IP</th>
                          <th>路径</th>
                          <th>来源</th>
                          <th style="text-align:center;">设备</th>
                          <th>时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="v in dataVisitItems" :key="v.id">
                          <td><span class="v3a-muted" style="font-variant-numeric: tabular-nums;">{{ v.ip || '—' }}</span></td>
                          <td style="word-break: break-all;">
                            <a :href="v.uri" target="_blank" rel="noreferrer">{{ v.uri || '—' }}</a>
                            <div v-if="v.type === 'post'" class="v3a-muted" style="font-size: 12px; margin-top: 2px;">
                              {{ v.title || ('#' + (v.cid || '')) }}
                            </div>
                          </td>
                          <td style="word-break: break-all;">
                            <a v-if="v.referer" :href="v.referer" target="_blank" rel="noreferrer">{{ v.referer }}</a>
                            <span v-else class="v3a-muted">直接访问</span>
                          </td>
                          <td style="text-align:center;">
                            <span class="v3a-pill" :class="dataDeviceTone(v.deviceType)">{{ v.device || '—' }}</span>
                          </td>
                          <td>{{ formatTime(v.created, settingsData.site.timezone) }}</td>
                        </tr>
                        <tr v-if="!dataVisitItems.length">
                          <td colspan="5" class="v3a-muted" style="padding: 16px;">暂无访问日志</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div class="v3a-pagination">
                  <button class="v3a-pagebtn" type="button" @click="dataVisitGoPage(dataVisitPagination.page - 1)" :disabled="dataVisitPagination.page <= 1">
                    <span class="v3a-icon" v-html="ICONS.collapse"></span>
                  </button>
                  <div class="v3a-pagecurrent">{{ dataVisitPagination.page }}</div>
                  <button class="v3a-pagebtn" type="button" @click="dataVisitGoPage(dataVisitPagination.page + 1)" :disabled="dataVisitPagination.page >= dataVisitPagination.pageCount">
                    <span class="v3a-icon" v-html="ICONS.expand"></span>
                  </button>
                  <span class="v3a-muted">跳至</span>
                  <input class="v3a-pagejump" type="number" min="1" :max="dataVisitPagination.pageCount" v-model.number="dataVisitPageJump" @keyup.enter="dataVisitGoPage(dataVisitPageJump)" @blur="dataVisitGoPage(dataVisitPageJump)" />
                </div>
              </div>
            </template>

            <template v-else-if="routePath === '/users'">
              <div class="v3a-container">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarToggleTitle">
                      <span class="v3a-icon" v-html="sidebarToggleIcon"></span>
                    </button>
                    <div class="v3a-pagehead-title v3a-pagehead-title--path" :title="crumb">
                      <span v-if="crumbPath" class="v3a-pagehead-title-path">{{ crumbPath }}</span>
                      <span v-if="crumbPath" class="v3a-pagehead-title-sep"> / </span>
                      <span class="v3a-pagehead-title-current">{{ crumbCurrent || crumb }}</span>
                    </div>
                  </div>
                  <div class="v3a-pagehead-actions" data-tour="users-actions">
                    <button class="v3a-actionbtn" type="button" title="权限说明" @click="openPermissionInfo()">
                      <span class="v3a-icon" v-html="ICONS.info"></span>
                    </button>
                    <button class="v3a-actionbtn" type="button" title="刷新" :disabled="usersLoading" @click="applyUsersFilters()">
                      <span class="v3a-icon" v-html="ICONS.refreshCw"></span>
                    </button>
                    <button class="v3a-actionbtn danger" type="button" title="删除" :disabled="!usersSelectedUids.length" @click="deleteSelectedUsers()">
                      <span class="v3a-icon" v-html="ICONS.trash"></span>
                    </button>
                  </div>
                </div>

                <div class="v3a-posts-search">
                  <div class="v3a-searchbox">
                    <span class="v3a-searchbox-icon" v-html="ICONS.search"></span>
                    <input class="v3a-input" v-model="usersFilters.keywords" @keyup.enter="applyUsersFilters()" placeholder="搜索用户名 / 昵称 / 邮箱..." />
                  </div>
                  <select class="v3a-select" v-model="usersFilters.group" @change="applyUsersFilters()" style="width: 140px;">
                    <option value="all">全部用户组</option>
                    <option value="administrator">管理员</option>
                    <option value="editor">编辑</option>
                    <option value="contributor">贡献者</option>
                    <option value="subscriber">关注者</option>
                    <option value="visitor">访问者</option>
                  </select>
                  <button class="v3a-btn" type="button" @click="applyUsersFilters()" :disabled="usersLoading">搜索</button>
                  <div class="v3a-muted">{{ formatNumber(usersPagination.total) }} 个</div>
                </div>

                <div v-if="usersError" class="v3a-alert">{{ usersError }}</div>

                <div class="v3a-card" data-tour="users-table">
                  <div class="bd" style="padding: 0;">
                    <div v-if="usersLoading" class="v3a-muted" style="padding: 16px;">正在加载…</div>

                    <table v-else class="v3a-table v3a-users-table">
                      <thead>
                        <tr>
                          <th>
                            <input ref="usersSelectAllEl" class="v3a-check" type="checkbox" :checked="usersSelectedAll" @change="toggleUsersSelectAll($event.target.checked)" />
                          </th>
                          <th style="text-align:center;">文章</th>
                          <th>用户名</th>
                          <th>昵称</th>
                          <th>邮箱</th>
                          <th>用户组</th>
                          <th style="text-align:right;">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="u in usersItems" :key="u.uid">
                          <td>
                            <input class="v3a-check" type="checkbox" :checked="isUserSelected(u.uid)" @change="toggleUserSelection(u.uid, $event.target.checked)" />
                          </td>
                          <td style="text-align:center;">{{ formatNumber(u.postsNum || 0) }}</td>
                          <td>{{ u.name || '—' }}</td>
                          <td class="v3a-muted">{{ u.screenName || '—' }}</td>
                          <td>
                            <template v-if="u.mail">
                              <a :href="'mailto:' + u.mail">{{ u.mail }}</a>
                            </template>
                            <span v-else class="v3a-muted">暂无</span>
                          </td>
                          <td>
                            <span class="v3a-pill" :class="userGroupTone(u.group)">{{ userGroupLabel(u.group) }}</span>
                          </td>
                          <td style="text-align:right; white-space: nowrap;">
                            <button class="v3a-mini-btn" type="button" @click="openUserEditor(u)">设置</button>
                            <button class="v3a-mini-btn" type="button" style="color: var(--v3a-danger);" @click="deleteUser(u.uid)">删除</button>
                          </td>
                        </tr>
                        <tr v-if="!usersItems.length">
                          <td colspan="7" class="v3a-muted" style="padding: 16px;">暂无用户</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div class="v3a-pagination">
                  <button class="v3a-pagebtn" type="button" @click="usersGoPage(usersPagination.page - 1)" :disabled="usersPagination.page <= 1">
                    <span class="v3a-icon" v-html="ICONS.collapse"></span>
                  </button>
                  <div class="v3a-pagecurrent">{{ usersPagination.page }}</div>
                  <button class="v3a-pagebtn" type="button" @click="usersGoPage(usersPagination.page + 1)" :disabled="usersPagination.page >= usersPagination.pageCount">
                    <span class="v3a-icon" v-html="ICONS.expand"></span>
                  </button>
                  <span class="v3a-muted">跳至</span>
                  <input class="v3a-pagejump" type="number" min="1" :max="usersPagination.pageCount" v-model.number="usersPageJump" @keyup.enter="usersGoPage(usersPageJump)" @blur="usersGoPage(usersPageJump)" />
                </div>

                <div v-if="userEditorOpen" class="v3a-modal-mask" @click.self="closeUserEditor()">
                  <div class="v3a-modal-card" role="dialog" aria-modal="true">
                    <button class="v3a-modal-close" type="button" aria-label="关闭" @click="closeUserEditor()">
                      <span class="v3a-icon" v-html="ICONS.closeSmall"></span>
                    </button>
                    <div class="v3a-modal-head">
                      <div class="v3a-modal-title">用户设置</div>
                    </div>
                    <div class="v3a-modal-body">
                      <div class="v3a-modal-form">
                        <div class="v3a-modal-item">
                          <label class="v3a-modal-label">用户名</label>
                          <input class="v3a-input v3a-modal-input" :value="userEditorForm.name" disabled />
                        </div>
                        <div class="v3a-modal-item">
                          <label class="v3a-modal-label">昵称</label>
                          <input class="v3a-input v3a-modal-input" v-model="userEditorForm.screenName" placeholder="可留空（默认同用户名）" />
                        </div>
                        <div class="v3a-modal-item">
                          <label class="v3a-modal-label">邮箱<span class="v3a-required">*</span></label>
                          <input class="v3a-input v3a-modal-input" v-model="userEditorForm.mail" placeholder="Email" />
                        </div>
                        <div class="v3a-modal-item">
                          <label class="v3a-modal-label">主页</label>
                          <input class="v3a-input v3a-modal-input" v-model="userEditorForm.url" placeholder="https://example.com" />
                        </div>
                        <div class="v3a-modal-item">
                          <label class="v3a-modal-label">用户组</label>
                          <select class="v3a-select v3a-modal-input" v-model="userEditorForm.group">
                            <option value="administrator">管理员</option>
                            <option value="editor">编辑</option>
                            <option value="contributor">贡献者</option>
                            <option value="subscriber">关注者</option>
                            <option value="visitor">访问者</option>
                          </select>
                        </div>
                        <div class="v3a-modal-item">
                          <label class="v3a-modal-label">新密码</label>
                          <input class="v3a-input v3a-modal-input" type="password" v-model="userEditorForm.password" placeholder="留空不修改" />
                        </div>
                        <div class="v3a-modal-item" v-if="userEditorForm.password">
                          <label class="v3a-modal-label">确认密码</label>
                          <input class="v3a-input v3a-modal-input" type="password" v-model="userEditorForm.confirm" placeholder="再次输入新密码" />
                        </div>
                      </div>

                      <div v-if="userEditorError" class="v3a-alert" style="margin-top: 12px;">{{ userEditorError }}</div>

                      <div class="v3a-modal-actions">
                        <button class="v3a-btn v3a-modal-btn" type="button" @click="closeUserEditor()" :disabled="userEditorSaving">取消</button>
                        <button class="v3a-btn primary v3a-modal-btn" type="button" @click="saveUserEditor()" :disabled="userEditorSaving">{{ userEditorSaving ? "保存中…" : "保存" }}</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="routePath === '/extras/ai-translate'">
              <div class="v3a-container v3a-container-comments">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarToggleTitle">
                      <span class="v3a-icon" v-html="sidebarToggleIcon"></span>
                    </button>
                    <div class="v3a-pagehead-title v3a-pagehead-title--path" :title="crumb">
                      <span v-if="crumbPath" class="v3a-pagehead-title-path">{{ crumbPath }}</span>
                      <span v-if="crumbPath" class="v3a-pagehead-title-sep"> / </span>
                      <span class="v3a-pagehead-title-current">{{ crumbCurrent || crumb }}</span>
                    </div>
                  </div>
                  <div class="v3a-pagehead-actions">
                    <button class="v3a-actionbtn" type="button" title="刷新" :disabled="aiExtrasLoading" @click="fetchAiExtrasContents()">
                      <span class="v3a-icon" v-html="ICONS.refreshCw"></span>
                    </button>
                  </div>
                </div>

                <div class="v3a-comments-split" :style="{ '--v3a-comments-left': aiExtrasSplitLeftWidth + 'px' }">
                  <div class="v3a-comments-left">
                    <div class="v3a-card v3a-comments-panel">
                      <div class="hd">
                        <div class="v3a-comments-tabs">
                          <select class="v3a-select v3a-comments-filter" v-model="aiExtrasContentType" aria-label="内容类型">
                            <option value="post">博文</option>
                            <option value="page">页面</option>
                          </select>
                        </div>
                        <div class="v3a-comments-count v3a-muted">
                          {{ formatNumber(aiExtrasContentType === 'page' ? aiExtrasItems.length : aiExtrasPagination.total) }} 条
                        </div>
                      </div>

                      <div class="bd" style="padding: 0;">
                        <div class="v3a-comments-toolbar">
                          <div class="v3a-searchbox v3a-searchbox-full">
                            <span class="v3a-searchbox-icon" v-html="ICONS.search"></span>
                            <input class="v3a-input" v-model="aiExtrasKeywords" @keyup.enter="aiExtrasApplyFilters()" placeholder="搜索标题 / 内容..." />
                          </div>
                          <button class="v3a-btn" type="button" @click="aiExtrasApplyFilters()" :disabled="aiExtrasLoading">搜索</button>
                        </div>

                        <div v-if="aiExtrasError" class="v3a-alert v3a-comments-alert">{{ aiExtrasError }}</div>

                        <div class="v3a-comments-list">
                          <div v-if="aiExtrasLoading" class="v3a-comments-empty">
                            <div class="v3a-muted">正在加载…</div>
                          </div>
                          <div v-else-if="!aiExtrasItems.length" class="v3a-comments-empty">
                            <span class="v3a-icon v3a-comments-empty-icon" v-html="aiExtrasContentType === 'page' ? ICONS.pages : ICONS.fileText"></span>
                            <div class="v3a-muted">暂无内容</div>
                          </div>
                          <div v-else>
                            <div
                              v-for="c in aiExtrasItems"
                              :key="c.cid"
                              class="v3a-comment-item"
                              :class="{ active: Number(aiExtrasSelectedCid) === Number(c.cid) }"
                              role="button"
                              tabindex="0"
                              @click="selectAiExtrasContent(c.cid)"
                              @keyup.enter="selectAiExtrasContent(c.cid)"
                            >
                              <div class="v3a-comment-avatar">
                                <span class="v3a-icon" v-html="aiExtrasContentType === 'page' ? ICONS.pages : ICONS.fileText"></span>
                              </div>
                              <div class="v3a-comment-body">
                                <div class="v3a-comment-top">
                                  <span class="v3a-comment-author" :style="{ paddingLeft: (aiExtrasContentType === 'page' ? (Number(c.levels || 0) * 12) : 0) + 'px' }">
                                    {{ c.title || ('#' + c.cid) }}
                                  </span>
                                  <span class="v3a-comment-time v3a-muted">{{ formatTimeAgo(Number(c.modified || 0) || Number(c.created || 0)) }}</span>
                                </div>
                                <div class="v3a-comment-excerpt v3a-muted">#{{ c.cid }}</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div v-if="aiExtrasContentType === 'post' && aiExtrasPagination.pageCount > 1" class="v3a-pagination" style="padding: 12px;">
                          <button class="v3a-pagebtn" type="button" @click="aiExtrasGoPage(aiExtrasPagination.page - 1)" :disabled="aiExtrasPagination.page <= 1">
                            <span class="v3a-icon" v-html="ICONS.collapse"></span>
                          </button>
                          <div class="v3a-pagecurrent">{{ aiExtrasPagination.page }}</div>
                          <button class="v3a-pagebtn" type="button" @click="aiExtrasGoPage(aiExtrasPagination.page + 1)" :disabled="aiExtrasPagination.page >= aiExtrasPagination.pageCount">
                            <span class="v3a-icon" v-html="ICONS.expand"></span>
                          </button>
                          <span class="v3a-muted">跳至</span>
                          <input class="v3a-pagejump" type="number" min="1" :max="aiExtrasPagination.pageCount" v-model.number="aiExtrasPageJump" @keyup.enter="aiExtrasGoPage(aiExtrasPageJump)" @blur="aiExtrasGoPage(aiExtrasPageJump)" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="v3a-comments-resizer" @pointerdown="startAiExtrasSplitResize"></div>

                  <div class="v3a-comments-right">
                    <div class="v3a-card v3a-comments-panel">
                      <div class="hd">
                        <div class="v3a-comments-tabs">
                          <select v-if="aiExtrasLanguageOptions && aiExtrasLanguageOptions.length" class="v3a-select v3a-comments-filter" v-model="aiExtrasLang" aria-label="语言">
                            <option v-for="l in aiExtrasLanguageOptions" :key="l" :value="l">{{ l }}</option>
                          </select>
                          <input v-else class="v3a-input v3a-comments-filter" v-model="aiExtrasLang" placeholder="lang (e.g. en)" />
                        </div>
                        <div class="v3a-comments-count v3a-muted">
                          <template v-if="aiTranslateItem && aiTranslateItem.updated">更新于 {{ formatTime(aiTranslateItem.updated, settingsData.site.timezone) }}</template>
                          <template v-else>—</template>
                        </div>
                      </div>

                      <div class="bd" style="padding: 0;">
                        <div class="v3a-comments-toolbar">
                          <button class="v3a-btn" type="button" @click="loadAiTranslation()" :disabled="aiTranslateLoading || aiTranslateGenerating || !aiExtrasSelectedCid || !String(aiExtrasLang || '').trim()">读取</button>
                          <button class="v3a-btn primary" type="button" @click="generateAiTranslation()" :disabled="aiTranslateLoading || aiTranslateGenerating || !aiExtrasSelectedCid || !String(aiExtrasLang || '').trim()">
                            {{ aiTranslateGenerating ? "生成中…" : "生成" }}
                          </button>
                          <button class="v3a-btn" type="button" @click="saveAiTranslation()" :disabled="aiTranslateLoading || aiTranslateGenerating || aiTranslateSaving || !aiTranslateItem || !aiTranslateDirty">
                            {{ aiTranslateSaving ? "保存中…" : "保存" }}
                          </button>
                          <button class="v3a-btn" type="button" @click="openAiExtrasEditor()" :disabled="!aiExtrasSelectedCid">编辑原文</button>
                          <span v-if="aiTranslateItem && aiTranslateItem.model" class="v3a-muted">模型：{{ aiTranslateItem.model }}</span>
                        </div>

                        <div v-if="aiTranslateError" class="v3a-alert v3a-comments-alert">{{ aiTranslateError }}</div>

                        <div class="v3a-comments-list">
                          <div v-if="!aiExtrasSelectedCid" class="v3a-comments-empty">
                            <span class="v3a-icon v3a-comments-empty-icon" v-html="ICONS.fileText"></span>
                            <div class="v3a-muted">从左侧选择内容</div>
                          </div>
                          <div v-else-if="aiTranslateLoading" class="v3a-comments-empty">
                            <div class="v3a-muted">正在加载…</div>
                          </div>
                          <div v-else-if="!aiTranslateItem" class="v3a-comments-empty">
                            <div class="v3a-muted">暂无翻译结果</div>
                          </div>
                          <div v-else>
                            <div style="padding: 12px 12px 0;">
                              <div class="v3a-muted" style="font-size: 12px; margin-bottom: 6px;">标题</div>
                              <input class="v3a-input" v-model="aiTranslateForm.title" />
                            </div>
                            <div style="padding: 12px 12px 0;">
                              <div class="v3a-muted" style="font-size: 12px; margin-bottom: 6px;">正文（可编辑）</div>
                              <textarea class="v3a-textarea" v-model="aiTranslateForm.text" style="min-height: 180px;"></textarea>
                            </div>
                            <div style="padding: 8px 12px 0;" class="v3a-muted">预览</div>
                            <div ref="aiTranslatePreviewEl" class="v3a-ai-preview"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="routePath === '/extras/ai-summary'">
              <div class="v3a-container v3a-container-comments">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarToggleTitle">
                      <span class="v3a-icon" v-html="sidebarToggleIcon"></span>
                    </button>
                    <div class="v3a-pagehead-title v3a-pagehead-title--path" :title="crumb">
                      <span v-if="crumbPath" class="v3a-pagehead-title-path">{{ crumbPath }}</span>
                      <span v-if="crumbPath" class="v3a-pagehead-title-sep"> / </span>
                      <span class="v3a-pagehead-title-current">{{ crumbCurrent || crumb }}</span>
                    </div>
                  </div>
                  <div class="v3a-pagehead-actions">
                    <button class="v3a-actionbtn" type="button" title="刷新" :disabled="aiExtrasLoading" @click="fetchAiExtrasContents()">
                      <span class="v3a-icon" v-html="ICONS.refreshCw"></span>
                    </button>
                  </div>
                </div>

                <div class="v3a-comments-split" :style="{ '--v3a-comments-left': aiExtrasSplitLeftWidth + 'px' }">
                  <div class="v3a-comments-left">
                    <div class="v3a-card v3a-comments-panel">
                      <div class="hd">
                        <div class="v3a-comments-tabs">
                          <select class="v3a-select v3a-comments-filter" v-model="aiExtrasContentType" aria-label="内容类型">
                            <option value="post">博文</option>
                            <option value="page">页面</option>
                          </select>
                        </div>
                        <div class="v3a-comments-count v3a-muted">
                          {{ formatNumber(aiExtrasContentType === 'page' ? aiExtrasItems.length : aiExtrasPagination.total) }} 条
                        </div>
                      </div>

                      <div class="bd" style="padding: 0;">
                        <div class="v3a-comments-toolbar">
                          <div class="v3a-searchbox v3a-searchbox-full">
                            <span class="v3a-searchbox-icon" v-html="ICONS.search"></span>
                            <input class="v3a-input" v-model="aiExtrasKeywords" @keyup.enter="aiExtrasApplyFilters()" placeholder="搜索标题 / 内容..." />
                          </div>
                          <button class="v3a-btn" type="button" @click="aiExtrasApplyFilters()" :disabled="aiExtrasLoading">搜索</button>
                        </div>

                        <div v-if="aiExtrasError" class="v3a-alert v3a-comments-alert">{{ aiExtrasError }}</div>

                        <div class="v3a-comments-list">
                          <div v-if="aiExtrasLoading" class="v3a-comments-empty">
                            <div class="v3a-muted">正在加载…</div>
                          </div>
                          <div v-else-if="!aiExtrasItems.length" class="v3a-comments-empty">
                            <span class="v3a-icon v3a-comments-empty-icon" v-html="aiExtrasContentType === 'page' ? ICONS.pages : ICONS.fileText"></span>
                            <div class="v3a-muted">暂无内容</div>
                          </div>
                          <div v-else>
                            <div
                              v-for="c in aiExtrasItems"
                              :key="c.cid"
                              class="v3a-comment-item"
                              :class="{ active: Number(aiExtrasSelectedCid) === Number(c.cid) }"
                              role="button"
                              tabindex="0"
                              @click="selectAiExtrasContent(c.cid)"
                              @keyup.enter="selectAiExtrasContent(c.cid)"
                            >
                              <div class="v3a-comment-avatar">
                                <span class="v3a-icon" v-html="aiExtrasContentType === 'page' ? ICONS.pages : ICONS.fileText"></span>
                              </div>
                              <div class="v3a-comment-body">
                                <div class="v3a-comment-top">
                                  <span class="v3a-comment-author" :style="{ paddingLeft: (aiExtrasContentType === 'page' ? (Number(c.levels || 0) * 12) : 0) + 'px' }">
                                    {{ c.title || ('#' + c.cid) }}
                                  </span>
                                  <span class="v3a-comment-time v3a-muted">{{ formatTimeAgo(Number(c.modified || 0) || Number(c.created || 0)) }}</span>
                                </div>
                                <div class="v3a-comment-excerpt v3a-muted">#{{ c.cid }}</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div v-if="aiExtrasContentType === 'post' && aiExtrasPagination.pageCount > 1" class="v3a-pagination" style="padding: 12px;">
                          <button class="v3a-pagebtn" type="button" @click="aiExtrasGoPage(aiExtrasPagination.page - 1)" :disabled="aiExtrasPagination.page <= 1">
                            <span class="v3a-icon" v-html="ICONS.collapse"></span>
                          </button>
                          <div class="v3a-pagecurrent">{{ aiExtrasPagination.page }}</div>
                          <button class="v3a-pagebtn" type="button" @click="aiExtrasGoPage(aiExtrasPagination.page + 1)" :disabled="aiExtrasPagination.page >= aiExtrasPagination.pageCount">
                            <span class="v3a-icon" v-html="ICONS.expand"></span>
                          </button>
                          <span class="v3a-muted">跳至</span>
                          <input class="v3a-pagejump" type="number" min="1" :max="aiExtrasPagination.pageCount" v-model.number="aiExtrasPageJump" @keyup.enter="aiExtrasGoPage(aiExtrasPageJump)" @blur="aiExtrasGoPage(aiExtrasPageJump)" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="v3a-comments-resizer" @pointerdown="startAiExtrasSplitResize"></div>

                  <div class="v3a-comments-right">
                    <div class="v3a-card v3a-comments-panel">
                      <div class="hd">
                        <div class="v3a-comments-tabs">
                          <select v-if="aiExtrasLanguageOptions && aiExtrasLanguageOptions.length" class="v3a-select v3a-comments-filter" v-model="aiExtrasLang" aria-label="语言">
                            <option v-for="l in aiExtrasLanguageOptions" :key="l" :value="l">{{ l }}</option>
                          </select>
                          <input v-else class="v3a-input v3a-comments-filter" v-model="aiExtrasLang" placeholder="lang (e.g. en)" />
                        </div>
                        <div class="v3a-comments-count v3a-muted">
                          <template v-if="aiSummaryItem && aiSummaryItem.updated">更新于 {{ formatTime(aiSummaryItem.updated, settingsData.site.timezone) }}</template>
                          <template v-else>—</template>
                        </div>
                      </div>

                      <div class="bd" style="padding: 0;">
                        <div class="v3a-comments-toolbar">
                          <button class="v3a-btn" type="button" @click="loadAiSummary()" :disabled="aiSummaryLoading || aiSummaryGenerating || !aiExtrasSelectedCid || !String(aiExtrasLang || '').trim()">读取</button>
                          <button class="v3a-btn primary" type="button" @click="generateAiSummary()" :disabled="aiSummaryLoading || aiSummaryGenerating || !aiExtrasSelectedCid || !String(aiExtrasLang || '').trim()">
                            {{ aiSummaryGenerating ? "生成中…" : "生成" }}
                          </button>
                          <button class="v3a-btn" type="button" @click="saveAiSummary()" :disabled="aiSummaryLoading || aiSummaryGenerating || aiSummarySaving || !aiSummaryItem || !aiSummaryDirty">
                            {{ aiSummarySaving ? "保存中…" : "保存" }}
                          </button>
                          <button class="v3a-btn" type="button" @click="openAiExtrasEditor()" :disabled="!aiExtrasSelectedCid">编辑原文</button>
                          <span v-if="aiSummaryItem && aiSummaryItem.model" class="v3a-muted">模型：{{ aiSummaryItem.model }}</span>
                        </div>

                        <div v-if="aiSummaryError" class="v3a-alert v3a-comments-alert">{{ aiSummaryError }}</div>

                        <div class="v3a-comments-list">
                          <div v-if="!aiExtrasSelectedCid" class="v3a-comments-empty">
                            <span class="v3a-icon v3a-comments-empty-icon" v-html="ICONS.fileText"></span>
                            <div class="v3a-muted">从左侧选择内容</div>
                          </div>
                          <div v-else-if="aiSummaryLoading" class="v3a-comments-empty">
                            <div class="v3a-muted">正在加载…</div>
                          </div>
                          <div v-else-if="!aiSummaryItem" class="v3a-comments-empty">
                            <div class="v3a-muted">暂无摘要结果</div>
                          </div>
                          <div v-else>
                            <div style="padding: 12px 12px 0;">
                              <div class="v3a-muted" style="font-size: 12px; margin-bottom: 6px;">摘要（可编辑）</div>
                              <textarea class="v3a-textarea" v-model="aiSummaryForm.summary" style="min-height: 180px;"></textarea>
                            </div>
                            <div style="padding: 8px 12px 0;" class="v3a-muted">预览</div>
                            <div ref="aiSummaryPreviewEl" class="v3a-ai-preview"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="routePath === '/extras/panel'">
              <div class="v3a-container">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarToggleTitle">
                      <span class="v3a-icon" v-html="sidebarToggleIcon"></span>
                    </button>
                    <div class="v3a-pagehead-title v3a-pagehead-title--path" :title="crumb">
                      <span v-if="crumbPath" class="v3a-pagehead-title-path">{{ crumbPath }}</span>
                      <span v-if="crumbPath" class="v3a-pagehead-title-sep"> / </span>
                      <span class="v3a-pagehead-title-current">{{ crumbCurrent || crumb }}</span>
                    </div>
                  </div>
                  <div class="v3a-pagehead-actions">
                    <button class="v3a-actionbtn" type="button" title="刷新" :disabled="!extrasPanelUrl" @click="reloadExtrasPanelIframe()">
                      <span class="v3a-icon" v-html="ICONS.refreshCw"></span>
                    </button>
                    <a v-if="extrasPanelUrl" class="v3a-btn" :href="extrasPanelUrl" target="_blank" rel="noreferrer">
                      <span class="v3a-icon" v-html="ICONS.externalLink"></span>
                      新窗口
                    </a>
                  </div>
                </div>

                <div v-if="!extrasPanelUrl" class="v3a-muted">从左侧“额外功能”选择一个功能面板。</div>

                <div v-else class="v3a-card">
                  <div class="bd" style="padding: 0;">
                    <iframe
                      ref="extrasPanelIframe"
                      class="v3a-theme-config-frame v3a-theme-config-frame-legacy"
                      :src="extrasPanelUrl"
                      @load="onExtrasPanelIframeLoad"
                    ></iframe>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="routePath === '/extras/workshop'">
              <div class="v3a-container">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarToggleTitle">
                      <span class="v3a-icon" v-html="sidebarToggleIcon"></span>
                    </button>
                    <div class="v3a-pagehead-title v3a-pagehead-title--path" :title="crumb">
                      <span v-if="crumbPath" class="v3a-pagehead-title-path">{{ crumbPath }}</span>
                      <span v-if="crumbPath" class="v3a-pagehead-title-sep"> / </span>
                      <span class="v3a-pagehead-title-current">{{ crumbCurrent || crumb }}</span>
                    </div>
                    <div v-if="workshopMeta && (workshopMeta.sourceText || workshopMeta.updatedAt || workshopMeta.url)" class="v3a-draft-status idle v3a-workshop-meta">
                      <span class="v3a-icon" v-html="ICONS.cloud"></span>
                      <span>{{ workshopMeta.sourceText || '—' }}</span>
                      <span v-if="workshopMeta.updatedAt" class="v3a-draft-status-time v3a-workshop-meta-time" :title="'更新于 ' + formatTime(workshopMeta.updatedAt, settingsData.site.timezone)">· {{ formatTime(workshopMeta.updatedAt, settingsData.site.timezone).slice(5) }}</span>
                      <span class="v3a-draft-status-time v3a-workshop-meta-link">· <a :href="(workshopMeta && workshopMeta.url) || workshopListUrl" target="_blank" rel="noreferrer">repo.json</a></span>
                    </div>
                  </div>
                  <div class="v3a-pagehead-actions">
                    <button class="v3a-actionbtn" type="button" title="刷新" :disabled="workshopLoading" @click="fetchWorkshopProjects(true)">
                      <span class="v3a-icon" v-html="ICONS.refreshCw"></span>
                    </button>
                    <a class="v3a-actionbtn" :href="workshopRepoUrl" target="_blank" rel="noreferrer" title="跳转仓库">
                      <span class="v3a-icon" v-html="ICONS.github"></span>
                    </a>
                    <a class="v3a-actionbtn" :href="workshopLoginUrl" target="_blank" rel="noreferrer" title="登录账号">
                      <span class="v3a-icon" v-html="ICONS.user"></span>
                    </a>
                  </div>
                </div>

                <div class="v3a-posts-search" data-tour="workshop-filters">
                  <div class="v3a-searchbox">
                    <span class="v3a-searchbox-icon" v-html="ICONS.search"></span>
                    <input class="v3a-input" v-model="workshopSearch" @keyup.enter="applyWorkshopFilters()" placeholder="搜索项目..." />
                  </div>
                  <select class="v3a-select" v-model="workshopTypeFilter" @change="applyWorkshopFilters()" style="width: 140px;">
                    <option value="all">全部类型</option>
                    <option value="plugin">插件</option>
                    <option value="theme">主题</option>
                  </select>
                  <button class="v3a-btn" type="button" @click="applyWorkshopFilters()" :disabled="workshopLoading">搜索</button>
                  <div class="v3a-muted">{{ formatNumber(workshopFilteredItems.length) }} 条</div>
                </div>

                <div class="v3a-card">
                  <div class="bd" style="padding: 0;">
                    <div v-if="workshopError" class="v3a-alert" style="margin: 16px;">{{ workshopError }}</div>
                    <div v-else-if="workshopLoading" class="v3a-muted" style="padding: 16px;">正在加载…</div>

                    <template v-else>
                      <div v-if="!workshopFilteredItems.length" class="v3a-muted" style="padding: 16px;">{{ workshopItems.length ? '没有匹配的项目' : '暂无项目' }}</div>

                      <table v-else class="v3a-table">
                        <thead>
                          <tr>
                            <th>项目</th>
                            <th style="width: 80px;">类型</th>
                            <th style="width: 80px;">版本</th>
                            <th style="width: 140px;">作者</th>
                            <th style="width: 140px;">Typecho</th>
                            <th>介绍</th>
                            <th style="width: 220px; text-align: right;">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="row in workshopFilteredItems" :key="row.id || row.name">
                            <td style="max-width: 260px;">
                              <div style="display:flex; align-items:center; gap:8px; flex-wrap: wrap;">
                                <a v-if="row.link" :href="row.link" target="_blank" rel="noreferrer">{{ row.name || '—' }}</a>
                                <span v-else>{{ row.name || '—' }}</span>
                                <span v-if="row.installed" class="v3a-pill success">已安装</span>
                              </div>
                            </td>
                            <td style="width: 80px;">
                              <span class="v3a-pill" :class="workshopTypeTone(row.type)">{{ workshopTypeLabel(row.type) }}</span>
                            </td>
                            <td style="width: 80px;">
                              <span>{{ row.version || '—' }}</span>
                            </td>
                            <td style="width: 140px;">
                              <span>{{ row.author || '—' }}</span>
                            </td>
                            <td style="width: 140px;">
                              <span class="v3a-muted">{{ workshopTypechoText(row.typecho) || '—' }}</span>
                            </td>
                            <td style="word-break: break-word;">
                              <span>{{ row.description || '—' }}</span>
                            </td>
                            <td style="width: 220px; text-align: right;">
                              <div style="display: inline-flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap;">
                                <button
                                  v-if="row.canInstall"
                                  class="v3a-mini-btn primary"
                                  type="button"
                                  :disabled="workshopInstallingId === String(row.id || row.name || row.link || '')"
                                  @click="installWorkshopProject(row)"
                                >{{ workshopInstallingId === String(row.id || row.name || row.link || '') ? '安装中…' : (row.installed ? '覆盖安装' : '安装') }}</button>
                                <a v-if="row.readme" class="v3a-mini-btn" :href="row.readme" target="_blank" rel="noreferrer">使用文档</a>
                                <span v-if="!row.canInstall && !row.readme" class="v3a-muted">—</span>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </template>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="routePath === '/extras/shoutu'">
              <div class="v3a-container">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarToggleTitle">
                      <span class="v3a-icon" v-html="sidebarToggleIcon"></span>
                    </button>
                    <div class="v3a-pagehead-title v3a-pagehead-title--path" :title="crumb">
                      <span v-if="crumbPath" class="v3a-pagehead-title-path">{{ crumbPath }}</span>
                      <span v-if="crumbPath" class="v3a-pagehead-title-sep"> / </span>
                      <span class="v3a-pagehead-title-current">{{ crumbCurrent || crumb }}</span>
                    </div>
                  </div>
                  <div class="v3a-pagehead-actions" data-tour="shoutu-actions">
                    <button class="v3a-actionbtn" type="button" title="设置" @click="openShouTuTaSettings()" :disabled="!shouTuTaEnabled">
                      <span class="v3a-icon" v-html="ICONS.gear"></span>
                    </button>
                    <button class="v3a-actionbtn" type="button" title="刷新" :disabled="shouTuTaLoading || !shouTuTaEnabled" @click="fetchShouTuTaStats()">
                      <span class="v3a-icon" v-html="ICONS.refreshCw"></span>
                    </button>
                  </div>
                </div>

                <div v-if="!shouTuTaEnabled" class="v3a-muted">ShouTuTa 插件未启用。</div>

                <template v-else>
                  <div v-if="shouTuTaError" class="v3a-alert" style="margin-bottom: 12px;">{{ shouTuTaError }}</div>
                  <div v-if="shouTuTaLoading" class="v3a-muted">正在加载…</div>

                  <template v-else>
                    <div class="v3a-section" data-tour="shoutu-metrics">
                      <div class="v3a-section-hd split">
                        <div class="v3a-section-title">防护统计</div>
                        <div class="v3a-section-tools">
                          <span v-if="shouTuTaUpdatedAt" class="v3a-muted">更新于 {{ formatTime(shouTuTaUpdatedAt, settingsData.site.timezone) }}</span>
                        </div>
                      </div>
                      <div class="v3a-section-line"></div>

                      <div class="v3a-metric-grid">
                        <div class="v3a-metric-item">
                          <span class="v3a-metric-icon" v-html="ICONS.shieldAlert"></span>
                          <div class="v3a-metric-meta">
                            <div class="v3a-metric-label">累计拦截</div>
                            <div class="v3a-metric-value">{{ formatNumber(shouTuTaStats.total_blocks) }}</div>
                          </div>
                        </div>
                        <div class="v3a-metric-item">
                          <span class="v3a-metric-icon" v-html="ICONS.activity"></span>
                          <div class="v3a-metric-meta">
                            <div class="v3a-metric-label">CC 防护</div>
                            <div class="v3a-metric-value">{{ formatNumber(shouTuTaStats.cc_blocks) }}</div>
                          </div>
                        </div>
                        <div class="v3a-metric-item">
                          <span class="v3a-metric-icon" v-html="ICONS.search"></span>
                          <div class="v3a-metric-meta">
                            <div class="v3a-metric-label">SQL 注入</div>
                            <div class="v3a-metric-value">{{ formatNumber(shouTuTaStats.sqli_blocks) }}</div>
                          </div>
                        </div>
                        <div class="v3a-metric-item">
                          <span class="v3a-metric-icon" v-html="ICONS.eyeOff"></span>
                          <div class="v3a-metric-meta">
                            <div class="v3a-metric-label">XSS</div>
                            <div class="v3a-metric-value">{{ formatNumber(shouTuTaStats.xss_blocks) }}</div>
                          </div>
                        </div>
                        <div class="v3a-metric-item">
                          <span class="v3a-metric-icon" v-html="ICONS.fileText"></span>
                          <div class="v3a-metric-meta">
                            <div class="v3a-metric-label">文件包含</div>
                            <div class="v3a-metric-value">{{ formatNumber(shouTuTaStats.file_inclusion_blocks) }}</div>
                          </div>
                        </div>
                        <div class="v3a-metric-item">
                          <span class="v3a-metric-icon" v-html="ICONS.code"></span>
                          <div class="v3a-metric-meta">
                            <div class="v3a-metric-label">PHP 代码</div>
                            <div class="v3a-metric-value">{{ formatNumber(shouTuTaStats.php_code_blocks) }}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="v3a-section" data-tour="shoutu-ip-query">
                      <div class="v3a-section-hd split">
                        <div class="v3a-section-title">IP 查询</div>
                        <div class="v3a-section-tools">
                          <span class="v3a-muted">点击列表中的 IP 可查看详情与操作</span>
                        </div>
                      </div>
                      <div class="v3a-section-line"></div>

                      <div class="v3a-card">
                        <div class="bd">
                          <div style="display:flex; gap: 10px; flex-wrap: wrap; align-items:center;">
                            <input class="v3a-input" type="text" v-model="shouTuTaIpQuery" placeholder="输入 IP 地址…" style="flex: 1; min-width: 220px;" />
                            <button class="v3a-btn" type="button" @click="submitShouTuTaIpQuery()" :disabled="!shouTuTaIpQuery || !shouTuTaIpQuery.trim()">查询</button>
                          </div>
                          <div class="v3a-muted" style="margin-top: 10px; font-size: 12px;">
                            弹窗中可进行：查询信誉 / 解除拦截 / 加入白名单 / 永久封禁 / 彻底清除数据等操作。
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="v3a-section">
                      <div class="v3a-section-hd split">
                        <div class="v3a-section-title">站点访问统计</div>
                        <div class="v3a-section-tools">
                          <span v-if="!shouTuTaAnalyticsEnabled" class="v3a-muted">未启用</span>
                          <span v-else-if="!shouTuTaAnalyticsAvailable" class="v3a-muted">不可用</span>
                          <span v-else class="v3a-muted">今日 / 昨日 / 24h</span>
                        </div>
                      </div>
                      <div class="v3a-section-line"></div>

                      <div v-if="!shouTuTaAnalyticsEnabled" class="v3a-muted">请在“守兔塔 → 设置”中开启统计功能。</div>
                      <div v-else-if="!shouTuTaAnalyticsAvailable" class="v3a-muted">统计数据库不可用：需要启用 pdo_sqlite 并确保 analytics.db 可读写。</div>

                      <template v-else>
                        <div class="v3a-metric-grid">
                          <div class="v3a-metric-item">
                            <span class="v3a-metric-icon" v-html="ICONS.activity"></span>
                            <div class="v3a-metric-meta">
                              <div class="v3a-metric-label">今日请求</div>
                              <div class="v3a-metric-value">{{ formatNumber(shouTuTaVisitToday.requests) }}</div>
                            </div>
                          </div>
                          <div class="v3a-metric-item">
                            <span class="v3a-metric-icon" v-html="ICONS.user"></span>
                            <div class="v3a-metric-meta">
                              <div class="v3a-metric-label">今日 UV</div>
                              <div class="v3a-metric-value">{{ formatNumber(shouTuTaVisitToday.uv) }}</div>
                            </div>
                          </div>
                          <div class="v3a-metric-item">
                            <span class="v3a-metric-icon" v-html="ICONS.activity"></span>
                            <div class="v3a-metric-meta">
                              <div class="v3a-metric-label">昨日请求</div>
                              <div class="v3a-metric-value">{{ formatNumber(shouTuTaVisitYesterday.requests) }}</div>
                            </div>
                          </div>
                          <div class="v3a-metric-item">
                            <span class="v3a-metric-icon" v-html="ICONS.user"></span>
                            <div class="v3a-metric-meta">
                              <div class="v3a-metric-label">昨日 UV</div>
                              <div class="v3a-metric-value">{{ formatNumber(shouTuTaVisitYesterday.uv) }}</div>
                            </div>
                          </div>
                        </div>

                        <div class="v3a-card" style="margin-top: 12px;">
                          <div class="hd"><div class="title">24 小时流量趋势</div></div>
                          <div class="bd">
                            <div v-if="!shouTuTaTrend24h.length" class="v3a-muted">暂无数据</div>
                            <div v-else>
                              <svg viewBox="0 0 480 90" preserveAspectRatio="none" style="width: 100%; height: 90px; display: block;">
                                <g v-for="(b, i) in shouTuTaTrend24h" :key="b.ts || i">
                                  <rect
                                    :x="i * 20 + 2"
                                    :y="90 - Math.max(2, Math.round((Number(b.count || 0) || 0) / shouTuTaTrendMax * 86))"
                                    width="16"
                                    :height="Math.max(2, Math.round((Number(b.count || 0) || 0) / shouTuTaTrendMax * 86))"
                                    rx="2"
                                    :style="{ fill: 'var(--v3a-chart-bar)', opacity: (Number(b.count || 0) || 0) ? 1 : 0.25 }"
                                    :title="formatTime(b.ts, settingsData.site.timezone) + '：' + formatNumber(Number(b.count || 0) || 0)"
                                  ></rect>
                                </g>
                              </svg>
                              <div class="v3a-muted" style="display:flex; justify-content:space-between; font-size: 12px; margin-top: 6px;">
                                <span>{{ formatTime(shouTuTaTrend24h[0].ts, settingsData.site.timezone) }}</span>
                                <span>{{ formatTime(shouTuTaTrend24h[shouTuTaTrend24h.length - 1].ts, settingsData.site.timezone) }}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div class="v3a-grid two" style="margin-top: 12px;">
                          <div>
                            <div class="v3a-muted" style="font-weight: 500; margin-bottom: 8px;">今日热门页面 TOP15</div>
                            <div class="v3a-card">
                              <div class="bd" style="padding: 0;">
                                <div v-if="!shouTuTaTopPages.length" class="v3a-muted" style="padding: 16px;">暂无数据</div>
                                <table v-else class="v3a-table">
                                <thead>
                                  <tr>
                                    <th>页面</th>
                                    <th style="text-align:right;">访问</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr v-for="(p, idx) in shouTuTaTopPages" :key="(p && p.uri ? p.uri : '') + ':' + idx">
                                    <td style="word-break: break-all;" :title="p && p.uri ? p.uri : ''">{{ p && p.uri ? p.uri : '—' }}</td>
                                    <td style="text-align:right; white-space: nowrap;">{{ formatNumber(p && p.count ? p.count : 0) }}</td>
                                  </tr>
                                </tbody>
                              </table>
                              </div>
                            </div>
                          </div>

                          <div>
                            <div class="v3a-muted" style="font-weight: 500; margin-bottom: 8px;">今日高频 IP TOP15</div>
                            <div class="v3a-card">
                              <div class="bd" style="padding: 0;">
                                <div v-if="!shouTuTaTopIps.length" class="v3a-muted" style="padding: 16px;">暂无数据</div>
                                <table v-else class="v3a-table">
                                <thead>
                                  <tr>
                                    <th>IP</th>
                                    <th style="text-align:center;">地区</th>
                                    <th style="text-align:right;">次数</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr v-for="(p, idx) in shouTuTaTopIps" :key="(p && p.ip ? p.ip : '') + ':' + idx">
                                    <td style="white-space: nowrap;">
                                      <a class="v3a-link" href="javascript:;" @click.prevent="openShouTuTaIpModal(p.ip)">{{ p && p.ip ? p.ip : '—' }}</a>
                                    </td>
                                    <td style="text-align:center;" class="v3a-muted">{{ p && p.geo ? p.geo : '—' }}</td>
                                    <td style="text-align:right; white-space: nowrap;">{{ formatNumber(p && p.count ? p.count : 0) }}</td>
                                  </tr>
                                </tbody>
                              </table>
                              </div>
                            </div>
                          </div>
                        </div>
                      </template>
                    </div>

                    <div class="v3a-section">
                      <div class="v3a-section-hd split">
                        <div class="v3a-section-title">实时访问日志</div>
                        <div class="v3a-section-tools">
                          <span v-if="shouTuTaAnalyticsAvailable" class="v3a-muted">最近 {{ shouTuTaLogs.length }} 条</span>
                          <button v-if="shouTuTaAnalyticsAvailable" class="v3a-mini-btn" type="button" @click="toggleShouTuTaStream()" :disabled="shouTuTaActing">
                            {{ shouTuTaStreamPaused ? "继续" : "暂停" }}
                          </button>
                        </div>
                      </div>
                      <div class="v3a-section-line"></div>

                      <div v-if="!shouTuTaAnalyticsAvailable" class="v3a-muted">启用统计后可查看实时日志。</div>

                      <div v-else class="v3a-card">
                        <div class="bd" style="padding: 0;">
                          <div v-if="!shouTuTaLogs.length" class="v3a-muted" style="padding: 16px;">暂无访问记录</div>
                          <table v-else class="v3a-table">
                            <thead>
                              <tr>
                                <th style="white-space: nowrap;">时间</th>
                                <th style="text-align:center; white-space: nowrap;">地区</th>
                                <th style="white-space: nowrap;">IP</th>
                                <th>请求</th>
                                <th style="text-align:right; white-space: nowrap;">状态</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr v-for="l in shouTuTaLogs" :key="l.id">
                                <td style="white-space: nowrap;" :title="formatTimeAgo(l.ts)">{{ formatTime(l.ts, settingsData.site.timezone) }}</td>
                                <td style="text-align:center;" class="v3a-muted">{{ l.geo || '—' }}</td>
                                <td style="white-space: nowrap;">
                                  <a class="v3a-link" href="javascript:;" @click.prevent="openShouTuTaIpModal(l.ip)">{{ l.ip }}</a>
                                </td>
                                <td style="word-break: break-all;">{{ l.req || '—' }}</td>
                                <td style="text-align:right; white-space: nowrap;">
                                  <span class="v3a-pill" :class="shouTuTaStatusTone(l.status_code)">{{ shouTuTaStatusText(l.status_code) }}</span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <div class="v3a-section">
                      <div class="v3a-section-hd">
                        <div class="v3a-section-title">威胁情报</div>
                      </div>
                      <div class="v3a-section-line"></div>

                      <div v-if="!shouTuTaAnalyticsAvailable" class="v3a-muted">启用统计后可查看威胁排行。</div>

                      <div v-else class="v3a-card">
                        <div class="bd" style="padding: 0;">
                          <div v-if="!shouTuTaThreatTop.length" class="v3a-muted" style="padding: 16px;">暂无数据</div>
                          <table v-else class="v3a-table">
                            <thead>
                              <tr>
                                <th>IP</th>
                                <th style="text-align:center;">地区</th>
                                <th style="text-align:center;">最近</th>
                                <th style="text-align:right;">拦截</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr v-for="t in shouTuTaThreatTop" :key="t.ip">
                                <td style="white-space: nowrap;">
                                  <a class="v3a-link" href="javascript:;" @click.prevent="openShouTuTaIpModal(t.ip)" :title="t.ip">{{ t.masked || t.ip }}</a>
                                </td>
                                <td style="text-align:center;" class="v3a-muted">{{ t.geo || '—' }}</td>
                                <td style="text-align:center;" class="v3a-muted">{{ formatTimeAgo(t.lastSeen) }}</td>
                                <td style="text-align:right; white-space: nowrap;">{{ formatNumber(t.count || 0) }}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <div class="v3a-section">
                      <div class="v3a-section-hd">
                        <div class="v3a-section-title">管理操作</div>
                      </div>
                      <div class="v3a-section-line"></div>

                      <div class="v3a-grid two">
                        <div>
                          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 8px;">
                            <div class="v3a-muted" style="font-weight: 500;">全局白名单</div>
                            <button class="v3a-mini-btn primary" type="button" @click="openShouTuTaGlobalWhitelist()" :disabled="shouTuTaActing">添加</button>
                          </div>
                          <div class="v3a-card">
                            <div class="bd" style="padding: 0;">
                              <div v-if="!shouTuTaGlobalWhitelist.length" class="v3a-muted" style="padding: 16px;">暂无全局白名单</div>
                              <table v-else class="v3a-table">
                                <thead>
                                  <tr>
                                    <th style="white-space: nowrap;">IP</th>
                                    <th>备注</th>
                                    <th style="text-align:right; white-space: nowrap;">操作</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr v-for="w in shouTuTaGlobalWhitelist" :key="w.ip">
                                    <td style="white-space: nowrap;">{{ w.ip }}</td>
                                    <td class="v3a-muted" style="word-break: break-all;">{{ w.remark || '—' }}</td>
                                    <td style="text-align:right; white-space: nowrap;">
                                      <button class="v3a-mini-btn" type="button" style="color: var(--v3a-danger);" @click="shouTuTaGlobalWhitelistRemove(w.ip)" :disabled="shouTuTaActing">移除</button>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 8px;">
                            <div class="v3a-muted" style="font-weight: 500;">手动黑名单（IP/CIDR）</div>
                            <button class="v3a-mini-btn primary" type="button" @click="openShouTuTaCidr()" :disabled="shouTuTaActing">添加</button>
                          </div>
                          <div class="v3a-card">
                            <div class="bd">
                              <div v-if="!shouTuTaCidrItems.length" class="v3a-muted">暂无手动封禁</div>
                              <pre v-else class="mono" style="margin: 0; white-space: pre-wrap; max-height: 180px; overflow:auto;">{{ shouTuTaCidrItems.join('\\n') }}</pre>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div class="v3a-muted" style="font-weight: 500; margin-top: 12px; margin-bottom: 8px;">系统维护</div>
                      <div class="v3a-card">
                        <div class="bd">
                          <div class="v3a-muted" style="margin-bottom: 8px;">彻底清除某个 IP 的封禁/统计/缓存数据（不可逆）。</div>
                          <div style="display:flex; gap: 10px; flex-wrap: wrap; align-items:center;">
                            <input class="v3a-input" type="text" v-model="shouTuTaPurgeIpInput" placeholder="输入要清除的 IP…" style="flex: 1; min-width: 220px;" />
                            <button class="v3a-btn" type="button" style="background: var(--v3a-danger); border-color: var(--v3a-danger); color:#fff;" @click="shouTuTaPurgeIp(shouTuTaPurgeIpInput)" :disabled="shouTuTaActing || !shouTuTaPurgeIpInput || !shouTuTaPurgeIpInput.trim()">清除</button>
                          </div>
                        </div>
                      </div>

                      <div class="v3a-muted" style="font-weight: 500; margin-top: 12px; margin-bottom: 8px;">名单数量</div>
                      <div class="v3a-metric-grid">
                        <div class="v3a-metric-item">
                          <span class="v3a-metric-icon" v-html="ICONS.check"></span>
                          <div class="v3a-metric-meta">
                            <div class="v3a-metric-label">白名单</div>
                            <div class="v3a-metric-value">{{ formatNumber(shouTuTaLists.whitelist) }}</div>
                          </div>
                        </div>
                        <div class="v3a-metric-item">
                          <span class="v3a-metric-icon" v-html="ICONS.shieldAlert"></span>
                          <div class="v3a-metric-meta">
                            <div class="v3a-metric-label">封禁</div>
                            <div class="v3a-metric-value">{{ formatNumber(shouTuTaLists.banlist) }}</div>
                          </div>
                        </div>
                        <div class="v3a-metric-item">
                          <span class="v3a-metric-icon" v-html="ICONS.code"></span>
                          <div class="v3a-metric-meta">
                            <div class="v3a-metric-label">CIDR</div>
                            <div class="v3a-metric-value">{{ formatNumber(shouTuTaLists.cidr) }}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="v3a-section">
                      <div class="v3a-section-hd">
                        <div class="v3a-section-title">拦截事件日志</div>
                      </div>
                      <div class="v3a-section-line"></div>

                      <div class="v3a-card">
                        <div class="bd">
                          <div v-if="!shouTuTaBanLog.length" class="v3a-muted">暂无日志</div>
                          <pre v-else class="mono" style="margin: 0; white-space: pre-wrap;">{{ shouTuTaBanLog.join('\\n') }}</pre>
                        </div>
                      </div>
                    </div>
                  </template>
                </template>
              </div>
            </template>

            <template v-else-if="routePath === '/maintenance/backup'">
              <div class="v3a-container">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarToggleTitle">
                      <span class="v3a-icon" v-html="sidebarToggleIcon"></span>
                    </button>
                    <div class="v3a-pagehead-title v3a-pagehead-title--path" :title="crumb">
                      <span v-if="crumbPath" class="v3a-pagehead-title-path">{{ crumbPath }}</span>
                      <span v-if="crumbPath" class="v3a-pagehead-title-sep"> / </span>
                      <span class="v3a-pagehead-title-current">{{ crumbCurrent || crumb }}</span>
                    </div>
                  </div>
                  <div class="v3a-pagehead-actions" data-tour="backup-actions">
                    <button class="v3a-actionbtn" type="button" title="刷新" :disabled="backupLoading || backupWorking" @click="fetchBackups()">
                      <span class="v3a-icon" v-html="ICONS.refreshCw"></span>
                    </button>
                    <button class="v3a-btn primary" type="button" @click="exportBackup()" :disabled="backupWorking">
                      {{ backupWorking ? "备份中…" : "开始备份" }}
                    </button>
                  </div>
                </div>

                <div v-if="backupError" class="v3a-alert" style="margin-bottom: 12px;">{{ backupError }}</div>

                <div class="v3a-grid two">
                  <div class="v3a-card">
                    <div class="hd"><div class="title">备份您的数据</div></div>
                    <div class="bd v3a-muted">
                      <ul style="margin: 0; padding-left: 18px;">
                        <li>此备份仅包含内容数据（文章/页面/评论/分类标签/用户等），不包含站点设置。</li>
                        <li>数据量较大时可能耗时较久，建议在低峰期执行。</li>
                        <li><span style="color: var(--v3a-danger); font-weight: 600;">恢复操作会清除现有数据，请谨慎操作。</span></li>
                      </ul>
                      <div style="margin-top: 12px;">
                        <button class="v3a-btn primary" type="button" @click="exportBackup()" :disabled="backupWorking">
                          {{ backupWorking ? "备份中…" : "开始备份" }}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div class="v3a-card">
                    <div class="hd" style="padding: calc(var(--spacing) * 2) calc(var(--spacing) * 5);">
                      <div class="title">恢复数据</div>
                      <select class="v3a-select" v-model="backupRestoreMode" :disabled="backupWorking" style="width: 140px; height: 32px;">
                        <option value="upload">上传</option>
                        <option value="server">从服务器</option>
                      </select>
                    </div>
                    <div class="bd">
                      <template v-if="backupRestoreMode === 'upload'">
                        <div class="v3a-muted" style="margin-bottom: 10px;">选择 .dat 备份文件上传并恢复。</div>
                        <div style="display:flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                          <input class="v3a-input" type="text" :value="backupUploadFile ? backupUploadFile.name : ''" placeholder="选择 .dat 备份文件…" readonly style="flex: 1; min-width: 220px;" />
                          <button class="v3a-btn" type="button" @click="backupUploadEl && backupUploadEl.click()" :disabled="backupWorking">浏览…</button>
                          <input ref="backupUploadEl" type="file" accept=".dat" @change="onBackupUploadChange" style="display: none;" />
                        </div>
                        <div style="margin-top: 12px; display:flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                          <button class="v3a-btn primary" type="button" @click="restoreBackupFromUpload()" :disabled="backupWorking || !backupUploadFile">
                            {{ backupWorking ? "恢复中…" : "上传并恢复" }}
                          </button>
                          <div v-if="backupUploadFile" class="v3a-muted" style="font-size: 12px;">{{ backupUploadFile.name }}</div>
                        </div>
                      </template>
                      <template v-else>
                        <div class="v3a-muted" style="margin-bottom: 10px;">
                          从服务器目录恢复：<code>{{ backupDir || "usr/backups" }}</code>
                        </div>
                        <div v-if="backupLoading" class="v3a-muted">正在加载…</div>
                        <div v-else-if="!backupItems.length" class="v3a-muted">暂无备份文件</div>
                        <div v-else class="v3a-muted">点击下方列表的“恢复”进行操作。</div>
                      </template>
                    </div>
                  </div>
                </div>

                <div class="v3a-card" style="margin-top: calc(var(--spacing) * 4);" data-tour="backup-table">
                  <div class="bd" style="padding: 0;">
                    <div v-if="backupLoading" class="v3a-muted" style="padding: 16px;">正在加载…</div>
                    <table v-else class="v3a-table v3a-posts-table">
                      <thead>
                        <tr>
                          <th>文件</th>
                          <th style="text-align:center;">大小</th>
                          <th style="text-align:center;">时间</th>
                          <th style="text-align:right;">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="b in backupItems" :key="b.file">
                          <td><span style="font-variant-numeric: tabular-nums;">{{ b.file }}</span></td>
                          <td style="text-align:center;">{{ formatBytes(b.size) }}</td>
                          <td style="text-align:center;">{{ formatTime(b.time, settingsData.site.timezone) }}</td>
                          <td style="text-align:right; white-space: nowrap;">
                            <button class="v3a-mini-btn" type="button" @click="downloadBackup(b.file)">下载</button>
                            <button class="v3a-mini-btn" type="button" @click="restoreBackupFromServer(b.file)">恢复</button>
                            <button class="v3a-mini-btn" type="button" style="color: var(--v3a-danger);" @click="deleteBackup(b.file)">删除</button>
                          </td>
                        </tr>
                        <tr v-if="!backupItems.length">
                          <td colspan="4" class="v3a-muted" style="padding: 16px;">暂无备份文件（目录：{{ backupDir || "usr/backups" }}）</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="routePath === '/maintenance/upgrade'">
              <div class="v3a-container">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarToggleTitle">
                      <span class="v3a-icon" v-html="sidebarToggleIcon"></span>
                    </button>
                    <div class="v3a-pagehead-title v3a-pagehead-title--path" :title="crumb">
                      <span v-if="crumbPath" class="v3a-pagehead-title-path">{{ crumbPath }}</span>
                      <span v-if="crumbPath" class="v3a-pagehead-title-sep"> / </span>
                      <span class="v3a-pagehead-title-current">{{ crumbCurrent || crumb }}</span>
                    </div>
                  </div>
                  <div class="v3a-pagehead-actions">
                    <button class="v3a-actionbtn" type="button" title="刷新" :disabled="upgradeLoading" @click="fetchUpgradeInfo()">
                      <span class="v3a-icon" v-html="ICONS.refreshCw"></span>
                    </button>
                    <button class="v3a-actionbtn" type="button" title="设置" @click="openUpgradeSettings()">
                      <span class="v3a-icon" v-html="ICONS.wifiCog"></span>
                    </button>
                    <button
                      class="v3a-actionbtn primary"
                      type="button"
                      :title="upgradeWorking ? '升级中…' : '升级到最新'"
                      :disabled="upgradeWorking || upgradeLoading || !(upgradeSettingsForm.strict ? upgradeStrictUpdateAvailable : upgradeUpdateAvailable)"
                      @click="runUpgrade()"
                    >
                      <span class="v3a-icon" v-html="ICONS.hardDriveDownload"></span>
                    </button>
                  </div>
                </div>

                <div v-if="upgradeError" class="v3a-alert" style="margin-bottom: 12px;">{{ upgradeError }}</div>

                <div v-if="upgradeLoading" class="v3a-muted">正在加载…</div>

                <template v-else>
                  <div class="v3a-grid two">
                    <div>
                      <div style="display:flex; align-items:center; justify-content: space-between; margin-bottom: 8px;">
                        <div class="v3a-muted" style="font-weight: 500;">当前版本</div>
                      </div>
                      <div class="v3a-card">
                        <div class="bd v3a-muted" style="line-height: 1.8;">
                          <div>
                            版本：<span style="font-variant-numeric: tabular-nums;">{{ (upgradeCurrent && (upgradeCurrent.rawVersion || upgradeCurrent.version)) || '—' }}</span>
                          </div>
                          <div v-if="upgradeCurrent && upgradeCurrent.deployVersion">部署标记：<code>{{ upgradeCurrent.deployVersion }}</code></div>
                          <div v-if="upgradeCurrent && upgradeCurrent.build">构建时间：{{ formatTime(upgradeCurrent.build, settingsData.site.timezone) }}</div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div style="display:flex; align-items:center; justify-content: space-between; margin-bottom: 8px; gap: 12px;">
                        <div class="v3a-muted" style="font-weight: 500;">最新版本</div>
                        <span v-if="upgradeSettingsForm.strict ? upgradeStrictUpdateAvailable : upgradeUpdateAvailable" class="v3a-pill warn">有更新</span>
                        <span v-else class="v3a-pill success">已是最新</span>
                      </div>
                      <div class="v3a-card">
                        <div class="bd v3a-muted" style="line-height: 1.8;">
                          <template v-if="upgradeSettingsForm.strict && upgradeLatestCommit">
                            <div>最新 commit：<span style="font-variant-numeric: tabular-nums;">{{ upgradeLatestCommit.short }}</span></div>
                            <div v-if="upgradeLatestCommit.date">提交时间：{{ formatTime(isoToTs(upgradeLatestCommit.date), settingsData.site.timezone) }}</div>
                            <div v-if="upgradeLatestCommit.message" style="margin-top: 6px; white-space: pre-wrap;">{{ upgradeLatestCommit.message }}</div>
                          </template>
                          <template v-else>
                            <div>最新 Release：<span style="font-variant-numeric: tabular-nums;">{{ (upgradeLatest && upgradeLatest.tag) || '—' }}</span></div>
                            <div v-if="upgradeLatest && upgradeLatest.publishedAt">发布时间：{{ formatTime(isoToTs(upgradeLatest.publishedAt), settingsData.site.timezone) }}</div>
                            <div v-if="upgradeLatest && upgradeLatest.name" style="margin-top: 6px;">{{ upgradeLatest.name }}</div>
                          </template>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div v-if="upgradeSettingsForm.strict ? upgradeStrictUpdateAvailable : upgradeUpdateAvailable" style="margin-top: calc(var(--spacing) * 4);">
                    <div style="display:flex; align-items:center; justify-content: space-between; margin-bottom: 8px;">
                      <div class="v3a-muted" style="font-weight: 500;">更新内容</div>
                    </div>
                    <div class="v3a-card">
                      <div class="bd">
                      <template v-if="upgradeSettingsForm.strict && upgradeLatestCommit">
                        <pre class="mono" style="margin: 0; white-space: pre-wrap;">{{ upgradeLatestCommit.message || '—' }}</pre>
                        <div v-if="upgradeLatestCommit.url" style="margin-top: 10px;">
                          <button class="v3a-mini-btn" type="button" @click="openExternal(upgradeLatestCommit.url)">在 GitHub 查看</button>
                        </div>
                      </template>
                      <template v-else>
                        <pre class="mono" style="margin: 0; white-space: pre-wrap;">{{ (upgradeLatest && upgradeLatest.body) ? upgradeLatest.body : '（该 release 暂无说明）' }}</pre>
                      </template>
                      </div>
                    </div>
                  </div>

                  <div style="margin-top: calc(var(--spacing) * 4);">
                    <div style="display:flex; align-items:center; justify-content: space-between; margin-bottom: 8px;">
                      <div class="v3a-muted" style="font-weight: 500;">Release 列表</div>
                    </div>
                    <div class="v3a-card">
                      <div class="bd" style="padding: 0;">
                      <table class="v3a-table v3a-posts-table">
                        <thead>
                          <tr>
                            <th style="width: 140px;">版本</th>
                            <th>标题</th>
                            <th style="text-align:center; width: 160px;">发布时间</th>
                            <th style="text-align:right; width: 90px;">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="r in upgradeReleases" :key="r.tag">
                            <td style="white-space: nowrap;">
                              <span style="font-variant-numeric: tabular-nums;">{{ r.tag }}</span>
                              <span v-if="r.isPrerelease" class="v3a-pill warn" style="margin-left: 6px;">pre</span>
                              <span v-if="r.isDraft" class="v3a-pill" style="margin-left: 6px;">draft</span>
                            </td>
                            <td style="word-break: break-all;">{{ r.name || '—' }}</td>
                            <td style="text-align:center; white-space: nowrap;">{{ r.publishedAt ? formatTime(isoToTs(r.publishedAt), settingsData.site.timezone) : '—' }}</td>
                            <td style="text-align:right; white-space: nowrap;">
                              <button class="v3a-mini-btn" type="button" @click="openExternal(r.url)">查看</button>
                            </td>
                          </tr>
                          <tr v-if="!upgradeReleases.length">
                            <td colspan="4" class="v3a-muted" style="padding: 16px;">暂无 release 数据</td>
                          </tr>
                        </tbody>
                      </table>
                      </div>
                    </div>
                  </div>

                  <div style="margin-top: calc(var(--spacing) * 4);">
                    <div style="display:flex; align-items:center; justify-content: space-between; margin-bottom: 8px;">
                      <div class="v3a-muted" style="font-weight: 500;">系统操作</div>
                    </div>
                    <div class="v3a-card">
                      <div class="bd">
                        <div class="v3a-muted" style="margin-bottom: 10px;">数据迁移（zip）与旧版本数据库表维护。</div>
                        <div style="display:flex; gap: 10px; flex-wrap: wrap;">
                          <button class="v3a-btn" type="button" @click="openV3aDataModal()" :disabled="v3aDataWorking || v3aLegacyWorking">数据迁移</button>
                          <button class="v3a-btn" type="button" @click="openV3aLegacyModal()" :disabled="v3aDataWorking || v3aLegacyWorking">旧版本维护</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>

                <div v-if="upgradeConfirmOpen" class="v3a-modal-mask" @click.self="closeUpgradeConfirm()">
                  <div class="v3a-modal-card" role="dialog" aria-modal="true" style="max-width: 520px;">
                    <button class="v3a-modal-close" type="button" aria-label="关闭" @click="closeUpgradeConfirm()">
                      <span class="v3a-icon" v-html="ICONS.close"></span>
                    </button>
                    <div class="v3a-modal-head">
                      <div class="v3a-modal-title">确认升级</div>
                      <div class="v3a-modal-subtitle">升级过程中请勿关闭页面</div>
                    </div>
                    <div class="v3a-modal-body">
                      <div class="v3a-settings-fields" style="border-top: 0; border-bottom: 0;">
                        <div class="v3a-settings-row">
                          <div class="v3a-settings-row-label"><label>升级模式</label></div>
                          <div class="v3a-settings-row-control">
                            <span class="v3a-muted">{{ upgradeModeLabel }}</span>
                          </div>
                        </div>
                        <div class="v3a-settings-row">
                          <div class="v3a-settings-row-label"><label>全局替换</label></div>
                          <div class="v3a-settings-row-control">
                            <span class="v3a-muted">{{ upgradeReplaceLabel }}</span>
                          </div>
                        </div>
                        <div class="v3a-muted" style="margin-top: 10px; font-size: 12px; line-height: 1.6;">
                          提示：升级会覆盖插件文件，建议先在「维护 → 备份」中做好备份。
                        </div>
                      </div>
                      <div class="v3a-modal-actions">
                        <button class="v3a-btn v3a-modal-btn" type="button" @click="closeUpgradeConfirm()" :disabled="upgradeWorking">取消</button>
                        <button class="v3a-btn primary v3a-modal-btn" type="button" @click="confirmUpgrade()" :disabled="upgradeWorking">
                          {{ upgradeWorking ? "升级中…" : "开始升级" }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

	                <div v-if="upgradeSettingsOpen" class="v3a-modal-mask" @click.self="closeUpgradeSettings()">
	                  <div class="v3a-modal-card v3a-upgrade-settings-modal" role="dialog" aria-modal="true">
	                    <button class="v3a-modal-close" type="button" aria-label="关闭" @click="closeUpgradeSettings()">
	                      <span class="v3a-icon" v-html="ICONS.close"></span>
	                    </button>
                    <div class="v3a-modal-head">
                      <div class="v3a-modal-title">升级设置</div>
                      <div class="v3a-modal-subtitle">默认关闭，按需开启</div>
                    </div>
                    <div class="v3a-modal-body">
                      <div class="v3a-settings-fields" style="border-top: 0; border-bottom: 0;">
                        <div class="v3a-settings-row">
                          <div class="v3a-settings-row-label">
                            <label>严格升级</label>
                            <div class="v3a-settings-row-help">不以 release 为准，直接对比 GitHub 默认分支最新 commit。</div>
                          </div>
                          <div class="v3a-settings-row-control">
                            <label class="v3a-switch">
                              <input type="checkbox" v-model="upgradeSettingsForm.strict" :true-value="1" :false-value="0" :disabled="upgradeSettingsSaving" />
                              <span class="v3a-switch-ui"></span>
                            </label>
                          </div>
                        </div>

	                        <div class="v3a-settings-row">
	                          <div class="v3a-settings-row-label">
	                            <label>全局替换</label>
	                            <div class="v3a-settings-row-help">升级时同步替换站点根目录 <code>/Vue3Admin/</code>（无需停用/启用插件）。</div>
	                          </div>
	                          <div class="v3a-settings-row-control">
	                            <label class="v3a-switch">
	                              <input type="checkbox" v-model="upgradeSettingsForm.globalReplace" :true-value="1" :false-value="0" :disabled="upgradeSettingsSaving" />
	                              <span class="v3a-switch-ui"></span>
	                            </label>
	                          </div>
	                        </div>

	                        <div class="v3a-settings-row">
	                          <div class="v3a-settings-row-label">
	                            <label>网络设置</label>
	                            <div class="v3a-settings-row-help" style="line-height: 1.7;">
	                              GitCode仓库：<code>https://gitcode.com/TGU-HansJack/Vue3Admin-Typecho</code><br />
	                              GitHub仓库：<code>https://github.com/TGU-HansJack/Vue3Admin-Typecho</code><br />
	                              加速域名：<code>https://ghfast.top/https://github.com/TGU-HansJack/Vue3Admin-Typecho</code>
	                            </div>
	                          </div>
	                          <div class="v3a-settings-row-control">
	                            <select class="v3a-select" v-model="upgradeSettingsForm.network" :disabled="upgradeSettingsSaving">
	                              <option value="gitcode">GitCode仓库</option>
	                              <option value="github">GitHub仓库</option>
	                              <option value="ghfast">加速域名</option>
	                            </select>
	                          </div>
	                        </div>
	                      </div>
	
	                      <div class="v3a-modal-actions">
	                        <button class="v3a-btn v3a-modal-btn" type="button" @click="closeUpgradeSettings()" :disabled="upgradeSettingsSaving">取消</button>
	                        <button class="v3a-btn primary v3a-modal-btn" type="button" @click="saveUpgradeSettings()" :disabled="upgradeSettingsSaving">
                          {{ upgradeSettingsSaving ? "保存中…" : "保存" }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-if="v3aDataModalOpen" class="v3a-modal-mask" @click.self="closeV3aDataModal()">
                  <div class="v3a-modal-card" role="dialog" aria-modal="true" style="max-width: 560px;">
                    <button class="v3a-modal-close" type="button" aria-label="关闭" @click="closeV3aDataModal()">
                      <span class="v3a-icon" v-html="ICONS.close"></span>
                    </button>
                    <div class="v3a-modal-head">
                      <div class="v3a-modal-title">数据迁移</div>
                      <div class="v3a-modal-subtitle">导入/导出 Vue3Admin 本地数据（zip）</div>
                    </div>
                    <div class="v3a-modal-body">
                      <div class="v3a-settings-fields" style="border-top: 0; border-bottom: 0;">
                        <div class="v3a-settings-row">
                          <div class="v3a-settings-row-label">
                            <label>导入数据</label>
                            <div class="v3a-settings-row-help">上传 .zip 并导入（自动备份旧数据）。</div>
                          </div>
                            <div class="v3a-settings-row-control">
                              <div style="display:flex; gap: 10px; align-items: center; justify-content: flex-end; flex-wrap: wrap;">
                                <input class="v3a-input" type="text" :value="v3aDataImportFile ? v3aDataImportFile.name : ''" placeholder="选择 .zip 文件…" readonly style="flex: 1; min-width: 220px; width: 260px; max-width: 100%;" />
                                <button class="v3a-btn" type="button" @click="v3aDataImportEl && v3aDataImportEl.click()" :disabled="v3aDataWorking">浏览…</button>
                                <input ref="v3aDataImportEl" type="file" accept=".zip" @change="onV3aDataImportChange" style="display: none;" :disabled="v3aDataWorking" />
                                <button class="v3a-btn primary" type="button" @click="importV3aData()" :disabled="v3aDataWorking || !v3aDataImportFile">
                                  {{ v3aDataWorking ? "导入中…" : "导入数据" }}
                                </button>
                              </div>
                            </div>
                        </div>

                        <div class="v3a-settings-row">
                          <div class="v3a-settings-row-label">
                            <label>导出数据</label>
                            <div class="v3a-settings-row-help">打包全部数据为 .zip 并下载。</div>
                          </div>
                          <div class="v3a-settings-row-control">
                            <div style="display:flex; gap: 10px; align-items: center; justify-content: flex-end; flex-wrap: wrap;">
                              <input class="v3a-input" type="text" :value="v3aDataExportFile" placeholder="未导出" readonly style="width: 260px; max-width: 100%;" />
                              <button class="v3a-btn" type="button" @click="exportV3aData()" :disabled="v3aDataWorking">
                                {{ v3aDataWorking ? "处理中…" : "导出数据" }}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-if="v3aLegacyModalOpen" class="v3a-modal-mask" @click.self="closeV3aLegacyModal()">
                  <div class="v3a-modal-card" role="dialog" aria-modal="true" style="max-width: 520px;">
                    <button class="v3a-modal-close" type="button" aria-label="关闭" @click="closeV3aLegacyModal()">
                      <span class="v3a-icon" v-html="ICONS.close"></span>
                    </button>
                    <div class="v3a-modal-head">
                      <div class="v3a-modal-title">数据库表维护</div>
                      <div class="v3a-modal-subtitle">迁移旧版本 SQL 表数据到本地存储，并删除旧表。</div>
                    </div>
                    <div class="v3a-modal-body">
                      <div class="v3a-muted" style="margin-bottom: 12px; line-height: 1.7;">此操作不可逆，建议先做好站点备份。</div>
                      <button class="v3a-btn primary" type="button" @click="runV3aLegacyMaintenance()" :disabled="v3aLegacyWorking">
                        {{ v3aLegacyWorking ? "维护中…" : "开始维护" }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="routePath === '/about'">
              <div class="v3a-container">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarToggleTitle">
                      <span class="v3a-icon" v-html="sidebarToggleIcon"></span>
                    </button>
                    <div class="v3a-pagehead-title v3a-pagehead-title--path" :title="crumb">
                      <span v-if="crumbPath" class="v3a-pagehead-title-path">{{ crumbPath }}</span>
                      <span v-if="crumbPath" class="v3a-pagehead-title-sep"> / </span>
                      <span class="v3a-pagehead-title-current">{{ crumbCurrent || crumb }}</span>
                    </div>
                  </div>
                  <div class="v3a-pagehead-actions">
                    <a class="v3a-actionbtn" :href="aboutRepoUrl" target="_blank" rel="noreferrer" title="GitHub">
                      <span class="v3a-icon" v-html="ICONS.github"></span>
                    </a>
                    <a class="v3a-actionbtn" :href="aboutWebsiteUrl" target="_blank" rel="noreferrer" title="官网">
                      <span class="v3a-icon" v-html="ICONS.externalLink"></span>
                    </a>
                  </div>
                </div>

                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                  <div class="v3a-muted" style="font-weight: 500;">Vue3Admin</div>
                  <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: flex-end;">
                    <span v-if="aboutVersion" class="v3a-pill info">v{{ aboutVersion }}</span>
                    <span v-if="aboutBuildTime" class="v3a-pill">Build {{ aboutBuildTime }}</span>
                  </div>
                </div>

                <div class="v3a-card">
                  <div class="bd">
                    <div style="font-size: 18px; font-weight: 700; margin-bottom: 6px;">基于现代化风格的 Typecho 后台面板插件</div>
                    <div class="v3a-muted" style="line-height: 1.7;">
                      启用后接管 Typecho 后台路径，并自动部署资源到站点根目录的
                      <code style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">/Vue3Admin/</code>。
                      提供仪表盘数据统计、文章/页面/评论/文件等后台管理体验，并支持可选扩展模块。
                    </div>

                    <div style="display:flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;">
                      <span class="v3a-pill">作者：HansJack</span>
                      <span class="v3a-pill">QQ群：{{ aboutQqGroup }}</span>
                    </div>

                    <div style="display:flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 12px;">
                      <a v-for="b in aboutBadges" :key="b.alt" :href="b.href" target="_blank" rel="noreferrer" :title="b.alt">
                        <img :src="b.src" :alt="b.alt" loading="lazy" referrerpolicy="no-referrer" style="height: 20px; display:block;" />
                      </a>
                    </div>

                    <div class="v3a-grid two" style="margin-top: 16px;">
                      <div>
                        <div style="font-weight: 600; margin-bottom: 6px;">功能概览</div>
                        <ul style="margin: 0 0 0 18px; padding: 0; line-height: 1.8;">
                          <li>接管后台路径：<code style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">/Vue3Admin/</code></li>
                          <li>自动部署后台资源到站点根目录</li>
                          <li>仪表盘统计：前台访问可上报写入本地</li>
                        </ul>
                      </div>
                      <div>
                        <div style="font-weight: 600; margin-bottom: 6px;">注意事项</div>
                        <ul style="margin: 0 0 0 18px; padding: 0; line-height: 1.8;">
                          <li>首次启用会改写 <code style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">config.inc.php</code> 并自动备份</li>
                          <li>请确保站点根目录具备写权限，否则部署会失败</li>
                          <li>建议使用 Release 包安装（开发版接口可能调整）</li>
                        </ul>
                      </div>
                      <div>
                        <div style="font-weight: 600; margin-bottom: 6px;">数据存储</div>
                        <div class="v3a-muted" style="line-height: 1.7;">
                          默认存放于 <code style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">usr/plugins/Vue3Admin/cache/v3a_data.sqlite</code>（需要 <code style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">pdo_sqlite</code>）。
                        </div>
                      </div>
                      <div>
                        <div style="font-weight: 600; margin-bottom: 6px;">交流与反馈</div>
                        <div class="v3a-muted" style="line-height: 1.7;">
                          QQ 群：{{ aboutQqGroup }}；问题反馈：<a :href="aboutRepoUrl + '/issues'" target="_blank" rel="noreferrer">GitHub Issues</a>。
                        </div>
                      </div>
                    </div>

                    <div style="margin-top: 16px;">
                      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <div class="v3a-muted" style="font-weight: 500;">赞助</div>
                        <div class="v3a-muted" style="font-size: 12px;">感谢支持</div>
                      </div>
                      <div class="v3a-muted" style="margin-bottom: 12px; line-height: 1.7;">如果这个项目对你有帮助，欢迎赞助支持持续更新与维护。</div>
                      <div style="display: flex; justify-content: center;">
                        <img :src="aboutSponsorUrl" alt="赞助二维码" style="width: 100%; max-width: 600px; height: auto; display: block; border-radius: 10px; border: 1px solid var(--sidebar-border);" loading="lazy" />
                      </div>
                    </div>
                  </div>
                </div>

                <div style="margin-top: 16px;">
                  <div>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                      <div class="v3a-muted" style="font-weight: 500;">致谢</div>
                      <div class="v3a-muted" style="font-size: 12px;">Thanks</div>
                    </div>
                    <div class="v3a-card">
                      <div class="bd">
                        <div class="v3a-muted" style="margin-bottom: 10px; line-height: 1.7;">基于 GitHub Commit 记录与当前代码调用点整理（持续补充）：</div>
                        <ul class="v3a-about-thanks-list">
                          <li v-for="t in aboutThanks" :key="t.name" class="v3a-about-thanks-item">
                            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                              <a v-if="t.url" :href="t.url" target="_blank" rel="noreferrer">{{ t.name }}</a>
                              <span v-else>{{ t.name }}</span>
                              <span v-if="t.scope" class="v3a-pill">{{ t.scope }}</span>
                            </div>
                            <div v-if="t.desc" class="v3a-muted" style="font-size: 12px; line-height: 1.7; margin-top: 4px;">{{ t.desc }}</div>
                            <div v-if="t.adopted" class="v3a-muted" style="font-size: 12px; line-height: 1.7; margin-top: 2px;">采纳内容：{{ t.adopted }}</div>
                            <div v-if="t.refs" class="v3a-muted" style="font-size: 12px; line-height: 1.7; margin-top: 2px;">调用点：{{ t.refs }}</div>
                            <div v-if="t.commits" class="v3a-muted" style="font-size: 12px; line-height: 1.7; margin-top: 2px;">相关提交：{{ t.commits }}</div>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="v3a-muted" style="margin-top: 16px; line-height: 1.8; text-align: center;">
                  © HansJack. All rights reserved. 源码/资源的许可协议请以 GitHub 仓库中的 LICENSE 为准。
                </div>
              </div>
            </template>

            <template v-else-if="routePath === '/settings'">
              <div class="v3a-container">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarToggleTitle">
                      <span class="v3a-icon" v-html="sidebarToggleIcon"></span>
                    </button>
                    <div class="v3a-pagehead-title v3a-pagehead-title--path" :title="crumb">
                      <span v-if="crumbPath" class="v3a-pagehead-title-path">{{ crumbPath }}</span>
                      <span v-if="crumbPath" class="v3a-pagehead-title-sep"> / </span>
                      <span class="v3a-pagehead-title-current">{{ crumbCurrent || crumb }}</span>
                    </div>
                  </div>
                  <div class="v3a-pagehead-actions">
                    <div v-if="!String(settingsActiveKey || '').startsWith('theme.')" class="v3a-settings-savebar" data-tour="settings-savebar">
                      <span v-if="settingsDirtyCount" class="v3a-settings-savehint">
                        你有 {{ settingsDirtyCount }} 项未保存的修改
                      </span>
                      <button class="v3a-btn primary" type="button" @click="saveSettingsAll()" :disabled="settingsLoading || settingsSaving || settingsBatchSaving || !settingsDirtyCount">
                        <span class="v3a-icon" v-html="ICONS.save"></span>
                        保存全部
                      </button>
                    </div>
                  </div>
                </div>

                <div v-if="settingsLoading" class="v3a-muted">正在加载…</div>

                <div v-else class="v3a-grid">
                  <template v-if="settingsActiveKey === 'user'">
                    <div class="v3a-settings-user">
                      <div class="v3a-settings-user-head" data-tour="settings-user-head">
                        <a class="v3a-settings-avatar" href="https://gravatar.com" target="_blank" rel="noreferrer" title="在 Gravatar 上修改头像">
                          <img v-if="settingsData.profile.avatar" :src="settingsData.profile.avatar" alt="" />
                          <div v-else class="v3a-settings-avatar-fallback">{{ userInitial }}</div>
                          <div class="v3a-settings-avatar-overlay">
                            <span class="v3a-icon" v-html="ICONS.plus"></span>
                          </div>
                        </a>
                        <div class="v3a-settings-user-meta">
                          <div class="v3a-settings-user-name">{{ settingsProfileForm.screenName || settingsData.profile.screenName || username }}</div>
                          <div v-if="settingsData.profile.name" class="v3a-settings-user-sub">@{{ settingsData.profile.name }}</div>
                          <div class="v3a-settings-user-pills">
                            <span v-if="settingsProfileForm.mail" class="v3a-settings-user-pill">
                              <span class="v3a-icon" v-html="ICONS.subscribe"></span>
                              {{ settingsProfileForm.mail }}
                            </span>
                            <span v-if="settingsProfileForm.url" class="v3a-settings-user-pill">
                              <span class="v3a-icon" v-html="ICONS.link"></span>
                              {{ settingsProfileForm.url }}
                            </span>
                            <span v-if="settingsData.profile.group" class="v3a-settings-user-pill">
                              <span class="v3a-icon" v-html="ICONS.shield"></span>
                              {{ settingsData.profile.group }}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div class="v3a-settings-section">
                        <div class="v3a-settings-section-hd">
                          <div class="v3a-settings-section-hd-left">
                            <div class="v3a-settings-section-icon">
                              <span class="v3a-icon" v-html="ICONS.user"></span>
                            </div>
                            <div class="v3a-settings-section-titles">
                              <div class="v3a-settings-section-title">基本信息</div>
                              <div class="v3a-settings-section-subtitle">昵称、邮箱、主页</div>
                            </div>
                          </div>
                        </div>

                        <div class="v3a-settings-fields">
                          <div class="v3a-settings-row">
                            <div class="v3a-settings-row-label">
                              <label>昵称</label>
                            </div>
                            <div class="v3a-settings-row-control">
                              <input class="v3a-input" v-model="settingsProfileForm.screenName" placeholder="输入昵称…" />
                            </div>
                          </div>

                          <div class="v3a-settings-row">
                            <div class="v3a-settings-row-label">
                              <label>用户名</label>
                              <div class="v3a-settings-row-help">登录名（不可修改）</div>
                            </div>
                            <div class="v3a-settings-row-control">
                              <input class="v3a-input" :value="settingsData.profile.name" disabled />
                            </div>
                          </div>

                          <div class="v3a-settings-row">
                            <div class="v3a-settings-row-label">
                              <label>邮箱</label>
                            </div>
                            <div class="v3a-settings-row-control">
                              <input class="v3a-input" type="email" v-model="settingsProfileForm.mail" placeholder="输入邮箱…" />
                            </div>
                          </div>

                          <div class="v3a-settings-row">
                            <div class="v3a-settings-row-label">
                              <label>个人主页</label>
                            </div>
                            <div class="v3a-settings-row-control">
                              <input class="v3a-input" type="url" v-model="settingsProfileForm.url" placeholder="https://example.com" />
                            </div>
                          </div>
                        </div>

                      </div>

                      <div class="v3a-settings-section">
                        <div class="v3a-settings-section-hd">
                          <div class="v3a-settings-section-hd-left">
                            <div class="v3a-settings-section-icon">
                              <span class="v3a-icon" v-html="ICONS.fileText"></span>
                            </div>
                            <div class="v3a-settings-section-titles">
                              <div class="v3a-settings-section-title">撰写设置</div>
                              <div class="v3a-settings-section-subtitle">编辑器与默认选项</div>
                            </div>
                          </div>
                        </div>

                        <div class="v3a-settings-fields">
                          <div class="v3a-settings-row">
                            <div class="v3a-settings-row-label">
                              <label>使用 Markdown</label>
                            </div>
                            <div class="v3a-settings-row-control">
                              <label class="v3a-switch">
                                <input type="checkbox" v-model="settingsUserOptionsForm.markdown" :true-value="1" :false-value="0" />
                                <span class="v3a-switch-ui"></span>
                              </label>
                            </div>
                          </div>

                          <div class="v3a-settings-row">
                            <div class="v3a-settings-row-label">
                              <label>XMLRPC Markdown</label>
                            </div>
                            <div class="v3a-settings-row-control">
                              <label class="v3a-switch">
                                <input type="checkbox" v-model="settingsUserOptionsForm.xmlrpcMarkdown" :true-value="1" :false-value="0" />
                                <span class="v3a-switch-ui"></span>
                              </label>
                            </div>
                          </div>

                          <div class="v3a-settings-row">
                            <div class="v3a-settings-row-label">
                              <label>自动保存</label>
                            </div>
                            <div class="v3a-settings-row-control">
                              <label class="v3a-switch">
                                <input type="checkbox" v-model="settingsUserOptionsForm.autoSave" :true-value="1" :false-value="0" />
                                <span class="v3a-switch-ui"></span>
                              </label>
                            </div>
                          </div>

                          <div class="v3a-settings-row">
                            <div class="v3a-settings-row-label">
                              <label>默认允许</label>
                            </div>
                            <div class="v3a-settings-row-control">
                              <div style="display:flex; flex-wrap: wrap; gap: 12px;">
                                <label class="v3a-remember" style="margin: 0;">
                                  <input class="v3a-check" type="checkbox" value="comment" v-model="settingsUserOptionsForm.defaultAllow" />
                                  <span>评论</span>
                                </label>
                                <label class="v3a-remember" style="margin: 0;">
                                  <input class="v3a-check" type="checkbox" value="ping" v-model="settingsUserOptionsForm.defaultAllow" />
                                  <span>引用</span>
                                </label>
                                <label class="v3a-remember" style="margin: 0;">
                                  <input class="v3a-check" type="checkbox" value="feed" v-model="settingsUserOptionsForm.defaultAllow" />
                                  <span>聚合</span>
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  </template>

                  <template v-else-if="settingsActiveKey === 'security'">
                    <div class="v3a-settings-user">
                      <div class="v3a-settings-section">
                        <div class="v3a-settings-section-hd">
                          <div class="v3a-settings-section-hd-left">
                            <div class="v3a-settings-section-icon">
                              <span class="v3a-icon" v-html="ICONS.shield"></span>
                            </div>
                            <div class="v3a-settings-section-titles">
                              <div class="v3a-settings-section-title">账号安全</div>
                              <div class="v3a-settings-section-subtitle">修改密码</div>
                            </div>
                          </div>
                        </div>

                        <div class="v3a-settings-fields">
                          <div class="v3a-settings-row">
                            <div class="v3a-settings-row-label">
                              <label>新密码</label>
                            </div>
                            <div class="v3a-settings-row-control">
                              <input class="v3a-input" type="password" v-model="settingsPasswordForm.password" placeholder="至少 6 位" />
                            </div>
                          </div>

                          <div class="v3a-settings-row">
                            <div class="v3a-settings-row-label">
                              <label>确认密码</label>
                            </div>
                            <div class="v3a-settings-row-control">
                              <input class="v3a-input" type="password" v-model="settingsPasswordForm.confirm" placeholder="再次输入" />
                            </div>
                          </div>
                        </div>

                        <div class="v3a-settings-actions">
                          <button class="v3a-btn primary" type="button" @click="saveSettingsPassword()" :disabled="settingsSaving">更新密码</button>
                        </div>
                      </div>
                    </div>
                  </template>

                  <template v-else-if="settingsActiveKey === 'acl'">
                    <div class="v3a-settings-user">
                      <div class="v3a-settings-section">
                        <div class="v3a-settings-section-hd">
                          <div class="v3a-settings-section-hd-left">
                            <div class="v3a-settings-section-icon">
                              <span class="v3a-icon" v-html="ICONS.shieldAlert"></span>
                            </div>
                            <div class="v3a-settings-section-titles">
                              <div class="v3a-settings-section-title">权限控制</div>
                              <div class="v3a-settings-section-subtitle">按用户组微调权限与上传限制（基于旧 admin 权限模型）</div>
                            </div>
                          </div>
                          <div class="v3a-settings-section-hd-right">
                            <select v-if="settingsAclLoaded" class="v3a-select" style="width: 140px;" v-model="settingsAclGroup">
                              <option value="administrator">管理员</option>
                              <option value="editor">编辑</option>
                              <option value="contributor">贡献者</option>
                              <option value="subscriber">关注者</option>
                              <option value="visitor">访问者</option>
                            </select>
                          </div>
                        </div>

                        <div v-if="settingsAclLoading" class="v3a-muted">正在加载…</div>
                        <div v-else-if="!settingsAclLoaded" class="v3a-muted">权限配置未加载（自动加载失败可刷新页面重试）。</div>

                        <template v-else>
                          <div class="v3a-card" style="margin-top: 12px;">
                            <div class="bd" style="padding: 0;">
                              <table class="v3a-table v3a-acl-table">
                              <thead>
                                <tr>
                                  <th>权限项</th>
                                  <th style="width: 280px;">配置</th>
                                  <th>说明</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td>撰写文章</td>
                                  <td>
                                    <label class="v3a-remember" style="margin: 0;">
                                      <input class="v3a-check" type="checkbox" v-model="settingsAclForm.groups[settingsAclGroup].posts.write" :true-value="1" :false-value="0" :disabled="settingsAclGroupLevel > 2" />
                                      <span>启用</span>
                                    </label>
                                  </td>
                                  <td class="v3a-muted">贡献者发布将进入「待审核」。</td>
                                </tr>
                                <tr>
                                  <td>管理文章</td>
                                  <td>
                                    <label class="v3a-remember" style="margin: 0;">
                                      <input class="v3a-check" type="checkbox" v-model="settingsAclForm.groups[settingsAclGroup].posts.manage" :true-value="1" :false-value="0" :disabled="settingsAclGroupLevel > 2" />
                                      <span>启用</span>
                                    </label>
                                  </td>
                                  <td class="v3a-muted">贡献者仅限管理自己的文章。</td>
                                </tr>
                                <tr>
                                  <td>查看全部文章</td>
                                  <td>
                                    <label class="v3a-remember" style="margin: 0;">
                                      <input class="v3a-check" type="checkbox" v-model="settingsAclForm.groups[settingsAclGroup].posts.scopeAll" :true-value="1" :false-value="0" :disabled="settingsAclGroupLevel > 1" />
                                      <span>启用</span>
                                    </label>
                                  </td>
                                  <td class="v3a-muted">用于审核/管理其他用户文章。</td>
                                </tr>
                                <tr>
                                  <td>分类 / 标签</td>
                                  <td>
                                    <label class="v3a-remember" style="margin: 0;">
                                      <input class="v3a-check" type="checkbox" v-model="settingsAclForm.groups[settingsAclGroup].posts.taxonomy" :true-value="1" :false-value="0" :disabled="settingsAclGroupLevel > 1" />
                                      <span>启用</span>
                                    </label>
                                  </td>
                                  <td class="v3a-muted">分类与标签的创建、编辑、删除。</td>
                                </tr>
                                <tr>
                                  <td>评论管理</td>
                                  <td>
                                    <label class="v3a-remember" style="margin: 0;">
                                      <input class="v3a-check" type="checkbox" v-model="settingsAclForm.groups[settingsAclGroup].comments.manage" :true-value="1" :false-value="0" :disabled="settingsAclGroupLevel > 1" />
                                      <span>启用</span>
                                    </label>
                                  </td>
                                  <td class="v3a-muted">包含审核、回复、编辑、删除。</td>
                                </tr>
                                <tr>
                                  <td>查看全部评论</td>
                                  <td>
                                    <label class="v3a-remember" style="margin: 0;">
                                      <input class="v3a-check" type="checkbox" v-model="settingsAclForm.groups[settingsAclGroup].comments.scopeAll" :true-value="1" :false-value="0" :disabled="settingsAclGroupLevel > 1" />
                                      <span>启用</span>
                                    </label>
                                  </td>
                                  <td class="v3a-muted">否则仅能查看自己文章下的评论（如已实现）。</td>
                                </tr>
                                <tr>
                                  <td>页面管理</td>
                                  <td>
                                    <label class="v3a-remember" style="margin: 0;">
                                      <input class="v3a-check" type="checkbox" v-model="settingsAclForm.groups[settingsAclGroup].pages.manage" :true-value="1" :false-value="0" :disabled="settingsAclGroupLevel > 1" />
                                      <span>启用</span>
                                    </label>
                                  </td>
                                  <td class="v3a-muted">撰写与管理页面。</td>
                                </tr>
                                <tr>
                                  <td>文件管理</td>
                                  <td>
                                    <label class="v3a-remember" style="margin: 0;">
                                      <input class="v3a-check" type="checkbox" v-model="settingsAclForm.groups[settingsAclGroup].files.access" :true-value="1" :false-value="0" :disabled="settingsAclGroupLevel > 2" />
                                      <span>启用</span>
                                    </label>
                                  </td>
                                  <td class="v3a-muted">查看与管理附件列表。</td>
                                </tr>
                                <tr>
                                  <td>允许上传文件</td>
                                  <td>
                                    <label class="v3a-remember" style="margin: 0;">
                                      <input class="v3a-check" type="checkbox" v-model="settingsAclForm.groups[settingsAclGroup].files.upload" :true-value="1" :false-value="0" :disabled="settingsAclGroupLevel > 2 || !settingsAclForm.groups[settingsAclGroup].files.access" />
                                      <span>启用</span>
                                    </label>
                                  </td>
                                  <td class="v3a-muted">禁用后将阻止上传接口。</td>
                                </tr>
                                <tr>
                                  <td>管理全部文件</td>
                                  <td>
                                    <label class="v3a-remember" style="margin: 0;">
                                      <input class="v3a-check" type="checkbox" v-model="settingsAclForm.groups[settingsAclGroup].files.scopeAll" :true-value="1" :false-value="0" :disabled="settingsAclGroupLevel > 1" />
                                      <span>启用</span>
                                    </label>
                                  </td>
                                  <td class="v3a-muted">禁用时仅能管理自己上传的文件。</td>
                                </tr>
                                <tr>
                                  <td>上传大小限制（MB）</td>
                                  <td>
                                    <input class="v3a-input" type="number" min="0" max="2048" v-model.number="settingsAclForm.groups[settingsAclGroup].files.maxSizeMb" :disabled="settingsAclGroupLevel > 2 || !settingsAclForm.groups[settingsAclGroup].files.upload" placeholder="0 表示不额外限制" />
                                  </td>
                                  <td class="v3a-muted">0 表示不额外限制（仍受站点全局附件限制影响）。</td>
                                </tr>
                                <tr>
                                  <td>允许上传类型</td>
                                  <td>
                                    <div style="display:flex; flex-wrap: wrap; gap: 10px;">
                                      <label class="v3a-remember" style="margin: 0;">
                                        <input class="v3a-check" type="checkbox" value="jpg" v-model="settingsAclForm.groups[settingsAclGroup].files.types" :disabled="settingsAclGroupLevel > 2 || !settingsAclForm.groups[settingsAclGroup].files.upload" />
                                        <span>jpg</span>
                                      </label>
                                      <label class="v3a-remember" style="margin: 0;">
                                        <input class="v3a-check" type="checkbox" value="png" v-model="settingsAclForm.groups[settingsAclGroup].files.types" :disabled="settingsAclGroupLevel > 2 || !settingsAclForm.groups[settingsAclGroup].files.upload" />
                                        <span>png</span>
                                      </label>
                                      <label class="v3a-remember" style="margin: 0;">
                                        <input class="v3a-check" type="checkbox" value="gif" v-model="settingsAclForm.groups[settingsAclGroup].files.types" :disabled="settingsAclGroupLevel > 2 || !settingsAclForm.groups[settingsAclGroup].files.upload" />
                                        <span>gif</span>
                                      </label>
                                      <label class="v3a-remember" style="margin: 0;">
                                        <input class="v3a-check" type="checkbox" value="webp" v-model="settingsAclForm.groups[settingsAclGroup].files.types" :disabled="settingsAclGroupLevel > 2 || !settingsAclForm.groups[settingsAclGroup].files.upload" />
                                        <span>webp</span>
                                      </label>
                                      <label class="v3a-remember" style="margin: 0;">
                                        <input class="v3a-check" type="checkbox" value="zip" v-model="settingsAclForm.groups[settingsAclGroup].files.types" :disabled="settingsAclGroupLevel > 2 || !settingsAclForm.groups[settingsAclGroup].files.upload" />
                                        <span>zip</span>
                                      </label>
                                      <label class="v3a-remember" style="margin: 0;">
                                        <input class="v3a-check" type="checkbox" value="pdf" v-model="settingsAclForm.groups[settingsAclGroup].files.types" :disabled="settingsAclGroupLevel > 2 || !settingsAclForm.groups[settingsAclGroup].files.upload" />
                                        <span>pdf</span>
                                      </label>
                                      <label class="v3a-remember" style="margin: 0;">
                                        <input class="v3a-check" type="checkbox" value="mp4" v-model="settingsAclForm.groups[settingsAclGroup].files.types" :disabled="settingsAclGroupLevel > 2 || !settingsAclForm.groups[settingsAclGroup].files.upload" />
                                        <span>mp4</span>
                                      </label>
                                      <label class="v3a-remember" style="margin: 0;">
                                        <input class="v3a-check" type="checkbox" value="mp3" v-model="settingsAclForm.groups[settingsAclGroup].files.types" :disabled="settingsAclGroupLevel > 2 || !settingsAclForm.groups[settingsAclGroup].files.upload" />
                                        <span>mp3</span>
                                      </label>
                                    </div>
                                  </td>
                                  <td class="v3a-muted">留空表示不额外限制（仍会校验全局附件类型）。</td>
                                </tr>
                                <tr>
                                  <td>用户 / 链接 / 数据 / 维护</td>
                                  <td>
                                    <div style="display:flex; flex-wrap: wrap; gap: 12px;">
                                      <label class="v3a-remember" style="margin: 0;">
                                        <input class="v3a-check" type="checkbox" v-model="settingsAclForm.groups[settingsAclGroup].users.manage" :true-value="1" :false-value="0" :disabled="settingsAclGroupLevel > 0" />
                                        <span>用户</span>
                                      </label>
                                      <label class="v3a-remember" style="margin: 0;">
                                        <input class="v3a-check" type="checkbox" v-model="settingsAclForm.groups[settingsAclGroup].friends.manage" :true-value="1" :false-value="0" :disabled="settingsAclGroupLevel > 0" />
                                        <span>链接</span>
                                      </label>
                                      <label class="v3a-remember" style="margin: 0;">
                                        <input class="v3a-check" type="checkbox" v-model="settingsAclForm.groups[settingsAclGroup].data.manage" :true-value="1" :false-value="0" :disabled="settingsAclGroupLevel > 0" />
                                        <span>数据</span>
                                      </label>
                                      <label class="v3a-remember" style="margin: 0;">
                                        <input class="v3a-check" type="checkbox" v-model="settingsAclForm.groups[settingsAclGroup].maintenance.manage" :true-value="1" :false-value="0" :disabled="settingsAclGroupLevel > 0" />
                                        <span>维护</span>
                                      </label>
                                    </div>
                                  </td>
                                  <td class="v3a-muted">以上模块通常仅管理员可用。</td>
                                </tr>
                              </tbody>
                              </table>
                            </div>
                          </div>

                          <div class="v3a-muted" style="margin-top: 12px;">
                            提示：此页用于微调 Vue3Admin 内部模块权限，不会改变 Typecho 核心用户组定义。
                          </div>
                        </template>
                      </div>
                    </div>
                  </template>

                  <template v-else-if="settingsActiveKey === 'site'">
                    <div class="v3a-settings-user">
                      <div class="v3a-settings-section">
                        <div class="v3a-settings-section-hd">
                          <div class="v3a-settings-section-hd-left">
                            <div class="v3a-settings-section-icon">
                              <span class="v3a-icon" v-html="ICONS.globe"></span>
                            </div>
                            <div class="v3a-settings-section-titles">
                              <div class="v3a-settings-section-title">网站设置</div>
                              <div class="v3a-settings-section-subtitle">站点地址、SEO</div>
                            </div>
                          </div>
                        </div>

                        <div v-if="!settingsData.isAdmin" class="v3a-settings-fields">
                          <div class="v3a-settings-row">
                            <div class="v3a-settings-row-label">
                              <label>提示</label>
                            </div>
                            <div class="v3a-settings-row-control">
                              <div class="v3a-muted">需要管理员权限才能修改站点设置。</div>
                            </div>
                          </div>
                        </div>

                        <template v-else>
                          <div class="v3a-settings-fields">
                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>站点地址</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" v-model="settingsSiteForm.siteUrl" :disabled="settingsData.site.siteUrlLocked" placeholder="https://example.com" />
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>站点名称</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" v-model="settingsSiteForm.title" placeholder="title" />
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>站点描述</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" v-model="settingsSiteForm.description" placeholder="description" />
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>关键词</label>
                                <div class="v3a-settings-row-help">用逗号分隔</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" v-model="settingsSiteForm.keywords" placeholder="用逗号分隔" />
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>登录/注册风格</label>
                                <div class="v3a-settings-row-help">影响登录/注册页面样式</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <select class="v3a-select" v-model="settingsSiteForm.loginStyle">
                                  <option value="">默认</option>
                                  <option value="vercel">Vercel</option>
                                  <option value="github">GitHub</option>
                                  <option value="apple">Apple</option>
                                </select>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>登录/注册背景</label>
                                <div class="v3a-settings-row-help">填写图片 URL，留空使用默认背景；可在末尾加 #rand 防缓存实现随机图</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" v-model="settingsSiteForm.loginBackground" placeholder="https://example.com/bg.jpg" />
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>允许注册</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsSiteForm.allowRegister" :true-value="1" :false-value="0" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>默认注册用户组</label>
                                <div class="v3a-settings-row-help">不包含管理员</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <select class="v3a-select" v-model="settingsSiteForm.defaultRegisterGroup">
                                  <option value="subscriber">关注者</option>
                                  <option value="contributor">贡献者</option>
                                  <option value="editor">编辑</option>
                                  <option value="visitor">访问者</option>
                                </select>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>XMLRPC</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsSiteXmlRpcEnabled" :true-value="1" :false-value="0" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <template v-if="settingsSiteXmlRpcEnabled">
                              <div class="v3a-settings-row">
                                <div class="v3a-settings-row-label">
                                  <label>XMLRPC 模式</label>
                                </div>
                                <div class="v3a-settings-row-control">
                                  <select class="v3a-select" v-model.number="settingsSiteForm.allowXmlRpc">
                                    <option :value="1">仅关闭 Pingback</option>
                                    <option :value="2">开启</option>
                                  </select>
                                </div>
                              </div>
                            </template>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>语言</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <select class="v3a-select" v-model="settingsSiteForm.lang">
                                  <option v-for="l in settingsData.lists.langs" :key="l.value" :value="l.value">{{ l.label }}</option>
                                </select>
                              </div>
                            </div>

                            <div class="v3a-settings-row" data-tour="settings-site-timezone">
                              <div class="v3a-settings-row-label">
                                <label>时区</label>
                                <div class="v3a-settings-row-help">与旧后台一致（GMT 偏移量）</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <select class="v3a-select" v-model.number="settingsSiteForm.timezone">
                                  <option v-for="z in settingsData.lists.timezones" :key="z.value" :value="z.value">{{ z.label }}</option>
                                </select>
                              </div>
                            </div>
                          </div>

                        </template>
                      </div>
                    </div>
                  </template>

                  <template v-else-if="settingsActiveKey === 'storage'">
                    <div class="v3a-settings-user">
                      <div class="v3a-settings-section">
                        <div class="v3a-settings-section-hd">
                          <div class="v3a-settings-section-hd-left">
                            <div class="v3a-settings-section-icon">
                              <span class="v3a-icon" v-html="ICONS.data"></span>
                            </div>
                            <div class="v3a-settings-section-titles">
                              <div class="v3a-settings-section-title">附件类型</div>
                              <div class="v3a-settings-section-subtitle">附件上传类型</div>
                            </div>
                          </div>
                        </div>

                        <div v-if="!settingsData.isAdmin" class="v3a-settings-fields">
                          <div class="v3a-settings-row">
                            <div class="v3a-settings-row-label">
                              <label>提示</label>
                            </div>
                            <div class="v3a-settings-row-control">
                              <div class="v3a-muted">需要管理员权限才能修改附件设置。</div>
                            </div>
                          </div>
                        </div>

                        <template v-else>
                          <div class="v3a-settings-fields">
                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>允许上传的类型</label>
                                <div class="v3a-settings-row-help">勾选允许上传的类型（与旧后台一致）。</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <div style="display:flex; flex-wrap: wrap; gap: 12px;">
                                  <label class="v3a-remember" style="margin: 0;">
                                    <input class="v3a-check" type="checkbox" value="@image@" v-model="settingsStorageForm.attachmentTypes" />
                                    <span>图片</span>
                                  </label>
                                  <label class="v3a-remember" style="margin: 0;">
                                    <input class="v3a-check" type="checkbox" value="@media@" v-model="settingsStorageForm.attachmentTypes" />
                                    <span>媒体</span>
                                  </label>
                                  <label class="v3a-remember" style="margin: 0;">
                                    <input class="v3a-check" type="checkbox" value="@doc@" v-model="settingsStorageForm.attachmentTypes" />
                                    <span>文档</span>
                                  </label>
                                  <label class="v3a-remember" style="margin: 0;">
                                    <input class="v3a-check" type="checkbox" value="@other@" v-model="settingsStorageForm.attachmentTypes" />
                                    <span>其他</span>
                                  </label>
                                </div>
                              </div>
                            </div>

                            <template v-if="(settingsStorageForm.attachmentTypes || []).includes('@other@')">
                              <div class="v3a-settings-row">
                                <div class="v3a-settings-row-label">
                                  <label>其他格式（逗号分隔）</label>
                                </div>
                                <div class="v3a-settings-row-control">
                                  <input class="v3a-input" v-model="settingsStorageForm.attachmentTypesOther" placeholder="zip, rar, pdf" />
                                </div>
                              </div>
                            </template>
                          </div>

                        </template>
                      </div>
                    </div>
                  </template>

                  <template v-else-if="settingsActiveKey === 'content'">
                    <div class="v3a-settings-user">
                      <div class="v3a-settings-section">
                        <div class="v3a-settings-section-hd">
                          <div class="v3a-settings-section-hd-left">
                            <div class="v3a-settings-section-icon">
                              <span class="v3a-icon" v-html="ICONS.fileText"></span>
                            </div>
                            <div class="v3a-settings-section-titles">
                              <div class="v3a-settings-section-title">阅读设置</div>
                              <div class="v3a-settings-section-subtitle">阅读、归档、Feed</div>
                            </div>
                          </div>
                        </div>

                        <div v-if="!settingsData.isAdmin" class="v3a-settings-fields">
                          <div class="v3a-settings-row">
                            <div class="v3a-settings-row-label">
                              <label>提示</label>
                            </div>
                            <div class="v3a-settings-row-control">
                              <div class="v3a-muted">需要管理员权限才能修改阅读设置。</div>
                            </div>
                          </div>
                        </div>

                        <template v-else>
                          <div class="v3a-settings-fields">
                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>文章日期格式</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" v-model="settingsReadingForm.postDateFormat" placeholder="Y-m-d" />
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>首页显示</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <select class="v3a-select" v-model="settingsReadingForm.frontPageType">
                                  <option value="recent">最新文章</option>
                                  <option value="page">指定页面</option>
                                  <option value="file">主题文件</option>
                                </select>
                              </div>
                            </div>

                            <template v-if="settingsReadingForm.frontPageType === 'page'">
                              <div class="v3a-settings-row">
                                <div class="v3a-settings-row-label">
                                  <label>首页页面</label>
                                </div>
                                <div class="v3a-settings-row-control">
                                  <select class="v3a-select" v-model.number="settingsReadingForm.frontPagePage">
                                    <option :value="0">请选择</option>
                                    <option v-for="p in settingsData.lists.frontPagePages" :key="p.cid" :value="p.cid">{{ p.title }}</option>
                                  </select>
                                </div>
                              </div>
                            </template>
                            <template v-else-if="settingsReadingForm.frontPageType === 'file'">
                              <div class="v3a-settings-row">
                                <div class="v3a-settings-row-label">
                                  <label>首页文件</label>
                                </div>
                                <div class="v3a-settings-row-control">
                                  <select class="v3a-select" v-model="settingsReadingForm.frontPageFile">
                                    <option value="">请选择</option>
                                    <option v-for="f in settingsData.lists.frontPageFiles" :key="f" :value="f">{{ f }}</option>
                                  </select>
                                </div>
                              </div>
                            </template>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>每页文章数</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" type="number" v-model.number="settingsReadingForm.pageSize" />
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>侧边栏文章列表数</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" type="number" v-model.number="settingsReadingForm.postsListSize" />
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>Feed 输出全文</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsReadingForm.feedFullText" :true-value="1" :false-value="0" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>首页非最新时启用归档页</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsReadingForm.frontArchive" :true-value="1" :false-value="0" :disabled="settingsReadingForm.frontPageType === 'recent'" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <template v-if="settingsReadingForm.frontArchive && settingsReadingForm.frontPageType !== 'recent'">
                              <div class="v3a-settings-row">
                                <div class="v3a-settings-row-label">
                                  <label>归档页路径</label>
                                  <div class="v3a-settings-row-help">如：/blog/</div>
                                </div>
                                <div class="v3a-settings-row-control">
                                  <input class="v3a-input" v-model="settingsReadingForm.archivePattern" placeholder="/archive/" />
                                </div>
                              </div>
                            </template>
                          </div>

                        </template>
                      </div>

                      <div class="v3a-settings-section">
                        <div class="v3a-settings-section-hd">
                          <div class="v3a-settings-section-hd-left">
                            <div class="v3a-settings-section-icon">
                              <span class="v3a-icon" v-html="ICONS.comments"></span>
                            </div>
                            <div class="v3a-settings-section-titles">
                              <div class="v3a-settings-section-title">评论设置</div>
                              <div class="v3a-settings-section-subtitle">评论、反垃圾、HTML</div>
                            </div>
                          </div>
                        </div>

                        <div v-if="!settingsData.isAdmin" class="v3a-settings-fields">
                          <div class="v3a-settings-row">
                            <div class="v3a-settings-row-label">
                              <label>提示</label>
                            </div>
                            <div class="v3a-settings-row-control">
                              <div class="v3a-muted">需要管理员权限才能修改评论设置。</div>
                            </div>
                          </div>
                        </div>

                        <template v-else>
                          <div class="v3a-settings-fields">
                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>评论日期格式</label>
                                <div class="v3a-settings-row-help">模板未指定格式时使用（PHP date() 格式）</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" v-model="settingsDiscussionForm.commentDateFormat" placeholder="Y-m-d H:i" />
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>侧边栏评论列表数</label>
                                <div class="v3a-settings-row-help">用于侧边栏/小工具的最新评论列表</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" type="number" v-model.number="settingsDiscussionForm.commentsListSize" />
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>仅显示评论</label>
                                <div class="v3a-settings-row-help">不显示 Pingback / Trackback</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsDiscussionForm.commentsShowCommentOnly" :true-value="1" :false-value="0" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>评论中使用 Markdown</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsDiscussionForm.commentsMarkdown" :true-value="1" :false-value="0" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>评论者名称链接到主页</label>
                                <div class="v3a-settings-row-help">评论者名称显示时自动加上其个人主页链接</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsDiscussionForm.commentsShowUrl" :true-value="1" :false-value="0" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <template v-if="settingsDiscussionForm.commentsShowUrl">
                              <div class="v3a-settings-row">
                                <div class="v3a-settings-row-label">
                                  <label>评论者主页链接 nofollow</label>
                                  <div class="v3a-settings-row-help">对评论者个人主页链接使用 nofollow 属性</div>
                                </div>
                                <div class="v3a-settings-row-control">
                                  <label class="v3a-switch">
                                    <input type="checkbox" v-model="settingsDiscussionForm.commentsUrlNofollow" :true-value="1" :false-value="0" />
                                    <span class="v3a-switch-ui"></span>
                                  </label>
                                </div>
                              </div>
                            </template>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>启用 Gravatar 头像</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsDiscussionForm.commentsAvatar" :true-value="1" :false-value="0" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <template v-if="settingsDiscussionForm.commentsAvatar">
                              <div class="v3a-settings-row">
                                <div class="v3a-settings-row-label">
                                  <label>头像最高评级</label>
                                  <div class="v3a-settings-row-help">G / PG / R / X</div>
                                </div>
                                <div class="v3a-settings-row-control">
                                  <select class="v3a-select" v-model="settingsDiscussionForm.commentsAvatarRating">
                                    <option value="G">G</option>
                                    <option value="PG">PG</option>
                                    <option value="R">R</option>
                                    <option value="X">X</option>
                                  </select>
                                </div>
                              </div>
                            </template>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>评论分页</label>
                                <div class="v3a-settings-row-help">启用分页并设置每页评论数</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsDiscussionForm.commentsPageBreak" :true-value="1" :false-value="0" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <template v-if="settingsDiscussionForm.commentsPageBreak">
                              <div class="v3a-settings-row">
                                <div class="v3a-settings-row-label">
                                  <label>每页评论数</label>
                                </div>
                                <div class="v3a-settings-row-control">
                                  <input class="v3a-input" type="number" v-model.number="settingsDiscussionForm.commentsPageSize" />
                                </div>
                              </div>

                              <div class="v3a-settings-row">
                                <div class="v3a-settings-row-label">
                                  <label>默认显示</label>
                                </div>
                                <div class="v3a-settings-row-control">
                                  <select class="v3a-select" v-model="settingsDiscussionForm.commentsPageDisplay">
                                    <option value="last">最后一页</option>
                                    <option value="first">第一页</option>
                                  </select>
                                </div>
                              </div>
                            </template>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>启用评论回复</label>
                                <div class="v3a-settings-row-help">启用嵌套回复</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsDiscussionForm.commentsThreaded" :true-value="1" :false-value="0" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <template v-if="settingsDiscussionForm.commentsThreaded">
                              <div class="v3a-settings-row">
                                <div class="v3a-settings-row-label">
                                  <label>最多回复层数</label>
                                  <div class="v3a-settings-row-help">建议 2–7 层</div>
                                </div>
                                <div class="v3a-settings-row-control">
                                  <input class="v3a-input" type="number" v-model.number="settingsDiscussionForm.commentsMaxNestingLevels" />
                                </div>
                              </div>
                            </template>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>评论排序</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <select class="v3a-select" v-model="settingsDiscussionForm.commentsOrder">
                                  <option value="DESC">较新在前</option>
                                  <option value="ASC">较旧在前</option>
                                </select>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>所有评论必须审核</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsDiscussionForm.commentsRequireModeration" :true-value="1" :false-value="0" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>评论者之前须有评论通过审核</label>
                                <div class="v3a-settings-row-help">开启后，曾通过审核的评论者后续评论可免审</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsDiscussionForm.commentsWhitelist" :true-value="1" :false-value="0" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>必须填写邮箱</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsDiscussionForm.commentsRequireMail" :true-value="1" :false-value="0" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>必须填写网址</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsDiscussionForm.commentsRequireUrl" :true-value="1" :false-value="0" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>检查评论来源页</label>
                                <div class="v3a-settings-row-help">检查来源页 URL 是否与文章链接一致</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsDiscussionForm.commentsCheckReferer" :true-value="1" :false-value="0" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>反垃圾保护</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsDiscussionForm.commentsAntiSpam" :true-value="1" :false-value="0" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>自动关闭评论</label>
                                <div class="v3a-settings-row-help">在文章发布指定天数后关闭评论</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <div style="display:flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                                  <label class="v3a-switch" style="margin:0;">
                                    <input type="checkbox" v-model="settingsDiscussionForm.commentsAutoClose" :true-value="1" :false-value="0" />
                                    <span class="v3a-switch-ui"></span>
                                  </label>
                                  <template v-if="settingsDiscussionForm.commentsAutoClose">
                                    <input class="v3a-input" type="number" style="width: 140px;" v-model.number="settingsDiscussionForm.commentsPostTimeoutDays" />
                                    <div class="v3a-muted" style="font-size: 12px;">天</div>
                                  </template>
                                </div>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>同 IP 评论间隔限制</label>
                                <div class="v3a-settings-row-help">限制同一 IP 发布评论的最小时间间隔</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsDiscussionForm.commentsPostIntervalEnable" :true-value="1" :false-value="0" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <template v-if="settingsDiscussionForm.commentsPostIntervalEnable">
                              <div class="v3a-settings-row">
                                <div class="v3a-settings-row-label">
                                  <label>间隔（分钟）</label>
                                </div>
                                <div class="v3a-settings-row-control">
                                  <input class="v3a-input" type="number" step="0.1" v-model.number="settingsDiscussionForm.commentsPostIntervalMins" />
                                </div>
                              </div>
                            </template>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>允许 HTML 标签</label>
                                <div class="v3a-settings-row-help">默认用户评论不允许任何 HTML，可在此填写允许的标签与属性</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <textarea class="v3a-textarea" v-model="settingsDiscussionForm.commentsHTMLTagAllowed" placeholder="<a href> <img src>"></textarea>
                              </div>
                            </div>
                          </div>

                        </template>
                      </div>
                    </div>
                  </template>

                  <template v-else-if="settingsActiveKey === 'notify'">
                    <div class="v3a-settings-user">
                      <div class="v3a-settings-section">
                        <div class="v3a-settings-section-hd">
                          <div class="v3a-settings-section-hd-left">
                            <div class="v3a-settings-section-icon">
                              <span class="v3a-icon" v-html="ICONS.bell"></span>
                            </div>
                            <div class="v3a-settings-section-titles">
                              <div class="v3a-settings-section-title">邮件通知设置</div>
                              <div class="v3a-settings-section-subtitle">评论提醒、SMTP</div>
                            </div>
                          </div>
                        </div>

                        <div v-if="!settingsData.isAdmin" class="v3a-settings-fields">
                          <div class="v3a-settings-row">
                            <div class="v3a-settings-row-label">
                              <label>提示</label>
                            </div>
                            <div class="v3a-settings-row-control">
                              <div class="v3a-muted">需要管理员权限才能修改通知设置。</div>
                            </div>
                          </div>
                        </div>

                        <template v-else>
                          <div class="v3a-settings-fields">
                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>开启邮箱提醒</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsNotifyForm.mailEnabled" :true-value="1" :false-value="0" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <div
                              v-if="(settingsData.notify.lastSuccess && settingsData.notify.lastSuccess.time) || (settingsData.notify.lastError && settingsData.notify.lastError.time)"
                              class="v3a-settings-row"
                            >
                              <div class="v3a-settings-row-label">
                                <label>发送状态</label>
                                <div class="v3a-settings-row-help">最近一次邮件发送结果</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <div class="v3a-mail-status-wrap">
                                   <div
                                     v-if="settingsData.notify.lastSuccess && settingsData.notify.lastSuccess.time && (!settingsData.notify.lastError || !settingsData.notify.lastError.time || +settingsData.notify.lastSuccess.time >= +settingsData.notify.lastError.time)"
                                     class="v3a-mail-status success"
                                     :title="formatTime(settingsData.notify.lastSuccess.time, settingsData.site.timezone)"
                                   >
                                    <div class="v3a-mail-status-hd">
                                      <div class="v3a-mail-status-title">
                                        发送成功
                                        <span class="v3a-mail-status-kind" v-if="settingsData.notify.lastSuccess.kind">
                                           · {{ settingsData.notify.lastSuccess.kind === 'comment' ? '评论提醒' : (settingsData.notify.lastSuccess.kind === 'comment_waiting' ? '待审核评论' : (settingsData.notify.lastSuccess.kind === 'comment_reply' ? '评论回复' : (settingsData.notify.lastSuccess.kind === 'friendlink_audit_pass' ? '友链通过' : (settingsData.notify.lastSuccess.kind === 'friendlink_audit_reject' ? '友链拒绝' : (settingsData.notify.lastSuccess.kind === 'friendlink' ? '友链申请' : (settingsData.notify.lastSuccess.kind === 'test' ? '测试邮件' : settingsData.notify.lastSuccess.kind)))))) }}
                                        </span>
                                      </div>
                                      <div class="v3a-mail-status-time v3a-muted">{{ formatTimeAgo(settingsData.notify.lastSuccess.time) }}</div>
                                    </div>
                                    <div v-if="settingsData.notify.lastSuccess.message" class="v3a-mail-status-desc">
                                      {{ settingsData.notify.lastSuccess.message }}
                                    </div>
                                  </div>

                                   <div
                                     v-if="settingsData.notify.lastError && settingsData.notify.lastError.time && (!settingsData.notify.lastSuccess || !settingsData.notify.lastSuccess.time || +settingsData.notify.lastError.time > +settingsData.notify.lastSuccess.time)"
                                     class="v3a-mail-status error"
                                     :title="formatTime(settingsData.notify.lastError.time, settingsData.site.timezone)"
                                   >
                                    <div class="v3a-mail-status-hd">
                                      <div class="v3a-mail-status-title">
                                        发送失败
                                        <span class="v3a-mail-status-kind" v-if="settingsData.notify.lastError.kind">
                                           · {{ settingsData.notify.lastError.kind === 'comment' ? '评论提醒' : (settingsData.notify.lastError.kind === 'comment_waiting' ? '待审核评论' : (settingsData.notify.lastError.kind === 'comment_reply' ? '评论回复' : (settingsData.notify.lastError.kind === 'friendlink_audit_pass' ? '友链通过' : (settingsData.notify.lastError.kind === 'friendlink_audit_reject' ? '友链拒绝' : (settingsData.notify.lastError.kind === 'friendlink' ? '友链申请' : (settingsData.notify.lastError.kind === 'test' ? '测试邮件' : settingsData.notify.lastError.kind)))))) }}
                                        </span>
                                      </div>
                                      <div class="v3a-mail-status-time v3a-muted">{{ formatTimeAgo(settingsData.notify.lastError.time) }}</div>
                                    </div>
                                    <div v-if="settingsData.notify.lastError.message" class="v3a-mail-status-desc">
                                      {{ settingsData.notify.lastError.message }}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>新评论提醒</label>
                                <div class="v3a-settings-row-help">发送给文章作者；若文章作者邮箱为空，则发送至站长收件邮箱（未设置则发送给所有管理员）</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsNotifyForm.commentNotifyEnabled" :true-value="1" :false-value="0" :disabled="!settingsNotifyForm.mailEnabled" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>待审核评论提醒</label>
                                <div class="v3a-settings-row-help">发送至站长收件邮箱（未设置则发送给所有管理员），用于提醒有待审核评论</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsNotifyForm.commentWaitingNotifyEnabled" :true-value="1" :false-value="0" :disabled="!settingsNotifyForm.mailEnabled" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>评论回复提醒</label>
                                <div class="v3a-settings-row-help">发送给被回复的评论者（评论通过审核后）</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsNotifyForm.commentReplyNotifyEnabled" :true-value="1" :false-value="0" :disabled="!settingsNotifyForm.mailEnabled" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>友链申请提醒</label>
                                <div class="v3a-settings-row-help">发送至站长收件邮箱（未设置则发送给所有管理员），用于提醒有新的友链申请</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsNotifyForm.friendLinkNotifyEnabled" :true-value="1" :false-value="0" :disabled="!settingsNotifyForm.mailEnabled" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>友链审核结果通知</label>
                                <div class="v3a-settings-row-help">友链申请通过/拒绝后，发送邮件给提交者</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsNotifyForm.friendLinkAuditNotifyEnabled" :true-value="1" :false-value="0" :disabled="!settingsNotifyForm.mailEnabled" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>站长收件邮箱</label>
                                <div class="v3a-settings-row-help">留空则发送至所有管理员；多个邮箱用逗号分隔</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" v-model="settingsNotifyForm.adminTo" placeholder="admin@example.com, other@example.com" />
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>发件邮箱地址</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" type="email" v-model="settingsNotifyForm.smtpFrom" placeholder="example@domain.com" />
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>SMTP 用户名</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" v-model="settingsNotifyForm.smtpUser" placeholder="通常与发件邮箱一致" />
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>SMTP 密码</label>
                                <div class="v3a-settings-row-help">留空表示不修改</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" type="password" v-model="settingsNotifyForm.smtpPass" placeholder="输入授权码/密码" />
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>SMTP 端口</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" type="number" v-model.number="settingsNotifyForm.smtpPort" />
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>SMTP 主机</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" v-model="settingsNotifyForm.smtpHost" placeholder="smtp.example.com" />
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>使用 SSL/TLS</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsNotifyForm.smtpSecure" :true-value="1" :false-value="0" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>测试邮件</label>
                                <div class="v3a-settings-row-help">用于验证 SMTP 配置是否可用（发送到当前登录用户邮箱）</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <div style="display:flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                                  <button class="v3a-btn primary" type="button" @click="testSettingsNotify()" :disabled="settingsSaving || settingsNotifyTesting || !settingsNotifyForm.mailEnabled">
                                    {{ settingsNotifyTesting ? "发送中…" : "发送测试邮件" }}
                                  </button>
                                  <div class="v3a-muted" style="font-size: 12px;">收件人：{{ settingsData.profile.mail || "未设置" }}</div>
                                </div>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>模板样式</label>
                                <div class="v3a-settings-row-help">选择后点击“应用样式”，会覆盖当前模板内容（评论/友链）</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <div style="display:flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                                  <select class="v3a-select" v-model="settingsNotifyForm.templateStyle" style="width: 220px;">
                                    <option v-for="s in notifyTemplateStyles" :key="s.value" :value="s.value">{{ s.label }}</option>
                                  </select>
                                  <button class="v3a-btn" type="button" @click="applySettingsNotifyTemplateStyle()">应用样式</button>
                                </div>
                              </div>
                            </div>

                            <div class="v3a-settings-row v3a-settings-row-stack">
                              <div class="v3a-settings-row-label v3a-settings-row-label-actions">
                                <label>新评论提醒模板</label>
                                <button class="v3a-btn" type="button" @click="openSettingsNotifyTemplateEditor()">编辑</button>
                              </div>
                              <div class="v3a-settings-row-control">
                                <div class="v3a-mailtpl-card">
                                  <div class="v3a-mailtpl-preview" v-html="settingsNotifyTemplatePreviewHtml"></div>
                                </div>
                              </div>
                            </div>

                            <div class="v3a-settings-row v3a-settings-row-stack">
                              <div class="v3a-settings-row-label v3a-settings-row-label-actions">
                                <label>待审核评论模板</label>
                                <button class="v3a-btn" type="button" @click="openSettingsNotifyTemplateEditor('commentWaiting')">编辑</button>
                              </div>
                              <div class="v3a-settings-row-control">
                                <div class="v3a-mailtpl-card">
                                  <div class="v3a-mailtpl-preview" v-html="settingsNotifyCommentWaitingTemplatePreviewHtml"></div>
                                </div>
                              </div>
                            </div>

                            <div class="v3a-settings-row v3a-settings-row-stack">
                              <div class="v3a-settings-row-label v3a-settings-row-label-actions">
                                <label>评论回复模板</label>
                                <button class="v3a-btn" type="button" @click="openSettingsNotifyTemplateEditor('commentReply')">编辑</button>
                              </div>
                              <div class="v3a-settings-row-control">
                                <div class="v3a-mailtpl-card">
                                  <div class="v3a-mailtpl-preview" v-html="settingsNotifyCommentReplyTemplatePreviewHtml"></div>
                                </div>
                              </div>
                            </div>

                            <div class="v3a-settings-row v3a-settings-row-stack">
                              <div class="v3a-settings-row-label v3a-settings-row-label-actions">
                                <label>友链申请提醒模板</label>
                                <button class="v3a-btn" type="button" @click="openSettingsNotifyTemplateEditor('friendLink')">编辑</button>
                              </div>
                              <div class="v3a-settings-row-control">
                                <div class="v3a-mailtpl-card">
                                  <div class="v3a-mailtpl-preview" v-html="settingsNotifyFriendLinkTemplatePreviewHtml"></div>
                                </div>
                              </div>
                            </div>

                            <div class="v3a-settings-row v3a-settings-row-stack">
                              <div class="v3a-settings-row-label v3a-settings-row-label-actions">
                                <label>友链审核通过模板</label>
                                <button class="v3a-btn" type="button" @click="openSettingsNotifyTemplateEditor('friendLinkAuditPass')">编辑</button>
                              </div>
                              <div class="v3a-settings-row-control">
                                <div class="v3a-mailtpl-card">
                                  <div class="v3a-mailtpl-preview" v-html="settingsNotifyFriendLinkAuditPassTemplatePreviewHtml"></div>
                                </div>
                              </div>
                            </div>

                            <div class="v3a-settings-row v3a-settings-row-stack">
                              <div class="v3a-settings-row-label v3a-settings-row-label-actions">
                                <label>友链审核拒绝模板</label>
                                <button class="v3a-btn" type="button" @click="openSettingsNotifyTemplateEditor('friendLinkAuditReject')">编辑</button>
                              </div>
                              <div class="v3a-settings-row-control">
                                <div class="v3a-mailtpl-card">
                                  <div class="v3a-mailtpl-preview" v-html="settingsNotifyFriendLinkAuditRejectTemplatePreviewHtml"></div>
                                </div>
                              </div>
                            </div>
                          </div>

                        </template>
                      </div>
                    </div>

                    <div v-if="settingsNotifyTemplateEditorOpen" class="v3a-modal-mask" @click.self="closeSettingsNotifyTemplateEditor()">
                      <div class="v3a-modal-card" role="dialog" aria-modal="true">
                        <button class="v3a-modal-close" type="button" aria-label="关闭" @click="closeSettingsNotifyTemplateEditor()">
                          <span class="v3a-icon" v-html="ICONS.close"></span>
                        </button>
                        <div class="v3a-modal-head">
                          <div class="v3a-modal-title">编辑邮件模板（HTML） · {{ settingsNotifyTemplateKind === 'friendLinkAuditPass' ? '友链通过' : (settingsNotifyTemplateKind === 'friendLinkAuditReject' ? '友链拒绝' : (settingsNotifyTemplateKind === 'friendLink' ? '友链申请' : (settingsNotifyTemplateKind === 'commentWaiting' ? '待审核评论' : (settingsNotifyTemplateKind === 'commentReply' ? '评论回复' : '新评论')))) }}</div>
                        </div>
                        <div class="v3a-modal-body">
                          <div class="v3a-modal-form">
                            <div class="v3a-modal-item">
                              <label class="v3a-modal-label">模板内容</label>
                              <textarea class="v3a-textarea v3a-modal-textarea v3a-code-editor" v-model="settingsNotifyTemplateDraft" placeholder="<div>...</div>"></textarea>
                              <div class="v3a-muted" style="margin-top: 10px; font-size: 12px; line-height: 1.6;">
                                可用变量：
                                <template v-if="settingsNotifyTemplateKind === 'friendLinkAuditPass' || settingsNotifyTemplateKind === 'friendLinkAuditReject'">
                                  <code v-pre>{{siteTitle}}</code>
                                  <code v-pre>{{siteUrl}}</code>
                                  <code v-pre>{{auditResult}}</code>
                                  <code v-pre>{{auditTime}}</code>
                                  <code v-pre>{{linkName}}</code>
                                  <code v-pre>{{linkUrl}}</code>
                                  <code v-pre>{{linkType}}</code>
                                  <code v-pre>{{linkEmail}}</code>
                                  <code v-pre>{{linkAvatar}}</code>
                                  <code v-pre>{{linkDescription}}</code>
                                  <code v-pre>{{linkMessage}}</code>
                                  <code v-pre>{{applyTime}}</code>
                                </template>
                                <template v-else-if="settingsNotifyTemplateKind === 'friendLink'">
                                  <code v-pre>{{siteTitle}}</code>
                                  <code v-pre>{{siteUrl}}</code>
                                  <code v-pre>{{linkName}}</code>
                                  <code v-pre>{{linkUrl}}</code>
                                  <code v-pre>{{linkType}}</code>
                                  <code v-pre>{{linkEmail}}</code>
                                  <code v-pre>{{linkAvatar}}</code>
                                  <code v-pre>{{linkDescription}}</code>
                                  <code v-pre>{{linkMessage}}</code>
                                  <code v-pre>{{applyTime}}</code>
                                  <code v-pre>{{reviewUrl}}</code>
                                </template>
                                <template v-else-if="settingsNotifyTemplateKind === 'commentReply'">
                                  <code v-pre>{{siteTitle}}</code>
                                  <code v-pre>{{siteUrl}}</code>
                                  <code v-pre>{{postTitle}}</code>
                                  <code v-pre>{{postUrl}}</code>
                                  <code v-pre>{{parentAuthor}}</code>
                                  <code v-pre>{{parentTime}}</code>
                                  <code v-pre>{{parentText}}</code>
                                  <code v-pre>{{replyAuthor}}</code>
                                  <code v-pre>{{replyTime}}</code>
                                  <code v-pre>{{replyText}}</code>
                                </template>
                                <template v-else-if="settingsNotifyTemplateKind === 'commentWaiting'">
                                  <code v-pre>{{siteTitle}}</code>
                                  <code v-pre>{{siteUrl}}</code>
                                  <code v-pre>{{postTitle}}</code>
                                  <code v-pre>{{postUrl}}</code>
                                  <code v-pre>{{commentAuthor}}</code>
                                  <code v-pre>{{commentMail}}</code>
                                  <code v-pre>{{commentTime}}</code>
                                  <code v-pre>{{commentStatus}}</code>
                                  <code v-pre>{{commentText}}</code>
                                  <code v-pre>{{reviewUrl}}</code>
                                </template>
                                <template v-else>
                                  <code v-pre>{{siteTitle}}</code>
                                  <code v-pre>{{siteUrl}}</code>
                                  <code v-pre>{{postTitle}}</code>
                                  <code v-pre>{{postUrl}}</code>
                                  <code v-pre>{{commentAuthor}}</code>
                                  <code v-pre>{{commentMail}}</code>
                                  <code v-pre>{{commentTime}}</code>
                                  <code v-pre>{{commentStatus}}</code>
                                  <code v-pre>{{commentText}}</code>
                                </template>
                              </div>
                            </div>
                          </div>
                          <div class="v3a-modal-actions">
                            <button class="v3a-btn v3a-modal-btn" type="button" @click="closeSettingsNotifyTemplateEditor()">取消</button>
                            <button class="v3a-btn primary v3a-modal-btn" type="button" @click="applySettingsNotifyTemplateDraft()">确定</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </template>

                  <template v-else-if="settingsActiveKey === 'ai'">
                    <div class="v3a-settings-user">
                      <div class="v3a-settings-section">
                        <div class="v3a-settings-section-hd">
                          <div class="v3a-settings-section-hd-left">
                            <div class="v3a-settings-section-icon">
                              <span class="v3a-icon" v-html="ICONS.bot"></span>
                            </div>
                            <div class="v3a-settings-section-titles">
                              <div class="v3a-settings-section-title">AI 模型设置</div>
                              <div class="v3a-settings-section-subtitle">配置模型、接口与语言</div>
                            </div>
                          </div>
                        </div>

                        <div v-if="!settingsData.isAdmin" class="v3a-settings-fields">
                          <div class="v3a-settings-row">
                            <div class="v3a-settings-row-label">
                              <label>提示</label>
                            </div>
                            <div class="v3a-settings-row-control">
                              <div class="v3a-muted">需要管理员权限才能修改 AI 设置。</div>
                            </div>
                          </div>
                        </div>

                        <template v-else>
                          <div class="v3a-settings-fields">
                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>启用 AI</label>
                                <div class="v3a-settings-row-help">总开关：开启后可使用 AI 翻译 / 摘要 / 审核 / 润色 / 缩略名。</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsAiForm.enabled" :true-value="1" :false-value="0" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>Base URL</label>
                                <div class="v3a-settings-row-help">OpenAI 兼容接口的 /v1 地址，例如 https://api.openai.com/v1</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" v-model="settingsAiForm.baseUrl" placeholder="https://api.openai.com/v1" />
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>API Key</label>
                                <div class="v3a-settings-row-help">
                                  留空表示不修改（当前状态：{{ Number(settingsData.ai.hasApiKey || 0) ? "已配置" : "未配置" }}）。
                                </div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" type="password" v-model="settingsAiForm.apiKey" placeholder="sk-..." autocomplete="new-password" />
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>模型</label>
                                <div class="v3a-settings-row-help">例如 gpt-4o-mini</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" v-model="settingsAiForm.model" placeholder="gpt-4o-mini" />
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>Temperature</label>
                                <div class="v3a-settings-row-help">取值范围 0 - 2（建议 0.2 - 0.6）</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" type="number" step="0.1" min="0" max="2" v-model.number="settingsAiForm.temperature" />
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>Timeout</label>
                                <div class="v3a-settings-row-help">请求超时（秒）</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" type="number" min="10" max="300" v-model.number="settingsAiForm.timeout" />
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>语言列表</label>
                                <div class="v3a-settings-row-help">
                                  用于 AI 翻译/摘要的语言（逗号或空格分隔），也用于前台路径前缀：/en/ /zh/ /ja/ /fr/
                                </div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" v-model="settingsAiForm.languages" placeholder="en,zh,ja,fr" />
                              </div>
                            </div>
                          </div>
                        </template>
                      </div>

                      <div class="v3a-settings-section">
                        <div class="v3a-settings-section-hd">
                          <div class="v3a-settings-section-hd-left">
                            <div class="v3a-settings-section-icon">
                              <span class="v3a-icon" v-html="ICONS.cable"></span>
                            </div>
                            <div class="v3a-settings-section-titles">
                              <div class="v3a-settings-section-title">AI 功能启用</div>
                              <div class="v3a-settings-section-subtitle">翻译、摘要、评论审核、润色、缩略名</div>
                            </div>
                          </div>
                        </div>

                        <div v-if="!settingsData.isAdmin" class="v3a-settings-fields">
                          <div class="v3a-settings-row">
                            <div class="v3a-settings-row-label">
                              <label>提示</label>
                            </div>
                            <div class="v3a-settings-row-control">
                              <div class="v3a-muted">需要管理员权限才能修改 AI 设置。</div>
                            </div>
                          </div>
                        </div>

                        <template v-else>
                          <div class="v3a-settings-fields">
                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>AI 翻译</label>
                                <div class="v3a-settings-row-help">启用后，“额外功能”中可使用 AI 翻译，并支持 /{lang}/ 前缀访问翻译内容。</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsAiForm.translateEnabled" :true-value="1" :false-value="0" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>AI 摘要</label>
                                <div class="v3a-settings-row-help">启用后，“额外功能”中可使用 AI 摘要。</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsAiForm.summaryEnabled" :true-value="1" :false-value="0" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>AI 评论审核</label>
                                <div class="v3a-settings-row-help">新评论提交时由 AI 判定：通过 / 待审 / 垃圾。</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsAiForm.commentEnabled" :true-value="1" :false-value="0" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>AI 润色</label>
                                <div class="v3a-settings-row-help">撰写文章时提供“AI 润色”按钮。</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsAiForm.polishEnabled" :true-value="1" :false-value="0" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>AI 缩略名</label>
                                <div class="v3a-settings-row-help">在 slug 输入框旁显示生成按钮，自动生成英文 slug（SEO）。</div>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsAiForm.slugEnabled" :true-value="1" :false-value="0" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>提示</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <div class="v3a-muted">保存后如需立即看到“额外功能”里的 AI 按钮，请刷新页面（或使用页面顶部“保存全部”，会自动刷新）。</div>
                              </div>
                            </div>
                          </div>
                        </template>
                      </div>
                    </div>
                  </template>

                  <template v-else-if="isThemeSettingsActive">
                    <div class="v3a-settings-user" :class="{ 'v3a-settings-user-wide': settingsActiveKey === 'theme.config' || settingsActiveKey === 'theme.edit' }">
                      <div v-if="settingsActiveKey === 'theme.activate'" class="v3a-settings-section">
                        <div class="v3a-settings-section-hd">
                          <div class="v3a-settings-section-hd-left">
                            <div class="v3a-settings-section-icon">
                              <span class="v3a-icon" v-html="ICONS.palette"></span>
                            </div>
                            <div class="v3a-settings-section-titles">
                              <div class="v3a-settings-section-title">主题启用</div>
                              <div class="v3a-settings-section-subtitle">主题、外观</div>
                            </div>
                          </div>
                        </div>

                        <div v-if="!settingsData.isAdmin" class="v3a-settings-fields">
                          <div class="v3a-settings-row">
                            <div class="v3a-settings-row-label">
                              <label>提示</label>
                            </div>
                            <div class="v3a-settings-row-control">
                              <div class="v3a-muted">需要管理员权限才能管理主题。</div>
                            </div>
                          </div>
                        </div>

                        <template v-else>
                          <div v-if="themesLoading" class="v3a-muted" style="padding: 14px 16px;">正在加载…</div>
                          <div v-else class="v3a-card v3a-settings-tablecard" data-tour="settings-plugins-active">
                            <div class="bd" style="padding: 0px;">
                              <div v-if="themesError" class="v3a-settings-row">
                                <div class="v3a-settings-row-label">
                                  <label>错误</label>
                                </div>
                                <div class="v3a-settings-row-control">
                                  <div class="v3a-muted">{{ themesError }}</div>
                                </div>
                              </div>

                              <div v-else-if="!themesItems.length" class="v3a-settings-row">
                                <div class="v3a-settings-row-label">
                                  <label>主题列表</label>
                                </div>
                                <div class="v3a-settings-row-control">
                                  <div class="v3a-muted">未找到主题。</div>
                                </div>
                              </div>

                              <template v-else>
                                <div v-for="t in themesItems" :key="t.name" class="v3a-settings-row v3a-theme-row-item" :class="{ active: themeSelected === t.name }" @click="handleThemeRowClick(t.name, $event)">
                                  <div class="v3a-settings-row-label">
                                    <div class="v3a-theme-shot">
                                      <img :src="t.screen" alt="" loading="lazy" />
                                    </div>
                                  </div>
                                  <div class="v3a-settings-row-control">
                                    <div class="v3a-theme-row">
                                      <div class="v3a-theme-info">
                                        <div class="v3a-theme-name">
                                          {{ t.title || t.name }}
                                          <span v-if="t.activated" class="v3a-pill success">当前</span>
                                        </div>
                                        <div class="v3a-theme-meta v3a-muted">
                                          <span v-if="t.version">v{{ t.version }}</span>
                                          <span v-if="t.author"> · {{ t.author }}</span>
                                          <a v-if="t.homepage" class="v3a-link" :href="t.homepage" target="_blank" rel="noreferrer">官网</a>
                                        </div>
                                        <div v-if="t.description" class="v3a-theme-desc v3a-muted" v-html="v3aSimpleLinkHtml(t.description)"></div>
                                      </div>
                                      <div v-if="!t.activated" class="v3a-theme-actions">
                                        <button class="v3a-mini-btn v3a-mini-btn-link" type="button" style="color: var(--color-primary);" @click.stop="activateTheme(t.name)" :disabled="themeActivating">启用</button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </template>
                            </div>
                          </div>
                        </template>
                      </div>

                      <div v-if="settingsActiveKey === 'theme.edit'" class="v3a-theme-edit">
                        <template v-if="!settingsData.isAdmin">
                          <div class="v3a-muted" style="padding: 14px 16px;">需要管理员权限才能编辑主题文件。</div>
                        </template>

                        <template v-else>
                          <div class="v3a-theme-edit-split" :style="{ '--v3a-theme-edit-left': themeEditLeftWidth + 'px' }">
                            <div class="v3a-theme-edit-left">
                              <div class="v3a-theme-edit-left-head">
                                <div class="v3a-searchbox v3a-theme-edit-searchbox">
                                  <span class="v3a-searchbox-icon" v-html="ICONS.search"></span>
                                  <input class="v3a-input v3a-theme-edit-search-input" type="text" v-model="themeEditSearch" placeholder="搜索文件…" />
                                </div>
                              </div>

                              <div class="v3a-theme-edit-tree">
                                <div v-if="themesLoading" class="v3a-muted" style="padding: 10px 12px;">正在加载…</div>
                                <template v-else>
                                  <div v-for="t in themesItems" :key="t.name" class="v3a-theme-edit-tree-group">
                                    <button class="v3a-theme-edit-tree-folder" type="button" :class="{ open: themeEditTreeOpen === t.name }" @click="toggleThemeEditTree(t.name)">
                                      <span class="v3a-theme-edit-tree-chev" :class="{ open: themeEditTreeOpen === t.name }">
                                        <span class="v3a-icon" v-html="ICONS.chevron"></span>
                                      </span>
                                      <span class="v3a-theme-edit-tree-ico folder">
                                        <span class="v3a-icon" v-html="ICONS.files"></span>
                                      </span>
                                      <span class="v3a-theme-edit-tree-label">{{ t.title || t.name }}</span>
                                      <span v-if="t.activated" class="v3a-pill success">当前</span>
                                    </button>

                                    <div v-if="themeEditTreeOpen === t.name" class="v3a-theme-edit-tree-files">
                                      <div v-if="themeFilesLoading || themeFilesTheme !== t.name" class="v3a-muted" style="padding: 6px 12px;">正在加载…</div>
                                      <template v-else>
                                        <button v-for="f in themeEditFilesFiltered" :key="f" class="v3a-theme-edit-tree-file" type="button" :class="{ active: themeSelected === t.name && themeFile === f }" @click="openThemeEditFile(t.name, f)">
                                          <span class="v3a-theme-edit-tree-ico file">
                                            <span class="v3a-icon" v-html="ICONS.fileText"></span>
                                          </span>
                                          <span class="v3a-theme-edit-tree-label">{{ f }}</span>
                                        </button>
                                        <div v-if="!themeEditFilesFiltered.length" class="v3a-muted" style="padding: 6px 12px;">未找到文件。</div>
                                      </template>
                                    </div>
                                  </div>
                                </template>
                              </div>
                            </div>

                            <div class="v3a-theme-edit-resizer" @pointerdown="startThemeEditResize"></div>

                            <div class="v3a-theme-edit-right">
                              <div class="v3a-theme-edit-right-head">
                                <div class="v3a-theme-edit-right-head-row">
                                  <div class="v3a-theme-edit-right-title">
                                    {{ themeSelected || themeCurrent || '—' }}
                                    <span v-if="themeFile" class="v3a-muted">/ {{ themeFile }}</span>
                                    <span v-if="themeFileDirty" class="v3a-theme-edit-dirty" title="未保存"></span>
                                  </div>
                                  <div class="v3a-theme-edit-right-actions">
                                    <button class="v3a-btn primary" type="button" @click="saveThemeFile()" :disabled="themeFileSaving || themeFileLoading || !themeFileWriteable || !themeFileDirty">
                                      <span class="v3a-icon" v-html="ICONS.save"></span>
                                      保存
                                    </button>
                                  </div>
                                </div>
                                <div v-if="themeFile && !themeFileWriteable" class="v3a-theme-edit-right-note v3a-muted">该文件不可写（或已被系统禁用编辑）。</div>
                              </div>

                              <div class="v3a-theme-edit-editor">
                                <textarea v-if="themeEditEditorFailed" class="v3a-textarea v3a-code-editor v3a-theme-editor" v-model="themeFileContent" :disabled="themeFileLoading || !themeFileWriteable"></textarea>
                                <div v-else ref="themeEditEditorEl" class="v3a-theme-edit-cm"></div>
                                <div v-if="!themeEditEditorFailed && (themeFilesLoading || themeFileLoading)" class="v3a-theme-edit-overlay">
                                  <div class="v3a-muted">正在加载…</div>
                                </div>
                                <div v-else-if="!themeEditEditorFailed && !themeFile" class="v3a-theme-edit-overlay">
                                  <div class="v3a-muted">请选择一个文件进行编辑。</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </template>
                      </div>

                      <div v-if="settingsActiveKey === 'theme.config'" class="v3a-settings-section">
                        <div class="v3a-settings-section-hd">
                          <div class="v3a-settings-section-hd-left">
                            <div class="v3a-settings-section-icon">
                              <span class="v3a-icon" v-html="ICONS.settings"></span>
                            </div>
                          <div class="v3a-settings-section-titles">
                            <div class="v3a-settings-section-title">主题设置</div>
                            <div class="v3a-settings-section-subtitle">配置项（{{ themeSelected || themeCurrent || '—' }}）</div>
                          </div>
                        </div>
                      </div>

                      <template v-if="!settingsData.isAdmin">
                        <div class="v3a-settings-fields">
                          <div class="v3a-settings-row">
                            <div class="v3a-settings-row-label">
                              <label>提示</label>
                            </div>
                            <div class="v3a-settings-row-control">
                              <div class="v3a-muted">需要管理员权限才能配置主题设置。</div>
                            </div>
                          </div>
                        </div>
                      </template>

                      <template v-else>
                        <div class="v3a-theme-config-extra">
                          <iframe
                            ref="themeConfigIframe"
                            class="v3a-theme-config-frame v3a-theme-config-frame-legacy"
                            :src="themeConfigLegacyUrl"
                            @load="resizeThemeConfigIframe"
                          ></iframe>
                        </div>
                      </template>
                    </div>
                  </template>

                  <template v-else-if="settingsActiveKey === 'plugins'">
                    <div class="v3a-settings-user">
                      <div class="v3a-settings-section">
                        <div class="v3a-settings-section-hd">
                          <div class="v3a-settings-section-hd-left">
                            <div class="v3a-settings-section-icon">
                              <span class="v3a-icon" v-html="ICONS.blocks"></span>
                            </div>
                            <div class="v3a-settings-section-titles">
                              <div class="v3a-settings-section-title">已启动插件</div>
                              <div class="v3a-settings-section-subtitle">扩展、插件</div>
                            </div>
                          </div>
                        </div>

                        <div v-if="!settingsData.isAdmin" class="v3a-settings-fields">
                          <div class="v3a-settings-row">
                            <div class="v3a-settings-row-label">
                              <label>提示</label>
                            </div>
                            <div class="v3a-settings-row-control">
                              <div class="v3a-muted">需要管理员权限才能管理插件。</div>
                            </div>
                          </div>
                        </div>

                        <template v-else>
                          <div v-if="pluginsLoading" class="v3a-muted" style="padding: 14px 16px;">正在加载…</div>
                          <div v-else class="v3a-card v3a-settings-tablecard">
                            <div class="bd" style="padding: 0px;">
                            <table class="v3a-table v3a-settings-table">
                              <thead>
                                <tr>
                                  <th>插件</th>
                                  <th style="width: 90px;">版本</th>
                                  <th style="width: 120px;">作者</th>
                                  <th style="width: 180px; text-align: right;">操作</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr v-if="!pluginsActivated.length">
                                  <td colspan="4" class="v3a-muted" style="padding: 14px 16px;">暂无已启动插件</td>
                                </tr>
                                <tr v-for="p in pluginsActivated" :key="p.name">
                                  <td>
                                    <div class="v3a-plugin-title">
                                      {{ p.title || p.name }}
                                      <span v-if="p.missing" class="v3a-pill danger">缺失</span>
                                      <span v-else class="v3a-pill success">已启动</span>
                                    </div>
                                    <div v-if="p.description" class="v3a-muted v3a-plugin-desc">{{ p.description }}</div>
                                  </td>
                                  <td>{{ p.version || "—" }}</td>
                                  <td>{{ p.author || "—" }}</td>
                                  <td style="text-align: right; white-space: nowrap;">
                                    <button v-if="p.config && !p.missing" class="v3a-mini-btn" type="button" @click="openPluginConfig(p)">设置</button>
                                    <button v-if="p.manageable" class="v3a-mini-btn" type="button" @click="deactivatePlugin(p)" :disabled="pluginsActing" style="color: var(--v3a-danger);">移除</button>
                                    <span v-else class="v3a-muted">内置</span>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                            </div>
                          </div>
                        </template>
                      </div>

                      <div class="v3a-settings-section">
                        <div class="v3a-settings-section-hd">
                          <div class="v3a-settings-section-hd-left">
                            <div class="v3a-settings-section-icon">
                              <span class="v3a-icon" v-html="ICONS.blocks"></span>
                            </div>
                            <div class="v3a-settings-section-titles">
                              <div class="v3a-settings-section-title">未启动插件</div>
                              <div class="v3a-settings-section-subtitle">可启动的扩展</div>
                            </div>
                          </div>
                        </div>

                        <div v-if="!settingsData.isAdmin" class="v3a-settings-fields">
                          <div class="v3a-settings-row">
                            <div class="v3a-settings-row-label">
                              <label>提示</label>
                            </div>
                            <div class="v3a-settings-row-control">
                              <div class="v3a-muted">需要管理员权限才能管理插件。</div>
                            </div>
                          </div>
                        </div>

                        <template v-else>
                          <div class="v3a-card v3a-settings-tablecard">
                            <div class="bd" style="padding: 0px;">
                            <table class="v3a-table v3a-settings-table">
                              <thead>
                                <tr>
                                  <th>插件</th>
                                  <th style="width: 90px;">版本</th>
                                  <th style="width: 120px;">作者</th>
                                  <th style="width: 180px; text-align: right;">操作</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr v-if="!pluginsInactive.length">
                                  <td colspan="4" class="v3a-muted" style="padding: 14px 16px;">暂无未启动插件</td>
                                </tr>
                                <tr v-for="p in pluginsInactive" :key="p.name">
                                  <td>
                                    <div class="v3a-plugin-title">
                                      {{ p.title || p.name }}
                                      <span v-if="!p.dependence" class="v3a-pill warn">版本不兼容</span>
                                      <span v-else class="v3a-pill">未启动</span>
                                    </div>
                                    <div v-if="p.description" class="v3a-muted v3a-plugin-desc">{{ p.description }}</div>
                                  </td>
                                  <td>{{ p.version || "—" }}</td>
                                  <td>{{ p.author || "—" }}</td>
                                  <td style="text-align: right; white-space: nowrap;">
                                    <button class="v3a-mini-btn" type="button" @click="activatePlugin(p)" :disabled="pluginsActing || !p.dependence" style="color: var(--color-primary);">启动</button>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                            </div>
                          </div>
                        </template>
                      </div>
                    </div>

                  </template>

                  <template v-else-if="settingsActiveKey === 'system'">
                    <div class="v3a-settings-user">
                      <div class="v3a-settings-section">
                        <div class="v3a-settings-section-hd">
                          <div class="v3a-settings-section-hd-left">
                            <div class="v3a-settings-section-icon">
                              <span class="v3a-icon" v-html="ICONS.settings"></span>
                            </div>
                            <div class="v3a-settings-section-titles">
                              <div class="v3a-settings-section-title">链接设置（Permalink）</div>
                              <div class="v3a-settings-section-subtitle">URL 规则、重写</div>
                            </div>
                          </div>
                        </div>

                        <div v-if="!settingsData.isAdmin" class="v3a-settings-fields">
                          <div class="v3a-settings-row">
                            <div class="v3a-settings-row-label">
                              <label>提示</label>
                            </div>
                            <div class="v3a-settings-row-control">
                              <div class="v3a-muted">需要管理员权限才能修改链接设置。</div>
                            </div>
                          </div>
                        </div>

                        <template v-else>
                          <div class="v3a-settings-fields">
                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>Rewrite（地址重写）</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <label class="v3a-switch">
                                  <input type="checkbox" v-model="settingsPermalinkForm.rewrite" :true-value="1" :false-value="0" :disabled="settingsData.permalink.rewriteLocked" />
                                  <span class="v3a-switch-ui"></span>
                                </label>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>文章链接规则</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <div v-if="settingsPermalinkRewriteError && settingsPermalinkForm.rewrite" class="v3a-permalink-rewrite-hint">
                                  <div class="v3a-feedback">{{ settingsPermalinkRewriteError }}</div>
                                  <label class="v3a-remember v3a-permalink-rewrite-anyway" style="margin: 0;">
                                    <input class="v3a-check" type="checkbox" v-model="settingsPermalinkEnableRewriteAnyway" :true-value="1" :false-value="0" />
                                    <span>仍然启用</span>
                                  </label>
                                </div>
                                <div class="v3a-permalink-options">
                                  <label v-for="opt in permalinkPostPatternOptions" :key="opt.value" class="v3a-permalink-option">
                                    <input class="v3a-check" type="radio" name="v3a-postpattern" :value="opt.value" v-model="settingsPermalinkForm.postPattern" />
                                    <span class="v3a-permalink-option-text">
                                      {{ opt.label }}
                                      <code v-if="opt.example">{{ opt.example }}</code>
                                      <template v-if="opt.value === 'custom'">
                                        <input class="v3a-input v3a-permalink-custom" v-model="settingsPermalinkForm.customPattern" :disabled="settingsPermalinkForm.postPattern !== 'custom'" placeholder="输入个性化定义..." />
                                      </template>
                                    </span>
                                  </label>
                                </div>
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>页面链接规则</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" v-model="settingsPermalinkForm.pagePattern" placeholder="/{slug}.html" />
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>分类链接规则</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" v-model="settingsPermalinkForm.categoryPattern" placeholder="/category/{slug}/" />
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>占位符</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <div class="v3a-muted">占位符：{cid} {slug} {category} {directory} {year} {month} {day} {mid}</div>
                              </div>
                            </div>
                          </div>

                        </template>
                      </div>
                    </div>
                  </template>

                  <template v-else>
                    <div class="v3a-card">
                      <div class="bd v3a-muted">该设置项暂未实现。</div>
                    </div>
                  </template>
                </div>
              </div>
            </template>

            <template v-else>
              <div class="v3a-container">
                <div class="v3a-card">
                  <div class="hd"><div class="title">{{ crumb }}</div></div>
                  <div class="bd v3a-muted">
                    该模块正在开发中（已完成 mx-admin 风格布局与菜单结构，后续将逐项完善功能）。
                  </div>
                </div>
              </div>
            </template>
          </section>
        </main>

        <div v-if="jsonFieldEditorOpen" class="v3a-modal-mask" @click.self="closeJsonFieldEditor()">
          <div class="v3a-modal-card" role="dialog" aria-modal="true" style="max-width: 860px;">
            <button class="v3a-modal-close" type="button" aria-label="关闭" @click="closeJsonFieldEditor()">
              <span class="v3a-icon" v-html="ICONS.closeSmall"></span>
            </button>

            <div class="v3a-modal-head">
              <div class="v3a-modal-title">编辑字段值</div>
            </div>

            <div class="v3a-modal-body">
              <div class="v3a-modal-form">
                <div class="v3a-modal-item">
                  <div ref="jsonFieldEditorEl" class="v3a-json-field-editor"></div>
                  <div v-if="jsonFieldEditorError" class="v3a-modal-feedback">{{ jsonFieldEditorError }}</div>
                </div>
              </div>

              <div class="v3a-modal-actions">
                <button class="v3a-btn v3a-modal-btn" type="button" @click="closeJsonFieldEditor()">取消</button>
                <button class="v3a-btn primary v3a-modal-btn" type="button" @click="applyJsonFieldEditor()">确定</button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="permissionInfoOpen" class="v3a-modal-mask" @click.self="closePermissionInfo()">
          <div class="v3a-modal-card v3a-permission-info-modal" role="dialog" aria-modal="true">
            <button class="v3a-modal-close" type="button" aria-label="关闭" @click="closePermissionInfo()">
              <span class="v3a-icon" v-html="ICONS.close"></span>
            </button>

            <div class="v3a-modal-head">
              <div class="v3a-modal-title">权限细分</div>
              <div class="v3a-modal-subtitle">基于 Typecho 用户组（旧 admin 设计）并结合 Vue3Admin 当前模块</div>
            </div>

            <div class="v3a-modal-body">
              <div class="v3a-muted" style="margin-bottom: 12px;">
                说明：数字越小权限越高。贡献者发布文章需要审核（待审核 → 编辑/管理员发布）。管理员可在「设定 / 权限」中微调权限与上传限制。
              </div>

              <table class="v3a-table">
                <thead>
                  <tr>
                    <th>权限</th>
                    <th style="text-align:center;">管理员</th>
                    <th style="text-align:center;">编辑</th>
                    <th style="text-align:center;">贡献者</th>
                    <th style="text-align:center;">关注者</th>
                    <th style="text-align:center;">访问者</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>代号 / 等级</td>
                    <td style="text-align:center;">administrator / 0</td>
                    <td style="text-align:center;">editor / 1</td>
                    <td style="text-align:center;">contributor / 2</td>
                    <td style="text-align:center;">subscriber / 3</td>
                    <td style="text-align:center;">visitor / 4</td>
                  </tr>
                  <tr>
                    <td>进入控制台</td>
                    <td style="text-align:center;">√</td>
                    <td style="text-align:center;">√</td>
                    <td style="text-align:center;">√</td>
                    <td style="text-align:center;">√</td>
                    <td style="text-align:center;">×</td>
                  </tr>
                  <tr>
                    <td>仪表盘</td>
                    <td style="text-align:center;">√</td>
                    <td style="text-align:center;">√</td>
                    <td style="text-align:center;">√</td>
                    <td style="text-align:center;">√</td>
                    <td style="text-align:center;">×</td>
                  </tr>
                  <tr>
                    <td>撰写文章</td>
                    <td style="text-align:center;">√</td>
                    <td style="text-align:center;">√</td>
                    <td style="text-align:center;">√（审核后发布）</td>
                    <td style="text-align:center;">×</td>
                    <td style="text-align:center;">×</td>
                  </tr>
                  <tr>
                    <td>管理文章</td>
                    <td style="text-align:center;">√（全部）</td>
                    <td style="text-align:center;">√（全部）</td>
                    <td style="text-align:center;">√（仅自己）</td>
                    <td style="text-align:center;">×</td>
                    <td style="text-align:center;">×</td>
                  </tr>
                  <tr>
                    <td>审核/发布文章</td>
                    <td style="text-align:center;">√</td>
                    <td style="text-align:center;">√</td>
                    <td style="text-align:center;">×</td>
                    <td style="text-align:center;">×</td>
                    <td style="text-align:center;">×</td>
                  </tr>
                  <tr>
                    <td>分类/标签</td>
                    <td style="text-align:center;">√</td>
                    <td style="text-align:center;">√</td>
                    <td style="text-align:center;">×</td>
                    <td style="text-align:center;">×</td>
                    <td style="text-align:center;">×</td>
                  </tr>
                  <tr>
                    <td>评论管理</td>
                    <td style="text-align:center;">√</td>
                    <td style="text-align:center;">√</td>
                    <td style="text-align:center;">×</td>
                    <td style="text-align:center;">×</td>
                    <td style="text-align:center;">×</td>
                  </tr>
                  <tr>
                    <td>页面管理</td>
                    <td style="text-align:center;">√</td>
                    <td style="text-align:center;">√</td>
                    <td style="text-align:center;">×</td>
                    <td style="text-align:center;">×</td>
                    <td style="text-align:center;">×</td>
                  </tr>
                  <tr>
                    <td>上传/管理文件</td>
                    <td style="text-align:center;">√（全部）</td>
                    <td style="text-align:center;">√（全部）</td>
                    <td style="text-align:center;">√（受限/仅自己）</td>
                    <td style="text-align:center;">×</td>
                    <td style="text-align:center;">×</td>
                  </tr>
                  <tr>
                    <td>管理链接 / 数据 / 用户 / 维护</td>
                    <td style="text-align:center;">√</td>
                    <td style="text-align:center;">×</td>
                    <td style="text-align:center;">×</td>
                    <td style="text-align:center;">×</td>
                    <td style="text-align:center;">×</td>
                  </tr>
                  <tr>
                    <td>个人资料 / 账号安全</td>
                    <td style="text-align:center;">√</td>
                    <td style="text-align:center;">√</td>
                    <td style="text-align:center;">√</td>
                    <td style="text-align:center;">√</td>
                    <td style="text-align:center;">×</td>
                  </tr>
                  <tr>
                    <td>站点/内容/通知/主题/插件/存储/永久链接设置</td>
                    <td style="text-align:center;">√</td>
                    <td style="text-align:center;">×</td>
                    <td style="text-align:center;">×</td>
                    <td style="text-align:center;">×</td>
                    <td style="text-align:center;">×</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div v-if="shouTuTaIpModalOpen" class="v3a-modal-mask" @click.self="closeShouTuTaIpModal()">
          <div class="v3a-modal-card v3a-scroll-modal" role="dialog" aria-modal="true" style="max-width: 980px;">
            <button class="v3a-modal-close" type="button" aria-label="关闭" @click="closeShouTuTaIpModal()">
              <span class="v3a-icon" v-html="ICONS.closeSmall"></span>
            </button>

            <div class="v3a-modal-head">
              <div class="v3a-modal-title">IP 详情：{{ shouTuTaIpModalIp }}</div>
              <div class="v3a-modal-subtitle">查询信誉 / 解除拦截 / 白名单 / 封禁 / 清理</div>
            </div>

            <div class="v3a-modal-body">
              <div class="v3a-modal-actions" style="justify-content: flex-start; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
                <button class="v3a-mini-btn" type="button" @click="shouTuTaCheckAbuseIpdb(shouTuTaIpModalIp)" :disabled="shouTuTaIpModalAbuseLoading">
                  {{ shouTuTaIpModalAbuseLoading ? "查询中…" : "查询信誉" }}
                </button>
                <button class="v3a-mini-btn" type="button" @click="shouTuTaUnblock(shouTuTaIpModalIp)" :disabled="shouTuTaActing">解除拦截</button>
                <button class="v3a-mini-btn" type="button" @click="shouTuTaWhitelistAdd(shouTuTaIpModalIp)" :disabled="shouTuTaActing">加入白名单</button>
                <button class="v3a-mini-btn" type="button" style="color: var(--v3a-danger);" @click="shouTuTaPermBan(shouTuTaIpModalIp)" :disabled="shouTuTaActing">永久封禁</button>
                <button class="v3a-mini-btn" type="button" @click="openShouTuTaGlobalWhitelist()" :disabled="shouTuTaActing">全局白名单</button>
                <button class="v3a-mini-btn" type="button" style="color: var(--v3a-danger);" @click="shouTuTaPurgeIp(shouTuTaIpModalIp)" :disabled="shouTuTaActing">彻底清除</button>
              </div>

              <div class="v3a-card" style="margin-bottom: 12px;">
                <div class="hd"><div class="title">AbuseIPDB</div></div>
                <div class="bd">
                  <template v-if="shouTuTaIpModalAbuseLoading">
                    <div class="v3a-muted">正在查询…</div>
                  </template>
                  <template v-else-if="!shouTuTaIpModalAbuse">
                    <div class="v3a-muted">未查询</div>
                  </template>
                  <template v-else>
                    <div style="display:flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 10px;">
                      <span class="v3a-pill" :class="Number(shouTuTaIpModalAbuse.score || 0) >= 80 ? 'danger' : Number(shouTuTaIpModalAbuse.score || 0) >= 40 ? 'warn' : 'success'">
                        评分 {{ Number(shouTuTaIpModalAbuse.score || 0) || 0 }}
                      </span>
                      <span class="v3a-muted">
                        {{ (shouTuTaIpModalAbuse.data && (shouTuTaIpModalAbuse.data.countryName || shouTuTaIpModalAbuse.data.countryCode)) ? (shouTuTaIpModalAbuse.data.countryName || shouTuTaIpModalAbuse.data.countryCode) : '—' }}
                      </span>
                    </div>

                    <table class="v3a-table">
                      <tbody>
                        <tr v-if="shouTuTaIpModalAbuse.data && shouTuTaIpModalAbuse.data.isWhitelisted !== undefined">
                          <td style="width: 140px;" class="v3a-muted">白名单</td>
                          <td>{{ shouTuTaIpModalAbuse.data.isWhitelisted ? '是' : '否' }}</td>
                        </tr>
                        <tr v-if="shouTuTaIpModalAbuse.data && shouTuTaIpModalAbuse.data.usageType">
                          <td class="v3a-muted">用途</td>
                          <td>{{ shouTuTaIpModalAbuse.data.usageType }}</td>
                        </tr>
                        <tr v-if="shouTuTaIpModalAbuse.data && shouTuTaIpModalAbuse.data.isp">
                          <td class="v3a-muted">ISP</td>
                          <td>{{ shouTuTaIpModalAbuse.data.isp }}</td>
                        </tr>
                        <tr v-if="shouTuTaIpModalAbuse.data && shouTuTaIpModalAbuse.data.domain">
                          <td class="v3a-muted">域名</td>
                          <td>{{ shouTuTaIpModalAbuse.data.domain }}</td>
                        </tr>
                        <tr v-if="shouTuTaIpModalAbuse.data && shouTuTaIpModalAbuse.data.totalReports !== undefined">
                          <td class="v3a-muted">报告数</td>
                          <td>{{ shouTuTaIpModalAbuse.data.totalReports }}</td>
                        </tr>
                        <tr v-if="shouTuTaIpModalAbuse.data && shouTuTaIpModalAbuse.data.lastReportedAt">
                          <td class="v3a-muted">最近报告</td>
                          <td>{{ shouTuTaIpModalAbuse.data.lastReportedAt }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </template>
                </div>
              </div>

              <div class="v3a-card">
                <div class="hd"><div class="title">访问记录</div></div>
                <div class="bd" style="padding: 0;">
                  <div v-if="!shouTuTaAnalyticsAvailable" class="v3a-muted" style="padding: 16px;">未启用统计，无法查询访问记录。</div>
                  <div v-else-if="shouTuTaIpModalLoading" class="v3a-muted" style="padding: 16px;">正在加载…</div>
                  <div v-else-if="!shouTuTaIpModalLogs.length" class="v3a-muted" style="padding: 16px;">暂无记录</div>
                  <div v-else style="max-height: 50vh; overflow: auto;">
                    <table class="v3a-table">
                      <thead>
                        <tr>
                          <th style="white-space: nowrap;">时间</th>
                          <th style="white-space: nowrap;">方法</th>
                          <th>URI</th>
                          <th style="text-align:right; white-space: nowrap;">状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="l in shouTuTaIpModalLogs" :key="l.id || (l.ts + ':' + l.uri)">
                          <td style="white-space: nowrap;" :title="l.ua || ''">{{ formatTime(l.ts, settingsData.site.timezone) }}</td>
                          <td style="white-space: nowrap;">{{ l.method || '—' }}</td>
                          <td style="word-break: break-all;" :title="l.ua || ''">{{ l.uri || '—' }}</td>
                          <td style="text-align:right; white-space: nowrap;">
                            <span class="v3a-pill" :class="shouTuTaStatusTone(l.status_code)">{{ shouTuTaStatusText(l.status_code) }}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div class="v3a-modal-actions">
                <button class="v3a-btn v3a-modal-btn" type="button" @click="closeShouTuTaIpModal()">关闭</button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="shouTuTaGlobalWhitelistOpen" class="v3a-modal-mask" @click.self="closeShouTuTaGlobalWhitelist()">
          <div class="v3a-modal-card v3a-scroll-modal" role="dialog" aria-modal="true" style="max-width: 640px;">
            <button class="v3a-modal-close" type="button" aria-label="关闭" @click="closeShouTuTaGlobalWhitelist()">
              <span class="v3a-icon" v-html="ICONS.closeSmall"></span>
            </button>

            <div class="v3a-modal-head">
              <div class="v3a-modal-title">添加全局白名单</div>
            </div>

            <div class="v3a-modal-body">
              <div class="v3a-modal-form">
                <div class="v3a-modal-item">
                  <label class="v3a-modal-label">IP<span class="v3a-required">*</span></label>
                  <input class="v3a-input v3a-modal-input" v-model="shouTuTaGlobalWhitelistForm.ip" placeholder="例如：1.2.3.4" />
                </div>
                <div class="v3a-modal-item">
                  <label class="v3a-modal-label">备注</label>
                  <textarea class="v3a-textarea v3a-modal-textarea" v-model="shouTuTaGlobalWhitelistForm.remark" placeholder="可选，例如：朋友的服务器" style="min-height: 90px;"></textarea>
                </div>
              </div>

              <div class="v3a-modal-actions">
                <button class="v3a-btn v3a-modal-btn" type="button" @click="closeShouTuTaGlobalWhitelist()">取消</button>
                <button class="v3a-btn primary v3a-modal-btn" type="button" @click="submitShouTuTaGlobalWhitelist()" :disabled="shouTuTaActing">{{ shouTuTaActing ? "保存中…" : "确定" }}</button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="shouTuTaCidrOpen" class="v3a-modal-mask" @click.self="closeShouTuTaCidr()">
          <div class="v3a-modal-card v3a-scroll-modal" role="dialog" aria-modal="true" style="max-width: 720px;">
            <button class="v3a-modal-close" type="button" aria-label="关闭" @click="closeShouTuTaCidr()">
              <span class="v3a-icon" v-html="ICONS.closeSmall"></span>
            </button>

            <div class="v3a-modal-head">
              <div class="v3a-modal-title">添加 IP / CIDR 黑名单</div>
            </div>

            <div class="v3a-modal-body">
              <div class="v3a-modal-form">
                <div class="v3a-modal-item">
                  <label class="v3a-modal-label">列表</label>
                  <textarea class="v3a-textarea v3a-modal-textarea v3a-code-editor" v-model="shouTuTaCidrList" placeholder="每行输入一个 IP 或 CIDR，例如：\n1.2.3.4\n1.2.3.0/24" style="min-height: 160px;"></textarea>
                </div>
              </div>

              <div class="v3a-modal-actions">
                <button class="v3a-btn v3a-modal-btn" type="button" @click="closeShouTuTaCidr()">取消</button>
                <button class="v3a-btn primary v3a-modal-btn" type="button" @click="submitShouTuTaCidr()" :disabled="shouTuTaActing">{{ shouTuTaActing ? "保存中…" : "确定" }}</button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="pluginConfigOpen" class="v3a-modal-mask" @click.self="closePluginConfig()">
          <div class="v3a-modal-card v3a-plugin-config-modal" role="dialog" aria-modal="true" data-tour="plugin-config-modal">
            <button class="v3a-modal-close" type="button" aria-label="关闭" @click="closePluginConfig()">
              <span class="v3a-icon" v-html="ICONS.close"></span>
            </button>
            <div class="v3a-modal-head">
              <div class="v3a-modal-title">插件设置：{{ pluginConfigTitle || pluginConfigName }}</div>
            </div>
            <div class="v3a-modal-body">
              <div class="v3a-plugin-config-body">
                <template v-if="pluginConfigLoading">
                  <div class="v3a-muted">正在加载…</div>
                </template>
                <template v-else-if="!pluginConfigExists">
                  <div class="v3a-muted">该插件暂无可配置项。</div>
                </template>
                <template v-else>
                  <div ref="pluginConfigLegacyEl" class="v3a-plugin-config-legacy" v-html="pluginConfigHtml"></div>
                </template>
              </div>

              <div class="v3a-modal-actions">
                <button class="v3a-btn v3a-modal-btn" type="button" @click="closePluginConfig()">关闭</button>
                <button class="v3a-btn primary v3a-modal-btn" type="button" @click="savePluginConfig()" :disabled="pluginConfigLoading || pluginConfigSaving || !pluginConfigExists">{{ pluginConfigSaving ? "保存中…" : "保存设置" }}</button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="registerFlashOpen && registerFlash" class="v3a-modal-mask" @click.self="closeRegisterFlash()">
          <div class="v3a-modal-card" role="dialog" aria-modal="true" style="max-width: 560px;">
            <button class="v3a-modal-close" type="button" aria-label="关闭" @click="closeRegisterFlash()">
              <span class="v3a-icon" v-html="ICONS.closeSmall"></span>
            </button>
            <div class="v3a-modal-head">
              <div class="v3a-modal-title">注册成功</div>
              <div class="v3a-modal-subtitle">请保存以下信息，关闭后不再显示</div>
            </div>
            <div class="v3a-modal-body">
              <div class="v3a-modal-form">
                <div class="v3a-modal-item">
                  <label class="v3a-modal-label">用户名</label>
                  <input class="v3a-input v3a-modal-input" :value="registerFlash.name || ''" readonly />
                </div>
                <div class="v3a-modal-item">
                  <label class="v3a-modal-label">邮箱</label>
                  <input class="v3a-input v3a-modal-input" :value="registerFlash.mail || ''" readonly />
                </div>
                <div class="v3a-modal-item">
                  <label class="v3a-modal-label">密码</label>
                  <input class="v3a-input v3a-modal-input" :value="registerFlash.password || ''" readonly />
                </div>
              </div>
              <div class="v3a-modal-actions">
                <button class="v3a-btn primary v3a-modal-btn" type="button" @click="closeRegisterFlash()">我已保存，关闭</button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="tourOpen" class="v3a-tour-mask">
          <div class="v3a-tour-blocker" @click="tourSkip()"></div>
          <div class="v3a-tour-spotlight" :style="tourSpotlightStyle"></div>
          <div ref="tourBubbleEl" class="v3a-tour-bubble" :style="tourBubbleStyle" role="dialog" aria-modal="true">
            <div class="v3a-tour-hd">
              <div class="v3a-tour-title">{{ tourTitle }}</div>
              <div class="v3a-tour-progress">{{ tourStepIndex + 1 }} / {{ tourSteps.length }}</div>
            </div>
            <div class="v3a-tour-desc">{{ tourDescription }}</div>
            <div class="v3a-tour-actions">
              <button class="v3a-mini-btn" type="button" @click="tourPrev()" :disabled="tourStepIndex <= 0">上一步</button>
              <button class="v3a-mini-btn" type="button" @click="tourSkip()">跳过</button>
              <button v-if="!tourIsLast" class="v3a-mini-btn primary" type="button" @click="tourNext()">下一步</button>
              <button v-else class="v3a-mini-btn primary" type="button" @click="tourFinish()">完成</button>
            </div>
          </div>
        </div>

        <ol class="v3a-toaster" aria-live="polite" aria-relevant="additions removals">
          <li v-for="t in toasts" :key="t.id" class="v3a-toast" :data-type="t.type">
            <button v-if="t.dismissible" class="v3a-toast-close" type="button" aria-label="Close toast" @click="dismissToast(t.id)">
              <span class="v3a-icon" v-html="ICONS.closeSmall"></span>
            </button>
            <div class="v3a-toast-icon" v-html="toastIcon(t.type)"></div>
            <div class="v3a-toast-content">
              <div class="v3a-toast-title">{{ t.title }}</div>
              <div v-if="t.description" class="v3a-toast-desc">{{ t.description }}</div>
            </div>
            <button v-if="t.actionLabel" class="v3a-toast-action" type="button" @click="runToastAction(t)">{{ t.actionLabel }}</button>
          </li>
        </ol>
      </div>
    `,
  }).mount("#app");
})();
