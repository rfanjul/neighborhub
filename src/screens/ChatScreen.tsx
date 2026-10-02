import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import { BackIcon, SendIcon } from '../icons';
import type { ServiceRequest } from '../data/mock';
import { api, type ChatMessage } from '../firebase/data';
import { dataErrorMessage } from '../firebase/errors';
import { useAuth } from '../auth/AuthContext';
import { t } from '../i18n';
import Avatar from '../components/Avatar';
import { confirmarBloqueo, denunciar } from '../moderacion/acciones';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

/**
 * Conversación de un servicio entre quien lo publicó y la persona elegida.
 * Las reglas de Firestore solo dejan leer y escribir a esas dos personas.
 */
export default function ChatScreen({ navigation, route }: Props) {
  const { serviceId } = route.params;
  const { user } = useAuth();
  const [servicio, setServicio] = useState<ServiceRequest | null>(null);
  const [fotoOtra, setFotoOtra] = useState<string | null>(null);
  const [bloqueada, setBloqueada] = useState(false);
  const [mensajes, setMensajes] = useState<ChatMessage[]>([]);
  const [borrador, setBorrador] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    api.getService(serviceId).then(setServicio).catch(() => setServicio(null));
    return api.subscribeMessages(serviceId, setMensajes, (e) =>
      setError(
        (e as { code?: string }).code === 'permission-denied'
          ? t('chat.cerrado')
          : dataErrorMessage(e)
      )
    );
  }, [serviceId]);

  // La foto de quien ayuda no viene en el servicio: se lee de su perfil.
  const soyQuienPide = !!servicio && !!user && servicio.requesterId === user.uid;
  useEffect(() => {
    if (!servicio) return;
    if (!soyQuienPide) {
      setFotoOtra(servicio.requester.photoURL);
      return;
    }
    if (!servicio.helperId) return;
    api
      .getUserProfile(servicio.helperId)
      .then((p) => setFotoOtra(p?.photoURL ?? null))
      .catch(() => setFotoOtra(null));
  }, [servicio, soyQuienPide]);

  const enviar = async () => {
    const texto = borrador.trim();
    if (!texto) return;
    setBorrador('');
    try {
      await api.sendMessage(serviceId, texto);
    } catch (e) {
      setBorrador(texto);
      setError(dataErrorMessage(e));
    }
  };

  // Con quién se habla: si lo publiqué yo, con quien ayuda; si no, con quien lo publicó.
  const otraPersona = soyQuienPide ? servicio?.helperName ?? '' : servicio?.requester.name ?? '';
  const otraId = soyQuienPide ? servicio?.helperId ?? null : servicio?.requesterId ?? null;

  useEffect(() => {
    if (!otraId) return;
    api
      .misBloqueos()
      .then((b) => setBloqueada(b.includes(otraId)))
      .catch(() => setBloqueada(false));
  }, [otraId]);

  const masOpciones = () =>
    Alert.alert(otraPersona, undefined, [
      { text: t('moderacion.denunciarChat'), onPress: () => denunciar('message', serviceId) },
      ...(otraId && !bloqueada
        ? [{ text: t('moderacion.bloquearA', { nombre: otraPersona }), style: 'destructive' as const, onPress: () => confirmarBloqueo(otraPersona, otraId, () => setBloqueada(true)) }]
        : []),
      { text: t('comun.cancelar'), style: 'cancel' as const },
    ]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={t('comun.atras')}>
          <BackIcon size={18} />
        </Pressable>
        <Avatar name={otraPersona} photoURL={fotoOtra} size={38} color={colors.greenTint} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{otraPersona}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {servicio ? t('chat.sobre', { titulo: servicio.title }) : ''}
          </Text>
        </View>
        {servicio && (
          <Pressable onPress={masOpciones} accessibilityRole="button" accessibilityLabel={t('moderacion.masOpciones')} hitSlop={10}>
            <Text style={styles.mas}>⋯</Text>
          </Pressable>
        )}
      </View>
      {bloqueada && <Text style={styles.avisoBloqueo}>{t('moderacion.chatBloqueado', { nombre: otraPersona })}</Text>}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        >
          {error && <Text style={styles.error}>{error}</Text>}
          {!error && mensajes.length === 0 && (
            <Text style={styles.vacio}>{t('chat.vacio')}</Text>
          )}
          {mensajes.map((m) => (
            <View key={m.id} style={[styles.bubbleWrap, m.fromMe ? styles.bubbleWrapRight : styles.bubbleWrapLeft]}>
              <View style={[styles.bubble, m.fromMe ? styles.bubbleRight : styles.bubbleLeft]}>
                <Text style={[styles.bubbleText, m.fromMe && { color: colors.white }]}>{m.text}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            style={[styles.input, bloqueada && { opacity: 0.5 }]}
            editable={!bloqueada}
            placeholder={t('chat.mensaje')}
            placeholderTextColor={colors.mutedLight}
            value={borrador}
            onChangeText={setBorrador}
            onSubmitEditing={enviar}
            returnKeyType="send"
          />
          <Pressable style={styles.sendButton} onPress={enviar} disabled={bloqueada} accessibilityRole="button" accessibilityLabel={t('chat.enviar')}>
            <SendIcon size={18} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mas: { fontFamily: fonts.bodySemiBold, fontSize: 24, color: colors.ink, paddingHorizontal: 6 },
  avisoBloqueo: { padding: 12, backgroundColor: colors.amberTint, fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.amberDark, textAlign: 'center' },
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.card,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  name: { fontFamily: fonts.bodySemiBold, fontSize: 17, color: colors.ink },
  subtitle: { marginTop: 2, fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  messages: { padding: 20, gap: 14, flexGrow: 1 },
  error: { textAlign: 'center', fontFamily: fonts.body, fontSize: 15, color: colors.accentDark },
  vacio: { marginTop: 30, textAlign: 'center', fontFamily: fonts.body, fontSize: 15, color: colors.muted },
  bubbleWrap: { maxWidth: '74%' },
  bubbleWrapLeft: { alignSelf: 'flex-start' },
  bubbleWrapRight: { alignSelf: 'flex-end' },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11 },
  bubbleLeft: { backgroundColor: colors.card, borderBottomLeftRadius: 4 },
  bubbleRight: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bubbleText: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.ink },
  inputBar: {
    backgroundColor: colors.card,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
  },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
