import * as Notifications from 'expo-notifications';
import { api } from '../../firebase/data';

const N = Notifications as jest.Mocked<typeof Notifications>;
const mockedApi = api as jest.Mocked<typeof api>;

/** El módulo guarda estado (token, último aviso tocado): uno nuevo por test. */
function cargar() {
  let m: typeof import('..');
  jest.isolateModules(() => {
    m = require('..');
  });
  return m!;
}

beforeEach(() => {
  jest.clearAllMocks();
  N.getPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
  N.requestPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
  N.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[test]', type: 'expo' });
  N.getLastNotificationResponseAsync.mockResolvedValue(null);
});

describe('activar avisos', () => {
  it('con permiso, apunta el dispositivo con el idioma de la app', async () => {
    const m = cargar();

    expect(await m.activarAvisos('es')).toBe('ExponentPushToken[test]');
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockedApi.guardarDispositivo).toHaveBeenCalledWith('ExponentPushToken[test]', 'es');
  });

  it('sin permiso aún, lo pide; si lo niegan, no apunta nada', async () => {
    const m = cargar();
    N.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' } as never);
    N.requestPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);

    expect(await m.activarAvisos('en')).toBeNull();
    expect(N.requestPermissionsAsync).toHaveBeenCalled();
    expect(mockedApi.guardarDispositivo).not.toHaveBeenCalled();
  });

  it('si no se puede (simulador, sin red), no rompe', async () => {
    const m = cargar();
    N.getExpoPushTokenAsync.mockRejectedValueOnce(new Error('must use physical device'));

    expect(await m.activarAvisos('de')).toBeNull();
  });

  it('al cerrar sesión olvida este dispositivo, una vez', async () => {
    const m = cargar();
    await m.olvidarEsteDispositivo();
    expect(mockedApi.olvidarDispositivo).not.toHaveBeenCalled();

    await m.activarAvisos('es');
    await m.olvidarEsteDispositivo();
    await m.olvidarEsteDispositivo();
    expect(mockedApi.olvidarDispositivo).toHaveBeenCalledTimes(1);
    expect(mockedApi.olvidarDispositivo).toHaveBeenCalledWith('ExponentPushToken[test]');
  });

  it('sin el módulo nativo (app compilada antes) la app sigue, sin avisos', async () => {
    N.setNotificationHandler.mockImplementationOnce(() => {
      throw new Error("Cannot find native module 'ExpoPushTokenManager'");
    });
    const m = cargar();

    expect(m.avisosDisponibles()).toBe(false);
    expect(await m.activarAvisos('es')).toBeNull();
    expect(m.alTocarAviso(jest.fn())).toEqual(expect.any(Function));
    expect(N.getPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('tocar un aviso', () => {
  const respuesta = (id: string, data: object) => ({ notification: { request: { identifier: id, content: { data } } } });

  it('lleva a su pantalla, también el que abrió la app, y no repite el mismo', async () => {
    const m = cargar();
    N.getLastNotificationResponseAsync.mockResolvedValue(respuesta('a1', { pantalla: 'Chat', serviceId: 's1' }) as never);
    const ir = jest.fn();

    const dejar = m.alTocarAviso(ir);
    await Promise.resolve();
    await Promise.resolve();
    expect(ir).toHaveBeenCalledWith({ pantalla: 'Chat', serviceId: 's1' });

    const alTocar = N.addNotificationResponseReceivedListener.mock.calls[0][0];
    alTocar(respuesta('a1', { pantalla: 'Chat', serviceId: 's1' }) as never);
    alTocar(respuesta('a2', { pantalla: 'Payments' }) as never);
    expect(ir).toHaveBeenCalledTimes(2);
    expect(ir).toHaveBeenLastCalledWith({ pantalla: 'Payments' });
    dejar();
  });
});
