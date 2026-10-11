# Easy and Powerful PJAX : Single Page Application (SPA) Library

`pjax.js` is a lightweight and efficient library for implementing Single Page Applications (SPA) in Laravel, CodeIgniter, or any PHP-based project. It enables partial page loads and seamless navigation without full-page reloads, enhancing user experience and performance.

## Features

- **Partial Page Loading**: Load only the required content via AJAX.
- **In-Memory Caching**: Cache pages for faster navigation (cleared on full page reload).
- **Race-Free Navigation**: A newer click cancels any request still in flight, so a slow response never overwrites the current page.
- **Customizable**: Easily integrate with Laravel, CodeIgniter, or other PHP frameworks.
- **Scroll Management**: Control scroll behavior during navigation.
- **Error Handling**: Graceful handling of unauthorized or error responses.
## Installation

### Install via NPM

```bash
npm install @softono/pjax
```

Then include the library in your project:

```javascript
import "@softono/pjax";
```

---

### Install via CDN

#### jsDelivr

```html
<script src="https://cdn.jsdelivr.net/npm/@softono/pjax/pjax.min.js"></script>
```

#### unpkg

```html
<script src="https://unpkg.com/@softono/pjax/pjax.min.js"></script>
```

---

### Manual Installation

Clone or download the repository and include `pjax.min.js` in your project:

```html
<script src="path/to/pjax.min.js"></script>
```

---

### jQuery Dependency

`pjax.js` depends on jQuery, so ensure jQuery is loaded before `pjax.min.js`.

```html
<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
```

## Usage

### HTML Setup

Wrap your main content in a container with the ID `main-container`:

```html
<div id="main-container" data-layout="main">
  <div id="main-content" data-title="">
    <!-- Main content goes here -->
    <div></div>
  </div>
</div>
```

Add the `pjax` class to your links to enable PJAX navigation:

```html
<a href="/example" class="pjax">Example Link</a>
```

### JavaScript Initialization

Load jQuery first, then `pjax`, and call `pjax.init()` once the DOM is ready. Set any options and hooks **before** calling `init()`:

```javascript
$(document).ready(function () {
  // Options (all optional)
  pjax.loaderClass = "my-loader"; // class of the "Loading..." element (default: "loading-text")
  pjax.cacheEnabled = true;       // in-memory page cache (default: true)
  pjax.maxCacheKeys = 50;         // max cached pages (default: 100)

  // Hook: a PJAX link was clicked (the page is about to load)
  pjax.onLinkClick = function (target, href) {
    // target is the clicked <a> element, href is its absolute URL
    $(target).closest("li").addClass("active").siblings().removeClass("active");
  };

  // Hook: new content is in the page (also runs for cached pages)
  pjax.onPageLoaded = function (url) {
    // e.g., send a pageview to analytics
    console.log("Loaded: " + url);
  };

  pjax.init();
});
```

`pjax.init()` looks for `#main-container`. If it is missing, it logs `pjax: Main container not found` to the console and PJAX stays disabled, so links work as normal full-page navigations. Calling `init()` again is safe and does not bind duplicate handlers.

#### Using it with a bundler (NPM)

`import "@softono/pjax"` also exposes `pjax` as `window.pjax`, and `require("@softono/pjax")` returns the object. jQuery must still be available as the global `$`:

```javascript
import $ from "jquery";
window.$ = window.jQuery = $;

import pjax from "@softono/pjax";

$(function () {
  pjax.init();
});
```

#### Hook reference

| Hook | Arguments | When it runs |
| --- | --- | --- |
| `pjax.onLinkClick` | `target` (the `<a>` element), `href` (absolute URL) | Right after a PJAX link is clicked and loading starts. Not called for back/forward navigation. |
| `pjax.onPageLoaded` | `url` (absolute URL) | After the container is updated and the `documentReady` callbacks have run. Runs once for a cached page and again if the server returns changed content. |

To re-run page-specific JavaScript after each navigation, see [Run JavaScript Code After PJAX Updates](#run-javascript-code-after-pjax-updates).

### Server-Side Integration

Ensure your server can handle partial requests by checking for the `pjax` query parameter (sent as `pjax=true`). For example, in PHP:

```php
if (isset($_GET['pjax']) && isset($_GET['layout']) && $_GET['layout'] == 'main') {
    include 'partials/content.php';
}
```

## Rules for PJAX SPA Functionality

- Each link (`<a>` tag) where you want to apply PJAX SPA functionality must include the `pjax` class.
- The `data-pjax-cache` attribute is optional and should only be used for static pages that need to be cached in the browser. `data-pjax-cache="false"` disables it.
- Only same-origin `http(s)` links are intercepted. External links, links with a `#fragment`, `target="_blank"`, the `download` attribute, or a modifier key (Ctrl/Cmd/Shift/Alt) are left to the browser.

### Caching

To enable caching for specific links, add the `data-pjax-cache` attribute:

```html
<a href="/example" class="pjax" data-pjax-cache="true">Cached Link</a>
```

### Scroll Behavior

Control scroll behavior by setting the `data-pjax-scroll` attribute:

```html
<a href="/example" class="pjax" data-pjax-scroll="false">No Scroll</a>
```

## Run JavaScript Code After PJAX Updates

### HTML Setup

Add the following script to the header of your HTML file:

```html
<script>
  var documentReadyFunctions = [];
  function documentReady(fn) {
    documentReadyFunctions.push(fn);
  }
</script>
```

### JavaScript Execution After Content Update

To ensure JavaScript code runs after PJAX updates, include the following function call at the bottom of your view:

```javascript
documentReady(function () {
  //add your code here
});
```

This function will execute all registered `documentReady` functions after the HTML content is updated. this is alternative to jquery $(document).ready()

## API Documentation

### `pjax` Object

#### Hooks

- `pjax.onLinkClick(target, href)`
  - Function executed when a PJAX-enabled link is clicked.
- `pjax.onPageLoaded(url)`
  - Function executed after PJAX successfully loads and updates the page content.

#### Options

- `pjax.loaderClass` (default `"loading-text"`)
  - CSS class of the "Loading..." element shown while an uncached page loads.
- `pjax.cacheEnabled` (default `true`)
  - Turn the in-memory page cache on or off.
- `pjax.maxCacheKeys` (default `100`)
  - Maximum number of cached pages; the oldest is evicted first.

#### Methods

- `pjax.init()`
  - Initialize PJAX functionality. Safe to call more than once.
- `pjax.loadPage(url, cache, scroll)`
  - Load page content via AJAX. Cancels any previous request still in flight.
- `pjax.updateContent(html, url)`
  - Update the main container with new content.
- `pjax.routeLinks()`
  - Set up click handlers for PJAX-enabled links.
- `pjax.setCache(key, value)` / `pjax.getCache(key)` / `pjax.removeCache(key)` / `pjax.clearCache()`
  - Manage the page cache. `setCacheData` / `getCacheData` do the same for JSON values.

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests to improve this library.

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Acknowledgments

Special thanks to the open-source community for inspiration and support.
