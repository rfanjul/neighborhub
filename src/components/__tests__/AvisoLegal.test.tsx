import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import AvisoLegal from '../AvisoLegal';
import { cambiarIdioma } from '../../i18n';
import { abrirEnlace, enlaces } from '../../config/enlaces';

afterEach(() => cambiarIdioma('en', { guardar: false }));

it('enlaza a los términos y a la privacidad en el idioma de la app', async () => {
  const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  cambiarIdioma('de', { guardar: false });
  await render(<AvisoLegal />);

  expect(screen.getByText(/akzeptierst du unsere Nutzungsbedingungen/)).toBeTruthy();
  await fireEvent.press(screen.getByText('Nutzungsbedingungen'));
  expect(abrir).toHaveBeenLastCalledWith('https://neighborhood-c4dc9.web.app/de/terms');
  await fireEvent.press(screen.getByText('Datenschutzerklärung'));
  expect(abrir).toHaveBeenLastCalledWith('https://neighborhood-c4dc9.web.app/de/privacy');
  abrir.mockRestore();
});

it('el contacto sin referencia solo lleva el tipo', () => {
  cambiarIdioma('es', { guardar: false });
  expect(enlaces.contacto('pregunta')).toBe('https://neighborhood-c4dc9.web.app/es/support?origen=app&tipo=pregunta#contacto');
});

it('si no se puede abrir el enlace no rompe', async () => {
  const abrir = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('sin navegador'));
  expect(() => abrirEnlace('https://x')).not.toThrow();
  await Promise.resolve();
  abrir.mockRestore();
});
