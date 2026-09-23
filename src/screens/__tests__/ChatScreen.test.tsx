import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ChatScreen from '../ChatScreen';

describe('ChatScreen', () => {
  it('enseña la conversación', async () => {
    await render(<ChatScreen />);

    expect(screen.getByText('Lena K.')).toBeTruthy();
    expect(screen.getByText(/Saturday morning/)).toBeTruthy();
  });

  it('envía un mensaje y limpia la caja', async () => {
    await render(<ChatScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('Message...'), '  ¿A las 10 entonces?  ');
    await fireEvent.press(screen.getByLabelText('Send'));

    expect(screen.getByText('¿A las 10 entonces?')).toBeTruthy();
    expect(screen.getByPlaceholderText('Message...').props.value).toBe('');
  });

  it('no envía mensajes vacíos', async () => {
    await render(<ChatScreen />);
    const antes = screen.getAllByText(/./).length;

    await fireEvent.changeText(screen.getByPlaceholderText('Message...'), '   ');
    await fireEvent.press(screen.getByLabelText('Send'));

    expect(screen.getAllByText(/./).length).toBe(antes);
  });
});
