/**
 * Everything on this site that moves. Three small things, no framework.
 *
 * The rule from CLAUDE.md §4 — anything that appears, disappears or changes
 * state gets movement — holds here too, and the durations and curves come from
 * styles.css §6, which mirrors docs/10-design-tokens.md §8. Nothing in this
 * file contains a number that is not also in the tokens.
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Theme. The app follows the system and offers no switch; a website is read on
  // machines whose owner never chose. The choice is remembered per browser and
  // an absent choice means «follow the system», which is the app's behaviour.
  // ---------------------------------------------------------------------------

  var root = document.documentElement;
  var STORE_KEY = 'rehearsio-theme';

  function storedTheme() {
    try {
      return localStorage.getItem(STORE_KEY);
    } catch (e) {
      // Private windows and blocked site data both throw here. No theme is a
      // valid answer: the page then renders on the system preference.
      return null;
    }
  }

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  var saved = storedTheme();
  if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved);

  var toggle = document.querySelector('[data-theme-toggle]');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var current = root.getAttribute('data-theme') || (systemPrefersDark() ? 'dark' : 'light');
      var next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      toggle.setAttribute(
        'aria-label',
        next === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
      );
      try {
        localStorage.setItem(STORE_KEY, next);
      } catch (e) {
        /* The theme still changes for this page view; it just is not remembered. */
      }
    });
  }

  // ---------------------------------------------------------------------------
  // The header's hairline, which appears once the page has moved under it. A
  // border that was there from the start would draw a line across an empty
  // screen; one that snapped in would read as a glitch, so it fades.
  // ---------------------------------------------------------------------------

  var header = document.querySelector('.site-header');
  if (header) {
    var sync = function () {
      header.setAttribute('data-scrolled', window.scrollY > 4 ? 'true' : 'false');
    };
    sync();
    window.addEventListener('scroll', sync, { passive: true });
  }

  // ---------------------------------------------------------------------------
  // The table of contents follows the reader — and obeys them.
  //
  // Two jobs that look like one. Following is «which heading did the reader
  // last pass», measured from the page; obeying is «they just clicked
  // Purchases, so light up Purchases», which is not measured at all.
  //
  // **Both were once left to an IntersectionObserver, and it could do neither
  // reliably.** It wakes when a heading *crosses* the reading line, so between
  // two widely spaced headings it never fires, and — the failure the owner
  // actually hit — the last crossing of a smooth scroll happens while the page
  // is still moving. The highlight was decided a few hundred pixels short of
  // where the page stopped, which left it on the chapter above the one clicked.
  // Nothing fires after a scroll settles, so nothing corrected it.
  //
  // So: following is done on `scroll`, whose final frame is also an event —
  // one pass of `getBoundingClientRect` over a dozen headings, reading only,
  // leaving without touching the DOM when the answer has not changed. And
  // obeying is done on the click itself, before any scrolling starts, so the
  // clicked item is right whatever the animation does on its way there.
  // ---------------------------------------------------------------------------

  var links = Array.prototype.slice.call(document.querySelectorAll('.toc a[href^="#"]'));
  if (links.length) {
    var byId = {};
    var headings = [];

    links.forEach(function (link) {
      var id = link.getAttribute('href').slice(1);
      var heading = document.getElementById(id);
      if (!heading) return;
      byId[id] = link;
      headings.push(heading);
    });

    if (headings.length) {
      // The reading line: just under the sticky header, where a heading stops
      // being «coming up» and starts being «what I am reading». Read from the
      // stylesheet, which is also where the anchor-jump offset comes from, so a
      // heading jumped to lands exactly on it.
      var readingLine = function () {
        var h = parseInt(
          getComputedStyle(document.documentElement).getPropertyValue('--header-h'),
          10,
        );
        return (isNaN(h) ? 60 : h) + 24; // + spacing.xl
      };

      // A heading jumped to comes to rest exactly on the reading line, so «has
      // the reader passed it» is decided on the boundary itself, where a
      // fractional layout position can fall either way. Four pixels of slack
      // settle it in favour of the heading just clicked; sections are hundreds
      // of pixels apart, so nothing else can be caught by it.
      var SLACK = 4;

      var marked = null;

      var setCurrent = function (heading) {
        if (heading === marked) return;
        marked = heading;
        links.forEach(function (link) {
          link.removeAttribute('aria-current');
        });
        if (byId[heading.id]) byId[heading.id].setAttribute('aria-current', 'true');
      };

      var whereTheReaderIs = function () {
        var line = readingLine() + SLACK;
        var current = headings[0]; // before the first heading, the first section

        for (var i = 0; i < headings.length; i++) {
          if (headings[i].getBoundingClientRect().top <= line) current = headings[i];
          else break;
        }

        // The last section is never reached by the rule above: the document runs
        // out of scroll before its heading gets to the reading line, so the list
        // stays one item behind exactly where the reader has finished. At the
        // bottom of the page, the last heading still on screen is the answer.
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
          for (var j = headings.length - 1; j >= 0; j--) {
            if (headings[j].getBoundingClientRect().top < window.innerHeight) return headings[j];
          }
        }

        return current;
      };

      // While a click is being carried out, the page is somewhere between the
      // two headings and measuring it would answer a question nobody asked. The
      // hold ends when the page arrives, or after a moment if it never does —
      // a scroll interrupted by the reader must not leave the list frozen.
      var awaiting = null;
      var awaitingUntil = 0;

      var mark = function () {
        if (awaiting) {
          var arrived = Math.abs(awaiting.getBoundingClientRect().top - readingLine()) <= SLACK;
          if (!arrived && Date.now() < awaitingUntil) return;
          awaiting = null;
        }
        setCurrent(whereTheReaderIs());
      };

      links.forEach(function (link) {
        link.addEventListener('click', function () {
          var heading = byId[link.getAttribute('href').slice(1)]
            ? document.getElementById(link.getAttribute('href').slice(1))
            : null;
          if (!heading) return;
          awaiting = heading;
          awaitingUntil = Date.now() + 1200;
          setCurrent(heading);
        });
      });

      window.addEventListener('scroll', mark, { passive: true });
      // Resizing moves every heading without scrolling past one.
      window.addEventListener('resize', mark, { passive: true });
      mark();
    }
  }

  // ---------------------------------------------------------------------------
  // Clean addresses. The owner wants the address bar to say rehearsio.com and
  // nothing after it (2026-10-15): no «index.html», no «#features». The pages
  // link to «/», «/privacy» and so on; what is left is the part after «#»,
  // which every in-page link adds. So a link to a place on this same page
  // scrolls there itself and leaves the address alone, and a page opened with
  // a «#…» from another page goes to its place and then drops the «#…».
  //
  // The scroll is the browser's own (`scrollIntoView`): it obeys the
  // stylesheet's smooth scrolling and its `scroll-padding-top`, so a section
  // still comes to rest clear of the header, and reduced motion still jumps.
  // ---------------------------------------------------------------------------

  function targetOf(hash) {
    if (!hash || hash === '#') return null;
    try {
      return document.getElementById(decodeURIComponent(hash.slice(1)));
    } catch (e) {
      return null;
    }
  }

  function goTo(target) {
    target.scrollIntoView();
    // Keyboard focus follows, so «Skip to content» still does its job.
    if (
      !target.hasAttribute('tabindex') &&
      !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(target.tagName)
    ) {
      target.setAttribute('tabindex', '-1');
    }
    target.focus({ preventScroll: true });
  }

  function dropHash() {
    if (window.location.hash && window.history && history.replaceState) {
      history.replaceState(history.state, '', window.location.pathname + window.location.search);
    }
  }

  document.addEventListener('click', function (event) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target.closest ? event.target.closest('a[href]') : null;
    if (!link || link.target) return;
    var url = new URL(link.href, window.location.href);
    var samePage =
      url.origin === window.location.origin &&
      url.pathname.replace(/index\.html$/, '') ===
        window.location.pathname.replace(/index\.html$/, '');
    if (!samePage) return;
    var target = targetOf(url.hash);
    if (!target) return;
    event.preventDefault();
    goTo(target);
    dropHash();
  });

  if (window.location.hash) {
    var arrived = targetOf(window.location.hash);
    if (arrived) {
      // After the pictures and the page's own scripts have settled its height.
      window.addEventListener('load', function () {
        arrived.scrollIntoView({ behavior: 'auto' });
        dropHash();
      });
    } else {
      dropHash();
    }
  }
})();
