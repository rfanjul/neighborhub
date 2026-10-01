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
    priceCents: 4000,
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
    expect(screen.getByText('1.2 km away · hace 2 h')).toBeTruthy();
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText(/^CHF\s40$/)).toBeTruthy();
  });

  it('enseña la primera foto cuando el servicio tiene', async () => {
    await render(<ServiceCard service={servicio({ photos: ['https://ejemplo/foto1.jpg', 'https://ejemplo/foto2.jpg'] })} />);

    const foto = screen.getByLabelText('Photo of Pintar una pared');
    expect(foto.props.source).toEqual({ uri: 'https://ejemplo/foto1.jpg' });
  });

  it('no deja hueco de imagen si no hay fotos', async () => {
    await render(<ServiceCard service={servicio()} />);

    expect(screen.queryByLabelText('Photo of Pintar una pared')).toBeNull();
  });

  it('enseña el precio, sin decimales si es redondo', async () => {
    await render(<ServiceCard service={servicio({ priceCents: 4000 })} />);

    expect(screen.getByText(/^CHF\s40$/)).toBeTruthy();
  });

  it('un favor sin precio se ve como gratis', async () => {
    await render(<ServiceCard service={servicio({ priceCents: null })} />);

    expect(screen.getByText('Free')).toBeTruthy();
    expect(screen.queryByText(/CHF/)).toBeNull();
  });

  it('calcula la distancia real con la ubicación del usuario', async () => {
    await render(
      <ServiceCard
        service={servicio({ coords: { latitude: 47.3667, longitude: 8.5449 } })}
        ubicacion={{ latitude: 47.3779, longitude: 8.5403 }}
      />
    );

    expect(screen.getByText('1.3 km away · hace 2 h')).toBeTruthy();
  });

  it('sin distancia conocida no pone "0 km away"', async () => {
    await render(<ServiceCard service={servicio({ distanceKm: 0, coords: null })} />);

    expect(screen.queryByText(/km away/)).toBeNull();
    expect(screen.getByText('hace 2 h')).toBeTruthy();
  });

  it('marca los propios que aún esperan revisión', async () => {
    await render(<ServiceCard service={servicio({ status: 'pending' })} />);

    expect(screen.getByText('Pending review')).toBeTruthy();
  });

  it('los aprobados no llevan esa marca', async () => {
    await render(<ServiceCard service={servicio({ status: 'approved' })} />);

    expect(screen.queryByText('Pending review')).toBeNull();
  });

  it('avisa al pulsarla', async () => {
    const onPress = jest.fn();
    await render(<ServiceCard service={servicio()} onPress={onPress} />);

    await fireEvent.press(screen.getByText('Pintar una pared'));

    expect(onPress).toHaveBeenCalled();
  });
});
