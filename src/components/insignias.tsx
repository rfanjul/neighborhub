import React from 'react';
import { colors } from '../theme';
import { BadgeStarIcon, BadgeVeteranIcon, BadgeExemplaryIcon } from '../icons';

export type Insignia = {
  clave: string;
  titulo: string;
  requisito: string;
  conseguida: boolean;
  icono: React.ReactNode;
  fondo: string;
};

/**
 * Insignias según las ayudas completadas: el contador siempre, y Amateur,
 * Veterano y Ejemplar al superar 10, 25 y 50.
 */
export function insignias(ayudas: number): Insignia[] {
  return [
    {
      clave: 'ayudas',
      titulo: ayudas === 1 ? '1 ayuda' : `${ayudas} ayudas`,
      requisito: '',
      conseguida: true,
      icono: <BadgeStarIcon size={22} />,
      fondo: colors.amberTint,
    },
    {
      clave: 'amateur',
      titulo: 'Amateur',
      requisito: 'Más de 10 ayudas',
      conseguida: ayudas > 10,
      icono: <BadgeStarIcon size={22} />,
      fondo: colors.accentTint,
    },
    {
      clave: 'veterano',
      titulo: 'Veterano',
      requisito: 'Más de 25 ayudas',
      conseguida: ayudas > 25,
      icono: <BadgeVeteranIcon size={22} />,
      fondo: colors.blueTint,
    },
    {
      clave: 'ejemplar',
      titulo: 'Ejemplar',
      requisito: 'Más de 50 ayudas',
      conseguida: ayudas > 50,
      icono: <BadgeExemplaryIcon size={22} />,
      fondo: colors.greenTint,
    },
  ];
}
