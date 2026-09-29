import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/** El corazón, aparte para poder hacerlo latir. Coordenadas del icono (1024). */
const CORAZON = 'M457 410 L405 350 C380 322 395 292 425 292 C442 292 452 302 457 316 C462 302 472 292 489 292 C519 292 534 322 509 350 Z';
const CAJA_CORAZON = { x: 380, y: 285, ancho: 160, alto: 132 };

/** Colores de cada versión: terracota (como el icono) o blanca, para fondos terracota. */
const variantes = {
  color: {
    fondo: ['#F59A62', '#DD6B3E', '#B8441F'],
    casaPequena: '#F6DCC7',
    casaGrande: '#FFF7EF',
    ventanaPequena: '#D8643A',
    ventanaGrande: '#CF5A30',
    corazon: '#FFFFFF',
    halo: '#DD6B3E',
  },
  blanca: {
    fondo: ['#FFFFFF', '#FFF8F1', '#F8E6D6'],
    casaPequena: '#F2A77F',
    casaGrande: '#DD6B3E',
    ventanaPequena: '#FFF8F1',
    ventanaGrande: '#FFF8F1',
    corazon: '#E5484D',
    halo: '#6E2A12',
  },
};

/**
 * El icono de la app dibujado en vectorial: dos casas y un corazón sobre
 * una baldosa con degradado y halo. Con `late`, el corazón late.
 */
export default function LogoMark({
  size = 120,
  late = false,
  variante = 'color',
}: {
  size?: number;
  late?: boolean;
  variante?: keyof typeof variantes;
}) {
  const c = variantes[variante];
  const escala = useRef(new Animated.Value(1)).current;
  const k = size / 1024;

  useEffect(() => {
    if (!late) return;
    const latido = Animated.loop(
      Animated.sequence([
        Animated.timing(escala, { toValue: 1.22, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(escala, { toValue: 1, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(escala, { toValue: 1.14, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(escala, { toValue: 1, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(900),
      ])
    );
    latido.start();
    return () => latido.stop();
  }, [late, escala]);

  return (
    <View
      style={[
        styles.halo,
        { width: size, height: size, borderRadius: size * 0.225, shadowRadius: size * 0.2, shadowColor: c.halo },
      ]}
      accessibilityRole="image"
      accessibilityLabel="Neighborhub"
    >
      <Svg width={size} height={size} viewBox="0 0 1024 1024">
        <Defs>
          <LinearGradient id={`baldosa-${variante}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c.fondo[0]} />
            <Stop offset="0.55" stopColor={c.fondo[1]} />
            <Stop offset="1" stopColor={c.fondo[2]} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="1024" height="1024" rx="230" fill={`url(#baldosa-${variante})`} />
        {/* Casa pequeña */}
        <Path d="M133 567 L324 430 L477 567 Z" fill={c.casaPequena} />
        <Rect x="184" y="556" width="241" height="174" rx="40" fill={c.casaPequena} />
        <Rect x="265" y="617" width="78" height="78" rx="20" fill={c.ventanaPequena} />
        {/* Casa grande */}
        <Path d="M430 516 L631 334 L888 516 Z" fill={c.casaGrande} />
        <Rect x="500" y="505" width="318" height="225" rx="50" fill={c.casaGrande} />
        <Rect x="607" y="580" width="104" height="104" rx="24" fill={c.ventanaGrande} />
      </Svg>
      <Animated.View
        style={{
          position: 'absolute',
          left: CAJA_CORAZON.x * k,
          top: CAJA_CORAZON.y * k,
          width: CAJA_CORAZON.ancho * k,
          height: CAJA_CORAZON.alto * k,
          transform: [{ scale: escala }],
        }}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox={`${CAJA_CORAZON.x} ${CAJA_CORAZON.y} ${CAJA_CORAZON.ancho} ${CAJA_CORAZON.alto}`}
        >
          <Path d={CORAZON} fill={c.corazon} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  halo: {
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
});
