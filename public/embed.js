/*
 * Tournament calendar: host-page helper for the <iframe> embed.
 *
 *   <iframe data-tournament-calendar src="https://…/calendar/?parentOrigin=https://your-site" …></iframe>
 *   <script src="https://…/calendar/embed.js" defer></script>
 *
 * - Resizes the iframe to its content (calendar:resize).
 * - Scrolls the event details into view when they open at the screen edge (calendar:focus).
 * - Overlay mode: while the event details are open, the iframe covers the whole screen, so the
 *   backdrop greys the entire page, the dialog sits above the page's own bars, and the phone
 *   bottom sheet uses the full width. <html> gets the class "calendar-dialog-open" meanwhile,
 *   e.g. to hide a bottom navigation bar: .calendar-dialog-open .bottom-nav { display: none }
 *
 * No dependencies; safe to include more than once.
 */
(function () {
  'use strict';

  var ATTRIBUTE = 'data-tournament-calendar';
  var OPEN_CLASS = 'calendar-dialog-open';
  var REVEAL_TIMEOUT_MS = 600;

  function attach(frame) {
    if (!frame || frame.__tournamentCalendar) return;
    frame.__tournamentCalendar = true;

    var origin;
    try {
      origin = new URL(frame.src, window.location.href).origin;
    } catch {
      return;
    }

    var overlay = null; // state while the iframe covers the screen
    var revealTimer = 0;

    function post(message) {
      if (frame.contentWindow) frame.contentWindow.postMessage(message, origin);
    }

    function announce() {
      post({ type: 'calendar:host', overlay: true });
    }

    function rectOf(element) {
      var r = element.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    }

    // The calendar draws itself again after a switch; keep the iframe invisible (but focusable)
    // until it says it is ready, so the swap does not flash.
    function hideUntilReady() {
      frame.style.opacity = '0';
      clearTimeout(revealTimer);
      revealTimer = setTimeout(reveal, REVEAL_TIMEOUT_MS);
    }

    function reveal() {
      clearTimeout(revealTimer);
      frame.style.opacity = '';
    }

    function enterOverlay() {
      if (overlay) return;
      var html = document.documentElement;
      var computed = window.getComputedStyle(frame);
      var rect = frame.getBoundingClientRect();

      // Scroll anchoring would "correct" the scroll position when the iframe leaves the page
      // flow (and again when it returns); the placeholder keeps the layout identical anyway.
      html.style.overflowAnchor = 'none';

      // Keep the iframe's place in the page while it is lifted out of the flow.
      var placeholder = document.createElement('div');
      placeholder.setAttribute('aria-hidden', 'true');
      placeholder.style.cssText =
        'display:block;box-sizing:border-box;max-width:100%;' +
        'width:' +
        rect.width +
        'px;height:' +
        rect.height +
        'px;' +
        'margin:' +
        computed.marginTop +
        ' ' +
        computed.marginRight +
        ' ' +
        computed.marginBottom +
        ' ' +
        computed.marginLeft +
        ';';
      frame.parentNode.insertBefore(placeholder, frame);

      overlay = {
        placeholder: placeholder,
        frameStyle: frame.getAttribute('style'),
        htmlOverflow: html.style.overflow,
        htmlGutter: html.style.scrollbarGutter,
        htmlAnchor: html.style.overflowAnchor,
      };

      // Stop the page from scrolling behind the dialog without shifting it.
      if (window.innerWidth > html.clientWidth) html.style.scrollbarGutter = 'stable';
      html.style.overflow = 'hidden';
      html.classList.add(OPEN_CLASS);

      hideUntilReady();
      frame.style.position = 'fixed';
      frame.style.top = '0';
      frame.style.left = '0';
      frame.style.right = '0';
      frame.style.bottom = '0';
      frame.style.width = '100%';
      frame.style.height = '100%';
      frame.style.maxWidth = 'none';
      frame.style.maxHeight = 'none';
      frame.style.margin = '0';
      frame.style.border = '0';
      frame.style.borderRadius = '0';
      frame.style.boxShadow = 'none';
      frame.style.transform = 'none';
      frame.style.zIndex = '2147483647';

      post({ type: 'calendar:overlay', active: true, rect: rectOf(placeholder) });
    }

    function exitOverlay() {
      if (!overlay) return;
      var html = document.documentElement;
      hideUntilReady();
      if (overlay.frameStyle === null) frame.removeAttribute('style');
      else frame.setAttribute('style', overlay.frameStyle);
      frame.style.opacity = '0'; // restoring the style dropped it
      overlay.placeholder.parentNode.removeChild(overlay.placeholder);
      html.style.overflow = overlay.htmlOverflow;
      html.style.scrollbarGutter = overlay.htmlGutter;
      html.classList.remove(OPEN_CLASS);
      // Re-enable scroll anchoring only after the iframe is back in the layout.
      var anchor = overlay.htmlAnchor;
      requestAnimationFrame(function () {
        html.style.overflowAnchor = anchor;
      });
      overlay = null;
      post({ type: 'calendar:overlay', active: false });
    }

    window.addEventListener('message', function (event) {
      if (event.source !== frame.contentWindow || event.origin !== origin) return;
      var data = event.data;
      if (!data || typeof data.type !== 'string') return;

      switch (data.type) {
        case 'calendar:hello':
          announce();
          break;
        case 'calendar:resize':
          // While the overlay is open the iframe is full screen; its page slot keeps its size.
          if (!overlay && typeof data.height === 'number') frame.style.height = data.height + 'px';
          break;
        case 'calendar:focus':
          if (!overlay && typeof data.top === 'number') {
            var frameTop = frame.getBoundingClientRect().top + window.scrollY;
            var top = frameTop + data.top - 16;
            var bottom = frameTop + data.top + (data.height || 0) + 16;
            if (top < window.scrollY || bottom > window.scrollY + window.innerHeight) {
              window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
            }
          }
          break;
        case 'calendar:dialog':
          if (data.open === true) enterOverlay();
          else if (data.open === false) exitOverlay();
          break;
        case 'calendar:overlay-ready':
          reveal();
          break;
      }
    });

    // Rotation or window resize while open: tell the calendar where its slot is now.
    window.addEventListener('resize', function () {
      if (overlay)
        post({ type: 'calendar:overlay', active: true, rect: rectOf(overlay.placeholder) });
    });

    frame.addEventListener('load', announce);
    announce();
  }

  function attachAll() {
    for (const frame of document.querySelectorAll('iframe[' + ATTRIBUTE + ']')) attach(frame);
  }

  window.TournamentCalendarEmbed = { attach: attach };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachAll);
  else attachAll();
})();
