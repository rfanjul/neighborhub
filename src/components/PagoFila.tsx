import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../theme';
import type { PagoMovimiento } from '../firebase/data';
import { formatearPrecio } from '../pagos/precio';
import { localeActual, t, type Clave } from '../i18n';

/** Texto y colores del estado según si lo pagué o lo cobro. */
function estado(p: PagoMovimiento): { texto: string; fondo: string; tinta: string } {
  const ambar = { fondo: colors.amberTint, tinta: colors.amberDark };
  const azul = { fondo: colors.blueTint, tinta: colors.blue };
  const verde = { fondo: colors.greenTint, tinta: colors.green };
  const clave = `pagos.estados.${p.rol}.${p.estado}` as Clave;
  const color = p.estado === 'pagado' ? verde : p.estado === 'retenido' ? (p.rol === 'pagado' ? azul : ambar) : ambar;
  return { texto: t(clave, { nombre: p.otraPersona }), ...color };
}

const fecha = (ms: number) =>
  ms ? new Date(ms).toLocaleDateString(localeActual(), { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/** Un pago o un cobro: servicio, con quién, importe y estado. */
export default function PagoFila({ pago, onPress }: { pago: PagoMovimiento; onPress?: () => void }) {
  const e = estado(pago);
  const signo = pago.rol === 'pagado' ? '−' : '+';
  return (
    <Pressable
      style={styles.fila}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${pago.titulo}, ${signo}${formatearPrecio(pago.importe, { exacto: true })}, ${e.texto}`}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.titulo} numberOfLines={1}>
          {pago.titulo || t('pagos.servicio')}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[pago.otraPersona && t(pago.rol === 'pagado' ? 'pagos.a' : 'pagos.de', { nombre: pago.otraPersona }), fecha(pago.fecha)]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <View style={[styles.chip, { backgroundColor: e.fondo }]}>
          <Text style={[styles.chipTexto, { color: e.tinta }]}>{e.texto}</Text>
        </View>
      </View>
      <Text style={[styles.importe, pago.rol === 'cobrado' && { color: colors.green }]}>
        {signo}
        {formatearPrecio(pago.importe, { exacto: true })}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  titulo: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.ink },
  meta: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  chip: { alignSelf: 'flex-start', marginTop: 2, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  chipTexto: { fontFamily: fonts.bodySemiBold, fontSize: 13 },
  importe: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.ink },
});
