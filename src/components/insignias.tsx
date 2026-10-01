import React from 'react';
import { colors } from '../theme';
import { BadgeStarIcon, BadgeVeteranIcon, BadgeExemplaryIcon } from '../icons';
import { t, tp } from '../i18n';

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
      titulo: tp('comun.ayudas', ayudas),
      requisito: '',
      conseguida: true,
      icono: <BadgeStarIcon size={22} />,
      fondo: colors.amberTint,
    },
    {
      clave: 'amateur',
      titulo: t('insignias.amateur'),
      requisito: t('insignias.requisito', { n: 10 }),
      conseguida: ayudas > 10,
      icono: <BadgeStarIcon size={22} />,
      fondo: colors.accentTint,
    },
    {
      clave: 'veterano',
      titulo: t('insignias.veterano'),
      requisito: t('insignias.requisito', { n: 25 }),
      conseguida: ayudas > 25,
      icono: <BadgeVeteranIcon size={22} />,
      fondo: colors.blueTint,
    },
    {
      clave: 'ejemplar',
      titulo: t('insignias.ejemplar'),
      requisito: t('insignias.requisito', { n: 50 }),
      conseguida: ayudas > 50,
      icono: <BadgeExemplaryIcon size={22} />,
      fondo: colors.greenTint,
    },
  ];
}
