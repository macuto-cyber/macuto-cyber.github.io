/* macutomusic.com/contrato — asistente de datos y firma del contrato Sistema DAP (v2, 16-sep-2026).
   El token (256 bits) viaja en el FRAGMENTO de la URL (#…): nunca llega a GitHub Pages ni a ningún proxy.
   Los datos, el PDF y las firmas los sirve la API del M5 (firmar.macutomusic.com/api/sobre/<token>).
   Solo se acepta otra API cuando la página se abre en localhost (pruebas). ES5 a propósito (móviles viejos). */
(function () {
  'use strict';
  var app = document.getElementById('app');
  var TOKEN = (location.hash || '').replace(/^#/, '').trim();
  if (!/^[\w\-]{20,64}$/.test(TOKEN)) TOKEN = '';           // solo del fragmento, y solo con la forma esperada
  var LOCAL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
  // vuelta desde Stripe: ?pago=ok&cs=… sin fragmento → el enlace se recupera de esta misma pestaña
  var PAGO = (/[?&]pago=(ok|cancelado)(?:&|$)/.exec(location.search) || [])[1] || '';
  var CS = (/[?&]cs=(cs_(?:test|live)_[A-Za-z0-9]{10,240})(?:&|$)/.exec(location.search) || [])[1] || '';
  function sget(k) { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function sset(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { } }
  if (!TOKEN && PAGO && /^[\w\-]{20,64}$/.test(sget('dap-vuelta'))) {
    TOKEN = sget('dap-vuelta');
    try { history.replaceState(null, '', location.pathname + location.search + '#' + TOKEN); } catch (e) { }
  }
  var apiParam = /[?&]api=([^&]+)/.exec(location.search);
  var apiLocal = apiParam ? decodeURIComponent(apiParam[1]) : sget('dap-api');
  if (LOCAL && apiParam) sset('dap-api', apiLocal);
  var API_BASE = (LOCAL && apiLocal) ? apiLocal.replace(/\/$/, '') : 'https://firmar.macutomusic.com';
  var API = API_BASE + '/api/sobre/' + TOKEN;
  var S = null;   // último estado recibido de la API
  // sesión de acceso (documento o código antiguo): solo en sessionStorage (se borra al cerrar la pestaña); nunca en localStorage
  var SKEY = 'dap-ses-' + TOKEN.slice(0, 8);
  function ses() { try { return sessionStorage.getItem(SKEY) || ''; } catch (e) { return ''; } }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel) { return document.querySelector(sel); }
  function card(inner) { return '<div class="ct-card">' + inner + '</div>'; }
  var LINK = 'color:var(--purple);text-decoration:underline;font-weight:600';   // enlaces que se tienen que ver como enlaces
  function foot() { return '<p class="ct-foot">¿Dudas? Escríbenos por WhatsApp al <a href="https://wa.me/34630060006" target="_blank" rel="noopener">+34 630 06 00 06</a>.</p>'; }
  function msg(t, p, sub, extra) { app.innerHTML = '<h1>' + esc(t) + '</h1>' + card('<p>' + esc(p) + '</p>' + (sub ? '<p class="ct-mut">' + esc(sub) + '</p>' : '') + (extra || '')) + foot(); window.scrollTo(0, 0); }
  function api(path, opts) {
    opts = opts || {};
    var o = { method: opts.method || 'GET', headers: {} , credentials: 'omit', mode: 'cors', cache: 'no-store' };
    if (ses()) o.headers['X-Sobre-Sesion'] = ses();
    if (opts.body !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(opts.body); }
    return fetch(API + (path || ''), o).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); });
  }
  // PDF y páginas: con la sesión en CABECERA (en la URL quedaba en el historial del navegador y en el túnel)
  function blobDe(path) {
    var o = { method: 'GET', headers: {}, credentials: 'omit', mode: 'cors', cache: 'no-store' };
    if (ses()) o.headers['X-Sobre-Sesion'] = ses();
    return fetch(API + path, o).then(function (r) { if (!r.ok) { var e = new Error('http ' + r.status); e.status = r.status; throw e; } return r.blob(); });
  }
  function abrirPdf(ev, ruta, nombre) {
    if (ev) ev.preventDefault();
    ruta = ruta || '/pdf'; nombre = nombre || 'Contrato_Sistema_DAP.pdf';
    var w = null; try { w = window.open('', '_blank'); } catch (e) { }
    if (w) { try { w.document.title = 'Documento'; w.document.body.innerHTML = '<p style="font-family:sans-serif;padding:20px">Abriendo el documento…</p>'; } catch (e) { } }
    return blobDe(ruta).then(function (b) {
      var u = URL.createObjectURL(b);
      if (w) { w.location.href = u; } else { var a = document.createElement('a'); a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); }
      setTimeout(function () { URL.revokeObjectURL(u); }, 120000);
    }).catch(function (e) { if (w) { try { w.close(); } catch (e2) { } } if (e && e.status === 401) load(); else alert('No se pudo abrir el PDF. Inténtalo de nuevo.'); });
  }
  var RGPD = '<p class="ct-small ct-mut"><b>Tus datos.</b> Responsable: Angelo Jordan Gutiérrez Luis (Macuto Music). Finalidad: preparar, firmar y ejecutar el contrato y facturar. Base: el propio contrato y las obligaciones legales. Derechos de acceso, rectificación y supresión en macuto@macutomusic.com. Más información: cláusula 11 del contrato.</p>';

  if (!TOKEN) { msg('Enlace no válido', 'Este enlace no lleva la clave del contrato. Pide al equipo que te lo reenvíe.'); return; }

  // ─────────────────────────────────────────────── carga y enrutado por «vista»
  var pollTimer = null;
  var reintentos = 0;
  function reintentar(texto) {
    if (pollTimer) clearTimeout(pollTimer);
    reintentos++;
    var espera = Math.min(15000 * reintentos, 60000);
    msg(texto, 'Volvemos a intentarlo en ' + Math.round(espera / 1000) + ' segundos. No se ha perdido nada.', '', '<p><button type="button" class="ct-btn sec" id="retry">Reintentar ahora</button></p>');
    var b = $('#retry'); if (b) b.addEventListener('click', function () { if (pollTimer) clearTimeout(pollTimer); load(); });
    pollTimer = setTimeout(load, espera);
  }
  function load() {
    api('').then(function (r) {
      if (!r.ok || !r.j) {
        if (r.status === 401 && r.j && r.j.vista) { try { sessionStorage.removeItem(SKEY); } catch (e) { } return render(r.j); }
        if (r.status === 410 || (r.j && (r.j.vista === 'caducado' || r.j.vista === 'anulado'))) return render({ vista: r.j && r.j.vista || 'caducado' });
        if (r.status === 404) return msg('Enlace no válido', 'Este enlace no corresponde a ningún contrato. Pide al equipo que te lo reenvíe.');
        return reintentar('No se pudo cargar tu contrato');
      }
      reintentos = 0;
      render(r.j);
    }).catch(function () { reintentar('Sin conexión con el servidor'); });
  }
  function render(st) {
    S = st;
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
    switch (st.vista) {
      case 'anulado': return msg('Este enlace ya no es válido', 'El contrato se ha sustituido por otra versión. Pide el enlace nuevo al equipo.');
      case 'caducado': return msg('Este enlace ha caducado', 'La oferta tenía una validez de 48 horas. Si sigues interesado, escribe al equipo y te preparamos un enlace nuevo.');
      case 'pin': return vistaPin(st);
      case 'pin_bloqueado': return msg('Acceso bloqueado', 'Se han agotado los intentos. Escribe a tu contacto del equipo: revisarán tus datos y te volverán a abrir el enlace.');
      case 'copia_caducada': return msg('Este enlace ya no sirve la copia', 'Han pasado más de treinta días desde la firma. Pide tu copia del contrato al equipo por correo.');
      case 'ya_firmaste': return vistaYaFirmaste(st);
      case 'pago': return vistaPago(st);
      case 'asistente': return vistaAsistente(st);
      case 'preparando': msg('Preparando tu contrato…', 'Estamos generando el documento con los datos confirmados. Esta página se actualiza sola.', 'Suele tardar menos de un minuto. Si pasan más de diez, escribe al equipo.'); pollTimer = setTimeout(load, 8000); return;
      case 'error': return msg('Un momento', 'El equipo está revisando tu contrato y te avisará cuando esté listo para firmar.');
      case 'espera_macuto': msg('Casi listo', 'Macuto Music está revisando y firmando la oferta de tu contrato. En cuanto lo haga, este mismo enlace te dejará revisarlo y firmarlo; el equipo te avisará.', 'Puedes cerrar esta página y volver más tarde.'); pollTimer = setTimeout(load, 20000); return;
      case 'revision': msg('Estamos revisando los datos', st.revision_mia ? 'Nos has avisado de un error. El equipo lo está revisando y te avisará cuando el contrato corregido esté listo; lo firmarás desde este mismo enlace.' : 'Uno de los firmantes ha avisado de un error en los datos. El equipo lo está revisando y, en cuanto esté listo, podrás firmar desde este mismo enlace.', 'Esta página se actualiza sola.'); pollTimer = setTimeout(load, 30000); return;
      case 'firma': return vistaFirma(st);
      default: return msg('Enlace no válido', 'Pide al equipo que te lo reenvíe.');
    }
  }
  // ACCESO (16-sep, noche): cada firmante entra con SU documento (DNI, NIE o pasaporte), sin códigos que mandar.
  // Los sobres anteriores (st.pide === 'codigo') siguen con el código de seis cifras.
  function vistaPin(st) {
    if (st.pide === 'codigo') return vistaCodigo(st);
    var quien = st.rol_clave === 'REPRESENTANTE' ? 'Escribe tu DNI, NIE o pasaporte: el de la persona que firma por la empresa.' : 'Escribe tu DNI, NIE o pasaporte.';
    var intro = 'Para proteger tus datos, este enlace solo se abre con tu documento de identidad: el que figura (o figurará) en tu contrato. ' + quien;
    app.innerHTML = '<h1>' + esc(st.titulo || 'Contrato Sistema DAP') + '</h1>' + card('<h2>Entra con tu documento</h2><p>' + esc(intro) + '</p>' +
      '<form id="acc" novalidate><div class="ct-field" id="f-doc"><label for="doc">DNI, NIE o pasaporte</label><input id="doc" name="doc" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" maxlength="24" enterkeyhint="go" placeholder="12345678A"><div class="ct-err"></div></div>' +
      '<div class="ct-errbox" id="errbox"></div><button type="submit" class="ct-btn" id="pin-go">Entrar</button></form>' +
      '<p class="ct-small ct-mut">El número con su letra; da igual si pones puntos, guiones o minúsculas. La sesión dura dos horas y se cierra al cerrar la pestaña. Si no te deja entrar, escribe a tu contacto del equipo.</p>') + foot();
    window.scrollTo(0, 0);
    var inp = $('#doc'); inp.focus();
    function go() {
      var v = (inp.value || '').replace(/[\s.\-\/]/g, '');
      if (v.length < 5) { $('#errbox').textContent = 'Escribe el número completo de tu documento.'; $('#errbox').style.display = 'block'; return; }
      var b = $('#pin-go'); if (b.disabled) return; b.disabled = true;
      api('/pin', { method: 'POST', body: { doc: v } }).then(function (r) {
        b.disabled = false;
        if (r.ok && r.j && r.j.ok) { try { sessionStorage.setItem(SKEY, r.j.s || ''); } catch (e) { } load(); return; }
        if (r.j && r.j.vista === 'pin_bloqueado') return render({ vista: 'pin_bloqueado' });
        $('#errbox').textContent = ((r.j && r.j.error) || 'No se pudo comprobar el documento.') + (r.j && r.j.quedan != null ? ' Te quedan ' + r.j.quedan + ' intentos.' : ''); $('#errbox').style.display = 'block';
      }).catch(function () { b.disabled = false; $('#errbox').textContent = 'Problema de conexión. Inténtalo de nuevo.'; $('#errbox').style.display = 'block'; });
    }
    $('#acc').addEventListener('submit', function (e) { e.preventDefault(); go(); });   // Intro y el botón «Ir» del móvil
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  }
  function vistaCodigo(st) {
    app.innerHTML = '<h1>' + esc(st.titulo || 'Contrato Sistema DAP') + '</h1>' + card('<h2>Código de acceso</h2><p>Para proteger tus datos, este enlace solo se abre con el <b>código de seis cifras</b> que te ha dado el equipo por llamada o por correo (no viene en el mensaje del enlace).</p>' +
      '<div class="ct-field" id="f-pin"><label for="pin">Código de acceso</label><input id="pin" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" placeholder="······"><div class="ct-err"></div></div>' +
      '<div class="ct-errbox" id="errbox"></div><button type="button" class="ct-btn" id="pin-go">Entrar</button>' +
      '<p class="ct-small ct-mut">¿No tienes el código? Pídeselo a tu contacto del equipo. La sesión dura dos horas y se cierra al cerrar la pestaña.</p>') + foot();
    window.scrollTo(0, 0);
    var inp = $('#pin'); inp.focus();
    function go() {
      var v = (inp.value || '').replace(/\D/g, '');
      if (v.length !== 6) { $('#errbox').textContent = 'El código tiene seis cifras.'; $('#errbox').style.display = 'block'; return; }
      var b = $('#pin-go'); b.disabled = true;
      api('/pin', { method: 'POST', body: { pin: v } }).then(function (r) {
        b.disabled = false;
        if (r.ok && r.j && r.j.ok) { try { sessionStorage.setItem(SKEY, r.j.s || ''); } catch (e) { } load(); return; }
        if (r.j && r.j.vista === 'pin_bloqueado') return render({ vista: 'pin_bloqueado' });
        $('#errbox').textContent = ((r.j && r.j.error) || 'No se pudo comprobar el código.') + (r.j && r.j.quedan != null ? ' Te quedan ' + r.j.quedan + ' intentos.' : ''); $('#errbox').style.display = 'block';
      }).catch(function () { b.disabled = false; $('#errbox').textContent = 'Problema de conexión. Inténtalo de nuevo.'; $('#errbox').style.display = 'block'; });
    }
    $('#pin-go').addEventListener('click', go);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  }
  // ─── «Tus siguientes pasos» (17-sep; 18-sep sin hoja de ruta): ficha de alta, pago, onboarding (y empezar ya) y equipo ───
  function enlaceContacto(c) {
    var t = String(c || ''), dig = t.replace(/[^\d+]/g, '');
    if (/@/.test(t)) { var m = t.match(/[\w.+-]+@[\w.-]+/); return m ? '<a href="mailto:' + esc(m[0]) + '">' + esc(t) + '</a>' : esc(t); }
    if (/whatsapp/i.test(t) && dig.length >= 10) return '<a href="https://wa.me/' + esc(dig.replace(/^\+/, '')) + '" target="_blank" rel="noopener">' + esc(t) + '</a>';
    return esc(t);
  }
  function pintarSiguientes(SP) {
    var h = '<h2>Tus siguientes pasos</h2>';
    h += '<div class="ct-paso"><b>1 · Completa tu ficha de alta</b>' + (SP.alta_recibida
      ? '<p class="ct-okbox">✓ Recibida. ¡Gracias!</p>'
      : '<p class="ct-small ct-mut">Unos cinco minutos. Con ella preparamos tu diagnóstico antes del onboarding.</p><a class="ct-btn" href="' + esc(SP.tally_url) + '" target="_blank" rel="noopener">Abrir mi ficha de alta</a>') + '</div>';
    // 2 · el pago activa el contrato (cl. 6.1). No se cobra aquí: tarjeta con el enlace del equipo o transferencia con la referencia
    var PG = SP.pago || {}, pag;
    if (PG.pagado) {
      pag = '<p class="ct-okbox">✓ Pago recibido' + (PG.fecha ? ' el ' + esc(PG.fecha) : '') + (PG.via ? ' por ' + esc(PG.via) : '') + '. Tu contrato está <b>activado</b>.</p>';
      if (PG.segundo) pag += '<p class="ct-small">' + (PG.segundo.pagado ? '✓ Segundo pago de ' + esc(PG.segundo.importe) + ' € recibido.' : 'Segundo pago: <b>' + esc(PG.segundo.importe) + ' €</b> como tarde el ' + esc(PG.segundo.vence) + ' (te avisamos antes).') + '</p>';
    } else if (PG.vencido) {
      pag = '<p class="ct-errbox" style="display:block">El plazo para pagar terminó el ' + esc(PG.limite) + '. Escríbenos y lo vemos contigo.</p>';
    } else {
      pag = '<p>Tu contrato se activa con el pago' + (PG.dos ? ' del primer plazo' : '') + ': <b>' + esc(PG.dos ? PG.pago_1 : PG.total) + ' €</b>' +
        (PG.iva_txt ? ' (' + esc(PG.iva_txt) + ')' : '') + (PG.limite ? ', como tarde el <b>' + esc(PG.limite) + '</b>' : ' en la semana siguiente a la firma') + '.</p>' +
        (PG.dos ? '<p class="ct-small ct-mut">Son dos pagos iguales sin recargo: el segundo, ' + esc(PG.pago_2) + ' €, un mes después (te avisamos antes). Si prefieres pagarlo todo ya, son ' + esc(PG.total) + ' €.</p>' : '') +
        '<ul class="ct-pago"><li><b>Con tarjeta:</b> te enviamos el enlace de pago seguro (Stripe) a tu correo o WhatsApp. Usa el mismo correo del contrato.</li>' +
        '<li><b>Por transferencia:</b> ' + (PG.iban ? 'a ' + esc(PG.titular || 'Macuto Music') + ', IBAN <b>' + esc(PG.iban) + '</b>, ' : 'pídenos los datos y ') +
        'pon en el concepto <b class="ct-ref">' + esc(PG.concepto || PG.referencia) + '</b>. Con esa referencia la reconocemos sola.</li></ul>' +
        '<p class="ct-small ct-mut">Cuando llegue tu pago lo verás aquí, normalmente en unas horas (las transferencias pueden tardar uno o dos días hábiles).</p>';
    }
    h += '<div class="ct-paso"><b>2 · ' + (PG.pagado ? 'Pago' : 'Paga para activar tu contrato') + '</b>' + pag + '</div>';
    var ses;
    if (SP.onboarding_hecho) ses = '<p class="ct-okbox">✓ Onboarding hecho el ' + esc(SP.onboarding_hecho) + '. Tu contrato dura hasta el <b>' + esc(SP.fin_contrato) + '</b>.</p>';
    else if (!PG.pagado) ses = '<p class="ct-small">En cuanto recibamos tu pago, tu label manager te escribe para elegir juntos el día de tu onboarding: una videollamada de unos ' + SP.minutos + ' minutos para arrancar tu plan.</p>';
    else if (SP.cita) ses = '<p class="ct-okbox">✓ Tu sesión de onboarding es el <b>' + esc(SP.cita) + '</b> (unos ' + SP.minutos + ' minutos por videollamada). Te llega la invitación con el enlace.</p>';
    else if (SP.reserva_url && !SP.desde_dia15) ses = '<p class="ct-small ct-mut">Elige día y hora ' + esc(SP.ventana) + '.</p><a class="ct-btn" href="' + esc(SP.reserva_url) + '" target="_blank" rel="noopener">Reservar mi sesión</a>';
    else ses = '<p class="ct-small">Tu label manager te escribirá' + (SP.limite_contacto ? ' como tarde el <b>' + esc(SP.limite_contacto) + '</b>' : '') + ' para proponerte fechas ' + esc(SP.ventana) + '. La sesión dura unos ' + SP.minutos + ' minutos por videollamada.</p>';
    if (SP.puede_empezar_ya && !SP.onboarding_hecho) {
      ses += '<div class="ct-card ct-sub"><p class="ct-small">¿Te apetece empezar antes? Podemos agendar tu onboarding en cuanto llegue tu pago.</p>' +
        '<label class="ct-chk"><input type="checkbox" id="ya-chk"> <span><b>' + esc(SP.empezar_ya_titulo || SP.texto_empezar_ya) + '</b>' +
        (SP.empezar_ya_detalle ? '<br><span class="ct-small ct-mut">' + esc(SP.empezar_ya_detalle) + '</span>' : '') + '</span></label>' +
        '<button type="button" class="ct-btn sec" id="ya-go" disabled>Empezar ya</button><p id="ya-msg" class="ct-small"></p></div>';
    } else if (SP.empezar_ya && !SP.cita && !SP.onboarding_hecho) {
      ses += '<p class="ct-small ct-mut">Has pedido empezar ya: ' + (PG.pagado ? 'te propondremos las primeras fechas libres.' : 'en cuanto conste tu pago te propondremos las primeras fechas libres.') + '</p>';
    }
    h += '<div class="ct-paso"><b>3 · Tu sesión de onboarding</b>' + ses + '</div>';
    if (SP.equipo && SP.equipo.length) {
      h += '<div class="ct-paso"><b>4 · Tu equipo</b><p class="ct-small ct-mut">Guarda estos contactos.</p><ul class="ct-equipo">' +
        SP.equipo.map(function (p) { return '<li><b>' + esc(p.nombre) + '</b><br><span class="ct-small ct-mut">' + esc(p.rol) + '</span><br>' + enlaceContacto(p.contacto) + '</li>'; }).join('') + '</ul></div>';
    }
    var cont = document.createElement('div'); cont.className = 'ct-card'; cont.innerHTML = h;
    var ref = app.querySelector('.ct-foot'); app.insertBefore(cont, ref);
    var chk = $('#ya-chk'), go = $('#ya-go');
    if (chk && go) {
      chk.addEventListener('change', function () { go.disabled = !chk.checked; });
      go.addEventListener('click', function () {
        go.disabled = true;
        api('/empezar', { method: 'POST', body: { acepto: true, texto: SP.texto_empezar_ya } }).then(function (r) {
          var m = $('#ya-msg');
          if (r.ok && r.j && r.j.ok) { m.textContent = '✓ ' + r.j.mensaje; setTimeout(load, 1500); return; }
          go.disabled = false; m.textContent = '❌ ' + ((r.j && r.j.mensaje) || 'No se pudo registrar.'); m.style.color = '#b3261e';
        }).catch(function () { go.disabled = false; });
      });
    }
  }
  function vistaPago(st) {
    var DOS = st.plan === 'dos' && st.importe_pago2;
    var h = '<div class="ct-steps">' + '<i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i>' + '</div>' +
      '<p class="ct-small ct-mut">Último paso</p><h1>Paga y activa tu contrato</h1>';
    var aviso = PAGO === 'cancelado' ? '<p class="ct-errbox" style="display:block">Has vuelto sin completar el pago. Puedes intentarlo de nuevo cuando quieras.</p>' : '';
    var prueba = st.pago_modo === 'test' ? '<p class="ct-errbox" style="display:block"><b>Modo PRUEBA:</b> no se cobra nada. Tarjeta 4242 4242 4242 4242, cualquier fecha futura y cualquier CVC.</p>' : '';
    h += card(aviso + '<p class="ct-okbox">✓ Contrato firmado el ' + esc(st.firmado_ts) + '.</p>' +
      (DOS
        ? '<p style="font-size:1.15rem;margin:12px 0 4px">Hoy pagas: <b>' + esc(st.importe_hoy) + ' €</b></p><p class="ct-small ct-mut">Primer pago de dos · total ' + esc(st.importe) + ' € · ' + esc(st.iva_txt) + '</p>' +
          '<dl class="ct-res"><dt>Alta y Onboarding</dt><dd>' + esc(st.importe_alta) + ' €</dd><dt>Servicio anual (primera parte)</dt><dd>' + esc(st.importe_servicio_hoy) + ' €</dd>' +
          '<dt>Segundo pago, dentro de un mes</dt><dd>' + esc(st.importe_pago2) + ' €</dd></dl>' +
          '<p class="ct-small">El segundo pago se cobra automáticamente con la misma tarjeta un mes después, y te avisamos antes. Sin recargo y sin renovación automática: el contrato dura 12 meses desde el onboarding.</p>'
        : '<p style="font-size:1.15rem;margin:12px 0 4px">Total: <b>' + esc(st.importe) + ' €</b></p><p class="ct-small ct-mut">' + esc(st.iva_txt) + ' · pago único · 12 meses · sin renovación automática</p>' +
          '<dl class="ct-res"><dt>Alta y Onboarding</dt><dd>' + esc(st.importe_alta) + ' €</dd><dt>Servicio anual (12 meses)</dt><dd>' + esc(st.importe_servicio) + ' €</dd></dl>') +
      prueba + '<button type="button" class="ct-btn" id="pagar">Pagar ' + esc(DOS ? st.importe_hoy : st.importe) + ' € con tarjeta</button><p id="msg" class="ct-small"></p>' +
      '<p class="ct-small ct-mut">Pagas en la página segura de Stripe (tarjeta, Apple Pay o Google Pay) y vuelves aquí. El contrato se activa con el pago y el equipo te envía la factura' + (st.email_pago ? ' a ' + esc(st.email_pago) : '') + '.</p>' +
      '<p class="ct-small ct-mut">¿Prefieres transferencia? Escríbenos y te pasamos los datos.</p>');
    app.innerHTML = h + foot();
    window.scrollTo(0, 0);
    var b = $('#pagar'), m = $('#msg');
    b.addEventListener('click', function () {
      b.disabled = true; m.textContent = 'Abriendo la página de pago…'; m.style.color = '';
      api('/pago', { method: 'POST', body: {} }).then(function (r) {
        if (r.ok && r.j && r.j.url) { sset('dap-vuelta', TOKEN); location.href = r.j.url; return; }
        if (r.ok && r.j && r.j.pagado) { load(); return; }
        if (r.status === 401) { load(); return; }
        b.disabled = false; m.textContent = '❌ ' + ((r.j && r.j.error) || 'No se pudo abrir el pago.'); m.style.color = '#b3261e';
      }).catch(function () { b.disabled = false; m.textContent = '❌ Problema de conexión. Inténtalo de nuevo.'; m.style.color = '#b3261e'; });
    });
    if (PAGO === 'ok' && CS) {       // vuelve de Stripe: se comprueba el pago en el servidor (unos intentos: Stripe puede tardar segundos)
      b.disabled = true; m.textContent = 'Comprobando tu pago…';
      var intentos = 0;
      (function comprobar() {
        api('/pago/confirmar', { method: 'POST', body: { cs: CS } }).then(function (r) {
          if (r.ok && r.j && r.j.pagado) {
            PAGO = ''; CS = ''; try { sessionStorage.removeItem('dap-vuelta'); } catch (e) { }
            try { history.replaceState(null, '', location.pathname + (apiParam ? '?api=' + apiParam[1] : '') + '#' + TOKEN); } catch (e) { }
            load(); return;
          }
          if (++intentos < 6 && (r.status === 409 || r.status === 502)) { setTimeout(comprobar, 3000); return; }
          b.disabled = false; m.textContent = (r.j && r.j.error) || 'Todavía no vemos el pago. Si ya pagaste, escríbenos.'; m.style.color = '#b3261e';
        }).catch(function () { if (++intentos < 6) setTimeout(comprobar, 3000); });
      })();
    }
  }
  function vistaYaFirmaste(st) {
    if (st.caducado && !st.todo_firmado) {
      return msg('La oferta caducó', 'Firmaste el ' + st.firmado_ts + ', pero la oferta caducó antes de que firmaran todas las partes, así que el contrato no llegó a cerrarse. El equipo se pondrá en contacto contigo para prepararte uno nuevo.');
    }
    if (!st.todo_firmado && st.status === 'sellando') {
      msg('✅ Ya firmaste', 'Tu firma quedó registrada el ' + st.firmado_ts + '. Estamos sellando el contrato con todas las firmas; en unos segundos podrás descargar tu copia.', 'Esta página se actualiza sola.');
      pollTimer = setTimeout(load, 10000); return;
    }
    var cuerpo = 'Tu firma quedó registrada el ' + st.firmado_ts + '. ' + (st.todo_firmado ? 'El contrato ya está firmado por todas las partes: puedes descargar tu copia con el certificado de firmas (este enlace la sirve durante treinta días; después, pídela al equipo).' : 'Cuando firmen todas las partes recibirás tu copia con el certificado de firmas.');
    var extra = st.pagado ? '<p class="ct-okbox">✓ Pago recibido.' + (st.activado ? ' Tu contrato está <b>activado</b>: el equipo te escribirá para el onboarding.' : ' El contrato se activa en cuanto quede sellado.') + '</p>' : '';
    if (st.pago2) extra += '<p class="ct-small">' + (st.pago2.pagado ? '✓ Segundo pago de ' + esc(st.pago2.importe) + ' € recibido.' : 'Segundo pago: <b>' + esc(st.pago2.importe) + ' €</b> el ' + esc(st.pago2.vence) + ', con la misma tarjeta (te avisamos antes).') + '</p>';
    if (st.copia_email) extra += '<p class="ct-small ct-mut">Te enviamos también la copia firmada a tu correo.</p>';
    var SP = st.siguientes;
    if (SP) extra = extra.replace('el equipo te escribirá para el onboarding.', 'abajo tienes tus siguientes pasos.');
    if (SP && !st.pagado && st.todo_firmado) extra = '<p class="ct-okbox">Siguiente paso: <b>rellena tu ficha de alta y paga para activar tu contrato</b>. Te lo explicamos abajo.</p>' + extra;
    msg(st.pagado ? '✅ Firmado y pagado' : '✅ Ya firmaste', cuerpo, '', extra + (st.todo_firmado ? '<p><button type="button" class="ct-btn" id="dl">Descargar el contrato firmado (PDF)</button></p>' : ''));
    var dl = $('#dl'); if (dl) dl.addEventListener('click', function (e) { abrirPdf(e); });
    if (SP) pintarSiguientes(SP);
    if (!st.todo_firmado) pollTimer = setTimeout(load, 30000);
  }

  // ─────────────────────────────────────────────── ASISTENTE DE DATOS
  function vistaAsistente(st) {
    var C = st.config, D = {}, k;
    for (k in st.prefill) if (Object.prototype.hasOwnProperty.call(st.prefill, k)) D[k] = st.prefill[k];
    var KEY = 'dap-datos-' + TOKEN.slice(0, 8);   // borrador SOLO en sessionStorage: muere al cerrar la pestaña (lleva DNI y domicilio)
    try { var b = JSON.parse(sessionStorage.getItem(KEY) || '{}'); if (b && b.t && Date.now() - b.t < 24 * 3600e3) { for (k in b.d) D[k] = b.d[k]; } else sessionStorage.removeItem(KEY); } catch (e) { }
    // 18-sep: en un sobre «auto» el MODELO lo deciden las respuestas del cliente («¿quién contrata?»); la forma de pago
    // la fija siempre el equipo y aquí solo se muestra. El Anexo I.5 ya no se pregunta: va al formulario de alta.
    function M() { return st.modelo_auto ? (D.modelo || '') : st.modelo; }
    var EMP = false, UE = C.ue, PA = C.paises, DOCS = C.docs, DEF = C.docs_defecto;
    function blancoUrl() { return API + '/blanco' + (st.modelo_auto && M() ? '?m=' + encodeURIComponent(M()) : ''); }
    // al cambiar de «persona» a «empresa» (o al revés), lo que ya sabíamos pasa al campo equivalente
    function migrar() {
      var pares = [['cliente_nombre', 'representante_nombre'], ['cliente_doc_tipo', 'representante_doc_tipo'], ['cliente_doc_numero', 'representante_doc_numero'],
        ['cliente_email', 'empresa_email'], ['cliente_telefono', 'empresa_telefono']];
      var aEmp = M() === 'empresa' || M() === 'empresa_artista';
      for (var i = 0; i < pares.length; i++) { var de = pares[i][aEmp ? 0 : 1], a = pares[i][aEmp ? 1 : 0]; if (D[de] && !D[a]) D[a] = D[de]; }
    }
    function save() { try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), d: D })); } catch (e) { } }
    function eur(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
    function inp(id, o) { o = o || {}; return '<div class="ct-field" id="f-' + id + '"><label for="' + id + '">' + o.l + '</label>' + (o.t === 'textarea' ? '<textarea id="' + id + '" rows="4" maxlength="' + (o.max || 1500) + '">' + esc(D[id] || '') + '</textarea>' : '<input id="' + id + '" type="' + (o.type || 'text') + '" value="' + esc(D[id] || '') + '"' + (o.ac ? ' autocomplete="' + o.ac + '"' : '') + (o.im ? ' inputmode="' + o.im + '"' : '') + ' maxlength="' + (o.max || 120) + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + '>') + (o.h ? '<div class="ct-hint">' + o.h + '</div>' : '') + '<div class="ct-err"></div></div>'; }
    function opts(id, l, list, h) { return '<div class="ct-field" id="f-' + id + '"><label>' + l + '</label>' + list.map(function (o) { var on = D[id] === o[0]; return '<button type="button" class="ct-opt' + (on ? ' on' : '') + '" data-k="' + id + '" data-v="' + esc(o[0]) + '" aria-pressed="' + (on ? 'true' : 'false') + '"><b>' + esc(o[1]) + '</b>' + (o[2] ? '<span>' + esc(o[2]) + '</span>' : '') + '</button>'; }).join('') + (h ? '<div class="ct-hint">' + h + '</div>' : '') + '<div class="ct-err" role="alert"></div></div>'; }
    function sel(id, l, list, h) { return '<div class="ct-field" id="f-' + id + '"><label for="' + id + '">' + l + '</label><select id="' + id + '"><option value="">Elige…</option>' + list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (D[id] === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>' + (h ? '<div class="ct-hint">' + h + '</div>' : '') + '<div class="ct-err" role="alert"></div></div>'; }
    function fecha(id, l) { var v = (D[id] || '').split('-'); return '<div class="ct-field" id="f-' + id + '"><label>' + l + '</label><div class="ct-row3"><input id="' + id + '_d" inputmode="numeric" placeholder="Día" maxlength="2" value="' + esc(v[2] || '') + '"><input id="' + id + '_m" inputmode="numeric" placeholder="Mes" maxlength="2" value="' + esc(v[1] || '') + '"><input id="' + id + '_y" inputmode="numeric" placeholder="Año" maxlength="4" value="' + esc(v[0] || '') + '"></div><div class="ct-hint">Por ejemplo: 27 · 3 · 1998</div><div class="ct-err"></div></div>'; }
    function dom(id, l) { var d = D[id] || {}; if (typeof d === 'string') d = { calle: d }; return '<div class="ct-field" id="f-' + id + '"><label>' + l + '</label><input id="' + id + '_calle" placeholder="Calle y número" autocomplete="street-address" value="' + esc(d.calle || '') + '"><div class="ct-hint">Calle, avenida… y número</div><input id="' + id + '_piso" placeholder="Piso, puerta, apto. (opcional)" style="margin-top:8px" value="' + esc(d.piso || '') + '"><div class="ct-row" style="margin-top:8px"><input id="' + id + '_cp" placeholder="Código postal" autocomplete="postal-code" value="' + esc(d.cp || '') + '"><input id="' + id + '_ciudad" placeholder="Ciudad" autocomplete="address-level2" value="' + esc(d.ciudad || '') + '"></div><input id="' + id + '_prov" placeholder="Provincia / estado (opcional)" autocomplete="address-level1" style="margin-top:8px" value="' + esc(d.provincia || '') + '"><div class="ct-err"></div></div>'; }
    function paisArt() { return D.artista_pais || D.pais || ''; }
    function docTipos(p) { return (DOCS[p || D.pais] || DEF).map(function (t) { return [t, t]; }); }
    function docBlock(pref, l) { var p = (pref === 'artista') ? paisArt() : D.pais; return opts(pref + '_doc_tipo', 'Tipo de documento ' + l, docTipos(p)) + inp(pref + '_doc_numero', { l: 'Número de documento', ph: p === 'ES' ? '12345678A' : '', ac: 'off' }); }
    // el documento de la factura copia el del cliente/empresa y lo SIGUE copiando mientras nadie lo cambie a mano
    function syncFac(doc) { doc = doc || ''; if (!D.factura_nif || D.factura_nif === D._fac_auto) { D.factura_nif = doc; D._fac_auto = doc; } }
    function selArtPais() { if (!D.artista_pais) D.artista_pais = D.pais || ''; return sel('artista_pais', 'País de residencia del artista', PA); }
    function nombrePais(c) { var p = PA.filter(function (x) { return x[0] === c; })[0]; return p ? p[1] : ''; }
    function paisArtTxt() { return D.artista_pais === 'OT' ? (D.artista_pais_otro || '') : nombrePais(D.artista_pais); }
    function artOtro() { return D.artista_pais === 'OT' ? inp('artista_pais_otro', { l: '¿En qué país reside el artista?', ac: 'off' }) : ''; }
    var STEPS = [];
    function build() {
      STEPS = [];
      EMP = M() === 'empresa' || M() === 'empresa_artista';
      STEPS.push({ id: 'intro', t: st.titulo, r: function () { return '<p>Vamos a completar el contrato con tus datos. Los pondremos en el documento tal como los escribas, y podrás revisar el contrato entero antes de firmar.</p><p class="ct-mut">Tardarás unos 3 minutos. Ten a mano tu documento de identidad' + (EMP ? ' y los datos registrales de la empresa' : '') + '. Tu progreso se guarda mientras no cierres esta pestaña.</p><p class="ct-small"><a href="' + blancoUrl() + '" target="_blank" rel="noopener">Ver el contrato completo (versión en blanco, PDF)</a> · <a href="/contrato/como-se-firma.html" target="_blank" rel="noopener">Cómo se firma</a></p>' + RGPD; }, v: function () { return true; } });
      if (st.modelo_auto) STEPS.push({ id: 'quien', t: '¿Quién contrata?', r: function () {
        return '<p class="ct-mut">Con tu respuesta preparamos el contrato oficial que te corresponde.</p>' + opts('modelo', '¿Quién firma el contrato como cliente y recibe la factura?', [
          ['particular', 'Yo, como persona', 'Eres el artista, o su mánager o productor a título personal (también si eres autónomo). La factura irá a tu nombre.'],
          ['empresa', 'Una empresa, para su propio proyecto', 'La sociedad del artista o del grupo, o una productora con su propio proyecto. Firma su representante y la factura va a la empresa.'],
          ['empresa_artista', 'Una empresa, para un artista', 'Un sello, un management o una marca que contrata y paga el programa para un artista. El artista también firmará.']]) +
          ((M() === 'empresa' || M() === 'empresa_artista') ? '<p class="ct-hint">Este enlace es para la persona que firma por la empresa (administrador o apoderado), con el documento con el que has entrado. Si no eres tú, escribe al equipo y le mandamos el enlace a quien corresponda.</p>' : '') +
          (M() ? '<p class="ct-small"><a href="' + blancoUrl() + '" target="_blank" rel="noopener">Ver este contrato en blanco (PDF)</a></p>' : ''); },
        v: function () { return req('modelo'); } });
      if (st.modelo_auto && !M()) {       // hasta que conteste, no hay más pasos que pintar
        STEPS.push({ id: 'rev', t: 'Comprueba tus datos', r: function () { return ''; }, v: function () { return false; } });
        return;
      }
      STEPS.push({ id: 'pais', t: EMP ? '¿Dónde está la empresa?' : '¿Dónde resides?', r: function () {
        var h = sel('pais', EMP ? 'País de la empresa' : 'País de residencia', PA);
        if (D.pais === 'OT') h += inp('pais_otro', { l: '¿Qué país?', ac: 'country-name' });
        if (D.pais === 'ES') h += opts('territorio', '¿En qué territorio?', [['peninsula_baleares', 'Península o Baleares'], ['canarias_ceuta_melilla', 'Canarias, Ceuta o Melilla']]);
        if (!EMP && D.pais === 'ES' && D.territorio === 'canarias_ceuta_melilla') h += opts('alta_autonomo', '¿Estás dado de alta como autónomo y contratas para esa actividad?', [['no', 'No'], ['si', 'Sí', 'Te pediremos tu certificado de situación censal: la factura irá sin IVA español']]);
        if (!EMP && D.pais && UE.indexOf(D.pais) < 0) h += opts('usa_servicio_espana', '¿Vas a usar el servicio en España?', [['no', 'No: el proyecto se desarrolla fuera de España'], ['si', 'Sí: el servicio se usará en España (por ti o por el artista)']]);
        if (EMP && D.pais && (UE.indexOf(D.pais) < 0 || (D.pais === 'ES' && D.territorio === 'canarias_ceuta_melilla'))) h += opts('establecimiento_peninsula', '¿Tiene la empresa un establecimiento en la Península o Baleares al que se destine el servicio?', [['no', 'No'], ['si', 'Sí']]);
        if (D.pais && D.pais !== 'ES' && UE.indexOf(D.pais) >= 0) h += inp('nif_iva', { l: EMP ? 'NIF-IVA de la empresa' : 'NIF-IVA (solo si contratas como profesional y lo tienes)', ph: 'p. ej. DE123456789', ac: 'off', h: 'Con el prefijo del país. Lo comprobamos en VIES. Si no lo indicas o no consta como válido, la factura llevará IVA español (21 %: ' + eur(C.base * (1 + C.iva)) + ' € en vez de ' + eur(C.base) + ' €).' }) + '<button type="button" class="ct-btn sec" id="vies-btn">Comprobar en VIES</button><p class="ct-hint" id="vies-res">' + (D.vies && D.vies.estado === 'valido' ? '✅ Válido en VIES' + (D.vies.nombre ? ': ' + esc(D.vies.nombre) : '') : '') + '</p>';
        return h; }, v: function () { var ok = req('pais'); if (D.pais === 'OT') ok = req('pais_otro') && ok; if (D.pais === 'ES') ok = req('territorio') && ok; if (!EMP && D.pais === 'ES' && D.territorio === 'canarias_ceuta_melilla') ok = req('alta_autonomo') && ok; if (!EMP && D.pais && UE.indexOf(D.pais) < 0) ok = req('usa_servicio_espana') && ok; if (EMP && D.pais && (UE.indexOf(D.pais) < 0 || (D.pais === 'ES' && D.territorio === 'canarias_ceuta_melilla'))) ok = req('establecimiento_peninsula') && ok; return ok; } });
      if (!EMP) {
        STEPS.push({ id: 'tu', t: 'Tus datos', r: function () { return '<p class="ct-mut">Como aparecen en tu documento.' + ((st.prefill.cliente_nombre || st.prefill.cliente_email || st.prefill.cliente_telefono) ? ' Ya hemos rellenado lo que sabíamos: solo comprueba.' : '') + '</p>' + inp('cliente_nombre', { l: 'Nombre y apellidos', ac: 'name' }) + inp('cliente_email', { l: 'Correo electrónico', type: 'email', ac: 'email', im: 'email', h: 'Aquí llegarán los avisos del contrato y las facturas' }) + inp('cliente_telefono', { l: 'Teléfono (con prefijo)', type: 'tel', ac: 'tel', im: 'tel', ph: '+34 600 000 000' }); }, v: function () { return req('cliente_nombre') & req('cliente_email') & req('cliente_telefono'); } });
        STEPS.push({ id: 'doc', t: 'Tu documento', r: function () { return docBlock('cliente', 'de quien contrata') + fecha('cliente_fecha_nacimiento', 'Fecha de nacimiento'); }, v: function () { return req('cliente_doc_tipo') & req('cliente_doc_numero') & reqF('cliente_fecha_nacimiento'); } });
        STEPS.push({ id: 'dom', t: 'Tu domicilio', r: function () { return dom('cliente_domicilio', 'Domicilio'); }, v: function () { return reqD('cliente_domicilio'); } });
        STEPS.push({ id: 'art', t: 'El artista', r: function () {
          var h = opts('cliente_es_artista', '¿Eres tú el artista?', [['si', 'Sí, soy yo', 'El caso habitual'], ['no', 'No, contrato para otra persona', 'Por ejemplo, para un artista mayor de edad al que representas o financias (familiar, manager, inversor): el artista también firmará. Si el artista es menor de edad, este contrato no lo cubre: escribe al equipo']]);
          h += inp('nombre_artistico', { l: 'Nombre artístico', h: 'Tal como aparece en Spotify' });
          if (D.cliente_es_artista === 'no') h += '<h2>Datos del artista</h2>' + inp('artista_nombre', { l: 'Nombre y apellidos del artista' }) + selArtPais() + artOtro() + docBlock('artista', 'del artista') + fecha('artista_fecha_nacimiento', 'Fecha de nacimiento del artista') + inp('artista_email', { l: 'Correo del artista', type: 'email', im: 'email', h: 'Le enviaremos su propio enlace de firma' }) + inp('relacion_cliente_proyecto', { l: 'Tu papel en el proyecto', ph: 'manager, productor…', h: 'Si solo lo pagas (por ejemplo, eres su madre o su padre), el contrato va a nombre del artista: pide al equipo que se lo envíe a él y tú pagas en su nombre.' });
          return h; }, v: function () { var ok = req('cliente_es_artista') & req('nombre_artistico'); if (D.cliente_es_artista === 'no') ok = ok & req('artista_nombre') & req('artista_pais') & (D.artista_pais === 'OT' ? req('artista_pais_otro') : 1) & req('artista_doc_tipo') & req('artista_doc_numero') & reqF('artista_fecha_nacimiento') & req('artista_email') & req('relacion_cliente_proyecto'); return ok; } });
        STEPS.push({ id: 'fac', t: 'Datos para la factura', r: function () { syncFac(D.cliente_doc_numero); return '<p class="ct-mut">La factura se emite siempre a tu nombre, aunque pague otra persona.</p>' + inp('factura_nif', { l: 'NIF, NIE o número fiscal para la factura', ac: 'off', h: 'Normalmente, tu mismo documento' }); }, v: function () { return req('factura_nif'); } });
      } else {
        STEPS.push({ id: 'emp', t: 'La empresa', r: function () { if (D.vies && D.vies.nombre && !D.empresa_razon_social) D.empresa_razon_social = D.vies.nombre; return inp('empresa_razon_social', { l: 'Razón social', ac: 'organization', h: 'Exactamente como está registrada' }) + inp('empresa_nif', { l: D.pais === 'ES' ? 'NIF de la empresa' : 'Número fiscal (Tax ID) de la empresa', ac: 'off' }) + inp('empresa_registro', { l: 'Registro mercantil o equivalente', ph: 'Registro Mercantil de Madrid, tomo…, hoja…' }) + inp('empresa_email', { l: 'Correo de la empresa', type: 'email', im: 'email' }) + inp('empresa_telefono', { l: 'Teléfono de la empresa (con prefijo)', type: 'tel', im: 'tel', ph: '+34 910 000 000' }); }, v: function () { return req('empresa_razon_social') & req('empresa_nif') & req('empresa_registro') & req('empresa_email') & req('empresa_telefono'); } });
        STEPS.push({ id: 'rep', t: 'Quien firma por la empresa', r: function () { return inp('representante_nombre', { l: 'Nombre y apellidos', ac: 'name' }) + docBlock('representante', 'de quien firma') + opts('representante_cargo', 'Firma como', [['administrador', 'Administrador/a'], ['apoderado', 'Apoderado/a', 'Con poder vigente para obligar a la empresa']]); }, v: function () { return req('representante_nombre') & req('representante_doc_tipo') & req('representante_doc_numero') & req('representante_cargo'); } });
        STEPS.push({ id: 'dom', t: 'Domicilio social', r: function () { return dom('empresa_domicilio', 'Domicilio social'); }, v: function () { return reqD('empresa_domicilio'); } });
        if (M() === 'empresa') {
          STEPS.push({ id: 'pro', t: 'El proyecto', r: function () { return inp('nombre_artistico', { l: 'Nombre artístico del proyecto' }) + '<h2>Persona del proyecto que recibe el servicio</h2><p class="ct-mut">Firma para lo que le afecta personalmente (imagen, datos, confidencialidad). Si son varias personas, avisa al equipo.</p>' + inp('persona_nombre', { l: 'Nombre y apellidos' }) + docBlock('persona', 'de la persona del proyecto') + fecha('persona_fecha_nacimiento', 'Fecha de nacimiento') + inp('persona_email', { l: 'Correo', type: 'email', im: 'email', h: 'Le enviaremos su propio enlace de firma' }); }, v: function () { return req('nombre_artistico') & req('persona_nombre') & req('persona_doc_tipo') & req('persona_doc_numero') & reqF('persona_fecha_nacimiento') & req('persona_email'); } });
        } else {
          STEPS.push({ id: 'art', t: 'El artista', r: function () { return inp('artista_nombre', { l: 'Nombre y apellidos del artista' }) + selArtPais() + artOtro() + docBlock('artista', 'del artista') + fecha('artista_fecha_nacimiento', 'Fecha de nacimiento del artista') + inp('nombre_artistico', { l: 'Nombre artístico' }) + dom('artista_domicilio', 'Domicilio del artista') + inp('artista_email', { l: 'Correo del artista', type: 'email', im: 'email', h: 'Le enviaremos su propio enlace de firma' }) + opts('relacion', 'Relación de la empresa con el artista', [['sello', 'Sello o discográfica'], ['management', 'Management'], ['patrocinio', 'Patrocinio o marca'], ['familiar', 'Familiar'], ['otra', 'Otra']]) + (D.relacion === 'otra' ? inp('relacion_otra', { l: '¿Cuál?' }) : ''); }, v: function () { var ok = req('artista_nombre') & req('artista_pais') & (D.artista_pais === 'OT' ? req('artista_pais_otro') : 1) & req('artista_doc_tipo') & req('artista_doc_numero') & reqF('artista_fecha_nacimiento') & req('nombre_artistico') & reqD('artista_domicilio') & req('artista_email') & req('relacion'); if (D.relacion === 'otra') ok = ok & req('relacion_otra'); return ok; } });
        }
        STEPS.push({ id: 'fac', t: 'Datos para la factura', r: function () { syncFac(D.empresa_nif); return inp('factura_nif', { l: 'NIF o Tax ID para la factura', ac: 'off' }) + opts('documentacion', 'Documentación que aporta la empresa', [['extracto', 'Extracto del registro mercantil', 'Lo habitual: acredita quién puede firmar'], ['censal', 'Certificado censal', 'Empresas de Canarias, Ceuta o Melilla'], ['otra', 'Otra']]) + (D.documentacion === 'otra' ? inp('documentacion_otra', { l: '¿Cuál?' }) : '') + campoDocs(); }, v: function () { var ok = req('factura_nif') & req('documentacion'); if (D.documentacion === 'otra') ok = ok & req('documentacion_otra'); if (!DOCS_SUB.length) { mark('documentacion_archivo', 'Sube el documento para continuar.'); ok = 0; } return ok; } });
      }
      STEPS.push({ id: 'rev', t: 'Comprueba tus datos', r: function () {
        var h = '<p class="ct-mut">Revisa cada dato. Con «Cambiar» vuelves a esa pantalla.</p><dl class="ct-res">';
        for (var i = 1; i < STEPS.length - 1; i++) { var s2 = STEPS[i]; h += '<dt>' + esc(s2.t) + ' <a href="#" data-go="' + i + '">Cambiar</a></dt><dd>' + resumen(s2.id) + '</dd>'; }
        h += '</dl>';
        if (st.forma_pago_abierta) h += opts('forma_pago', 'Forma de pago', [['unico', 'Pago único'], ['dos', 'Dos pagos iguales', 'El primero al contratar y el segundo un mes después, sin recargo']]);
        else if (st.forma_pago) h += '<p class="ct-small">Forma de pago, tal como la acordaste con el equipo: <b>' + (st.forma_pago === 'unico' ? 'pago único, por adelantado' : 'dos pagos iguales, sin recargo: el primero al contratar y el segundo un mes después') + '</b>. El importe exacto, con el IVA que te corresponda, aparecerá en el contrato.</p>';
        h += '<div class="ct-card"><label class="ct-chk"><input type="checkbox" id="ok-datos"> <span>He revisado mis datos y son correctos.</span></label></div>';
        return h; }, v: function () { var ok = true; if (st.forma_pago_abierta) ok = req('forma_pago'); if (!$('#ok-datos').checked) { showErr('Marca la casilla «He revisado mis datos y son correctos».'); ok = false; } return ok; } });
    }
    // documentación de la empresa (18-sep, noche): se SUBE aquí, nada de WhatsApp. Las fotos se reducen antes de enviarlas.
    var DOCS_SUB = st.documentos || [];
    function campoDocs() {
      return '<div class="ct-field" id="f-documentacion_archivo"><label for="doc-file">Sube el documento (PDF o foto)</label>' +
        '<input type="file" id="doc-file" accept="application/pdf,image/*">' +
        '<div class="ct-hint">El extracto del registro mercantil (o el certificado censal) de la empresa, en PDF o una foto legible. Máximo 1,4 MB.</div>' +
        (DOCS_SUB.length ? '<ul class="ct-docs">' + DOCS_SUB.map(function (x) { return '<li>✓ ' + esc(x.nombre) + ' <span class="ct-mut">(' + esc(x.kb) + ' KB)</span></li>'; }).join('') + '</ul>' : '') +
        '<p class="ct-small" id="doc-msg" role="status"></p><div class="ct-err" role="alert"></div></div>';
    }
    function subirDoc(file) {
      var m = $('#doc-msg'); if (!file) return;
      function fin(err) { if (err) { mark('documentacion_archivo', err); if (m) m.textContent = ''; } else { mark('documentacion_archivo', ''); paint(); } }
      function enviar(nombre, dataUrl) {
        var b64 = String(dataUrl).split(',')[1] || '';
        if (b64.length * 3 / 4 > 1400000) { fin('El archivo pesa demasiado (máximo 1,4 MB). Prueba con un PDF más ligero o una foto.'); return; }
        if (m) m.textContent = 'Subiendo…';
        api('/documento', { method: 'POST', body: { nombre: nombre, datos: b64 } }).then(function (r) {
          if (r.ok && r.j && r.j.ok) { DOCS_SUB = r.j.documentos || []; fin(''); } else fin((r.j && r.j.error) || 'No se pudo subir. Inténtalo de nuevo.');
        }).catch(function () { fin('Problema de conexión: inténtalo de nuevo.'); });
      }
      var fr = new FileReader();
      fr.onload = function () {
        if (!/^image\//.test(file.type)) { enviar(file.name, fr.result); return; }
        var img = new Image();
        img.onload = function () {
          var k = Math.min(1, 1800 / Math.max(img.width, img.height)), c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          enviar(file.name.replace(/\.\w+$/, '') + '.jpg', c.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = function () { fin('No se pudo leer la imagen. Prueba con un PDF o una foto en JPG.'); };
        img.src = fr.result;
      };
      fr.onerror = function () { fin('No se pudo leer el archivo.'); };
      fr.readAsDataURL(file);
    }
    function resumen(id) {
      var f = function (k) { return esc(D[k] || '—'); }, dm = function (k) { var d = D[k] || {}; if (typeof d === 'string') return esc(d); return esc([d.calle, d.piso, [d.cp, d.ciudad].filter(Boolean).join(' '), d.provincia].filter(Boolean).join(', ')); }, fe = function (k) { var v = (D[k] || '').split('-'); return v.length === 3 ? v[2] + '/' + v[1] + '/' + v[0] : '—'; };
      switch (id) {
        case 'quien': return { particular: 'Yo, como persona', empresa: 'Una empresa, para su propio proyecto', empresa_artista: 'Una empresa, para un artista' }[M()] || '—';
        case 'pais': return esc(nombrePais(D.pais)) + (D.pais === 'OT' && D.pais_otro ? ' (' + esc(D.pais_otro) + ')' : '') + (D.territorio ? ' · ' + (D.territorio === 'canarias_ceuta_melilla' ? 'Canarias, Ceuta o Melilla' : 'Península o Baleares') : '') + (D.alta_autonomo ? ' · alta de autónomo: ' + esc(D.alta_autonomo) : '') + (D.usa_servicio_espana ? ' · servicio en España: ' + esc(D.usa_servicio_espana) : '') + (D.establecimiento_peninsula ? ' · establecimiento en Península: ' + esc(D.establecimiento_peninsula) : '') + (D.nif_iva ? ' · NIF-IVA ' + esc(D.nif_iva) : '');
        case 'tu': return f('cliente_nombre') + ' · ' + f('cliente_email') + ' · ' + f('cliente_telefono');
        case 'doc': return f('cliente_doc_tipo') + ' ' + f('cliente_doc_numero') + ' · nacimiento ' + fe('cliente_fecha_nacimiento');
        case 'dom': return dm(EMP ? 'empresa_domicilio' : 'cliente_domicilio');
        case 'art': return EMP ? (f('artista_nombre') + ' · ' + esc(paisArtTxt()) + ' · ' + f('artista_doc_tipo') + ' ' + f('artista_doc_numero') + ' · ' + fe('artista_fecha_nacimiento') + ' · ' + f('nombre_artistico') + ' · ' + dm('artista_domicilio') + ' · ' + f('artista_email') + ' · relación: ' + f('relacion') + (D.relacion === 'otra' ? ' (' + f('relacion_otra') + ')' : '')) : (D.cliente_es_artista === 'no' ? ('Artista: ' + f('artista_nombre') + ' · ' + esc(paisArtTxt()) + ' · ' + f('artista_doc_tipo') + ' ' + f('artista_doc_numero') + ' · ' + fe('artista_fecha_nacimiento') + ' · ' + f('artista_email') + ' · ' + f('nombre_artistico') + ' · relación: ' + f('relacion_cliente_proyecto')) : ('Soy yo · ' + f('nombre_artistico')));
        case 'fac': return f('factura_nif') + (D.documentacion ? ' · ' + f('documentacion') + (D.documentacion === 'otra' ? ' (' + f('documentacion_otra') + ')' : '') : '') + (EMP && DOCS_SUB.length ? ' · subido: ' + DOCS_SUB.map(function (x) { return esc(x.nombre); }).join(', ') : '');
        case 'emp': return f('empresa_razon_social') + ' · ' + f('empresa_nif') + ' · ' + f('empresa_registro') + ' · ' + f('empresa_email') + ' · ' + f('empresa_telefono');
        case 'rep': return f('representante_nombre') + ' · ' + f('representante_doc_tipo') + ' ' + f('representante_doc_numero') + ' · ' + f('representante_cargo');
        case 'pro': return f('nombre_artistico') + ' · ' + f('persona_nombre') + ' · ' + f('persona_doc_tipo') + ' ' + f('persona_doc_numero') + ' · ' + fe('persona_fecha_nacimiento') + ' · ' + f('persona_email');
      }
      return '';
    }
    var cur = 0;
    function collect() {
      var els = app.querySelectorAll('input,select,textarea');
      for (var i = 0; i < els.length; i++) {
        var el = els[i], id = el.id; if (!id || id === 'ok-datos' || el.type === 'file') continue;
        var m = id.match(/^(.*)_(d|m|y)$/);
        if (m && document.getElementById(m[1] + '_y')) { var dd = $('#' + m[1] + '_d').value, mo = $('#' + m[1] + '_m').value, y = $('#' + m[1] + '_y').value; D[m[1]] = (dd && mo && y) ? (y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + dd).slice(-2)) : ''; continue; }
        var dm2 = id.match(/^(.*_domicilio)_(calle|piso|cp|ciudad|prov)$/);
        if (dm2) { var kk = dm2[1]; if (typeof D[kk] !== 'object' || !D[kk]) D[kk] = {}; D[kk][dm2[2] === 'prov' ? 'provincia' : dm2[2]] = el.value.trim(); continue; }
        D[id] = el.value.trim();
      }
      save();
    }
    function req(k) { var v = D[k]; var ok = !!(v && String(v).trim()); mark(k, ok ? '' : 'Este dato es obligatorio.'); return ok; }
    function reqF(k) { var v = D[k] || ''; var ok = /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v).getTime()); mark(k, ok ? '' : 'Escribe día, mes y año.'); return ok; }
    function reqD(k) { var d = D[k] || {}; var ok = !!(d.calle && d.cp && d.ciudad); mark(k, ok ? '' : 'Completa calle y número, código postal y ciudad.'); return ok; }
    function mark(k, m) { var f = document.getElementById('f-' + k); if (!f) return; f.classList.toggle('bad', !!m); var e = f.querySelector('.ct-err'); if (e) e.textContent = m || ''; }
    function showErr(m) { var b = $('#errbox'); if (!b) return; b.textContent = m; b.style.display = m ? 'block' : 'none'; if (m) window.scrollTo(0, 0); }
    function paint() {
      build();
      var s2 = STEPS[cur];
      app.innerHTML = '<div class="ct-steps">' + STEPS.map(function (x, i) { return '<i class="' + (i <= cur ? 'on' : '') + '"></i>'; }).join('') + '</div><p class="ct-small ct-mut">Paso ' + (cur + 1) + ' de ' + STEPS.length + '</p><h1>' + esc(s2.t) + '</h1><div class="ct-errbox" id="errbox"></div>' + card(s2.r()) +
        '<button type="button" class="ct-btn" id="next">' + (cur === STEPS.length - 1 ? 'Confirmar mis datos' : (cur === 0 ? 'Empezar' : 'Continuar')) + '</button>' + (cur > 0 ? '<button type="button" class="ct-btn sec" id="back">Atrás</button>' : '') + foot();
      var i, list = app.querySelectorAll('.ct-opt');
      for (i = 0; i < list.length; i++) (function (b) { b.addEventListener('click', function () { var k = b.getAttribute('data-k'); D[k] = b.getAttribute('data-v'); if (k === 'modelo') migrar(); save(); paint(); }); })(list[i]);
      list = app.querySelectorAll('input,select,textarea');
      for (i = 0; i < list.length; i++) (function (el) { el.addEventListener('change', function () {
        var antes = D.pais; collect();
        if (el.id === 'pais' && D.pais !== antes) { delete D.territorio; delete D.alta_autonomo; delete D.usa_servicio_espana; delete D.establecimiento_peninsula; delete D.nif_iva; delete D.vies; delete D.pais_otro; save(); }
        if (el.id === 'artista_pais' && D.artista_pais !== 'OT') { delete D.artista_pais_otro; save(); }
        if (el.id === 'pais' || el.id === 'territorio' || el.id === 'artista_pais') paint(); }); })(list[i]);
      list = app.querySelectorAll('[data-go]');
      for (i = 0; i < list.length; i++) (function (a) { a.addEventListener('click', function (e) { e.preventDefault(); cur = +a.getAttribute('data-go'); paint(); }); })(list[i]);
      var df = $('#doc-file'); if (df) df.addEventListener('change', function () { subirDoc(df.files && df.files[0]); });
      var vb = $('#vies-btn');
      if (vb) vb.addEventListener('click', function () {
        collect(); if (!D.nif_iva) { mark('nif_iva', 'Escribe el NIF-IVA.'); return; }
        vb.disabled = true; $('#vies-res').textContent = 'Comprobando…';
        api('/vies', { method: 'POST', body: { nif_iva: D.nif_iva } }).then(function (r) { vb.disabled = false; var j = r.j || {}; D.vies = j; save(); $('#vies-res').textContent = j.estado === 'valido' ? '✅ Válido en VIES' + (j.nombre ? ': ' + j.nombre : '') : (j.estado === 'invalido' ? '❌ No consta como válido en VIES. Revisa el número; si es correcto, sigue y el equipo lo comprobará.' : '⚠️ VIES no responde ahora mismo. Puedes seguir: el equipo lo comprobará.'); })
          .catch(function () { vb.disabled = false; $('#vies-res').textContent = '⚠️ No se pudo comprobar ahora. Puedes seguir.'; });
      });
      $('#next').addEventListener('click', function () {
        collect(); showErr('');
        if (!s2.v()) { if (!$('#errbox').textContent) showErr('Revisa los campos marcados.'); return; }
        if (cur < STEPS.length - 1) { cur++; paint(); return; }
        var btn = $('#next'); btn.disabled = true; btn.textContent = 'Enviando…';
        api('/datos', { method: 'POST', body: { datos: D, confirmar: true } }).then(function (r) {
          if (!r.ok || !r.j || !r.j.ok) {
            btn.disabled = false; btn.textContent = 'Confirmar mis datos';
            if (r.j && r.j.errores) {
              var ks = Object.keys(r.j.errores), first = ks[0];
              var idx = -1; for (var i2 = 0; i2 < STEPS.length; i2++) { var html = STEPS[i2].r(); if (html.indexOf('id="f-' + first + '"') >= 0 || html.indexOf('id="' + first + '"') >= 0) { idx = i2; break; } }
              if (idx >= 0 && idx !== cur) { cur = idx; paint(); }
              for (var i3 = 0; i3 < ks.length; i3++) mark(ks[i3], r.j.errores[ks[i3]]);
              showErr(r.j.mensaje || 'Hay datos que revisar.');
            } else showErr((r.j && r.j.mensaje) || 'No se pudo guardar. Inténtalo de nuevo.');
            return;
          }
          try { sessionStorage.removeItem(KEY); } catch (e) { }
          load();
        }).catch(function () { btn.disabled = false; btn.textContent = 'Confirmar mis datos'; showErr('Problema de conexión. Inténtalo de nuevo; no se ha perdido nada.'); });
      });
      var bk = $('#back'); if (bk) bk.addEventListener('click', function () { collect(); cur--; paint(); });
      window.scrollTo(0, 0);
    }
    paint();
  }

  // ─────────────────────────────────────────────── FIRMA
  function arriba() { try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); } }   // sin animación: la web tiene scroll suave
  function vistaFirma(st) {
    // POR ETAPAS (17-sep): 1 datos · 2 contrato · 3 autorizaciones (si las hay) · 4 firma · 5 pago (si paga en línea)
    var E = [];
    E.push({ id: 'datos', t: 'Revisa tus datos', sigue: 'Mis datos están bien', html:
      (st.oferta_firmada ? '<p class="ct-okbox">✓ Macuto Music ya ha firmado tu oferta. Tienes 48 horas para firmarla' + ((st.expira_completa || st.expira) ? ' (hasta el ' + esc(st.expira_completa || st.expira) + ')' : '') + '. Tu contrato se activa cuando recibamos el pago.</p>' : '') +
      '<p class="ct-mut">Así apareces en el contrato. Si algo no está bien, avísanos antes de firmar.</p>' +
      '<dl class="ct-res">' + (st.resumen || []).map(function (kv) { return '<dt>' + esc(kv[0]) + '</dt><dd>' + esc(kv[1]) + '</dd>'; }).join('') + '</dl>' +
      (st.puede_reportar ? '<p class="ct-small" style="margin-top:10px"><button type="button" class="ct-btn sec" id="err-open" style="margin:0">Hay un error en mis datos</button></p><div id="err-form" style="display:none"><label for="err-txt">¿Qué dato está mal y cuál es el correcto?</label><textarea id="err-txt" rows="3" maxlength="300"></textarea><button type="button" class="ct-btn sec" id="err-send">Avisar al equipo</button></div>' : '') });
    var pags = ''; for (var p = 1; p <= st.paginas; p++) pags += '<img class="ct-pag" alt="Página ' + p + '" data-p="' + p + '"' + (p === st.paginas ? ' data-last="1"' : '') + '>';
    E.push({ id: 'contrato', t: 'Lee el contrato', sigue: 'He leído el contrato', html:
      '<p class="ct-small ct-mut">Son ' + st.paginas + ' páginas: bájalas hasta el final o <a id="pdflink" href="#" style="' + LINK + '">abre tu contrato en PDF</a> · <a href="/contrato/como-se-firma.html" target="_blank" rel="noopener" style="' + LINK + '">Cómo se firma</a></p>' + pags });
    if (st.consentimientos && st.consentimientos.length) {
      E.push({ id: 'aut', t: 'Autorizaciones voluntarias', sigue: 'Seguir', html:
        '<p class="ct-small ct-mut">No condicionan la entrada ni el servicio (cláusula 4.4). Puedes retirarlas cuando quieras con un correo.</p>' + st.consentimientos.map(function (c) { return '<div class="cons" data-k="' + esc(c.clave) + '"><p style="margin:10px 0 4px"><b>' + esc(c.texto) + '</b></p><label class="ct-chk"><input type="radio" name="c_' + esc(c.clave) + '" value="si"> <span>Sí, autorizo</span></label><label class="ct-chk"><input type="radio" name="c_' + esc(c.clave) + '" value="no"> <span>No</span></label></div>'; }).join('') });
    }
    E.push({ id: 'firma', t: 'Firma', html:
      st.declaraciones.map(function (d) { return '<label class="ct-chk"><input type="checkbox" name="' + esc(d[0]) + '" required> <span>' + esc(d[1]) + '</span></label>'; }).join('') +
      '<label for="nombre">Escribe tu nombre completo</label><input id="nombre" autocomplete="name" maxlength="120" placeholder="' + esc(st.nombre) + '"><p class="ct-mut ct-small" style="margin-top:8px">Dibuja tu firma con el dedo:</p><canvas id="c"></canvas><button type="button" class="ct-btn sec" id="clr">Borrar</button><button type="button" class="ct-btn" id="go" disabled>' + esc(st.boton) + '</button><p class="ct-small ct-mut" id="why"></p><p id="msg" class="ct-small"></p>' +
      (st.paso_pago ? '<p class="ct-small ct-mut">Después de firmar, pagarás en el último paso.</p>' : '') +
      '<p class="ct-small ct-mut">Firma electrónica (Reglamento eIDAS 910/2014). Quedan registrados tu nombre, la fecha y hora, la dirección IP, el navegador, la zona horaria, el tamaño de pantalla y la huella SHA-256 del documento que has visto, junto con tus respuestas. Recibirás una copia del contrato firmado.</p>' + RGPD });
    var total = E.length + (st.paso_pago ? 1 : 0), bars = '';
    for (var b0 = 0; b0 < total; b0++) bars += '<i data-b="' + b0 + '"></i>';
    var html = '<div class="ct-steps">' + bars + '</div><p class="ct-small ct-mut" id="paso-txt"></p><h1 id="etapa-t"></h1>' +
      '<p class="ct-small ct-mut">' + esc(st.titulo) + ' · ' + esc(st.nombre) + ' <span class="ct-tag">' + esc(st.rol) + '</span></p>';
    for (var e0 = 0; e0 < E.length; e0++) {
      html += '<section class="ct-etapa" data-i="' + e0 + '"' + (e0 ? ' hidden' : '') + '>' + card(E[e0].html) + '<div class="ct-nav">' +
        (e0 ? '<button type="button" class="ct-btn sec" data-atras="1">Atrás</button>' : '') +
        (E[e0].sigue ? '<button type="button" class="ct-btn" data-sigue="' + E[e0].id + '">' + esc(E[e0].sigue) + '</button>' : '') + '</div>' +
        (E[e0].id === 'contrato' ? '<p class="ct-small ct-mut ct-center" id="why-contrato"></p>' : '') + '</section>';
    }
    app.innerHTML = html + foot();
    var cur = 0;
    function mostrar(i) {
      cur = i;
      var secs = document.querySelectorAll('.ct-etapa'), k;
      for (k = 0; k < secs.length; k++) secs[k].hidden = (+secs[k].getAttribute('data-i') !== i);
      var bs = document.querySelectorAll('.ct-steps i');
      for (k = 0; k < bs.length; k++) bs[k].className = (+bs[k].getAttribute('data-b') <= i) ? 'on' : '';
      $('#paso-txt').textContent = 'Paso ' + (i + 1) + ' de ' + total;
      $('#etapa-t').textContent = E[i].t;
      arriba();
      if (E[i].id === 'firma') fit();
      chk();
    }
    var atras = document.querySelectorAll('[data-atras]'), sigue = document.querySelectorAll('[data-sigue]'), q0;
    for (q0 = 0; q0 < atras.length; q0++) atras[q0].addEventListener('click', function () { mostrar(cur - 1); });
    for (q0 = 0; q0 < sigue.length; q0++) sigue[q0].addEventListener('click', function (ev) { if (!ev.currentTarget.disabled) mostrar(cur + 1); });
    // canvas
    var cv = $('#c'), cx, drawing = false, dirty = false, bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
    function fit() { var r = cv.getBoundingClientRect(), w = r.width | 0, hh = r.height | 0; if (!w || !hh) return; if (cx && cv.width === w && cv.height === hh) return; var tenia = dirty; cv.width = w; cv.height = hh; cx = cv.getContext('2d'); cx.lineWidth = 3; cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.strokeStyle = '#111'; if (tenia) { dirty = false; bx0 = by0 = 1e9; bx1 = by1 = -1e9; var m = $('#msg'); if (m) { m.textContent = 'La pantalla cambió de tamaño: vuelve a dibujar tu firma.'; m.style.color = '#b3261e'; } } }
    fit(); window.addEventListener('resize', fit);
    function pos(e) { var r = cv.getBoundingClientRect(), t = e.touches ? e.touches[0] : e; return [t.clientX - r.left, t.clientY - r.top]; }
    function ext(p) { bx0 = Math.min(bx0, p[0]); by0 = Math.min(by0, p[1]); bx1 = Math.max(bx1, p[0]); by1 = Math.max(by1, p[1]); }
    function down(e) { drawing = true; dirty = true; var p = pos(e); ext(p); cx.beginPath(); cx.moveTo(p[0], p[1]); e.preventDefault(); }
    function move(e) { if (!drawing) return; var p = pos(e); ext(p); cx.lineTo(p[0], p[1]); cx.stroke(); e.preventDefault(); }
    function up() { drawing = false; }
    cv.addEventListener('mousedown', down); cv.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    cv.addEventListener('touchstart', down, { passive: false }); cv.addEventListener('touchmove', move, { passive: false }); cv.addEventListener('touchend', up);
    function clr() { cx.clearRect(0, 0, cv.width, cv.height); dirty = false; bx0 = by0 = 1e9; bx1 = by1 = -1e9; }
    function recorte() { var pad = 10, x0 = Math.max(0, bx0 - pad), y0 = Math.max(0, by0 - pad), x1 = Math.min(cv.width, bx1 + pad), y1 = Math.min(cv.height, by1 + pad); var w = Math.max(12, x1 - x0), hh = Math.max(12, y1 - y0); var oc = document.createElement('canvas'); oc.width = w; oc.height = hh; oc.getContext('2d').drawImage(cv, x0, y0, w, hh, 0, 0, w, hh); return oc.toDataURL('image/png'); }
    $('#clr').addEventListener('click', clr);
    // visor: páginas bajo demanda; «visto hasta el final» = la última página, ya cargada, ha estado al menos a la mitad en pantalla
    var visto = false, imgs = document.querySelectorAll('img.ct-pag'), ult = document.querySelector('img.ct-pag[data-last]');
    function cargada(im) { return !!(im && im.src && im.complete && im.naturalHeight > 0); }
    function cargaPag(im, intento) {
      var np = im.getAttribute('data-p'); if (!np) return;
      im.removeAttribute('data-p');
      blobDe('/pag/' + np + '.png').then(function (b) { im.src = URL.createObjectURL(b); })
        .catch(function (e) { if (e && e.status === 401) { load(); return; } if (!intento) { im.setAttribute('data-p', np); setTimeout(function () { cargaPag(im, 1); }, 3000); } });
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) cargaPag(e.target, 0); }); }, { rootMargin: '300px' });
      for (var i = 0; i < imgs.length; i++) io.observe(imgs[i]);
    } else { for (var j = 0; j < imgs.length; j++) cargaPag(imgs[j], 0); visto = true; }
    // «leído hasta el final»: la persona ha BAJADO y la última página, ya cargada, asoma en pantalla. Solo con su scroll:
    // un cambio de etapa o una carga de imágenes no lo activa (el servidor, además, exige haber recibido esa página).
    function mirarFinal() {
      if (visto || !ult || ult.offsetParent === null || !cargada(ult) || window.scrollY < 200) return;
      if (ult.getBoundingClientRect().top < window.innerHeight - 40) { visto = true; chk(); }
    }
    if (ult) ult.addEventListener('load', mirarFinal);
    $('#pdflink').addEventListener('click', function (e) { abrirPdf(e); visto = true; chk(); });
    window.addEventListener('scroll', mirarFinal, { passive: true });
    function chk() {
      var i, consOk = true, declOk = true;
      var gs = document.querySelectorAll('.cons'); for (i = 0; i < gs.length; i++) if (!gs[i].querySelector('input:checked')) consOk = false;
      var req = document.querySelectorAll('.ct-chk input[required]'); for (i = 0; i < req.length; i++) if (!req[i].checked) declOk = false;
      var bc = document.querySelector('[data-sigue="contrato"]'); if (bc) bc.disabled = !visto;
      var wc = $('#why-contrato'); if (wc) wc.textContent = visto ? '' : 'Baja hasta la última página (o abre el PDF) para seguir.';
      var ba = document.querySelector('[data-sigue="aut"]'); if (ba) ba.disabled = !consOk;
      var ok = visto && consOk && declOk;
      $('#go').disabled = !ok;
      $('#why').textContent = ok ? '' : (!visto ? 'Lee el contrato hasta el final para poder firmar.' : (!consOk ? 'Contesta las autorizaciones.' : 'Marca las casillas para poder firmar.'));
    }
    var inputs = document.querySelectorAll('.ct-chk input,.cons input'); for (var k2 = 0; k2 < inputs.length; k2++) inputs[k2].addEventListener('change', chk);
    mostrar(0);
    var errb = $('#err-open'); if (errb) errb.addEventListener('click', function () { $('#err-form').style.display = 'block'; errb.style.display = 'none'; });
    var errs = $('#err-send'); if (errs) errs.addEventListener('click', function () { var t = $('#err-txt').value.trim(); if (!t) return; errs.disabled = true; api('/error', { method: 'POST', body: { texto: t.slice(0, 300) } }).then(function (r) { if (r.ok && r.j && r.j.ok) { $('#err-form').innerHTML = '<p><b>Recibido.</b> El equipo revisará el dato y te avisará con el contrato corregido.</p>'; setTimeout(load, 2500); } else { errs.disabled = false; $('#err-form').insertAdjacentHTML('beforeend', '<p class="ct-err" style="display:block">No se pudo enviar el aviso. Escribe al equipo por WhatsApp.</p>'); } }).catch(function () { errs.disabled = false; }); });
    $('#go').addEventListener('click', function () {
      var m = $('#msg'); var nombre = $('#nombre').value.trim();
      if (!nombre) { m.textContent = 'Escribe tu nombre completo.'; m.style.color = '#b3261e'; return; }
      if (!dirty) { m.textContent = 'Dibuja tu firma en el recuadro.'; m.style.color = '#b3261e'; return; }
      var cons = {}, gs = document.querySelectorAll('.cons'), i; for (i = 0; i < gs.length; i++) { var c = gs[i].querySelector('input:checked'); cons[gs[i].getAttribute('data-k')] = c ? c.value : null; }
      var decl = {}, cs = document.querySelectorAll('.ct-chk input[type=checkbox]'); for (i = 0; i < cs.length; i++) decl[cs[i].name] = cs[i].checked;
      var btn = $('#go'); btn.disabled = true; m.textContent = 'Registrando la firma…'; m.style.color = '';
      var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { }
      api('/firma', { method: 'POST', body: { acepto: true, nombre: nombre, consentimientos: cons, declaraciones: decl, tz: tz, pantalla: window.innerWidth + 'x' + window.innerHeight, firma: recorte(), hash: st.hash } }).then(function (r) {
        if (r.ok && r.j && r.j.ok) { load(); return; }
        if (r.status === 401) { load(); return; }   // sesión caducada: vuelve a pedir el documento
        if (r.status === 409 && r.j && /cambiado|revisando/.test(r.j.error || '')) { m.textContent = '❌ ' + r.j.error; m.style.color = '#b3261e'; setTimeout(load, 4000); return; }
        btn.disabled = false; m.textContent = '❌ ' + ((r.j && r.j.error) || 'No se pudo registrar. Inténtalo de nuevo.'); m.style.color = '#b3261e';
      }).catch(function () { btn.disabled = false; m.textContent = '❌ Problema de conexión. Inténtalo de nuevo.'; m.style.color = '#b3261e'; });
    });
  }

  window.addEventListener('hashchange', function () {   // otro token en la misma pestaña = otra sesión; «#main» (saltar al contenido) no cuenta
    var h = (location.hash || '').replace(/^#/, '');
    if (/^[\w\-]{20,64}$/.test(h) && h !== TOKEN) location.reload();
  });
  load();
})();
