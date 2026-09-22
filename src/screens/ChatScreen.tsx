import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { SendIcon } from '../icons';

type Message = { id: string; text: string; fromMe: boolean; time: string };

const initialMessages: Message[] = [
  { id: 'm1', text: 'Hi! I saw you accepted my painting request 🎉', fromMe: false, time: '9:14 AM' },
  { id: 'm2', text: 'Yes! Happy to help. Does Saturday morning work for you?', fromMe: true, time: '9:16 AM' },
  { id: 'm3', text: "Perfect, 10am works great. I'll have the paint ready.", fromMe: false, time: '9:20 AM' },
];

export default function ChatScreen() {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState('');

  const send = () => {
    if (!draft.trim()) return;
    setMessages((prev) => [...prev, { id: `m${prev.length + 1}`, text: draft.trim(), fromMe: true, time: 'now' }]);
    setDraft('');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.avatar} />
        <View>
          <Text style={styles.name}>Lena K.</Text>
          <Text style={styles.subtitle}>Re: Painting a bedroom wall</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.messages}>
        {messages.map((m) => (
          <View key={m.id} style={[styles.bubbleWrap, m.fromMe ? styles.bubbleWrapRight : styles.bubbleWrapLeft]}>
            <View style={[styles.bubble, m.fromMe ? styles.bubbleRight : styles.bubbleLeft]}>
              <Text style={[styles.bubbleText, m.fromMe && { color: colors.white }]}>{m.text}</Text>
            </View>
            <Text style={[styles.time, m.fromMe && { textAlign: 'right' }]}>{m.time}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Message..."
          placeholderTextColor={colors.mutedLight}
          value={draft}
          onChangeText={setDraft}
        />
        <Pressable style={styles.sendButton} onPress={send}>
          <SendIcon size={18} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.card,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.greenTint },
  name: { fontFamily: fonts.bodySemiBold, fontSize: 14.5, color: colors.ink },
  subtitle: { marginTop: 2, fontFamily: fonts.body, fontSize: 11.5, color: colors.muted },
  messages: { padding: 20, gap: 14 },
  bubbleWrap: { maxWidth: '74%' },
  bubbleWrapLeft: { alignSelf: 'flex-start' },
  bubbleWrapRight: { alignSelf: 'flex-end' },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11 },
  bubbleLeft: { backgroundColor: colors.card, borderBottomLeftRadius: 4 },
  bubbleRight: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bubbleText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink },
  time: { marginTop: 4, fontFamily: fonts.body, fontSize: 10.5, color: colors.mutedLight },
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
    fontSize: 13.5,
    color: colors.ink,
  },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
