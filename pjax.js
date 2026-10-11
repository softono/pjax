/**
 * @typedef {Object} Pjax
 * @property {jQuery} $mainContainer - jQuery reference to main container
 * @property {Object} cacheStorage - Cached pages for faster navigation
 * @description Client-side pjax implementation for handling SPA navigation and partial page loads
 */

const pjax = {
  /** @type {jQuery} jQuery reference to main container */
  $mainContainer: null,
  loaderClass: "loading-text",
  cacheEnabled: true,
  cacheStorage: {},
  maxCacheKeys: 100, // Maximum number of pages to cache to prevent memory leaks
  /** @type {?jqXHR} In-flight page request, aborted when a newer navigation starts */
  currentRequest: null,
  /** @type {string} URL (without hash) of the page currently displayed */
  currentUrl: "",
  onPageLoaded: function (url) { },
  onLinkClick: function (target, href) { },

  /**
   * Encode a key to Base64 format safely (supports Unicode).
   */
  encodeCacheKey(key) {
    const baseHref = $("base").attr("href") || "";
    const normalizedKey = key.replace(baseHref, "");
    return btoa(encodeURIComponent(normalizedKey));
  },

  /**
   * Save string value in cache
   */
  setCache(key, value) {
    if (!this.cacheEnabled) return false;
    const cacheKey = `cache_${this.encodeCacheKey(key)}`;

    // Re-inserting moves the entry to the end, so eviction below drops the least recently stored page
    delete this.cacheStorage[cacheKey];

    // Simple cleanup to prevent unbounded memory growth
    const keys = Object.keys(this.cacheStorage);
    if (keys.length >= this.maxCacheKeys) {
      delete this.cacheStorage[keys[0]];
    }

    this.cacheStorage[cacheKey] = value;
  },

  /**
   * Save JSON data in cache
   */
  setCacheData(key, data) {
    if (!this.cacheEnabled) return false;
    this.setCache(key, JSON.stringify(data));
  },

  /**
   * Retrieve string data from cache
   */
  getCache(key) {
    if (!this.cacheEnabled) return false;
    return this.cacheStorage[`cache_${this.encodeCacheKey(key)}`] || null;
  },

  /**
   * Retrieve JSON data from cache
   */
  getCacheData(key) {
    if (!this.cacheEnabled) return false;
    const cachedData = this.getCache(key);
    try {
      return cachedData ? JSON.parse(cachedData) : null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Remove specific item from cache
   */
  removeCache(key) {
    if (!this.cacheEnabled) return false;
    delete this.cacheStorage[`cache_${this.encodeCacheKey(key)}`];
  },

  /**
   * Clear all cached data
   */
  clearCache() {
    this.cacheStorage = {};
  },

  /**
   * Remove the #fragment from a URL.
   * @param {string} url
   * @returns {string}
   */
  stripHash(url) {
    const hashIndex = url.indexOf("#");
    return hashIndex === -1 ? url : url.slice(0, hashIndex);
  },

  /**
   * Build the URL used to request the partial version of a page.
   * @param {string} url - Page URL
   * @returns {string}
   */
  buildPartialUrl(url) {
    const base = this.stripHash(url);
    const params = ["pjax=true"];
    const layout = this.$mainContainer.data("layout");
    if (layout !== undefined) params.push(`layout=${encodeURIComponent(layout)}`);

    const separator = /[?&]$/.test(base) ? "" : base.includes("?") ? "&" : "?";
    return `${base}${separator}${params.join("&")}`;
  },

  /**
   * Load page content via AJAX with partial rendering
   * @param {string} url - The URL to load content from
   * @param {boolean} [cache=false] - Whether to use strict cache (no AJAX revalidation)
   * @param {boolean} [scroll=true] - Whether to scroll to top
   */
  loadPage(url, cache = false, scroll = true) {
    url = new URL(url, window.location.href).href;

    // Only the latest navigation may touch the page, so drop any request still in flight
    if (this.currentRequest) {
      this.currentRequest.abort();
      this.currentRequest = null;
    }

    if (url !== window.location.href) {
      window.history.pushState({}, "", url);
    }
    this.currentUrl = this.stripHash(url);

    const cachedPage = this.getCache(url);

    if (cachedPage) {
      this.updateContent(cachedPage, url);
      if (scroll) $(window).scrollTop(0);
      if (cache) return false;
    } else {
      this.$mainContainer
        .css("min-height", this.$mainContainer.height())
        .html(`<div class="${this.loaderClass}">Loading...</div>`);
    }

    const request = $.ajax({
      url: this.buildPartialUrl(url),
      method: "GET",
      dataType: "html", // Never let jQuery guess (a JSON body would break the string checks below)
      success: (response) => {
        if (response === "unauthorized") {
          window.location.reload();
        } else if (response === "reload" || response.includes("<body")) {
          window.location.href = url;
        } else {
          if (cachedPage === response) {
            return false; // Avoid re-rendering if identical
          }

          this.setCache(url, response);
          this.updateContent(response, url);

          // Scroll if not already handled by cache hit
          if (scroll && !cachedPage) {
            $(window).scrollTop(0);
          }
        }
      },
      error: (xhr, textStatus) => {
        if (textStatus === "abort") return; // Superseded by a newer navigation

        try {
          const response = JSON.parse(xhr.responseText);
          // Used text() instead of html() to prevent XSS attacks
          this.$mainContainer
            .text(response.message || "An error occurred while loading the page.")
            .css("min-height", 0);
        } catch {
          window.location.href = url;
        }
      },
      complete: () => {
        if (this.currentRequest === request) this.currentRequest = null;
      },
    });
    this.currentRequest = request;
  },

  /**
   * Update content in main container
   * @param {string} html - The HTML content to update
   * @param {string} url - The URL of the loaded page
   */
  updateContent(html, url) {
    this.$mainContainer.html(html).css("min-height", 0);

    // attr() instead of data(), which would coerce values such as "123" or "true"
    const title = $("#main-content").attr("data-title");
    if (title) document.title = title;

    this.runDocumentReady();
    this.onPageLoaded(url);
  },

  /**
   * Set up click handlers for pjax-enabled links
   */
  routeLinks() {
    $(document)
      .off("click.pjax", "a.pjax") // Safe to call init() more than once
      .on("click.pjax", "a.pjax", (e) => {
        const target = e.currentTarget;
        const href = target.href;

        // Respect handlers that already took over the click
        if (e.isDefaultPrevented()) return;

        // Ignore invalid links and anchors
        if (!href || href.includes("#") || /\/undefined$/.test(target.pathname)) return;

        // Only same-origin http(s) pages can be fetched as partials
        if (!/^https?:$/.test(target.protocol) || target.origin !== window.location.origin) return;

        // Let the browser handle specialized clicks natively (new tab/window/download)
        if (
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey ||
          e.button !== 0 ||
          target.target === "_blank" ||
          target.hasAttribute("download")
        ) {
          return;
        }

        e.preventDefault();

        const scroll = target.getAttribute("data-pjax-scroll") !== "false";
        const cache =
          target.hasAttribute("data-pjax-cache") &&
          target.getAttribute("data-pjax-cache") !== "false";

        this.loadPage(href, cache, scroll);
        this.onLinkClick(target, href);
      });
  },

  /**
   * Executes all registered document-ready functions.
   */
  runDocumentReady() {
    if (
      typeof documentReadyFunctions !== "undefined" &&
      documentReadyFunctions
    ) {
      let oldDocumentReadyFunctions = documentReadyFunctions;
      documentReadyFunctions = [];
      $.each(oldDocumentReadyFunctions, function (index, cb) {
        try {
          cb();
        } catch (e) {
          console.error("pjax: Error in document-ready function", e);
        }
      });
    }
  },

  /**
   * Initialize pjax functionality
   */
  init() {
    this.$mainContainer = $("#main-container");
    if (!this.$mainContainer.length)
      return console.error("pjax: Main container not found");

    // Expose runDocumentReady globally
    window.runDocumentReady = this.runDocumentReady;

    this.currentUrl = this.stripHash(window.location.href);
    this.routeLinks();
    $(window)
      .off("popstate.pjax")
      .on("popstate.pjax", () => {
        // Back/forward between #anchors of the same page is plain browser scrolling
        if (this.stripHash(window.location.href) === this.currentUrl) return;
        this.loadPage(window.location.href);
      });
    this.runDocumentReady();
    return this;
  },
};

// Make the library reachable from `import`/`require` users and module-scoped scripts
if (typeof window !== "undefined") window.pjax = pjax;
if (typeof module !== "undefined" && module.exports) module.exports = pjax;