import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import RateHelperScreen from '../RateHelperScreen';
import { api } from '../../firebase/data';
import { servicio } from '../../test-utils/servicio';

const mockedApi = api as jest.Mocked<typeof api>;

async function renderValorar() {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  await render(<RateHelperScreen navigation={navigation as never} route={{ params: { serviceId: 's1' } } as never} />);
  return navigation;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.getService.mockResolvedValue(
    servicio({ title: 'Move table', status: 'accepted', helperId: 'luis', helperName: 'Luis' })
  );
  mockedApi.getUserProfile.mockResolvedValue({
    id: 'luis', name: 'Luis Pérez', photoURL: 'https://example.com/luis.png',
  } as never);
});

describe('RateHelperScreen', () => {
  it('pregunta por quien ayudó, con su foto y el servicio', async () => {
    await renderValorar();

    expect(await screen.findByText('How did Luis Pérez help you?')).toBeTruthy();
    expect(screen.getByText('Move table')).toBeTruthy();
    expect(screen.getByLabelText('Photo of Luis Pérez')).toBeTruthy();
    expect(screen.getByText('Tap to rate')).toBeTruthy();
  });

  it('sin perfil legible se queda con el nombre del servicio', async () => {
    mockedApi.getUserProfile.mockRejectedValueOnce(new Error('sin red'));
    await renderValorar();

    expect(await screen.findByText('How did Luis help you?')).toBeTruthy();
  });

  it('sin ayudante apuntado no busca perfil', async () => {
    mockedApi.getService.mockResolvedValueOnce(servicio({ title: 'Move table', status: 'accepted', helperId: null, helperName: null }));
    await renderValorar();

    expect(await screen.findByText('How did your helper help you?')).toBeTruthy();
    expect(mockedApi.getUserProfile).not.toHaveBeenCalled();
  });

  it('si el servicio no carga, deja valorar igualmente', async () => {
    mockedApi.getService.mockRejectedValueOnce(new Error('sin red'));
    await renderValorar();

    expect(await screen.findByText('Complete and rate')).toBeTruthy();
    expect(screen.queryByText(/How did/)).toBeNull();
  });

  it('las estrellas marcan la nota y su nombre', async () => {
    await renderValorar();

    await fireEvent.press(await screen.findByLabelText('4 stars'));
    expect(screen.getByText('Very good')).toBeTruthy();
    expect(screen.getByLabelText('4 stars').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText('5 stars').props.accessibilityState).toMatchObject({ selected: false });

    await fireEvent.press(screen.getByLabelText('1 star'));
    expect(screen.getByText('Poor')).toBeTruthy();
  });

  it('sin estrellas no se envía', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderValorar();

    await fireEvent.press(await screen.findByText('Complete and rate'));

    expect(alerta).toHaveBeenCalledWith('Choose a rating', expect.any(String));
    expect(mockedApi.rateHelper).not.toHaveBeenCalled();
    alerta.mockRestore();
  });

  it('envía la nota con el comentario y vuelve a las ofertas', async () => {
    const navigation = await renderValorar();

    await fireEvent.press(await screen.findByLabelText('5 stars'));
    await fireEvent.changeText(screen.getByPlaceholderText(/Tell others/), 'Muy puntual');
    expect(screen.getByText('11/500')).toBeTruthy();
    await fireEvent.press(screen.getByText('Complete and rate'));

    await waitFor(() => expect(mockedApi.rateHelper).toHaveBeenCalledWith('s1', 5, 'Muy puntual'));
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('avisa si no se pudo guardar y se queda en la pantalla', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockedApi.rateHelper.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'permission-denied' }));
    const navigation = await renderValorar();

    await fireEvent.press(await screen.findByLabelText('3 stars'));
    await fireEvent.press(screen.getByText('Complete and rate'));

    await waitFor(() => expect(alerta).toHaveBeenCalledWith("Couldn't save your rating", "You don't have permission to do this."));
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(screen.getByText('Complete and rate')).toBeTruthy();
    alerta.mockRestore();
  });

  it('se cierra sin valorar', async () => {
    const navigation = await renderValorar();

    await fireEvent.press(screen.getByLabelText('Close'));

    expect(navigation.goBack).toHaveBeenCalled();
    expect(mockedApi.rateHelper).not.toHaveBeenCalled();
  });
});
