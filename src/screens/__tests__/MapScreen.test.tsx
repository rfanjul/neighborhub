import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import MapScreen from '../MapScreen';
import { mockServices } from '../../data/mock';

describe('MapScreen', () => {
  it('enseña el servicio destacado y lleva a su detalle', async () => {
    const navigation = { navigate: jest.fn() };
    await render(<MapScreen navigation={navigation as never} route={{} as never} />);

    await fireEvent.press(screen.getByText(mockServices[1].title));

    expect(navigation.navigate).toHaveBeenCalledWith('ServiceDetail', { serviceId: mockServices[1].id });
  });

  it('cambia el radio de búsqueda', async () => {
    await render(<MapScreen navigation={{ navigate: jest.fn() } as never} route={{} as never} />);

    await fireEvent.press(screen.getByText('10 km'));

    expect(screen.getByText('10 km')).toBeTruthy();
  });
});
