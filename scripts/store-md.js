#!/usr/bin/env node
/**
 * Pasa store.config.json (los textos de App Store Connect, que sube
 * `eas metadata:push`) a store/APP_STORE.md, para leerlos y copiarlos a mano.
 *
 *   npm run store:md
 */
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(raiz, 'store.config.json'), 'utf8'));
const nombres = { 'en-US': 'English (U.S.)', 'de-DE': 'Deutsch', 'es-ES': 'Español (España)' };

let md = `# Neighborhub en App Store Connect

Generado desde \`store.config.json\` con \`npm run store:md\`: edita allí y
vuelve a generar. Se sube con \`npx eas-cli metadata:push\`.

Versión: ${config.apple.version} · Categorías: ${config.apple.categories.join(', ')} · Copyright: ${config.apple.copyright}\nEdad: ${config.apple.advisory.ageRatingOverrideV2} (contenido de usuarios y chat; sin anuncios ni navegador web)
`;
for (const [locale, i] of Object.entries(config.apple.info)) {
  const keywords = i.keywords.join(',');
  md += `
## ${nombres[locale] ?? locale}

| Campo | Texto | Límite |
|---|---|---|
| Nombre | ${i.title} | ${i.title.length}/30 |
| Subtítulo | ${i.subtitle} | ${i.subtitle.length}/30 |
| Palabras clave | \`${keywords}\` | ${keywords.length}/100 |
| Soporte | ${i.supportUrl} | |
| Marketing | ${i.marketingUrl} | |
| Privacidad | ${i.privacyPolicyUrl} | |
| Opciones de privacidad | ${i.privacyChoicesUrl} | |
| Capturas iPhone 6,5" | ${(i.screenshots?.APP_IPHONE_65 ?? []).map((c) => `[${path.basename(c)}](${c.replace('./store/', './')})`).join(' · ')} | ${(i.screenshots?.APP_IPHONE_65 ?? []).length}/10 |

**Texto promocional** (${i.promoText.length}/170)

> ${i.promoText}

**Descripción** (${i.description.length}/4000)

\`\`\`text
${i.description}
\`\`\`
`;
}
fs.writeFileSync(path.join(raiz, 'store', 'APP_STORE.md'), md);
console.log('📝 store/APP_STORE.md');
