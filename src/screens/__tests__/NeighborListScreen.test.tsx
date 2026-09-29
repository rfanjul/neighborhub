import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import NeighborListScreen from '../NeighborListScreen';
import { api } from '../../firebase/data';
import { servicio } from '../../test-utils/servicio';
import { resena } from '../../test-utils/perfil';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (efecto: () => void) => require('react').useEffect(efecto, []),
}));

const mockedApi = api as jest.Mocked<typeof api>;

async function renderLista(lista: 'helps' | 'services') {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  await render(
    <NeighborListScreen navigation={navigation as never} route={{ params: { userId: 'luis', lista, nombre: 'Luis' } } as never} />
  );
  return navigation;
}

beforeEach(() => jest.clearAllMocks());

describe('NeighborListScreen · ayudas', () => {
  it('cada ayuda con su servicio, estrellas, fecha, comentario y quién la valoró', async () => {
    mockedApi.listReviewsFor.mockResolvedValue([
      resena({ serviceId: 'a', serviceTitle: 'Move table', rating: 5, comment: 'Genial', reviewerName: 'Ana' }),
      resena({ serviceId: 'b', serviceTitle: '', rating: 3, comment: '', reviewerName: 'Eva', createdAt: 0 }),
    ]);
    await renderLista('helps');

    expect(await screen.findByText("Luis's helps")).toBeTruthy();
    expect(mockedApi.listReviewsFor).toHaveBeenCalledWith('luis');
    expect(screen.getByText("2 helps, with the neighbor's review")).toBeTruthy();
    expect(screen.getByText('Move table')).toBeTruthy();
    expect(screen.getByLabelText('5 out of 5 stars')).toBeTruthy();
    expect(screen.getByText('Sep 2026')).toBeTruthy();
    expect(screen.getByText('“Genial”')).toBeTruthy();
    expect(screen.getByText('by Ana')).toBeTruthy();
    // Sin título ni fecha ni comentario no deja huecos raros.
    expect(screen.getByText('Help')).toBeTruthy();
    expect(screen.getAllByText(/Sep 2026/)).toHaveLength(1);
    expect(screen.getByText('by Eva')).toBeTruthy();
  });

  it('una sola ayuda en singular', async () => {
    mockedApi.listReviewsFor.mockResolvedValue([resena()]);
    await renderLista('helps');

    expect(await screen.findByText("1 help, with the neighbor's review")).toBeTruthy();
  });

  it('sin ayudas lo dice', async () => {
    mockedApi.listReviewsFor.mockResolvedValue([]);
    await renderLista('helps');

    expect(await screen.findByText("Luis hasn't completed any helps yet.")).toBeTruthy();
  });

  it('si falla, explica por qué', async () => {
    mockedApi.listReviewsFor.mockRejectedValue(Object.assign(new Error('x'), { code: 'permission-denied' }));
    await renderLista('helps');

    expect(await screen.findByText("You don't have permission to do this.")).toBeTruthy();
  });
});

describe('NeighborListScreen · servicios', () => {
  it('sus servicios abiertos, y cada uno lleva a su detalle', async () => {
    mockedApi.listServicesBy.mockResolvedValue([servicio({ id: 'x1', title: 'Paint the door' })]);
    const navigation = await renderLista('services');

    expect(await screen.findByText("Luis's services")).toBeTruthy();
    expect(screen.getByText('1 open service')).toBeTruthy();
    await fireEvent.press(screen.getByText('Paint the door'));

    expect(navigation.navigate).toHaveBeenCalledWith('ServiceDetail', { serviceId: 'x1' });
  });

  it('sin servicios lo dice', async () => {
    mockedApi.listServicesBy.mockResolvedValue([]);
    await renderLista('services');

    expect(await screen.findByText('Luis has no open services right now.')).toBeTruthy();
    expect(screen.getByText('0 open services')).toBeTruthy();
  });

  it('mientras carga no enseña la cuenta', async () => {
    mockedApi.listServicesBy.mockReturnValue(new Promise(() => {}));
    await renderLista('services');

    expect(screen.getByText("Luis's services")).toBeTruthy();
    expect(screen.queryByText(/open service/)).toBeNull();
  });

  it('vuelve atrás', async () => {
    mockedApi.listServicesBy.mockResolvedValue([]);
    const navigation = await renderLista('services');

    await fireEvent.press(screen.getByLabelText('Back'));

    expect(navigation.goBack).toHaveBeenCalled();
  });
});
