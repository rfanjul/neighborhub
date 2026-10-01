/** Recuerda el idioma que eliges en el selector (EN · DE · ES) para la próxima visita. */
(function () {
  document.addEventListener('click', function (e) {
    var enlace = e.target.closest && e.target.closest('a[data-idioma]');
    if (!enlace) return;
    try {
      localStorage.setItem('idioma', enlace.getAttribute('data-idioma'));
    } catch (err) {
      // Sin almacenamiento (modo privado): no pasa nada, solo no se recuerda.
    }
  });
})();
