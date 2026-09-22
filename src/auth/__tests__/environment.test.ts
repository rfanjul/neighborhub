// El valor se calcula al importar el módulo, así que cada caso necesita un
// registro de módulos limpio.
describe('isExpoGo', () => {
  beforeEach(() => jest.resetModules());

  function loadWith(executionEnvironment: string) {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { executionEnvironment },
      ExecutionEnvironment: { Bare: 'bare', Standalone: 'standalone', StoreClient: 'storeClient' },
    }));
    return require('../environment').isExpoGo as boolean;
  }

  it('es true dentro de Expo Go', () => {
    expect(loadWith('storeClient')).toBe(true);
  });

  it('es false en un development build', () => {
    expect(loadWith('bare')).toBe(false);
  });

  it('es false en una app compilada para la store', () => {
    expect(loadWith('standalone')).toBe(false);
  });
});
