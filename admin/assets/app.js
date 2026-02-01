(function () {
  const Vue = window.Vue;
  if (!Vue) {
    console.error("[Vue3Admin] Vue is missing");
    return;
  }

  const { createApp, ref, reactive, computed, onMounted, watch, nextTick } = Vue;
  const V3A = window.V3A || {};
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
  };

  const SETTINGS = [
    { key: "user", label: "用户" },
    { key: "site", label: "网站" },
    { key: "content", label: "内容" },
    { key: "notify", label: "通知" },
    { key: "storage", label: "存储" },
    { key: "system", label: "永久链接" },
    { key: "security", label: "账号安全" },
  ];

  const MENU = [
    { key: "dashboard", label: "仪表盘", icon: "dashboard", to: "/dashboard" },
    {
      key: "posts",
      label: "博文",
      icon: "posts",
      children: [
        { key: "posts-manage", label: "管理", to: "/posts/manage" },
        { key: "posts-write", label: "撰写", to: "/posts/write" },
        { key: "posts-taxonomy", label: "分类/标签", to: "/posts/taxonomy" },
      ],
    },
    { key: "comments", label: "评论", icon: "comments", to: "/comments", badgeKey: "commentsWaiting" },
    {
      key: "pages",
      label: "页面",
      icon: "pages",
      children: [
        { key: "pages-manage", label: "管理", to: "/pages/manage" },
        { key: "pages-edit", label: "编辑", to: "/pages/edit" },
      ],
    },
    { key: "files", label: "文件", icon: "files", to: "/files" },
    { key: "friends", label: "朋友们", icon: "friends", to: "/friends" },
    { key: "data", label: "数据", icon: "data", to: "/data" },
    { key: "subscribe", label: "订阅", icon: "subscribe", to: "/subscribe" },
    { key: "settings", label: "设定", icon: "settings", action: "openSettings" },
    {
      key: "maintenance",
      label: "维护",
      icon: "maintenance",
      children: [
        { key: "maintenance-tasks", label: "任务", to: "/maintenance/tasks" },
        { key: "maintenance-backup", label: "备份", to: "/maintenance/backup" },
      ],
    },
  ];

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
      return item ? `设定 / ${item.label}` : "设定";
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
      const writeSidebarOpen = ref(false);

      const expanded = ref({
        posts: true,
        pages: false,
        maintenance: false,
      });

      const route = ref(getRoute());
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
        const key = localStorage.getItem(STORAGE_KEYS.settingsKey);
        if (key && SETTINGS.some((s) => s.key === key)) {
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
        pageSize: 24,
        total: 0,
        pageCount: 1,
      });

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
        scope: V3A.canPublish ? "all" : "mine", // mine|all (editors only)
      });
      const commentsPagination = reactive({
        page: 1,
        pageSize: 20,
        total: 0,
        pageCount: 1,
      });

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
      });
      const commentReplyText = ref("");

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
        allowXmlRpc: 0,
        lang: "zh_CN",
        timezone: 28800,
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
        settingsActiveKey.value = key;
        try {
          localStorage.setItem(STORAGE_KEYS.settingsKey, key);
        } catch (e) {}
        navTo("/settings");
      }

      function navTo(path) {
        const p = String(path || "/").split("?")[0] || "/";
        settingsOpen.value = p === "/settings";
        ensureExpandedForRoute(p);
        persistExpanded();
        route.value = path;
        setRoute(path);
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
          const data = await apiGet("posts.list", {
            page: postsPagination.page,
            pageSize: postsPagination.pageSize,
            status: postsFilters.status,
            keywords: postsFilters.keywords,
            category: postsFilters.category || "",
            scope: postsFilters.scope,
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
          const data = await apiGet("files.list", {
            page: filesPagination.page,
            pageSize: filesPagination.pageSize,
            keywords: filesKeywords.value,
          });
          filesItems.value = data.items || [];
          const p = data.pagination || {};
          filesPagination.page = Number(p.page || filesPagination.page) || 1;
          filesPagination.pageSize =
            Number(p.pageSize || filesPagination.pageSize) || 24;
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

        filesUploading.value = true;
        filesError.value = "";
        try {
          for (const file of files) {
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
          const data = await apiGet("comments.list", {
            page: commentsPagination.page,
            pageSize: commentsPagination.pageSize,
            status: commentsFilters.status,
            keywords: commentsFilters.keywords,
            scope: commentsFilters.scope,
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
        commentReplyText.value = "";
        commentEditorPost.value = null;
        commentEditorError.value = "";
      }

      async function openCommentEditor(coid) {
        const id = Number(coid || 0);
        if (!id) return;
        commentEditorOpen.value = true;
        commentEditorLoading.value = true;
        commentEditorError.value = "";
        try {
          const data = await apiGet("comments.get", { coid: id });
          const c = data.comment || {};
          resetCommentEditor();
          commentForm.coid = Number(c.coid || id) || id;
          commentForm.cid = Number(c.cid || 0) || 0;
          commentForm.author = String(c.author || "");
          commentForm.mail = String(c.mail || "");
          commentForm.url = String(c.url || "");
          commentForm.created = Number(c.created || 0) || 0;
          commentForm.text = String(c.text || "");
          commentForm.status = String(c.status || "");
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
          pageForm.markdown = !!p.isMarkdown;

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
        pageSaving.value = true;
        pageError.value = "";
        pageMessage.value = "";
        try {
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
          }
          settingsPermalinkRewriteError.value = "";
          settingsPermalinkEnableRewriteAnyway.value = 0;
          settingsMessage.value = "已保存";
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
          }
          settingsMessage.value = "已保存";
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
          }
          settingsMessage.value = "已保存";
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
          }
          settingsMessage.value = "已保存";
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
          }
          settingsMessage.value = "已保存";
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
          const data = await apiPost("settings.notify.save", payload);
          if (data && data.discussion) {
            settingsData.discussion = Object.assign({}, data.discussion);
          }
          settingsMessage.value = "已保存";
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

            if (data.permalink.customPattern !== undefined) {
              settingsPermalinkForm.customPattern = String(
                data.permalink.customPattern || ""
              );
            }
          }
          settingsMessage.value = "已保存";
        } catch (e) {
          settingsError.value = e && e.message ? e.message : "保存失败";
        } finally {
          settingsSaving.value = false;
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

          const data = tagTop.value
            .slice(0, 20)
            .map((t) => ({ name: t.name, value: Number(t.count || 0) }));

          if (!data.length) {
            try {
              chartTag.clear();
            } catch (e) {}
          } else {
            try {
              chartTag.setOption(
                {
                  tooltip: {
                    formatter: (p) =>
                      `${p.name}: ${formatNumber(p.value)} 篇文章`,
                  },
                  series: [
                    {
                      type: "wordCloud",
                      shape: "square",
                      gridSize: 2,
                      sizeRange: [14, 32],
                      rotationRange: [0, 0],
                      textStyle: {
                        color: axisLabelColor,
                        fontFamily:
                          "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial",
                      },
                      emphasis: {
                        textStyle: { color: axisStrokeColor },
                      },
                      data,
                    },
                  ],
                },
                { notMerge: true }
              );
            } catch (e) {
              // wordCloud plugin may be missing
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
          const r = getRoute();
          route.value = r;
          const p = String(r || "/").split("?")[0] || "/";
          settingsOpen.value = p === "/settings";
          ensureExpandedForRoute(p);
          persistExpanded();
        });
      }

      watch(
        () => route.value,
        async (r) => {
          const p = String(r || "/").split("?")[0] || "/";

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
          }
          if (p === "/files") {
            await fetchFiles();
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
          }
          if (p === "/settings") {
            await fetchSettings();
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

        listenHash();
        route.value = getRoute();
        settingsOpen.value = routePath.value === "/settings";
        ensureExpandedForRoute(routePath.value);
        document.title = `${crumb.value} - Vue3Admin`;
        await fetchDashboard();
        if (routePath.value === "/posts/manage") {
          await fetchPosts();
        }
        if (routePath.value === "/posts/write") {
          await loadPostEditorFromRoute();
        }
        if (routePath.value === "/files") {
          await fetchFiles();
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
        }
        if (routePath.value === "/settings") {
          await fetchSettings();
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
        SETTINGS,
        jsonExample,
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
        writeSidebarOpen,
        expanded,
        summary,
        realtime,
        hotPosts,
        tagTop,
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
        addPageField,
        removePageField,
        submitPage,
        settingsLoading,
        settingsSaving,
        settingsError,
        settingsMessage,
        settingsData,
        settingsProfileForm,
        settingsUserOptionsForm,
        settingsPasswordForm,
        settingsSiteForm,
        settingsStorageForm,
        settingsReadingForm,
        settingsDiscussionForm,
        settingsPermalinkForm,
        settingsPermalinkRewriteError,
        settingsPermalinkEnableRewriteAnyway,
        permalinkPostPatternOptions,
        fetchSettings,
        saveSettingsProfile,
        saveSettingsUserOptions,
        saveSettingsPassword,
        saveSettingsSite,
        saveSettingsStorage,
        saveSettingsReading,
        saveSettingsDiscussion,
        saveSettingsPermalink,
        username,
        userInitial,
        formatNumber,
        formatTime,
        formatTimeAgo,
        isActive,
        isMenuItemActive,
        toggleSidebar,
        toggleWriteSidebar,
        handleMenuClick,
        navTo,
        openSettings,
        selectSettings,
        badgeValue,
        fetchDashboard,
      };
    },
    template: `
      <div class="v3a-app">
        <aside class="v3a-sidebar" :class="{ collapsed: sidebarCollapsed }">
          <nav class="v3a-menu">
            <div v-for="item in MENU" :key="item.key">
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
            <div
              class="v3a-subsidebar-item"
              v-for="s in SETTINGS"
              :key="s.key"
              :class="{ active: settingsActiveKey === s.key }"
              @click="selectSettings(s.key)"
            >
              {{ s.label }}
            </div>
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
                        <div class="v3a-charttitle">标签热词 Top 20</div>
                        <span class="v3a-charticon" v-html="ICONS.tags"></span>
                      </div>
                      <div id="v3a-chart-tag" class="v3a-chart"></div>
                      <div v-if="!tagTop.length" class="v3a-empty">暂无数据</div>
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
                    <button class="v3a-actionbtn success" type="button" title="批量发布" :disabled="!postsSelectedCids.length" @click="updateSelectedPostsStatus('publish')">
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
                          <td colspan="10" class="v3a-muted" style="padding: 16px;">暂无文章</td>
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
                        <textarea id="v3a-post-text" ref="postTextEl" class="v3a-write-textarea" v-model="postForm.text" @input="autoSizePostText"></textarea>
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

                      <div style="display:flex; align-items:center; justify-content:space-between; gap: 8px;">
                        <div class="title" style="font-weight: 600;">自定义字段</div>
                        <button class="v3a-mini-btn" type="button" @click="addPostField()">新增字段</button>
                      </div>

                      <div style="margin-top: 12px;">
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
                                <input class="v3a-input" v-model="f.value" :placeholder="f.type === 'json' ? jsonExample : ''" />
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

                      <div class="v3a-divider"></div>
                      <div class="v3a-muted">发布权限：{{ postCapabilities.canPublish ? '可直接发布' : '将以待审核方式提交' }}</div>
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
              <div class="v3a-container">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarCollapsed ? '展开' : '收起'">
                      <span class="v3a-icon" v-html="sidebarCollapsed ? ICONS.expand : ICONS.collapse"></span>
                    </button>
                    <div class="v3a-pagehead-title">{{ crumb }}</div>
                  </div>
                  <div class="v3a-pagehead-actions">
                    <button class="v3a-btn" :class="{ primary: commentsFilters.status === 'approved' }" type="button" @click="quickSetCommentsStatus('approved')">已通过</button>
                    <button class="v3a-btn" :class="{ primary: commentsFilters.status === 'waiting' }" type="button" @click="quickSetCommentsStatus('waiting')">待审核</button>
                    <button class="v3a-btn" :class="{ primary: commentsFilters.status === 'spam' }" type="button" @click="quickSetCommentsStatus('spam')">垃圾</button>
                    <button class="v3a-btn" :class="{ primary: commentsFilters.status === 'all' }" type="button" @click="quickSetCommentsStatus('all')">全部</button>
                    <button class="v3a-btn" type="button" @click="applyCommentsFilters()" :disabled="commentsLoading">刷新</button>
                  </div>
                </div>

                <div class="v3a-posts-search">
                  <div class="v3a-searchbox">
                    <span class="v3a-searchbox-icon" v-html="ICONS.search"></span>
                    <input class="v3a-input" v-model="commentsFilters.keywords" @keyup.enter="applyCommentsFilters()" placeholder="搜索作者 / 邮箱 / 内容..." />
                  </div>
                </div>

                <div class="v3a-grid">
                  <div class="v3a-card" v-if="commentEditorOpen">
                    <div class="hd" style="display:flex; align-items:center; justify-content:space-between; gap: 8px;">
                      <div class="title">编辑 / 回复</div>
                      <button class="v3a-mini-btn" type="button" @click="closeCommentEditor()">关闭</button>
                    </div>
                    <div class="bd">
                      <div v-if="commentEditorLoading" class="v3a-muted">正在加载…</div>
                      <div v-else>
                        <div v-if="commentEditorPost" class="v3a-muted" style="margin-bottom: 10px;">
                          关联：{{ commentEditorPost.title || ('#' + commentForm.cid) }}
                        </div>
                        <div class="v3a-kv">
                          <div class="v3a-muted">作者</div>
                          <input class="v3a-input" v-model="commentForm.author" />
                          <div class="v3a-muted">邮箱</div>
                          <input class="v3a-input" v-model="commentForm.mail" />
                          <div class="v3a-muted">网址</div>
                          <input class="v3a-input" v-model="commentForm.url" />
                          <div class="v3a-muted">时间戳</div>
                          <input class="v3a-input" type="number" v-model.number="commentForm.created" />
                          <div class="v3a-muted">内容</div>
                          <textarea class="v3a-textarea" v-model="commentForm.text"></textarea>
                        </div>

                        <div style="display:flex; justify-content:flex-end; gap: 8px; margin-top: 12px;">
                          <button class="v3a-btn" type="button" @click="markComment(commentForm.coid, 'approved')" :disabled="commentEditorSaving">通过</button>
                          <button class="v3a-btn" type="button" @click="markComment(commentForm.coid, 'waiting')" :disabled="commentEditorSaving">待审核</button>
                          <button class="v3a-btn" type="button" @click="markComment(commentForm.coid, 'spam')" :disabled="commentEditorSaving">垃圾</button>
                          <button class="v3a-btn primary" type="button" @click="saveCommentEdit()" :disabled="commentEditorSaving">保存</button>
                        </div>

                        <div class="v3a-divider"></div>
                        <div class="v3a-muted" style="margin-bottom: 8px;">回复（管理员）</div>
                        <textarea class="v3a-textarea" v-model="commentReplyText" placeholder="输入回复内容…"></textarea>
                        <div style="display:flex; justify-content:flex-end; gap: 8px; margin-top: 12px;">
                          <button class="v3a-btn primary" type="button" @click="submitCommentReply()" :disabled="commentEditorSaving || !commentReplyText.trim()">回复</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="v3a-card">
                    <div class="bd" style="padding: 0;">
                      <div v-if="commentsLoading" class="v3a-muted" style="padding: 16px;">正在加载…</div>
                      <table v-else class="v3a-table">
                        <thead>
                          <tr>
                            <th>作者</th>
                            <th>内容</th>
                            <th>关联</th>
                            <th>状态</th>
                            <th>日期</th>
                            <th>操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="c in commentsItems" :key="c.coid">
                            <td style="white-space: nowrap;">
                              <div>{{ c.author || '—' }}</div>
                              <div class="v3a-muted" style="font-size: 12px;">{{ c.ip || '' }}</div>
                            </td>
                            <td style="min-width: 240px;">
                              <div>{{ c.excerpt || '—' }}</div>
                              <div class="v3a-muted" style="font-size: 12px;" v-if="c.mail">{{ c.mail }}</div>
                            </td>
                            <td>
                              <span class="v3a-pill">{{ (c.post && c.post.title) ? c.post.title : ('#' + c.cid) }}</span>
                            </td>
                            <td>
                              <span class="v3a-pill" :class="getCommentBadge(c).tone">{{ getCommentBadge(c).text }}</span>
                            </td>
                            <td>{{ formatTime(c.created) }}</td>
                            <td style="white-space: nowrap;">
                              <button class="v3a-mini-btn" type="button" @click="openCommentEditor(c.coid)">编辑</button>
                              <button class="v3a-mini-btn" type="button" @click="markComment(c.coid, 'approved')">通过</button>
                              <button class="v3a-mini-btn" type="button" @click="markComment(c.coid, 'waiting')">待审</button>
                              <button class="v3a-mini-btn" type="button" @click="markComment(c.coid, 'spam')">垃圾</button>
                              <button class="v3a-mini-btn" type="button" style="color: var(--v3a-danger);" @click="deleteComment(c.coid)">删除</button>
                            </td>
                          </tr>
                          <tr v-if="!commentsItems.length">
                            <td colspan="6" class="v3a-muted">暂无评论</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div class="v3a-pagination">
                  <button class="v3a-btn" type="button" @click="commentsGoPage(commentsPagination.page - 1)" :disabled="commentsPagination.page <= 1">上一页</button>
                  <div class="v3a-muted">第 {{ commentsPagination.page }} / {{ commentsPagination.pageCount }} 页 · 共 {{ formatNumber(commentsPagination.total) }} 条</div>
                  <button class="v3a-btn" type="button" @click="commentsGoPage(commentsPagination.page + 1)" :disabled="commentsPagination.page >= commentsPagination.pageCount">下一页</button>
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
                    <button class="v3a-btn primary" type="button" @click="openPageEditor(0)">新建页面</button>
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
                            <div style="display:flex; align-items:center; gap: 8px;">
                              <span :style="{ paddingLeft: (Number(p.levels || 0) * 12) + 'px' }">{{ p.title || ('#' + p.cid) }}</span>
                              <span class="v3a-muted" style="font-size: 12px;">#{{ p.cid }}</span>
                            </div>
                          </td>
                          <td>
                            <span class="v3a-pill" :class="getPageBadge(p).tone">{{ getPageBadge(p).text }}</span>
                          </td>
                          <td class="v3a-muted">{{ p.template || '—' }}</td>
                          <td>{{ formatTime(p.created) }}</td>
                          <td style="white-space: nowrap;">
                            <button class="v3a-mini-btn" type="button" @click="openPageEditor(p.cid)">编辑</button>
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
              <div class="v3a-container">
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
                    <button class="v3a-btn" type="button" @click="navTo('/pages/manage')">返回列表</button>
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

                <div v-else>
                  <div class="v3a-write-shell" :class="{ 'side-open': writeSidebarOpen }">
                    <div class="v3a-write-main">
                      <div class="v3a-card">
                    <div class="hd"><div class="title">内容</div></div>
                    <div class="bd">
                      <label class="v3a-fieldrow" style="min-width: 100%;">
                        <span>标题</span>
                        <input class="v3a-input" v-model="pageForm.title" placeholder="输入标题" />
                      </label>
                      <div class="v3a-divider"></div>
                      <label class="v3a-fieldrow" style="min-width: 100%;">
                        <span>正文</span>
                        <textarea id="v3a-page-text" class="v3a-textarea" v-model="pageForm.text" placeholder="Markdown / 纯文本"></textarea>
                      </label>
                    </div>
                  </div>

                    </div>

                    <div class="v3a-write-side-mask" v-if="writeSidebarOpen" @click="toggleWriteSidebar(false)"></div>
                    <div class="v3a-write-side" :class="{ open: writeSidebarOpen }">
                      <div class="v3a-card">
                    <div class="hd"><div class="title">页面设置</div></div>
                    <div class="bd">
                      <div class="v3a-kv">
                        <div class="v3a-muted">可见性</div>
                        <select class="v3a-select" v-model="pageForm.visibility">
                          <option value="publish">公开</option>
                          <option value="hidden">隐藏</option>
                        </select>

                        <div class="v3a-muted">缩略名</div>
                        <input class="v3a-input" v-model="pageForm.slug" placeholder="可留空（自动生成）" />

                        <div class="v3a-muted">父级页面</div>
                        <select class="v3a-select" v-model.number="pageForm.parent">
                          <option v-for="p in pageParentOptions" :key="p.cid" :value="p.cid">
                            {{ (p.levels ? '—'.repeat(Number(p.levels)) + ' ' : '') + p.title }}
                          </option>
                        </select>

                        <div class="v3a-muted">自定义模板</div>
                        <select class="v3a-select" v-model="pageForm.template">
                          <option value="">默认</option>
                          <option v-for="t in pageTemplates" :key="t.value" :value="t.value">{{ t.label }}</option>
                        </select>

                        <div class="v3a-muted">排序</div>
                        <input class="v3a-input" type="number" v-model.number="pageForm.order" />
                      </div>

                      <div class="v3a-divider"></div>

                      <div class="v3a-muted" style="margin-bottom: 8px;">撰写</div>
                      <div style="display:flex; flex-wrap: wrap; gap: 12px;">
                        <label class="v3a-remember" style="margin: 0;">
                          <input class="v3a-check" type="checkbox" v-model="pageForm.markdown" :disabled="!pageCapabilities.markdownEnabled" />
                          <span>使用 Markdown</span>
                        </label>
                      </div>

                      <div class="v3a-divider"></div>

                      <div class="v3a-muted" style="margin-bottom: 8px;">允许</div>
                      <div style="display:flex; flex-wrap: wrap; gap: 12px;">
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

                  <div class="v3a-divider"></div>
                  <div class="v3a-muted">发布权限：{{ pageCapabilities.canPublish ? '可直接发布' : '无权限' }}</div>
                </div>
              </div>

              </div>
            </div>

            <div class="v3a-card" style="margin-top: 16px;">
                <div class="hd" style="display:flex; align-items:center; justify-content:space-between; gap: 8px;">
                  <div class="title">自定义字段</div>
                  <button class="v3a-mini-btn" type="button" @click="addPageField()">新增字段</button>
                </div>
                <div class="bd">
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
                              <input class="v3a-input" v-model="f.value" :placeholder="f.type === 'json' ? jsonExample : ''" />
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
            </template>

            <template v-else-if="routePath === '/files'">
              <div class="v3a-container">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarCollapsed ? '展开' : '收起'">
                      <span class="v3a-icon" v-html="sidebarCollapsed ? ICONS.expand : ICONS.collapse"></span>
                    </button>
                    <div class="v3a-pagehead-title">{{ crumb }}</div>
                  </div>
                  <div class="v3a-pagehead-actions">
                    <button class="v3a-btn" type="button" @click="applyFilesFilters()" :disabled="filesLoading">刷新</button>
                    <label class="v3a-btn primary" style="display:inline-flex; align-items:center; gap: 8px; cursor: pointer;">
                      <input type="file" multiple style="display:none;" @change="uploadFiles($event.target.files); $event.target.value='';" />
                      <span>上传文件</span>
                    </label>
                  </div>
                </div>

                <div class="v3a-grid">
                  <div class="v3a-card">
                    <div class="hd"><div class="title">上传</div></div>
                    <div class="bd">
                      <div
                        class="v3a-fileitem"
                        style="display:flex; align-items:center; justify-content:space-between; gap: 12px;"
                        @dragover.prevent
                        @drop.prevent="uploadFiles($event.dataTransfer.files)"
                      >
                        <div>
                          <div class="name">拖拽文件到此处</div>
                          <div class="meta">支持图片/媒体/文档（由 Typecho 允许的附件类型决定）</div>
                          <div class="meta" v-if="filesUploading">正在上传…</div>
                        </div>

                        <label class="v3a-mini-btn primary" style="display:inline-flex; align-items:center; cursor:pointer;">
                          <input type="file" multiple style="display:none;" @change="uploadFiles($event.target.files); $event.target.value='';" />
                          选择文件
                        </label>
                      </div>
                    </div>
                  </div>

                  <div class="v3a-card">
                    <div class="hd"><div class="title">文件列表</div></div>
                    <div class="bd">
                      <div class="v3a-toolbar" style="margin-bottom: 12px;">
                        <label class="v3a-fieldrow">
                          <span>关键词</span>
                          <input class="v3a-input" v-model="filesKeywords" @keyup.enter="applyFilesFilters()" placeholder="文件名关键字" />
                        </label>
                        <div class="v3a-fieldrow" style="min-width: 120px;">
                          <span></span>
                          <button class="v3a-btn primary" type="button" @click="applyFilesFilters()">搜索</button>
                        </div>
                      </div>

                      <div v-if="filesLoading" class="v3a-muted">正在加载…</div>

                      <div v-else class="v3a-filegrid">
                        <div class="v3a-fileitem" v-for="f in filesItems" :key="f.cid">
                          <div style="display:flex; gap: 12px; align-items:center;">
                            <div style="width: 48px; height: 48px; border-radius: 10px; overflow:hidden; border: 1px solid rgba(0,0,0,0.06); background:#fafafa; display:flex; align-items:center; justify-content:center; flex: 0 0 auto;">
                              <img v-if="f.file && f.file.isImage && f.file.url" :src="f.file.url" alt="" style="width:100%; height:100%; object-fit:cover;" />
                              <span v-else class="v3a-icon" v-html="ICONS.files"></span>
                            </div>
                            <div style="min-width: 0; flex: 1;">
                              <div class="name" style="margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                {{ f.title || (f.file && f.file.name) || ('附件 #' + f.cid) }}
                              </div>
                              <div class="meta">
                                {{ (f.file && (f.file.mime || f.file.type)) || '—' }} · {{ (f.file && f.file.bytes) || '—' }}
                                <span v-if="f.parent && f.parent.title"> · 归属：{{ f.parent.title }}</span>
                              </div>
                            </div>
                          </div>

                          <div style="display:flex; gap: 8px; flex-wrap:wrap; margin-top: 10px;">
                            <button class="v3a-mini-btn" type="button" @click="copyText(f.file && f.file.url)">复制链接</button>
                            <button class="v3a-mini-btn" type="button" @click="openFile(f.file && f.file.url)">打开</button>
                            <button class="v3a-mini-btn" type="button" style="color: var(--v3a-danger);" @click="deleteFile(f.cid)">删除</button>
                          </div>
                        </div>
                      </div>

                      <div v-if="!filesLoading && !filesItems.length" class="v3a-muted" style="margin-top: 10px;">暂无文件</div>

                      <div style="display:flex; align-items:center; justify-content:flex-end; gap: 8px; margin-top: 12px;">
                        <button class="v3a-btn" type="button" @click="filesGoPage(filesPagination.page - 1)" :disabled="filesPagination.page <= 1">上一页</button>
                        <div class="v3a-muted">第 {{ filesPagination.page }} / {{ filesPagination.pageCount }} 页 · 共 {{ formatNumber(filesPagination.total) }} 条</div>
                        <button class="v3a-btn" type="button" @click="filesGoPage(filesPagination.page + 1)" :disabled="filesPagination.page >= filesPagination.pageCount">下一页</button>
                      </div>
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
                    <button class="v3a-btn" type="button">导出</button>
                    <button class="v3a-btn primary" type="button">刷新</button>
                  </div>
                </div>

                <div class="v3a-grid two">
                  <div class="v3a-card">
                    <div class="hd"><div class="title">访问日志（v3a_visit_log）</div></div>
                    <div class="bd">
                      <table class="v3a-table">
                        <thead><tr><th>IP</th><th>URI</th><th>时间</th></tr></thead>
                        <tbody>
                          <tr v-for="i in 5" :key="i">
                            <td>127.0.0.{{ i }}</td>
                            <td>/</td>
                            <td>—</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div class="v3a-card">
                    <div class="hd"><div class="title">API 日志（v3a_api_log）</div></div>
                    <div class="bd">
                      <table class="v3a-table">
                        <thead><tr><th>方法</th><th>Path</th><th>时间</th></tr></thead>
                        <tbody>
                          <tr v-for="i in 5" :key="i">
                            <td>GET</td>
                            <td>/Vue3Admin/api.php</td>
                            <td>—</td>
                          </tr>
                        </tbody>
                      </table>
                      <div class="v3a-muted" style="margin-top: 10px;">当前已落库记录（仪表盘可见），列表接口待补充。</div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="routePath === '/subscribe'">
              <div class="v3a-container">
                <div class="v3a-pagehead">
                  <div class="v3a-head-left">
                    <button class="v3a-iconbtn v3a-collapse-btn" type="button" @click="toggleSidebar()" :title="sidebarCollapsed ? '展开' : '收起'">
                      <span class="v3a-icon" v-html="sidebarCollapsed ? ICONS.expand : ICONS.collapse"></span>
                    </button>
                    <div class="v3a-pagehead-title">{{ crumb }}</div>
                  </div>
                  <div class="v3a-pagehead-actions">
                    <button class="v3a-btn primary" type="button">新增订阅</button>
                  </div>
                </div>

                <div class="v3a-card">
                  <div class="hd"><div class="title">订阅列表（UI 占位）</div></div>
                  <div class="bd">
                    <table class="v3a-table">
                      <thead><tr><th>Email</th><th>状态</th><th>时间</th><th>操作</th></tr></thead>
                      <tbody>
                        <tr v-for="i in 5" :key="i">
                          <td>user{{ i }}@example.com</td>
                          <td><span class="v3a-pill success">启用</span></td>
                          <td>—</td>
                          <td><span class="v3a-muted">停用</span></td>
                        </tr>
                      </tbody>
                    </table>
                    <div class="v3a-muted" style="margin-top: 10px;">该模块后续将对接 <code>v3a_subscribe</code> 数据表。</div>
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
                    <button class="v3a-btn" type="button">配置</button>
                    <button class="v3a-btn primary" type="button">立即备份</button>
                  </div>
                </div>

                <div class="v3a-grid">
                  <div class="v3a-card">
                    <div class="hd"><div class="title">备份说明</div></div>
                    <div class="bd v3a-muted">
                      备份模块已完成页面骨架：后续将支持数据库备份、文件备份、下载与定时任务。
                    </div>
                  </div>

                  <div class="v3a-card">
                    <div class="hd"><div class="title">备份记录（UI 占位）</div></div>
                    <div class="bd">
                      <table class="v3a-table">
                        <thead><tr><th>文件</th><th>大小</th><th>时间</th><th>操作</th></tr></thead>
                        <tbody>
                          <tr v-for="i in 5" :key="i">
                            <td>backup-{{ i }}.zip</td>
                            <td>—</td>
                            <td>—</td>
                            <td><span class="v3a-muted">下载 / 删除</span></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
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
                    <button class="v3a-btn" type="button" @click="fetchSettings()" :disabled="settingsLoading || settingsSaving">刷新</button>
                  </div>
                </div>

                <div v-if="settingsLoading" class="v3a-muted">正在加载…</div>

                <div v-else class="v3a-grid">
                  <template v-if="settingsActiveKey === 'user'">
                    <div class="v3a-card">
                      <div class="hd"><div class="title">个人资料</div></div>
                      <div class="bd">
                        <div class="v3a-kv">
                          <div class="v3a-muted">昵称</div>
                          <input class="v3a-input" v-model="settingsProfileForm.screenName" placeholder="昵称（screenName）" />
                          <div class="v3a-muted">邮箱</div>
                          <input class="v3a-input" v-model="settingsProfileForm.mail" placeholder="邮箱（mail）" />
                          <div class="v3a-muted">个人主页</div>
                          <input class="v3a-input" v-model="settingsProfileForm.url" placeholder="https://..." />
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap: 8px; margin-top: 12px;">
                          <button class="v3a-btn primary" type="button" @click="saveSettingsProfile()" :disabled="settingsSaving">保存</button>
                        </div>
                      </div>
                    </div>

                    <div class="v3a-card">
                      <div class="hd"><div class="title">撰写设置</div></div>
                      <div class="bd">
                        <div class="v3a-kv">
                          <div class="v3a-muted">使用 Markdown</div>
                          <select class="v3a-select" v-model.number="settingsUserOptionsForm.markdown">
                            <option :value="1">开启</option>
                            <option :value="0">关闭</option>
                          </select>

                          <div class="v3a-muted">XMLRPC Markdown</div>
                          <select class="v3a-select" v-model.number="settingsUserOptionsForm.xmlrpcMarkdown">
                            <option :value="1">开启</option>
                            <option :value="0">关闭</option>
                          </select>

                          <div class="v3a-muted">自动保存</div>
                          <select class="v3a-select" v-model.number="settingsUserOptionsForm.autoSave">
                            <option :value="1">开启</option>
                            <option :value="0">关闭</option>
                          </select>

                          <div class="v3a-muted">默认允许</div>
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

                        <div style="display:flex; justify-content:flex-end; gap: 8px; margin-top: 12px;">
                          <button class="v3a-btn primary" type="button" @click="saveSettingsUserOptions()" :disabled="settingsSaving">保存</button>
                        </div>
                      </div>
                    </div>
                  </template>

                  <template v-else-if="settingsActiveKey === 'security'">
                    <div class="v3a-card">
                      <div class="hd"><div class="title">修改密码</div></div>
                      <div class="bd">
                        <div class="v3a-kv">
                          <div class="v3a-muted">新密码</div>
                          <input class="v3a-input" type="password" v-model="settingsPasswordForm.password" placeholder="至少 6 位" />
                          <div class="v3a-muted">确认密码</div>
                          <input class="v3a-input" type="password" v-model="settingsPasswordForm.confirm" placeholder="再次输入" />
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap: 8px; margin-top: 12px;">
                          <button class="v3a-btn primary" type="button" @click="saveSettingsPassword()" :disabled="settingsSaving">更新密码</button>
                        </div>
                      </div>
                    </div>
                  </template>

                  <template v-else-if="settingsActiveKey === 'site'">
                    <div v-if="!settingsData.isAdmin" class="v3a-card">
                      <div class="bd v3a-muted">需要管理员权限才能修改站点设置。</div>
                    </div>
                    <div v-else class="v3a-card">
                      <div class="hd"><div class="title">网站设置</div></div>
                      <div class="bd">
                        <div class="v3a-kv">
                          <div class="v3a-muted">站点地址</div>
                          <input class="v3a-input" v-model="settingsSiteForm.siteUrl" :disabled="settingsData.site.siteUrlLocked" placeholder="https://example.com" />
                          <div class="v3a-muted">站点名称</div>
                          <input class="v3a-input" v-model="settingsSiteForm.title" placeholder="title" />
                          <div class="v3a-muted">站点描述</div>
                          <input class="v3a-input" v-model="settingsSiteForm.description" placeholder="description" />
                          <div class="v3a-muted">关键词</div>
                          <input class="v3a-input" v-model="settingsSiteForm.keywords" placeholder="用逗号分隔" />
                          <div class="v3a-muted">允许注册</div>
                          <select class="v3a-select" v-model.number="settingsSiteForm.allowRegister">
                            <option :value="0">不允许</option>
                            <option :value="1">允许</option>
                          </select>
                          <div class="v3a-muted">XMLRPC</div>
                          <select class="v3a-select" v-model.number="settingsSiteForm.allowXmlRpc">
                            <option :value="0">关闭</option>
                            <option :value="1">仅关闭 Pingback</option>
                            <option :value="2">开启</option>
                          </select>
                          <div class="v3a-muted">语言</div>
                          <select class="v3a-select" v-model="settingsSiteForm.lang">
                            <option v-for="l in settingsData.lists.langs" :key="l.value" :value="l.value">{{ l.label }}</option>
                          </select>
                          <div class="v3a-muted">时区（秒）</div>
                          <input class="v3a-input" type="number" v-model.number="settingsSiteForm.timezone" />
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap: 8px; margin-top: 12px;">
                          <button class="v3a-btn primary" type="button" @click="saveSettingsSite()" :disabled="settingsSaving">保存</button>
                        </div>
                      </div>
                    </div>
                  </template>

                  <template v-else-if="settingsActiveKey === 'storage'">
                    <div v-if="!settingsData.isAdmin" class="v3a-card">
                      <div class="bd v3a-muted">需要管理员权限才能修改附件设置。</div>
                    </div>
                    <div v-else class="v3a-card">
                      <div class="hd"><div class="title">附件类型</div></div>
                      <div class="bd">
                        <div class="v3a-muted" style="margin-bottom: 10px;">勾选允许上传的类型（与旧后台一致）。</div>
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

                        <div class="v3a-divider"></div>

                        <div class="v3a-kv" v-if="(settingsStorageForm.attachmentTypes || []).includes('@other@')">
                          <div class="v3a-muted">其他格式（逗号分隔）</div>
                          <input class="v3a-input" v-model="settingsStorageForm.attachmentTypesOther" placeholder="zip, rar, pdf" />
                        </div>

                        <div style="display:flex; justify-content:flex-end; gap: 8px; margin-top: 12px;">
                          <button class="v3a-btn primary" type="button" @click="saveSettingsStorage()" :disabled="settingsSaving">保存</button>
                        </div>
                      </div>
                    </div>
                  </template>

                  <template v-else-if="settingsActiveKey === 'content'">
                    <div v-if="!settingsData.isAdmin" class="v3a-card">
                      <div class="bd v3a-muted">需要管理员权限才能修改阅读设置。</div>
                    </div>
                    <div v-else class="v3a-card">
                      <div class="hd"><div class="title">阅读设置</div></div>
                      <div class="bd">
                        <div class="v3a-kv">
                          <div class="v3a-muted">文章日期格式</div>
                          <input class="v3a-input" v-model="settingsReadingForm.postDateFormat" placeholder="Y-m-d" />
                          <div class="v3a-muted">首页显示</div>
                          <select class="v3a-select" v-model="settingsReadingForm.frontPageType">
                            <option value="recent">最新文章</option>
                            <option value="page">指定页面</option>
                            <option value="file">主题文件</option>
                          </select>
                          <template v-if="settingsReadingForm.frontPageType === 'page'">
                            <div class="v3a-muted">首页页面</div>
                            <select class="v3a-select" v-model.number="settingsReadingForm.frontPagePage">
                              <option :value="0">请选择</option>
                              <option v-for="p in settingsData.lists.frontPagePages" :key="p.cid" :value="p.cid">{{ p.title }}</option>
                            </select>
                          </template>
                          <template v-else-if="settingsReadingForm.frontPageType === 'file'">
                            <div class="v3a-muted">首页文件</div>
                            <select class="v3a-select" v-model="settingsReadingForm.frontPageFile">
                              <option value="">请选择</option>
                              <option v-for="f in settingsData.lists.frontPageFiles" :key="f" :value="f">{{ f }}</option>
                            </select>
                          </template>
                          <div class="v3a-muted">每页文章数</div>
                          <input class="v3a-input" type="number" v-model.number="settingsReadingForm.pageSize" />
                          <div class="v3a-muted">侧边栏文章列表数</div>
                          <input class="v3a-input" type="number" v-model.number="settingsReadingForm.postsListSize" />
                          <div class="v3a-muted">Feed 输出全文</div>
                          <select class="v3a-select" v-model.number="settingsReadingForm.feedFullText">
                            <option :value="0">关闭</option>
                            <option :value="1">开启</option>
                          </select>
                          <div class="v3a-muted">首页非最新时启用归档页</div>
                          <select class="v3a-select" v-model.number="settingsReadingForm.frontArchive">
                            <option :value="0">关闭</option>
                            <option :value="1">开启</option>
                          </select>
                          <div class="v3a-muted" v-if="settingsReadingForm.frontArchive">归档页路径（如：/blog/）</div>
                          <input v-if="settingsReadingForm.frontArchive" class="v3a-input" v-model="settingsReadingForm.archivePattern" placeholder="/archive/" />
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap: 8px; margin-top: 12px;">
                          <button class="v3a-btn primary" type="button" @click="saveSettingsReading()" :disabled="settingsSaving">保存</button>
                        </div>
                      </div>
                    </div>
                  </template>

                  <template v-else-if="settingsActiveKey === 'notify'">
                    <div v-if="!settingsData.isAdmin" class="v3a-card">
                      <div class="bd v3a-muted">需要管理员权限才能修改评论设置。</div>
                    </div>
                    <div v-else class="v3a-card">
                      <div class="hd"><div class="title">评论设置</div></div>
                      <div class="bd">
                        <div class="v3a-kv">
                          <div class="v3a-muted">评论日期格式</div>
                          <input class="v3a-input" v-model="settingsDiscussionForm.commentDateFormat" placeholder="Y-m-d H:i" />
                          <div class="v3a-muted">侧边栏评论列表数</div>
                          <input class="v3a-input" type="number" v-model.number="settingsDiscussionForm.commentsListSize" />
                          <div class="v3a-muted">评论中使用 Markdown</div>
                          <select class="v3a-select" v-model.number="settingsDiscussionForm.commentsMarkdown">
                            <option :value="0">关闭</option>
                            <option :value="1">开启</option>
                          </select>
                          <div class="v3a-muted">评论分页</div>
                          <select class="v3a-select" v-model.number="settingsDiscussionForm.commentsPageBreak">
                            <option :value="0">关闭</option>
                            <option :value="1">开启</option>
                          </select>
                          <div class="v3a-muted" v-if="settingsDiscussionForm.commentsPageBreak">每页评论数</div>
                          <input v-if="settingsDiscussionForm.commentsPageBreak" class="v3a-input" type="number" v-model.number="settingsDiscussionForm.commentsPageSize" />
                          <div class="v3a-muted">评论排序</div>
                          <select class="v3a-select" v-model="settingsDiscussionForm.commentsOrder">
                            <option value="DESC">较新在前</option>
                            <option value="ASC">较旧在前</option>
                          </select>
                          <div class="v3a-muted">所有评论必须审核</div>
                          <select class="v3a-select" v-model.number="settingsDiscussionForm.commentsRequireModeration">
                            <option :value="0">关闭</option>
                            <option :value="1">开启</option>
                          </select>
                          <div class="v3a-muted">必须填写邮箱</div>
                          <select class="v3a-select" v-model.number="settingsDiscussionForm.commentsRequireMail">
                            <option :value="0">否</option>
                            <option :value="1">是</option>
                          </select>
                          <div class="v3a-muted">必须填写网址</div>
                          <select class="v3a-select" v-model.number="settingsDiscussionForm.commentsRequireUrl">
                            <option :value="0">否</option>
                            <option :value="1">是</option>
                          </select>
                          <div class="v3a-muted">反垃圾保护</div>
                          <select class="v3a-select" v-model.number="settingsDiscussionForm.commentsAntiSpam">
                            <option :value="0">关闭</option>
                            <option :value="1">开启</option>
                          </select>
                          <div class="v3a-muted">发布后自动关闭评论（天）</div>
                          <input class="v3a-input" type="number" v-model.number="settingsDiscussionForm.commentsPostTimeoutDays" />
                          <div class="v3a-muted">同 IP 评论间隔限制</div>
                          <select class="v3a-select" v-model.number="settingsDiscussionForm.commentsPostIntervalEnable">
                            <option :value="0">关闭</option>
                            <option :value="1">开启</option>
                          </select>
                          <div class="v3a-muted" v-if="settingsDiscussionForm.commentsPostIntervalEnable">间隔（分钟）</div>
                          <input v-if="settingsDiscussionForm.commentsPostIntervalEnable" class="v3a-input" type="number" step="0.1" v-model.number="settingsDiscussionForm.commentsPostIntervalMins" />
                          <div class="v3a-muted">允许 HTML 标签</div>
                          <textarea class="v3a-textarea" v-model="settingsDiscussionForm.commentsHTMLTagAllowed" placeholder="<a href> <img src>"></textarea>
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap: 8px; margin-top: 12px;">
                          <button class="v3a-btn primary" type="button" @click="saveSettingsDiscussion()" :disabled="settingsSaving">保存</button>
                        </div>
                      </div>
                    </div>
                  </template>

                  <template v-else-if="settingsActiveKey === 'system'">
                    <div v-if="!settingsData.isAdmin" class="v3a-card">
                      <div class="bd v3a-muted">需要管理员权限才能修改链接设置。</div>
                    </div>
                    <div v-else class="v3a-card">
                      <div class="hd"><div class="title">链接设置（Permalink）</div></div>
                      <div class="bd">
                        <div class="v3a-kv">
                          <div class="v3a-muted">Rewrite（地址重写）</div>
                          <select class="v3a-select" v-model.number="settingsPermalinkForm.rewrite" :disabled="settingsData.permalink.rewriteLocked">
                            <option :value="0">不启用</option>
                            <option :value="1">启用</option>
                          </select>
                          <div class="v3a-muted">文章链接规则</div>
                          <div v-if="settingsPermalinkRewriteError && settingsPermalinkForm.rewrite" class="v3a-permalink-rewrite-hint">
                            <div class="v3a-feedback">{{ settingsPermalinkRewriteError }}</div>
                            <label class="v3a-remember v3a-permalink-rewrite-anyway" style="margin: 0;">
                              <input class="v3a-check" type="checkbox" v-model="settingsPermalinkEnableRewriteAnyway" :true-value="1" :false-value="0" />
                              <span>仍然启用</span>
                            </label>
                          </div>
                          <div class="v3a-permalink-options">
                            <label v-for="opt in permalinkPostPatternOptions" :key="opt.value" class="v3a-permalink-option">
                              <input class="v3a-radio" type="radio" name="v3a-postpattern" :value="opt.value" v-model="settingsPermalinkForm.postPattern" />
                              <span class="v3a-permalink-option-text">
                                {{ opt.label }}
                                <code v-if="opt.example">{{ opt.example }}</code>
                                <template v-if="opt.value === 'custom'">
                                  <input class="v3a-input v3a-permalink-custom" v-model="settingsPermalinkForm.customPattern" :disabled="settingsPermalinkForm.postPattern !== 'custom'" placeholder="输入个性化定义..." />
                                </template>
                              </span>
                            </label>
                          </div>
                          <div class="v3a-muted">页面链接规则</div>
                          <input class="v3a-input" v-model="settingsPermalinkForm.pagePattern" placeholder="/{slug}.html" />
                          <div class="v3a-muted">分类链接规则</div>
                          <input class="v3a-input" v-model="settingsPermalinkForm.categoryPattern" placeholder="/category/{slug}/" />
                        </div>
                        <div class="v3a-divider"></div>
                        <div class="v3a-muted">占位符：{cid} {slug} {category} {directory} {year} {month} {day} {mid}</div>
                        <div style="display:flex; justify-content:flex-end; gap: 8px; margin-top: 12px;">
                          <button class="v3a-btn primary" type="button" @click="saveSettingsPermalink()" :disabled="settingsSaving">保存</button>
                        </div>
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
