import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { isExpoGo } from '../auth/environment';
import { authErrorMessage } from '../auth/errors';
import { Button, ErrorText } from '../components/ui';
import { colors, fonts } from '../theme';
import Degradado from '../components/Degradado';
import LogoMark from '../components/LogoMark';
import { fotosBienvenida } from '../data/fotosBienvenida';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

type DiapositivaPaso = { clave: string; foto: string; paso: string; titulo: string; texto: string };
type Diapositiva = { clave: 'marca' } | DiapositivaPaso;

/** La marca y, detrás, cómo funciona: pedir, ofrecerse, elegir y valorar. */
export const diapositivas: Diapositiva[] = [
  { clave: 'marca' },
  {
    clave: 'pedir',
    foto: fotosBienvenida.pedir,
    paso: '1 · Pide ayuda',
    titulo: '¿Necesitas una mano?',
    texto:
      'Pulsa + y publica tu servicio: una foto, qué hay que hacer y cuándo. Guardamos la ubicación para que te encuentren los vecinos de al lado. Cuando se aprueba, sale en el muro y en el mapa.',
  },
  {
    clave: 'ofrecer',
    foto: fotosBienvenida.ofrecer,
    paso: '2 · Ofrécete',
    titulo: 'Ayuda a quien tienes cerca',
    texto:
      'Busca en el muro o en el mapa, abre un servicio y pulsa «Apply to help». Deja un comentario con cuándo puedes y qué sabes hacer. Lo seguirás en «My offers».',
  },
  {
    clave: 'elegir',
    foto: fotosBienvenida.elegir,
    paso: '3 · Elige',
    titulo: 'Elige a tu vecino',
    texto:
      'En tu servicio ves cada oferta con el perfil de quien la hace: valoraciones, ayudas y bio. Elige una y se abre el chat para quedar.',
  },
  {
    clave: 'valorar',
    foto: fotosBienvenida.valorar,
    paso: '4 · Valora',
    titulo: 'Valora y gana reputación',
    texto:
      'Al terminar, márcalo como hecho y valora de 1 a 5 estrellas. Cada ayuda suma y desbloquea insignias: Amateur, Veterano y Ejemplar.',
  },
];

/** Cada cuánto pasa sola la diapositiva, y cuánto espera tras tocarla. */
export const AVANCE_MS = 6000;
const PAUSA_TRAS_TOQUE_MS = 10000;

function Marca({ ancho, alto }: { ancho: number; alto: number }) {
  return (
    <View style={[s.diapositiva, s.marca, { width: ancho, height: alto }]}>
      <Degradado
        id="marca"
        diagonal
        paradas={[
          { en: 0, color: '#F59A62' },
          { en: 0.55, color: '#DD6B3E' },
          { en: 1, color: '#A93E1C' },
        ]}
      />
      <LogoMark size={156} late variante="blanca" />
      <Text style={s.marcaTitulo}>Neighborhub</Text>
      <Text style={s.marcaTexto}>
        La plataforma donde los vecinos se ayudan entre sí y, en lugar de pagarse en dinero, acumulan créditos.
      </Text>
      <View style={s.desliza}>
        <Text style={s.deslizaTexto}>Desliza para ver cómo funciona →</Text>
      </View>
    </View>
  );
}

function Paso({ d, ancho, alto, arriba }: { d: DiapositivaPaso; ancho: number; alto: number; arriba: number }) {
  return (
    <ImageBackground
      source={{ uri: d.foto }}
      style={[s.diapositiva, s.paso, { width: ancho, height: alto }]}
      resizeMode="cover"
      accessibilityIgnoresInvertColors
    >
      <Degradado
        id={`paso-${d.clave}`}
        paradas={[
          { en: 0, color: '#1E1712', opacidad: 0.5 },
          { en: 0.3, color: '#1E1712', opacidad: 0.05 },
          { en: 0.55, color: '#1E1712', opacidad: 0.25 },
          { en: 1, color: '#1E1712', opacidad: 0.92 },
        ]}
      />
      <View style={[s.marcaMini, { marginTop: arriba + 10 }]}>
        <LogoMark size={36} />
        <Text style={s.marcaMiniTexto}>Neighborhub</Text>
      </View>
      <View style={s.pasoTextos}>
        <Text style={s.pasoEtiqueta}>{d.paso}</Text>
        <Text style={s.pasoTitulo}>{d.titulo}</Text>
        <Text style={s.pasoTexto}>{d.texto}</Text>
      </View>
    </ImageBackground>
  );
}

export default function WelcomeScreen({ navigation }: Props) {
  const { loginWithApple, loginWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
  const { width } = useWindowDimensions();
  const margenes = useSafeAreaInsets();
  const [alto, setAlto] = useState(0);
  const [actual, setActual] = useState(0);
  const lista = useRef<FlatList<Diapositiva>>(null);
  const ultimoToque = useRef(0);

  const irA = (i: number) => {
    setActual(i);
    lista.current?.scrollToIndex({ index: i, animated: true });
  };

  // Pasa sola, salvo justo después de que la persona la haya movido.
  useEffect(() => {
    const t = setInterval(() => {
      if (Date.now() - ultimoToque.current < PAUSA_TRAS_TOQUE_MS) return;
      setActual((i) => {
        const siguiente = (i + 1) % diapositivas.length;
        lista.current?.scrollToIndex({ index: siguiente, animated: true });
        return siguiente;
      });
    }, AVANCE_MS);
    return () => clearInterval(t);
  }, []);

  const alMover = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActual(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const run = async (which: 'apple' | 'google', fn: () => Promise<boolean>) => {
    setError(null);
    setBusy(which);
    try {
      await fn();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={s.pantalla}>
      <View style={{ flex: 1 }} onLayout={(e) => setAlto(e.nativeEvent.layout.height)}>
        <FlatList
          ref={lista}
          testID="carrusel"
          data={diapositivas}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(d) => d.clave}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onScrollBeginDrag={() => {
            ultimoToque.current = Date.now();
          }}
          onMomentumScrollEnd={alMover}
          renderItem={({ item }) =>
            'foto' in item ? (
              <Paso d={item} ancho={width} alto={alto} arriba={margenes.top} />
            ) : (
              <Marca ancho={width} alto={alto} />
            )
          }
        />
        <View style={s.puntos}>
          {diapositivas.map((d, i) => (
            <Pressable
              key={d.clave}
              onPress={() => {
                ultimoToque.current = Date.now();
                irA(i);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Diapositiva ${i + 1} de ${diapositivas.length}`}
              accessibilityState={{ selected: i === actual }}
              style={[s.punto, i === actual && s.puntoActivo]}
            />
          ))}
        </View>
      </View>

      <View style={[s.panel, { paddingBottom: margenes.bottom + 12 }]}>
        {isExpoGo && (
          <Text style={s.aviso}>
            Estás en Expo Go: Apple y Google necesitan el development build. Aquí solo funciona el email.
          </Text>
        )}
        {Platform.OS === 'ios' && !isExpoGo && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={14}
            style={{ height: 52 }}
            onPress={() => run('apple', loginWithApple)}
          />
        )}
        {!isExpoGo && (
          <Button
            title="Continuar con Google"
            variant="secondary"
            loading={busy === 'google'}
            disabled={busy !== null}
            onPress={() => run('google', loginWithGoogle)}
          />
        )}
        <Button title="Entrar con email" onPress={() => navigation.navigate('Login')} disabled={busy !== null} />
        <Button title="Crear una cuenta" variant="link" onPress={() => navigation.navigate('Register')} />
        <ErrorText message={error} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  diapositiva: { overflow: 'hidden' },
  marca: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 40, gap: 14 },
  marcaTitulo: { marginTop: 10, fontFamily: fonts.display, fontSize: 46, lineHeight: 56, color: colors.white },
  marcaTexto: {
    textAlign: 'center',
    fontFamily: fonts.bodyMedium,
    fontSize: 18,
    lineHeight: 26,
    color: 'rgba(255,255,255,0.95)',
  },
  desliza: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  deslizaTexto: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.white },
  paso: { backgroundColor: colors.accentDark },
  marcaMini: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20 },
  marcaMiniTexto: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.white },
  pasoTextos: { position: 'absolute', left: 24, right: 24, bottom: 56, gap: 8 },
  pasoEtiqueta: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.accent,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.white,
  },
  pasoTitulo: { fontFamily: fonts.display, fontSize: 32, lineHeight: 40, color: colors.white },
  pasoTexto: { fontFamily: fonts.body, fontSize: 17, lineHeight: 25, color: 'rgba(255,255,255,0.94)' },
  puntos: { position: 'absolute', bottom: 34, alignSelf: 'center', flexDirection: 'row', gap: 8 },
  punto: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.55)' },
  puntoActivo: { width: 24, backgroundColor: colors.white },
  panel: {
    marginTop: -22,
    paddingTop: 22,
    paddingHorizontal: 20,
    gap: 10,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: colors.background,
  },
  aviso: { fontSize: 15, lineHeight: 21, color: colors.muted },
});
