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
} from '@firebase/firestore';
// Storage has no React Native-specific build, but unlike Firestore it
// doesn't need one — it's just fetch()/Blob under the hood, which works
// fine via the regular browser build in React Native.
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db } from './index';
import type { ServiceCategory, ServiceRequest } from '../data/mock';

const storage = getStorage();

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
  rating: number;
  responseLabel: string;
  identityVerified: boolean;
  onboardingCompleted: boolean;
  hasPhoto: boolean;
  photoURL: string | null;
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

function profileFromDoc(id: string, d: any): ApiUserProfile {
  return {
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
    rating: d.rating ?? 0,
    responseLabel: d.responseLabel ?? '—',
    identityVerified: d.identityVerified ?? false,
    onboardingCompleted: d.onboardingCompleted ?? false,
    hasPhoto: !!d.photoURL,
    photoURL: d.photoURL ?? null,
  };
}

function serviceFromDoc(id: string, d: any): ServiceRequest {
  return {
    id,
    title: d.title,
    category: (d.category as ServiceCategory) ?? 'other',
    description: d.description ?? '',
    distanceKm: parseFloat(d.locationLabel) || 0,
    credits: d.credits ?? 0,
    postedLabel: d.availableLabel ?? '',
    status: d.status ?? 'pending',
    durationLabel: d.durationLabel ?? '',
    availableLabel: d.availableLabel ?? '',
    requester: {
      name: d.requesterName ?? 'Neighbor',
      rating: d.requesterRating ?? 0,
      ratingCount: 0,
      responseLabel: d.requesterResponseLabel ?? '—',
      avatarColor: '#E7C9A9',
    },
  };
}

export const api = {
  async getMe(): Promise<ApiUserProfile> {
    const uid = currentUid();
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) throw new Error('Profile not found — try signing in again.');
    return profileFromDoc(uid, snap.data());
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
    await updateDoc(doc(db, 'users', uid), input);
    return api.getMe();
  },

  /** `localUri` is a file:// path from expo-camera's takePictureAsync(). */
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

  async listServices(): Promise<ServiceRequest[]> {
    const q = query(collection(db, 'helpRequests'), where('status', '==', 'approved'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => serviceFromDoc(d.id, d.data()));
  },

  async getService(id: string): Promise<ServiceRequest> {
    const snap = await getDoc(doc(db, 'helpRequests', id));
    if (!snap.exists()) throw new Error('Service not found');
    return serviceFromDoc(snap.id, snap.data());
  },

  async createService(input: {
    title: string;
    category: ServiceCategory;
    description: string;
    credits: number;
    photos?: string[];
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
      helperId: null,
      helperName: null,
      helperRating: null,
      helperResponseLabel: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return api.getService(created.id);
  },

  async acceptService(id: string): Promise<ServiceRequest> {
    const me = await api.getMe();
    const ref = doc(db, 'helpRequests', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Service not found');
    const data = snap.data();
    if (data.status !== 'approved') throw new Error('Only approved services can be accepted');
    if (data.requesterId === me.id) throw new Error("You can't accept your own request");
    await updateDoc(ref, {
      status: 'accepted',
      helperId: me.id,
      helperName: me.name,
      helperRating: me.rating,
      helperResponseLabel: me.responseLabel,
      updatedAt: serverTimestamp(),
    });
    return api.getService(id);
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
