import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import BlockedScreen from '../BlockedScreen';
import { api } from '../../firebase/data';
import { perfil } from '../../test-utils/perfil';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (efecto: () => void) => require('react').useEffect(efecto, []),
}));

const mockedApi = api as jest.Mocked<typeof api>;

async function renderBloqueados() {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  await render(<BlockedScreen navigation={navigation as never} route={{} as never} />);
  return navigation;
}

beforeEach(() => jest.clearAllMocks());

describe('BlockedScreen', () => {
  it('lista los bloqueados y deja desbloquearlos', async () => {
    mockedApi.misBloqueos.mockResolvedValueOnce(['luis', 'borrado']).mockResolvedValueOnce(['borrado']);
    mockedApi.getUserProfile.mockImplementation(async (uid) => (uid === 'luis' ? perfil() : null));
    await renderBloqueados();

    expect(await screen.findByText('Luis')).toBeTruthy();
    expect(screen.getByText('Neighbor')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Unblock Luis'));

    await waitFor(() => expect(mockedApi.desbloquear).toHaveBeenCalledWith('luis'));
    await waitFor(() => expect(screen.queryByText('Luis')).toBeNull());
  });

  it('sin bloqueados lo dice', async () => {
    mockedApi.misBloqueos.mockResolvedValueOnce([]);
    await renderBloqueados();

    expect(await screen.findByText("You haven't blocked anyone.")).toBeTruthy();
  });

  it('si no se puede cargar, lo explica; y vuelve atrás', async () => {
    mockedApi.misBloqueos.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'unavailable' }));
    const navigation = await renderBloqueados();

    expect(await screen.findByText(/server/i)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
