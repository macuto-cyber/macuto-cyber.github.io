/* macutomusic.com/split — lectura y firma de acuerdos musicales (split sheets y demás), 18-sep-2026.
   23-sep-2026: el reparto lo declara cada parte desde su enlace, sin ver lo que declaran las demás; si al juntarlo no
   suma 100 % aparece la vista «reparto» con el desglose y cada uno ajusta el suyo.
   Mismo sistema que el contrato DAP (macutomusic.com/contrato): el token (256 bits) va en el FRAGMENTO de la URL,
   cada firmante entra con SU documento (DNI, NIE o pasaporte) y la API vive en el M5
   (firmar.macutomusic.com/api/split/<token>, dap_split.py). Solo se acepta otra API en localhost (pruebas). ES5. */
(function () {
  'use strict';
  var app = document.getElementById('app');
  var TOKEN = (location.hash || '').replace(/^#/, '').trim();
  if (!/^[\w\-]{20,64}$/.test(TOKEN)) TOKEN = '';
  var LOCAL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
  function sget(k) { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function sset(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { } }
  var apiParam = /[?&]api=([^&]+)/.exec(location.search);
  var apiLocal = apiParam ? decodeURIComponent(apiParam[1]) : sget('dap-api');
  if (LOCAL && apiParam) sset('dap-api', apiLocal);
  var API_BASE = (LOCAL && apiLocal) ? apiLocal.replace(/\/$/, '') : 'https://firmar.macutomusic.com';
  var API = API_BASE + '/api/split/' + TOKEN;
  var SKEY = 'dap-split-' + TOKEN.slice(0, 8);
  function ses() { return sget(SKEY); }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel) { return document.querySelector(sel); }
  function card(inner) { return '<div class="ct-card">' + inner + '</div>'; }
  function foot() { return '<p class="ct-foot">¿Dudas sobre cómo funciona? Escribe al equipo de Macuto Music por WhatsApp al <a href="https://wa.me/34630060006" target="_blank" rel="noopener">+34 630 06 00 06</a> o a <a href="mailto:macuto@macutomusic.com">macuto@macutomusic.com</a>.<br>Macuto Music<br><a href="/aviso-legal.html" target="_blank" rel="noopener">Aviso legal</a> · <a href="/privacidad.html#firma" target="_blank" rel="noopener">Privacidad</a></p>'; }
  function arriba() { try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); } }
  function msg(t, p, sub, extra) { app.innerHTML = '<h1>' + esc(t) + '</h1>' + card('<p>' + esc(p) + '</p>' + (sub ? '<p class="ct-mut">' + esc(sub) + '</p>' : '') + (extra || '')) + foot(); arriba(); }
  function api(path, opts) {
    opts = opts || {};
    var o = { method: opts.method || 'GET', headers: {}, credentials: 'omit', mode: 'cors', cache: 'no-store' };
    if (ses()) o.headers['X-Sobre-Sesion'] = ses();
    if (opts.body !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(opts.body); }
    return fetch(API + (path || ''), o).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); });
  }
  function blobDe(path) {
    var o = { method: 'GET', headers: {}, credentials: 'omit', mode: 'cors', cache: 'no-store' };
    if (ses()) o.headers['X-Sobre-Sesion'] = ses();
    return fetch(API + path, o).then(function (r) { if (!r.ok) { var e = new Error('http ' + r.status); e.status = r.status; throw e; } return r.blob(); });
  }
  function abrirPdf(ev, ruta, nombre) {
    if (ev) ev.preventDefault();
    var w = null; try { w = window.open('', '_blank'); } catch (e) { }
    if (w) { try { w.document.title = 'Documento'; w.document.body.innerHTML = '<p style="font-family:sans-serif;padding:20px">Abriendo el documento…</p>'; } catch (e) { } }
    return blobDe(ruta).then(function (b) {
      var u = URL.createObjectURL(b);
      if (w) { w.location.href = u; } else { var a = document.createElement('a'); a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); }
      setTimeout(function () { URL.revokeObjectURL(u); }, 120000);
    }).catch(function (e) { if (w) { try { w.close(); } catch (e2) { } } if (e && e.status === 401) load(); else alert('No se pudo abrir el PDF. Inténtalo de nuevo.'); });
  }
  var RGPD = '<p class="ct-small ct-mut"><b>Tus datos.</b> Responsable: Angelo Jordan Gutiérrez Luis (Macuto Music). Finalidad: preparar y firmar el acuerdo, enviar a cada parte su copia y conservar la prueba de la firma. Se registran tu documento (para abrir este enlace), los datos que escribas para el acuerdo, tu firma y los datos técnicos de la firma; los ven también las demás partes del acuerdo. Base: el servicio de firma que pides al usar este enlace y el interés legítimo de las partes y de Macuto Music en poder probar la firma. Se conservan mientras el acuerdo pueda exigirse y cinco años más. Tus derechos (también reclamar ante la AEPD), destinatarios y transferencias: <a href="/privacidad.html#firma" target="_blank" rel="noopener">macutomusic.com/privacidad.html#firma</a>.</p>';

  if (!TOKEN) { msg('Enlace no válido', 'Este enlace no lleva la clave del acuerdo. Pide a quien te lo pasó que te lo reenvíe.'); return; }

  var pollTimer = null, reintentos = 0;
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
      if (r.status === 404) return msg('Enlace no válido', 'Este enlace no corresponde a ningún acuerdo. Pide a quien te lo pasó que te lo reenvíe.');
      if (!r.ok || !r.j) return reintentar('No se pudo cargar el acuerdo');
      reintentos = 0;
      render(r.j);
    }).catch(function () { reintentar('Sin conexión con el servidor'); });
  }
  function render(st) {
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
    var r = pintar(st);
    if (st.enlaces && st.enlaces.length) {      // el promotor lleva los enlaces de los demás en todas sus pantallas
      var d = document.createElement('div'); d.innerHTML = enlacesHtml(st);
      var pie = app.querySelector('.ct-foot');
      if (d.firstChild) { if (pie) app.insertBefore(d.firstChild, pie); else app.appendChild(d.firstChild); }
      enlacesEnganchar(st);
    }
    return r;
  }
  function pintar(st) {
    switch (st.vista) {
      case 'pin': return vistaPin(st);
      case 'pin_bloqueado': return msg('Acceso bloqueado', 'Se han agotado los intentos. Escribe a Macuto: revisará tu enlace y te lo volverá a abrir.');
      case 'anulado': return msg('Este enlace ya no es válido', 'El acuerdo se ha sustituido por otra versión. Pide el enlace nuevo a quien te lo pasó.');
      case 'caducado': return msg('Este enlace ha caducado', 'El plazo para firmar ha terminado. Si todavía hay que firmarla, pide un enlace nuevo a Macuto.');
      case 'copia_caducada': return msg('Este enlace ya no sirve la copia', 'Han pasado más de treinta días desde que se firmó. Pide tu copia a Macuto.');
      case 'error': return msg('Un momento', 'El equipo está revisando el documento. Macuto te avisará cuando esté listo; lo abrirás en este mismo enlace.');
      case 'obra': return vistaObra(st);
      case 'espera_obra': return msg('Falta preparar el acuerdo', 'Quien lo ha empezado todavía no ha puesto los datos de la canción. En cuanto los ponga, en este mismo enlace podrás rellenar los tuyos.', 'Esta página se actualiza sola.');
      case 'datos': return vistaDatos(st);
      case 'reparto': return vistaDatos(st);
      case 'espera_datos': return vistaEsperaDatos(st);
      case 'preparando': msg('Preparando el acuerdo…', 'Ya están los datos de todos. Estamos generando el documento; esta página se actualiza sola.', 'Suele tardar menos de un minuto.'); pollTimer = setTimeout(load, 5000); return;
      case 'ya_firmaste': return vistaYaFirmaste(st);
      case 'hecho': return vistaHecho(st);
      case 'firma': return vistaFirma(st);
      default: return msg('Enlace no válido', 'Pide a Macuto que te lo reenvíe.');
    }
  }
  function listaPartes(st) {
    return '<ul class="ct-equipo">' + (st.partes || []).map(function (p) {
      var cuando = (p.firmado && p.ts) ? ' · ' + esc(hora(p.ts)) : '';
      return '<li>' + (p.firmado ? '✅ ' : '⏳ ') + '<b>' + esc(p.nombre) + '</b>' + (p.yo ? ' <span class="ct-tag">tú</span>' : '') + '<br><span class="ct-mut ct-small">' + esc(p.rol) + (p.firmado ? ' · ha firmado' + cuando : ' · pendiente') + '</span></li>';
    }).join('') + '</ul>';
  }

  function vistaPin(st) {
    app.innerHTML = '<h1>Tu acuerdo</h1>' + card('<h2>Entra con tu documento</h2><p>Para proteger los datos de todos, este enlace solo se abre con tu documento de identidad. Escribe tu DNI, NIE o pasaporte.</p>' +
      (st.primera ? '<p class="ct-small ct-mut">Es tu primera entrada: el documento que escribas quedará como la llave de este enlace. Escríbelo bien: si te equivocas, pide a quien te mandó el enlace que avise al equipo.</p>' : '') +
      '<form id="acc" novalidate><div class="ct-field"><label for="doc">DNI, NIE o pasaporte</label><input id="doc" name="doc" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" maxlength="30" inputmode="text"></div>' +
      (st.primera ? '<div class="ct-field"><label for="doc2">Repítelo</label><input id="doc2" name="doc2" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" maxlength="30" inputmode="text"></div>' : '') +
      '<div class="ct-errbox" id="errbox"></div><button type="submit" class="ct-btn" id="pin-go">Entrar</button></form>' +
      '<p class="ct-small ct-mut">El número con su letra; da igual si pones puntos, guiones o minúsculas. La sesión dura dos horas y se cierra al cerrar la pestaña.</p>') + foot();
    arriba();
    var inp = $('#doc'); inp.focus();
    function go() {
      var v = (inp.value || '').replace(/[\s.\-\/]/g, '');
      if (v.length < 5) { $('#errbox').textContent = 'Escribe el número completo de tu documento.'; $('#errbox').style.display = 'block'; return; }
      if ($('#doc2') && ($('#doc2').value || '').replace(/[\s.\-\/]/g, '').toUpperCase() !== v.toUpperCase()) { $('#errbox').textContent = 'Los dos no coinciden. Revisa tu documento.'; $('#errbox').style.display = 'block'; return; }
      var b = $('#pin-go'); if (b.disabled) return; b.disabled = true;
      api('/pin', { method: 'POST', body: { doc: v } }).then(function (r) {
        b.disabled = false;
        if (r.ok && r.j && r.j.ok) { sset(SKEY, r.j.s || ''); load(); return; }
        if (r.j && r.j.vista === 'pin_bloqueado') return render({ vista: 'pin_bloqueado' });
        $('#errbox').textContent = ((r.j && r.j.error) || 'No se pudo comprobar el documento.') + (r.j && r.j.quedan != null ? ' Te quedan ' + r.j.quedan + ' intentos.' : ''); $('#errbox').style.display = 'block';
      }).catch(function () { b.disabled = false; $('#errbox').textContent = 'Problema de conexión. Inténtalo de nuevo.'; $('#errbox').style.display = 'block'; });
    }
    $('#acc').addEventListener('submit', function (e) { e.preventDefault(); go(); });
  }

  function vistaYaFirmaste(st) {
    var faltan = (st.partes || []).filter(function (p) { return !p.firmado; }).length;
    app.innerHTML = '<h1>¡Firmado!</h1>' + card('<p class="ct-okbox">✓ Tu firma quedó registrada' + (st.firmado_ts ? ' el ' + esc(hora(st.firmado_ts)) : (st.firmado_el ? ' el ' + esc(st.firmado_el) : '')) + '.</p>' +
      '<p>' + (faltan ? (faltan > 1 ? 'Faltan ' + faltan + ' firmas' : 'Falta 1 firma') + '. Cuando firmen todos, desde este mismo enlace podrás descargar la copia firmada.' : 'Ya habéis firmado todos. Estamos sellando la copia: <b>tarda menos de un minuto</b> y esta página se actualiza sola.') + '</p>' +
      '<h2 style="margin-top:14px">' + esc(st.titulo) + '</h2>' + listaPartes(st) +
      '<p class="ct-small"><a href="#" id="pdf">Ver ' + doc(st) + ' (PDF)</a></p>' + copiaHtml(st)) + foot();
    arriba();
    $('#pdf').addEventListener('click', function (e) { abrirPdf(e, '/pdf', 'Split_sheet.pdf'); });
    pollTimer = setTimeout(load, faltan ? 60000 : 4000);      // sellando: el PDF sale en segundos
  }

  // El acuerdo no se da por ACTIVO hasta que cada parte tiene su copia por correo (orden de Macuto, 15-oct-2026).
  function copiaHtml(st) {
    var c = st.copia_email;
    if (!c) return '';
    if (c.estado === 'ENVIADO') return '<p class="ct-small">📧 Te hemos mandado esta copia a <b>' + esc(c.a) + '</b>. Si no la ves, mira en spam.</p>';
    return '<p class="ct-small ct-mut">📧 Tu copia va de camino a <b>' + esc(c.a) + '</b>. Si no te llega, descárgala desde este mismo enlace (vale treinta días desde la firma): el acuerdo ya está firmado igualmente.</p>';
  }
  function vistaHecho(st) {
    app.innerHTML = '<h1>' + (st.acuerdo ? 'Acuerdo firmado' : 'Split sheet firmada') + '</h1>' + card('<p class="ct-okbox">✓ ' + esc(st.titulo) + (st.acuerdo ? ' está firmado' : ' está firmada') + ' por todas las partes.</p>' + listaPartes(st) +
      '<button type="button" class="ct-btn" id="dl">Descargar la copia firmada (PDF)</button>' +
      '<p class="ct-small ct-mut">Lleva al final la hoja de firmas con la fecha, la hora y la huella del documento. Puedes descargarla desde este enlace hasta el ' + esc(st.copia_hasta) + '. Guárdala.</p>' +
      copiaHtml(st)) + foot();
    arriba();
    $('#dl').addEventListener('click', function (e) { abrirPdf(e, '/firmado', 'Split_sheet_firmada.pdf'); });
  }

  function doc(st) { return st.acuerdo ? 'el acuerdo' : 'la split sheet'; }
  function tabla(cab, filas, clase) { return '<table class="ct-tabla' + (clase ? ' ' + clase : '') + '"><tr>' + cab.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr>' + filas.map(function (f) { return '<tr>' + f.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>'; }
  // Reparto que declaran las partes: mientras falte alguien, las cifras ajenas van tapadas («·»).
  function repartoHtml(rp) {
    if (!rp) return '';
    var filas = (rp.filas || []).map(function (f) {
      return [f.parte + (f.yo ? ' (tú)' : '') + (f.puesto ? '' : ' ⏳'), f.aportacion || '—', f.composicion, f.master];
    });
    var h = tabla(['Parte', 'Qué hizo', 'Composición', 'Máster'], filas, 'rep');
    // 24-nov-2026: con propuesta (la del promotor o una de negociación) nadie declara su % en el formulario.
    if (rp.tapado && rp.por_propuesta) return '<p class="ct-small ct-mut">El reparto se cierra con una propuesta completa: quien la hace la ve entera y los demás, al guardar sus datos, la aceptan o proponen otra. Nadie firma hasta que todos aceptéis la misma.</p>';
    if (rp.tapado) return h + '<p class="ct-small ct-mut">Cada parte pone su porcentaje por su cuenta: hasta que estéis todos no se ven los de los demás.</p>';
    h += '<p class="ct-small"><b>Suman:</b> composición ' + esc(rp.suma_composicion) + ' · máster ' + esc(rp.suma_master) + '</p>';
    return h;
  }
  // Las partes firman desde países distintos: toda hora se enseña en la del navegador Y en UTC, rotuladas.
  function hora(ts) {
    if (!ts) return '';
    var d = new Date(String(ts).replace(' ', 'T'));
    if (isNaN(d.getTime())) return String(ts);
    var loc;
    try { loc = d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { loc = d.toString().slice(0, 21); }
    var u = ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2);
    return loc + ' (tu hora) · ' + u + ' UTC';
  }
  // Apartado de NEGOCIACIÓN (15-oct-2026): una parte propone el reparto completo y las demás aceptan o contraproponen.
  // Nadie firma hasta que todas han aceptado LA MISMA propuesta.
  function negociacionHtml(ng, partes, caso) {
    if (!ng) return '';
    var pr = ng.propuesta, abierto = (caso === 'proponer' && !pr);
    var h = abierto ? '' : '<h2 style="margin-top:0">Negociar el reparto</h2>';
    if (pr) {
      h += '<p class="ct-small ct-mut" style="margin:0 0 6px">Propuesta nº ' + esc(pr.ronda) + ' · la hizo <b>' + esc(pr.mia ? 'tú' : pr.por) + '</b>' + (pr.cuando ? ' · ' + esc(hora(pr.cuando)) : '') + '</p>';
      h += tabla(['Parte', 'Composición', 'Máster'], (pr.filas || []).map(function (f) {
        return [f.parte + (f.yo ? ' (tú)' : ''), f.composicion, f.master];
      }), 'rep');
      h += '<p class="ct-small"><b>Suman:</b> composición ' + esc(pr.suma_composicion) + ' · máster ' + esc(pr.suma_master) + '</p>';
      if (pr.nota) h += '<p class="ct-small">Lo explica así: «' + esc(pr.nota) + '»</p>';
      h += '<p class="ct-small ct-mut">' + (ng.aceptada_por || []).length + ' de ' + (partes || []).length + ' la han aceptado' +
        ((ng.falta || []).length ? ' · falta: ' + esc((ng.falta || []).join(', ')) : '') + '</p>';
      if (!ng.yo_acepte) h += '<button type="button" class="ct-btn" id="neg-ok">Acepto este reparto</button>';
      else h += '<p class="ct-okbox" style="display:block">✓ Ya has aceptado esta propuesta. Falta que la acepten: ' + esc((ng.falta || []).join(', ') || 'nadie') + '.</p>';
      h += '<button type="button" class="ct-btn sec" id="neg-otra">' + (ng.yo_acepte ? 'Cambiar de idea y proponer otro' : 'Proponer otro reparto') + '</button>';
    } else if (!abierto) {
      h += '<p>Podéis cuadrarlo de dos maneras: cada uno cambia su porcentaje abajo, o alguien propone aquí el reparto completo y los demás lo aceptan.</p>';
      h += '<button type="button" class="ct-btn sec" id="neg-otra">Proponer un reparto para todos</button>';
    }
    if (ng.tope) h += '<p class="ct-errbox" style="display:block">Habéis llegado al tope de propuestas de este acuerdo. Hablad con Macuto.</p>';
    var base = (pr && pr.filas) || (ng.partida && ng.partida.filas) || [];
    h += '<form id="fp" style="' + (abierto ? '' : 'display:none;') + 'margin-top:10px">' +
      '<p class="ct-small"><b>Tu propuesta</b> — pon lo que crees que le toca a cada uno. Cada columna tiene que sumar 100 %.</p>' +
      '<table class="ct-tabla ct-prop"><tr><th>Parte</th><th>Composición</th><th>Máster</th></tr>' +
      base.map(function (f, k) {
        var c = String(f.composicion || '').replace(/[^0-9,.]/g, ''), m = String(f.master || '').replace(/[^0-9,.]/g, '');
        return '<tr><td>' + esc(f.parte) + (f.yo ? ' (tú)' : '') + '</td>' +
          '<td><div class="ct-pct"><input type="text" inputmode="decimal" maxlength="6" data-capa="composicion" data-k="' + k + '" value="' + esc(c) + '"><span>%</span></div></td>' +
          '<td><div class="ct-pct"><input type="text" inputmode="decimal" maxlength="6" data-capa="master" data-k="' + k + '" value="' + esc(m) + '"><span>%</span></div></td></tr>';
      }).join('') + '</table>' +
      '<p class="ct-small" id="fp-suma"></p>' +
      '<label for="fp-nota">Por qué lo propones así <span class="ct-mut ct-small">(opcional, lo verán las otras partes y queda en el acuerdo)</span></label>' +
      '<input type="text" id="fp-nota" maxlength="280" autocomplete="off">' +
      '<div class="ct-errbox" id="fp-err"></div><button type="submit" class="ct-btn" id="fp-go">Enviar la propuesta</button></form>';
    if ((ng.historial || []).length) {
      h += '<details class="ct-det"><summary>Ver el historial de propuestas (' + (ng.historial || []).length + ')</summary>' +
        (ng.historial || []).map(function (x) {
          return '<p class="ct-small" style="margin:8px 0 2px"><b>nº ' + esc(x.ronda) + '</b> · ' + esc(x.por) + ' · ' + esc(hora(x.cuando)) + (x.nota ? ' · «' + esc(x.nota) + '»' : '') + '</p>' +
            tabla(['Parte', 'Composición', 'Máster'], (x.filas || []).map(function (f) { return [f.parte, f.composicion, f.master]; }), 'rep');
        }).join('') + '</details>';
    }
    return h;
  }
  function negociacionEnganchar(st) {
    var ng = st.negociacion;
    if (!ng) return;
    var fp = $('#fp'), ok = $('#neg-ok'), otra = $('#neg-otra');
    if (fp && fp.style.display !== 'none') setTimeout(function () { try { sumaProp(); } catch (e) { } }, 0);
    if (otra && fp) otra.addEventListener('click', function () { fp.style.display = ''; otra.style.display = 'none'; sumaProp(); $('#fp').scrollIntoView({ block: 'center' }); });
    if (ok) ok.addEventListener('click', function () {
      ok.disabled = true; ok.textContent = 'Aceptando…';
      api('/aceptar', { method: 'POST', body: { hash: (ng.propuesta || {}).hash } }).then(function (r) {
        if (r.ok && r.j && r.j.ok) { load(); return; }
        ok.disabled = false; ok.textContent = 'Acepto este reparto';
        var eb = $('#errbox') || $('#fp-err'); if (eb) { eb.textContent = (r.j && r.j.error) || 'No se pudo aceptar.'; eb.style.display = 'block'; }
        if (r.status === 409) setTimeout(load, 1200);
      }).catch(function () { ok.disabled = false; ok.textContent = 'Acepto este reparto'; });
    });
    function filasProp() {
      var ins = fp ? fp.querySelectorAll('input[data-capa]') : [], filas = [], i;
      for (i = 0; i < ins.length; i++) {
        var k = parseInt(ins[i].getAttribute('data-k'), 10);
        filas[k] = filas[k] || {};
        filas[k][ins[i].getAttribute('data-capa')] = ins[i].value.trim();
      }
      return filas;
    }
    function sumaProp() {
      var f = filasProp(), sc = 0, sm = 0, i;
      for (i = 0; i < f.length; i++) {
        sc += parseFloat(String(f[i].composicion || '0').replace(',', '.')) || 0;
        sm += parseFloat(String(f[i].master || '0').replace(',', '.')) || 0;
      }
      sc = Math.round(sc * 100) / 100; sm = Math.round(sm * 100) / 100;
      var el = $('#fp-suma');
      if (el) {
        el.innerHTML = '<b>Suman:</b> composición ' + sc + ' % · máster ' + sm + ' %' +
          ((sc === 100 && sm === 100) ? ' ✅' : ' — las dos tienen que dar 100 %');
        el.className = 'ct-small' + ((sc === 100 && sm === 100) ? ' ct-ok' : ' ct-bad');
      }
    }
    if (fp) {
      fp.addEventListener('input', sumaProp);
      fp.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var eb = $('#fp-err'), b = $('#fp-go');
        eb.style.display = 'none'; b.disabled = true; b.textContent = 'Enviando…';
        api('/propuesta', { method: 'POST', body: { filas: filasProp(), nota: ($('#fp-nota') || {}).value || '' } }).then(function (r) {
          b.disabled = false; b.textContent = 'Enviar la propuesta';
          if (r.ok && r.j && r.j.ok) { load(); return; }
          eb.textContent = (r.j && r.j.error) || ((r.j && r.j.errores) || []).join(' ') || 'No se pudo enviar la propuesta.';
          eb.style.display = 'block';
        }).catch(function () { b.disabled = false; b.textContent = 'Enviar la propuesta'; eb.textContent = 'Problema de conexión.'; eb.style.display = 'block'; });
      });
    }
  }
  function resumenHtml(r) {
    if (!r) return '';
    var h = '<p class="ct-small ct-mut" style="margin-bottom:4px">' + esc(r.tipo) + '</p><h2>«' + esc(r.titulo) + '»' + (r.version ? ' <span class="ct-mut ct-small">(' + esc(r.version) + ')</span>' : '') + '</h2>' +
      (r.artista ? '<p class="ct-small ct-mut" style="margin:-6px 0 8px">Se publica como ' + esc(r.artista) + '</p>' : '');
    if ((r.condiciones || []).length) {   // 24-nov: licencias, cesiones y encargos enseñan sus condiciones antes de los datos
      h += '<p class="ct-small" style="margin:10px 0 2px"><b>Condiciones</b></p><dl class="ct-cond" style="margin:0">' +
        r.condiciones.map(function (c) { return '<dt class="ct-small ct-mut" style="margin-top:6px">' + esc(c.etiqueta) + '</dt><dd class="ct-small" style="margin:0"><b>' + esc(c.valor) + '</b></dd>'; }).join('') + '</dl>';
    }
    if ((r.composicion || []).length) {
      h += '<p class="ct-small" style="margin:10px 0 2px"><b>Composición</b> ' + (r.split === false ? '(del beat y la canción)' : '(letra y música)') + '</p>' + tabla(['Parte', 'Papel', '%'], (r.composicion || []).map(function (x) { return [x.parte, x.rol, x.pct]; }));
      if ((r.master || []).length) h += '<p class="ct-small" style="margin:10px 0 2px"><b>Máster</b> (la grabación)</p>' + tabla(['Parte', '%'], (r.master || []).map(function (x) { return [x.parte, x.pct]; }));
    } else if (r.reparto) {
      h += '<p class="ct-small" style="margin:10px 0 2px"><b>Reparto</b> — lo ponéis vosotros</p>' + repartoHtml(r.reparto);
    }
    return h + (r.distribucion ? '<p class="ct-small">' + esc(r.distribucion) + '</p>' : '') + (r.samples ? '<p class="ct-small">Material de terceros: ' + esc(r.samples) + '</p>' : '');
  }

  // ENLACES para el promotor: los crea el sistema y se los pasa ÉL a cada persona. Nosotros no escribimos a nadie.
  function enlacesHtml(st) {
    var e = st.enlaces || [];
    if (!e.length) return '';
    return card('<h2 style="margin-top:0">' + (e.length === 1 ? 'Pásale su enlace' : 'Pásales su enlace') + '</h2>' +
      '<p class="ct-small">Cada persona entra con su propio documento. Mándaselo tú por WhatsApp o como quieras: nosotros no le mandamos el enlace. Cuando firméis todos, cada uno recibe por correo su copia firmada.</p>' +
      e.map(function (x, k) {
        var estado = x.firmado ? '✅ ya ha firmado' : (x.datos ? '📝 ha puesto sus datos' : (x.entro ? '🔑 ha entrado' : '⏳ todavía no ha entrado'));
        return '<div class="ct-enl"><p class="ct-small" style="margin:0 0 4px"><b>' + esc(x.alias) + '</b> <span class="ct-mut">· ' + esc(x.rol) + ' · ' + estado + '</span></p>' +
          '<label class="ct-small ct-mut" for="enl-' + k + '">Su enlace</label><input type="text" readonly value="' + esc(x.url) + '" id="enl-' + k + '">' +
          '<button type="button" class="ct-btn sec" data-copiar="' + k + '">Copiar el mensaje para ' + esc(x.alias) + '</button></div>';
      }).join(''));
  }
  function enlacesEnganchar(st) {
    var e = st.enlaces || [], bs = document.querySelectorAll('[data-copiar]'), i;
    function copiar(txt, btn, nombre) {
      function fin(ok) { btn.textContent = ok ? '✓ Copiado' : 'Cópialo del recuadro de arriba'; setTimeout(function () { btn.textContent = 'Copiar el mensaje para ' + nombre; }, 2500); }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt).then(function () { fin(true); }, function () { fin(false); }); return; }
      } catch (err) { }
      fin(false);
    }
    for (i = 0; i < bs.length; i++) {
      (function (b) {
        b.addEventListener('click', function () {
          var k = parseInt(b.getAttribute('data-copiar'), 10), x = e[k];
          if (x) copiar(x.texto || x.url, b, x.alias);
        });
      })(bs[i]);
    }
  }

  // OBRA: el promotor (nuestro artista) pone los datos de la canción y dice con quién la ha hecho (15-oct-2026).
  function vistaObra(st) {
    var campos = st.campos_obra || [], pre = st.prefill_obra || {}, roles = st.roles || [], maxp = (st.max_partes || 8) - 1;
    // 24-nov (juez del móvil): borrador en esta pestaña. Si sale a WhatsApp a preguntar o la sesión caduca, no pierde nada.
    var BKEY = 'dap-obra-' + TOKEN.slice(0, 8), bor = {}, kk, pre2 = {};
    try { bor = JSON.parse(sget(BKEY) || '{}') || {}; } catch (e0) { bor = {}; }
    for (kk in pre) if (pre.hasOwnProperty(kk)) pre2[kk] = pre[kk];
    for (kk in (bor.datos || {})) if (bor.datos.hasOwnProperty(kk) && !pre2[kk]) pre2[kk] = bor.datos[kk];
    pre = pre2;
    var T = st.textos_obra || {}, BT = maxp > 1 ? 'Guardar y crear los enlaces' : 'Guardar y crear su enlace';      // 24-nov-2026: cada tipo de acuerdo trae sus textos (licencia, cesión, encargo…)
    function filaInv(k, v) {
      v = v || {};
      return '<div class="ct-inv" data-inv="' + k + '">' +
        '<div class="ct-field" data-k="inv' + k + '.alias"><label>Nombre o nombre artístico</label>' +
        '<input type="text" maxlength="60" data-c="alias" value="' + esc(v.alias || '') + '"><p class="ct-err"></p></div>' +
        '<div class="ct-field" data-k="inv' + k + '.rol"><label>' + esc(T.rol || '¿Qué hizo en la canción?') + '</label><select data-c="rol">' +
        (roles.length === 1 ? '' : '<option value="">Elige…</option>') + roles.map(function (r) { return '<option' + (r === v.rol || roles.length === 1 ? ' selected' : '') + '>' + esc(r) + '</option>'; }).join('') +
        '</select><p class="ct-err"></p></div>' +
        '<div class="ct-field" data-k="inv' + k + '.email"><label>Su correo <span class="ct-mut ct-small">(opcional)</span></label>' +
        '<input type="email" maxlength="120" data-c="email" value="' + esc(v.email || '') + '"><p class="ct-err"></p></div>' +
        (k > 0 ? '<button type="button" class="ct-quitar" data-quitar="' + k + '">Quitar esta persona</button>' : '') + '</div>';
    }
    app.innerHTML = '<div class="ct-steps"><i class="on"></i><i></i><i></i></div><p class="ct-small ct-mut">Para empezar · ' + esc(T.paso || 'la canción') + '</p>' +
      '<h1>Prepara el acuerdo</h1>' +
      card('<p>' + esc(T.intro || 'Pon los datos de la canción y di con quién la has hecho.') + ' Cuando guardes, te damos <b>' + (maxp > 1 ? 'el enlace de cada persona' : 'su enlace') + '</b> para que se lo pases tú.</p>' +
        '<p class="ct-small ct-mut">' + esc(T.despues || 'Después pondrás tus datos y cada uno los suyos. Nadie firma hasta que estéis todos y el reparto cuadre.') + '</p>') +
      '<form id="fo" novalidate>' + card(campos.map(function (c) { return campoHtml(c, pre, false); }).join('')) +
      card('<h2 style="margin-top:0">' + esc(T.con_quien || 'Con quién la has hecho') + '</h2>' +
        '<p class="ct-small ct-mut">' + (maxp > 1 ? 'Tú ya estás dentro: añade a las demás personas.' : 'Tú ya estás dentro: pon a la otra persona.') + ' Si no sabes su correo, déjalo en blanco.</p>' +
        '<div id="invs">' + filaInv(0, (st.invitados || [])[0] || (bor.invitados || [])[0]) + '</div>' +
        (maxp > 1 ? '<button type="button" class="ct-btn sec" id="mas-inv">Añadir otra persona</button>' : '') +
        '<p class="ct-err" id="err-inv"></p>') +
      card('<div class="ct-errbox" id="errbox"></div><button type="submit" class="ct-btn" id="ogo">' + BT + '</button>') +
      '</form>' + foot();
    arriba();
    var f = $('#fo'), n = 1;
    function partes() {        // el selector de «quién la sube» se rellena con lo que se vaya escribiendo
      var sel = f.querySelector('[data-partes]'), i, filas = f.querySelectorAll('.ct-inv'), v = sel ? sel.value : '1';
      if (!sel) return;
      var ops = '<option value="1">Yo</option>';
      for (i = 0; i < filas.length; i++) {
        var al = filas[i].querySelector('[data-c="alias"]').value.trim();
        if (al) ops += '<option value="' + (i + 2) + '">' + esc(al) + '</option>';
      }
      sel.innerHTML = ops; sel.value = v;
    }
    function condiciones() {
      var fs = f.querySelectorAll('.ct-field[data-silleno]'), i;
      for (i = 0; i < fs.length; i++) {
        var k = fs[i].getAttribute('data-silleno'), el = f.querySelector('[name="' + k + '"]');
        fs[i].style.display = (el && el.value.trim()) ? '' : 'none';
      }
    }
    function quitar() {
      var bs = f.querySelectorAll('[data-quitar]'), i;
      for (i = 0; i < bs.length; i++) {
        (function (b) {
          b.addEventListener('click', function () {
            var fila = b.parentNode;
            fila.parentNode.removeChild(fila); partes();
            $('#mas-inv').style.display = '';
          });
        })(bs[i]);
      }
    }
    if ($('#mas-inv')) $('#mas-inv').addEventListener('click', function () {
      if (f.querySelectorAll('.ct-inv').length >= maxp) { $('#mas-inv').style.display = 'none'; return; }
      var div = document.createElement('div'); div.innerHTML = filaInv(n++, null);
      $('#invs').appendChild(div.firstChild); quitar(); partes();
      if (f.querySelectorAll('.ct-inv').length >= maxp) $('#mas-inv').style.display = 'none';
    });
    function guardar() {
      var dd = {}, j2, el2, filas2 = f.querySelectorAll('.ct-inv'), iv = [];
      for (j2 = 0; j2 < campos.length; j2++) { el2 = f.querySelector('[name="' + campos[j2].clave + '"]'); if (el2 && el2.value) dd[campos[j2].clave] = el2.value; }
      for (j2 = 0; j2 < filas2.length; j2++) iv.push({ alias: filas2[j2].querySelector('[data-c="alias"]').value, rol: filas2[j2].querySelector('[data-c="rol"]').value, email: filas2[j2].querySelector('[data-c="email"]').value });
      sset(BKEY, JSON.stringify({ datos: dd, invitados: iv }));
    }
    f.addEventListener('input', function () { partes(); condiciones(); guardar(); });
    f.addEventListener('change', function () { partes(); condiciones(); });
    condiciones(); partes();
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var eb = $('#errbox'); eb.style.display = 'none';
      var fs = f.querySelectorAll('.ct-field'), i;
      for (i = 0; i < fs.length; i++) { fs[i].className = 'ct-field'; fs[i].querySelector('.ct-err').textContent = ''; }
      if ($('#err-inv')) $('#err-inv').textContent = '';
      var datos = {}, j;
      for (j = 0; j < campos.length; j++) {
        var el = f.querySelector('[name="' + campos[j].clave + '"]');
        if (el && el.parentNode.style.display !== 'none') datos[campos[j].clave] = el.value.trim();
      }
      var invs = [], filas = f.querySelectorAll('.ct-inv');
      for (i = 0; i < filas.length; i++) {
        invs.push({ alias: filas[i].querySelector('[data-c="alias"]').value.trim(),
                    rol: filas[i].querySelector('[data-c="rol"]').value.trim(),
                    email: filas[i].querySelector('[data-c="email"]').value.trim() });
      }
      var b = $('#ogo'); b.disabled = true; b.textContent = 'Guardando…';
      api('/obra', { method: 'POST', body: { datos: datos, invitados: invs } }).then(function (r) {
        b.disabled = false; b.textContent = BT;
        if (r.ok && r.j && r.j.ok) { try { sessionStorage.removeItem(BKEY); } catch (e1) { } load(); return; }
        if (r.status === 401) { load(); return; }
        var errs = (r.j && r.j.errores) || {}, k2, primero = null;
        for (k2 in errs) {
          if (k2 === 'invitados') { if ($('#err-inv')) $('#err-inv').textContent = errs[k2]; continue; }
          var fld = f.querySelector('.ct-field[data-k="' + k2 + '"]');
          if (fld) { fld.className = 'ct-field bad'; fld.querySelector('.ct-err').textContent = errs[k2]; if (!primero) primero = fld; }
        }
        eb.textContent = (r.j && r.j.error) || 'No se pudieron guardar los datos.'; eb.style.display = 'block';
        if (primero) primero.scrollIntoView({ block: 'center' });
      }).catch(function () { b.disabled = false; b.textContent = BT; eb.textContent = 'Problema de conexión. Inténtalo de nuevo.'; eb.style.display = 'block'; });
    });
  }

  // Pinta un campo del formulario (lo usan los datos de cada parte y los datos de la canción del promotor).
  function campoHtml(c, pre, docFijo) {
      var v = pre[c.clave] == null ? '' : String(pre[c.clave]), id = 'c-' + c.clave, entrada;
      if (c.tipo === 'opciones') {
        var ops = '<option value="">Elige…</option>';
        if (c.grupos) {
          ops += c.grupos.map(function (g) {
            var o = g[1].map(function (x) { return '<option' + (x === v ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('');
            return g[0] ? '<optgroup label="' + esc(g[0]) + '">' + o + '</optgroup>' : o;
          }).join('');
        } else {
          ops += c.opciones.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('');
        }
        entrada = '<select id="' + id + '" name="' + c.clave + '">' + ops + '</select>';
      } else if (c.tipo === 'fecha') {
        entrada = '<input id="' + id + '" name="' + c.clave + '" type="date" value="' + esc(v) + '">';
      } else if (c.tipo === 'parte') {
        entrada = '<select id="' + id + '" name="' + c.clave + '" data-partes="1"><option value="1">Yo</option></select>';
      } else if (c.tipo === 'pct') {
        entrada = '<div class="ct-pct"><input id="' + id + '" name="' + c.clave + '" type="text" inputmode="decimal" autocomplete="off" maxlength="6" value="' + esc(v) + '"><span>%</span></div>';
      } else {
        var ro = (c.tipo === 'doc' && docFijo) ? ' readonly' : '';
        var tipo = c.tipo === 'email' ? 'email' : (c.tipo === 'tel' ? 'tel' : 'text');
        var ac = { nombre_legal: 'name', email: 'email', telefono: 'tel', domicilio: 'street-address' }[c.clave] || 'off';
        entrada = '<input id="' + id + '" name="' + c.clave + '" type="' + tipo + '" autocomplete="' + ac + '" maxlength="' + (c.max || 120) + '" value="' + esc(v) + '"' + ro + '>';
      }
      var cond = (c.si ? ' data-si="' + esc(c.si[0]) + '|' + esc(c.si[1]) + '"' : '') +
        (c.si_no ? ' data-sino="' + esc(c.si_no[0]) + '|' + esc(c.si_no[1]) + '"' : '') +
        (c.si_lleno ? ' data-silleno="' + esc(c.si_lleno) + '"' : '');
      return '<div class="ct-field" data-k="' + c.clave + '"' + cond + '>' +
        '<label for="' + id + '">' + esc(c.etiqueta) + (c.obligatorio ? '' : ' <span class="ct-mut ct-small">(opcional)</span>') + '</label>' + entrada +
        (c.ayuda ? '<p class="ct-hint">' + esc(c.ayuda) + '</p>' : '') +
        (c.detalle ? '<details class="ct-det"><summary>' + esc(c.detalle[0]) + '</summary><p>' + esc(c.detalle[1]) + '</p></details>' : '') +
        '<p class="ct-err"></p></div>';
  }

  // DATOS (acuerdos): cada parte pone SUS datos y, en una split sheet, SU reparto. Nadie ve los datos personales de otro.
  // st.parcial = el reparto no cuadró y solo se reabren los campos del reparto.
  function vistaDatos(st) {
    var campos = st.campos || [], pre = st.prefill || {}, parcial = !!st.parcial;
    var rp = st.reparto || (st.resumen && st.resumen.reparto) || null;
    var pasos = parcial ? '' : '<div class="ct-steps"><i class="on"></i><i></i><i></i></div><p class="ct-small ct-mut">Antes de firmar · tus datos</p>';
    var cab, intro;
    if (parcial) {
      var caso = st.reparto_caso || 'cuadrar', faltan = st.faltan_datos || [];
      var pend = faltan.length ? '<p class="ct-small ct-mut">Todavía falta por rellenar sus datos: ' + esc(faltan.join(', ')) + '. Podéis ir cerrando el reparto igualmente.</p>' : '';
      if (caso === 'proponer') {
        cab = '<h1>Propón el reparto</h1>';
        intro = card('<p>Dijiste que el reparto lo proponías tú. Pon lo que crees que le toca a cada uno de la composición y del máster: ' +
          'lo verán enteras las demás partes y podrán aceptarlo o proponer otra cosa.</p>' + pend);
      } else if (caso === 'responder') {
        cab = '<h1>Hay una propuesta de reparto</h1>';
        intro = card('<p>Léela entera antes de responder. Puedes aceptarla o proponer otra: nadie firma nada hasta que todas aceptéis la misma.</p>' + pend);
      } else {
        var falta = [];
        if (rp && rp.sobra_composicion) falta.push('la composición suma ' + esc(rp.suma_composicion));
        if (rp && rp.sobra_master) falta.push('el máster suma ' + esc(rp.suma_master));
        cab = '<h1>Hay que cuadrar el reparto</h1>';
        intro = card('<p class="ct-errbox" style="display:block">Cada capa tiene que sumar 100 % y ' + (falta.join(' y ') || 'no suma') + '.</p>' +
          '<p>Esto es lo que ha pedido cada uno. Nadie firma nada hasta que cuadre.</p>' + repartoHtml(rp));
      }
      intro += (st.negociacion ? card(negociacionHtml(st.negociacion, st.partes, caso)) : '');
    } else {
      cab = '<h1>Tus datos para el acuerdo</h1>';
      intro = (st.autoservicio && !st.promotor ? card('<p class="ct-small"><b>Esto lo ha preparado ' + esc(st.autoservicio.preparo) + '</b> con la herramienta de Macuto Music. ' +
          'Macuto Music no es parte de este acuerdo: facilita la plantilla y la herramienta de firma, no ha revisado lo que pone, no asesora a ninguna de las partes y no responde de lo que pactéis. ' +
          'Sí responde, conforme a la ley, de que la herramienta funcione como se describe y de que el documento reproduzca la plantilla publicada con los datos que escribáis. ' +
          'Revisa las condiciones: si algo no es lo que hablasteis, no pongas tus datos y díselo antes.</p>' +
          (st.leido_no_parte ? '' : '<label style="display:flex;gap:10px;align-items:flex-start;padding:6px 0"><input type="checkbox" id="noparte" style="width:22px;height:22px;margin-top:2px;flex:none"> <span>Lo he leído.</span></label>')) : '') +
        card(resumenHtml(st.resumen) +
        '<p class="ct-small ct-mut" style="margin-top:8px">Tu papel: <b>' + esc(st.rol) + '</b>. Si algo del acuerdo no es lo que habíais hablado, no sigas: arréglalo primero con la otra parte. Si tienes dudas de cómo funciona la herramienta, escribe al equipo.</p>');
    }
    var hayPct = false;
    for (var q = 0; q < campos.length; q++) if (campos[q].tipo === 'pct') hayPct = true;
    var avisoPct = (hayPct && !parcial) ? '<div class="ct-okbox" style="display:block">Los porcentajes los ponéis vosotros, no nosotros. Escribe el que crees que te corresponde: ' +
      'los demás ponen el suyo sin ver el tuyo. Cuando estéis todos, si no suma 100 % te lo enseñamos y lo ajustáis.</div>' : '';
    var html = pasos + cab + intro + (!campos.length ? '' : '<form id="fd" novalidate>' + card(avisoPct + campos.map(function (c) {
      return campoHtml(c, pre, st.doc_fijo);
    }).join('') +
    '<div class="ct-okbox" id="aviso-ent" style="display:none">Sin alta en una entidad de gestión no cobrarás tu parte de la composición a través de ella. Puedes firmar igual y darte de alta después: el acuerdo lo recoge.</div>' +
    '<label class="ct-chk"><input type="checkbox" id="conf"> <span id="conf-t">' + (parcial ? 'Confirmo que este es el porcentaje que pido.' : 'Confirmo que mis datos son correctos y que se usarán para preparar el acuerdo.') + '</span></label>' +
    '<div class="ct-errbox" id="errbox"></div><button type="submit" class="ct-btn" id="dgo">' + (parcial ? 'Guardar mi porcentaje' : 'Guardar mis datos') + '</button>' + (parcial ? '' : RGPD)) + '</form>') + foot();
    app.innerHTML = html; arriba();
    var f = $('#fd');
    if (!f) { if (parcial) negociacionEnganchar(st); return; }
    var etiqueta = parcial ? 'Guardar mi porcentaje' : 'Guardar mis datos';
    function val(k) { var el = f.querySelector('[name="' + k + '"]'); return el ? el.value.trim() : ''; }
    function condiciones() {
      var fs = f.querySelectorAll('.ct-field'), i;
      for (i = 0; i < fs.length; i++) {
        var si = fs[i].getAttribute('data-si'), sino = fs[i].getAttribute('data-sino'), sil = fs[i].getAttribute('data-silleno'), ver = true;
        if (si) { var a = si.split('|'); ver = val(a[0]) === a[1]; }
        if (sino) { var b2 = sino.split('|'); ver = val(b2[0]) !== b2[1]; }
        if (sil) ver = !!val(sil);
        fs[i].style.display = ver ? '' : 'none';
      }
      var ae = $('#aviso-ent');
      if (ae) ae.style.display = (val('entidad_autor').indexOf('No estoy') === 0) ? 'block' : 'none';
    }
    f.addEventListener('change', condiciones); f.addEventListener('input', condiciones); condiciones();
    if (parcial) negociacionEnganchar(st);
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var eb = $('#errbox'); eb.style.display = 'none';
      var fs = f.querySelectorAll('.ct-field'), datos = {}, i;
      for (i = 0; i < fs.length; i++) { fs[i].className = 'ct-field'; if (fs[i].style.display !== 'none') datos[fs[i].getAttribute('data-k')] = val(fs[i].getAttribute('data-k')); }
      if ($('#noparte') && !$('#noparte').checked) { eb.textContent = 'Marca arriba que has leído que Macuto Music no es parte del acuerdo.'; eb.style.display = 'block'; $('#noparte').focus(); return; }
      if (!$('#conf').checked) { eb.textContent = 'Marca la casilla para confirmar.'; eb.style.display = 'block'; return; }
      var b = $('#dgo'); b.disabled = true; b.textContent = 'Guardando…';
      api('/datos', { method: 'POST', body: { confirmar: true, datos: datos, leido_no_parte: !!($('#noparte') && $('#noparte').checked) } }).then(function (r) {
        b.disabled = false; b.textContent = etiqueta;
        if (r.ok && r.j && r.j.ok) { load(); return; }
        if (r.status === 401) { load(); return; }
        var errs = (r.j && r.j.errores) || {}, k, primero = null;
        for (k in errs) { var fld = f.querySelector('.ct-field[data-k="' + k + '"]'); if (fld) { fld.className = 'ct-field bad'; fld.querySelector('.ct-err').textContent = errs[k]; if (!primero) primero = fld; } }
        eb.textContent = (r.j && r.j.error) || 'No se pudieron guardar los datos.'; eb.style.display = 'block';
        if (r.j && r.j.recargar) {      // falla un dato que este formulario no enseña: se reabre entero
          var bs = document.createElement('button'); bs.type = 'button'; bs.className = 'ct-btn sec'; bs.textContent = 'Revisar mis datos';
          bs.addEventListener('click', function () { load(); }); eb.appendChild(document.createElement('br')); eb.appendChild(bs);
        }
        if (primero) primero.scrollIntoView({ block: 'center' });
      }).catch(function () { b.disabled = false; b.textContent = etiqueta; eb.textContent = 'Problema de conexión. Inténtalo de nuevo.'; eb.style.display = 'block'; });
    });
  }

  function vistaEsperaDatos(st) {
    var faltan = (st.partes || []).filter(function (p) { return !p.datos; });
    app.innerHTML = '<h1>Datos guardados</h1>' + card('<p class="ct-okbox">✓ Tus datos para «' + esc((st.resumen || {}).titulo || st.titulo) + '» están guardados.</p>' +
      '<p>' + (faltan.length ? 'Falta que ' + (faltan.length > 1 ? 'rellenen sus datos: ' : 'rellene sus datos: ') + faltan.map(function (p) { return '<b>' + esc(p.nombre) + '</b>'; }).join(', ') + '. Cuando estén todos, en este mismo enlace podrás leer el acuerdo y firmarlo.' : 'Ya están los de todos: preparando el documento…') + '</p>' +
      '<ul class="ct-equipo">' + (st.partes || []).map(function (p) { return '<li>' + (p.datos ? '✅ ' : '⏳ ') + '<b>' + esc(p.nombre) + '</b>' + (p.yo ? ' <span class="ct-tag">tú</span>' : '') + '<br><span class="ct-mut ct-small">' + esc(p.rol) + (p.datos ? ' · datos listos' : ' · faltan sus datos') + '</span></li>'; }).join('') + '</ul>' +
      ((st.resumen && st.resumen.reparto) ? '<p class="ct-small" style="margin:12px 0 2px"><b>Reparto</b></p>' + repartoHtml(st.resumen.reparto) +
        '<p class="ct-small ct-mut">Cuando estéis todos, sumamos: si las dos capas dan 100 % se prepara el documento; si no, os enseñamos quién pidió qué para ajustarlo.</p>' : '') +
      '<button type="button" class="ct-btn sec" id="editar">Cambiar mis datos</button>') + foot();
    arriba();
    $('#editar').addEventListener('click', function () { vistaDatos(st); });
    pollTimer = setTimeout(load, 30000);
  }

  function vistaFirma(st) {
    var E = [];
    E.push({ id: 'quien', t: 'Quién firma', sigue: 'Seguir', html:
      (st.acuerdo ? '<div class="ct-resumen">' + resumenHtml(st.resumen) + '</div>' : '') +
      '<p>Vas a firmar ' + doc(st) + ' <b>«' + esc(st.acuerdo ? (st.resumen || {}).titulo : st.titulo) + '»</b> como <b>' + esc(st.nombre) + '</b> (' + esc(st.rol) + ').</p>' +
      '<p class="ct-mut ct-small">Firmamos todos los que aparecemos en el acuerdo, cada uno desde su enlace:</p>' + listaPartes(st) +
      (st.puede_corregir ? '<p class="ct-small ct-mut">¿Algún dato tuyo está mal? Puedes corregirlo mientras no haya firmado nadie; el documento se vuelve a preparar.</p><button type="button" class="ct-btn sec" id="corregir">Corregir mis datos</button>' : '') +
      (st.autoservicio ? '<p class="ct-small ct-mut">¿Algo no cuadra? No firmes: corrige tus datos o arréglalo antes con la otra parte.</p>'
        : '<p class="ct-small ct-mut">¿Algo no cuadra (tu nombre, tu porcentaje)? No firmes y escribe a Macuto antes.</p>') });
    var pags = ''; for (var p = 1; p <= st.paginas; p++) pags += '<img class="ct-pag" alt="Página ' + p + '" data-p="' + p + '"' + (p === st.paginas ? ' data-last="1"' : '') + '>';
    E.push({ id: 'doc', t: st.acuerdo ? 'Lee el acuerdo' : 'Lee la split sheet', sigue: 'Lo he leído', html:
      '<p class="ct-small ct-mut">Son ' + st.paginas + ' página' + (st.paginas > 1 ? 's' : '') + ': bájalas hasta el final o <a id="pdflink" href="#" role="button">abre el PDF</a>.</p>' + pags });
    E.push({ id: 'firma', t: 'Firma', html:
      '<label class="ct-chk"><input type="checkbox" id="decl" required aria-labelledby="decl-t"> <span id="decl-t">' + esc(st.declaracion) + '</span></label>' +
      '<label for="nombre">Escribe tu nombre completo</label><input id="nombre" autocomplete="name" maxlength="120" placeholder="' + esc(st.nombre) + '">' +
      '<p class="ct-mut ct-small" style="margin-top:8px">Dibuja tu firma con el dedo:</p><canvas id="c"></canvas>' +
      '<p class="ct-small" style="margin:6px 0 0"><a href="#" id="clr" role="button">Borrar y repetir</a></p>' +
      '<button type="button" class="ct-btn" id="go" disabled>Firmar ' + doc(st) + '</button><p class="ct-small ct-center" id="msg"></p><p class="ct-small ct-mut ct-center" id="why"></p>' +
      '<p class="ct-small ct-mut">Firma electrónica (Reglamento eIDAS 910/2014). Quedan registrados tu nombre, la fecha y hora, la dirección IP, el navegador, la zona horaria, el tamaño de pantalla y la huella SHA-256 del documento que has visto. Todo va en la hoja de firmas que se añade al final de la copia firmada.</p>' + RGPD });
    var total = E.length, bars = '';
    for (var b0 = 0; b0 < total; b0++) bars += '<i data-b="' + b0 + '"></i>';
    var html = '<div class="ct-steps">' + bars + '</div><p class="ct-small ct-mut" id="paso-txt"></p><h1 id="etapa-t"></h1>' +
      '<p class="ct-small ct-mut">' + esc(st.titulo) + ' · ' + esc(st.nombre) + ' <span class="ct-tag">' + esc(st.rol) + '</span></p>';
    for (var e0 = 0; e0 < E.length; e0++) {
      html += '<section class="ct-etapa" data-i="' + e0 + '"' + (e0 ? ' hidden' : '') + '>' + card(E[e0].html) + '<div class="ct-nav">' +
        (e0 ? '<button type="button" class="ct-btn sec" data-atras="1">Atrás</button>' : '') +
        (E[e0].sigue ? '<button type="button" class="ct-btn" data-sigue="' + E[e0].id + '">' + esc(E[e0].sigue) + '</button>' : '') + '</div>' +
        (E[e0].id === 'doc' ? '<p class="ct-small ct-mut ct-center" id="why-doc"></p>' : '') + '</section>';
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
    // lienzo de firma (el mismo que el del contrato)
    var cv = $('#c'), cx, drawing = false, dirty = false, bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
    function fit() { var r = cv.getBoundingClientRect(), w = r.width | 0, hh = r.height | 0; if (!w || !hh) return; if (cx && cv.width === w && cv.height === hh) return; var tenia = dirty; cv.width = w; cv.height = hh; cx = cv.getContext('2d'); cx.lineWidth = 3; cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.strokeStyle = '#111'; if (tenia) { dirty = false; bx0 = by0 = 1e9; bx1 = by1 = -1e9; var m = $('#msg'); if (m) { m.textContent = 'La pantalla cambió de tamaño: vuelve a dibujar tu firma.'; m.style.color = '#b3261e'; } } }
    window.addEventListener('resize', fit);
    function pos(e) { var r = cv.getBoundingClientRect(), t = e.touches ? e.touches[0] : e; return [t.clientX - r.left, t.clientY - r.top]; }
    function ext(q) { bx0 = Math.min(bx0, q[0]); by0 = Math.min(by0, q[1]); bx1 = Math.max(bx1, q[0]); by1 = Math.max(by1, q[1]); }
    function down(e) { if (!cx) fit(); drawing = true; dirty = true; var q = pos(e); ext(q); cx.beginPath(); cx.moveTo(q[0], q[1]); e.preventDefault(); chk(); }
    function move(e) { if (!drawing) return; var q = pos(e); ext(q); cx.lineTo(q[0], q[1]); cx.stroke(); e.preventDefault(); }
    function up() { drawing = false; }
    cv.addEventListener('mousedown', down); cv.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    cv.addEventListener('touchstart', down, { passive: false }); cv.addEventListener('touchmove', move, { passive: false }); cv.addEventListener('touchend', up);
    function clr(e) { if (e) e.preventDefault(); if (cx) cx.clearRect(0, 0, cv.width, cv.height); dirty = false; bx0 = by0 = 1e9; bx1 = by1 = -1e9; chk(); }
    function recorte() { var pad = 10, x0 = Math.max(0, bx0 - pad), y0 = Math.max(0, by0 - pad), x1 = Math.min(cv.width, bx1 + pad), y1 = Math.min(cv.height, by1 + pad); var w = Math.max(12, x1 - x0), hh = Math.max(12, y1 - y0); var oc = document.createElement('canvas'); oc.width = w; oc.height = hh; oc.getContext('2d').drawImage(cv, x0, y0, w, hh, 0, 0, w, hh); return oc.toDataURL('image/png'); }
    $('#clr').addEventListener('click', clr);
    // visor: páginas bajo demanda; «leído» = la persona ha bajado y la última página, ya cargada, asoma en pantalla
    var visto = !!st.visto, imgs = document.querySelectorAll('img.ct-pag'), ult = document.querySelector('img.ct-pag[data-last]');
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
    function mirarFinal() {
      if (visto || !ult || ult.offsetParent === null || !cargada(ult)) return;
      if (st.paginas > 1 && window.scrollY < 200) return;
      if (ult.getBoundingClientRect().top < window.innerHeight - 40) { visto = true; chk(); }
    }
    if (ult) ult.addEventListener('load', mirarFinal);
    window.addEventListener('scroll', mirarFinal, { passive: true });
    $('#pdflink').addEventListener('click', function (e) { abrirPdf(e, '/pdf', 'Split_sheet.pdf'); visto = true; chk(); });
    function chk() {
      var bd = document.querySelector('[data-sigue="doc"]'); if (bd) bd.disabled = !visto;
      var wd = $('#why-doc'); if (wd) wd.textContent = visto ? '' : 'Baja hasta la última página (o abre el PDF) para seguir.';
      var decl = $('#decl') && $('#decl').checked;
      var okk = visto && decl && dirty;
      $('#go').disabled = !okk;
      $('#why').textContent = okk ? '' : (!visto ? 'Lee ' + doc(st) + ' hasta el final para poder firmar.' : (!decl ? 'Marca la casilla para poder firmar.' : 'Dibuja tu firma en el recuadro.'));
    }
    $('#decl').addEventListener('change', chk);
    mostrar(0);
    var bc = $('#corregir');
    if (bc) bc.addEventListener('click', function () {
      if (!window.confirm('¿Corregir tus datos? El documento se volverá a preparar y todos tendrán que leerlo de nuevo.')) return;
      bc.disabled = true;
      api('/corregir', { method: 'POST', body: {} }).then(function (r) { if (r.ok && r.j && r.j.ok) { load(); return; } bc.disabled = false; alert((r.j && r.j.error) || 'No se pudo. Escribe a Macuto.'); })
        .catch(function () { bc.disabled = false; alert('Problema de conexión. Inténtalo de nuevo.'); });
    });
    $('#go').addEventListener('click', function () {
      var m = $('#msg'); var nombre = $('#nombre').value.trim();
      if (!nombre) { m.textContent = 'Escribe tu nombre completo.'; m.style.color = '#b3261e'; return; }
      if (!dirty) { m.textContent = 'Dibuja tu firma en el recuadro.'; m.style.color = '#b3261e'; return; }
      var btn = $('#go'); btn.disabled = true; m.textContent = 'Registrando la firma…'; m.style.color = '';
      var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { }
      api('/firma', { method: 'POST', body: { acepto: true, nombre: nombre, tz: tz, pantalla: window.innerWidth + 'x' + window.innerHeight, firma: recorte(), hash: st.hash } }).then(function (r) {
        if (r.ok && r.j && r.j.ok) { load(); return; }
        if (r.status === 401) { load(); return; }
        btn.disabled = false; m.textContent = '❌ ' + ((r.j && r.j.error) || 'No se pudo registrar. Inténtalo de nuevo.'); m.style.color = '#b3261e';
      }).catch(function () { btn.disabled = false; m.textContent = '❌ Problema de conexión. Inténtalo de nuevo.'; m.style.color = '#b3261e'; });
    });
  }

  window.addEventListener('hashchange', function () {
    var h = (location.hash || '').replace(/^#/, '');
    if (/^[\w\-]{20,64}$/.test(h) && h !== TOKEN) location.reload();
  });
  load();
})();
