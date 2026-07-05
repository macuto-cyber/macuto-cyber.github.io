/* Macuto Music — analítica con consentimiento (RGPD)
 * Los IDs se rellenan aquí; si están vacíos, no se muestra banner ni se carga nada. */
(function () {
  var IDS = {
    metaPixel: '',   // ID del píxel de Meta (Events Manager)
    ga4: ''          // ID de medición GA4, formato G-XXXXXXX
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

  function activar() { cargarMeta(); cargarGA(); }

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
      '<p>Usamos cookies para medir la web y mejorar nuestros anuncios. Solo se activan si aceptas. ' +
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
