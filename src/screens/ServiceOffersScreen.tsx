import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii, shadow } from '../theme';
import { BackIcon } from '../icons';
import PillButton from '../components/PillButton';
import type { ServiceRequest } from '../data/mock';
import { api, type Application } from '../firebase/data';
import { dataErrorMessage } from '../firebase/errors';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceOffers'>;

/**
 * Ofertas recibidas en un servicio propio. Mientras está abierto se elige
 * una (solo una); después, se habla con esa persona y se marca como hecho.
 */
export default function ServiceOffersScreen({ navigation, route }: Props) {
  const { serviceId } = route.params;
  const [servicio, setServicio] = useState<ServiceRequest | null>(null);
  const [ofertas, setOfertas] = useState<Application[]>([]);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [s, o] = await Promise.all([api.getService(serviceId), api.listApplicationsForService(serviceId)]);
      setServicio(s);
      setOfertas(o);
    } catch (e) {
      Alert.alert("Couldn't load the offers", dataErrorMessage(e));
    }
  }, [serviceId]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const elegir = (oferta: Application) => {
    Alert.alert(`Choose ${oferta.applicantName}?`, 'The other offers will be declined and you can chat with them.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Choose',
        onPress: async () => {
          setOcupado(true);
          try {
            await api.selectApplicant(serviceId, oferta.id);
            await cargar();
          } catch (e) {
            Alert.alert("Couldn't choose this offer", dataErrorMessage(e));
          } finally {
            setOcupado(false);
          }
        },
      },
    ]);
  };

  const completar = () => {
    Alert.alert('Mark as completed?', 'Confirm the help has been done.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Completed',
        onPress: async () => {
          setOcupado(true);
          try {
            await api.completeService(serviceId);
            await cargar();
          } catch (e) {
            Alert.alert("Couldn't update the service", dataErrorMessage(e));
          } finally {
            setOcupado(false);
          }
        },
      },
    ]);
  };

  const abierto = servicio?.status === 'approved';
  const enCurso = servicio?.status === 'accepted' || servicio?.status === 'in_progress';
  const terminado = servicio?.status === 'completed' || servicio?.status === 'rated';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          style={styles.back}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <BackIcon size={18} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo} numberOfLines={2}>
            {servicio?.title ?? ''}
          </Text>
          <Text style={styles.subtitulo}>
            {ofertas.length === 1 ? '1 offer' : `${ofertas.length} offers`}
          </Text>
        </View>
      </View>

      {servicio?.status === 'pending' && (
        <Text style={styles.aviso}>Waiting for review. Neighbors can make offers once it's approved.</Text>
      )}

      {(enCurso || terminado) && servicio?.helperName && (
        <View style={styles.elegido}>
          <Text style={styles.elegidoTexto}>
            {terminado ? `Completed with ${servicio.helperName}` : `${servicio.helperName} is helping you`}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <PillButton
              label="Open chat"
              onPress={() => navigation.navigate('Chat', { serviceId })}
              style={{ flex: 1 }}
            />
            {enCurso && (
              <PillButton label="Mark as completed" variant="outline" onPress={completar} style={{ flex: 1 }} disabled={ocupado} />
            )}
          </View>
        </View>
      )}

      <FlatList
        data={ofertas}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={
          servicio && abierto ? <Text style={styles.vacio}>No offers yet. We'll show them here as they arrive.</Text> : null
        }
        renderItem={({ item }) => (
          <View style={[styles.tarjeta, item.status === 'rejected' && { opacity: 0.55 }]}>
            <Text style={styles.nombre}>{item.applicantName}</Text>
            {item.comment ? <Text style={styles.comentario}>“{item.comment}”</Text> : null}
            {abierto ? (
              <PillButton label="Choose" onPress={() => elegir(item)} disabled={ocupado} />
            ) : (
              <Text style={[styles.estado, item.status === 'selected' && { color: colors.green }]}>
                {item.status === 'selected' ? 'Selected' : item.status === 'rejected' ? 'Not selected' : 'Waiting'}
              </Text>
            )}
          </View>
        )}
      />
      {ocupado && <ActivityIndicator style={styles.cargando} color={colors.accent} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8 },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  subtitulo: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  aviso: {
    margin: 20,
    marginBottom: 0,
    padding: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.amberTint,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
  },
  elegido: { margin: 20, marginBottom: 0, padding: 16, borderRadius: radii.lg, backgroundColor: colors.card, gap: 12, ...shadow },
  elegidoTexto: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink },
  lista: { padding: 20, gap: 12 },
  vacio: { marginTop: 30, textAlign: 'center', fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  tarjeta: { backgroundColor: colors.card, borderRadius: radii.lg, padding: 16, gap: 10, ...shadow },
  nombre: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.ink },
  comentario: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, lineHeight: 18 },
  estado: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.muted },
  cargando: { position: 'absolute', top: '50%', alignSelf: 'center' },
});
