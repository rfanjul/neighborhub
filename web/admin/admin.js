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
  const PAGO_ESTADOS = {
    pendiente: 'sin completar',
    retenido: 'retenido',
    pagado: 'pagado',
    reembolsado: 'reembolsado',
    error: 'error',
  };
  const MOVIMIENTOS = { checkout: 'Checkout', cobro: 'Cobro', reembolso: 'Reembolso', transferencia: 'Transferencia' };
  // Los mismos límites que la app y las reglas, en céntimos.
  const PRECIO_MINIMO = 500;
  const PRECIO_MAXIMO = 100000;

  const $ = (id) => document.getElementById(id);
  let auth;
  let db;
  let fns;
  let servicios = [];
  let filtro = 'pendientes';
  let dejarDeEscuchar = null;
  let dejarDeEscucharDenuncias = null;
  let dejarDeEscucharConfig = null;
  let pagosActivos = false;
  let denuncias = [];
  let usuarios = null;
  let cargandoUsuarios = false;
  let abierto = null;

  function el(etiqueta, clase, texto) {
    const nodo = document.createElement(etiqueta);
    if (clase) nodo.className = clase;
    if (texto != null) nodo.textContent = texto;
    return nodo;
  }

  const precioTexto = (c) => (c == null ? 'Gratis' : `CHF ${(c / 100).toFixed(c % 100 ? 2 : 0)}`);
  const chf = (c) => `CHF ${((c || 0) / 100).toFixed(2)}`;
  const fechaMs = (ms) => (ms ? new Date(ms).toLocaleString('es-CH', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
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
    fns = firebase.app().functions('europe-west6');
    if (['localhost', '127.0.0.1'].includes(location.hostname)) {
      // En local, contra los emuladores (npm run demo:emulators).
      auth.useEmulator('http://127.0.0.1:9099');
      db.useEmulator('127.0.0.1', 8180);
      fns.useEmulator('127.0.0.1', 5001);
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
        // Los usuarios se piden de nuevo cada vez que se abre la pestaña.
        if (filtro === 'usuarios') cargarUsuarios();
        pintar();
      })
    );
    $('buscar').addEventListener('input', pintar);
    $('usuario-cerrar').addEventListener('click', () => $('usuario').close());
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
      usuarios = null;
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
        cargarUsuarios();
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

  // Terminado, con precio y sin pago: se eligió con los pagos apagados; se le puede pedir el pago.
  const sinCobrar = (s) => !s.pago && s.priceCents != null && (s.status === 'completed' || s.status === 'rated');
  const enFiltro = (s, nombre) =>
    nombre === 'pagos' ? Boolean(s.pago) || sinCobrar(s) : !FILTROS[nombre] || FILTROS[nombre].includes(s.status);

  function pintar() {
    document.querySelectorAll('[data-filtro]').forEach((b) => {
      b.setAttribute('aria-selected', String(b.dataset.filtro === filtro));
      b.querySelector('.cuenta').textContent =
        b.dataset.filtro === 'denuncias'
          ? denuncias.length
          : b.dataset.filtro === 'usuarios'
            ? usuarios
              ? usuarios.filter((u) => !u.ficticio).length
              : '…'
            : servicios.filter((s) => enFiltro(s, b.dataset.filtro)).length;
    });
    const verDenuncias = filtro === 'denuncias';
    const verUsuarios = filtro === 'usuarios';
    $('denuncias').hidden = !verDenuncias;
    $('usuarios').hidden = !verUsuarios;
    $('lista').hidden = verDenuncias || verUsuarios;
    $('buscar').hidden = verDenuncias;
    $('buscar').placeholder = verUsuarios ? 'Buscar por nombre, email o ciudad' : 'Buscar por título, vecino o texto';
    if (verUsuarios) {
      pintarUsuarios();
      return;
    }
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
    if (s.pago && s.pago.estado) {
      lado.append(el('span', `chip chip-pago-${s.pago.estado}`, `Pago ${PAGO_ESTADOS[s.pago.estado] || s.pago.estado}`));
    } else if (sinCobrar(s)) {
      lado.append(el('span', 'chip chip-pago-error', s.cobroPedido ? 'Pago pedido' : 'Sin cobrar'));
    }

    boton.append(mini, texto, lado);
    const li = el('li');
    li.appendChild(boton);
    return li;
  }

  // --- Usuarios (Function adminUsuarios: cuentas de Auth con su perfil) ---

  const PROVEEDOR = { apple: 'Apple', google: 'Google', email: 'Email' };

  function cargarUsuarios() {
    if (cargandoUsuarios) return;
    cargandoUsuarios = true;
    fns
      .httpsCallable('adminUsuarios')()
      .then(({ data }) => {
        usuarios = data;
        aviso('error-panel', '');
      })
      .catch((err) => aviso('error-panel', `No se pudieron cargar los usuarios (${err.message || err.code}).`, 'error'))
      .finally(() => {
        cargandoUsuarios = false;
        pintar();
      });
  }

  function chipsUsuario(u) {
    const chips = [];
    if (u.admin) chips.push(['Admin', 'chip-admin']);
    if (u.ficticio) chips.push(['Ficticio (ejemplo)', 'chip-ficticio']);
    if (u.desactivado) chips.push(['Desactivada', 'chip-pago-error']);
    u.proveedores.forEach((p) => chips.push([PROVEEDOR[p] || p, 'chip-proveedor']));
    if (!u.ficticio && !u.conPerfil) chips.push(['Sin perfil', 'chip-pending']);
    if (u.conPerfil && !u.ficticio && !u.perfilCompleto) chips.push(['Perfil a medias', 'chip-pending']);
    if (u.cobrosActivos) chips.push(['Cobros activos', 'chip-pago-pagado']);
    return chips.map(([texto, clase]) => el('span', `chip ${clase}`, texto));
  }

  /** Servicios en los que la persona pide o ayuda (de los que ya están cargados). */
  const deUsuario = (uid) => ({
    pide: servicios.filter((s) => s.requesterId === uid),
    ayuda: servicios.filter((s) => s.helperId === uid),
  });

  function pintarUsuarios() {
    const lista = $('usuarios');
    lista.textContent = '';
    if (!usuarios) {
      lista.appendChild(el('li', 'admin-gris', cargandoUsuarios ? 'Cargando usuarios…' : 'No se pudieron cargar.'));
      $('vacio').hidden = true;
      return;
    }
    const busqueda = $('buscar').value.trim().toLowerCase();
    const visibles = usuarios.filter(
      (u) => !busqueda || [u.nombre, u.email, u.ciudad, u.codigoPostal, u.uid].join(' ').toLowerCase().includes(busqueda)
    );
    visibles.forEach((u) => lista.appendChild(filaUsuario(u)));
    $('vacio').hidden = visibles.length > 0;
    $('vacio').textContent = visibles.length ? '' : 'No hay usuarios con esa búsqueda.';
  }

  function fotoUsuario(u, contenedor) {
    contenedor.textContent = '';
    const foto = urlSegura(u.foto);
    if (foto) {
      const img = el('img');
      img.src = foto;
      img.alt = '';
      img.loading = 'lazy';
      contenedor.appendChild(img);
    } else {
      contenedor.textContent = (u.nombre || u.email || '?').charAt(0).toUpperCase();
    }
  }

  function filaUsuario(u) {
    const boton = el('button', `fila-boton${u.ficticio ? ' ficticio' : ''}`);
    boton.type = 'button';
    boton.addEventListener('click', () => abrirUsuario(u));
    const mini = el('div', 'mini redonda');
    fotoUsuario(u, mini);

    const { pide, ayuda } = deUsuario(u.uid);
    const texto = el('div', 'fila-texto');
    texto.append(
      el('strong', null, u.nombre || u.email || '(sin nombre)'),
      el('span', 'fila-meta', [u.email || null, [u.codigoPostal, u.ciudad].filter(Boolean).join(' ') || null].filter(Boolean).join(' · ') || '—'),
      el(
        'span',
        'fila-meta',
        [
          u.valoraciones ? `★ ${u.valoracion.toFixed(1)} (${u.valoraciones})` : 'Sin valoraciones',
          `${pide.length} pedidos`,
          `${ayuda.length} ayudas`,
          u.ficticio ? null : `último acceso ${u.ultimoAcceso ? fechaMs(u.ultimoAcceso) : '—'}`,
        ]
          .filter(Boolean)
          .join(' · ')
      )
    );
    const lado = el('div', 'fila-lado usuario-lado');
    lado.append(...chipsUsuario(u));

    boton.append(mini, texto, lado);
    const li = el('li');
    li.appendChild(boton);
    return li;
  }

  function abrirUsuario(u) {
    fotoUsuario(u, $('usuario-foto'));
    $('usuario-nombre').textContent = u.nombre || '(sin nombre)';
    $('usuario-email').textContent = u.email ? `${u.email}${u.emailVerificado ? ' · verificado' : ''}` : 'Sin email';
    $('usuario-uid').textContent = u.uid;
    const chips = $('usuario-chips');
    chips.textContent = '';
    chips.append(...chipsUsuario(u));

    const datos = $('usuario-datos');
    datos.textContent = '';
    [
      ['Dónde', [u.codigoPostal, u.ciudad, u.pais].filter(Boolean).join(' ') || '—'],
      ['Alta', fechaMs(u.creado)],
      ['Último acceso', u.ficticio ? '— (no tiene cuenta)' : fechaMs(u.ultimoAcceso)],
      ['Valoración', u.valoraciones ? `★ ${u.valoracion.toFixed(1)} de ${u.valoraciones} valoraciones` : 'Sin valoraciones'],
      ['Ayudas completadas', String(u.ayudas)],
    ].forEach(([k, v]) => datos.append(el('dt', null, k), el('dd', null, v)));

    const { pide, ayuda } = deUsuario(u.uid);
    [
      ['usuario-pide', pide, 'No ha pedido ningún servicio.'],
      ['usuario-ayuda', ayuda, 'No ha ayudado en ningún servicio.'],
    ].forEach(([id, lista, vacio]) => {
      const ul = $(id);
      ul.textContent = '';
      if (!lista.length) ul.appendChild(el('li', 'admin-gris', vacio));
      lista.forEach((s) => {
        const b = el('button', 'usuario-servicio');
        b.type = 'button';
        b.append(
          el('span', null, s.title || '(sin título)'),
          el('span', `chip chip-${s.status}`, ESTADOS[s.status] || s.status || '—'),
          el('span', `precio${s.priceCents == null ? ' gratis' : ''}`, precioTexto(s.priceCents))
        );
        b.addEventListener('click', () => {
          $('usuario').close();
          abrir(s.id);
        });
        const li = el('li');
        li.appendChild(b);
        ul.appendChild(li);
      });
    });
    $('usuario').showModal();
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
      if (campo.id !== 'cerrar' && !campo.closest('#editor-pago')) campo.disabled = !editable;
    });
    form.precio.disabled = !editable || form.gratis.checked;
    $('aprobar').hidden = s.status !== 'pending';
    $('despublicar').hidden = s.status !== 'approved';
    $('guardar').hidden = !editable;
    aviso(
      'editor-aviso',
      editable ? '' : 'Este servicio ya está en marcha o terminado: sus datos ya no se pueden editar.',
      ''
    );

    cargarPago(s);
    $('editor').showModal();
  }

  // --- Pago del servicio (Functions adminVerPago / adminReintentarPago) ---

  function cargarPago(s) {
    const seccion = $('editor-pago');
    const cuerpo = $('pago-cuerpo');
    cuerpo.textContent = '';
    aviso('pago-aviso', '');
    seccion.hidden = s.priceCents == null && !s.pago;
    if (seccion.hidden) return;
    cuerpo.appendChild(el('p', 'admin-gris', 'Consultando Stripe…'));
    fns
      .httpsCallable('adminVerPago')({ serviceId: s.id })
      .then(({ data }) => {
        if (abierto === s.id) pintarPago(s, data);
      })
      .catch((err) => {
        if (abierto !== s.id) return;
        cuerpo.textContent = '';
        aviso('pago-aviso', `No se pudo consultar el pago (${err.message || err.code}).`, 'error');
      });
  }

  function pintarPago(s, { pago, previsto, movimientos, intentos, reintento }) {
    const cuerpo = $('pago-cuerpo');
    cuerpo.textContent = '';
    if (!pago && !previsto) {
      cuerpo.appendChild(el('p', 'admin-gris', 'Todavía no hay pago: nadie ha elegido una oferta pagando.'));
      return;
    }
    if (!pago) {
      cuerpo.appendChild(
        el(
          'p',
          'admin-aviso error',
          `Se eligió sin pagar (los pagos estaban apagados), así que ${previsto.helperName} no ha cobrado. Puedes pedir a ${
            previsto.requesterName
          } que pague ${chf(previsto.total)}: ${chf(previsto.precio)} para ${previsto.helperName} y ${chf(previsto.comision)} de gestión.`
        )
      );
      const acciones = el('div', 'pago-acciones');
      acciones.appendChild(botonReintento(s, Object.assign({ estado: 'sinPago' }, previsto), reintento));
      cuerpo.appendChild(acciones);
      return;
    }

    const resumen = el('p', 'pago-resumen');
    resumen.append(
      el('span', `chip chip-pago-${pago.estado}`, PAGO_ESTADOS[pago.estado] || pago.estado),
      ` ${chf(pago.precio)} para ${pago.helperName || '—'} · gestión ${chf(pago.comision)} · total ${chf(pago.total)} ${
        pago.estado === 'pendiente' ? 'a pagar por' : 'pagado por'
      } ${pago.requesterName || '—'}`
    );
    cuerpo.appendChild(resumen);
    if (pago.error) cuerpo.appendChild(el('p', 'admin-aviso error', `Último error: ${pago.error}`));

    if (movimientos.length) {
      const tabla = el('table', 'pago-tabla');
      const cabecera = el('tr');
      ['Fecha', 'Movimiento', 'Importe', 'Estado', 'Id de Stripe'].forEach((t) => cabecera.appendChild(el('th', null, t)));
      tabla.appendChild(cabecera);
      movimientos.forEach((m) => {
        const tr = el('tr', `mov-${m.tipo}`);
        const tipo = MOVIMIENTOS[m.tipo] || m.tipo;
        tr.append(
          el('td', null, fechaMs(m.fecha)),
          el('td', null, m.detalle ? `${tipo} (${m.detalle})` : tipo),
          el('td', 'importe', `${m.tipo === 'reembolso' ? '−' : ''}${chf(m.importe)}`),
          el('td', null, m.estado || '—'),
          el('td', 'id', m.id)
        );
        tabla.appendChild(tr);
      });
      cuerpo.appendChild(tabla);
    } else {
      cuerpo.appendChild(el('p', 'admin-gris', 'Stripe aún no tiene movimientos de este pago.'));
    }

    if (intentos.length) {
      const lista = el('ul', 'pago-intentos');
      intentos.forEach((i) =>
        lista.appendChild(
          el(
            'li',
            null,
            `${fechaMs(i.fecha)} · ${
              i.resultado === 'enlace'
                ? `enlace para que ${pago.requesterName} ${pago.sinPagoAlElegir ? 'pague' : 'vuelva a pagar'} (válido hasta ${fechaMs(
                    i.expira
                  )})`
                : `${i.origen === 'cobro' ? 'transferencia desde el cobro' : 'ya estaba en Stripe'}: ${
                    i.resultado === 'pagado' ? `pagado (${i.transferId})` : `error: ${i.error}`
                  }`
            }`
          )
        )
      );
      cuerpo.append(el('h4', null, 'Reintentos'), lista);
    }

    const acciones = el('div', 'pago-acciones');
    if (reintento.posible) {
      const nombre = pago.requesterName || 'quien pidió';
      const pague = reintento.motivoCobro === 'sinPago' ? 'pague' : 'vuelva a pagar';
      const enlace = reintento.enlace;
      if (enlace) {
        // Ya se pidió volver a pagar: el enlace, para mandárselo también por otro lado.
        const caja = el('div', 'pago-enlace');
        caja.append(
          el(
            'p',
            null,
            enlace.caducado
              ? `El enlace para que ${nombre} ${pague} ha caducado. Genera otro.`
              : `Esperando a que ${nombre} ${pague} ${chf(pago.total)}. Se le ha avisado en la app; el enlace vale hasta ${fechaMs(enlace.expira)}.`
          )
        );
        if (!enlace.caducado) {
          const url = el('input', 'pago-url');
          url.readOnly = true;
          url.value = enlace.url;
          url.setAttribute('aria-label', 'Enlace de pago');
          url.addEventListener('focus', () => url.select());
          const copiar = el('button', 'boton boton-secundario boton-pequeno', 'Copiar enlace');
          copiar.type = 'button';
          copiar.addEventListener('click', () => {
            url.select();
            (navigator.clipboard ? navigator.clipboard.writeText(enlace.url) : Promise.reject())
              .catch(() => document.execCommand('copy'))
              .then(() => flotante('Enlace copiado'));
          });
          caja.append(url, copiar);
        }
        acciones.appendChild(caja);
      }
      acciones.appendChild(botonReintento(s, pago, reintento, enlace));
    } else if (pago.estado !== 'pagado') {
      acciones.appendChild(el('p', 'admin-gris', reintento.motivo));
    }
    const ids = Object.entries(pago.ids)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');
    cuerpo.append(acciones, el('p', 'pago-ids', ids));
  }

  /** El botón de reintentar, con su confirmación, según de dónde sale el dinero. */
  function botonReintento(s, pago, reintento, enlace) {
    const nombre = pago.requesterName || 'quien pidió';
    const porQue =
      reintento.motivoCobro === 'sinPago'
        ? `Se eligió sin pagar (los pagos estaban apagados).`
        : `El cobro se devolvió a ${nombre}, así que no queda dinero de este servicio.`;
    const textos = {
      cobro: [
        `Reintentar el pago (${chf(pago.precio)})`,
        `¿Transferir ${chf(pago.precio)} a ${pago.helperName} desde el cobro de este servicio?`,
        'Transferir',
      ],
      cobrarDeNuevo: [
        enlace
          ? 'Generar un enlace nuevo'
          : reintento.motivoCobro === 'sinPago'
            ? `Pedir el pago a ${nombre} (${chf(pago.total)})`
            : `Pedir a ${nombre} que vuelva a pagar (${chf(pago.total)})`,
        `${porQue} Se crea un enlace de pago de ${chf(pago.total)} para ${nombre} (vale 24 horas) y se le avisa en la app. En cuanto pague, ${
          pago.helperName
        } recibe ${chf(pago.precio)}.${enlace ? ' El enlace anterior deja de valer.' : ''}`,
        enlace ? 'Generar enlace' : 'Pedir el pago',
      ],
      existente: [
        'Marcar como pagado',
        `Stripe ya tiene la transferencia ${reintento.transferId} a ${pago.helperName}. ¿Marcar el pago como hecho? No se mueve dinero.`,
        'Marcar como pagado',
      ],
    }[reintento.origen];
    const boton = el('button', `boton ${enlace ? 'boton-secundario' : 'boton-primario'}`, textos[0]);
    boton.type = 'button';
    boton.addEventListener('click', async () => {
      if (!(await preguntar(textos[1], textos[2]))) return;
      boton.disabled = true;
      aviso('pago-aviso', reintento.origen === 'cobrarDeNuevo' ? 'Creando el enlace…' : 'Pagando…');
      fns
        .httpsCallable('adminReintentarPago')({ serviceId: s.id, origen: reintento.origen })
        .then(({ data }) => {
          flotante(data.estado === 'esperando' ? `Enlace creado: se ha avisado a ${nombre}` : `Pagado a ${pago.helperName}`);
          if (abierto === s.id) cargarPago(s);
        })
        .catch((err) => {
          aviso('pago-aviso', err.message || err.code, 'error');
          if (abierto === s.id) setTimeout(() => cargarPago(s), 1500);
        });
    });
    return boton;
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
