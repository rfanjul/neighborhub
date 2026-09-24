import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ApplyScreen from '../ApplyScreen';
import { api } from '../../firebase/data';
import { servicio } from '../../test-utils/servicio';

const mockedApi = api as jest.Mocked<typeof api>;

async function renderOferta() {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  await render(<ApplyScreen navigation={navigation as never} route={{ params: { serviceId: 's1' } } as never} />);
  return navigation;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.getService.mockResolvedValue(servicio({ title: 'Pintar una pared', status: 'approved' }));
});

describe('ApplyScreen', () => {
  it('dice a qué servicio se está ofertando', async () => {
    await renderOferta();

    expect(await screen.findByText('Pintar una pared')).toBeTruthy();
  });

  it('envía la oferta con el comentario y abre "My offers"', async () => {
    const navigation = await renderOferta();

    await fireEvent.changeText(screen.getByPlaceholderText(/When could you help/), 'Tengo escalera, el sábado me va bien');
    await fireEvent.press(screen.getByText('Send offer'));

    await waitFor(() => expect(mockedApi.applyToService).toHaveBeenCalledWith('s1', 'Tengo escalera, el sábado me va bien'));
    expect(navigation.navigate).toHaveBeenCalledWith('Main', { screen: 'ActivityTab', params: { segmento: 'offers' } });
  });

  it('pide un comentario antes de enviar', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderOferta();

    await fireEvent.changeText(screen.getByPlaceholderText(/When could you help/), '   ');
    await fireEvent.press(screen.getByText('Send offer'));

    expect(alerta).toHaveBeenCalledWith('Add a comment', expect.any(String));
    expect(mockedApi.applyToService).not.toHaveBeenCalled();
    alerta.mockRestore();
  });

  it('explica por qué no se pudo enviar y se queda en la pantalla', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockedApi.applyToService.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'permission-denied' }));
    const navigation = await renderOferta();

    await fireEvent.changeText(screen.getByPlaceholderText(/When could you help/), 'Hola');
    await fireEvent.press(screen.getByText('Send offer'));

    await waitFor(() => expect(alerta).toHaveBeenCalledWith("Couldn't send your offer", 'No tienes permiso para hacer esto.'));
    expect(navigation.navigate).not.toHaveBeenCalled();
    alerta.mockRestore();
  });

  it('se cierra sin enviar', async () => {
    const navigation = await renderOferta();

    await fireEvent.press(screen.getByLabelText('Close'));

    expect(navigation.goBack).toHaveBeenCalled();
    expect(mockedApi.applyToService).not.toHaveBeenCalled();
  });

  it('sin poder cargar el servicio sigue permitiendo escribir', async () => {
    mockedApi.getService.mockRejectedValueOnce(new Error('offline'));
    await renderOferta();

    expect(screen.getByPlaceholderText(/When could you help/)).toBeTruthy();
  });
});
