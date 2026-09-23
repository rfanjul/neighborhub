import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ServiceDetailScreen from '../ServiceDetailScreen';
import { api } from '../../firebase/data';
import { servicio } from '../../test-utils/servicio';

const mockedApi = api as jest.Mocked<typeof api>;

async function renderDetalle(id = 's1') {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  await render(
    <ServiceDetailScreen navigation={navigation as never} route={{ key: 'k', name: 'ServiceDetail', params: { serviceId: id } } as never} />
  );
  return navigation;
}

beforeEach(() => jest.clearAllMocks());

describe('ServiceDetailScreen', () => {
  it('carga el servicio de Firestore y enseña sus datos', async () => {
    mockedApi.getService.mockResolvedValue(servicio({ title: 'Montar un armario', durationLabel: '3 horas' }));
    await renderDetalle();

    expect(await screen.findByText('Montar un armario')).toBeTruthy();
    expect(screen.getByText('3 horas')).toBeTruthy();
    expect(screen.getByText('Ana')).toBeTruthy();
  });

  it('muestra todas las fotos del servicio', async () => {
    mockedApi.getService.mockResolvedValue(servicio({ photos: ['https://ej/1.jpg', 'https://ej/2.jpg'] }));
    await renderDetalle();

    await waitFor(() => expect(screen.getAllByLabelText('Foto de Pintar una pared')).toHaveLength(2));
  });

  it('sin créditos no enseña la fila de créditos', async () => {
    mockedApi.getService.mockResolvedValue(servicio({ credits: 0 }));
    await renderDetalle();

    await screen.findByText('Pintar una pared');
    expect(screen.queryByText('Credits requested')).toBeNull();
  });

  it('si Firestore falla sigue enseñando la versión local', async () => {
    mockedApi.getService.mockRejectedValue(new Error('offline'));
    await renderDetalle('1');

    await waitFor(() => expect(mockedApi.getService).toHaveBeenCalledWith('1'));
    expect(screen.getByText('Apply to help')).toBeTruthy();
  });

  it('al ofrecerse acepta el servicio y abre el chat', async () => {
    mockedApi.getService.mockResolvedValue(servicio());
    mockedApi.acceptService.mockResolvedValue(servicio({ status: 'accepted' }));
    const navigation = await renderDetalle();
    await screen.findByText('Pintar una pared');

    await fireEvent.press(screen.getByText('Apply to help'));

    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('Main', { screen: 'ChatTab' }));
    expect(mockedApi.acceptService).toHaveBeenCalledWith('s1');
  });

  it('vuelve atrás', async () => {
    mockedApi.getService.mockResolvedValue(servicio());
    const navigation = await renderDetalle();

    await fireEvent.press(screen.getByLabelText('Back'));

    expect(navigation.goBack).toHaveBeenCalled();
  });
});
