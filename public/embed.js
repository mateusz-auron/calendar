/*
 * Tournament calendar: host-page helper for the <iframe> embed.
 *
 *   <iframe data-tournament-calendar src="https://…/calendar/?parentOrigin=https://your-site" …></iframe>
 *   <script src="https://…/calendar/embed.js" defer></script>
 *
 * - Resizes the iframe to its content (calendar:resize).
 * - Event details open in a "details layer": a second, transparent iframe covering the whole
 *   screen (the calendar with ?mode=details). It is loaded once, kept invisible, and shown only
 *   when its dialog is ready, so the backdrop greys the entire page, the dialog sits above the
 *   page's own bars, and the phone bottom sheet uses the full width. The calendar iframe itself
 *   never moves, and the page's scrolling is not touched.
 * - While details are open, <html> has the class "calendar-dialog-open", e.g. to hide a bottom
 *   navigation bar: .calendar-dialog-open .bottom-nav { display: none }
 *
 * No dependencies; safe to include more than once.
 */
(function () {
  'use strict';

  var ATTRIBUTE = 'data-tournament-calendar';
  var OPEN_CLASS = 'calendar-dialog-open';
  /** If the details layer does not answer, the calendar opens the details itself. */
  var FALLBACK_MS = 2500;

  function withParam(src, name, value) {
    var url = new URL(src, window.location.href);
    url.searchParams.set(name, value);
    return url.href;
  }

  function attach(frame) {
    if (!frame || frame.__tournamentCalendar) return;
    frame.__tournamentCalendar = true;

    var origin;
    try {
      origin = new URL(frame.src, window.location.href).origin;
    } catch {
      return;
    }

    // Load now, not when the visitor scrolls near it: a lazy iframe would load and change its
    // height under their finger.
    if (frame.getAttribute('loading') === 'lazy') frame.setAttribute('loading', 'eager');

    var layer = null; // the details iframe
    var layerReady = false; // it said hello
    var open = false; // details visible
    var pending = null; // request waiting for the layer to show it
    var fallbackTimer = 0;
    var lastMonth = null; // month the calendar shows, for prefetching

    function toCalendar(message) {
      if (frame.contentWindow) frame.contentWindow.postMessage(message, origin);
    }

    function toLayer(message) {
      if (layer && layer.contentWindow) layer.contentWindow.postMessage(message, origin);
    }

    function announce() {
      if (layerReady) toCalendar({ type: 'calendar:host', details: true });
    }

    function createLayer() {
      if (layer) return;
      layer = document.createElement('iframe');
      layer.src = withParam(frame.src, 'mode', 'details');
      layer.title = frame.title || 'Event details';
      var sandbox = frame.getAttribute('sandbox');
      if (sandbox !== null) layer.setAttribute('sandbox', sandbox);
      layer.setAttribute('tabindex', '-1');
      layer.setAttribute('aria-hidden', 'true');
      layer.inert = true;
      // !important: the host page's own iframe rules (sizes, borders, shadows) must not apply.
      var style = {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        'min-width': '0',
        'max-width': 'none',
        'min-height': '0',
        'max-height': 'none',
        margin: '0',
        padding: '0',
        border: '0',
        'border-radius': '0',
        'box-shadow': 'none',
        transform: 'none',
        filter: 'none',
        background: 'transparent',
        'color-scheme': 'normal',
        'z-index': '2147483647',
        display: 'block',
        visibility: 'visible',
      };
      for (var property in style) layer.style.setProperty(property, style[property], 'important');
      setLayerVisible(false);
      document.body.appendChild(layer);
    }

    // Hidden means visibility:hidden, not only transparent: cross-origin, browsers can still
    // route touches to a transparent full-screen iframe and the page would not scroll.
    function setLayerVisible(visible) {
      layer.style.setProperty('visibility', visible ? 'visible' : 'hidden', 'important');
      layer.style.setProperty('opacity', visible ? '1' : '0', 'important');
      layer.style.setProperty('pointer-events', visible ? 'auto' : 'none', 'important');
    }

    function showLayer() {
      clearTimeout(fallbackTimer);
      pending = null;
      if (open) return;
      open = true;
      layer.inert = false;
      layer.removeAttribute('aria-hidden');
      setLayerVisible(true);
      document.documentElement.classList.add(OPEN_CLASS);
      layer.focus();
      toLayer({ type: 'calendar:details-shown' });
    }

    function hideLayer() {
      clearTimeout(fallbackTimer);
      pending = null;
      if (!layer) return;
      var wasOpen = open;
      open = false;
      setLayerVisible(false);
      layer.setAttribute('aria-hidden', 'true');
      layer.inert = true;
      document.documentElement.classList.remove(OPEN_CLASS);
      if (wasOpen) frame.focus();
    }

    function requestDetails(data) {
      if (!layer || !layerReady) {
        toCalendar({ type: 'calendar:details-fallback', request: data });
        return;
      }
      pending = data;
      toLayer(data);
      clearTimeout(fallbackTimer);
      fallbackTimer = setTimeout(function () {
        var request = pending;
        hideLayer();
        if (request) toCalendar({ type: 'calendar:details-fallback', request: request });
      }, FALLBACK_MS);
    }

    window.addEventListener('message', function (event) {
      if (event.origin !== origin) return;
      var data = event.data;
      if (!data || typeof data.type !== 'string') return;

      if (event.source === frame.contentWindow) {
        switch (data.type) {
          case 'calendar:hello':
            createLayer();
            announce();
            break;
          case 'calendar:resize':
            if (typeof data.height === 'number') frame.style.height = data.height + 'px';
            break;
          case 'calendar:focus':
            if (typeof data.top === 'number') {
              var frameTop = frame.getBoundingClientRect().top + window.scrollY;
              var top = frameTop + data.top - 16;
              var bottom = frameTop + data.top + (data.height || 0) + 16;
              if (top < window.scrollY || bottom > window.scrollY + window.innerHeight) {
                window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
              }
            }
            break;
          case 'calendar:month':
            lastMonth = data;
            toLayer(data);
            break;
          case 'calendar:details':
            requestDetails(data);
            break;
        }
        return;
      }

      if (layer && event.source === layer.contentWindow) {
        switch (data.type) {
          case 'calendar:hello':
            layerReady = true;
            announce();
            if (lastMonth) toLayer(lastMonth);
            break;
          case 'calendar:details-ready':
            // Too late (the calendar already opened the details itself): close it again.
            if (pending) showLayer();
            else if (!open) toLayer({ type: 'calendar:details-cancel' });
            break;
          case 'calendar:details-closed':
            if (open) {
              hideLayer();
              toCalendar({
                type: 'calendar:details-closed',
                eventId: typeof data.eventId === 'string' ? data.eventId : undefined,
              });
            } else if (pending) {
              // The layer could not show this request: let the calendar open it itself.
              var request = pending;
              hideLayer();
              toCalendar({ type: 'calendar:details-fallback', request: request });
            }
            break;
          case 'calendar:month':
            // Prev/next in the details moved to another month: the calendar follows behind.
            toCalendar({ type: 'calendar:month', month: data.month });
            break;
        }
      }
    });
  }

  function attachAll() {
    for (const frame of document.querySelectorAll('iframe[' + ATTRIBUTE + ']')) attach(frame);
  }

  window.TournamentCalendarEmbed = { attach: attach };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachAll);
  else attachAll();
})();
