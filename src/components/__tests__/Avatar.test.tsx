import React from 'react';
import { render, screen } from '@testing-library/react-native';
import Avatar from '../Avatar';

describe('Avatar', () => {
  it('enseña la foto si la hay', async () => {
    await render(<Avatar name="Ana" photoURL="https://ej/ana.jpg" />);

    expect(screen.getByLabelText('Foto de Ana').props.source).toEqual({ uri: 'https://ej/ana.jpg' });
  });

  it('sin foto, la inicial en mayúscula', async () => {
    await render(<Avatar name="  luis" photoURL={null} />);

    expect(screen.getByText('L')).toBeTruthy();
  });

  it('sin nombre no rompe', async () => {
    await render(<Avatar name="" photoURL={null} />);

    expect(screen.getByText('?')).toBeTruthy();
  });
});
