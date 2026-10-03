import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii } from '../theme';
import { CloseIcon } from '../icons';
import PillButton from '../components/PillButton';
import { api } from '../firebase/data';
import { dataErrorMessage } from '../firebase/errors';
import { t } from '../i18n';
import CobrosTarjeta from '../components/CobrosTarjeta';
import { usePagosActivos } from '../config/remota';
import { useAuth } from '../auth/AuthContext';
import { perfilCompleto } from '../perfil/validar';

type Props = NativeStackScreenProps<RootStackParamList, 'Apply'>;

/** Hacer una oferta sobre un servicio: un comentario para quien lo publicó. */
export default function ApplyScreen({ navigation, route }: Props) {
  const { serviceId } = route.params;
  const [titulo, setTitulo] = useState('');
  const [conPrecio, setConPrecio] = useState(false);
  const [cobros, setCobros] = useState(true);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api
      .getService(serviceId)
      .then((s) => {
        setTitulo(s.title);
        setConPrecio(s.priceCents != null);
      })
      .catch(() => setTitulo(''));
    api
      .getMe()
      .then((me) => setCobros(!!me?.cobrosActivos))
      .catch(() => {});
  }, [serviceId]);

  // Con precio hay que poder cobrar: sin cobros activos, quien pide no podría pagar.
  const pagos = usePagosActivos();
  const faltanCobros = pagos && conPrecio && !cobros;

  const { profile } = useAuth();

  const enviar = async () => {
    // Para ofrecer ayuda hace falta el perfil completo.
    if (!perfilCompleto(profile)) {
      Alert.alert(t('datos.completarTitulo'), t('datos.completarOfrecer'), [
        { text: t('comun.cancelar'), style: 'cancel' },
        { text: t('datos.completarBoton'), onPress: () => navigation.navigate('ProfileDetails', { motivo: 'ofrecer' }) },
      ]);
      return;
    }
    if (!comentario.trim()) {
      Alert.alert(t('ofertar.faltaComentario'), t('ofertar.faltaComentarioTexto'));
      return;
    }
    setEnviando(true);
    try {
      await api.applyToService(serviceId, comentario);
      // La oferta aparece en "My offers" hasta que quien publica elija.
      navigation.navigate('Main', { screen: 'ActivityTab', params: { segmento: 'offers' } });
    } catch (e) {
      Alert.alert(t('ofertar.error'), dataErrorMessage(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('ofertar.titulo')}</Text>
          <Pressable
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t('comun.cerrar')}
          >
            <CloseIcon size={14} />
          </Pressable>
        </View>

        <View style={styles.body}>
          {titulo ? <Text style={styles.servicio}>{titulo}</Text> : null}
          {faltanCobros && (
            <View style={{ gap: 10 }}>
              <Text style={styles.aviso}>{t('pagos.antesDeOfrecer')}</Text>
              <CobrosTarjeta activos={false} onCambio={setCobros} />
            </View>
          )}
          <Text style={styles.label}>{t('ofertar.comentario')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('ofertar.ejemplo')}
            placeholderTextColor={colors.mutedLight}
            value={comentario}
            onChangeText={setComentario}
            multiline
            maxLength={500}
            autoFocus
          />
          <Text style={styles.contador}>{comentario.length}/500</Text>
        </View>

        <View style={styles.footer}>
          <PillButton
            label={enviando ? t('comun.enviando') : t('ofertar.enviar')}
            onPress={enviar}
            disabled={enviando || faltanCobros}
            icon={enviando ? <ActivityIndicator color={colors.white} size="small" /> : undefined}
          />
          <Text style={styles.hint}>{t('ofertar.nota')}</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  aviso: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.amberDark },
  screen: { flex: 1, backgroundColor: colors.backgroundAlt },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.ink },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, paddingHorizontal: 20, gap: 8 },
  servicio: { fontFamily: fonts.bodySemiBold, fontSize: 17, color: colors.ink, marginBottom: 8 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.muted },
  input: {
    minHeight: 140,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  contador: { alignSelf: 'flex-end', fontFamily: fonts.body, fontSize: 13, color: colors.mutedLight },
  footer: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  hint: { textAlign: 'center', fontFamily: fonts.body, fontSize: 14, color: colors.muted },
});
