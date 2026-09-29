/**
 * Datos de prueba: 10 vecinos de Zúrich con 3 servicios aprobados cada uno.
 *
 * Todo lleva `seed: true` y ids que empiezan por "seed-", para poder
 * borrarlo sin tocar datos reales (npm run seed:clean). Los avatares son
 * ilustraciones de DiceBear y las fotos de servicios, imágenes libres de
 * Picsum elegidas a mano para que encajen con cada categoría.
 */

const foto = (id) => `https://picsum.photos/id/${id}/800/600`;
const avatar = (nombre) =>
  `https://api.dicebear.com/9.x/avataaars/png?size=256&backgroundColor=f2ddcb&seed=${encodeURIComponent(nombre)}`;

// Cada vecino vive en un barrio; sus servicios quedan cerca de casa.
const vecinos = [
  {
    nombre: 'Anna Weber',
    barrio: 'Wiedikon', cp: '8003', casa: [47.37, 8.517],
    idiomas: 'German, English', valoracion: 4.9, respuesta: '< 1h', nivel: 3, ayudas: 18, creditos: 45, verificada: true,
    bio: "Graphic designer, two cats and a balcony full of plants. Happy to lend a hand with anything creative.",
    servicios: [
      { cat: 'painting', titulo: 'Repaint my living room wall', fotos: [210],
        texto: 'One wall of about 4 x 2.5 m, currently white, going light terracotta. I already have the paint, rollers and tape; I just need a second pair of hands and someone steadier on the ladder than me.',
        duracion: '3 hours', disponible: 'This Saturday' },
      { cat: 'dog', titulo: 'Evening walk for Luna (beagle)', fotos: [1025],
        texto: 'Luna is 4, friendly with people and other dogs, and pulls a little at the start. A 45-minute loop around Friedhof Sihlfeld would be perfect while I work late this week.',
        duracion: '45 minutes', disponible: 'Weekday evenings' },
      { cat: 'other', titulo: 'Water my plants while I travel', fotos: [530, 940],
        texto: 'Away from the 12th to the 19th. About 20 plants, most need water twice a week. I will leave a key with the neighbor and a little care sheet on the fridge.',
        duracion: '20 minutes, twice a week', disponible: 'Next week' },
    ],
  },
  {
    nombre: 'Lukas Meier',
    barrio: 'Oerlikon', cp: '8050', casa: [47.411, 8.544],
    idiomas: 'German, English, French', valoracion: 4.7, respuesta: '~2h', nivel: 2, ayudas: 9, creditos: 30, verificada: true,
    bio: 'Engineer, cyclist, and the person on my floor with the full toolbox. Always up for fixing things.',
    servicios: [
      { cat: 'moving', titulo: 'Help carrying a sofa to the 3rd floor', fotos: [625],
        texto: 'New sofa arrives Saturday morning and the building has no lift. It is a 3-seater, heavy but not huge. Two people should be enough, coffee and croissants on me.',
        duracion: '1 hour', disponible: 'Saturday 10:00' },
      { cat: 'other', titulo: 'Set up my parents’ new laptop', fotos: [0],
        texto: 'My parents (70s) got a new laptop. Transfer photos from the old one, set up email and video calls, and show them the basics patiently. They speak German.',
        duracion: '2 hours', disponible: 'Sunday afternoon' },
      { cat: 'groceries', titulo: 'Weekly shop from the Oerlikon market', fotos: [627],
        texto: 'I\u2019m recovering from a knee operation and can’t carry much for a few weeks. A small weekly shop from the Wednesday market: vegetables, bread and eggs. List provided.',
        duracion: '1 hour', disponible: 'Wednesdays' },
    ],
  },
  {
    nombre: 'Sofia Rossi',
    barrio: 'Seefeld', cp: '8008', casa: [47.356, 8.555],
    idiomas: 'Italian, German, English', valoracion: 5.0, respuesta: '< 30 min', nivel: 4, ayudas: 31, creditos: 80, verificada: true,
    bio: 'Italian cook living by the lake. I will happily trade a lasagna for almost anything.',
    servicios: [
      { cat: 'groceries', titulo: 'Pick up a box of vegetables from the farm shop', fotos: [292],
        texto: 'My weekly organic box is ready at the farm shop near Tiefenbrunnen but I can’t make it on Thursday. It is one box, already paid for, and not too heavy.',
        duracion: '30 minutes', disponible: 'Thursday afternoon' },
      { cat: 'other', titulo: 'Italian conversation practice (for you!)', fotos: [24],
        texto: 'Offering an hour of relaxed Italian conversation over coffee in exchange for credits. All levels welcome, I can adapt to beginners.',
        duracion: '1 hour', disponible: 'Flexible' },
      { cat: 'dog', titulo: 'Look after Pippo for a weekend', fotos: [837],
        texto: 'Pippo is a calm 8-year-old bulldog who mostly sleeps. I need someone to host him Friday evening to Sunday. Food, bed and toys included.',
        duracion: 'Weekend', disponible: 'Next weekend' },
    ],
  },
  {
    nombre: 'Jonas Keller',
    barrio: 'Altstetten', cp: '8048', casa: [47.391, 8.488],
    idiomas: 'German, English', valoracion: 4.6, respuesta: '~3h', nivel: 2, ayudas: 7, creditos: 20, verificada: false,
    bio: 'Student at ETH, flatshare in Altstetten. Good with bikes, bad with plants.',
    servicios: [
      { cat: 'other', titulo: 'Fix the gears on my bike', fotos: [839],
        texto: 'The rear derailleur skips on the two smallest cogs. Probably just needs adjusting, but I have no idea how. Happy to learn while you do it.',
        duracion: '1 hour', disponible: 'Weekday evenings' },
      { cat: 'moving', titulo: 'Moving out of my room: boxes and a desk', fotos: [534],
        texto: 'Moving to a new flatshare 2 km away. About 12 boxes, a desk and a chair. I have a borrowed van, I just need help loading and unloading.',
        duracion: '3 hours', disponible: 'End of the month' },
      { cat: 'groceries', titulo: 'Bring snacks for our flat party', fotos: [999],
        texto: 'We are hosting a small party and got stuck with exams. Pick up snacks and drinks from the Coop at the station, receipt reimbursed of course.',
        duracion: '45 minutes', disponible: 'Friday 18:00' },
    ],
  },
  {
    nombre: 'Mia Schneider',
    barrio: 'Enge', cp: '8002', casa: [47.364, 8.531],
    idiomas: 'German, English, Spanish', valoracion: 4.8, respuesta: '~1h', nivel: 3, ayudas: 22, creditos: 55, verificada: true,
    bio: 'Primary school teacher and piano player. Two kids, one very energetic dog.',
    servicios: [
      { cat: 'dog', titulo: 'Morning walk for Balu (husky)', fotos: [659],
        texto: 'Balu needs a long walk in the morning, ideally along the lake. He is strong and loves to run, so a confident walker would be great.',
        duracion: '1 hour', disponible: 'Weekday mornings' },
      { cat: 'other', titulo: 'Beginner piano lesson for my son', fotos: [1082],
        texto: 'My son (9) wants to try piano before we commit to a teacher. A friendly first lesson at our place, we have an upright piano.',
        duracion: '45 minutes', disponible: 'Tuesday afternoon' },
      { cat: 'painting', titulo: 'Touch up scratches on the hallway walls', fotos: [946],
        texto: 'Kids and dog have left their mark on the hallway. Small patches of filler and a fresh coat on about 6 m of wall. Paint is already here.',
        duracion: '2 hours', disponible: 'Flexible' },
    ],
  },
  {
    nombre: 'Noah Fischer',
    barrio: 'Hottingen', cp: '8032', casa: [47.37, 8.56],
    idiomas: 'German, English', valoracion: 4.5, respuesta: '~2h', nivel: 1, ayudas: 3, creditos: 10, verificada: false,
    bio: 'New to Zurich, working in the city. Still learning which bin goes where.',
    servicios: [
      { cat: 'moving', titulo: 'Assemble an IKEA wardrobe', fotos: [1059],
        texto: 'A PAX wardrobe, 2 m tall, with sliding doors. I tried alone and gave up at step 14. Tools are here; I mostly need someone who has done this before.',
        duracion: '2 hours', disponible: 'This weekend' },
      { cat: 'other', titulo: 'Hang pictures and shelves', fotos: [834],
        texto: 'Five frames and two floating shelves. I have a drill but no idea what goes into these old walls. Would love to learn how to do it right.',
        duracion: '1.5 hours', disponible: 'Saturday afternoon' },
      { cat: 'groceries', titulo: 'Show me the best local shops', fotos: [1080],
        texto: 'Just moved here: I would love a quick tour of the good bakery, butcher and market stalls around Hottingen, and help with a first big shop.',
        duracion: '1.5 hours', disponible: 'Saturday morning' },
    ],
  },
  {
    nombre: 'Lea Brunner',
    barrio: 'Wipkingen', cp: '8037', casa: [47.393, 8.529],
    idiomas: 'German, English, Italian', valoracion: 4.9, respuesta: '< 1h', nivel: 3, ayudas: 16, creditos: 40, verificada: true,
    bio: 'Nurse working shifts. I love the Limmat in summer and my dachshund all year round.',
    servicios: [
      { cat: 'dog', titulo: 'Midday walks for Frida (dachshund)', fotos: [169],
        texto: 'Frida is 6 and has short legs and a big personality. On my long shifts she needs a 30-minute walk around noon. Keys by arrangement.',
        duracion: '30 minutes', disponible: 'Mon, Wed, Fri' },
      { cat: 'painting', titulo: 'Paint the old wooden shutters', fotos: [975],
        texto: 'Four window shutters that need sanding and a coat of weatherproof paint. It is a nice outdoor job for a sunny day, materials provided.',
        duracion: '4 hours', disponible: 'Next sunny weekend' },
      { cat: 'groceries', titulo: 'Fresh fruit for a sick neighbor', fotos: [429],
        texto: 'My neighbor upstairs has the flu. Could someone drop fruit and soup at her door tomorrow? I will pay the shopping, she will be very grateful.',
        duracion: '30 minutes', disponible: 'Tomorrow' },
    ],
  },
  {
    nombre: 'Elias Huber',
    barrio: 'Schwamendingen', cp: '8051', casa: [47.405, 8.572],
    idiomas: 'German, English', valoracion: 4.7, respuesta: '~2h', nivel: 2, ayudas: 11, creditos: 25, verificada: true,
    bio: 'Carpenter by trade, dad of two, grows tomatoes on a tiny allotment.',
    servicios: [
      { cat: 'moving', titulo: 'Move a piano across the street', fotos: [445],
        texto: 'Our neighbors are giving us their upright piano. It needs to go about 50 metres and up four steps. Need three strong people and some patience.',
        duracion: '1 hour', disponible: 'Sunday 11:00' },
      { cat: 'other', titulo: 'Tomato harvest at the allotment', fotos: [785],
        texto: 'More tomatoes than we can handle! Help pick for an hour and take a big bag home. Kids welcome, it is a nice morning out.',
        duracion: '1 hour', disponible: 'Saturday morning' },
      { cat: 'painting', titulo: 'Varnish a garden bench', fotos: [307],
        texto: 'I built a bench from old planks and it needs sanding and two coats of varnish before winter. I will share my tools and some carpentry tips.',
        duracion: '2 hours', disponible: 'Flexible' },
    ],
  },
  {
    nombre: 'Nina Graf',
    barrio: 'Langstrasse', cp: '8004', casa: [47.378, 8.525],
    idiomas: 'German, English, Portuguese', valoracion: 4.8, respuesta: '< 1h', nivel: 2, ayudas: 12, creditos: 35, verificada: true,
    bio: 'Barista and musician. If you need someone to test your coffee or tune a guitar, I am your neighbor.',
    servicios: [
      { cat: 'other', titulo: 'Guitar lesson swap', fotos: [145],
        texto: 'I teach beginner guitar and would love help learning to cook something beyond pasta. First lesson on me to see if we get along.',
        duracion: '1 hour', disponible: 'Evenings' },
      { cat: 'groceries', titulo: 'Grocery run for my grandmother', fotos: [488],
        texto: 'My grandmother lives two streets away and can’t carry heavy bags. A weekly shop from her list, she always has cake for whoever comes.',
        duracion: '1 hour', disponible: 'Thursdays' },
      { cat: 'dog', titulo: 'Puppy sitting for Kiko', fotos: [237],
        texto: 'Kiko is a 5-month-old black lab puppy, sweet and chaotic. I need someone to keep her company for an afternoon while I play a gig.',
        duracion: '4 hours', disponible: 'Friday afternoon' },
    ],
  },
  {
    nombre: 'David Baumann',
    barrio: 'Wollishofen', cp: '8038', casa: [47.344, 8.53],
    idiomas: 'German, English', valoracion: 4.4, respuesta: '~4h', nivel: 1, ayudas: 4, creditos: 15, verificada: false,
    bio: 'Retired, lots of time, fewer strong arms than before. Former bookbinder, happy to teach it.',
    servicios: [
      { cat: 'painting', titulo: 'Paint the front door', fotos: [859],
        texto: 'The front door has faded badly. Needs sanding, primer and a new coat of red. I will supervise with coffee and very good biscuits.',
        duracion: '3 hours', disponible: 'Weekdays' },
      { cat: 'moving', titulo: 'Take old furniture to the recycling center', fotos: [1072],
        texto: 'A chest of drawers and two chairs that need to go to the Hagenholz recycling center. I can borrow a car but can’t lift them myself.',
        duracion: '2 hours', disponible: 'Flexible' },
      { cat: 'dog', titulo: 'Company for Bruno on vet day', fotos: [1062],
        texto: 'Bruno (pug, 11) gets very nervous at the vet. Someone calm to come along and hold him in the waiting room would make his day, and mine.',
        duracion: '1.5 hours', disponible: 'Next Tuesday' },
    ],
  },
];

// Ayudas pasadas de cada vecino: una reseña por ayuda.
const ayudasPasadas = [
  'Carried boxes up to the 4th floor', 'Fed the cat for a weekend', 'Fixed a dripping kitchen tap',
  'Walked Bella every morning', 'Assembled a bookshelf', 'Painted a bedroom wall', 'Grocery run during a cold',
  'Helped move a washing machine', 'Watered the balcony plants', 'Set up a new Wi-Fi router',
  'Hung curtains and rails', 'Picked up a parcel from the post office', 'Taught video calls on a new phone',
  'Repaired a bike puncture', 'Carried a mattress downstairs', 'Changed a light fitting',
  'Cleared snow from the entrance', 'Built a raised garden bed', 'Translated a letter from the Kreisbüro',
  'Moved a fridge to the cellar', 'Sanded and oiled a dining table', 'Helped fill in a tax form',
  'Took old furniture to the recycling centre', 'Put up shelves in the kids\u2019 room', 'Looked after a puppy for an afternoon',
];
const comentarios = {
  5: [
    'Super helpful and on time. Thank you!', 'Went above and beyond, highly recommended.',
    'Friendly, careful and very quick.', 'Couldn\u2019t have done it without them!',
    'Brought the right tools and left everything tidy.', 'A real neighbor. Will ask again.',
    'Patient and kind, exactly what I needed.', 'Arrived early and did a great job.',
  ],
  4: [
    'Good help, a little late but very nice.', 'Did the job well, thanks!', 'Solid work and good company.',
    'Very kind, it just took a bit longer than planned.', 'Reliable and friendly.',
  ],
  3: ['Okay overall, a couple of things left to finish.', 'Helpful, but communication could be better.'],
};

const niveles = { 1: 'New neighbor', 2: 'Helpful neighbor', 3: 'Trusted neighbor', 4: 'Neighborhood hero' };

/** Desplazamiento pequeño y determinista alrededor de casa (cientos de metros). */
function cerca([lat, lng], n) {
  const ang = n * 2.1;
  const r = 0.002 + 0.0015 * (n % 3);
  return { latitude: +(lat + r * Math.cos(ang)).toFixed(6), longitude: +(lng + r * Math.sin(ang) * 1.5).toFixed(6) };
}

/**
 * Construye los documentos. `ahora` y `fecha` se inyectan para poder usar
 * Timestamps de Firestore en el script y fechas simples en los tests.
 */
function construir({ fecha, ahora = new Date('2026-09-29T09:00:00Z') }) {
  const usuarios = [];
  const servicios = [];
  const resenas = [];
  vecinos.forEach((v, i) => {
    const uid = `seed-user-${String(i + 1).padStart(2, '0')}`;
    const email = `${v.nombre.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`;
    const photoURL = avatar(v.nombre);
    // Una reseña por ayuda: la media sale de la suma, como en la app.
    const ratingCount = v.ayudas;
    const ratingSum = Math.round(v.valoracion * ratingCount);
    const rating = Math.round((ratingSum / ratingCount) * 10) / 10;
    usuarios.push({
      id: uid,
      data: {
        name: v.nombre,
        email,
        bio: v.bio,
        dateOfBirth: null,
        city: 'Zürich',
        postalCode: v.cp,
        country: 'Switzerland',
        languages: v.idiomas,
        credits: v.creditos,
        level: v.nivel,
        levelLabel: niveles[v.nivel],
        servicesCompleted: v.ayudas,
        rating,
        ratingSum,
        ratingCount,
        responseLabel: v.respuesta,
        identityVerified: v.verificada,
        onboardingCompleted: true,
        photoURL,
        seed: true,
        createdAt: fecha(new Date(ahora.getTime() - (60 + i * 7) * 86400000)),
      },
    });
    // Reseñas que suman exactamente ratingSum: las primeras con una estrella más.
    const base = Math.floor(ratingSum / ratingCount);
    const conMas = ratingSum - base * ratingCount;
    const diasComoVecino = 60 + i * 7;
    for (let k = 0; k < ratingCount; k++) {
      const nota = k < conMas ? base + 1 : base;
      const autor = vecinos[(i + 1 + (k % 9)) % vecinos.length];
      const id = `seed-review-${String(i + 1).padStart(2, '0')}-${String(k + 1).padStart(2, '0')}`;
      const textos = comentarios[nota] ?? comentarios[5];
      resenas.push({
        id,
        data: {
          serviceId: id,
          serviceTitle: ayudasPasadas[(i * 7 + k) % ayudasPasadas.length],
          reviewerId: `seed-user-${String(vecinos.indexOf(autor) + 1).padStart(2, '0')}`,
          reviewerName: autor.nombre,
          reviewerPhotoURL: avatar(autor.nombre),
          revieweeId: uid,
          rating: nota,
          // Una de cada seis sin comentario: en la app es opcional.
          comment: k % 6 === 5 ? '' : textos[(i + k) % textos.length],
          seed: true,
          createdAt: fecha(new Date(ahora.getTime() - ((k + 1) * (diasComoVecino - 2) * 86400000) / (ratingCount + 1))),
        },
      });
    }
    v.servicios.forEach((s, j) => {
      const n = i * 3 + j;
      servicios.push({
        id: `seed-service-${String(i + 1).padStart(2, '0')}-${j + 1}`,
        data: {
          title: s.titulo,
          category: s.cat,
          description: s.texto,
          credits: 0,
          photos: s.fotos.map(foto),
          coords: cerca(v.casa, n),
          durationLabel: s.duracion,
          availableLabel: s.disponible,
          locationLabel: '',
          travelRadiusKm: 5,
          status: 'approved',
          requesterId: uid,
          requesterName: v.nombre,
          requesterRating: rating,
          requesterResponseLabel: v.respuesta,
          requesterPhotoURL: photoURL,
          helperId: null,
          helperName: null,
          helperRating: null,
          helperResponseLabel: null,
          seed: true,
          // Repartidos en los últimos días, para que el muro tenga un orden creíble.
          createdAt: fecha(new Date(ahora.getTime() - (n * 7 + 1) * 3600000)),
          updatedAt: fecha(new Date(ahora.getTime() - (n * 7 + 1) * 3600000)),
        },
      });
    });
  });
  return { usuarios, servicios, resenas };
}

module.exports = { construir, vecinos };
