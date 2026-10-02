/**
 * Con los pagos apagados (config/app, para la revisión de Apple) la app no
 * habla de dinero: ni precios, ni cobros, ni pagar al elegir.
 */
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ServiceCard from '../components/ServiceCard';
import ServiceOffersScreen from '../screens/ServiceOffersScreen';
import ServiceDetailScreen from '../screens/ServiceDetailScreen';
import CreateServiceScreen from '../screens/CreateServiceScreen';
import ApplyScreen from '../screens/ApplyScreen';
import { api, type Application } from '../firebase/data';
import { useAuth } from '../auth/AuthContext';
import { authValue } from '../test-utils/renderWithAuth';
import { servicio } from '../test-utils/servicio';
import { perfil } from '../test-utils/perfil';
import { pulsarEnAlerta } from '../test-utils/alerta';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (efecto: () => void) => require('react').useEffect(efecto, []),
}));
jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));

const mockedApi = api as jest.Mocked<typeof api>;
const { __ponerPagos } = require('../config/remota');
const navegacion = () => ({ goBack: jest.fn(), navigate: jest.fn() });

beforeEach(() => {
  jest.clearAllMocks();
  __ponerPagos(false);
  (useAuth as jest.Mock).mockReturnValue(authValue({ user: { uid: 'ana' } as never }));
});
afterAll(() => __ponerPagos(true));

it('la tarjeta no enseña precio ni «gratis»', async () => {
  await render(<ServiceCard service={servicio({ priceCents: 4000 })} />);

  expect(screen.queryByText(/CHF/)).toBeNull();
  expect(screen.queryByText('Free')).toBeNull();
});

it('el detalle no enseña precio ni notas de pago', async () => {
  mockedApi.getService.mockResolvedValue(servicio({ priceCents: 4000, requesterId: 'otra' }));
  await render(<ServiceDetailScreen navigation={navegacion() as never} route={{ params: { serviceId: 's1' } } as never} />);

  await screen.findByText('Pintar una pared');
  expect(screen.queryByText('Price')).toBeNull();
  expect(screen.queryByText(/full price|service fee/)).toBeNull();
});

it('al publicar no se pide precio y se publica gratis', async () => {
  const navigation = navegacion();
  await render(<CreateServiceScreen navigation={navigation as never} route={{ params: {} } as never} />);

  expect(screen.queryByText('Paid')).toBeNull();
  await fireEvent.changeText(screen.getByPlaceholderText('e.g. Need help moving a wardrobe'), 'Subir un sofá');
  await fireEvent.press(screen.getByText('Submit for review'));

  await waitFor(() => expect(mockedApi.createService).toHaveBeenCalledWith(expect.objectContaining({ priceCents: null })));
});

it('un servicio con precio se elige sin pagar', async () => {
  const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockedApi.getService.mockResolvedValue(servicio({ status: 'approved', priceCents: 4000 }));
  const oferta: Application = {
    id: 's1_luis', serviceId: 's1', serviceTitle: 'Pintar', applicantId: 'luis', applicantName: 'Luis', requesterId: 'ana', comment: 'Yo', status: 'pending',
    applicant: perfil({ cobrosActivos: false }),
  };
  mockedApi.listApplicationsForService.mockResolvedValue([oferta]);
  await render(<ServiceOffersScreen navigation={navegacion() as never} route={{ params: { serviceId: 's1' } } as never} />);

  await fireEvent.press(await screen.findByText('Choose'));
  await pulsarEnAlerta(alerta, 'Choose');

  expect(mockedApi.selectApplicant).toHaveBeenCalledWith('s1', 's1_luis');
  expect(mockedApi.pagarOferta).not.toHaveBeenCalled();
  alerta.mockRestore();
});

it('ofrecerse en uno con precio no exige activar cobros', async () => {
  mockedApi.getService.mockResolvedValue(servicio({ title: 'Subir un sofá', priceCents: 4000 }));
  mockedApi.getMe.mockResolvedValue(perfil({ cobrosActivos: false }));
  await render(<ApplyScreen navigation={navegacion() as never} route={{ params: { serviceId: 's1' } } as never} />);

  await screen.findByText('Subir un sofá');
  expect(screen.queryByText('Set up payouts')).toBeNull();
});
