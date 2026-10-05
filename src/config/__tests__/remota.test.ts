import { act, renderHook } from '@testing-library/react-native';

// jest.setup sustituye este módulo por uno de prueba; aquí se prueba el de verdad.
const { cargarConfig, pagosActivos, usePagosActivos } = jest.requireActual('../remota') as typeof import('../remota');

const mockGetDoc = jest.fn();
jest.mock('@firebase/firestore', () => ({ doc: (_db: unknown, ...ruta: string[]) => ruta.join('/'), getDoc: (r: string) => mockGetDoc(r) }));
jest.mock('../../firebase', () => ({ db: {} }));

const config = (datos: object | null) => ({ exists: () => datos !== null, data: () => datos });

describe('configuración remota', () => {
  it('sin leer, o sin documento, los pagos están apagados', async () => {
    expect(pagosActivos()).toBe(false);
    mockGetDoc.mockResolvedValueOnce(config(null));
    await cargarConfig();
    expect(pagosActivos()).toBe(false);
  });

  it('con pagosActivos: true se encienden y los componentes se enteran', async () => {
    const { result } = await renderHook(() => usePagosActivos());
    expect(result.current).toBe(false);

    mockGetDoc.mockResolvedValueOnce(config({ pagosActivos: true }));
    await act(async () => cargarConfig());

    expect(mockGetDoc).toHaveBeenLastCalledWith('config/app');
    expect(pagosActivos()).toBe(true);
    expect(result.current).toBe(true);
  });

  it('cualquier otra cosa no los enciende, y si falla la lectura se queda como estaba', async () => {
    mockGetDoc.mockResolvedValueOnce(config({ pagosActivos: 'sí' }));
    await cargarConfig();
    expect(pagosActivos()).toBe(false);

    mockGetDoc.mockRejectedValueOnce(new Error('sin red'));
    await cargarConfig();
    expect(pagosActivos()).toBe(false);
  });
});
