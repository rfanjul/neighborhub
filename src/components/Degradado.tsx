import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

type Parada = { en: number; color: string; opacidad?: number };

/**
 * Degradado que rellena a su contenedor, con react-native-svg para no
 * añadir otro módulo nativo. Vertical por defecto (de arriba abajo).
 *
 * El Svg no se estira bien con porcentajes dentro de un contenedor con
 * padding, así que se mide el hueco y se dibuja con su tamaño exacto.
 */
export default function Degradado({
  paradas,
  diagonal = false,
  id = 'degradado',
}: {
  paradas: Parada[];
  diagonal?: boolean;
  id?: string;
}) {
  const [tam, setTam] = useState({ ancho: 0, alto: 0 });
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      testID={`degradado-${id}`}
      onLayout={(e) => setTam({ ancho: e.nativeEvent.layout.width, alto: e.nativeEvent.layout.height })}
    >
      {tam.ancho > 0 && (
        <Svg width={tam.ancho} height={tam.alto}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2={diagonal ? '1' : '0'} y2="1">
              {paradas.map((p) => (
                <Stop key={p.en} offset={p.en} stopColor={p.color} stopOpacity={p.opacidad ?? 1} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={tam.ancho} height={tam.alto} fill={`url(#${id})`} />
        </Svg>
      )}
    </View>
  );
}
