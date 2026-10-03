import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert, ActivityIndicator, Image, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii } from '../theme';
import { CloseIcon, PlusIcon } from '../icons';
import PillButton from '../components/PillButton';
import { api } from '../firebase/data';
import { dataErrorMessage, pagoErrorMessage } from '../firebase/errors';
import type { ServiceCategory, ServiceStatus } from '../data/mock';
import { t } from '../i18n';
import { usePagosActivos } from '../config/remota';
import { useAuth } from '../auth/AuthContext';
import { perfilCompleto } from '../perfil/validar';
import { PRECIO_MAXIMO, PRECIO_MINIMO, comision, formatearPrecio, leerPrecio, precioValido, totalAPagar } from '../pagos/precio';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateService'>;

const categories: ServiceCategory[] = ['moving', 'painting', 'dog', 'groceries', 'other'];

/** Una foto ya subida en una edición anterior (URL) frente a una nueva del móvil. */
const yaSubida = (uri: string) => /^https?:\/\//.test(uri);

export default function CreateServiceScreen({ navigation, route }: Props) {
  // Con serviceId se edita ese servicio; sin él, se crea uno nuevo.
  const editandoId = route?.params?.serviceId;
  const [originales, setOriginales] = useState<string[]>([]);
  const [category, setCategory] = useState<ServiceCategory>('moving');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [gratis, setGratis] = useState(true);
  const [precioTexto, setPrecioTexto] = useState('');
  const [estado, setEstado] = useState<ServiceStatus | null>(null);
  const [pagado, setPagado] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pagos = usePagosActivos();
  const { profile } = useAuth();
  // Una vez publicado puede tener ofertas, y una vez pagado el dinero ya está
  // retenido: el precio ya no se toca.
  const precioBloqueado = !!editandoId && ((estado !== null && estado !== 'pending') || pagado);
  const precio = gratis ? null : leerPrecio(precioTexto);
  const rango = { min: formatearPrecio(PRECIO_MINIMO), max: formatearPrecio(PRECIO_MAXIMO) };

  useEffect(() => {
    if (!editandoId) return;
    api
      .getService(editandoId)
      .then((s) => {
        setTitle(s.title);
        setCategory(s.category);
        setDescription(s.description);
        setPhotos(s.photos);
        setOriginales(s.photos);
        setGratis(s.priceCents == null);
        setPrecioTexto(s.priceCents == null ? '' : String(s.priceCents / 100));
        setEstado(s.status ?? null);
        setPagado(!!s.pago);
      })
      .catch((e) => Alert.alert(t('crear.errorCargar'), dataErrorMessage(e)));
  }, [editandoId]);

  const guardarCambios = async () => {
    setSubmitting(true);
    let subidas: string[] = [];
    try {
      // Solo se suben las fotos nuevas; las que ya estaban se conservan.
      const nuevas = photos.filter((uri) => !yaSubida(uri));
      subidas = await Promise.all(nuevas.map((uri) => api.uploadServicePhoto(uri)));
      let i = 0;
      const finales = photos.map((uri) => (yaSubida(uri) ? uri : subidas[i++]));
      await api.updateService(editandoId!, {
        title: title.trim(),
        category,
        description: description.trim(),
        photos: finales,
        ...(precioBloqueado || !pagos ? {} : { priceCents: precio }),
      });
      // Las fotos que se quitaron ya no las usa nadie: fuera de Storage.
      const quitadas = originales.filter((url) => !finales.includes(url));
      await Promise.all(quitadas.map((url) => api.deleteServicePhoto(url).catch(() => undefined)));
      navigation.goBack();
    } catch (e) {
      await Promise.all(subidas.map((url) => api.deleteServicePhoto(url).catch(() => undefined)));
      Alert.alert(t('crear.errorGuardar'), dataErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const anadirFoto = (desde: 'camara' | 'galeria') => async () => {
    const permiso =
      desde === 'camara'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert(t('crear.permiso'), desde === 'camara' ? t('crear.permisoCamara') : t('crear.permisoFotos'));
      return;
    }
    const opciones: ImagePicker.ImagePickerOptions = { quality: 0.7, allowsEditing: true };
    const resultado =
      desde === 'camara'
        ? await ImagePicker.launchCameraAsync(opciones)
        : await ImagePicker.launchImageLibraryAsync({ ...opciones, mediaTypes: ['images'] });
    if (!resultado.canceled && resultado.assets[0]) {
      setPhotos((previas) => [...previas, resultado.assets[0].uri]);
    }
  };

  const elegirOrigenFoto = () => {
    Alert.alert(t('crear.anadirFoto'), undefined, [
      { text: t('crear.hacerFoto'), onPress: anadirFoto('camara') },
      { text: t('crear.elegirFoto'), onPress: anadirFoto('galeria') },
      { text: t('comun.cancelar'), style: 'cancel' },
    ]);
  };

  /**
   * Coordenadas donde se publica, para poder situarlo en el mapa. Si el
   * usuario no da permiso o el GPS tarda, se publica igual sin ellas.
   */
  const obtenerCoordenadas = async () => {
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) return null;
      const posicion = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { latitude: posicion.coords.latitude, longitude: posicion.coords.longitude };
    } catch {
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert(t('crear.faltaTitulo'), t('crear.faltaTituloTexto'));
      return;
    }
    if (pagos && !precioBloqueado && !gratis && (precio === null || !precioValido(precio))) {
      Alert.alert(t('crear.precioInvalido'), t('crear.precioRango', rango));
      return;
    }
    if (editandoId) {
      await guardarCambios();
      return;
    }
    // Para publicar hace falta el perfil completo (nombre, nacimiento, ciudad…).
    if (!perfilCompleto(profile)) {
      Alert.alert(t('datos.completarTitulo'), t('datos.completarPublicar'), [
        { text: t('comun.cancelar'), style: 'cancel' },
        { text: t('datos.completarBoton'), onPress: () => navigation.navigate('ProfileDetails', { motivo: 'publicar' }) },
      ]);
      return;
    }
    setSubmitting(true);
    let subidas: string[] = [];
    try {
      // Antes de subir nada, comprobar que la base de datos responde: si no,
      // las fotos acabarían en Storage sin ningún servicio que las use.
      await api.getMe();
      const [urls, coords] = await Promise.all([
        Promise.all(photos.map((uri) => api.uploadServicePhoto(uri))),
        obtenerCoordenadas(),
      ]);
      subidas = urls;
      const creado = await api.createService({
        title: title.trim(),
        category,
        description: description.trim(),
        priceCents: pagos ? precio : null,
        photos: subidas,
        coords,
        // Sin duración ni radio en el formulario: lo que importa es si es
        // gratis o su precio. La distancia se calcula al mostrarlo, desde coords.
        durationLabel: '—',
        availableLabel: t('crear.flexible'),
        locationLabel: '',
        travelRadiusKm: 5,
      });
      if (pagos && precio !== null) {
        // Con precio se paga ya: el dinero queda retenido y, pagado, pasa a
        // revisión. Si no se paga ahora, la pantalla del servicio lo ofrece.
        navigation.replace('ServiceOffers', { serviceId: creado.id });
        try {
          await Linking.openURL(await api.pagarServicio(creado.id));
        } catch (e) {
          Alert.alert(t('pagos.errorPagar'), `${pagoErrorMessage(e)}\n\n${t('crear.pagarLuego')}`);
        }
        return;
      }
      navigation.goBack();
    } catch (e) {
      // Si el alta falla después de subir fotos, se borran para no dejarlas
      // huérfanas. Un fallo al borrar no debe tapar el error original.
      await Promise.all(subidas.map((url) => api.deleteServicePhoto(url).catch(() => undefined)));
      Alert.alert(t('crear.errorEnviar'), dataErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{editandoId ? t('crear.tituloEditar') : t('crear.tituloNuevo')}</Text>
        <Pressable
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('comun.cerrar')}
        >
          <CloseIcon size={14} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>{t('crear.titulo')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('crear.tituloEjemplo')}
            placeholderTextColor={colors.mutedLight}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={styles.label}>{t('crear.categoria')}</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {categories.map((c) => (
              <Pressable
                key={c}
                style={[styles.categoryChip, category === c && styles.categoryChipActive]}
                onPress={() => setCategory(c)}
              >
                <Text style={[styles.categoryLabel, category === c && styles.categoryLabelActive]}>{t(`categorias.${c}`)}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={styles.label}>{t('crear.descripcion')}</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder={t('crear.descripcionEjemplo')}
            placeholderTextColor={colors.mutedLight}
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={styles.label}>{t('crear.fotos')}</Text>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {photos.map((uri) => (
              <Pressable
                key={uri}
                onLongPress={() => setPhotos((previas) => previas.filter((p) => p !== uri))}
                accessibilityRole="button"
                accessibilityLabel={t('crear.fotoQuitar')}
              >
                <Image source={{ uri }} style={styles.photo} />
              </Pressable>
            ))}
            <Pressable
              style={styles.addPhoto}
              onPress={elegirOrigenFoto}
              accessibilityRole="button"
              accessibilityLabel={t('crear.anadirFoto')}
            >
              <PlusIcon size={20} color={colors.mutedLight} />
            </Pressable>
          </View>
          {photos.length > 0 && <Text style={styles.photoHint}>{t('crear.pistaFotos')}</Text>}
        </View>

        {pagos && (
          <View style={{ gap: 8 }}>
            <Text style={styles.label}>{t('crear.precio')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup">
              {[true, false].map((opcion) => (
                <Pressable
                  key={String(opcion)}
                  style={[
                    styles.categoryChip,
                    gratis === opcion && styles.categoryChipActive,
                    precioBloqueado && styles.bloqueado,
                  ]}
                  onPress={() => setGratis(opcion)}
                  disabled={precioBloqueado}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: gratis === opcion, disabled: precioBloqueado }}
                >
                  <Text style={[styles.categoryLabel, gratis === opcion && styles.categoryLabelActive]}>
                    {opcion ? t('crear.gratis') : t('crear.conPrecio')}
                  </Text>
                </Pressable>
              ))}
            </View>
            {!gratis && (
              <View style={styles.precioFila}>
                <Text style={styles.moneda}>CHF</Text>
                <TextInput
                  style={[styles.input, { flex: 1 }, precioBloqueado && styles.bloqueado]}
                  placeholder="40"
                  placeholderTextColor={colors.mutedLight}
                  keyboardType="decimal-pad"
                  value={precioTexto}
                  onChangeText={setPrecioTexto}
                  editable={!precioBloqueado}
                  accessibilityLabel={t('crear.precio')}
                />
              </View>
            )}
            <Text style={styles.photoHint}>
              {precioBloqueado
                ? pagado
                  ? t('crear.precioPagado')
                  : t('crear.precioBloqueado')
                : gratis
                  ? t('crear.gratisPista')
                  : precio !== null && precioValido(precio)
                    ? t('crear.resumenPrecio', {
                        total: formatearPrecio(totalAPagar(precio), { exacto: true }),
                        precio: formatearPrecio(precio, { exacto: true }),
                        gestion: formatearPrecio(comision(precio), { exacto: true }),
                      })
                    : t('crear.precioRango', rango)}
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <PillButton
          label={
            submitting
              ? t('comun.guardando')
              : editandoId
                ? t('crear.guardarCambios')
                : pagos && !gratis && precio !== null && precioValido(precio)
                  ? t('crear.pagarYEnviar', { total: formatearPrecio(totalAPagar(precio), { exacto: true }) })
                  : t('crear.enviar')
          }
          onPress={handleSubmit}
          icon={submitting ? <ActivityIndicator color={colors.white} size="small" /> : undefined}
        />
        {!editandoId && <Text style={styles.footerHint}>{t('crear.nota')}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.backgroundAlt },
  photo: { width: 96, height: 96, borderRadius: radii.sm },
  photoHint: { fontFamily: fonts.body, fontSize: 13, color: colors.mutedLight },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.ink },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: { paddingHorizontal: 20, paddingBottom: 20, gap: 16 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.muted },
  input: {
    height: 46,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
  },
  textarea: { height: 72, paddingTop: 12, textAlignVertical: 'top' },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  categoryLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  categoryLabelActive: { fontFamily: fonts.bodySemiBold, color: colors.white },
  bloqueado: { opacity: 0.55 },
  precioFila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  moneda: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.muted },
  addPhoto: {
    width: 64,
    height: 64,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },

  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  footerHint: { marginTop: 10, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', color: colors.mutedLight },
});
