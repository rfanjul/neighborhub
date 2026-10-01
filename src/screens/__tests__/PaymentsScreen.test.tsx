import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import PaymentsScreen from '../PaymentsScreen';
import { api } from '../../firebase/data';
import { pago } from '../../test-utils/pago';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (efecto: () => void) => require('react').useEffect(efecto, []),
}));

const mockedApi = api as jest.Mocked<typeof api>;

async function renderPagos() {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  await render(<PaymentsScreen navigation={navigation as never} route={{} as never} />);
  return navigation;
}

beforeEach(() => jest.clearAllMocks());

describe('PaymentsScreen', () => {
  it('lista pagos y cobros; un pago abre sus ofertas y un cobro su detalle', async () => {
    mockedApi.misPagos.mockResolvedValue([
      pago(),
      pago({ serviceId: 's2', rol: 'cobrado', estado: 'pagado', importe: 2000, titulo: 'Pasear a Toby', otraPersona: 'Mia' }),
    ]);
    const navigation = await renderPagos();

    await fireEvent.press(await screen.findByText('Subir un sofá'));
    expect(navigation.navigate).toHaveBeenCalledWith('ServiceOffers', { serviceId: 's1' });
    await fireEvent.press(screen.getByText('Pasear a Toby'));
    expect(navigation.navigate).toHaveBeenCalledWith('ServiceDetail', { serviceId: 's2' });
  });

  it('sin pagos lo explica', async () => {
    mockedApi.misPagos.mockResolvedValue([]);
    await renderPagos();

    expect(await screen.findByText(/No payments yet/)).toBeTruthy();
  });

  it('si no se pueden cargar, lo dice', async () => {
    mockedApi.misPagos.mockRejectedValueOnce(new Error('sin red'));
    await renderPagos();

    expect(await screen.findByText(/Couldn't reach the payment system/)).toBeTruthy();
  });

  it('vuelve atrás', async () => {
    const navigation = await renderPagos();

    await fireEvent.press(screen.getByLabelText('Back'));
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
