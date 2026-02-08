import searchIndexUrl from "./generated/search-index.json?url";

const THEME_STORAGE_KEY = "usconstitution-theme";
const FONT_SCALE_STORAGE_KEY = "usconstitution-font-scale";
const ENTRY_HEADERS_STORAGE_KEY = "usconstitution-show-entry-headers";
const DRAWER_MODE_QUERY = "(max-width: 1080px)";
const FONT_SCALE_DEFAULT = 1;
const FONT_SCALE_MIN = 0.85;
const FONT_SCALE_MAX = 1.35;
const FONT_SCALE_STEP = 0.05;

const DEFAULTS = {
  q: "",
  part: "all",
  article: "all",
  amendment: "all",
  status: "all"
};

function getStoredThemePreference() {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }
  } catch (error) {
    console.warn(error);
  }
  return "system";
}

function resolveTheme(preference) {
  if (preference === "light" || preference === "dark") {
    return preference;
  }
  const prefersDark = window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

function applyThemePreference(preference, persist) {
  const nextPreference =
    preference === "light" || preference === "dark" || preference === "system"
      ? preference
      : "system";
  const effectiveTheme = resolveTheme(nextPreference);
  document.documentElement.setAttribute("data-theme", effectiveTheme);
  document.documentElement.setAttribute("data-theme-preference", nextPreference);

  if (persist) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
    } catch (error) {
      console.warn(error);
    }
  }
}

function initializeThemeSwitch() {
  const themeSelect = document.getElementById("theme-select");
  if (!themeSelect) {
    return;
  }

  const storedPreference = getStoredThemePreference();
  themeSelect.value = storedPreference;
  applyThemePreference(storedPreference, false);

  themeSelect.addEventListener("change", () => {
    applyThemePreference(themeSelect.value, true);
  });

  if (window.matchMedia) {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", () => {
      const currentPreference =
        document.documentElement.getAttribute("data-theme-preference") || "system";
      if (currentPreference === "system") {
        applyThemePreference("system", false);
      }
    });
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getStoredFontScale() {
  try {
    const raw = Number(window.localStorage.getItem(FONT_SCALE_STORAGE_KEY));
    if (!Number.isNaN(raw)) {
      return clamp(raw, FONT_SCALE_MIN, FONT_SCALE_MAX);
    }
  } catch (error) {
    console.warn(error);
  }
  return FONT_SCALE_DEFAULT;
}

function setStoredFontScale(value) {
  try {
    window.localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(value));
  } catch (error) {
    console.warn(error);
  }
}

function applyFontScale(value) {
  const safeValue = clamp(value, FONT_SCALE_MIN, FONT_SCALE_MAX);
  document.documentElement.style.setProperty("--reader-font-scale", safeValue.toFixed(2));
}

function getStoredEntryHeadersVisible() {
  try {
    const raw = window.localStorage.getItem(ENTRY_HEADERS_STORAGE_KEY);
    if (raw === "false") {
      return false;
    }
  } catch (error) {
    console.warn(error);
  }
  return true;
}

function setStoredEntryHeadersVisible(isVisible) {
  try {
    window.localStorage.setItem(ENTRY_HEADERS_STORAGE_KEY, String(Boolean(isVisible)));
  } catch (error) {
    console.warn(error);
  }
}

function applyEntryHeadersVisible(isVisible) {
  document.documentElement.classList.toggle("hide-entry-headers", !isVisible);
}

function initializeViewControls() {
  const decreaseBtn = document.getElementById("font-size-decrease");
  const increaseBtn = document.getElementById("font-size-increase");
  const sizeOutput = document.getElementById("font-size-value");
  const headersToggle = document.getElementById("toggle-entry-headers");

  if (!decreaseBtn || !increaseBtn || !sizeOutput || !headersToggle) {
    return;
  }

  let fontScale = getStoredFontScale();
  let showHeaders = getStoredEntryHeadersVisible();

  const render = () => {
    applyFontScale(fontScale);
    applyEntryHeadersVisible(showHeaders);
    sizeOutput.textContent = `${Math.round(fontScale * 100)}%`;
    headersToggle.checked = showHeaders;
    decreaseBtn.disabled = fontScale <= FONT_SCALE_MIN;
    increaseBtn.disabled = fontScale >= FONT_SCALE_MAX;
  };

  decreaseBtn.addEventListener("click", () => {
    fontScale = clamp(fontScale - FONT_SCALE_STEP, FONT_SCALE_MIN, FONT_SCALE_MAX);
    setStoredFontScale(fontScale);
    render();
  });

  increaseBtn.addEventListener("click", () => {
    fontScale = clamp(fontScale + FONT_SCALE_STEP, FONT_SCALE_MIN, FONT_SCALE_MAX);
    setStoredFontScale(fontScale);
    render();
  });

  headersToggle.addEventListener("change", () => {
    showHeaders = headersToggle.checked;
    setStoredEntryHeadersVisible(showHeaders);
    applyEntryHeadersVisible(showHeaders);
  });

  render();
}

function toInt(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function makeFallbackIndex(entryElements) {
  return entryElements.map((element) => {
    const id = element.dataset.entryId || "";
    const part = element.dataset.part || "article";
    const article = toInt(element.dataset.article);
    const amendmentNumber = toInt(element.dataset.amendment);
    const isRepealed = element.dataset.repealed === "true";
    const searchable = element.textContent ? element.textContent.toLowerCase() : "";
    return {
      id,
      part,
      type: part,
      article,
      section: null,
      clause: null,
      subclause: null,
      amendmentNumber,
      isRepealed,
      searchable
    };
  });
}

async function loadIndex(entryElements) {
  try {
    const response = await fetch(searchIndexUrl, { credentials: "same-origin" });
    if (!response.ok) {
      throw new Error(`Failed to fetch search index: ${response.status}`);
    }
    const json = await response.json();
    if (!Array.isArray(json)) {
      throw new Error("Search index payload is not an array.");
    }
    return json;
  } catch (error) {
    console.warn(error);
    return makeFallbackIndex(entryElements);
  }
}

function sanitizeState(raw, articleValues, amendmentValues) {
  const next = { ...DEFAULTS, ...raw };

  const allowedParts = new Set(["all", "preamble", "article", "amendment"]);
  if (!allowedParts.has(next.part)) {
    next.part = DEFAULTS.part;
  }

  const allowedStatus = new Set(["all", "active", "repealed"]);
  if (!allowedStatus.has(next.status)) {
    next.status = DEFAULTS.status;
  }

  if (!articleValues.has(next.article)) {
    next.article = DEFAULTS.article;
  }
  if (!amendmentValues.has(next.amendment)) {
    next.amendment = DEFAULTS.amendment;
  }

  next.q = (next.q || "").trim();
  return next;
}

function getStateFromParams(articleValues, amendmentValues) {
  const params = new URLSearchParams(window.location.search);
  return sanitizeState(
    {
      q: params.get("q") || "",
      part: params.get("part") || DEFAULTS.part,
      article: params.get("article") || DEFAULTS.article,
      amendment: params.get("amendment") || DEFAULTS.amendment,
      status: params.get("status") || DEFAULTS.status
    },
    articleValues,
    amendmentValues
  );
}

function applyStateToControls(controls, state) {
  controls.search.value = state.q;
  controls.part.value = state.part;
  controls.article.value = state.article;
  controls.amendment.value = state.amendment;
  controls.status.value = state.status;
}

function buildActiveFilterSummary(state) {
  const parts = [];
  if (state.q) {
    parts.push(`Search "${state.q}"`);
  }
  if (state.part !== "all") {
    parts.push(`Part: ${state.part}`);
  }
  if (state.article !== "all") {
    parts.push(`Article: ${state.article}`);
  }
  if (state.amendment !== "all") {
    parts.push(`Amendment: ${state.amendment}`);
  }
  if (state.status !== "all") {
    parts.push(`Status: ${state.status}`);
  }

  return parts.length > 0 ? parts.join(" | ") : "No active filters.";
}

function writeStateToUrl(state) {
  const params = new URLSearchParams();
  if (state.q) {
    params.set("q", state.q);
  }
  if (state.part !== "all") {
    params.set("part", state.part);
  }
  if (state.article !== "all") {
    params.set("article", state.article);
  }
  if (state.amendment !== "all") {
    params.set("amendment", state.amendment);
  }
  if (state.status !== "all") {
    params.set("status", state.status);
  }
  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash || ""}`;
  window.history.replaceState({}, "", nextUrl);
}

function updateSelectOptions(select, values, labelPrefix) {
  const oldValue = select.value;
  while (select.options.length > 1) {
    select.remove(1);
  }
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `${labelPrefix} ${value}`;
    select.append(option);
  }
  select.value = oldValue;
}

function matchesEntry(entry, state) {
  if (state.part !== "all" && entry.part !== state.part) {
    return false;
  }

  if (state.article !== "all") {
    const articleNumber = Number(state.article);
    if (entry.article !== articleNumber) {
      return false;
    }
  }

  if (state.amendment !== "all") {
    const amendmentNumber = Number(state.amendment);
    if (entry.amendmentNumber !== amendmentNumber) {
      return false;
    }
  }

  if (state.status === "active" && entry.isRepealed) {
    return false;
  }

  if (state.status === "repealed" && !entry.isRepealed) {
    return false;
  }

  if (state.q && !entry.searchable.includes(state.q.toLowerCase())) {
    return false;
  }

  return true;
}

function scrollToTargetId(targetId, updateHash) {
  if (!targetId) {
    return;
  }
  const target = document.getElementById(targetId);
  if (!target) {
    return;
  }

  if (updateHash) {
    const nextUrl = `${window.location.pathname}${window.location.search}#${targetId}`;
    window.history.pushState({}, "", nextUrl);
  }

  target.scrollIntoView({ block: "start", behavior: "smooth" });

  if (!target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
  }
  target.focus({ preventScroll: true });
}

async function copyTextToClipboard(value) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    await navigator.clipboard.writeText(value);
    return true;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch (error) {
    copied = false;
  }
  textarea.remove();
  return copied;
}

function getAbsoluteAnchorUrl(anchorId) {
  return `${window.location.origin}${window.location.pathname}${window.location.search}#${anchorId}`;
}

function flashButtonLabel(button, text) {
  const originalText = button.dataset.originalText || button.textContent || "";
  button.dataset.originalText = originalText;
  button.textContent = text;
  window.setTimeout(() => {
    button.textContent = originalText;
  }, 1200);
}

function isVisuallyHidden(element) {
  return element.classList.contains("is-hidden");
}

function isDefaultState(state) {
  return (
    state.q === DEFAULTS.q &&
    state.part === DEFAULTS.part &&
    state.article === DEFAULTS.article &&
    state.amendment === DEFAULTS.amendment &&
    state.status === DEFAULTS.status
  );
}

function headingHasVisibleEntries(heading, visibleEntries) {
  const headingId = heading.id || "";

  if (headingId === "part-preamble") {
    return visibleEntries.some((entry) => entry.part === "preamble");
  }
  if (headingId === "part-articles") {
    return visibleEntries.some((entry) => entry.part === "article");
  }
  if (headingId === "part-amendments") {
    return visibleEntries.some((entry) => entry.part === "amendment");
  }

  const articleMatch = /^part-article-(\d+)$/.exec(headingId);
  if (articleMatch) {
    const articleNumber = Number(articleMatch[1]);
    return visibleEntries.some(
      (entry) => entry.part === "article" && entry.article === articleNumber
    );
  }

  const amendmentMatch = /^part-amendment-(\d+)$/.exec(headingId);
  if (amendmentMatch) {
    const amendmentNumber = Number(amendmentMatch[1]);
    return visibleEntries.some(
      (entry) =>
        entry.part === "amendment" && entry.amendmentNumber === amendmentNumber
    );
  }

  return true;
}

function initialize() {
  document.documentElement.classList.add("js");
  initializeThemeSwitch();
  initializeViewControls();

  const entryElements = Array.from(document.querySelectorAll(".entry[data-entry-id]"));
  if (entryElements.length === 0) {
    return;
  }

  const controls = {
    search: document.getElementById("search-input"),
    part: document.getElementById("part-filter"),
    article: document.getElementById("article-filter"),
    amendment: document.getElementById("amendment-filter"),
    status: document.getElementById("status-filter"),
    reset: document.getElementById("reset-filters")
  };
  const sidebarPanel = document.getElementById("sidebar-panel");
  const controlsDisclosure = sidebarPanel
    ? sidebarPanel.querySelector(".controls-disclosure")
    : null;
  const drawerToggle = document.getElementById("mobile-search-toggle");
  const sidebarBackdrop = document.getElementById("sidebar-backdrop");
  const drawerMedia = window.matchMedia ? window.matchMedia(DRAWER_MODE_QUERY) : null;

  let getFilterState = null;
  let resetFiltersAndApply = null;

  function isDrawerMode() {
    return Boolean(drawerMedia && drawerMedia.matches);
  }

  function setControlsDisclosureDefault() {
    if (!controlsDisclosure) {
      return;
    }
    controlsDisclosure.open = isDrawerMode();
  }

  function setSearchTriggerVisible(visible) {
    const shouldShow = visible && isDrawerMode();
    document.body.classList.toggle("show-mobile-search-trigger", shouldShow);
  }

  function setSidebarOpen(open) {
    const shouldOpen = Boolean(open && isDrawerMode() && sidebarPanel);
    document.body.classList.toggle("sidebar-open", shouldOpen);
    document.body.classList.toggle("no-scroll", shouldOpen);

    if (drawerToggle) {
      drawerToggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
      drawerToggle.setAttribute(
        "aria-label",
        shouldOpen ? "Close search and filters" : "Open search and filters"
      );
    }

    if (sidebarBackdrop) {
      sidebarBackdrop.hidden = !shouldOpen;
    }

    if (shouldOpen) {
      setSearchTriggerVisible(true);
    }
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

  function handleDrawerViewportChange() {
    setSidebarOpen(false);
    setControlsDisclosureDefault();

    if (!isDrawerMode()) {
      closeSidebar();
      setSearchTriggerVisible(false);
      return;
    }

    setSearchTriggerVisible(true);
  }

  if (drawerToggle) {
    drawerToggle.addEventListener("click", () => {
      const nextOpenState = !document.body.classList.contains("sidebar-open");
      setSidebarOpen(nextOpenState);
    });
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener("click", closeSidebar);
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("sidebar-open")) {
      closeSidebar();
    }
  });

  if (drawerMedia) {
    if (typeof drawerMedia.addEventListener === "function") {
      drawerMedia.addEventListener("change", handleDrawerViewportChange);
    } else if (typeof drawerMedia.addListener === "function") {
      drawerMedia.addListener(handleDrawerViewportChange);
    }
  }
  handleDrawerViewportChange();

  document.addEventListener("click", (event) => {
    const copyButton = event.target instanceof Element
      ? event.target.closest(".copy-anchor-button")
      : null;
    if (!copyButton) {
      return;
    }

    event.preventDefault();
    const anchorId = copyButton.getAttribute("data-anchor-id");
    if (!anchorId) {
      return;
    }

    const absoluteUrl = getAbsoluteAnchorUrl(anchorId);
    copyTextToClipboard(absoluteUrl)
      .then((copied) => {
        flashButtonLabel(copyButton, copied ? "Copied" : "Failed");
      })
      .catch(() => {
        flashButtonLabel(copyButton, "Failed");
      });
  });

  document.addEventListener("click", (event) => {
    const anchor = event.target instanceof Element
      ? event.target.closest('a[href^="#"]')
      : null;
    if (!anchor) {
      return;
    }

    const href = anchor.getAttribute("href") || "";
    const targetId = href.slice(1);
    if (!targetId) {
      return;
    }

    const targetElement = document.getElementById(targetId);
    if (!targetElement) {
      return;
    }

    const isTocLink = Boolean(anchor.closest(".toc"));
    const currentlyFilteredOut = isVisuallyHidden(targetElement);
    const hasActiveFilters = getFilterState ? !isDefaultState(getFilterState()) : false;

    event.preventDefault();

    if (resetFiltersAndApply && (currentlyFilteredOut || (isTocLink && hasActiveFilters))) {
      resetFiltersAndApply();
    }

    scrollToTargetId(targetId, true);
    if (isTocLink && isDrawerMode()) {
      closeSidebar();
    }
  });

  window.addEventListener("hashchange", () => {
    const targetId = window.location.hash.replace(/^#/, "");
    scrollToTargetId(targetId, false);
  });

  if (window.location.hash) {
    const initialTarget = window.location.hash.replace(/^#/, "");
    setTimeout(() => scrollToTargetId(initialTarget, false), 0);
  }

  const resultsCount = document.getElementById("results-count");
  const activeFilters = document.getElementById("active-filters");
  const sectionHeadings = Array.from(
    document.querySelectorAll(".major-part-heading, .part-heading")
  );

  loadIndex(entryElements).then((searchIndex) => {
    const indexById = new Map(searchIndex.map((entry) => [entry.id, entry]));

    const articleValues = new Set(["all"]);
    const amendmentValues = new Set(["all"]);
    for (const entry of searchIndex) {
      if (typeof entry.article === "number") {
        articleValues.add(String(entry.article));
      }
      if (typeof entry.amendmentNumber === "number") {
        amendmentValues.add(String(entry.amendmentNumber));
      }
    }

    updateSelectOptions(
      controls.article,
      [...articleValues].filter((value) => value !== "all").sort((a, b) => Number(a) - Number(b)),
      "Article"
    );
    updateSelectOptions(
      controls.amendment,
      [...amendmentValues].filter((value) => value !== "all").sort((a, b) => Number(a) - Number(b)),
      "Amendment"
    );

    let state = getStateFromParams(articleValues, amendmentValues);
    applyStateToControls(controls, state);

    const apply = () => {
      state = sanitizeState(
        {
          q: controls.search.value,
          part: controls.part.value,
          article: controls.article.value,
          amendment: controls.amendment.value,
          status: controls.status.value
        },
        articleValues,
        amendmentValues
      );

      let visibleCount = 0;
      const visibleEntries = [];
      for (const element of entryElements) {
        const entryId = element.dataset.entryId || "";
        const entry = indexById.get(entryId);
        if (!entry) {
          element.classList.add("is-hidden");
          continue;
        }

        const visible = matchesEntry(entry, state);
        element.classList.toggle("is-hidden", !visible);
        element.setAttribute("aria-hidden", visible ? "false" : "true");
        if (visible) {
          visibleCount += 1;
          visibleEntries.push(entry);
        }
      }

      for (const heading of sectionHeadings) {
        const hasMatches = headingHasVisibleEntries(heading, visibleEntries);
        heading.classList.toggle("is-hidden", !hasMatches);
      }

      if (resultsCount) {
        resultsCount.textContent = `Showing ${visibleCount} of ${entryElements.length} entries.`;
      }
      if (activeFilters) {
        activeFilters.textContent = buildActiveFilterSummary(state);
      }

      writeStateToUrl(state);
    };

    getFilterState = () => ({ ...state });
    resetFiltersAndApply = () => {
      state = { ...DEFAULTS };
      applyStateToControls(controls, state);
      apply();
    };

    controls.search.addEventListener("input", apply);
    controls.part.addEventListener("change", apply);
    controls.article.addEventListener("change", apply);
    controls.amendment.addEventListener("change", apply);
    controls.status.addEventListener("change", apply);
    controls.reset.addEventListener("click", () => {
      resetFiltersAndApply();
    });

    apply();
  });
}

initialize();
