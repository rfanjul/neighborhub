import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import ServiceCard from '../ServiceCard';
import type { ServiceRequest } from '../../data/mock';

const servicio = (overrides: Partial<ServiceRequest> = {}): ServiceRequest =>
  ({
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
    requester: { name: 'Ana', rating: 4.8, ratingCount: 12, responseLabel: '< 1 h', avatarColor: '#E7C9A9' },
    ...overrides,
  }) as ServiceRequest;

describe('ServiceCard', () => {
  it('muestra título, distancia y quién lo publica', async () => {
    await render(<ServiceCard service={servicio()} />);

    expect(screen.getByText('Pintar una pared')).toBeTruthy();
    expect(screen.getByText(/1.2 km away/)).toBeTruthy();
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('15 cr')).toBeTruthy();
  });

  it('enseña la primera foto cuando el servicio tiene', async () => {
    await render(<ServiceCard service={servicio({ photos: ['https://ejemplo/foto1.jpg', 'https://ejemplo/foto2.jpg'] })} />);

    const foto = screen.getByLabelText('Foto de Pintar una pared');
    expect(foto.props.source).toEqual({ uri: 'https://ejemplo/foto1.jpg' });
  });

  it('no deja hueco de imagen si no hay fotos', async () => {
    await render(<ServiceCard service={servicio()} />);

    expect(screen.queryByLabelText('Foto de Pintar una pared')).toBeNull();
  });

  it('no enseña "0 cr" en servicios sin créditos', async () => {
    await render(<ServiceCard service={servicio({ credits: 0 })} />);

    expect(screen.queryByText('0 cr')).toBeNull();
  });

  it('avisa al pulsarla', async () => {
    const onPress = jest.fn();
    await render(<ServiceCard service={servicio()} onPress={onPress} />);

    await fireEvent.press(screen.getByText('Pintar una pared'));

    expect(onPress).toHaveBeenCalled();
  });
});
