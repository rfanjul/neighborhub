import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import PagoFila from '../PagoFila';
import { pago } from '../../test-utils/pago';

describe('PagoFila', () => {
  it.each([
    [pago({ estado: 'pendiente' }), /^−CHF\s43\.20$/, 'Not completed', 'to Luis'],
    [pago({ estado: 'retenido' }), /^−CHF\s43\.20$/, 'Paid · held until done', 'to Luis'],
    [pago({ estado: 'pagado' }), /^−CHF\s43\.20$/, 'Paid to Luis', 'to Luis'],
    [pago({ rol: 'cobrado', estado: 'retenido', importe: 4000, otraPersona: 'Ana' }), /^\+CHF\s40\.00$/, "You'll get it when it's done", 'from Ana'],
    [pago({ rol: 'cobrado', estado: 'pagado', importe: 4000, otraPersona: 'Ana' }), /^\+CHF\s40\.00$/, 'Received', 'from Ana'],
    [pago({ estado: 'reembolsado' }), /^−CHF\s43\.20$/, 'Refunded', 'to Luis'],
    [pago({ estado: 'error' }), /^−CHF\s43\.20$/, "Payment issue · we're on it", 'to Luis'],
    [pago({ rol: 'cobrado', estado: 'reembolsado', importe: 4000, otraPersona: 'Ana' }), /^\+CHF\s40\.00$/, 'Cancelled · refunded', 'from Ana'],
  ])('%#: importe con signo, estado y con quién', async (p, importe, estado, quien) => {
    await render(<PagoFila pago={p} />);

    expect(screen.getByText('Subir un sofá')).toBeTruthy();
    expect(screen.getByText(importe)).toBeTruthy();
    expect(screen.getByText(estado)).toBeTruthy();
    expect(screen.getByText(new RegExp(`^${quien} · Oct 1, 2026$`))).toBeTruthy();
  });

  it('sin título ni fecha no rompe', async () => {
    await render(<PagoFila pago={pago({ titulo: '', fecha: 0, otraPersona: '' })} />);

    expect(screen.getByText('Request')).toBeTruthy();
  });

  it('se puede tocar', async () => {
    const onPress = jest.fn();
    await render(<PagoFila pago={pago()} onPress={onPress} />);

    await fireEvent.press(screen.getByText('Subir un sofá'));
    expect(onPress).toHaveBeenCalled();
  });
});
