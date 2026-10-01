import React from 'react';
import { Alert, Linking } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import MyProfileScreen from '../MyProfileScreen';
import { insignias } from '../../components/insignias';
import { api } from '../../firebase/data';
import { useAuth } from '../../auth/AuthContext';
import { authValue } from '../../test-utils/renderWithAuth';
import { cambiarIdioma, idiomaActual } from '../../i18n';

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
    expect(conseguidas(0)).toEqual(['0 helps']);
    expect(conseguidas(1)).toEqual(['1 help']);
  });

  it.each([
    [10, ['10 helps']],
    [11, ['11 helps', 'Amateur']],
    [25, ['25 helps', 'Amateur']],
    [26, ['26 helps', 'Amateur', 'Veteran']],
    [50, ['50 helps', 'Amateur', 'Veteran']],
    [51, ['51 helps', 'Amateur', 'Veteran', 'Exemplary']],
  ])('con %i ayudas se consiguen %p', (n, esperadas) => {
    expect(conseguidas(n)).toEqual(esperadas);
  });
});

describe('MyProfileScreen', () => {
  it('ya no enseña créditos: se paga en francos o es gratis', async () => {
    await render(<MyProfileScreen />);

    expect(await screen.findByText('Ruben')).toBeTruthy();
    expect(screen.queryByText(/credits/i)).toBeNull();
    expect(screen.queryByText('30')).toBeNull();
  });

  it('ofrece activar los cobros y, si ya están, lo dice', async () => {
    await render(<MyProfileScreen />);
    expect(await screen.findByText('Set up payouts')).toBeTruthy();

    mockedApi.getMe.mockResolvedValue({ ...perfil, cobrosActivos: true } as never);
    await render(<MyProfileScreen />);
    expect(await screen.findByText('✓ Payouts set up')).toBeTruthy();
  });

  it('en ajustes se puede cambiar el idioma de la app', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<MyProfileScreen />);

    await fireEvent.press(screen.getByLabelText('Settings'));
    const cuenta = alerta.mock.calls.at(-1)![2]!;
    await act(async () => cuenta.find((b) => b.text === 'Language')!.onPress!());

    const idiomas = alerta.mock.calls.at(-1)![2]!.map((b) => b.text);
    expect(idiomas).toEqual(['✓ English', 'Deutsch', 'Español', 'Cancel']);
    await act(async () => alerta.mock.calls.at(-1)![2]!.find((b) => b.text === 'Deutsch')!.onPress!());

    expect(idiomaActual()).toBe('de');
    cambiarIdioma('en', { guardar: false });
    alerta.mockRestore();
  });

  it('ayudas y valoración llevan a mi lista de ayudas con sus reseñas', async () => {
    auth = authValue({ user: { uid: 'uid-1' } as never });
    (useAuth as jest.Mock).mockReturnValue(auth);
    await render(<MyProfileScreen />);
    await screen.findByText('Ruben');

    await fireEvent.press(screen.getByLabelText('See my helps'));
    expect(mockNavigate).toHaveBeenLastCalledWith('NeighborList', { userId: 'uid-1', lista: 'helps', nombre: 'Ruben' });

    await fireEvent.press(screen.getByLabelText('See my reviews'));
    expect(mockNavigate).toHaveBeenCalledTimes(2);
  });

  it('sin sesión los enlaces no hacen nada', async () => {
    auth = authValue({ user: null });
    (useAuth as jest.Mock).mockReturnValue(auth);
    await render(<MyProfileScreen />);

    await fireEvent.press(screen.getByLabelText('See my helps'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('la cifra de servicios y las insignias salen de las ayudas reales', async () => {
    mockedApi.countCompletedHelps.mockResolvedValue(12);
    await render(<MyProfileScreen />);

    expect(await screen.findByText('12 helps')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByLabelText('Amateur')).toBeTruthy();
    expect(screen.getByLabelText('Veteran, locked: More than 25 helps')).toBeTruthy();
  });

  it('si no se pueden contar, cero en vez de romperse', async () => {
    mockedApi.countCompletedHelps.mockRejectedValue(new Error('offline'));
    await render(<MyProfileScreen />);

    expect(await screen.findByText('0 helps')).toBeTruthy();
  });

  it('enseña los datos reales del perfil', async () => {
    await render(<MyProfileScreen />);

    expect(await screen.findByText('Ruben')).toBeTruthy();
    expect(screen.getByText('Level 2 · Helpful neighbor')).toBeTruthy();
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

describe('cuenta: ayuda, legal y borrar', () => {
  type Boton = { text?: string; onPress?: (valor?: string) => void };
  let alerta: jest.SpyInstance;
  let abrir: jest.SpyInstance;
  const botones = (): Boton[] => alerta.mock.calls.at(-1)![2];
  const pulsar = async (texto: string, valor?: string) => {
    await act(async () => botones().find((b) => b.text === texto)!.onPress!(valor));
  };

  beforeEach(() => {
    alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });
  afterEach(() => {
    alerta.mockRestore();
    abrir.mockRestore();
  });

  async function abrirAjustes(cambios: object = {}) {
    auth = authValue({ user: { uid: 'uid-1' } as never, ...cambios });
    (useAuth as jest.Mock).mockReturnValue(auth);
    await render(<MyProfileScreen />);
    await fireEvent.press(screen.getByLabelText('Settings'));
  }

  it('ayuda, privacidad y términos abren la web en el idioma de la app', async () => {
    await abrirAjustes();
    await pulsar('Help & legal');

    await pulsar('Help & contact');
    expect(abrir).toHaveBeenLastCalledWith('https://neighborhood-c4dc9.web.app/en/support');
    await pulsar('Privacy policy');
    expect(abrir).toHaveBeenLastCalledWith('https://neighborhood-c4dc9.web.app/en/privacy');
    await pulsar('Terms of use');
    expect(abrir).toHaveBeenLastCalledWith('https://neighborhood-c4dc9.web.app/en/terms');
  });

  it('con email: avisa, pide la contraseña y borra la cuenta', async () => {
    const prompt = jest.spyOn(Alert, 'prompt').mockImplementation(() => {});
    await abrirAjustes({ provider: 'password' });

    await pulsar('Delete account');
    expect(alerta).toHaveBeenLastCalledWith('Delete your account?', expect.stringContaining("can't be undone"), expect.any(Array));
    await pulsar('Delete');

    expect(prompt).toHaveBeenCalledWith('Confirm it’s you', expect.any(String), expect.any(Array), 'secure-text');
    const confirmar = (prompt.mock.calls[0][2] as Boton[]).find((b) => b.text === 'Delete')!;
    await act(async () => confirmar.onPress!('secreto'));

    expect(auth.deleteAccount).toHaveBeenCalledWith('secreto');
    expect(alerta).toHaveBeenLastCalledWith('Your account has been deleted.');
    prompt.mockRestore();
  });

  it('con email y el diálogo vacío manda una contraseña vacía (y Firebase la rechaza)', async () => {
    const prompt = jest.spyOn(Alert, 'prompt').mockImplementation(() => {});
    await abrirAjustes({ provider: 'password' });
    await pulsar('Delete account');
    await pulsar('Delete');
    await act(async () => (prompt.mock.calls[0][2] as Boton[]).find((b) => b.text === 'Delete')!.onPress!());

    expect(auth.deleteAccount).toHaveBeenCalledWith('');
    prompt.mockRestore();
  });

  it('con Apple o Google borra sin pedir contraseña', async () => {
    const prompt = jest.spyOn(Alert, 'prompt');
    await abrirAjustes({ provider: 'apple.com' });
    await pulsar('Delete account');
    await pulsar('Delete');

    expect(prompt).not.toHaveBeenCalled();
    expect(auth.deleteAccount).toHaveBeenCalledWith(undefined);
    prompt.mockRestore();
  });

  it('si cancela en Apple o Google no dice que se borró', async () => {
    await abrirAjustes({ provider: 'google.com', deleteAccount: jest.fn().mockResolvedValue(false) });
    await pulsar('Delete account');
    await pulsar('Delete');

    expect(alerta).not.toHaveBeenCalledWith('Your account has been deleted.');
  });

  it('si falla, explica por qué', async () => {
    const error = Object.assign(new Error('x'), { code: 'auth/requires-recent-login' });
    await abrirAjustes({ provider: 'apple.com', deleteAccount: jest.fn().mockRejectedValue(error) });
    await pulsar('Delete account');
    await pulsar('Delete');

    expect(alerta).toHaveBeenLastCalledWith("Couldn't delete your account", 'For security, sign in again and try once more.');
  });
});
