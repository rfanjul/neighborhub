import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii, shadow } from '../theme';
import { BackIcon } from '../icons';
import PillButton from '../components/PillButton';
import Avatar from '../components/Avatar';
import Stars from '../components/Stars';
import type { ServiceRequest } from '../data/mock';
import { api, type Application, type ApiUserProfile, type Review } from '../firebase/data';
import { dataErrorMessage } from '../firebase/errors';
import { insignias } from '../components/insignias';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceOffers'>;

/**
 * Quién es quien oferta: foto, valoración, ayudas, insignias, idiomas y bio.
 * La cabecera lleva a su perfil completo.
 */
function Ofertante({
  nombre,
  perfil,
  onVerPerfil,
}: {
  nombre: string;
  perfil: ApiUserProfile | null | undefined;
  onVerPerfil: () => void;
}) {
  if (!perfil) {
    return (
      <Pressable style={styles.fila} onPress={onVerPerfil} accessibilityRole="button" accessibilityLabel={`See ${nombre}'s profile`}>
        <Avatar name={nombre} photoURL={null} size={48} />
        <Text style={[styles.nombre, { flex: 1 }]}>{nombre}</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    );
  }
  const ayudas = perfil.servicesCompleted;
  const logradas = insignias(ayudas).filter((i) => i.clave !== 'ayudas' && i.conseguida);
  return (
    <View style={{ gap: 10 }}>
      <Pressable
        style={styles.fila}
        onPress={onVerPerfil}
        accessibilityRole="button"
        accessibilityLabel={`See ${perfil.name}'s profile`}
      >
        <Avatar name={perfil.name} photoURL={perfil.photoURL} size={48} />
        <View style={{ flex: 1, gap: 3 }}>
          <View style={styles.filaNombre}>
            <Text style={styles.nombre}>{perfil.name}</Text>
            {perfil.identityVerified && <Text style={styles.verificado}>✓ Verified</Text>}
          </View>
          {perfil.rating > 0 ? (
            <View style={styles.filaNombre}>
              <Stars value={perfil.rating} size={13} />
              <Text style={styles.meta}>
                {perfil.rating.toFixed(1)}
                {perfil.ratingCount > 0 ? ` · ${perfil.ratingCount} ${perfil.ratingCount === 1 ? 'rating' : 'ratings'}` : ''}
              </Text>
            </View>
          ) : (
            <Text style={styles.meta}>No ratings yet</Text>
          )}
          <Text style={styles.meta}>
            {ayudas === 1 ? '1 help' : `${ayudas} helps`} · {perfil.levelLabel}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      {logradas.length > 0 && (
        <View style={styles.insignias}>
          {logradas.map((i) => (
            <Text key={i.clave} style={[styles.insignia, { backgroundColor: i.fondo }]}>
              {i.titulo}
            </Text>
          ))}
        </View>
      )}
      {perfil.languages ? <Text style={styles.meta}>Speaks {perfil.languages}</Text> : null}
      {perfil.bio ? <Text style={styles.bio}>{perfil.bio}</Text> : null}
    </View>
  );
}

/**
 * Ofertas recibidas en un servicio propio. Mientras está abierto se elige
 * una (solo una); después, se habla con esa persona y, al terminar, se le
 * valora, que es lo que da el servicio por completado.
 */
export default function ServiceOffersScreen({ navigation, route }: Props) {
  const { serviceId } = route.params;
  const [servicio, setServicio] = useState<ServiceRequest | null>(null);
  const [ofertas, setOfertas] = useState<Application[]>([]);
  const [resena, setResena] = useState<Review | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [s, o] = await Promise.all([api.getService(serviceId), api.listApplicationsForService(serviceId)]);
      setServicio(s);
      setOfertas(o);
      setResena(s.status === 'rated' ? await api.getReview(serviceId).catch(() => null) : null);
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

  // Completar es valorar: la pantalla de valoración deja el servicio cerrado.
  const valorar = () => navigation.navigate('RateHelper', { serviceId });

  const abierto = servicio?.status === 'approved';
  const enCurso = servicio?.status === 'accepted' || servicio?.status === 'in_progress';
  const terminado = servicio?.status === 'completed' || servicio?.status === 'rated';
  // Quien ayudó ya lo marcó como hecho, pero falta mi valoración.
  const porValorar = servicio?.status === 'completed';

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
        {/* Se puede editar mientras no se haya elegido a nadie. */}
        {(servicio?.status === 'pending' || servicio?.status === 'approved') && (
          <Pressable
            style={styles.editar}
            onPress={() => navigation.navigate('CreateService', { serviceId })}
            accessibilityRole="button"
          >
            <Text style={styles.editarTexto}>Edit</Text>
          </Pressable>
        )}
      </View>

      {servicio?.status === 'pending' && (
        <Text style={styles.aviso}>Waiting for review. Neighbors can make offers once it's approved.</Text>
      )}

      {(enCurso || terminado) && servicio?.helperName && (
        <View style={styles.elegido}>
          <Text style={styles.elegidoTexto}>
            {terminado ? `Completed with ${servicio.helperName}` : `${servicio.helperName} is helping you`}
          </Text>
          {resena && (
            <View style={{ gap: 4 }}>
              <View style={styles.filaNombre}>
                <Text style={styles.meta}>Your rating</Text>
                <Stars value={resena.rating} size={14} />
              </View>
              {resena.comment ? <Text style={styles.comentario}>“{resena.comment}”</Text> : null}
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <PillButton
              label="Open chat"
              onPress={() => navigation.navigate('Chat', { serviceId })}
              style={{ flex: 1 }}
            />
            {(enCurso || porValorar) && (
              <PillButton
                label={enCurso ? 'Mark as completed' : `Rate ${servicio.helperName}`}
                variant="outline"
                onPress={valorar}
                style={{ flex: 1 }}
                disabled={ocupado}
              />
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
            <Ofertante
              nombre={item.applicantName}
              perfil={item.applicant}
              onVerPerfil={() => navigation.navigate('NeighborProfile', { userId: item.applicantId })}
            />
            {item.comment ? (
              <View style={styles.oferta}>
                <Text style={styles.etiquetaOferta}>Their offer</Text>
                <Text style={styles.comentario}>“{item.comment}”</Text>
              </View>
            ) : null}
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
  editar: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.card },
  editarTexto: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.accentDark },
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
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  filaNombre: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  nombre: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.ink },
  verificado: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.green },
  chevron: { fontFamily: fonts.bodySemiBold, fontSize: 24, color: colors.mutedLight },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  insignias: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  insignia: {
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.ink,
  },
  bio: { fontFamily: fonts.body, fontSize: 13, color: colors.ink, lineHeight: 19 },
  oferta: { gap: 4, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  etiquetaOferta: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.mutedLight, textTransform: 'uppercase' },
  comentario: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, lineHeight: 18 },
  estado: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.muted },
  cargando: { position: 'absolute', top: '50%', alignSelf: 'center' },
});
