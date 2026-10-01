import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import * as iconos from '..';
import Chip from '../../components/Chip';
import PillButton from '../../components/PillButton';
import CategoryIcon from '../../components/CategoryIcon';

// Los iconos son SVG sin lógica: basta con que todos se pinten sin romper,
// con los valores por defecto y con tamaño y color propios.
describe('iconos', () => {
  const componentes = Object.entries(iconos).filter(([, v]) => typeof v === 'function') as [string, React.FC<any>][];

  it('hay iconos exportados', () => {
    expect(componentes.length).toBeGreaterThan(10);
  });

  it.each(componentes)('%s se pinta', async (_nombre, Icono) => {
    await render(<Icono />);
    await render(<Icono size={32} color="#DD6B3E" strokeWidth={2} />);
  });
});

describe('componentes básicos', () => {
  it('Chip enseña su texto', async () => {
    const { getByText } = await render(<Chip label="Painting" background="#fff" color="#000" />);
    expect(getByText('Painting')).toBeTruthy();
  });

  it('PillButton responde al toque', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(<PillButton label="Save" onPress={onPress} />);
    await fireEvent.press(getByText('Save'));
    expect(onPress).toHaveBeenCalled();
  });

  it.each(['primary', 'dark', 'outline'] as const)('PillButton en variante %s, con icono', async (variant) => {
    const { getByText } = await render(
      <PillButton label="Save" onPress={jest.fn()} variant={variant} icon={<iconos.PlusIcon />} />
    );
    expect(getByText('Save')).toBeTruthy();
  });

  it.each(['moving', 'painting', 'dog', 'groceries', 'other'] as const)('CategoryIcon pinta %s', async (categoria) => {
    await render(<CategoryIcon category={categoria} />);
  });
});
