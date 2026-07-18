/* Macuto Music — analítica con consentimiento (RGPD)
 * Los IDs se rellenan aquí; si están vacíos, no se muestra banner ni se carga nada. */
(function () {
  var IDS = {
    metaPixel: '887538674392441',   // Macuto Music Web (Events Manager)
    ga4: 'G-NTM5R44S0Q'             // Macuto Music Web · flujo "Web principal"
  };
  if (!IDS.metaPixel && !IDS.ga4) return;

  var KEY = 'mm_consent';

  function cargarMeta() {
    if (!IDS.metaPixel) return;
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', IDS.metaPixel);
    fbq('track', 'PageView');
  }

  function cargarGA() {
    if (!IDS.ga4) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + IDS.ga4;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', IDS.ga4, { anonymize_ip: true });
  }

  /* ---- Eventos de conversión ----
     Sin esto la analítica solo ve visitas sueltas y no el embudo real.
     Se registran SOLO tras el consentimiento (se llaman desde activar()). */
  function ev(nombre, params, metaEvento, metaEstandar) {
    try { if (window.gtag) gtag('event', nombre, params || {}); } catch (e) {}
    try {
      if (window.fbq && metaEvento) {
        fbq(metaEstandar ? 'track' : 'trackCustom', metaEvento, params || {});
      }
    } catch (e) {}
  }

  function eventos() {
    // 1) Clics en las CTA principales (dónde hace clic la gente antes de convertir)
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      var cta = null;
      if (href.indexOf('solicitud') > -1) cta = 'solicita_acceso';
      else if (href.indexOf('envia-tu-cancion') > -1) cta = 'envia_tu_cancion';
      else if (href.indexOf('radar') > -1) cta = 'radar';
      else if (href.indexOf('sube-tu-musica') > -1) cta = 'sube_tu_musica';
      if (!cta) return;
      ev('cta_click', { cta_id: cta, texto: (a.textContent || '').trim().slice(0, 40) }, 'CTAClick');
    }, true);

    // 2) Formularios Tally: cargado y ENVIADO (la conversión de verdad)
    window.addEventListener('message', function (e) {
      if (typeof e.data !== 'string' || e.data.indexOf('Tally.') === -1) return;
      if (String(e.origin || '').indexOf('tally.so') === -1) return; // solo mensajes de Tally
      var d;
      try { d = JSON.parse(e.data); } catch (err) { return; }
      if (!d || !d.event) return;
      var form = (d.payload && d.payload.formId) || '';
      if (d.event === 'Tally.FormSubmitted') {
        ev('generate_lead', { form_id: form, pagina: location.pathname }, 'Lead', true);
      } else if (d.event === 'Tally.FormLoaded') {
        ev('form_loaded', { form_id: form, pagina: location.pathname });
      }
    });
  }

  function activar() { cargarMeta(); cargarGA(); eventos(); }

  var estado = null;
  try { estado = localStorage.getItem(KEY); } catch (e) {}
  if (estado === 'si') { activar(); return; }
  if (estado === 'no') return;

  function banner() {
    var b = document.createElement('div');
    b.id = 'mm-cookies';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-label', 'Aviso de cookies');
    b.innerHTML =
      '<style>' +
      '#mm-cookies{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;background:#17102e;color:#fff;' +
      'border-radius:16px;padding:18px 20px;box-shadow:0 20px 60px -15px rgba(23,16,46,.55);display:flex;' +
      'gap:16px;align-items:center;flex-wrap:wrap;font-size:.92rem;line-height:1.5;max-width:720px;margin:0 auto}' +
      '#mm-cookies p{margin:0;flex:1;min-width:230px}' +
      '#mm-cookies a{color:#c9b8f5;text-decoration:underline}' +
      '#mm-cookies .mmc-b{display:flex;gap:10px}' +
      '#mm-cookies button{font:inherit;font-weight:600;border-radius:99px;padding:10px 22px;cursor:pointer;border:0}' +
      '#mm-cookies .mmc-si{background:#5E17EB;color:#fff}' +
      '#mm-cookies .mmc-no{background:transparent;color:#cdc3ea;border:1.5px solid rgba(255,255,255,.3)}' +
      '@media(max-width:600px){#mm-cookies{flex-direction:column;align-items:stretch;text-align:center}}' +
      '</style>' +
      '<p>Usamos cookies para mejorar tu experiencia y analizar el uso del sitio. Solo se activan si aceptas. ' +
      '<a href="/privacidad.html">Más info</a></p>' +
      '<div class="mmc-b"><button class="mmc-no" type="button">Rechazar</button>' +
      '<button class="mmc-si" type="button">Aceptar</button></div>';
    document.body.appendChild(b);
    b.querySelector('.mmc-si').addEventListener('click', function () {
      try { localStorage.setItem(KEY, 'si'); } catch (e) {}
      b.remove(); activar();
    });
    b.querySelector('.mmc-no').addEventListener('click', function () {
      try { localStorage.setItem(KEY, 'no'); } catch (e) {}
      b.remove();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', banner);
  } else { banner(); }
})();
