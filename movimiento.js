/* movimiento.js · Pareja de movimiento.css: la portada de macutomusic.com responde al scroll y al ratón (11-oct-2026).
 *
 * QUÉ HACE   1) barra de progreso de lectura (la mueve el CSS) y sombra de la cabecera al bajar;
 *            2) luz que sigue al puntero en el héroe, la banda «100% orgánicos» y el CTA final;
 *            3) cinta de géneros que acelera con el scroll y cambia de sentido si subes;
 *            4) cifras que cuentan desde 0 hasta su valor exacto al entrar en pantalla (franja, oyentes, seguidores);
 *            5) frase de «Quiénes somos» que se ilumina palabra a palabra al bajar;
 *            6) (el paralaje del retrato es CSS puro: movimiento.css §6);
 *            7) foco que sigue al ratón en las celdas de «Qué hacemos» e inclinación de las fichas de artistas;
 *            8) botones imán (el CTA principal se deja atraer unos píxeles);
 *            9) roster en cascada y entrada escalonada de lo que despliega «Ver más»;
 *           10) vídeos: Mastermind con portada y botón, sesión de YouTube con fachada y verticales en bucle (11-oct, tarde).
 *           11) testimonios en filas que avanzan solas (12-oct; los videoclips de YouTube pasaron a los bucles de «Hecho en casa»);
 *           12) «Quién está detrás» en formato Stories de Instagram (12-oct).
 * REGLAS     · Con «reducir movimiento» solo quedan 1 (es estado, no adorno), 10 (los vídeos, sin bucles automáticos)
 *              y 12 (las historias, que no avanzan solas: se pasan a mano).
 *              Lo del puntero, solo con ratón (hover:hover).
 *            · UN bucle: el scroll pasivo pide un requestAnimationFrame; lo que está fuera de pantalla no se calcula
 *              (IntersectionObserver). La cinta tiene su propio rAF, parado fuera de pantalla y con la pestaña oculta.
 *            · No toca lo de la sesión «Diseño Web OK»: .prueba/.feed, .fundador__txt, .timeline/.tstep, #forbes, NODE.
 *            · Importarlo no rompe nada si falta un bloque: cada parte comprueba que su elemento existe.
 * CARGA      <script defer src="movimiento.js?v=…"> en el <head> de index.html: corre tras el HTML y antes de mostrar
 *            la página entera, así que las cifras se ponen a cero antes de que nadie las vea.
 */
(function(){
  'use strict';
  const reducir = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const raton = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const raiz = document.documentElement;
  const $ = (s, c) => (c || document).querySelector(s), $$ = (s, c) => [...(c || document).querySelectorAll(s)];

  /* ---- bucle de scroll compartido ---- */
  const tareas = new Set();
  let pedido = false;
  const frame = () => { pedido = false; const y = scrollY, vh = innerHeight; tareas.forEach(f => f(y, vh)); };
  const pide = () => { if (!pedido) { pedido = true; requestAnimationFrame(frame); } };
  addEventListener('scroll', pide, { passive: true });
  addEventListener('resize', pide, { passive: true });
  const mientrasVisible = (el, f) => {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { tareas.add(f); return; }
    new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { tareas.add(f); f(scrollY, innerHeight); } else tareas.delete(f);
    }), { rootMargin: '160px 0px' }).observe(el);
  };

  /* ---- 1 · progreso y cabecera: la barra la mueve el CSS (scroll-timeline); aquí solo se crea y se marca la sombra ---- */
  const nav = $('nav.site');
  if (nav) {
    if (!reducir && window.CSS && CSS.supports('animation-timeline: scroll()')) {
      const barra = document.createElement('div');
      barra.className = 'mv-progreso'; barra.setAttribute('aria-hidden', 'true'); nav.append(barra);
    }
    const f = y => nav.classList.toggle('mv-bajado', y > 12);
    tareas.add(f); f(scrollY);
  }
  /* ---- 10 · vídeos (corre también con «reducir movimiento»: ahí los bucles no arrancan solos y conservan sus controles) ----
         · Mastermind: el botón propio sustituye a los controles hasta que se pulsa; luego, controles nativos y sonido.
         · Sesión de YouTube: fachada; youtube-nocookie solo al pulsar (antes no se pide nada a YouTube).
         · Verticales: bucle mudo mientras están en pantalla; Mhylo con botón de sonido. Solo suena un vídeo a la vez. ---- */
  const soloEste = v => $$('video').forEach(o => {
    if (o === v || o.muted) return;
    if (o.classList.contains('bucle')) { o.muted = true; const s = o.parentElement.querySelector('.movil__sonido'); if (s) { s.setAttribute('aria-pressed', 'false'); s.textContent = 'Activar sonido'; } }
    else o.pause();
  });
  document.addEventListener('play', e => { const v = e.target; if (v.tagName === 'VIDEO' && !v.muted) soloEste(v); }, true);
  $$('.video-h__marco > video').forEach(v => {
    const b = v.parentElement.querySelector('.video-h__play');
    if (!b) return;
    v.removeAttribute('controls'); b.hidden = false;
    b.addEventListener('click', () => {
      b.hidden = true; v.controls = true; v.parentElement.classList.add('en-marcha');
      v.play().catch(() => {}); v.focus({ preventScroll: true });
    });
  });
  $$('[data-youtube]').forEach(m => {
    const a = $('.video-h__play', m);
    if (!a) return;
    a.addEventListener('click', e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; // abrir en otra pestaña sigue funcionando
      e.preventDefault();
      soloEste(null);
      const f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(m.dataset.youtube) + '?autoplay=1&rel=0&playsinline=1';
      f.title = (m.closest('figure').querySelector('figcaption b') || {}).textContent || 'Vídeo de YouTube';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true;
      m.classList.add('en-marcha'); m.append(f); a.remove(); f.focus();
    });
  });
  // Videoclips de YouTube (12-oct-2026): al pulsar uno, el vídeo entero se reproduce AQUÍ, en un <dialog>, sin ir a YouTube.
  // Delegado en el documento para que funcione también en las copias de la fila que se mueve (§11).
  let repro = null;
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-youtube-dialogo]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; // abrir en otra pestaña sigue funcionando
    e.preventDefault();
    if (!repro) {
      repro = document.createElement('dialog');
      repro.className = 'reproductor';
      repro.innerHTML = '<div class="reproductor__marco"></div><button type="button" class="reproductor__cerrar" aria-label="Cerrar el vídeo">×</button>';
      document.body.append(repro);
      repro.querySelector('.reproductor__cerrar').addEventListener('click', () => repro.close());
      repro.addEventListener('click', ev => { if (ev.target === repro) repro.close(); });
      repro.addEventListener('close', () => { repro.querySelector('.reproductor__marco').textContent = ''; });
    }
    soloEste(null);
    const f = document.createElement('iframe'), titulo = a.dataset.titulo || 'Vídeo de YouTube';
    f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(a.dataset.youtubeDialogo) + '?autoplay=1&rel=0&playsinline=1';
    f.title = titulo; f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true;
    repro.querySelector('.reproductor__marco').replaceChildren(f);
    repro.setAttribute('aria-label', titulo);
    repro.showModal();
    repro.querySelector('.reproductor__cerrar').focus(); // el foco fuera del iframe: Esc cierra (dentro de YouTube no llega)
  });
  // Pósters diferidos (13-oct-2026, auditoría de velocidad): el atributo poster nunca es lazy y los 23 vídeos de #creacion bajaban
  // ~250 KB al cargar, a 11.000 px. Van en data-poster y se ponen cuando su lista está a 1,2 pantallas (margen en px: en % fallaba
  // en emulación móvil). Se rellena la lista entera porque en móvil es un carril horizontal y lo que queda a la derecha no
  // «intersecta» nunca; lo plegado (display:none) espera a que se despliegue. Vale también con «reducir movimiento».
  const conPoster = $$('#creacion video[data-poster]');
  if (conPoster.length) {
    const pon = (v, siempre) => {
      if (!v.dataset.poster || !(siempre || v.getClientRects().length)) return false;
      v.poster = v.dataset.poster; v.removeAttribute('data-poster'); return true;
    };
    if ('IntersectionObserver' in window) {
      const iop = new IntersectionObserver(es => es.forEach(e => {
        if (!e.isIntersecting) return;
        $$('video[data-poster]', e.target.closest('ul, .creacion') || e.target.parentElement).forEach(v => { if (pon(v)) iop.unobserve(v); });
      }), { rootMargin: Math.round(innerHeight * 1.2) + 'px 0px' });
      conPoster.forEach(v => iop.observe(v));
    } else conPoster.forEach(v => pon(v, true));
  }

  const bucles = $$('video.bucle');
  if (!reducir && bucles.length) {
    let pide = () => {};
    bucles.forEach(v => {
      v.removeAttribute('controls');
      const s = v.parentElement.querySelector('.movil__sonido');
      if (s) {
        s.hidden = false;
        s.addEventListener('click', () => {
          v.muted = !v.muted;
          s.setAttribute('aria-pressed', String(!v.muted)); s.textContent = v.muted ? 'Activar sonido' : 'Silenciar';
          if (!v.muted) { soloEste(v); v.play().catch(() => {}); }
          pide();
        });
      }
    });
    /* Presupuesto de bucles (14-oct-2026): «Diseño Web OK» midió la página EN REPOSO a 30 fps con 8 vídeos sonando a la vez (con 0-1,
       47 fps). Ahora solo suenan los bucles que se ven al 60 % y, de esos, como mucho 2 en escritorio y 1 en el móvil, los más cercanos al
       centro de la pantalla. El que tiene el sonido puesto lo ha elegido la persona: no cuenta y no se pausa mientras se vea. Con
       «Ahorro de datos», ninguno arranca solo. Los .evento__video (#industria, Mastermind, «Detrás de cámara») llevan su propio gestor
       con el mismo criterio, en el script de #industria de index.html. */
    if ('IntersectionObserver' in window) {
      const tope = matchMedia('(max-width: 760px)').matches ? 1 : 2;
      const ahorro = !!(navigator.connection && navigator.connection.saveData);
      const vistos = new Map();  // bucle → cuánto se ve (0-1)
      let raf = 0;
      const reparte = () => {
        raf = 0;
        const cx = innerWidth / 2, cy = innerHeight / 2;
        const elegidos = [...vistos].filter(([v, r]) => r >= .6 && v.muted)
          .map(([v]) => { const q = v.getBoundingClientRect(); return [v, Math.hypot(q.left + q.width / 2 - cx, q.top + q.height / 2 - cy)]; })
          .sort((a, b) => a[1] - b[1]).slice(0, ahorro ? 0 : tope).map(([v]) => v);
        bucles.forEach(v => {
          if (!v.muted && vistos.has(v)) return;  // con sonido: manda la persona
          if (elegidos.includes(v)) { if (v.paused) { v.preload = 'auto'; v.play().catch(() => {}); } }
          else if (!v.paused) v.pause();
        });
      };
      pide = () => { if (!raf) raf = requestAnimationFrame(reparte); };
      const io = new IntersectionObserver(es => {
        es.forEach(e => e.isIntersecting
          ? vistos.set(e.target, Math.max(e.intersectionRatio, e.intersectionRect.height / innerHeight))  // los más altos que la pantalla
          : vistos.delete(e.target));
        pide();
      }, { threshold: [0, .3, .6, .8, 1] });
      bucles.forEach(v => io.observe(v));
      const alMover = () => { if (vistos.size) pide(); };  // al bajar o al deslizar un carril cambia cuál queda más centrado
      addEventListener('scroll', alMover, { passive: true });
      addEventListener('resize', pide);
      $$('.carril-movil').forEach(c => c.addEventListener('scroll', alMover, { passive: true }));
    }
  }

  /* ---- 12 · «Quién está detrás» en formato Stories de Instagram (12-oct-2026, Macuto) ----
     Una historia cada 6 s con su barra arriba (las de vídeo, lo que dure el vídeo, entre 4 y 12 s). Toque a la derecha: siguiente; a la izquierda: anterior; mantener pulsado:
     pausa, como en Instagram. Botón de pausa (WCAG 2.2.2) y flechas del teclado. Solo avanza con la mitad del bloque en
     pantalla y la pestaña visible. Con «reducir movimiento» no avanza sola (se pasa a mano). Estilos: movimiento.css §18. */
  const hist = $('.historias');
  const items = hist ? $$('.historia', hist) : [];
  if (items.length > 1) {
    const n = items.length, DUR = 6000, waapi = 'animate' in Element.prototype;
    const ui = document.createElement('div');
    ui.className = 'historias__ui';
    ui.innerHTML = '<div class="historias__barras" aria-hidden="true">' + '<span><i></i></span>'.repeat(n) + '</div>' +
      '<div class="historias__cab"><img class="historias__avatar" src="assets/logo-72.webp" width="72" height="81" alt="">' +
      '<b class="historias__autor">macutomusic</b><span class="historias__lugar"></span>' +
      '<button class="historias__pausa" type="button"></button></div>' +
      '<button class="historias__ant" type="button" aria-label="Historia anterior"></button>' +
      '<button class="historias__sig" type="button" aria-label="Historia siguiente"></button>' +
      '<span class="historias__aviso" aria-live="polite"></span>';
    hist.append(ui);
    const barras = $$('.historias__barras i', ui), lugar = $('.historias__lugar', ui), pausa = $('.historias__pausa', ui);
    const aviso = $('.historias__aviso', ui);
    const ICO_PAUSA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z"/></svg>';
    const ICO_SEGUIR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.3v13.4L18.6 12z"/></svg>';
    let i = 0, anim = null, pausado = reducir, visible = !('IntersectionObserver' in window), sujeto = false;
    const corre = () => !pausado && visible && !sujeto && !document.hidden;
    // las historias con vídeo (.historia--video, mudo) duran lo que su data-dur entre 4 y 12 s; si es más corto, se repite
    const video = li => $('video', li);
    // Diferidas (13-oct-2026, auditoría de velocidad): solo la historia 1 lleva src en el HTML; las demás (data-src, data-srcset,
    // data-poster) se rellenan al acercarse el bloque a 1,2 pantallas y, desde ahí, siempre la anterior, la actual y la siguiente.
    // Apiladas en el mismo sitio, loading="lazy" no servía: «intersectaban» todas a la vez y en móvil bajaban ~560 KB al cargar.
    let cerca = !('IntersectionObserver' in window);
    const llena = li => {
      const im = $('img[data-src]', li), v = video(li);
      if (im) {
        if (im.dataset.srcset) im.srcset = im.dataset.srcset;
        im.loading = 'eager'; im.src = im.dataset.src; im.removeAttribute('data-src'); im.removeAttribute('data-srcset');
      }
      if (v && v.dataset.poster) { v.poster = v.dataset.poster; v.removeAttribute('data-poster'); }
    };
    const prepara = () => {
      const sig = items[(i + 1) % n], vs = video(sig);
      [items[(i - 1 + n) % n], items[i], sig].forEach(llena);
      if (vs && !reducir) vs.preload = 'auto';
    };
    const sigue = () => {
      const si = corre(), v = video(items[i]);
      if (anim) si ? anim.play() : anim.pause();
      if (v && !reducir) si ? v.play().catch(() => {}) : v.pause();
      hist.classList.toggle('historias--pausa', !si);
    };
    const ve = (k, avisa) => {
      i = (k + n) % n;
      items.forEach((li, j) => {
        li.classList.toggle('es-actual', j === i); li.setAttribute('aria-hidden', j === i ? 'false' : 'true');
        const v = video(li); if (v && j !== i) v.pause();
      });
      barras.forEach((b, j) => { b.getAnimations?.().forEach(a => a.cancel()); b.style.transform = j < i || (j === i && reducir) ? 'scaleX(1)' : 'scaleX(0)'; });
      lugar.textContent = items[i].dataset.lugar || '';
      if (avisa) aviso.textContent = `Historia ${i + 1} de ${n}: ${lugar.textContent}`;
      llena(items[i]);
      if (cerca) prepara();
      const v = video(items[i]), seg = parseFloat(items[i].dataset.dur) || 0;
      if (v) { v.loop = seg < 4; try { v.currentTime = 0; } catch (e) {} }
      anim = null;
      if (waapi && !reducir) {
        const dura = v && seg ? Math.min(Math.max(seg, 4), 12) * 1000 : DUR;
        anim = barras[i].animate({ transform: ['scaleX(0)', 'scaleX(1)'] }, { duration: dura, easing: 'linear', fill: 'forwards' });
        anim.onfinish = () => ve(i + 1);
      }
      sigue();
    };
    const pintaPausa = () => {
      pausa.innerHTML = pausado ? ICO_SEGUIR : ICO_PAUSA;
      pausa.setAttribute('aria-label', pausado ? 'Reanudar las historias' : 'Pausar las historias');
    };
    $('.historias__sig', ui).addEventListener('click', () => ve(i + 1, true));
    $('.historias__ant', ui).addEventListener('click', () => ve(i - 1, true));
    pausa.addEventListener('click', () => { pausado = !pausado; pintaPausa(); sigue(); });
    hist.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); ve(i + (e.key === 'ArrowRight' ? 1 : -1), true); }
    });
    // mantener pulsado = pausa; al soltar, ese toque no cuenta como «siguiente»
    let reloj = 0, retenido = false;
    hist.addEventListener('pointerdown', e => {
      if (e.button || e.target.closest('.historias__pausa')) return;
      reloj = setTimeout(() => { sujeto = retenido = true; sigue(); }, 220);
    });
    const suelta = () => { clearTimeout(reloj); if (sujeto) { sujeto = false; sigue(); } };
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => hist.addEventListener(t, suelta));
    hist.addEventListener('click', e => { if (retenido) { retenido = false; e.stopPropagation(); e.preventDefault(); } }, true);
    hist.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('visibilitychange', sigue);
    if (!visible) new IntersectionObserver(es => { visible = es[0].isIntersecting; sigue(); }, { threshold: .5 }).observe(hist);
    if (!cerca) {
      const ioc = new IntersectionObserver(es => { if (es[0].isIntersecting) { cerca = true; ioc.disconnect(); prepara(); } },
        { rootMargin: Math.round(innerHeight * 1.2) + 'px 0px' });
      ioc.observe(hist);
    }
    if (reducir) pausa.hidden = true;
    hist.classList.add('historias--viva');
    pintaPausa();
    ve(0);
  }

  /* ---- 13 · «Volver arriba» del pie, y la firma, que también lleva a #main (13-oct-2026, Macuto: «un botón que lance hacia la
     primera sección») ----
     22.000 px de scroll suave eran un viaje eterno: salta a pantalla y media del principio y sube suave solo ese tramo (con
     «reducir movimiento», directo). Después el foco pasa a <main>, para que el teclado siga desde el inicio, y la URL no cambia.
     Sin JS, el ancla de siempre.
     Juguetón (13-oct, «ese botón debería saltar»): .en-vista le da el saltito solo mientras se ve, y al pulsarlo .despega hace
     despegar la flecha 240 ms ANTES de subir (si no, el pie desaparece al instante y no se ve). Estilos: movimiento.css §21. */
  if (!reducir && 'IntersectionObserver' in window) {
    const ioa = new IntersectionObserver(es => es.forEach(x => x.target.classList.toggle('en-vista', x.isIntersecting)), { threshold: .6 });
    $$('.pie__arriba').forEach(b => ioa.observe(b));
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('a.pie__arriba, a.pie__firma[href="#main"]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const main = document.getElementById('main');
    if (!main) return;
    e.preventDefault();
    const sube = () => {
      if (reducir) scrollTo({ top: 0, behavior: 'instant' });
      else {
        scrollTo({ top: Math.min(scrollY, Math.round(innerHeight * 1.5)), behavior: 'instant' });
        requestAnimationFrame(() => scrollTo({ top: 0, behavior: 'smooth' }));
      }
      if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: true });
    };
    if (reducir || !a.classList.contains('pie__arriba')) return sube();
    if (a.classList.contains('despega')) return;  // ya va camino de arriba
    a.classList.add('despega');
    setTimeout(() => { sube(); setTimeout(() => a.classList.remove('despega'), 900); }, 240);
  });

  if (reducir) return;

  /* ---- 2 · luz que sigue al puntero ---- */
  if (raton) {
    $$('.hero, .organic .box, .final .box').forEach(caja => {
      const foco = document.createElement('div');
      foco.className = 'mv-foco'; foco.setAttribute('aria-hidden', 'true'); caja.prepend(foco);
      let x = 0, y = 0, tx = 0, ty = 0, raf = 0, dentro = false;
      const mueve = () => {
        x += (tx - x) * .14; y += (ty - y) * .14;
        foco.style.setProperty('--fx', x.toFixed(1) + 'px'); foco.style.setProperty('--fy', y.toFixed(1) + 'px');
        raf = (dentro || Math.abs(tx - x) + Math.abs(ty - y) > .5) ? requestAnimationFrame(mueve) : 0;
      };
      caja.addEventListener('pointermove', e => {
        const r = caja.getBoundingClientRect(); tx = e.clientX - r.left; ty = e.clientY - r.top;
        if (!dentro) { dentro = true; if (!foco.classList.contains('mv-on')) { x = tx; y = ty; } foco.classList.add('mv-on'); }
        if (!raf) raf = requestAnimationFrame(mueve);
      });
      caja.addEventListener('pointerleave', () => { dentro = false; foco.classList.remove('mv-on'); });
    });
  }

  /* ---- 3 · cinta de géneros: 38 px/s en la GPU (Web Animations); el scroll solo cambia la velocidad y el sentido.
         En reposo no hay JS por fotograma (con un rAF propio costaba 165 ms de CPU cada 3 s, medido el 11-oct).
         Se monta cuando la fuente ya ha cargado: antes, el ancho de la vuelta sale mal y la cinta daría un salto. ---- */
  const cinta = $('.marquee'), pista = cinta && $('.track', cinta);
  if (pista && pista.children.length > 7 && pista.animate) {
    const BASE = 38;
    let anim = null, visible = true, sentido = 1, extra = 0, yPrev = scrollY, raf = 0, aplicada = 1;
    // Cambiar la velocidad de una animación cuesta (la GPU la vuelve a sincronizar): solo se aplica por escalones de 0,5.
    const ritmo = () => { const r = sentido * (1 + Math.round(extra * 2) / 2); if (r !== aplicada) { aplicada = r; anim.updatePlaybackRate(r); } };
    const monta = () => {
      const ancho = pista.children[7].offsetLeft - pista.children[0].offsetLeft;
      if (!(ancho > 0)) return;
      const dur = ancho / BASE * 1000, fase = anim ? (anim.currentTime % dur) : 0;
      if (anim) anim.cancel();
      cinta.classList.add('mv-js');
      anim = pista.animate([{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(' + (-ancho) + 'px,0,0)' }], { duration: dur, iterations: Infinity });
      anim.currentTime = dur * 1e4 + fase; // margen de sobra para poder ir hacia atrás al subir
      aplicada = 1; ritmo();
      if (!visible) anim.pause();
    };
    const decae = () => {
      extra *= .93;
      if (extra < .2) { extra = 0; raf = 0; } else raf = requestAnimationFrame(decae);
      ritmo();
    };
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
      monta();
      let ancho0 = innerWidth;
      addEventListener('resize', () => { if (innerWidth !== ancho0) { ancho0 = innerWidth; monta(); } }, { passive: true });
      if ('IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(e => {
        visible = e.isIntersecting; if (anim) visible ? anim.play() : anim.pause();
      })).observe(cinta);
      mientrasVisible(cinta, y => {
        const d = y - yPrev; yPrev = y;
        if (!anim || !d) return;
        sentido = d > 0 ? 1 : -1;
        extra += (Math.min(Math.abs(d) * .5, 8) - extra) * .3;
        ritmo();
        if (!raf) raf = requestAnimationFrame(decae);
      });
    });
  }

  /* ---- 4 · cifras que cuentan desde 0 hasta su valor EXACTO (Macuto, 11-oct: «los números de streams y eso deben empezar de 0
         y subir hasta su cifra exacta»): la franja, los oyentes de las fichas y del roster, los seguidores (fundador y pie) y las cifras del iPhone de Instagram del CTA final.
         El valor final vive en el HTML: sin JS, con «reducir movimiento» o en una captura se ve tal cual. Solo se pone a 0 lo que
         todavía no se ve; cuenta al entrar en pantalla y termina SIEMPRE en el texto original (aunque se frenen los fotogramas).
         Formatos: +234M · 9,8M (decimales con coma) · 177K · +140.000 (miles con punto). Las cifras dentro de frases no cuentan. ---- */
  const NUM = /\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?/;
  const formatea = (n, dec, miles) => {
    let t = n.toFixed(dec).replace('.', ',');
    return miles ? t.replace(/^\d+/, e => e.replace(/\B(?=(\d{3})+(?!\d))/g, '.')) : t;
  };
  const contadores = $$('.stats-band .stat b, .artists .li, #roster .rcard figcaption span, .ig-movil__cifras b').map(el => {
    const tn = [...el.childNodes].find(n => n.nodeType === 3 && NUM.test(n.data));
    if (!tn) return null;
    const m = tn.data.match(NUM), txt = m[0];
    return { el, tn, orig: tn.data, antes: tn.data.slice(0, m.index), despues: tn.data.slice(m.index + txt.length),
             valor: parseFloat(txt.replace(/\./g, '').replace(',', '.')), dec: txt.includes(',') ? txt.split(',')[1].length : 0, miles: txt.includes('.') };
  }).filter(Boolean);
  if (contadores.length && 'IntersectionObserver' in window) {
    const pinta = (c, v) => { c.tn.data = c.antes + formatea(v, c.dec, c.miles) + c.despues; };
    const cuenta = c => {
      const ini = performance.now(), dur = c.valor >= 100 ? 1700 : 1300;
      const tick = t => {
        const p = Math.min(1, (t - ini) / dur);
        if (p < 1) { pinta(c, c.valor * (1 - Math.pow(2, -10 * p))); requestAnimationFrame(tick); } else c.tn.data = c.orig;
      };
      requestAnimationFrame(tick);
      setTimeout(() => { c.tn.data = c.orig; }, dur + 400);
    };
    // Una ficha dentro de un carril horizontal (móvil) no «entra» nunca si no se desliza: se quedaba en «0K».
    // Lo que vive en un carril cuenta entero cuando el carril entra en pantalla; lo demás, cifra a cifra.
    const carril = el => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth + 1) return p;
      }
      return null;
    };
    const grupos = new Map();
    const arranca = (es, io) => es.forEach(e => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const g = grupos.get(e.target);
      g.forEach((c, i) => {
        const orden = g.length > 1 ? i : [...c.el.parentElement.parentElement.children].indexOf(c.el.parentElement);
        setTimeout(() => cuenta(c), Math.min(6, orden) * 90);
      });
    });
    const io = new IntersectionObserver(es => arranca(es, io), { threshold: .6 });
    const ioCarril = new IntersectionObserver(es => arranca(es, ioCarril), { threshold: .3 });
    contadores.forEach(c => {
      if (c.el.getBoundingClientRect().top < innerHeight) return; // lo que ya se ve al cargar, quieto
      // ancho reservado con la cifra final: al contar, el texto de al lado no se mueve
      const w = c.el.getBoundingClientRect().width;
      if (getComputedStyle(c.el).display === 'inline') c.el.style.display = 'inline-block';
      c.el.style.minWidth = w + 'px';
      // El lector de pantalla oye siempre la cifra real; la que cuenta es solo visual
      // etiquetas propias, no <span>: «.stat span» (rótulo pequeño) y parecidas las encogían (12-oct-2026)
      const vis = document.createElement('mv-cifra'), real = document.createElement('mv-real');
      vis.setAttribute('aria-hidden', 'true');
      real.textContent = c.orig;
      real.style.cssText = 'position:absolute;left:0;top:0;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap';
      // anclada a su cifra: dentro de un carril con scroll, una absoluta sin ancla se salía de la página
      if (getComputedStyle(c.el).position === 'static') c.el.style.position = 'relative';
      c.tn.replaceWith(vis); vis.append(c.tn); vis.after(real);
      pinta(c, 0);
      const k = carril(c.el), t = k || c.el;
      if (!grupos.has(t)) { grupos.set(t, []); (k ? ioCarril : io).observe(t); }
      grupos.get(t).push(c);
    });
  }

  /* ---- 5 · frase de «Quiénes somos», palabra a palabra ---- */
  const frase = $('#nosotros .statement');
  if (frase) {
    const parte = nodo => {
      [...nodo.childNodes].forEach(h => {
        if (h.nodeType === 3) {
          const trozos = h.textContent.split(/(\s+)/), frag = document.createDocumentFragment();
          trozos.forEach(t => {
            if (!t) return;
            if (/^\s+$/.test(t)) frag.append(t);
            else { const s = document.createElement('span'); s.className = 'mv-palabra'; s.textContent = t; frag.append(s); }
          });
          h.replaceWith(frag);
        } else if (h.nodeType === 1) parte(h);
      });
    };
    parte(frase);
    const palabras = $$('.mv-palabra', frase);
    frase.classList.add('mv-leer');
    let encendidas = -1;
    mientrasVisible(frase, (y, vh) => {
      const r = frase.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (vh * .9 - r.top) / (vh * .9 - vh * .38)));
      const n = Math.round(p * palabras.length);
      if (n === encendidas) return;
      encendidas = n;
      palabras.forEach((w, i) => w.classList.toggle('mv-on', i < n));
    });
  }

  /* ---- 6 · paralaje del retrato: lo hace movimiento.css con animation-timeline (sin JS por fotograma) ---- */

  /* ---- 7 · foco en «Qué hacemos» e inclinación de las fichas de artistas ---- */
  if (raton) {
    $$('.bento .cell').forEach(c => c.addEventListener('pointermove', e => {
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }));
    $$('.artists .artist').forEach(a => {
      a.addEventListener('pointermove', e => {
        const r = a.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
        a.classList.add('mv-incl');
        a.style.setProperty('--ry', (px * 9).toFixed(2) + 'deg'); a.style.setProperty('--rx', (-py * 7).toFixed(2) + 'deg');
      });
      a.addEventListener('pointerleave', () => { a.classList.remove('mv-incl'); a.style.removeProperty('--rx'); a.style.removeProperty('--ry'); });
    });

    /* ---- 8 · botones imán (fuera de la cabecera: ahí molestaría) ---- */
    $$('main .btn-purple, footer .btn-purple').forEach(b => {
      b.classList.add('mv-iman');
      b.addEventListener('pointermove', e => {
        const r = b.getBoundingClientRect();
        b.style.setProperty('--mgx', ((e.clientX - r.left - r.width / 2) * .22).toFixed(1) + 'px');
        b.style.setProperty('--mgy', ((e.clientY - r.top - r.height / 2) * .32).toFixed(1) + 'px');
      });
      b.addEventListener('pointerleave', () => { b.style.setProperty('--mgx', '0px'); b.style.setProperty('--mgy', '0px'); });
    });
  }

  /* ---- 9 · roster en cascada; «Ver más» escalonado ---- */
  const roster = $('#roster');
  if (roster) {
    [...roster.children].forEach((c, i) => { c.style.setProperty('--i', Math.min(i, 14)); if (i >= 8) c.style.setProperty('--j', i - 8); });
    const listo = () => setTimeout(() => roster.classList.add('mv-listo'), 1400);
    if (roster.classList.contains('in')) listo();
    else if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.disconnect(); listo(); } }), { threshold: .12 });
      io.observe(roster);
    }
  }
  $$('#galeria > .shot').forEach((s, i) => { if (i >= 6) s.style.setProperty('--j', i - 6); });
  $$('#clips-lista > .clip').forEach((s, i) => { if (i >= 10) s.style.setProperty('--j', i - 10); });

  /* ---- 11 · testimonios: dos filas de capturas que avanzan solas en sentido contrario (12-oct-2026) ----
     Cada fila se duplica una vez (la copia, aria-hidden) y se desplaza exactamente lo que mide una vuelta: el bucle no
     tiene costura. Web Animations en la GPU; se para fuera de pantalla, con el ratón encima y con el foco dentro.
     Sin JS o con «reducir movimiento» (este bloque no corre), las filas se deslizan con el dedo. */
  if (!('animate' in Element.prototype)) return;
  $$('.testimonios__fila').forEach(fila => {
    const orig = [...fila.children];
    if (orig.length < 2) return;
    // Una copia basta si una vuelta mide más que la pantalla; si no (fila corta o pantalla muy ancha), el bucle dejaría hueco
    // al final: se añaden copias hasta cubrir el ancho. Las que nacen tarde (al cargar o al ensanchar la ventana) arrancan
    // aquí sus vídeos mudos de data-src, porque el cargador de .evento__video de la portada solo ve los que existen al cargar.
    let copias = 0;
    const copia = tarde => {
      orig.forEach(li => {
        const c = li.cloneNode(true); c.setAttribute('aria-hidden', 'true'); // sin inert: con el ratón también se pulsa la copia
        c.querySelectorAll('a, button').forEach(x => x.setAttribute('tabindex', '-1'));
        if (tarde) c.querySelectorAll('video[data-src]').forEach(v => {
          v.addEventListener('playing', () => v.classList.add('va'), { once: true });
          v.src = v.dataset.src; v.muted = true; v.play().catch(() => {});
        });
        fila.append(c);
      });
      copias++;
    };
    const vueltaDe = () => fila.children[orig.length].offsetLeft - fila.children[0].offsetLeft;
    const cubre = tarde => {
      const v = vueltaDe();
      while (v > 0 && copias < 8 && copias * v < innerWidth + 80) copia(tarde);
    };
    copia(false);
    fila.classList.add('mv-js');
    cubre(false);
    let anim = null, dentro = false, visible = false;
    const monta = () => {
      cubre(true);
      const vuelta = vueltaDe();
      if (vuelta <= 0) return;
      const t = anim ? anim.currentTime / anim.effect.getTiming().duration : 0;
      if (anim) anim.cancel();
      const ida = /__fila--inversa/.test(fila.className);
      anim = fila.animate({ transform: ida ? [`translateX(${-vuelta}px)`, 'translateX(0)'] : ['translateX(0)', `translateX(${-vuelta}px)`] },
                          { duration: vuelta / 32 * 1000, iterations: Infinity, easing: 'linear' });
      anim.currentTime = (t % 1) * anim.effect.getTiming().duration;
      if (!visible || dentro) anim.pause();
    };
    const sigue = () => { if (!anim) return; if (visible && !dentro) anim.play(); else anim.pause(); };
    const para = v => () => { dentro = v; sigue(); };
    // ratón: se para mientras está encima; dedo: un toque la para para leer y otro la suelta
    fila.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') para(true)(); });
    fila.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') para(false)(); });
    fila.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') { dentro = !dentro; sigue(); } });
    fila.addEventListener('focusin', para(true)); fila.addEventListener('focusout', para(false));
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; sigue(); }).observe(fila);
    else visible = true;
    // las imágenes son lazy: la medida buena llega cuando cargan (y al cambiar el ancho de la ventana)
    monta();
    fila.querySelectorAll('img').forEach(im => { if (!im.complete) im.addEventListener('load', monta, { once: true }); });
    let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(monta, 200); });
  });
})();
