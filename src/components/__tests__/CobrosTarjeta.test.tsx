import React from 'react';
import { Alert, AppState, Linking } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import CobrosTarjeta from '../CobrosTarjeta';
import { api } from '../../firebase/data';

const mockedApi = api as jest.Mocked<typeof api>;
let alCambiar: (estado: string) => void;
let abrir: jest.SpyInstance;
let suscribir: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  alCambiar = () => {};
  suscribir = jest.spyOn(AppState, 'addEventListener').mockImplementation((_evento, f) => {
    alCambiar = f as never;
    return { remove: jest.fn() } as never;
  });
  abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});
afterEach(() => {
  suscribir.mockRestore();
  abrir.mockRestore();
});

describe('CobrosTarjeta', () => {
  it('ya activos lo dice y no ofrece nada más', async () => {
    await render(<CobrosTarjeta activos onCambio={jest.fn()} />);

    expect(screen.getByText('✓ Payouts set up')).toBeTruthy();
    expect(screen.queryByText('Set up payouts')).toBeNull();
  });

  it('activar abre el formulario de Stripe y, al volver a la app, pregunta si ya está', async () => {
    const onCambio = jest.fn();
    await render(<CobrosTarjeta activos={false} onCambio={onCambio} />);

    await fireEvent.press(screen.getByText('Set up payouts'));
    await waitFor(() => expect(abrir).toHaveBeenCalledWith('https://accounts.stripe.com/r/acct_test'));

    await act(async () => alCambiar('active'));
    expect(mockedApi.estadoCobros).toHaveBeenCalledTimes(1);
    expect(onCambio).toHaveBeenCalledWith(true);

    // Solo una vez por cada viaje a Stripe.
    await act(async () => alCambiar('active'));
    expect(mockedApi.estadoCobros).toHaveBeenCalledTimes(1);
  });

  it('volver a la app sin haber ido a Stripe no pregunta nada', async () => {
    await render(<CobrosTarjeta activos={false} onCambio={jest.fn()} />);

    await act(async () => alCambiar('active'));

    expect(mockedApi.estadoCobros).not.toHaveBeenCalled();
  });

  it('si no se puede abrir Stripe, lo explica', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockedApi.activarCobros.mockRejectedValueOnce(new Error('sin red'));
    await render(<CobrosTarjeta activos={false} onCambio={jest.fn()} />);

    await fireEvent.press(screen.getByText('Set up payouts'));

    await waitFor(() =>
      expect(alerta).toHaveBeenCalledWith("Couldn't open Stripe", "Couldn't reach the payment system. Try again in a moment.")
    );
    expect(abrir).not.toHaveBeenCalled();
    alerta.mockRestore();
  });
});
