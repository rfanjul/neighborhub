import type { ServiceRequest } from '../data/mock';

/** Servicio completo con valores razonables; cada test cambia lo que le importe. */
export function servicio(overrides: Partial<ServiceRequest> = {}): ServiceRequest {
  return {
    id: 's1',
    title: 'Pintar una pared',
    category: 'painting',
    description: 'Media pared del salón',
    distanceKm: 1.2,
    credits: 15,
    postedLabel: 'hace 2 h',
    status: 'approved',
    durationLabel: '2 horas',
    availableLabel: 'Flexible',
    photos: [],
    coords: null,
    requesterId: 'ana',
    helperId: null,
    helperName: null,
    requester: { name: 'Ana', rating: 4.8, ratingCount: 12, responseLabel: '< 1 h', avatarColor: '#E7C9A9' },
    ...overrides,
  };
}
