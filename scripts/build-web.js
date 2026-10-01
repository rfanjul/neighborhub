#!/usr/bin/env node
/**
 * Genera la web en web/{en,de,es}/ a partir de las plantillas de aquí y de
 * los textos de web-src/textos-*.js, y la raíz que manda a cada cual a su
 * idioma. Lo estático (styles.css, contacto.js, img/) vive ya en web/.
 *
 *   npm run web:build
 */
const fs = require('fs');
const path = require('path');
const { avatar } = require('./seed-data');

const raiz = path.join(__dirname, '..');
const salidaPorDefecto = path.join(raiz, 'web');
let salida = salidaPorDefecto;
const idiomas = ['en', 'de', 'es'];
const textos = Object.fromEntries(idiomas.map((i) => [i, require(`../web-src/textos-${i}.js`)]));
const SITIO = 'https://neighborhood-c4dc9.web.app';

const foto = (id, ancho) => `https://images.unsplash.com/photo-${id}?w=${ancho}&q=80&auto=format&fit=crop`;
const fotos = {
  pedir: '1786396798391-8c3f330cf3a8',
  ofrecer: '1648304887391-a6c2cf2228e4',
  elegir: '1626388787104-2ca553fe510c',
  valorar: '1770270402445-b72169c6e48a',
};

/** Rutas de cada página dentro de /{idioma}/. */
const paginas = { inicio: '', privacidad: 'privacy', terminos: 'terms', soporte: 'support' };
const url = (idioma, pagina, extra = '') => `/${idioma}/${paginas[pagina]}${extra}`;

/** Sustituye {contacto}, {privacidad}… en los textos por las URL de su idioma. */
function enlaces(texto, idioma) {
  return texto
    .replace(/\{contacto\}/g, url(idioma, 'soporte', '#contacto'))
    .replace(/\{privacidad\}/g, url(idioma, 'privacidad'))
    .replace(/\{borrar\}/g, url(idioma, 'soporte', '?tipo=borrar-cuenta#contacto'))
    .replace(/\{reportar\}/g, url(idioma, 'soporte', '?tipo=reportar#contacto'));
}

function cabecera(t, pagina, { titulo, descripcion }) {
  const alternativas = idiomas
    .map((i) => `  <link rel="alternate" hreflang="${i}" href="${SITIO}${url(i, pagina)}">`)
    .join('\n');
  const selector = idiomas
    .map(
      (i) =>
        `<a href="${url(i, pagina)}" data-idioma="${i}" hreflang="${i}"${i === t.lang ? ' aria-current="true" class="activo"' : ''}>${i.toUpperCase()}</a>`
    )
    .join('');
  const ancla = (id) => (pagina === 'inicio' ? `#${id}` : `${url(t.lang, 'inicio')}#${id}`);
  return `<!doctype html>
<html lang="${t.lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${titulo}</title>
  <meta name="description" content="${descripcion}">
  <meta property="og:title" content="${titulo}">
  <meta property="og:description" content="${t.meta.og}">
  <meta property="og:image" content="${foto(fotos.elegir, 1200)}">
  <meta name="theme-color" content="#DD6B3E">
  <link rel="canonical" href="${SITIO}${url(t.lang, pagina)}">
${alternativas}
  <link rel="alternate" hreflang="x-default" href="${SITIO}/">
  <link rel="icon" href="/img/favicon.png">
  <link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700&family=Work+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="nav">
    <div class="contenedor">
      <a class="marca" href="${url(t.lang, 'inicio')}"><img src="/img/icono-512.png" alt=""><span class="marca-nombre">Neighborhub</span></a>
      <nav class="nav-enlaces">
        <a href="${ancla('como-funciona')}">${t.nav.como}</a>
        <a href="${ancla('preguntas')}">${t.nav.preguntas}</a>
        <a href="${url(t.lang, 'soporte')}">${t.nav.soporte}</a>
        <span class="selector-idioma" role="group" aria-label="${t.nav.idioma}">${selector}</span>
      </nav>
    </div>
  </header>
`;
}

function pie(t, { formulario = false } = {}) {
  const scripts = formulario
    ? `  <script defer src="/__/firebase/10.12.2/firebase-app-compat.js"></script>
  <script defer src="/__/firebase/10.12.2/firebase-firestore-compat.js"></script>
  <script defer src="/__/firebase/init.js?useEmulator=true"></script>
  <script defer src="/contacto.js"></script>
`
    : '';
  return `
  <footer class="pie">
    <div class="contenedor">
      <span>${t.pie.lugar}</span>
      <nav><a href="${url(t.lang, 'soporte')}">${t.pie.soporte}</a><a href="${url(t.lang, 'privacidad')}">${t.pie.privacidad}</a><a href="${url(t.lang, 'terminos')}">${t.pie.terminos}</a><a href="${url(t.lang, 'soporte', '#contacto')}">${t.pie.contacto}</a></nav>
    </div>
  </footer>
  <script src="/idioma.js"></script>
${scripts}</body>
</html>
`;
}

function formulario(t) {
  const c = t.contacto;
  const opciones = Object.entries(c.tipos)
    .map(([valor, texto]) => `<option value="${valor}">${texto}</option>`)
    .join('');
  return `<form class="formulario" id="formulario-contacto" novalidate lang="${t.lang}"
          data-idioma="${t.lang}" data-ok="${c.ok}" data-error-email="${c.errorEmail}" data-error-corto="${c.errorCorto}"
          data-error-largo="${c.errorLargo}" data-error-envio="${c.errorEnvio}" data-enviar="${c.enviar}" data-enviando="${c.enviando}">
          <label>${c.tipo}
            <select name="tipo">${opciones}</select>
          </label>
          <label>${c.nombre} <input name="nombre" autocomplete="name" maxlength="100"></label>
          <label>${c.email} <input name="email" type="email" autocomplete="email" required maxlength="200"></label>
          <label>${c.mensaje} <textarea name="mensaje" required maxlength="3000" placeholder="${c.ejemplo}"></textarea></label>
          <input type="hidden" name="referencia">
          <label class="trampa" aria-hidden="true">Web <input name="web" tabindex="-1" autocomplete="off"></label>
          <div class="estado" role="status" aria-live="polite"></div>
          <button class="boton boton-primario" type="submit">${c.enviar}</button>
          <p class="nota">${enlaces(c.aviso, t.lang)}</p>
        </form>`;
}

function bloqueContacto(t, antetitulo, titulo, intro) {
  const puntos = t.contacto.puntos.map(([icono, fuerte, texto]) => `<li>${icono} <strong>${fuerte}</strong> ${texto}</li>`).join('\n            ');
  return `
    <section class="seccion" id="contacto">
      <div class="contenedor contacto">
        <div>
          <div class="antetitulo">${antetitulo}</div>
          <h2>${titulo}</h2>
          <p class="intro">${intro}</p>
          <ul class="lista-contacto">
            ${puntos}
          </ul>
        </div>
        ${formulario(t)}
      </div>
    </section>`;
}

const preguntas = (lista) =>
  lista.map(([p, r]) => `<details><summary>${p}</summary><p>${enlacesNada(r)}</p></details>`).join('\n          ');
const enlacesNada = (x) => x;

function inicio(t) {
  const pasos = t.pasos.lista
    .map(
      (p, i) => `
          <article class="paso">
            <img src="${foto(Object.values(fotos)[i], 700)}" alt="${p.alt}" loading="lazy">
            <div><span class="numero">${p.etiqueta}</span><h3>${p.titulo}</h3>
            <p>${p.texto}</p></div>
          </article>`
    )
    .join('');
  const ventajas = t.confianza.lista
    .map((v) => `<div class="ventaja"><div class="icono">${v.icono}</div><h3>${v.titulo}</h3><p>${v.texto}</p></div>`)
    .join('\n          ');
  return (
    cabecera(t, 'inicio', { titulo: t.meta.titulo, descripcion: t.meta.descripcion }) +
    `
  <main>
    <section class="portada">
      <div class="contenedor">
        <div>
          <div class="antetitulo">${t.portada.antetitulo}</div>
          <h1>${t.portada.titulo}</h1>
          <p class="intro">${t.portada.intro}</p>
          <div class="acciones">
            <a class="boton boton-oscuro" href="#descargar">${t.portada.appStore}</a>
            <a class="boton boton-secundario" href="#como-funciona">${t.portada.como}</a>
          </div>
          <p class="nota">${t.portada.nota}</p>
        </div>
        <div class="collage" aria-hidden="true">
          <img class="foto-1" src="${foto(fotos.ofrecer, 900)}" alt="">
          <img class="foto-2" src="${foto(fotos.elegir, 700)}" alt="">
          <div class="flotante">
            <img src="${avatar('Lukas Meier').replace('size=256', 'size=96').replace(/&/g, '&amp;')}" alt="">
            <div><strong>${t.portada.tarjeta}</strong><br><span class="estrellas">★★★★★</span> ${t.portada.tarjetaDatos}</div>
          </div>
        </div>
      </div>
    </section>

    <section class="seccion seccion-blanca" id="como-funciona">
      <div class="contenedor">
        <div class="antetitulo">${t.pasos.antetitulo}</div>
        <h2>${t.pasos.titulo}</h2>
        <div class="pasos">${pasos}
        </div>
      </div>
    </section>

    <section class="seccion" id="confianza">
      <div class="contenedor">
        <div class="antetitulo">${t.confianza.antetitulo}</div>
        <h2>${t.confianza.titulo}</h2>
        <p class="intro">${t.confianza.intro}</p>
        <div class="ventajas">
          ${ventajas}
        </div>
      </div>
    </section>

    <section class="seccion seccion-blanca" id="preguntas">
      <div class="contenedor">
        <div class="antetitulo">${t.faq.antetitulo}</div>
        <h2>${t.faq.titulo}</h2>
        <div class="preguntas">
          ${preguntas(t.faq.lista)}
        </div>
      </div>
    </section>
${bloqueContacto(t, t.contacto.antetitulo, t.contacto.titulo, t.contacto.intro)}

    <section class="seccion" id="descargar">
      <div class="contenedor">
        <div class="llamada">
          <img src="/img/icono-512.png" alt="${t.llamada.alt}">
          <div><h2>${t.llamada.titulo}</h2><p>${t.llamada.texto}</p></div>
          <a class="boton boton-oscuro" href="#contacto">${t.llamada.boton}</a>
        </div>
      </div>
    </section>
  </main>
` +
    pie(t, { formulario: true })
  );
}

function legal(t, pagina, datos) {
  return (
    cabecera(t, pagina, { titulo: `${datos.titulo} · Neighborhub`, descripcion: datos.descripcion }) +
    `
  <main class="legal">
    <div class="contenedor">
      <article>
        <h1>${datos.titulo}</h1>
        <p class="actualizado">${datos.actualizado}</p>
${enlaces(datos.html, t.lang)}
      </article>
    </div>
  </main>
` +
    pie(t)
  );
}

function soporte(t) {
  const s = t.soporte;
  return (
    cabecera(t, 'soporte', { titulo: `${s.titulo} · Neighborhub`, descripcion: s.descripcion }) +
    `
  <main>
    <section class="seccion seccion-blanca">
      <div class="contenedor">
        <div class="antetitulo">${s.antetitulo}</div>
        <h1>${s.h1}</h1>
        <p class="intro">${s.intro}</p>
        <div class="preguntas">
          ${preguntas(s.lista)}
        </div>
      </div>
    </section>
${bloqueContacto(t, s.contactoAntetitulo, s.contactoTitulo, s.contactoIntro)}
  </main>
` +
    pie(t, { formulario: true })
  );
}

/** Raíz: manda a cada cual a su idioma (el elegido antes o el del navegador). */
function raizIdiomas() {
  const enlacesIdiomas = idiomas.map((i) => `<a class="boton boton-secundario" href="/${i}/" data-idioma="${i}">${textos[i].nombreIdioma}</a>`).join(' ');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Neighborhub</title>
  <meta name="description" content="${textos.en.meta.descripcion}">
${idiomas.map((i) => `  <link rel="alternate" hreflang="${i}" href="${SITIO}/${i}/">`).join('\n')}
  <link rel="alternate" hreflang="x-default" href="${SITIO}/">
  <link rel="icon" href="/img/favicon.png">
  <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700&family=Work+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
  <script>
    (function () {
      var validos = ${JSON.stringify(idiomas)};
      var elegido = null;
      try { elegido = localStorage.getItem('idioma'); } catch (e) {}
      if (validos.indexOf(elegido) < 0) {
        var preferidos = navigator.languages || [navigator.language || 'en'];
        for (var i = 0; i < preferidos.length && !elegido; i++) {
          var codigo = String(preferidos[i]).slice(0, 2).toLowerCase();
          if (validos.indexOf(codigo) >= 0) elegido = codigo;
        }
      }
      location.replace('/' + (elegido || 'en') + '/' + location.search + location.hash);
    })();
  </script>
</head>
<body>
  <main class="legal"><div class="contenedor"><article style="text-align:center">
    <img src="/img/icono-512.png" alt="" style="width:96px;height:96px;border-radius:24px;margin:0 auto 16px">
    <h1>Neighborhub</h1>
    <p>${enlacesIdiomas}</p>
  </article></div></main>
  <script src="/idioma.js"></script>
</body>
</html>
`;
}

function noEncontrada() {
  const bloques = idiomas
    .map((i) => {
      const n = textos[i].noEncontrada;
      return `<div lang="${i}"><h2>${n.h1}</h2><p>${n.texto}</p><p><a class="boton boton-primario" href="/${i}/">${n.volver}</a></p></div>`;
    })
    .join('\n    ');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${textos.en.noEncontrada.titulo} · Neighborhub</title>
  <link rel="icon" href="/img/favicon.png">
  <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700&family=Work+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <main class="legal"><div class="contenedor"><article>
    ${bloques}
  </article></div></main>
</body>
</html>
`;
}

function escribir(ruta, html) {
  const destino = path.join(salida, ruta);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, html);
}

function construir(destino = salidaPorDefecto) {
  salida = destino;
  // Lo generado en pasadas anteriores (incluidas las páginas antiguas en español).
  for (const i of idiomas) fs.rmSync(path.join(salida, i), { recursive: true, force: true });
  for (const viejo of ['privacidad.html', 'terminos.html', 'soporte.html']) fs.rmSync(path.join(salida, viejo), { force: true });

  for (const i of idiomas) {
    const t = textos[i];
    escribir(`${i}/index.html`, inicio(t));
    escribir(`${i}/privacy.html`, legal(t, 'privacidad', t.privacidad));
    escribir(`${i}/terms.html`, legal(t, 'terminos', t.terminos));
    escribir(`${i}/support.html`, soporte(t));
  }
  escribir('index.html', raizIdiomas());
  escribir('404.html', noEncontrada());
  return idiomas.length * 4 + 2;
}

if (require.main === module) {
  console.log(`🌐 web/ generada: ${construir()} páginas en ${idiomas.join(', ')}`);
}

module.exports = { construir, textos, idiomas };
