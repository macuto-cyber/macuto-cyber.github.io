/* macutomusic.com/mis-acuerdos — acceso privado de cada miembro del DAP a sus acuerdos (24-nov-2026).
   El enlace lo manda el equipo; el token (256 bits) va en el FRAGMENTO de la URL y el miembro entra con el documento de su
   contrato del DAP. La API vive en el M5 (firmar.macutomusic.com/api/mis/<token>, mis_acuerdos.py): sesión en el servidor,
   viaja en la cabecera X-Sobre-Sesion. Al abrir o crear un acuerdo, el servidor da también la sesión de SU parte del
   acuerdo, que se deja donde la busca /split (misma web, misma pestaña): no se pide el documento dos veces.
   Solo se acepta otra API en localhost (pruebas). ES5. */
(function () {
  'use strict';
  var app = document.getElementById('app');
  var TOKEN = (location.hash || '').replace(/^#/, '').trim();
  if (!/^[\w\-]{20,80}$/.test(TOKEN)) TOKEN = '';
  var LOCAL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
  function sget(k) { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function sset(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { } }
  function sdel(k) { try { sessionStorage.removeItem(k); } catch (e) { } }
  var apiParam = /[?&]api=([^&]+)/.exec(location.search);
  var apiLocal = apiParam ? decodeURIComponent(apiParam[1]) : sget('dap-api');
  if (LOCAL && apiParam) sset('dap-api', apiLocal);
  var API_BASE = (LOCAL && apiLocal) ? apiLocal.replace(/\/$/, '') : 'https://firmar.macutomusic.com';
  var API = API_BASE + '/api/mis/' + TOKEN;
  var SKEY = 'dap-mis-' + TOKEN.slice(0, 8);
  function ses() { return sget(SKEY); }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel) { return document.querySelector(sel); }
  function card(inner) { return '<div class="ct-card">' + inner + '</div>'; }
  function foot() { return '<p class="ct-foot">¿Dudas sobre cómo funciona? Escribe al equipo de Macuto Music por WhatsApp al <a href="https://wa.me/34630060006" target="_blank" rel="noopener">+34 630 06 00 06</a>.<br>Macuto Music<br><a href="/aviso-legal.html" target="_blank" rel="noopener">Aviso legal</a> · <a href="/privacidad.html#firma" target="_blank" rel="noopener">Privacidad</a></p>'; }
  function arriba() { try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); } }
  function msg(t, p, extra) { app.innerHTML = '<h1>' + esc(t) + '</h1>' + card('<p>' + esc(p) + '</p>' + (extra || '')) + foot(); arriba(); }
  function rgpd(t) { return t ? '<p class="ct-small ct-mut" style="margin-top:12px">' + esc(t) + ' <a href="/privacidad.html#firma" target="_blank" rel="noopener">Leer la política de privacidad</a>.</p>' : ''; }
  // Un error se VE: el CSS solo enseña .ct-err dentro de un .ct-field.bad (juez del móvil: antes no se veía ninguno).
  function error(id, texto) {
    var el = $('#' + id), campo = el && el.parentNode;
    if (!el) return;
    el.textContent = texto || '';
    if (campo && campo.className.indexOf('ct-field') >= 0) campo.className = texto ? 'ct-field bad' : 'ct-field';
    if (texto) { try { (campo.querySelector('input, select') || campo).focus(); } catch (e) { } }
  }
  function api(path, opts) {
    opts = opts || {};
    var o = { method: opts.method || 'GET', headers: {}, credentials: 'omit', mode: 'cors', cache: 'no-store' };
    if (ses()) o.headers['X-Sobre-Sesion'] = ses();
    if (opts.body !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(opts.body); }
    return fetch(API + (path || ''), o).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); });
  }
  // Ir al acuerdo con la sesión de SU parte ya puesta donde la busca /split (clave 'dap-split-' + 8 primeros del token).
  function irAlAcuerdo(url, s) {
    var h = (url || '').indexOf('#'), tok = h >= 0 ? url.slice(h + 1) : '';
    if (s && tok) sset('dap-split-' + tok.slice(0, 8), s);
    location.href = LOCAL ? location.origin + '/split/' + (apiLocal ? '?api=' + encodeURIComponent(apiLocal) : '') + '#' + tok : url;
  }

  if (!TOKEN) { msg('Enlace no válido', 'Este enlace no lleva tu clave de acceso. Pide al equipo de Macuto Music que te lo reenvíe.'); return; }

  function sinConexion() {
    msg('Sin conexión', 'Nuestro servidor no responde ahora mismo. Tu enlace sigue siendo válido: inténtalo en unos minutos.',
        '<p><button type="button" class="ct-btn sec" id="retry">Reintentar</button></p>');
    $('#retry').addEventListener('click', load);
  }

  function load() {
    api('').then(function (r) {
      var j = r.j || {};
      switch (j.vista) {
        case 'invalido': return msg('Enlace no válido', 'Este enlace no corresponde a ningún acceso. Si te lo mandó el equipo hace tiempo, pide uno nuevo.');
        case 'sin_contrato': return msg('Acceso no disponible', 'Este acceso ya no está activo. Escribe al equipo si crees que es un error.');
        case 'bloqueado': return msg('Acceso bloqueado', 'Se han agotado los intentos con el documento. Escribe al equipo: revisará tu acceso y te lo volverá a abrir.');
        case 'entrar': sdel(SKEY); return vistaEntrar(j);
        case 'panel': return vistaPanel(j);
      }
      sinConexion();
    }).catch(sinConexion);
  }

  function vistaEntrar(j) {
    app.innerHTML = '<h1>Mis acuerdos</h1>' + card('<h2>Entra con tu documento</h2>' +
      '<p>Para proteger tus datos, este acceso solo se abre con tu documento de identidad: el DNI, NIE o pasaporte que nos diste para este acceso.</p>' +
      '<form id="fp" novalidate><div class="ct-field"><label for="doc">DNI, NIE o pasaporte</label>' +
      '<input id="doc" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="20" required aria-describedby="err-doc">' +
      '<p class="ct-err" id="err-doc" role="alert"></p></div><button type="submit" class="ct-btn" id="go">Entrar</button></form>' +
      '<p class="ct-small ct-mut">El número con su letra; da igual si pones puntos, guiones o minúsculas.</p>' + rgpd(j.rgpd)) + foot();
    arriba();
    $('#fp').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var b = $('#go'), v = $('#doc').value.trim();
      error('err-doc', '');
      if (!v) { error('err-doc', 'Escribe tu documento.'); return; }
      b.disabled = true; b.textContent = 'Comprobando…';
      api('/entrar', { method: 'POST', body: { doc: v } }).then(function (r) {
        b.disabled = false; b.textContent = 'Entrar';
        if (r.ok && r.j && r.j.s) { sset(SKEY, r.j.s); load(); return; }
        if (r.j && r.j.vista) { load(); return; }
        error('err-doc', (r.j && r.j.error) || 'No se pudo comprobar. Inténtalo de nuevo.');
      }).catch(function () { b.disabled = false; b.textContent = 'Entrar'; error('err-doc', 'Problema de conexión. Inténtalo de nuevo.'); });
    });
  }

  function listaHtml(acs) {
    if (!acs.length) return '<p class="ct-mut">Todavía no has preparado ningún acuerdo desde aquí.</p>';
    return acs.map(function (a) {
      var partes = (a.partes || []).map(function (p) { return esc(p.alias) + (p.rol ? ' (' + esc(p.rol) + ')' : '') + (p.firmado ? ' ✓' : ''); }).join(' · ');
      return '<div style="padding:12px 0;border-bottom:1px solid rgba(0,0,0,.08)">' +
        '<p style="margin:0"><b>' + esc(a.titulo) + '</b></p>' +
        '<p class="ct-small ct-mut" style="margin:4px 0">' + esc(a.estado_txt) + (a.creado ? ' · desde el ' + esc(a.creado) : '') + '</p>' +
        (partes ? '<p class="ct-small" style="margin:4px 0">' + partes + '</p>' : '') +
        (a.puede_abrir ? '<p style="margin:6px 0 0"><button type="button" class="ct-btn sec" data-abrir="' + esc(a.id) + '">' + (a.estado === 'firmado' ? 'Ver el acuerdo firmado' : 'Abrir el acuerdo') + '</button></p>' : '') +
        '</div>';
    }).join('');
  }

  function vistaPanel(j) {
    var tipos = j.tipos || [];
    var asistente = !j.puede_crear ? '<p class="ct-errbox" style="display:block">' + esc(j.motivo) + '</p>' :
      '<form id="fn" novalidate>' +
      '<fieldset class="ct-field" style="border:0;padding:0;margin:0"><legend><b>¿Qué necesitas?</b></legend>' +
      tipos.map(function (t) {
        return '<label class="ct-opt" style="position:relative">' +
          '<input type="radio" name="tipo" value="' + esc(t.tipo) + '" style="position:absolute;opacity:0;width:1px;height:1px">' +
          '<b>' + esc(t.nombre) + '</b><span>' + esc(t.cuando) + '</span></label>';
      }).join('') + '<p class="ct-err" id="err-tipo" role="alert"></p></fieldset>' +
      '<div class="ct-field" id="campo-rol" style="display:none"><label for="rol">¿Qué eres tú en este acuerdo?</label>' +
      '<select id="rol" aria-describedby="ayuda-rol err-rol"></select><p class="ct-small ct-mut" id="ayuda-rol"></p><p class="ct-err" id="err-rol" role="alert"></p></div>' +
      '<div class="ct-field"><p class="ct-small" style="background:rgba(94,23,235,.06);padding:12px;border-radius:10px">' + esc(j.aviso) + '</p>' +
      '<label style="display:flex;gap:10px;align-items:flex-start;padding:6px 0"><input type="checkbox" id="acepto" style="width:22px;height:22px;margin-top:2px;flex:none"> <span>He leído el aviso y lo entiendo.</span></label>' +
      '<p class="ct-err" id="err-aviso" role="alert"></p></div>' +
      '<div class="ct-errbox" id="errbox" role="alert"></div><button type="submit" class="ct-btn" id="crear">Empezar el acuerdo</button></form>';
    app.innerHTML = '<h1>Hola, ' + esc(j.artista) + '</h1>' +
      card('<h2 style="margin-top:0">Tus acuerdos</h2>' + listaHtml(j.acuerdos || [])) +
      card('<h2 style="margin-top:0">Preparar uno nuevo</h2>' + asistente + rgpd(j.rgpd)) +
      '<p><button type="button" class="ct-btn sec" id="salir">Salir</button></p>' + foot();
    arriba();
    $('#salir').addEventListener('click', function () {
      api('/salir', { method: 'POST', body: {} }).then(function () { sdel(SKEY); load(); }).catch(function () { sdel(SKEY); load(); });
    });
    var bs = document.querySelectorAll('[data-abrir]'), q;
    for (q = 0; q < bs.length; q++) {
      (function (b) {
        b.addEventListener('click', function () {
          b.disabled = true;
          api('/abrir', { method: 'POST', body: { id: b.getAttribute('data-abrir') } }).then(function (r) {
            b.disabled = false;
            if (r.ok && r.j && r.j.url) { irAlAcuerdo(r.j.url, r.j.s); return; }
            if (r.status === 401) { load(); return; }
            alert((r.j && r.j.error) || 'No se pudo abrir. Inténtalo de nuevo.');
          }).catch(function () { b.disabled = false; alert('Problema de conexión. Inténtalo de nuevo.'); });
        });
      })(bs[q]);
    }
    var f = $('#fn');
    if (!f) return;
    var AYUDA = { 'Productor': 'Productor: el beat es tuyo o lo produces tú.', 'Artista': 'Artista: vas a cantar o publicar la canción.' };
    function rolesDe(t) { for (var i = 0; i < tipos.length; i++) if (tipos[i].tipo === t) return tipos[i].roles || []; return []; }
    f.addEventListener('change', function (ev) {
      if (ev.target.name === 'tipo') {
        var ops = f.querySelectorAll('.ct-opt'), k;
        for (k = 0; k < ops.length; k++) ops[k].className = 'ct-opt' + (ops[k].querySelector('input').checked ? ' on' : '');
        var rs = rolesDe(ev.target.value), sel = $('#rol');
        sel.innerHTML = '<option value="">Elige…</option>' + rs.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('');
        $('#ayuda-rol').textContent = rs.length === 2 ? (AYUDA[rs[0]] || '') + ' ' + (AYUDA[rs[1]] || '') : '';
        $('#campo-rol').style.display = '';
        error('err-tipo', '');
      }
      if (ev.target.id === 'rol') {
        $('#ayuda-rol').textContent = AYUDA[ev.target.value] || $('#ayuda-rol').textContent; error('err-rol', '');
      }
      if (ev.target.id === 'acepto') error('err-aviso', '');
    });
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var sel = f.querySelector('input[name="tipo"]:checked'), eb = $('#errbox');
      eb.style.display = 'none';
      if (!sel) { error('err-tipo', 'Elige qué acuerdo necesitas.'); return; }
      if (!$('#rol').value) { error('err-rol', 'Elige qué eres tú en este acuerdo.'); return; }
      if (!$('#acepto').checked) { error('err-aviso', 'Marca la casilla para seguir.'); return; }
      var b = $('#crear'); b.disabled = true; b.textContent = 'Creando…';
      api('/nuevo', { method: 'POST', body: { tipo: sel.value, rol: $('#rol').value, acepto_aviso: true, aviso_version: j.aviso_version } }).then(function (r) {
        b.disabled = false; b.textContent = 'Empezar el acuerdo';
        if (r.ok && r.j && r.j.url) { irAlAcuerdo(r.j.url, r.j.s); return; }
        if (r.status === 401) { load(); return; }
        eb.textContent = (r.j && r.j.error) || 'No se pudo crear. Inténtalo de nuevo.'; eb.style.display = 'block';
      }).catch(function () { b.disabled = false; b.textContent = 'Empezar el acuerdo'; eb.textContent = 'Problema de conexión. Inténtalo de nuevo.'; eb.style.display = 'block'; });
    });
  }

  load();
})();
