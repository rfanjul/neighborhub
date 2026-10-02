/**
 * Administración de Neighborhub: ver, corregir y aprobar servicios.
 *
 * Entra quien tenga el claim admin (npm run admin -- --email …); las reglas
 * de Firestore lo vuelven a comprobar en cada lectura y escritura, así que
 * esta página no abre nada que las reglas no permitan.
 *
 * Todo lo que escriben los vecinos se pinta con textContent, nunca como
 * HTML: un título con <script> se ve como texto.
 */
(function () {
  'use strict';

  const CATEGORIAS = { moving: 'Mudanza', painting: 'Pintura', dog: 'Pasear perros', groceries: 'Compras', other: 'Otros' };
  const ESTADOS = {
    pending: 'En revisión',
    approved: 'Publicado',
    accepted: 'Aceptado',
    in_progress: 'En curso',
    completed: 'Completado',
    rated: 'Valorado',
  };
  const MOTIVOS = { spam: 'Spam o estafa', inapropiado: 'Inapropiado u ofensivo', acoso: 'Acoso o amenazas', otro: 'Otro motivo' };
  const TIPOS = { service: 'Servicio', user: 'Vecino', message: 'Conversación' };
  const FILTROS = {
    pendientes: ['pending'],
    publicados: ['approved'],
    'en-marcha': ['accepted', 'in_progress'],
    terminados: ['completed', 'rated'],
    todos: null,
  };
  // Los mismos límites que la app y las reglas, en céntimos.
  const PRECIO_MINIMO = 500;
  const PRECIO_MAXIMO = 100000;

  const $ = (id) => document.getElementById(id);
  let auth;
  let db;
  let servicios = [];
  let filtro = 'pendientes';
  let dejarDeEscuchar = null;
  let dejarDeEscucharDenuncias = null;
  let dejarDeEscucharConfig = null;
  let pagosActivos = false;
  let denuncias = [];
  let abierto = null;

  function el(etiqueta, clase, texto) {
    const nodo = document.createElement(etiqueta);
    if (clase) nodo.className = clase;
    if (texto != null) nodo.textContent = texto;
    return nodo;
  }

  const precioTexto = (c) => (c == null ? 'Gratis' : `CHF ${(c / 100).toFixed(c % 100 ? 2 : 0)}`);
  const milis = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0);
  const fecha = (ts) =>
    ts && typeof ts.toDate === 'function'
      ? ts.toDate().toLocaleString('es-CH', { dateStyle: 'medium', timeStyle: 'short' })
      : '—';
  // Solo https: nada de javascript: ni data: en src o href.
  const urlSegura = (u) => (typeof u === 'string' && /^https:\/\//.test(u) ? u : null);

  /** "40", "12.50", "12,5" o "CHF 40" en céntimos; null si no es un importe. */
  function leerPrecio(texto) {
    const limpio = String(texto).replace(/chf|fr\.?|\s/gi, '').replace(',', '.');
    if (!/^\d{1,5}(\.\d{1,2})?$/.test(limpio)) return null;
    return Math.round(parseFloat(limpio) * 100);
  }

  function aviso(id, texto, tipo) {
    const nodo = $(id);
    nodo.textContent = texto || '';
    nodo.className = `admin-aviso ${tipo || ''}`;
  }

  /** Confirmación dentro de la página (confirm() lo bloquean algunos navegadores). */
  function preguntar(texto, si) {
    if (!$('pregunta')) {
      // Página antigua en caché sin el diálogo: se crea aquí.
      const d = el('dialog');
      d.id = 'pregunta';
      const form = el('form', 'pregunta');
      form.method = 'dialog';
      const p = el('p');
      p.id = 'pregunta-texto';
      const acciones = el('div', 'editor-acciones');
      const no = el('button', 'boton boton-secundario', 'Cancelar');
      no.value = 'no';
      const siBoton = el('button', 'boton boton-primario');
      siBoton.id = 'pregunta-si';
      siBoton.value = 'si';
      acciones.append(no, siBoton);
      form.append(p, acciones);
      d.append(form);
      document.body.append(d);
    }
    const dialogo = $('pregunta');
    $('pregunta-texto').textContent = texto;
    $('pregunta-si').textContent = si;
    dialogo.returnValue = '';
    return new Promise((resolver) => {
      dialogo.addEventListener('close', () => resolver(dialogo.returnValue === 'si'), { once: true });
      dialogo.showModal();
    });
  }

  function flotante(texto) {
    const nodo = el('div', 'aviso-flotante', texto);
    document.body.appendChild(nodo);
    setTimeout(() => nodo.remove(), 2600);
  }

  function mostrarVista(nombre) {
    $('cargando').hidden = true;
    $('vista-login').hidden = nombre !== 'login';
    $('vista-panel').hidden = nombre !== 'panel';
    $('salir').hidden = nombre !== 'panel';
    $('pagos').hidden = nombre !== 'panel';
  }

  // --- Sesión ---------------------------------------------------------

  function iniciar() {
    auth = firebase.auth();
    db = firebase.firestore();
    if (['localhost', '127.0.0.1'].includes(location.hostname)) {
      // En local, contra los emuladores (npm run demo:emulators).
      auth.useEmulator('http://127.0.0.1:9099');
      db.useEmulator('127.0.0.1', 8180);
    }
    // La sesión dura lo que la pestaña: en un ordenador compartido no se queda abierta.
    auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(() => {});

    const select = $('form-editor').category;
    Object.entries(CATEGORIAS).forEach(([valor, texto]) => {
      const opcion = el('option', null, texto);
      opcion.value = valor;
      select.appendChild(opcion);
    });

    $('form-login').addEventListener('submit', entrar);
    $('salir').addEventListener('click', () => auth.signOut());
    $('pagos').addEventListener('click', cambiarPagos);
    document.querySelectorAll('[data-filtro]').forEach((b) =>
      b.addEventListener('click', () => {
        filtro = b.dataset.filtro;
        pintar();
      })
    );
    $('buscar').addEventListener('input', pintar);
    $('cerrar').addEventListener('click', cerrarEditor);
    $('editor').addEventListener('close', () => (abierto = null));
    $('form-editor').gratis.addEventListener('change', (e) => {
      $('form-editor').precio.disabled = e.target.checked;
    });
    $('guardar').addEventListener('click', () => guardar({}, 'Cambios guardados'));
    $('aprobar').addEventListener('click', () => guardar(revision('approved'), 'Aprobado: ya se ve en la app'));
    $('despublicar').addEventListener('click', async () => {
      if (await preguntar('¿Despublicar? Dejará de verse en el muro y volverá a «En revisión».', 'Despublicar')) {
        guardar(revision('pending'), 'Despublicado');
      }
    });

    auth.onAuthStateChanged(alCambiarSesion);
  }

  function entrar(e) {
    e.preventDefault();
    const form = e.target;
    const boton = form.querySelector('button');
    const email = form.email.value.trim();
    if (!email || !form.password.value) return aviso('estado-login', 'Escribe el email y la contraseña.', 'error');
    boton.disabled = true;
    aviso('estado-login', '');
    auth
      .signInWithEmailAndPassword(email, form.password.value)
      .catch((err) =>
        aviso(
          'estado-login',
          err.code === 'auth/too-many-requests'
            ? 'Demasiados intentos seguidos. Espera unos minutos.'
            : 'Email o contraseña incorrectos.',
          'error'
        )
      )
      .finally(() => {
        boton.disabled = false;
        form.password.value = '';
      });
  }

  function alCambiarSesion(usuario) {
    if (dejarDeEscuchar) {
      dejarDeEscuchar();
      dejarDeEscuchar = null;
    }
    if (dejarDeEscucharDenuncias) {
      dejarDeEscucharDenuncias();
      dejarDeEscucharDenuncias = null;
    }
    if (dejarDeEscucharConfig) {
      dejarDeEscucharConfig();
      dejarDeEscucharConfig = null;
    }
    if (!usuario) {
      $('quien').textContent = '';
      mostrarVista('login');
      return;
    }
    // true: pide un token nuevo por si el claim se acaba de poner o quitar.
    usuario
      .getIdTokenResult(true)
      .then((r) => {
        if (!r.claims.admin) {
          aviso('estado-login', 'Esta cuenta no tiene permiso de administración.', 'error');
          return auth.signOut();
        }
        $('quien').textContent = usuario.email;
        mostrarVista('panel');
        escuchar();
      })
      .catch(() => {
        aviso('estado-login', 'No se pudo comprobar la cuenta. Vuelve a intentarlo.', 'error');
        auth.signOut();
      });
  }

  // --- Lista ----------------------------------------------------------

  function escuchar() {
    dejarDeEscuchar = db.collection('helpRequests').onSnapshot(
      (snap) => {
        servicios = snap.docs
          .map((d) => Object.assign({ id: d.id }, d.data()))
          .sort((a, b) => milis(b.createdAt) - milis(a.createdAt));
        aviso('error-panel', '');
        pintar();
      },
      (err) => aviso('error-panel', `No se pudieron cargar los servicios (${err.code || err.message}).`, 'error')
    );
    escucharConfig();
    // Denuncias sin revisar: hay que atenderlas en menos de 24 horas.
    dejarDeEscucharDenuncias = db
      .collection('reports')
      .where('estado', '==', 'nuevo')
      .onSnapshot(
        (snap) => {
          denuncias = snap.docs
            .map((d) => Object.assign({ id: d.id }, d.data()))
            .sort((a, b) => milis(a.createdAt) - milis(b.createdAt));
          pintar();
        },
        (err) => aviso('error-panel', `No se pudieron cargar las denuncias (${err.code || err.message}).`, 'error')
      );
  }

  /** config/app.pagosActivos: con los pagos apagados la app no enseña precios ni cobra. */
  function escucharConfig() {
    dejarDeEscucharConfig = db
      .collection('config')
      .doc('app')
      .onSnapshot(
        (d) => {
          pagosActivos = d.exists && d.data().pagosActivos === true;
          const b = $('pagos');
          b.textContent = pagosActivos ? 'Pagos: encendidos' : 'Pagos: apagados';
          b.classList.toggle('encendidos', pagosActivos);
        },
        () => {}
      );
  }

  async function cambiarPagos() {
    const encender = !pagosActivos;
    const texto = encender
      ? '¿Encender los pagos? La app enseñará precios y cobrará con Stripe (con las claves que tenga el servidor).'
      : '¿Apagar los pagos? La app dejará de enseñar precios y todo funcionará como favores gratis.';
    if (!(await preguntar(texto, encender ? 'Encender' : 'Apagar'))) return;
    db.collection('config')
      .doc('app')
      .set({
        pagosActivos: encender,
        actualizadoPor: auth.currentUser.uid,
        actualizado: firebase.firestore.FieldValue.serverTimestamp(),
      })
      .then(() => flotante(encender ? 'Pagos encendidos' : 'Pagos apagados'))
      .catch((err) => aviso('error-panel', `No se pudo cambiar (${err.code || err.message}).`, 'error'));
  }

  function revisar(denuncia, estado) {
    return db.collection('reports').doc(denuncia.id).update({
      estado,
      revisadoPor: auth.currentUser.uid,
      revisadoEn: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  function filaDenuncia(d) {
    const li = el('li', 'denuncia');
    const cabecera = el('div', 'denuncia-cabecera');
    cabecera.append(el('span', 'chip chip-pending', MOTIVOS[d.motivo] || d.motivo), el('strong', null, TIPOS[d.tipo] || d.tipo));
    const servicio = d.tipo !== 'user' ? servicios.find((s) => s.id === d.objetoId) : null;
    const que = servicio ? `«${servicio.title || ''}» de ${servicio.requesterName || '—'}` : d.objetoId;
    const meta = el('span', 'fila-meta', `${que} · ${fecha(d.createdAt)}`);
    const acciones = el('div', 'denuncia-acciones');
    const boton = (texto, clase, accion) => {
      const b = el('button', `boton ${clase}`, texto);
      b.type = 'button';
      b.addEventListener('click', () => {
        b.disabled = true;
        Promise.resolve(accion())
          .then(() => flotante('Hecho'))
          .catch((err) => aviso('error-panel', `No se pudo (${err.code || err.message}).`, 'error'))
          .finally(() => (b.disabled = false));
      });
      return b;
    };
    if (servicio) {
      acciones.append(boton('Abrir servicio', 'boton-secundario', () => abrir(servicio.id)));
      if (servicio.status === 'approved') {
        acciones.append(
          boton('Despublicar', 'boton-primario', () =>
            db
              .collection('helpRequests')
              .doc(servicio.id)
              .update(Object.assign(revision('pending'), { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }))
              .then(() => revisar(d, 'retirado'))
          )
        );
      }
    }
    acciones.append(boton('Revisada, sin cambios', 'boton-secundario', () => revisar(d, 'revisado')));
    li.append(cabecera, meta, acciones);
    return li;
  }

  const enFiltro = (s, nombre) => !FILTROS[nombre] || FILTROS[nombre].includes(s.status);

  function pintar() {
    document.querySelectorAll('[data-filtro]').forEach((b) => {
      b.setAttribute('aria-selected', String(b.dataset.filtro === filtro));
      b.querySelector('.cuenta').textContent =
        b.dataset.filtro === 'denuncias' ? denuncias.length : servicios.filter((s) => enFiltro(s, b.dataset.filtro)).length;
    });
    const verDenuncias = filtro === 'denuncias';
    $('denuncias').hidden = !verDenuncias;
    $('lista').hidden = verDenuncias;
    $('buscar').hidden = verDenuncias;
    if (verDenuncias) {
      const lista = $('denuncias');
      lista.textContent = '';
      denuncias.forEach((d) => lista.appendChild(filaDenuncia(d)));
      $('vacio').hidden = denuncias.length > 0;
      return;
    }
    const busqueda = $('buscar').value.trim().toLowerCase();
    const visibles = servicios.filter(
      (s) =>
        enFiltro(s, filtro) &&
        (!busqueda || [s.title, s.requesterName, s.description].join(' ').toLowerCase().includes(busqueda))
    );
    const lista = $('lista');
    lista.textContent = '';
    visibles.forEach((s) => lista.appendChild(fila(s)));
    $('vacio').hidden = visibles.length > 0;
  }

  function fila(s) {
    const boton = el('button', 'fila-boton');
    boton.type = 'button';
    boton.addEventListener('click', () => abrir(s.id));

    const mini = el('div', 'mini');
    const foto = urlSegura(Array.isArray(s.photos) && s.photos[0]);
    if (foto) {
      const img = el('img');
      img.src = foto;
      img.alt = '';
      img.loading = 'lazy';
      mini.appendChild(img);
    } else {
      mini.textContent = (CATEGORIAS[s.category] || 'Otros').charAt(0);
    }

    const texto = el('div', 'fila-texto');
    texto.append(
      el('strong', null, s.title || '(sin título)'),
      el('span', 'fila-meta', [s.requesterName || '—', CATEGORIAS[s.category] || s.category || '—', fecha(s.createdAt)].join(' · '))
    );

    const lado = el('div', 'fila-lado');
    lado.append(
      el('span', `chip chip-${s.status}`, ESTADOS[s.status] || s.status || '—'),
      el('span', `precio${s.priceCents == null ? ' gratis' : ''}`, precioTexto(s.priceCents))
    );

    boton.append(mini, texto, lado);
    const li = el('li');
    li.appendChild(boton);
    return li;
  }

  // --- Editor ---------------------------------------------------------

  function abrir(id) {
    const s = servicios.find((x) => x.id === id);
    if (!s) return;
    abierto = id;
    const form = $('form-editor');
    const editable = s.status === 'pending' || s.status === 'approved';

    $('editor-titulo').textContent = s.title || 'Servicio';
    const chip = $('editor-estado');
    chip.className = `chip chip-${s.status}`;
    chip.textContent = ESTADOS[s.status] || s.status || '—';

    const fotos = $('editor-fotos');
    fotos.textContent = '';
    (Array.isArray(s.photos) ? s.photos : []).map(urlSegura).filter(Boolean).forEach((url) => {
      const img = el('img');
      img.src = url;
      img.alt = '';
      fotos.appendChild(img);
    });

    const vecino = $('editor-vecino');
    vecino.textContent = `Lo pide ${s.requesterName || '—'}`;
    if (s.requesterId) {
      db.collection('users')
        .doc(s.requesterId)
        .get()
        .then((d) => {
          if (abierto !== id || !d.exists) return;
          const p = d.data();
          const lugar = [p.postalCode, p.city].filter(Boolean).join(' ');
          vecino.textContent = [`Lo pide ${p.name || s.requesterName || '—'}`, p.email, lugar].filter(Boolean).join(' · ');
        })
        .catch(() => {});
    }

    form.title.value = s.title || '';
    form.category.value = CATEGORIAS[s.category] ? s.category : 'other';
    form.description.value = s.description || '';
    form.durationLabel.value = s.durationLabel === '—' ? '' : s.durationLabel || '';
    form.availableLabel.value = s.availableLabel || '';
    form.gratis.checked = s.priceCents == null;
    form.precio.value = s.priceCents == null ? '' : String(s.priceCents / 100);

    const datos = $('editor-datos');
    datos.textContent = [
      `Creado: ${fecha(s.createdAt)}`,
      `Actualizado: ${fecha(s.updatedAt)}`,
      s.reviewedAt ? `Revisado: ${fecha(s.reviewedAt)}` : null,
      s.helperName ? `Ayuda: ${s.helperName}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    if (s.coords && typeof s.coords.latitude === 'number') {
      const mapa = el('a', null, 'Ver en el mapa');
      mapa.href = `https://www.google.com/maps?q=${s.coords.latitude},${s.coords.longitude}`;
      mapa.target = '_blank';
      mapa.rel = 'noopener';
      datos.append(' · ', mapa);
    }

    Array.from(form.elements).forEach((campo) => {
      if (campo.id !== 'cerrar') campo.disabled = !editable;
    });
    form.precio.disabled = !editable || form.gratis.checked;
    $('aprobar').hidden = s.status !== 'pending';
    $('despublicar').hidden = s.status !== 'approved';
    $('guardar').hidden = !editable;
    aviso(
      'editor-aviso',
      editable ? '' : 'Este servicio ya está en marcha o terminado: solo se puede consultar.',
      ''
    );

    $('editor').showModal();
  }

  function cerrarEditor() {
    $('editor').close();
  }

  const revision = (estado) => ({
    status: estado,
    reviewedBy: auth.currentUser.uid,
    reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  function leerFormulario() {
    const form = $('form-editor');
    const titulo = form.title.value.trim();
    if (!titulo) return { error: 'El título no puede quedar vacío.' };
    let precio = null;
    if (!form.gratis.checked) {
      precio = leerPrecio(form.precio.value);
      if (precio == null || precio < PRECIO_MINIMO || precio > PRECIO_MAXIMO) {
        return { error: 'El precio va de CHF 5 a CHF 1000, o marca «Favor gratis».' };
      }
    }
    return {
      cambios: {
        title: titulo,
        category: form.category.value,
        description: form.description.value.trim(),
        durationLabel: form.durationLabel.value.trim() || '—',
        availableLabel: form.availableLabel.value.trim(),
        priceCents: precio,
      },
    };
  }

  function guardar(extra, mensaje) {
    const { cambios, error } = leerFormulario();
    if (error) return aviso('editor-aviso', error, 'error');
    const botones = ['guardar', 'aprobar', 'despublicar'].map($);
    botones.forEach((b) => (b.disabled = true));
    aviso('editor-aviso', 'Guardando…');
    db.collection('helpRequests')
      .doc(abierto)
      .update(Object.assign(cambios, extra, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }))
      .then(() => {
        cerrarEditor();
        flotante(mensaje);
      })
      .catch((err) =>
        aviso(
          'editor-aviso',
          err.code === 'permission-denied'
            ? 'Sin permiso: puede que el servicio ya esté en marcha o que tu cuenta ya no sea admin.'
            : `No se pudo guardar (${err.code || err.message}).`,
          'error'
        )
      )
      .finally(() => botones.forEach((b) => (b.disabled = false)));
  }

  // Los scripts de Firebase llevan defer y van antes que este: ya están cargados.
  if (typeof firebase === 'undefined') {
    $('cargando').textContent = 'No se pudo cargar Firebase. Recarga la página.';
  } else {
    iniciar();
  }
})();
