export type ServiceCategory = 'painting' | 'dog' | 'groceries' | 'moving' | 'other';

export type ServiceStatus = 'pending' | 'approved' | 'accepted' | 'in_progress' | 'completed' | 'rated';

export type ServiceRequest = {
  id: string;
  title: string;
  category: ServiceCategory;
  description: string;
  distanceKm: number;
  credits: number;
  postedLabel: string;
  status: ServiceStatus;
  durationLabel: string;
  availableLabel: string;
  /** URLs en Firebase Storage; vacío si el servicio no lleva fotos. */
  photos: string[];
  /** Dónde se publicó, para pintarlo en el mapa. null si no se pudo obtener. */
  coords: { latitude: number; longitude: number } | null;
  /** uid de quien lo publicó; null en los datos de ejemplo. */
  requesterId: string | null;
  /** uid y nombre de quien ayuda, una vez elegida una oferta. */
  helperId: string | null;
  helperName: string | null;
  requester: {
    name: string;
    rating: number;
    ratingCount: number;
    responseLabel: string;
    avatarColor: string;
    /** Foto de perfil de quien lo publicó, si tiene. */
    photoURL: string | null;
  };
};

export const currentUser = {
  name: 'Anna Weber',
  level: 3,
  levelLabel: 'Vecino de confianza',
  credits: 128,
  servicesCompleted: 24,
  rating: 4.8,
  responseLabel: '~1h',
  bio: 'Retired teacher, love gardening and helping out around the neighborhood. Happy to lend tools too!',
};

export const mockServices: ServiceRequest[] = [
  {
    id: 's1',
    title: 'I need help with the weekly groceries',
    category: 'groceries',
    description: 'Just need someone to help carry bags up two flights of stairs, about 30 minutes.',
    distanceKm: 0.8,
    credits: 10,
    postedLabel: '2h ago',
    status: 'approved',
    durationLabel: '~30 min',
    availableLabel: 'Today',
    photos: [],
    coords: null,
    requesterId: null,
    helperId: null,
    helperName: null,
    requester: { name: 'Peter M.', rating: 4.6, ratingCount: 18, responseLabel: '~2h', avatarColor: '#E7C9A9', photoURL: null },
  },
  {
    id: 's2',
    title: 'Need help painting a bedroom wall',
    category: 'painting',
    description:
      'One wall in the bedroom needs a fresh coat of light grey paint. I have all the paint and supplies ready — just need an extra pair of hands for a couple of hours.',
    distanceKm: 1.4,
    credits: 25,
    postedLabel: '5h ago',
    status: 'approved',
    durationLabel: '~2 hours',
    availableLabel: 'Sat, Aug 29',
    photos: [],
    coords: null,
    requesterId: null,
    helperId: null,
    helperName: null,
    requester: { name: 'Lena K.', rating: 4.8, ratingCount: 32, responseLabel: '~1h', avatarColor: '#C9E0D2', photoURL: null },
  },
  {
    id: 's3',
    title: 'Looking for someone to walk my dog',
    category: 'dog',
    description: 'My dog Bruno needs a 20-minute walk around the block while I recover from surgery.',
    distanceKm: 2.1,
    credits: 8,
    postedLabel: 'yesterday',
    status: 'approved',
    durationLabel: '~20 min',
    availableLabel: 'Tomorrow',
    photos: [],
    coords: null,
    requesterId: null,
    helperId: null,
    helperName: null,
    requester: { name: 'Tom S.', rating: 4.9, ratingCount: 41, responseLabel: '~30 min', avatarColor: '#C9D6F2', photoURL: null },
  },
];
