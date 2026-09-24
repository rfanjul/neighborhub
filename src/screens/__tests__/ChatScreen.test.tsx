import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ChatScreen from '../ChatScreen';
import { api, type ChatMessage } from '../../firebase/data';
import { useAuth } from '../../auth/AuthContext';
import { authValue } from '../../test-utils/renderWithAuth';
import { servicio } from '../../test-utils/servicio';

jest.mock('../../auth/AuthContext', () => ({ useAuth: jest.fn() }));

const mockedApi = api as jest.Mocked<typeof api>;
let entregar: (mensajes: ChatMessage[]) => void = () => {};
let fallar: (e: Error) => void = () => {};
const dejarDeEscuchar = jest.fn();

async function renderChat(uid = 'ana') {
  (useAuth as jest.Mock).mockReturnValue(authValue({ user: { uid } as never }));
  const navigation = { goBack: jest.fn() };
  const vista = await render(<ChatScreen navigation={navigation as never} route={{ params: { serviceId: 's1' } } as never} />);
  return { navigation, vista };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.getService.mockResolvedValue(servicio({ status: 'accepted', requesterId: 'ana', helperId: 'luis', helperName: 'Luis' }));
  mockedApi.subscribeMessages.mockImplementation((_id, onMessages, onError) => {
    entregar = onMessages;
    fallar = onError!;
    return dejarDeEscuchar;
  });
});

describe('ChatScreen', () => {
  it('quien publicó habla con quien ayuda', async () => {
    await renderChat('ana');

    expect(await screen.findByText('Luis')).toBeTruthy();
    expect(screen.getByText('Re: Pintar una pared')).toBeTruthy();
  });

  it('quien ayuda habla con quien publicó', async () => {
    await renderChat('luis');

    expect(await screen.findByText('Ana')).toBeTruthy();
  });

  it('pinta los mensajes según van llegando', async () => {
    await renderChat();

    await act(async () =>
      entregar([
        { id: 'm1', senderId: 'ana', senderName: 'Ana', fromMe: true, text: 'Hola Luis' },
        { id: 'm2', senderId: 'luis', senderName: 'Luis', fromMe: false, text: '¿El sábado?' },
      ])
    );

    expect(screen.getByText('Hola Luis')).toBeTruthy();
    expect(screen.getByText('¿El sábado?')).toBeTruthy();
  });

  it('invita a empezar si aún no hay mensajes', async () => {
    await renderChat();

    await act(async () => entregar([]));

    expect(screen.getByText(/Say hi/)).toBeTruthy();
  });

  it('envía el mensaje sin espacios de sobra y limpia la caja', async () => {
    await renderChat();

    await fireEvent.changeText(screen.getByPlaceholderText('Message...'), '  Nos vemos a las 10  ');
    await fireEvent.press(screen.getByLabelText('Send'));

    await waitFor(() => expect(mockedApi.sendMessage).toHaveBeenCalledWith('s1', 'Nos vemos a las 10'));
    expect(screen.getByPlaceholderText('Message...').props.value).toBe('');
  });

  it('no envía mensajes vacíos', async () => {
    await renderChat();

    await fireEvent.changeText(screen.getByPlaceholderText('Message...'), '   ');
    await fireEvent.press(screen.getByLabelText('Send'));

    expect(mockedApi.sendMessage).not.toHaveBeenCalled();
  });

  it('si no se puede enviar, recupera el texto y avisa', async () => {
    mockedApi.sendMessage.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'unavailable' }));
    await renderChat();

    await fireEvent.changeText(screen.getByPlaceholderText('Message...'), 'Hola');
    await fireEvent.press(screen.getByLabelText('Send'));

    await waitFor(() => expect(screen.getByPlaceholderText('Message...').props.value).toBe('Hola'));
    expect(screen.getByText(/No se pudo conectar/)).toBeTruthy();
  });

  it('sin oferta elegida explica por qué no hay chat', async () => {
    await renderChat('marta');

    await act(async () => fallar(Object.assign(new Error('denied'), { code: 'permission-denied' })));

    expect(screen.getByText('The chat opens once an offer has been selected.')).toBeTruthy();
  });

  it('deja de escuchar al salir', async () => {
    const { vista } = await renderChat();

    await vista.unmount();

    expect(dejarDeEscuchar).toHaveBeenCalled();
  });
});
