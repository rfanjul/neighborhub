import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import MyProfileScreen, { insignias } from '../MyProfileScreen';
import { api } from '../../firebase/data';
import { useAuth } from '../../auth/AuthContext';
import { authValue } from '../../test-utils/renderWithAuth';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
  // Sin NavigationContainer no hay foco: se ejecuta el efecto al montar.
  useFocusEffect: (efecto: () => void) => require('react').useEffect(efecto, []),
}));
jest.mock('../../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../components/PhotoCaptureModal', () => {
  const { Pressable, Text } = require('react-native');
  return ({ visible, onCaptured }: { visible: boolean; onCaptured: (uri: string) => Promise<void> }) =>
    visible ? (
      <Pressable accessibilityRole="button" accessibilityLabel="Simular captura" onPress={() => onCaptured('file:///nueva.jpg')}>
        <Text>cámara abierta</Text>
      </Pressable>
    ) : null;
});

const mockedApi = api as jest.Mocked<typeof api>;
const perfil = {
  id: 'uid-1',
  name: 'Ruben',
  level: 2,
  levelLabel: 'Helpful neighbor',
  credits: 30,
  servicesCompleted: 4,
  rating: 4.9,
  responseLabel: '< 1 h',
  bio: 'Me gusta ayudar',
  photoURL: null,
};

let auth: ReturnType<typeof authValue>;

beforeEach(() => {
  jest.clearAllMocks();
  auth = authValue();
  (useAuth as jest.Mock).mockReturnValue(auth);
  mockedApi.getMe.mockResolvedValue(perfil as never);
});

describe('insignias', () => {
  const conseguidas = (n: number) => insignias(n).filter((b) => b.conseguida).map((b) => b.titulo);

  it('el contador de ayudas siempre está', () => {
    expect(conseguidas(0)).toEqual(['0 ayudas']);
    expect(conseguidas(1)).toEqual(['1 ayuda']);
  });

  it.each([
    [10, ['10 ayudas']],
    [11, ['11 ayudas', 'Amateur']],
    [25, ['25 ayudas', 'Amateur']],
    [26, ['26 ayudas', 'Amateur', 'Veterano']],
    [50, ['50 ayudas', 'Amateur', 'Veterano']],
    [51, ['51 ayudas', 'Amateur', 'Veterano', 'Ejemplar']],
  ])('con %i ayudas se consiguen %p', (n, esperadas) => {
    expect(conseguidas(n)).toEqual(esperadas);
  });
});

describe('MyProfileScreen', () => {
  it('la cifra de servicios y las insignias salen de las ayudas reales', async () => {
    mockedApi.countCompletedHelps.mockResolvedValue(12);
    await render(<MyProfileScreen />);

    expect(await screen.findByText('12 ayudas')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByLabelText('Amateur')).toBeTruthy();
    expect(screen.getByLabelText('Veterano, locked: Más de 25 ayudas')).toBeTruthy();
  });

  it('si no se pueden contar, cero en vez de romperse', async () => {
    mockedApi.countCompletedHelps.mockRejectedValue(new Error('offline'));
    await render(<MyProfileScreen />);

    expect(await screen.findByText('0 ayudas')).toBeTruthy();
  });

  it('enseña los datos reales del perfil', async () => {
    await render(<MyProfileScreen />);

    expect(await screen.findByText('Ruben')).toBeTruthy();
    expect(screen.getByText('Level 2 · Helpful neighbor')).toBeTruthy();
    expect(screen.getByText('30')).toBeTruthy();
    expect(screen.getByText('4.9 ★')).toBeTruthy();
  });

  it('si Firestore no responde vuelve a los datos de ejemplo sin romperse', async () => {
    mockedApi.getMe.mockRejectedValue(new Error('offline'));
    await render(<MyProfileScreen />);

    await waitFor(() => expect(mockedApi.getMe).toHaveBeenCalled());
    expect(screen.getByText('Profile')).toBeTruthy();
  });

  it('desde ajustes se editan los datos', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<MyProfileScreen />);

    await fireEvent.press(screen.getByLabelText('Settings'));
    const botones = alerta.mock.calls[0][2]!;
    botones.find((b) => b.text === 'Edit my details')!.onPress!();

    expect(mockNavigate).toHaveBeenCalledWith('ProfileDetails');
    alerta.mockRestore();
  });

  it('desde ajustes se cierra la sesión', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<MyProfileScreen />);

    await fireEvent.press(screen.getByLabelText('Settings'));
    alerta.mock.calls[0][2]!.find((b) => b.text === 'Log out')!.onPress!();

    expect(auth.logout).toHaveBeenCalled();
    alerta.mockRestore();
  });

  it('cambia la foto tocando el avatar', async () => {
    mockedApi.uploadMyPhoto.mockResolvedValue({ ...perfil, photoURL: 'https://ej/avatar.jpg' } as never);
    await render(<MyProfileScreen />);

    await fireEvent.press(screen.getByLabelText('Change photo'));
    await act(async () => {
      await fireEvent.press(screen.getByLabelText('Simular captura'));
    });

    expect(mockedApi.uploadMyPhoto).toHaveBeenCalledWith('file:///nueva.jpg');
  });
});
