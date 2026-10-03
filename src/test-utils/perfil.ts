import type { ApiUserProfile, MiPerfil, Review } from '../firebase/data';

/** Perfil completo de un vecino para tests; se sobrescribe lo que haga falta. */
export const perfil = (cambios: Partial<ApiUserProfile> = {}): ApiUserProfile => ({
  id: 'luis',
  name: 'Luis',
  bio: 'Carpintero jubilado, tengo de todo en el taller.',
  city: 'Zürich',
  postalCode: '8003',
  country: 'Switzerland',
  languages: 'German, Spanish',
  credits: 0,
  level: 3,
  levelLabel: 'Trusted neighbor',
  servicesCompleted: 27,
  rating: 4.8,
  ratingCount: 21,
  responseLabel: '< 1h',
  identityVerified: true,
  cobrosActivos: false,
  onboardingCompleted: true,
  hasPhoto: false,
  photoURL: null,
  memberSince: Date.UTC(2026, 6, 15),
  ...cambios,
});

/** Mi perfil (el de quien tiene la sesión): el público más los datos privados. */
export const miPerfil = (cambios: Partial<MiPerfil> = {}): MiPerfil => ({
  ...perfil(),
  email: 'luis@example.com',
  dateOfBirth: null,
  ...cambios,
});

/** Reseña de ejemplo: Ana valora a Luis en s1. */
export const resena = (cambios: Partial<Review> = {}): Review => ({
  serviceId: 's1',
  serviceTitle: 'Pintar pared',
  reviewerId: 'ana',
  reviewerName: 'Ana',
  reviewerPhotoURL: null,
  revieweeId: 'luis',
  rating: 4,
  comment: 'Muy puntual',
  createdAt: Date.UTC(2026, 8, 20),
  ...cambios,
});
