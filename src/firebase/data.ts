// firebase/firestore's own package.json doesn't declare a "react-native"
// export condition (same issue as firebase/auth — see config.ts), so it
// would resolve to the browser build, which relies on browser-only APIs
// (IndexedDB, WebChannel) that don't work right in React Native.
// @firebase/firestore does declare that condition, so import from there.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  runTransaction,
  deleteDoc,
  onSnapshot,
} from '@firebase/firestore';
// Storage has no React Native-specific build, but unlike Firestore it
// doesn't need one — it's just fetch()/Blob under the hood, which works
// fine via the regular browser build in React Native.
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from './index';
import type { ServiceCategory, ServiceRequest } from '../data/mock';
import { t } from '../i18n';

const storage = getStorage();

/** Un pago o un cobro, tal como lo devuelve la función misPagos (sin datos de Stripe). */
export type PagoMovimiento = {
  serviceId: string;
  /** pagado: lo pagué yo (quien pide). cobrado: lo cobro yo (quien ayuda). */
  rol: 'pagado' | 'cobrado';
  /** pendiente: Checkout sin terminar; retenido: pagado y guardado; pagado: transferido a quien ayudó. */
  estado: 'pendiente' | 'retenido' | 'pagado';
  /** Céntimos: lo pagado con la gestión, o lo que cobra quien ayuda. */
  importe: number;
  precio: number;
  comision: number;
  titulo: string;
  otraPersona: string;
  fecha: number;
};

export type ApplicationStatus = 'pending' | 'selected' | 'rejected';

/** Oferta de ayuda de un vecino sobre un servicio. */
export type Application = {
  id: string;
  serviceId: string;
  serviceTitle: string;
  applicantId: string;
  applicantName: string;
  requesterId: string;
  comment: string;
  status: ApplicationStatus;
  /** Perfil de quien oferta, para decidir a quién elegir. Solo en las recibidas. */
  applicant?: ApiUserProfile | null;
};

/** Valoración de quien publicó a quien le ayudó; una por servicio. */
export type Review = {
  serviceId: string;
  serviceTitle: string;
  reviewerId: string;
  reviewerName: string;
  reviewerPhotoURL: string | null;
  revieweeId: string;
  rating: number;
  comment: string;
  /** Milisegundos; 0 si el servidor aún no la ha fechado. */
  createdAt: number;
};

function reviewFromDoc(id: string, d: any): Review {
  return {
    serviceId: d.serviceId ?? id,
    serviceTitle: d.serviceTitle ?? '',
    reviewerId: d.reviewerId,
    reviewerName: d.reviewerName ?? 'Neighbor',
    reviewerPhotoURL: d.reviewerPhotoURL ?? null,
    revieweeId: d.revieweeId,
    rating: d.rating,
    comment: d.comment ?? '',
    createdAt: milisegundos(d.createdAt),
  };
}

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  fromMe: boolean;
  text: string;
};

function applicationFromDoc(id: string, d: any): Application {
  return {
    id,
    serviceId: d.serviceId,
    serviceTitle: d.serviceTitle ?? '',
    applicantId: d.applicantId,
    applicantName: d.applicantName ?? 'Neighbor',
    requesterId: d.requesterId,
    comment: d.comment ?? '',
    status: d.status ?? 'pending',
  };
}

/** Ordena documentos crudos del más nuevo al más viejo. */
function masNuevosPrimero<T extends { data: () => any }>(docs: T[]): T[] {
  return [...docs].sort((a, b) => milisegundos(b.data().createdAt) - milisegundos(a.data().createdAt));
}

export type ApiUserProfile = {
  id: string;
  name: string;
  email: string;
  bio: string | null;
  dateOfBirth: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  languages: string | null;
  credits: number;
  level: number;
  levelLabel: string;
  servicesCompleted: number;
  /** Media de las reseñas recibidas, con un decimal. */
  rating: number;
  /** Cuántas reseñas hay detrás de esa media. */
  ratingCount: number;
  responseLabel: string;
  identityVerified: boolean;
  /** Ha activado los cobros con Stripe: se le puede pagar en servicios con precio. */
  cobrosActivos: boolean;
  onboardingCompleted: boolean;
  hasPhoto: boolean;
  photoURL: string | null;
  /** Cuándo se unió, en milisegundos; null si no consta. */
  memberSince: number | null;
};

function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  return uid;
}

/** Creates the Firestore profile doc on a user's very first sign-in. */
export async function ensureUserDocument(uid: string, defaults: { name: string; email: string }) {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) return;
  await setDoc(userRef, {
    name: defaults.name || 'New neighbor',
    email: defaults.email,
    bio: null,
    dateOfBirth: null,
    city: null,
    postalCode: null,
    country: null,
    languages: null,
    credits: 0,
    level: 1,
    levelLabel: 'New neighbor',
    servicesCompleted: 0,
    rating: 0,
    responseLabel: '—',
    identityVerified: false,
    onboardingCompleted: false,
    photoURL: null,
    createdAt: serverTimestamp(),
  });
}

/**
 * Media de las reseñas (ratingSum / ratingCount) con un decimal. Los perfiles
 * sin reseñas conservan el campo rating que tuvieran.
 */
export function valoracionMedia(d: any): number {
  if (d?.ratingCount > 0) return Math.round((d.ratingSum / d.ratingCount) * 10) / 10;
  return d?.rating ?? 0;
}

function profileFromDoc(id: string, d: any): ApiUserProfile {
  return {
    cobrosActivos: d.cobrosActivos === true,
    id,
    name: d.name,
    email: d.email,
    bio: d.bio ?? null,
    dateOfBirth: d.dateOfBirth ?? null,
    city: d.city ?? null,
    postalCode: d.postalCode ?? null,
    country: d.country ?? null,
    languages: d.languages ?? null,
    credits: d.credits ?? 0,
    level: d.level ?? 1,
    levelLabel: d.levelLabel ?? 'New neighbor',
    servicesCompleted: d.servicesCompleted ?? 0,
    rating: valoracionMedia(d),
    ratingCount: d.ratingCount ?? 0,
    responseLabel: d.responseLabel ?? '—',
    identityVerified: d.identityVerified ?? false,
    onboardingCompleted: d.onboardingCompleted ?? false,
    hasPhoto: !!d.photoURL,
    photoURL: d.photoURL ?? null,
    memberSince: milisegundos(d.createdAt) || null,
  };
}

/**
 * Completa los servicios con el perfil actual de quien los publicó: la copia
 * que guarda el servicio al crearse se queda vieja si cambia la foto o el
 * nombre, y los servicios antiguos ni siquiera la tienen. Un perfil que no se
 * pueda leer deja el servicio como estaba.
 */
async function conAutores(servicios: ServiceRequest[]): Promise<ServiceRequest[]> {
  const ids = [...new Set(servicios.map((s) => s.requesterId).filter((id): id is string => !!id))];
  const perfiles = new Map<string, any>();
  await Promise.all(
    ids.map(async (id) => {
      try {
        const snap = await getDoc(doc(db, 'users', id));
        if (snap.exists()) perfiles.set(id, snap.data());
      } catch {
        // Sin permiso o sin red: se queda con la copia del servicio.
      }
    })
  );
  return servicios.map((s) => {
    const p = s.requesterId ? perfiles.get(s.requesterId) : undefined;
    if (!p) return s;
    return {
      ...s,
      requester: {
        ...s.requester,
        name: p.name ?? s.requester.name,
        rating: p.ratingCount > 0 ? valoracionMedia(p) : (p.rating ?? s.requester.rating),
        responseLabel: p.responseLabel ?? s.requester.responseLabel,
        photoURL: p.photoURL ?? s.requester.photoURL,
      },
    };
  });
}

/** createdAt es un Timestamp de Firestore (o null si aún no ha llegado al servidor). */
function milisegundos(valor: any): number {
  if (typeof valor?.toMillis === 'function') return valor.toMillis();
  return typeof valor === 'number' ? valor : 0;
}

function serviceFromDoc(id: string, d: any): ServiceRequest {
  return {
    id,
    title: d.title,
    category: (d.category as ServiceCategory) ?? 'other',
    description: d.description ?? '',
    distanceKm: parseFloat(d.locationLabel) || 0,
    priceCents: typeof d.priceCents === 'number' ? d.priceCents : null,
    pago: d.pago?.estado ? { estado: d.pago.estado, precio: d.pago.precio, comision: d.pago.comision, total: d.pago.total } : null,
    postedLabel: d.availableLabel ?? '',
    status: d.status ?? 'pending',
    durationLabel: d.durationLabel ?? '',
    availableLabel: d.availableLabel ?? '',
    photos: Array.isArray(d.photos) ? d.photos : [],
    coords: d.coords ?? null,
    requesterId: d.requesterId ?? null,
    helperId: d.helperId ?? null,
    helperName: d.helperName ?? null,
    requester: {
      name: d.requesterName ?? 'Neighbor',
      rating: d.requesterRating ?? 0,
      ratingCount: 0,
      responseLabel: d.requesterResponseLabel ?? '—',
      avatarColor: '#E7C9A9',
      photoURL: d.requesterPhotoURL ?? null,
    },
  };
}

export const api = {
  async getMe(): Promise<ApiUserProfile> {
    const uid = currentUid();
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) throw new Error(t('erroresDatos.perfilNoEncontrado'));
    return profileFromDoc(uid, snap.data());
  },

  /** Perfil de otro vecino, o null si no existe. */
  async getUserProfile(uid: string): Promise<ApiUserProfile | null> {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? profileFromDoc(uid, snap.data()) : null;
  },

  async updateMe(input: Partial<{
    name: string;
    bio: string;
    dateOfBirth: string;
    city: string;
    postalCode: string;
    country: string;
    languages: string;
    onboardingCompleted: boolean;
  }>): Promise<ApiUserProfile> {
    const uid = currentUid();
    // Firestore rechaza undefined; un campo vacío del formulario simplemente
    // no se toca.
    const cambios = Object.fromEntries(Object.entries(input).filter(([, valor]) => valor !== undefined));
    await updateDoc(doc(db, 'users', uid), cambios);
    return api.getMe();
  },

  /** Sube una foto de servicio y devuelve su URL pública. */
  async uploadServicePhoto(localUri: string): Promise<string> {
    const uid = currentUid();
    const response = await fetch(localUri);
    const blob = await response.blob();
    const nombre = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const photoRef = ref(storage, `service-photos/${uid}/${nombre}`);
    await uploadBytes(photoRef, blob, { contentType: 'image/jpeg' });
    return getDownloadURL(photoRef);
  },

  /** Borra una foto de servicio a partir de su URL; para limpiar si el alta falla. */
  async deleteServicePhoto(url: string): Promise<void> {
    await deleteObject(ref(storage, url));
  },

  /** `localUri` is a file:// path from expo-camera's takePictureAsync(). */
  async uploadMyPhoto(localUri: string): Promise<ApiUserProfile> {
    const uid = currentUid();
    const response = await fetch(localUri);
    const blob = await response.blob();
    const photoRef = ref(storage, `profile-photos/${uid}.jpg`);
    await uploadBytes(photoRef, blob, { contentType: 'image/jpeg' });
    const url = await getDownloadURL(photoRef);
    await updateDoc(doc(db, 'users', uid), { photoURL: url });
    return api.getMe();
  },

  /**
   * Servicios del muro: los aprobados de todos y, además, los propios aunque
   * sigan pendientes de revisión, para que quien publica vea lo que ha
   * publicado.
   *
   * Ordenar en la consulta (where status + orderBy createdAt) exigiría un
   * índice compuesto en Firestore; sin él la consulta falla en producción
   * (el emulador no lo comprueba). Se ordena aquí para no depender de él.
   */
  async listServices(): Promise<ServiceRequest[]> {
    const uid = currentUid();
    const [aprobados, mios] = await Promise.all([
      getDocs(query(collection(db, 'helpRequests'), where('status', '==', 'approved'))),
      getDocs(query(collection(db, 'helpRequests'), where('requesterId', '==', uid))),
    ]);
    const porId = new Map<string, any>();
    for (const d of [...aprobados.docs, ...mios.docs]) {
      porId.set(d.id, d.data());
    }
    return conAutores(
      [...porId.entries()]
        .sort(([, a], [, b]) => milisegundos(b.createdAt) - milisegundos(a.createdAt))
        .map(([id, data]) => serviceFromDoc(id, data))
    );
  },

  async getService(id: string): Promise<ServiceRequest> {
    const snap = await getDoc(doc(db, 'helpRequests', id));
    if (!snap.exists()) throw new Error(t('erroresDatos.servicioNoEncontrado'));
    const [servicio] = await conAutores([serviceFromDoc(snap.id, snap.data())]);
    return servicio;
  },

  async createService(input: {
    title: string;
    category: ServiceCategory;
    description: string;
    /** Céntimos que recibe quien ayuda; null si es gratis. */
    priceCents: number | null;
    photos?: string[];
    coords?: { latitude: number; longitude: number } | null;
    durationLabel: string;
    availableLabel: string;
    locationLabel: string;
    travelRadiusKm: number;
  }): Promise<ServiceRequest> {
    const me = await api.getMe();
    const created = await addDoc(collection(db, 'helpRequests'), {
      ...input,
      status: 'pending',
      requesterId: me.id,
      requesterName: me.name,
      requesterRating: me.rating,
      requesterResponseLabel: me.responseLabel,
      requesterPhotoURL: me.photoURL,
      helperId: null,
      helperName: null,
      helperRating: null,
      helperResponseLabel: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return api.getService(created.id);
  },


  /**
   * Edita un servicio propio. Las reglas solo lo permiten mientras está
   * pendiente o aprobado, es decir, antes de elegir a nadie.
   */
  async updateService(
    id: string,
    cambios: Partial<{
      title: string;
      category: ServiceCategory;
      description: string;
      durationLabel: string;
      travelRadiusKm: number;
      photos: string[];
      // Solo mientras está pendiente: publicado ya puede tener ofertas.
      priceCents: number | null;
    }>
  ): Promise<ServiceRequest> {
    const limpios = Object.fromEntries(Object.entries(cambios).filter(([, v]) => v !== undefined));
    await updateDoc(doc(db, 'helpRequests', id), { ...limpios, updatedAt: serverTimestamp() });
    return api.getService(id);
  },

  /** Servicios que he publicado, en cualquier estado. */
  async listMyServices(): Promise<ServiceRequest[]> {
    const snap = await getDocs(query(collection(db, 'helpRequests'), where('requesterId', '==', currentUid())));
    return masNuevosPrimero(snap.docs).map((d) => serviceFromDoc(d.id, d.data()));
  },

  /** Número de servicios completados en los que he ayudado. */
  async countCompletedHelps(): Promise<number> {
    const snap = await getDocs(query(collection(db, 'helpRequests'), where('helperId', '==', currentUid())));
    return snap.docs.filter((d) => ['completed', 'rated'].includes(d.data().status)).length;
  },

  /**
   * Quien publica da la ayuda por hecha y valora a quien ayudó (1 a 5 y un
   * comentario opcional). En una transacción: crea la reseña, suma la nota y
   * una ayuda al perfil de quien ayudó y pasa el servicio a valorado. Las
   * reglas comprueban que todo cuadra.
   */
  async rateHelper(serviceId: string, rating: number, comment: string): Promise<void> {
    const uid = currentUid();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error(t('erroresDatos.notaInvalida'));
    await runTransaction(db, async (tx) => {
      const servicioRef = doc(db, 'helpRequests', serviceId);
      const snap = await tx.get(servicioRef);
      if (!snap.exists()) throw new Error(t('erroresDatos.servicioNoEncontrado'));
      const servicio = snap.data();
      if (servicio.requesterId !== uid) throw new Error(t('erroresDatos.soloDueno'));
      if (!servicio.helperId || !['accepted', 'in_progress', 'completed'].includes(servicio.status)) {
        throw new Error(t('erroresDatos.noListo'));
      }
      const ayudanteRef = doc(db, 'users', servicio.helperId);
      const ayudante = (await tx.get(ayudanteRef)).data() ?? {};
      const yo = (await tx.get(doc(db, 'users', uid))).data() ?? {};

      tx.set(doc(db, 'reviews', serviceId), {
        serviceId,
        serviceTitle: servicio.title ?? '',
        reviewerId: uid,
        reviewerName: yo.name ?? 'Neighbor',
        reviewerPhotoURL: yo.photoURL ?? null,
        revieweeId: servicio.helperId,
        rating,
        comment: comment.trim(),
        createdAt: serverTimestamp(),
      });
      tx.update(ayudanteRef, {
        ratingSum: (ayudante.ratingSum ?? 0) + rating,
        ratingCount: (ayudante.ratingCount ?? 0) + 1,
        servicesCompleted: (ayudante.servicesCompleted ?? 0) + 1,
        lastReviewId: serviceId,
      });
      tx.update(servicioRef, { status: 'rated', updatedAt: serverTimestamp() });
    });
  },

  /** La reseña de un servicio, si ya se valoró. */
  async getReview(serviceId: string): Promise<Review | null> {
    const snap = await getDoc(doc(db, 'reviews', serviceId));
    return snap.exists() ? reviewFromDoc(serviceId, snap.data()) : null;
  },

  /**
   * Borra mis datos al borrar la cuenta: mis servicios aún sin nadie elegido
   * (con sus fotos y las ofertas recibidas), mis ofertas pendientes, mi foto
   * y mi perfil. Lo que ya implica a otra persona (servicios en curso o
   * hechos, reseñas, chats) se conserva, como explica la política de privacidad.
   */
  async deleteMyData(): Promise<void> {
    const uid = currentUid();
    const mios = await getDocs(query(collection(db, 'helpRequests'), where('requesterId', '==', uid)));
    for (const d of mios.docs) {
      const servicio = d.data();
      if (!['pending', 'approved'].includes(servicio.status)) continue;
      const recibidas = await getDocs(
        query(collection(db, 'applications'), where('serviceId', '==', d.id), where('requesterId', '==', uid))
      );
      for (const o of recibidas.docs) await deleteDoc(doc(db, 'applications', o.id));
      for (const url of servicio.photos ?? []) await api.deleteServicePhoto(url).catch(() => undefined);
      await deleteDoc(doc(db, 'helpRequests', d.id));
    }
    const hechas = await getDocs(query(collection(db, 'applications'), where('applicantId', '==', uid)));
    for (const o of hechas.docs) {
      if (o.data().status === 'pending') await deleteDoc(doc(db, 'applications', o.id));
    }
    await deleteObject(ref(storage, `profile-photos/${uid}.jpg`)).catch(() => undefined);
    await deleteDoc(doc(db, 'users', uid));
  },

  /** Las ayudas de un vecino: una reseña por cada una, de la más nueva a la más vieja. */
  async listReviewsFor(uid: string): Promise<Review[]> {
    const snap = await getDocs(query(collection(db, 'reviews'), where('revieweeId', '==', uid)));
    return masNuevosPrimero(snap.docs).map((d) => reviewFromDoc(d.id, d.data()));
  },

  /**
   * Servicios abiertos de un vecino. De otro solo se pueden leer los
   * aprobados (las reglas no dejan ver el resto); de uno mismo, todos.
   */
  async listServicesBy(uid: string): Promise<ServiceRequest[]> {
    if (uid === currentUid()) return api.listMyServices();
    const snap = await getDocs(
      query(collection(db, 'helpRequests'), where('requesterId', '==', uid), where('status', '==', 'approved'))
    );
    return conAutores(masNuevosPrimero(snap.docs).map((d) => serviceFromDoc(d.id, d.data())));
  },

  /** Ofrecerse para un servicio aprobado, con un comentario para quien lo publicó. */
  async applyToService(serviceId: string, comment: string): Promise<Application> {
    const uid = currentUid();
    const [me, snap] = await Promise.all([api.getMe(), getDoc(doc(db, 'helpRequests', serviceId))]);
    if (!snap.exists()) throw new Error(t('erroresDatos.servicioNoEncontrado'));
    const servicio = snap.data();
    if (servicio.status !== 'approved') throw new Error(t('erroresDatos.soloAprobados'));
    const requesterId = servicio.requesterId;
    if (requesterId === uid) throw new Error(t('erroresDatos.propio'));
    const id = `${serviceId}_${uid}`;
    const datos = {
      serviceId,
      serviceTitle: servicio.title,
      applicantId: uid,
      applicantName: me.name,
      requesterId,
      comment: comment.trim(),
      status: 'pending',
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'applications', id), datos);
    return applicationFromDoc(id, datos);
  },

  /** Ofertas que he hecho yo (mis ofertas). */
  async listMyApplications(): Promise<Application[]> {
    const snap = await getDocs(query(collection(db, 'applications'), where('applicantId', '==', currentUid())));
    return masNuevosPrimero(snap.docs).map((d) => applicationFromDoc(d.id, d.data()));
  },

  /** Ofertas recibidas en un servicio mío. */
  async listApplicationsForService(serviceId: string): Promise<Application[]> {
    const snap = await getDocs(
      query(collection(db, 'applications'), where('serviceId', '==', serviceId), where('requesterId', '==', currentUid()))
    );
    const ofertas = masNuevosPrimero(snap.docs).map((d) => applicationFromDoc(d.id, d.data()));
    // Con el perfil de cada vecino: foto, bio, valoración, ayudas… Un perfil
    // que no se pueda leer deja la oferta solo con el nombre.
    return Promise.all(
      ofertas.map(async (o) => {
        try {
          const perfil = await getDoc(doc(db, 'users', o.applicantId));
          return { ...o, applicant: perfil.exists() ? profileFromDoc(o.applicantId, perfil.data()) : null };
        } catch {
          return { ...o, applicant: null };
        }
      })
    );
  },

  /**
   * Elige una oferta: esa pasa a seleccionada, el resto a rechazadas y el
   * servicio a aceptado con esa persona como ayudante. Todo en un lote, para
   * no quedar a medias.
   */
  async selectApplicant(serviceId: string, applicationId: string): Promise<void> {
    const ofertas = await api.listApplicationsForService(serviceId);
    const elegida = ofertas.find((o) => o.id === applicationId);
    if (!elegida) throw new Error(t('erroresDatos.ofertaNoEncontrada'));
    const lote = writeBatch(db);
    lote.update(doc(db, 'helpRequests', serviceId), {
      status: 'accepted',
      helperId: elegida.applicantId,
      helperName: elegida.applicantName,
      updatedAt: serverTimestamp(),
    });
    for (const o of ofertas) {
      lote.update(doc(db, 'applications', o.id), {
        status: o.id === applicationId ? 'selected' : 'rejected',
        updatedAt: serverTimestamp(),
      });
    }
    await lote.commit();
  },

  /**
   * Cobros con Stripe (functions/pagos.js): crea la cuenta de cobro si hace
   * falta y devuelve el enlace al formulario de Stripe.
   */
  async activarCobros(): Promise<string> {
    const r = await httpsCallable<void, { url: string }>(functions, 'activarCobros')();
    return r.data.url;
  },

  /** Pregunta a Stripe si ya puede cobrar (y lo apunta en el perfil). */
  async estadoCobros(): Promise<{ conCuenta: boolean; activos: boolean; pendiente: boolean }> {
    const r = await httpsCallable<void, { conCuenta: boolean; activos: boolean; pendiente: boolean }>(functions, 'estadoCobros')();
    return r.data;
  },

  /** Mis pagos y cobros, los más recientes primero. */
  async misPagos(): Promise<PagoMovimiento[]> {
    const r = await httpsCallable<void, PagoMovimiento[]>(functions, 'misPagos')();
    return r.data;
  },

  /**
   * Elegir una oferta de un servicio con precio: devuelve el enlace a Stripe
   * Checkout. El servicio pasa a aceptado cuando Stripe confirma el pago.
   */
  async pagarOferta(serviceId: string, applicantId: string): Promise<string> {
    const r = await httpsCallable<{ serviceId: string; applicantId: string }, { url: string }>(functions, 'pagarOferta')({
      serviceId,
      applicantId,
    });
    return r.data.url;
  },

  /** Mensajes del chat de un servicio en tiempo real. Devuelve cómo dejar de escuchar. */
  subscribeMessages(
    helpRequestId: string,
    onMessages: (mensajes: ChatMessage[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    const uid = currentUid();
    const q = query(collection(db, 'helpRequests', helpRequestId, 'messages'), orderBy('createdAt', 'asc'));
    return onSnapshot(
      q,
      (snap) =>
        onMessages(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              senderId: data.senderId,
              senderName: data.senderName,
              fromMe: data.senderId === uid,
              text: data.text,
            };
          })
        ),
      onError
    );
  },

  async listMessages(helpRequestId: string) {
    const uid = currentUid();
    const q = query(collection(db, 'helpRequests', helpRequestId, 'messages'), orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        senderId: data.senderId as string,
        senderName: data.senderName as string,
        fromMe: data.senderId === uid,
        text: data.text as string,
        createdAt: data.createdAt,
      };
    });
  },

  async sendMessage(helpRequestId: string, text: string) {
    const me = await api.getMe();
    await addDoc(collection(db, 'helpRequests', helpRequestId, 'messages'), {
      senderId: me.id,
      senderName: me.name,
      text,
      createdAt: serverTimestamp(),
    });
  },
};
