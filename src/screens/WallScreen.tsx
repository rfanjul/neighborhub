import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { RootStackParamList, MainTabParamList } from '../navigation/types';
import { colors, fonts, radii } from '../theme';
import { CoinIcon, SearchIcon, FilterIcon } from '../icons';
import { currentUser, mockServices, type ServiceRequest } from '../data/mock';
import ServiceCard from '../components/ServiceCard';
import { api } from '../firebase/data';
import { useAuth } from '../auth/AuthContext';
import { useUbicacion } from '../geo/useUbicacion';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'HomeTab'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function WallScreen({ navigation }: Props) {
  const { user, profile } = useAuth();
  const ubicacion = useUbicacion();
  // El saludo es para quien ha entrado, no para el usuario de ejemplo.
  const nombre = (profile?.name || user?.displayName || '').split(' ')[0];
  const [services, setServices] = useState<ServiceRequest[]>(mockServices);
  const [credits, setCredits] = useState(currentUser.credits);
  const [refreshing, setRefreshing] = useState(false);
  const [usingBackend, setUsingBackend] = useState(false);
  const [query, setQuery] = useState('');

  const filteredServices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.requester.name.toLowerCase().includes(q)
    );
  }, [services, query]);

  const load = useCallback(async () => {
    try {
      const [list, me] = await Promise.all([api.listServices(), api.getMe()]);
      setServices(list);
      setCredits(me.credits);
      setUsingBackend(true);
    } catch {
      // Firestore not reachable (offline, or Firebase isn't configured yet) —
      // fall back to local mock data so the screen still works standalone.
      setServices(mockServices);
      setCredits(currentUser.credits);
      setUsingBackend(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{nombre ? `Hi, ${nombre} 👋` : 'Hi 👋'}</Text>
          <Text style={styles.headline}>Need help nearby?</Text>
        </View>
        <View style={styles.creditsPill}>
          <CoinIcon size={16} />
          <Text style={styles.creditsLabel}>{credits}</Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <SearchIcon size={16} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search requests..."
            placeholderTextColor={colors.mutedLight}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
        <View style={styles.filterButton}>
          <FilterIcon size={18} />
        </View>
      </View>

      {!usingBackend && (
        <Text style={styles.offlineNote}>Showing demo data — couldn't reach Firestore (check your connection or Firebase setup).</Text>
      )}

      <FlatList
        data={filteredServices}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {query.trim() ? `No requests match "${query.trim()}".` : 'No requests nearby yet. Be the first to ask for help!'}
          </Text>
        }
        renderItem={({ item }) => (
          <ServiceCard
            service={item}
            ubicacion={ubicacion}
            onPress={() => navigation.navigate('ServiceDetail', { serviceId: item.id })}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  headline: { marginTop: 2, fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  creditsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  creditsLabel: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink },
  searchRow: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, flexDirection: 'row', gap: 10 },
  searchBar: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.ink, padding: 0 },
  filterButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  offlineNote: { paddingHorizontal: 20, paddingBottom: 10, fontFamily: fonts.body, fontSize: 11.5, color: colors.mutedLight },
  list: { paddingHorizontal: 20, paddingBottom: 20, gap: 12, flexGrow: 1 },
  emptyText: { marginTop: 40, textAlign: 'center', fontFamily: fonts.body, fontSize: 13.5, color: colors.mutedLight },
});
