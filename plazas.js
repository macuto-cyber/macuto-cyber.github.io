/* plazas.js · RETIRADO el 24-nov-2026 (Macuto: «quitamos lo de las plazas» / «quita eso»).
 * El contador «Solo N plazas nuevas este mes» ya no sale en la web. Ninguna página lo carga; si alguna página vieja
 * (en caché) o un artículo nuevo aún trae la píldora .scarcity con <b class="mm-plazas">, este fichero la QUITA.
 */
(function () {
  var quita = function () {
    document.querySelectorAll('.mm-plazas').forEach(function (b) {
      var p = b.closest('.scarcity');
      if (p) p.remove();
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', quita, { once: true });
  else quita();
})();
