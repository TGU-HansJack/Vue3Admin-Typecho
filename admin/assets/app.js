(function () {
  const Vue = window.Vue;
  if (!Vue) {
    console.error("[Vue3Admin] Vue is missing");
    return;
  }

  const { createApp, ref, reactive, computed, onMounted, watch, nextTick } = Vue;
  const V3A = window.V3A || {};

  const GROUP_LEVELS = {
    administrator: 0,
    editor: 1,
    contributor: 2,
    subscriber: 3,
    visitor: 4,
  };

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

    if (k === "maintenance-tasks" || k === "maintenance-backup") {
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
    globe: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>`,
    fileText: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path><path d="M14 2v5a1 1 0 0 0 1 1h5"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path></svg>`,
    bell: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.268 21a2 2 0 0 0 3.464 0"></path><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path></svg>`,
    shield: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path></svg>`,
    palette: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-palette-icon lucide-palette"><path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/></svg>`,
    blocks: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-blocks-icon lucide-blocks"><path d="M10 22V7a1 1 0 0 0-1-1H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a1 1 0 0 0-1-1H2"/><rect x="14" y="2" width="8" height="8" rx="1"/></svg>`,
    maintenance: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wrench-icon lucide-wrench"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/></svg>`,
    chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`,
    collapse: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`,
    expand: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`,
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
    plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`,
    copy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>`,
    externalLink: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>`,
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
    smilePlus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11v1a10 10 0 1 1-9-10"></path><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" x2="9.01" y1="9" y2="9"></line><line x1="15" x2="15.01" y1="9" y2="9"></line><path d="M16 5h6"></path><path d="M19 2v6"></path></svg>`,
    info: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>`,
  };

  const SETTINGS = [
    { key: "user", label: "用户", icon: "user", subtitle: "个人资料", access: "subscriber" },
    { key: "site", label: "网站", icon: "globe", subtitle: "站点地址、SEO", access: "administrator" },
    { key: "content", label: "内容", icon: "fileText", subtitle: "阅读、评论、文本", access: "administrator" },
    { key: "acl", label: "权限", icon: "shieldAlert", subtitle: "角色权限、上传限制", access: "administrator" },
    { key: "notify", label: "通知", icon: "bell", subtitle: "邮件、推送", access: "administrator" },
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
      key: "maintenance",
      label: "维护",
      icon: "maintenance",
      access: "administrator",
      children: [
        { key: "maintenance-tasks", label: "任务", to: "/maintenance/tasks", access: "administrator" },
        { key: "maintenance-backup", label: "备份", to: "/maintenance/backup", access: "administrator" },
      ],
    },
  ];

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

  function formatTime(ts) {
    const n = Number(ts || 0);
    if (!n) return "—";
    const d = new Date(n * 1000);
    const pad = (v) => String(v).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

  function getRoute() {
    const raw = (location.hash || "#/dashboard").replace(/^#/, "");
    return raw.startsWith("/") ? raw : "/" + raw;
  }

  function setRoute(path) {
    location.hash = "#" + path;
  }

  function findRouteTitle(path, settingsOpen, settingsActiveKey) {
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

    for (const top of MENU) {
      if (top.to === path) return top.label;
      if (top.children) {
        for (const child of top.children) {
          if (child.to === path) return `${top.label} / ${child.label}`;
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
          expanded.value.maintenance = !!obj.maintenance;
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
        if (path.startsWith("/maintenance/")) expanded.value.maintenance = true;
      }

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
            },
            blur: (value) => {
              if (postVditorSyncing) return;
              postForm.text = String(value || "");
            },
            upload: V3A.uploadUrl
              ? {
                  url: String(V3A.uploadUrl || ""),
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
            upload: V3A.uploadUrl
              ? {
                  url: String(V3A.uploadUrl || ""),
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
        const date = new Date(ts * 1000);
        const year = String(date.getFullYear());
        const month = v3aPad2(date.getMonth() + 1);
        const day = v3aPad2(date.getDate());

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

      // Data (IP / PV)
      const dataVisitLoading = ref(false);
      const dataVisitError = ref("");
      const dataVisitItems = ref([]);
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
          Object.assign(dataVisitPagination, data?.pagination || {});
          dataVisitPageJump.value = Number(dataVisitPagination.page || 1) || 1;
        } catch (e) {
          dataVisitItems.value = [];
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
          allowRegister: 0,
          defaultRegisterGroup: "subscriber",
          allowXmlRpc: 0,
          lang: "zh_CN",
          timezone: 28800,
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
        permalink: {},
        lists: { langs: [], frontPagePages: [], frontPageFiles: [] },
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
        allowRegister: 0,
        defaultRegisterGroup: "subscriber",
        allowXmlRpc: 0,
        lang: "zh_CN",
        timezone: 28800,
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
        friendLinkNotifyEnabled: 0,
        smtpFrom: "",
        smtpHost: "",
        smtpPort: 465,
        smtpUser: "",
        smtpPass: "",
        smtpSecure: 1,
        commentTemplate: DEFAULT_NOTIFY_COMMENT_TEMPLATE,
      });
      const settingsNotifyTemplateEditorOpen = ref(false);
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
          postTitle: "示例文章标题",
          postUrl: siteUrl ? siteUrl + "/archives/1/" : "https://example.com/archives/1/",
          commentAuthor: "访客",
          commentStatus: "approved",
          commentTime: now.toLocaleString(),
          commentText: escapeHtml("这是一条示例评论内容。\\n支持换行。").replace(
            /\\n/g,
            "<br />"
          ),
        };
        return renderMailTemplate(tpl, sample);
      });

      function openSettingsNotifyTemplateEditor() {
        settingsNotifyTemplateDraft.value = String(
          settingsNotifyForm.commentTemplate || DEFAULT_NOTIFY_COMMENT_TEMPLATE
        );
        settingsNotifyTemplateEditorOpen.value = true;
      }
      function closeSettingsNotifyTemplateEditor() {
        settingsNotifyTemplateEditorOpen.value = false;
      }
      function applySettingsNotifyTemplateDraft() {
        settingsNotifyForm.commentTemplate = String(
          settingsNotifyTemplateDraft.value || ""
        ).trim();
        if (!settingsNotifyForm.commentTemplate) {
          settingsNotifyForm.commentTemplate = DEFAULT_NOTIFY_COMMENT_TEMPLATE;
        }
        settingsNotifyTemplateEditorOpen.value = false;
      }
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
      let resizeBound = false;
      let skipNextWriteLoad = false;
      let skipNextPageLoad = false;

      const crumb = computed(() =>
        findRouteTitle(
          routePath.value,
          settingsOpen.value,
          settingsActiveKey.value
        )
      );

      const username = computed(() =>
        V3A.user && V3A.user.name ? String(V3A.user.name) : "Typecho"
      );
      const userInitial = computed(() => {
        const name = username.value.trim();
        return name ? name.slice(0, 1).toUpperCase() : "U";
      });

      function isActive(path) {
        return routePath.value === path;
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
        try {
          await ensureCategoriesLoaded();
          await ensureTagsLoaded();
          const cidRaw = routeQuery.value && routeQuery.value.cid;
          const cid = Number(cidRaw || 0);
          if (!cid) {
            resetPostForm();
            postCapabilities.value = {
              markdownEnabled: !!V3A.markdownEnabled,
              canPublish: !!V3A.canPublish,
            };
            return;
          }

          const data = await apiGet("posts.get", { cid });
          const p = data.post || {};
          const cap = data.capabilities || {};
          postCapabilities.value = {
            markdownEnabled: !!cap.markdownEnabled,
            canPublish: !!cap.canPublish,
          };

          postForm.cid = Number(p.cid || cid) || cid;
          postForm.title = String(p.title || "");
          postForm.slug = String(p.slug || "");
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
            fields: postForm.fields.map((f) => ({
              name: f.name,
              type: f.type,
              value: f.type === "json" ? safeJsonParse(f.value) : f.value,
            })),
          };

          const action = mode === "publish" ? "posts.publish" : "posts.save";
          const data = await apiPost(action, payload);
          const cid = Number(data.cid || 0);
          if (cid > 0) {
            postForm.cid = cid;
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
        if (!V3A.uploadUrl) {
          filesError.value = "缺少上传地址（uploadUrl）";
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

            const res = await fetch(V3A.uploadUrl, {
              method: "POST",
              credentials: "same-origin",
              headers: { "X-Requested-With": "XMLHttpRequest", Accept: "application/json" },
              body: form,
            });

            const json = await readApiJson(res);
            if (json === false) {
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

          const data = await apiGet("pages.get", {
            cid: cid ? cid : "",
            parent: parent ? parent : "",
          });

          pageTemplates.value = data.templates || [];
          pageParentOptions.value = data.parentOptions || [];
          const p = data.page || {};
          const cap = data.capabilities || {};
          pageCapabilities.value = {
            markdownEnabled: !!cap.markdownEnabled,
            canPublish: !!cap.canPublish,
          };

          pageForm.cid = Number(p.cid || cid) || cid || 0;
          pageForm.title = String(p.title || "");
          pageForm.slug = String(p.slug || "");
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
            fields: (pageForm.fields || [])
              .map((f) => ({
                name: String(f?.name || "").trim(),
                type: String(f?.type || "str"),
                value: safeJsonParse(f?.value ?? ""),
              }))
              .filter((f) => f.name),
          };
          const data = await apiPost(m === "publish" ? "pages.publish" : "pages.save", payload);
          const newCid = Number(data?.cid || pageForm.cid || 0) || 0;
          pageForm.cid = newCid;
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
          await fetchPages();
          await fetchDashboard();
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
          Object.assign(settingsData.site, data.site || {});
          Object.assign(settingsData.storage, data.storage || {});
          Object.assign(settingsData.reading, data.reading || {});
          settingsData.discussion = Object.assign({}, data.discussion || {});
          settingsData.notify = Object.assign({}, data.notify || {});
          settingsData.permalink = Object.assign({}, data.permalink || {});
          settingsData.lists = Object.assign(
            { langs: [], frontPagePages: [], frontPageFiles: [] },
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
          settingsSiteForm.allowRegister = Number(
            settingsData.site.allowRegister || 0
          );
          settingsSiteForm.defaultRegisterGroup = String(
            settingsData.site.defaultRegisterGroup || "subscriber"
          );
          settingsSiteForm.allowXmlRpc = Number(settingsData.site.allowXmlRpc || 0);
          settingsSiteForm.lang = String(settingsData.site.lang || "zh_CN");
          settingsSiteForm.timezone = Number(settingsData.site.timezone || 28800);

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
          settingsNotifyForm.friendLinkNotifyEnabled = Number(
            settingsData.notify.friendLinkNotifyEnabled || 0
          );
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
            settingsSiteForm.allowRegister = Number(settingsData.site.allowRegister || 0);
            settingsSiteForm.defaultRegisterGroup = String(
              settingsData.site.defaultRegisterGroup || "subscriber"
            );
            settingsSiteForm.allowXmlRpc = Number(settingsData.site.allowXmlRpc || 0);
            settingsSiteForm.lang = String(settingsData.site.lang || "zh_CN");
            settingsSiteForm.timezone = Number(settingsData.site.timezone || 28800);
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

            settingsDiscussionForm.commentDateFormat = String(
              settingsData.discussion.commentDateFormat || ""
            );
            settingsDiscussionForm.commentsListSize = Number(
              settingsData.discussion.commentsListSize || 20
            );
            settingsDiscussionForm.commentsMarkdown = Number(
              settingsData.discussion.commentsMarkdown || 0
            );
            settingsDiscussionForm.commentsPageBreak = Number(
              settingsData.discussion.commentsPageBreak || 0
            );
            settingsDiscussionForm.commentsPageSize = Number(
              settingsData.discussion.commentsPageSize || 10
            );
            settingsDiscussionForm.commentsOrder = String(
              settingsData.discussion.commentsOrder || "DESC"
            );
            settingsDiscussionForm.commentsRequireModeration = Number(
              settingsData.discussion.commentsRequireModeration || 0
            );
            settingsDiscussionForm.commentsRequireMail = Number(
              settingsData.discussion.commentsRequireMail || 0
            );
            settingsDiscussionForm.commentsRequireUrl = Number(
              settingsData.discussion.commentsRequireUrl || 0
            );
            settingsDiscussionForm.commentsAntiSpam = Number(
              settingsData.discussion.commentsAntiSpam || 0
            );
            settingsDiscussionForm.commentsPostTimeoutDays = Number(
              settingsData.discussion.commentsPostTimeoutDays || 0
            );
            settingsDiscussionForm.commentsPostIntervalEnable = Number(
              settingsData.discussion.commentsPostIntervalEnable || 0
            );
            settingsDiscussionForm.commentsPostIntervalMins = Number(
              settingsData.discussion.commentsPostIntervalMins || 0
            );
            settingsDiscussionForm.commentsHTMLTagAllowed = String(
              settingsData.discussion.commentsHTMLTagAllowed || ""
            );
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
            settingsData.notify = Object.assign({}, data.notify);
            settingsNotifyForm.mailEnabled = Number(data.notify.mailEnabled || 0);
            settingsNotifyForm.commentNotifyEnabled = Number(
              data.notify.commentNotifyEnabled || 0
            );
            settingsNotifyForm.friendLinkNotifyEnabled = Number(
              data.notify.friendLinkNotifyEnabled || 0
            );
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
        const discussionIntervalEnabled = v3aNormNum(
          settingsDiscussionForm.commentsPostIntervalEnable
        );
        const discussionDirty =
          v3aNormStr(settingsDiscussionForm.commentDateFormat) !==
            v3aNormStr(discussion.commentDateFormat) ||
          v3aNormNum(settingsDiscussionForm.commentsListSize) !==
            v3aNormNum(discussion.commentsListSize) ||
          v3aNormNum(settingsDiscussionForm.commentsMarkdown) !==
            v3aNormNum(discussion.commentsMarkdown) ||
          v3aNormNum(settingsDiscussionForm.commentsPageBreak) !==
            v3aNormNum(discussion.commentsPageBreak) ||
          (discussionPageBreakEnabled
            ? v3aNormNum(settingsDiscussionForm.commentsPageSize) !==
              v3aNormNum(discussion.commentsPageSize)
            : false) ||
          v3aNormStr(settingsDiscussionForm.commentsOrder) !== v3aNormStr(discussion.commentsOrder) ||
          v3aNormNum(settingsDiscussionForm.commentsRequireModeration) !==
            v3aNormNum(discussion.commentsRequireModeration) ||
          v3aNormNum(settingsDiscussionForm.commentsRequireMail) !==
            v3aNormNum(discussion.commentsRequireMail) ||
          v3aNormNum(settingsDiscussionForm.commentsRequireUrl) !==
            v3aNormNum(discussion.commentsRequireUrl) ||
          v3aNormNum(settingsDiscussionForm.commentsAntiSpam) !==
            v3aNormNum(discussion.commentsAntiSpam) ||
          v3aNormNum(settingsDiscussionForm.commentsPostTimeoutDays) !==
            v3aNormNum(discussion.commentsPostTimeoutDays) ||
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
          v3aNormNum(settingsNotifyForm.friendLinkNotifyEnabled) !==
            v3aNormNum(notify.friendLinkNotifyEnabled) ||
          v3aNormStr(settingsNotifyForm.smtpFrom) !== v3aNormStr(notify.smtpFrom) ||
          v3aNormStr(settingsNotifyForm.smtpHost) !== v3aNormStr(notify.smtpHost) ||
          v3aNormNum(settingsNotifyForm.smtpPort, 465) !== v3aNormNum(notify.smtpPort, 465) ||
          v3aNormStr(settingsNotifyForm.smtpUser) !== v3aNormStr(notify.smtpUser) ||
          v3aNormNum(settingsNotifyForm.smtpSecure) !==
            (v3aNormNum(notify.smtpSecure ?? 1) ? 1 : 0) ||
          v3aNormStr(settingsNotifyForm.commentTemplate) !==
            v3aNormStr(notify.commentTemplate || DEFAULT_NOTIFY_COMMENT_TEMPLATE) ||
          v3aNormStr(settingsNotifyForm.smtpPass) !== "";

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
        const tasks = [];
        if (dirty.profile) tasks.push(saveSettingsProfile);
        if (dirty.userOptions) tasks.push(saveSettingsUserOptions);
        if (dirty.site) tasks.push(saveSettingsSite);
        if (dirty.storage) tasks.push(saveSettingsStorage);
        if (dirty.reading) tasks.push(saveSettingsReading);
        if (dirty.discussion) tasks.push(saveSettingsDiscussion);
        if (dirty.notify) tasks.push(saveSettingsNotify);
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
              grid: { left: 36, right: 24, top: 36, bottom: 36 },
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
              grid: { left: 36, right: 24, top: 36, bottom: 36 },
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
              grid: { left: 36, right: 24, top: 24, bottom: 36 },
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
          if (p === "/users") {
            await fetchUsers();
          }
          if (p === "/data") {
            await refreshData();
          }
          if (p === "/posts/taxonomy") {
            await fetchTaxonomy();
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
        await fetchDashboard();
        if (routePath.value === "/posts/manage") {
          await fetchPosts();
        }
        if (routePath.value === "/posts/write") {
          await loadPostEditorFromRoute();
          await nextTick();
          initPostVditor();
          v3aUpdateVditorToolbarStickyTop();
        }
        if (routePath.value === "/files") {
          await fetchFiles();
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
      });

      function handleMenuClick(item) {
        if (item.action === "openSettings") {
          openSettings();
          return;
        }

        if (item.children && item.children.length) {
          if (sidebarCollapsed.value) {
            navTo(item.children[0].to);
            return;
          }
          toggleGroup(item.key);
          return;
        }

        if (item.to) navTo(item.to);
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
        route,
        routePath,
        routeQuery,
        crumb,
        sidebarCollapsed,
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
        postForm,
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
        dataVisitLoading,
        dataVisitError,
        dataVisitItems,
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
        settingsNotifyTemplateEditorOpen,
        settingsNotifyTemplateDraft,
        settingsNotifyTemplatePreviewHtml,
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
        openSettingsNotifyTemplateEditor,
        closeSettingsNotifyTemplateEditor,
        applySettingsNotifyTemplateDraft,
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
        isMenuItemActive,
        toggleSidebar,
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
      };
    },
    template: `
      <div class="v3a-app">
        <aside class="v3a-sidebar" :class="{ collapsed: sidebarCollapsed }">
          <nav class="v3a-menu">
            <div v-for="item in menuItems" :key="item.key">
              <div
                class="v3a-menu-item"
                :class="{ active: isMenuItemActive(item) }"
                @click="handleMenuClick(item)"
              >
                <div class="v3a-menu-left">
                  <span class="v3a-icon" v-html="ICONS[item.icon]"></span>
                  <span class="v3a-menu-label" v-show="!sidebarCollapsed">{{ item.label }}</span>
                </div>
                <span class="v3a-menu-right" v-show="!sidebarCollapsed">
                  <span class="v3a-badge" v-if="badgeValue(item)">{{ badgeValue(item) }}</span>
                  <span v-if="item.children" class="v3a-chev" :class="{ open: expanded[item.key] }">
                    <span class="v3a-icon" v-html="ICONS.chevron"></span>
                  </span>
                </span>
              </div>

              <div class="v3a-sub" v-if="item.children" v-show="expanded[item.key] && !sidebarCollapsed">
                <div
                  class="v3a-subitem"
                  v-for="child in item.children"
                  :key="child.key"
                  :class="{ active: isActive(child.to) }"
                  @click="navTo(child.to)"
                >
                  {{ child.label }}
                </div>
              </div>
            </div>
          </nav>
        </aside>

        <aside class="v3a-subsidebar" v-show="settingsOpen && !sidebarCollapsed">
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
                  <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarCollapsed ? '展开' : '收起'">
                    <span class="v3a-icon" v-html="sidebarCollapsed ? ICONS.expand : ICONS.collapse"></span>
                  </button>
                  <div class="v3a-dash-title">欢迎回来</div>
                </div>

                <div class="v3a-section">
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

                <div class="v3a-section">
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
                        <button class="v3a-mini-btn primary" type="button" @click="navTo('/friends')">新增</button>
                        <button class="v3a-mini-btn" type="button" @click="navTo('/friends')">管理</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="v3a-section">
                  <div class="v3a-section-hd split">
                    <div class="v3a-section-title">数据统计</div>
                    <div class="v3a-section-tools">
                      <span class="v3a-muted">更新于 {{ formatTime(systemInfo.serverTime) }}</span>
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
                    <div class="v3a-metric-item" @click="navTo('/friends')">
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
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarCollapsed ? '展开' : '收起'">
                      <span class="v3a-icon" v-html="sidebarCollapsed ? ICONS.expand : ICONS.collapse"></span>
                    </button>
                    <div class="v3a-posts-title">管理</div>
                  </div>
                  <div class="v3a-posts-actions">
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

                <div class="v3a-posts-search">
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

                <div class="v3a-card">
                  <div class="bd" style="padding: 0;">
                    <div v-if="postsLoading" class="v3a-muted" style="padding: 16px;">正在加载…</div>

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
                          <th title="评论"><span class="v3a-icon" v-html="ICONS.comments"></span></th>
                          <th title="点赞"><span class="v3a-icon" v-html="ICONS.thumbsUp"></span></th>
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
                            <a href="###" @click.prevent="openPostEditor(p.cid)">{{ p.title || '（无标题）' }}</a>
                          </td>
                          <td v-if="V3A.canPublish && postsFilters.scope === 'all' && (!V3A.acl || !V3A.acl.posts || Number(V3A.acl.posts.scopeAll))" class="v3a-muted">
                            {{ (p.author && p.author.name) ? p.author.name : '—' }}
                          </td>
                          <td>{{ (p.categories && p.categories.length) ? p.categories[0].name : '—' }}</td>
                          <td>{{ (p.tags && p.tags.length) ? p.tags.map(t => t.name).join(', ') : '—' }}</td>
                          <td style="text-align:center;">{{ formatNumber(p.commentsNum) }}</td>
                          <td style="text-align:center;">{{ formatNumber(p.likes) }}</td>
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
                          <td :colspan="(V3A.canPublish && postsFilters.scope === 'all' && (!V3A.acl || !V3A.acl.posts || Number(V3A.acl.posts.scopeAll))) ? 11 : 10" class="v3a-muted" style="padding: 16px;">暂无文章</td>
                        </tr>
                      </tbody>
                    </table>
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
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarCollapsed ? '展开' : '收起'">
                      <span class="v3a-icon" v-html="sidebarCollapsed ? ICONS.expand : ICONS.collapse"></span>
                    </button>
                    <div class="v3a-pagehead-title">{{ crumb }}</div>
                  </div>
                  <div class="v3a-pagehead-actions">
                    <button class="v3a-iconbtn v3a-write-side-toggle" type="button" @click="toggleWriteSidebar()" :title="writeSidebarOpen ? '收起发布设置' : '展开发布设置'">
                      <span class="v3a-icon" v-html="ICONS.settings"></span>
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
                        <input class="v3a-write-title" v-model="postForm.title" placeholder="输入标题..." />
                        <div class="v3a-write-subtitle">
                          <div class="v3a-write-subline">
                            <span class="v3a-write-baseurl">{{ postSlugPrefix }}</span>
                            <template v-if="postSlugHasSlug">
                              <input class="v3a-write-slug" v-model="postForm.slug" placeholder="slug" :style="{ width: postSlugInputWidth + 'ch' }" />
                              <span v-if="postSlugSuffix" class="v3a-write-baseurl v3a-write-baseurl-suffix">{{ postSlugSuffix }}</span>
                            </template>
                          </div>
                        </div>
                      </div>
                      <div class="v3a-write-editor-content">
                        <div v-if="postEditorType === 'vditor'" id="v3a-post-vditor" class="v3a-vditor"></div>
                        <textarea v-else id="v3a-post-text" ref="postTextEl" class="v3a-write-textarea" v-model="postForm.text" @input="autoSizePostText"></textarea>
                      </div>
                    </div>
                  </div>

                  <div class="v3a-write-side-mask" v-if="writeSidebarOpen" @click="toggleWriteSidebar(false)"></div>
                  <div class="v3a-write-side" :class="{ open: writeSidebarOpen }">
                      <div class="v3a-write-drawer-header">
                        <div class="v3a-write-drawer-title" role="heading" aria-level="1">文章设定</div>
                        <button class="v3a-write-drawer-close" type="button" @click="toggleWriteSidebar(false)" aria-label="close" data-tooltip="关闭">
                          <span class="v3a-icon" v-html="ICONS.closeSmall"></span>
                        </button>
                      </div>
                    <div class="v3a-write-drawer-body">
                      <div class="v3a-write-section">
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

                        <div class="v3a-kv-span">
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

                      <div style="margin-top: calc(var(--spacing) * 6); display:flex; align-items: center; justify-content: space-between; gap: 8px;">
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
              </div>
            </template>

            <template v-else-if="routePath === '/posts/taxonomy'">
              <div class="v3a-container">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarCollapsed ? '展开' : '收起'">
                      <span class="v3a-icon" v-html="sidebarCollapsed ? ICONS.expand : ICONS.collapse"></span>
                    </button>
                    <div class="v3a-pagehead-title">{{ crumb }}</div>
                  </div>
                  <div class="v3a-pagehead-actions">
                    <button class="v3a-btn" type="button" @click="fetchTaxonomy()" :disabled="taxonomyLoading">刷新</button>
                    <button class="v3a-btn" type="button" @click="openCategoryEditor(null)">新建分类</button>
                    <button class="v3a-btn primary" type="button" @click="openTagEditor(null)">新建标签</button>
                  </div>
                </div>

                <div class="v3a-grid">
                  <div class="v3a-card">
                    <div class="bd" style="padding: 0;">
                      <table class="v3a-table v3a-taxonomy-table">
                        <thead><tr><th>名称</th><th>缩略名</th><th>数量</th><th>操作</th></tr></thead>
                        <tbody>
                          <tr v-for="c in categoriesAll" :key="c.mid">
                            <td>
                              <div style="display:flex; align-items:center; gap: 8px;">
                                <span :style="{ paddingLeft: (Number(c.levels || 0) * 12) + 'px' }">{{ c.name }}</span>
                                <span v-if="Number(c.mid) === Number(defaultCategoryId)" class="v3a-pill success">默认</span>
                              </div>
                            </td>
                            <td class="v3a-muted">{{ c.slug }}</td>
                            <td>{{ formatNumber(c.count) }}</td>
                            <td style="white-space: nowrap;">
                              <button class="v3a-mini-btn" type="button" @click="openCategoryEditor(c)">编辑</button>
                              <button class="v3a-mini-btn" type="button" style="color: var(--v3a-danger);" @click="deleteCategory(c.mid)" :disabled="Number(c.mid) === Number(defaultCategoryId)">删除</button>
                            </td>
                          </tr>
                          <tr v-if="!categoriesAll.length">
                            <td colspan="4" class="v3a-muted">暂无分类</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div class="v3a-card">
                    <div class="bd" style="padding: 0;">
                      <table class="v3a-table v3a-taxonomy-table">
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

            <template v-else-if="routePath === '/comments'">
              <div class="v3a-container v3a-container-comments">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarCollapsed ? '展开' : '收起'">
                      <span class="v3a-icon" v-html="sidebarCollapsed ? ICONS.expand : ICONS.collapse"></span>
                    </button>
                    <div class="v3a-pagehead-title">{{ crumb }}</div>
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
                        <div class="v3a-comments-tabs" aria-label="评论状态">
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
                        <div class="v3a-comments-toolbar">
                          <div class="v3a-searchbox v3a-searchbox-full">
                            <span class="v3a-searchbox-icon" v-html="ICONS.search"></span>
                            <input class="v3a-input" v-model="commentsFilters.keywords" @keyup.enter="applyCommentsFilters()" placeholder="搜索作者 / 邮箱 / 内容..." />
                          </div>
                          <button class="v3a-btn" type="button" @click="applyCommentsFilters()" :disabled="commentsLoading">搜索</button>
                        </div>

                        <div v-if="commentsError" class="v3a-alert v3a-comments-alert">{{ commentsError }}</div>

                        <div class="v3a-comments-list">
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
                              <div class="v3a-comment-avatar">
                                {{ (String(c.author || '?').trim() || '?').slice(0, 1).toUpperCase() }}
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

                      <div class="bd v3a-comments-detail-shell">
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
                                    <div class="v3a-comments-avatar">
                                      {{ (String(commentForm.author || '?').trim() || '?').slice(0, 1).toUpperCase() }}
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
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarCollapsed ? '展开' : '收起'">
                      <span class="v3a-icon" v-html="sidebarCollapsed ? ICONS.expand : ICONS.collapse"></span>
                    </button>
                    <div class="v3a-pagehead-title">{{ crumb }}</div>
                  </div>
                  <div class="v3a-pagehead-actions">
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

                <div class="v3a-card">
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
                          <td>{{ formatTime(p.created) }}</td>
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
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarCollapsed ? '展开' : '收起'">
                      <span class="v3a-icon" v-html="sidebarCollapsed ? ICONS.expand : ICONS.collapse"></span>
                    </button>
                    <div class="v3a-pagehead-title">{{ crumb }}</div>
                  </div>
                  <div class="v3a-pagehead-actions">
                    <button class="v3a-iconbtn v3a-write-side-toggle" type="button" @click="toggleWriteSidebar()" :title="writeSidebarOpen ? '收起发布设置' : '展开发布设置'">
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
                        <input class="v3a-write-title" v-model="pageForm.title" placeholder="输入标题..." />
                        <div class="v3a-write-subtitle">
                          <div class="v3a-write-subline">
                            <span class="v3a-write-baseurl">{{ pageSlugPrefix }}</span>
                            <template v-if="pageSlugHasSlug">
                              <input class="v3a-write-slug" v-model="pageForm.slug" placeholder="slug" :style="{ width: pageSlugInputWidth + 'ch' }" />
                              <span v-if="pageSlugSuffix" class="v3a-write-baseurl v3a-write-baseurl-suffix">{{ pageSlugSuffix }}</span>
                            </template>
                          </div>
                        </div>
                      </div>
                      <div class="v3a-write-editor-content">
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

                        <div class="v3a-kv-span">
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
            </template>

            <template v-else-if="routePath === '/files'">
              <div class="v3a-container v3a-container-files">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarCollapsed ? '展开' : '收起'">
                      <span class="v3a-icon" v-html="sidebarCollapsed ? ICONS.expand : ICONS.collapse"></span>
                    </button>
                    <div class="v3a-pagehead-title">{{ crumb }}</div>
                  </div>
                  <div class="v3a-pagehead-actions">
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

                    <div v-else class="v3a-filegrid">
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
              <div class="v3a-container">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarCollapsed ? '展开' : '收起'">
                      <span class="v3a-icon" v-html="sidebarCollapsed ? ICONS.expand : ICONS.collapse"></span>
                    </button>
                    <div class="v3a-pagehead-title">{{ crumb }}</div>
                  </div>
                  <div class="v3a-pagehead-actions">
                    <button class="v3a-btn primary" type="button">新增友链</button>
                  </div>
                </div>

                <div class="v3a-grid two">
                  <div class="v3a-card">
                    <div class="hd"><div class="title">友链列表（UI 占位）</div></div>
                    <div class="bd">
                      <table class="v3a-table">
                        <thead><tr><th>名称</th><th>URL</th><th>状态</th><th>操作</th></tr></thead>
                        <tbody>
                          <tr v-for="i in 5" :key="i">
                            <td>站点 #{{ i }}</td>
                            <td>https://example.com</td>
                            <td><span class="v3a-pill success">已通过</span></td>
                            <td><span class="v3a-muted">编辑</span></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div class="v3a-card">
                    <div class="hd"><div class="title">友链申请（UI 占位）</div></div>
                    <div class="bd">
                      <table class="v3a-table">
                        <thead><tr><th>名称</th><th>URL</th><th>留言</th><th>操作</th></tr></thead>
                        <tbody>
                          <tr v-for="i in 3" :key="i">
                            <td>申请者 #{{ i }}</td>
                            <td>https://example.com</td>
                            <td>请添加友链</td>
                            <td><span class="v3a-muted">通过 / 拒绝</span></td>
                          </tr>
                        </tbody>
                      </table>
                      <div class="v3a-muted" style="margin-top: 10px;">该模块后续将对接 <code>v3a_friend_link*</code> 数据表。</div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="routePath === '/data'">
              <div class="v3a-container">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarCollapsed ? '展开' : '收起'">
                      <span class="v3a-icon" v-html="sidebarCollapsed ? ICONS.expand : ICONS.collapse"></span>
                    </button>
                  <div class="v3a-pagehead-title">{{ crumb }}</div>
                  </div>
                  <div class="v3a-pagehead-actions">
                    <button class="v3a-actionbtn" type="button" title="刷新" :disabled="dataVisitLoading" @click="refreshData()">
                      <span class="v3a-icon" v-html="ICONS.refreshCw"></span>
                    </button>
                  </div>
                </div>

                <div class="v3a-posts-search">
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

                <div class="v3a-card">
                  <div class="bd" style="padding: 0;">
                    <div v-if="dataVisitError" class="v3a-alert" style="margin: 16px;">{{ dataVisitError }}</div>
                    <div v-else-if="dataVisitLoading" class="v3a-muted" style="padding: 16px;">正在加载…</div>

                    <table v-else class="v3a-table v3a-posts-table">
                      <thead>
                        <tr>
                          <th>IP</th>
                          <th>路径</th>
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
                          <td style="text-align:center;">
                            <span class="v3a-pill" :class="dataDeviceTone(v.deviceType)">{{ v.device || '—' }}</span>
                          </td>
                          <td>{{ formatTime(v.created) }}</td>
                        </tr>
                        <tr v-if="!dataVisitItems.length">
                          <td colspan="4" class="v3a-muted" style="padding: 16px;">暂无访问日志</td>
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
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarCollapsed ? '展开' : '收起'">
                      <span class="v3a-icon" v-html="sidebarCollapsed ? ICONS.expand : ICONS.collapse"></span>
                    </button>
                    <div class="v3a-pagehead-title">{{ crumb }}</div>
                  </div>
                  <div class="v3a-pagehead-actions">
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

                <div class="v3a-card">
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

            <template v-else-if="routePath === '/maintenance/tasks'">
              <div class="v3a-container">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarCollapsed ? '展开' : '收起'">
                      <span class="v3a-icon" v-html="sidebarCollapsed ? ICONS.expand : ICONS.collapse"></span>
                    </button>
                    <div class="v3a-pagehead-title">{{ crumb }}</div>
                  </div>
                  <div class="v3a-pagehead-actions">
                    <button class="v3a-btn primary" type="button">新建任务</button>
                  </div>
                </div>

                <div class="v3a-card">
                  <div class="hd"><div class="title">任务列表（UI 占位）</div></div>
                  <div class="bd">
                    <table class="v3a-table">
                      <thead><tr><th>任务</th><th>计划</th><th>状态</th><th>操作</th></tr></thead>
                      <tbody>
                        <tr v-for="i in 4" :key="i">
                          <td>示例任务 #{{ i }}</td>
                          <td>每天 02:00</td>
                          <td><span class="v3a-pill">未启用</span></td>
                          <td><span class="v3a-muted">启用 / 编辑</span></td>
                        </tr>
                      </tbody>
                    </table>
                    <div class="v3a-muted" style="margin-top: 10px;">后续将对接计划任务与清理任务。</div>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="routePath === '/maintenance/backup'">
              <div class="v3a-container">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarCollapsed ? '展开' : '收起'">
                      <span class="v3a-icon" v-html="sidebarCollapsed ? ICONS.expand : ICONS.collapse"></span>
                    </button>
                    <div class="v3a-pagehead-title">{{ crumb }}</div>
                  </div>
                  <div class="v3a-pagehead-actions">
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

                <div class="v3a-card" style="margin-top: calc(var(--spacing) * 4);">
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
                          <td style="text-align:center;">{{ formatTime(b.time) }}</td>
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

            <template v-else-if="routePath === '/settings'">
              <div class="v3a-container">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarCollapsed ? '展开' : '收起'">
                      <span class="v3a-icon" v-html="sidebarCollapsed ? ICONS.expand : ICONS.collapse"></span>
                    </button>
                    <div class="v3a-pagehead-title">{{ crumb }}</div>
                  </div>
                  <div class="v3a-pagehead-actions">
                    <div v-if="!String(settingsActiveKey || '').startsWith('theme.')" class="v3a-settings-savebar">
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
                      <div class="v3a-settings-user-head">
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

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>时区（秒）</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" type="number" v-model.number="settingsSiteForm.timezone" />
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
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" v-model="settingsDiscussionForm.commentDateFormat" placeholder="Y-m-d H:i" />
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>侧边栏评论列表数</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" type="number" v-model.number="settingsDiscussionForm.commentsListSize" />
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
                                <label>评论分页</label>
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
                                <label>发布后自动关闭评论（天）</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <input class="v3a-input" type="number" v-model.number="settingsDiscussionForm.commentsPostTimeoutDays" />
                              </div>
                            </div>

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>同 IP 评论间隔限制</label>
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

                            <div class="v3a-settings-row">
                              <div class="v3a-settings-row-label">
                                <label>评论提醒</label>
                                <div class="v3a-settings-row-help">目前仅实现评论提醒（发送至管理员邮箱）</div>
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
                                <label>友链申请提醒</label>
                                <div class="v3a-settings-row-help">占位功能（暂不发送）</div>
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
                                <label>评论提醒模板</label>
                              </div>
                              <div class="v3a-settings-row-control">
                                <div class="v3a-mailtpl-card">
                                  <div class="v3a-mailtpl-card-hd">
                                    <div class="v3a-mailtpl-card-title">预览</div>
                                    <button class="v3a-btn" type="button" @click="openSettingsNotifyTemplateEditor()">编辑</button>
                                  </div>
                                  <div class="v3a-mailtpl-preview" v-html="settingsNotifyTemplatePreviewHtml"></div>
                                  <div class="v3a-mailtpl-vars">
                                    <div class="v3a-mailtpl-vars-title">支持变量：</div>
                                    <code v-pre>{{siteTitle}}</code>
                                    <code v-pre>{{postTitle}}</code>
                                    <code v-pre>{{postUrl}}</code>
                                    <code v-pre>{{commentAuthor}}</code>
                                    <code v-pre>{{commentTime}}</code>
                                    <code v-pre>{{commentStatus}}</code>
                                    <code v-pre>{{commentText}}</code>
                                  </div>
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
                          <div class="v3a-modal-title">编辑邮件模板（HTML）</div>
                        </div>
                        <div class="v3a-modal-body">
                          <div class="v3a-modal-form">
                            <div class="v3a-modal-item">
                              <label class="v3a-modal-label">模板内容</label>
                              <textarea class="v3a-textarea v3a-modal-textarea v3a-code-editor" v-model="settingsNotifyTemplateDraft" placeholder="<div>...</div>"></textarea>
                              <div class="v3a-muted" style="margin-top: 10px; font-size: 12px; line-height: 1.6;">
                                可用变量：
                                <code v-pre>{{siteTitle}}</code>
                                <code v-pre>{{postTitle}}</code>
                                <code v-pre>{{postUrl}}</code>
                                <code v-pre>{{commentAuthor}}</code>
                                <code v-pre>{{commentTime}}</code>
                                <code v-pre>{{commentStatus}}</code>
                                <code v-pre>{{commentText}}</code>
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
                          <div v-else class="v3a-card v3a-settings-tablecard">
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

                    <div v-if="pluginConfigOpen" class="v3a-modal-mask" @click.self="closePluginConfig()">
                      <div class="v3a-modal-card v3a-plugin-config-modal" role="dialog" aria-modal="true">
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
