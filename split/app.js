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
  function foot() { return '<p class="ct-foot">¿Dudas? Escribe a Macuto por WhatsApp al <a href="https://wa.me/34630060006" target="_blank" rel="noopener">+34 630 06 00 06</a> o a <a href="mailto:macuto@macutomusic.com">macuto@macutomusic.com</a>.<br>Macuto Music</p>'; }
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
  var RGPD = '<p class="ct-small ct-mut"><b>Tus datos.</b> Responsable: Angelo Jordan Gutiérrez Luis (Macuto Music). Finalidad: preparar y firmar el acuerdo y conservar la prueba de la firma. Se registran tu documento (para abrir este enlace), los datos que escribas para el acuerdo, tu firma y los datos técnicos de la firma. Puedes ejercer tus derechos escribiendo a macuto@macutomusic.com.</p>';

  if (!TOKEN) { msg('Enlace no válido', 'Este enlace no lleva la clave de la split sheet. Pide a Macuto que te lo reenvíe.'); return; }

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
      if (r.status === 404) return msg('Enlace no válido', 'Este enlace no corresponde a ninguna split sheet. Pide a Macuto que te lo reenvíe.');
      if (!r.ok || !r.j) return reintentar('No se pudo cargar la split sheet');
      reintentos = 0;
      render(r.j);
    }).catch(function () { reintentar('Sin conexión con el servidor'); });
  }
  function render(st) {
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
    switch (st.vista) {
      case 'pin': return vistaPin(st);
      case 'pin_bloqueado': return msg('Acceso bloqueado', 'Se han agotado los intentos. Escribe a Macuto: revisará tu enlace y te lo volverá a abrir.');
      case 'anulado': return msg('Este enlace ya no es válido', 'La split sheet se ha sustituido por otra versión. Pide el enlace nuevo a Macuto.');
      case 'caducado': return msg('Este enlace ha caducado', 'El plazo para firmar ha terminado. Si todavía hay que firmarla, pide un enlace nuevo a Macuto.');
      case 'copia_caducada': return msg('Este enlace ya no sirve la copia', 'Han pasado más de treinta días desde que se firmó. Pide tu copia a Macuto.');
      case 'error': return msg('Un momento', 'El equipo está revisando el documento. Macuto te avisará cuando esté listo; lo abrirás en este mismo enlace.');
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
      return '<li>' + (p.firmado ? '✅ ' : '⏳ ') + '<b>' + esc(p.nombre) + '</b>' + (p.yo ? ' <span class="ct-tag">tú</span>' : '') + '<br><span class="ct-mut ct-small">' + esc(p.rol) + (p.firmado ? ' · ha firmado' : ' · pendiente') + '</span></li>';
    }).join('') + '</ul>';
  }

  function vistaPin(st) {
    app.innerHTML = '<h1>Tu split sheet</h1>' + card('<h2>Entra con tu documento</h2><p>Para proteger los datos de todos, este enlace solo se abre con tu documento de identidad. Escribe tu DNI, NIE o pasaporte.</p>' +
      (st.primera ? '<p class="ct-small ct-mut">Es tu primera entrada: el documento que escribas quedará como la llave de este enlace.</p>' : '') +
      '<form id="acc" novalidate><div class="ct-field"><label for="doc">DNI, NIE o pasaporte</label><input id="doc" name="doc" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" maxlength="30" inputmode="text"></div>' +
      '<div class="ct-errbox" id="errbox"></div><button type="submit" class="ct-btn" id="pin-go">Entrar</button></form>' +
      '<p class="ct-small ct-mut">El número con su letra; da igual si pones puntos, guiones o minúsculas. La sesión dura dos horas y se cierra al cerrar la pestaña.</p>') + foot();
    arriba();
    var inp = $('#doc'); inp.focus();
    function go() {
      var v = (inp.value || '').replace(/[\s.\-\/]/g, '');
      if (v.length < 5) { $('#errbox').textContent = 'Escribe el número completo de tu documento.'; $('#errbox').style.display = 'block'; return; }
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
    app.innerHTML = '<h1>¡Firmado!</h1>' + card('<p class="ct-okbox">✓ Tu firma quedó registrada' + (st.firmado_el ? ' el ' + esc(st.firmado_el) : '') + '.</p>' +
      '<p>' + (faltan ? (faltan > 1 ? 'Faltan ' + faltan + ' firmas' : 'Falta 1 firma') + '. Cuando firmen todos, desde este mismo enlace podrás descargar la copia firmada.' : 'Ya habéis firmado todos. Estamos sellando la copia: <b>tarda menos de un minuto</b> y esta página se actualiza sola.') + '</p>' +
      '<h2 style="margin-top:14px">«' + esc(st.titulo) + '»</h2>' + listaPartes(st) +
      '<p class="ct-small"><a href="#" id="pdf">Ver la split sheet (PDF)</a></p>') + foot();
    arriba();
    $('#pdf').addEventListener('click', function (e) { abrirPdf(e, '/pdf', 'Split_sheet.pdf'); });
    pollTimer = setTimeout(load, faltan ? 60000 : 4000);      // sellando: el PDF sale en segundos
  }

  function vistaHecho(st) {
    app.innerHTML = '<h1>Split sheet firmada</h1>' + card('<p class="ct-okbox">✓ «' + esc(st.titulo) + '» está firmada por todas las partes.</p>' + listaPartes(st) +
      '<button type="button" class="ct-btn" id="dl">Descargar la copia firmada (PDF)</button>' +
      '<p class="ct-small ct-mut">Lleva al final la hoja de firmas con la fecha, la hora y la huella del documento. Puedes descargarla desde este enlace hasta el ' + esc(st.copia_hasta) + '. Guárdala.</p>') + foot();
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
    if (rp.tapado) return h + '<p class="ct-small ct-mut">Cada parte pone su porcentaje por su cuenta: hasta que estéis todos no se ven los de los demás.</p>';
    h += '<p class="ct-small"><b>Suman:</b> composición ' + esc(rp.suma_composicion) + ' · máster ' + esc(rp.suma_master) + '</p>';
    return h;
  }
  function resumenHtml(r) {
    if (!r) return '';
    var h = '<p class="ct-small ct-mut" style="margin-bottom:4px">' + esc(r.tipo) + '</p><h2>«' + esc(r.titulo) + '»' + (r.version ? ' <span class="ct-mut ct-small">(' + esc(r.version) + ')</span>' : '') + '</h2>' +
      (r.artista ? '<p class="ct-small ct-mut" style="margin:-6px 0 8px">Se publica como ' + esc(r.artista) + '</p>' : '');
    if ((r.composicion || []).length) {
      h += '<p class="ct-small" style="margin:10px 0 2px"><b>Composición</b> (letra y música)</p>' + tabla(['Parte', 'Papel', '%'], (r.composicion || []).map(function (x) { return [x.parte, x.rol, x.pct]; })) +
        '<p class="ct-small" style="margin:10px 0 2px"><b>Máster</b> (la grabación)</p>' + tabla(['Parte', '%'], (r.master || []).map(function (x) { return [x.parte, x.pct]; }));
    } else if (r.reparto) {
      h += '<p class="ct-small" style="margin:10px 0 2px"><b>Reparto</b> — lo ponéis vosotros</p>' + repartoHtml(r.reparto);
    }
    return h + '<p class="ct-small">' + esc(r.distribucion) + '</p>' + (r.samples ? '<p class="ct-small">Material de terceros: ' + esc(r.samples) + '</p>' : '');
  }

  // DATOS (acuerdos): cada parte pone SUS datos y, en una split sheet, SU reparto. Nadie ve los datos personales de otro.
  // st.parcial = el reparto no cuadró y solo se reabren los campos del reparto.
  function vistaDatos(st) {
    var campos = st.campos || [], pre = st.prefill || {}, parcial = !!st.parcial;
    var rp = st.reparto || (st.resumen && st.resumen.reparto) || null;
    var pasos = parcial ? '' : '<div class="ct-steps"><i class="on"></i><i></i><i></i></div><p class="ct-small ct-mut">Paso 1 de 3 · tus datos</p>';
    var cab, intro;
    if (parcial) {
      var falta = [];
      if (rp && rp.sobra_composicion) falta.push('la composición suma ' + esc(rp.suma_composicion));
      if (rp && rp.sobra_master) falta.push('el máster suma ' + esc(rp.suma_master));
      cab = '<h1>El reparto no cuadra</h1>';
      intro = card('<p class="ct-errbox" style="display:block">Cada capa tiene que sumar 100 % y ' + (falta.join(' y ') || 'no suma') + '.</p>' +
        '<p>Esto es lo que ha pedido cada uno. Habladlo entre vosotros y ajustad lo que haga falta: puedes cambiar el tuyo aquí abajo. ' +
        'Nadie firma nada hasta que cuadre.</p>' + repartoHtml(rp));
    } else {
      cab = '<h1>Tus datos para el acuerdo</h1>';
      intro = card(resumenHtml(st.resumen) +
        '<p class="ct-small ct-mut" style="margin-top:8px">Tu papel: <b>' + esc(st.rol) + '</b>. Si algo de la canción no es lo que habíais hablado, no sigas y escribe a Macuto.</p>');
    }
    var hayPct = false;
    for (var q = 0; q < campos.length; q++) if (campos[q].tipo === 'pct') hayPct = true;
    var avisoPct = (hayPct && !parcial) ? '<div class="ct-okbox" style="display:block">Los porcentajes los ponéis vosotros, no nosotros. Escribe el que crees que te corresponde: ' +
      'los demás ponen el suyo sin ver el tuyo. Cuando estéis todos, si no suma 100 % te lo enseñamos y lo ajustáis.</div>' : '';
    var html = pasos + cab + intro + '<form id="fd" novalidate>' + card(avisoPct + campos.map(function (c) {
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
      } else if (c.tipo === 'pct') {
        entrada = '<div class="ct-pct"><input id="' + id + '" name="' + c.clave + '" type="text" inputmode="decimal" autocomplete="off" maxlength="6" value="' + esc(v) + '"><span>%</span></div>';
      } else {
        var ro = (c.tipo === 'doc' && st.doc_fijo) ? ' readonly' : '';
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
    }).join('') +
    '<div class="ct-okbox" id="aviso-ent" style="display:none">Sin alta en una entidad de gestión no cobrarás tu parte de la composición a través de ella. Puedes firmar igual y darte de alta después: el acuerdo lo recoge.</div>' +
    '<label class="ct-chk"><input type="checkbox" id="conf"> <span id="conf-t">' + (parcial ? 'Confirmo que este es el porcentaje que pido.' : 'Confirmo que mis datos son correctos y que se usarán para preparar el acuerdo.') + '</span></label>' +
    '<div class="ct-errbox" id="errbox"></div><button type="submit" class="ct-btn" id="dgo">' + (parcial ? 'Guardar mi porcentaje' : 'Guardar mis datos') + '</button>' + (parcial ? '' : RGPD)) + '</form>' + foot();
    app.innerHTML = html; arriba();
    var f = $('#fd');
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
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var eb = $('#errbox'); eb.style.display = 'none';
      var fs = f.querySelectorAll('.ct-field'), datos = {}, i;
      for (i = 0; i < fs.length; i++) { fs[i].className = 'ct-field'; if (fs[i].style.display !== 'none') datos[fs[i].getAttribute('data-k')] = val(fs[i].getAttribute('data-k')); }
      if (!$('#conf').checked) { eb.textContent = 'Marca la casilla para confirmar.'; eb.style.display = 'block'; return; }
      var b = $('#dgo'); b.disabled = true; b.textContent = 'Guardando…';
      api('/datos', { method: 'POST', body: { confirmar: true, datos: datos } }).then(function (r) {
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
      '<p class="ct-mut ct-small">Firmamos todos los que aparecemos en ella, cada uno desde su enlace:</p>' + listaPartes(st) +
      (st.puede_corregir ? '<p class="ct-small ct-mut">¿Algún dato tuyo está mal? Puedes corregirlo mientras no haya firmado nadie; el documento se vuelve a preparar.</p><button type="button" class="ct-btn sec" id="corregir">Corregir mis datos</button>' : '') +
      '<p class="ct-small ct-mut">¿Algo no cuadra (tu nombre, tu porcentaje)? No firmes y escribe a Macuto antes.</p>' });
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
