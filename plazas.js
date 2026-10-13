/* plazas.js · «Solo N plazas nuevas este mes» baja cada semana del mes (13-oct-2026, Macuto: «vamos a programar que cada semana
 * vaya bajando desde 10 a 2»).
 *
 * QUÉ HACE   Pone en cada <b class="mm-plazas"> el número que toca según el día del mes, en hora de Madrid:
 *              días 1-7 → 10 · 8-14 → 8 · 15-21 → 6 · 22-28 → 4 · 29-31 → 2. El día 1 vuelve a 10.
 *            Es el mismo número para todo el mundo y en todas las páginas (portada y artículos del RADAR): depende solo de la
 *            fecha, nunca de las visitas ni del navegador (lo que hacía el script viejo que se quitó el 12-oct).
 * SIN JS     Se ve el número escrito en el HTML (10; lo fija fijar_plazas.py en 09_Automatizaciones/macuto_web/).
 * CAMBIAR    El calendario es TRAMOS (un número por semana del mes). Para dejar un número fijo: TRAMOS = [N].
 * CARGA      <script defer src="/plazas.js?v=<8 hex del md5>"> justo después de /analytics.js en cada página con el contador
 *            (index.html, radar/*\/index.html y la plantilla ~/.config/dap/radar_build.py).
 */
(function () {
  'use strict';
  var TRAMOS = [10, 8, 6, 4, 2];
  var els = document.querySelectorAll('.mm-plazas');
  if (!els.length) return;
  var dia;
  try {
    dia = parseInt(new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric' }).format(new Date()), 10);
  } catch (e) {
    dia = new Date().getDate();
  }
  if (!(dia >= 1 && dia <= 31)) return;
  var n = TRAMOS[Math.min(TRAMOS.length - 1, Math.floor((dia - 1) / 7))];
  for (var i = 0; i < els.length; i++) els[i].textContent = String(n);
})();
