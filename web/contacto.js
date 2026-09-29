/**
 * Formulario de contacto: guarda el mensaje en Firestore (contactMessages).
 * Las reglas solo dejan crear mensajes bien formados; nadie puede leerlos
 * desde fuera: se revisan en la consola de Firebase.
 *
 * La app enlaza aquí con ?tipo=reportar&ref=service:<id> para rellenarlo.
 * Los textos llegan en data-* del formulario, en el idioma de la página.
 */
(function () {
  var form = document.getElementById('formulario-contacto');
  if (!form) return;
  var estado = form.querySelector('.estado');
  var textos = form.dataset;
  var boton = form.querySelector('button[type=submit]');
  var params = new URLSearchParams(location.search);
  var tipos = ['pregunta', 'problema', 'reportar', 'borrar-cuenta', 'otro'];

  if (tipos.indexOf(params.get('tipo')) >= 0) form.tipo.value = params.get('tipo');
  if (params.get('ref')) form.referencia.value = params.get('ref').slice(0, 200);
  if (params.get('tipo') || params.get('ref')) {
    document.getElementById('contacto').scrollIntoView();
  }

  function mostrar(clase, texto) {
    estado.className = 'estado ' + clase;
    estado.textContent = texto;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    // Campo trampa: las personas no lo ven; los robots lo rellenan.
    if (form.web.value) return mostrar('ok', textos.ok);

    var datos = {
      tipo: form.tipo.value,
      nombre: form.nombre.value.trim().slice(0, 100),
      email: form.email.value.trim().slice(0, 200),
      mensaje: form.mensaje.value.trim(),
      referencia: form.referencia.value.trim().slice(0, 200),
      origen: params.get('origen') === 'app' ? 'app' : 'web',
      idioma: textos.idioma,
    };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(datos.email)) return mostrar('error', textos.errorEmail);
    if (datos.mensaje.length < 10) return mostrar('error', textos.errorCorto);
    if (datos.mensaje.length > 3000) return mostrar('error', textos.errorLargo);

    boton.disabled = true;
    boton.textContent = textos.enviando;
    datos.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    firebase
      .firestore()
      .collection('contactMessages')
      .add(datos)
      .then(function () {
        form.reset();
        mostrar('ok', textos.ok);
      })
      .catch(function () {
        mostrar('error', textos.errorEnvio);
      })
      .finally(function () {
        boton.disabled = false;
        boton.textContent = textos.enviar;
      });
  });
})();
