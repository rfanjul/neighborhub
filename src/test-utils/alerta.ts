import { act } from '@testing-library/react-native';
import type { AlertButton } from 'react-native';

/** Pulsa el botón con ese texto del último Alert abierto (espiado con jest.spyOn). */
export async function pulsarEnAlerta(alerta: jest.SpyInstance, texto: string) {
  const botones = (alerta.mock.calls.at(-1)?.[2] ?? []) as AlertButton[];
  const boton = botones.find((b) => b.text === texto);
  if (!boton) throw new Error(`No hay botón «${texto}» en: ${botones.map((b) => b.text).join(', ')}`);
  await act(async () => {
    await boton.onPress?.();
  });
}
