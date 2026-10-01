import React from 'react';
import { Animated, Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Degradado from '../Degradado';
import FotoCabecera from '../FotoCabecera';
import LogoMark from '../LogoMark';
import PantallaConFoto from '../PantallaConFoto';

describe('Degradado', () => {
  it('no dibuja nada hasta conocer su tamaño y luego rellena el hueco', async () => {
    await render(<Degradado id="x" paradas={[{ en: 0, color: '#000' }, { en: 1, color: '#fff', opacidad: 0.5 }]} />);
    const hueco = screen.getByTestId('degradado-x');
    expect(hueco.children).toHaveLength(0);

    await fireEvent(hueco, 'layout', { nativeEvent: { layout: { width: 300, height: 200 } } });

    expect(screen.getByTestId('degradado-x').children.length).toBeGreaterThan(0);
  });
});

describe('LogoMark', () => {
  it('se anuncia como la marca', async () => {
    await render(<LogoMark />);
    expect(screen.getByLabelText('Neighborhub')).toBeTruthy();
  });

  it('con late, el corazón late en bucle y para al desmontarse', async () => {
    const stop = jest.fn();
    const start = jest.fn();
    const loop = jest.spyOn(Animated, 'loop').mockReturnValue({ start, stop, reset: jest.fn() } as never);

    const vista = await render(<LogoMark late variante="blanca" />);
    expect(start).toHaveBeenCalled();
    await vista.unmount();
    expect(stop).toHaveBeenCalled();
    loop.mockRestore();
  });
});

describe('FotoCabecera', () => {
  it('enseña título y subtítulo, y el botón de volver solo si se pide', async () => {
    const onBack = jest.fn();
    const vista = await render(<FotoCabecera foto="https://x/y.jpg" titulo="Hola" subtitulo="Qué tal" onBack={onBack} />);
    expect(screen.getByText('Hola')).toBeTruthy();
    expect(screen.getByText('Qué tal')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(onBack).toHaveBeenCalled();

    await vista.rerender(<FotoCabecera foto="https://x/y.jpg" titulo="Hola" subtitulo="Qué tal" />);
    expect(screen.queryByLabelText('Back')).toBeNull();
  });
});

describe('PantallaConFoto', () => {
  it('pone el formulario debajo de la foto', async () => {
    await render(
      <PantallaConFoto foto="https://x/y.jpg" titulo="Entrar" subtitulo="Hola">
        <Text>formulario</Text>
      </PantallaConFoto>
    );
    expect(screen.getByText('Entrar')).toBeTruthy();
    expect(screen.getByText('formulario')).toBeTruthy();
  });
});
