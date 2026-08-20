import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { aiService, AiPlan } from '../../services/aiService';
import { workoutService } from '../../services/workoutService';
import { WorkoutDayForm } from '../../types/workout';
import { localDateString } from '../../utils/date';
import Icon from '@/components/Icon';
import { showAlert } from '@/utils/alert';
import { useThemeStore } from '@/store/useThemeStore';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  failed?: boolean;
}

const EXAMPLE_PROMPTS = [
  'Create a 3-day full body plan',
  'Why did my bench press stall?',
  'What should I eat today?',
];

const DAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

let localIdCounter = 0;
const nextLocalId = () => `local-${Date.now()}-${localIdCounter++}`;

// ● ● ● pulsing "Coach is thinking" indicator
function TypingIndicator() {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View className="flex-row justify-start px-4 mb-3">
      <View className="bg-surface border border-border rounded-2xl rounded-bl-sm px-4 py-3 max-w-[85%]">
        <Animated.Text style={{ opacity }} className="text-text-light">
          ● ● ●
        </Animated.Text>
      </View>
    </View>
  );
}

function PlanCard({ plan }: { plan: AiPlan }) {
  const router = useRouter();
  const { colors } = useThemeStore();
  const { user } = useAuthStore();
  const [adding, setAdding] = useState(false);
  const addingRef = useRef(false);

  const sortedDays = [...plan.days].sort((a, b) => a.day_of_week - b.day_of_week);

  const addPlan = async () => {
    if (!user?.id) return;
    if (addingRef.current) return;
    addingRef.current = true;
    setAdding(true);

    try {
      // Fill any days the plan omits as rest days so the week is complete.
      const days: WorkoutDayForm[] = Array.from({ length: 7 }, (_, dow) => {
        const planDay = plan.days.find(d => d.day_of_week === dow);
        if (!planDay || planDay.is_rest_day) {
          return {
            dayOfWeek: dow,
            name: planDay?.name || 'Rest',
            isRestDay: true,
            exercises: [],
          };
        }
        return {
          dayOfWeek: dow,
          name: planDay.name,
          isRestDay: false,
          exercises: planDay.exercises.map(ex => ({
            id: '',
            name: ex.exercise_name,
            sets: ex.target_sets,
            reps: ex.target_reps,
            weight: ex.target_weight ?? null,
            type: 'strength' as const,
          })),
        };
      });

      const start = new Date();
      const end = new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000);

      const result = await workoutService.createWeeklyPlan(
        user.id,
        {
          name: plan.name,
          description: plan.description,
          startDate: localDateString(start),
          endDate: localDateString(end),
          isTemplate: false,
        },
        days
      );

      if (result.success) {
        showAlert('Success', 'Plan added! It is now your active plan.', [
          { text: 'OK', onPress: () => router.push('/(tabs)/workout' as any) },
        ]);
      } else {
        showAlert('Error', result.error?.message || 'Failed to add the plan.');
      }
    } finally {
      addingRef.current = false;
      setAdding(false);
    }
  };

  const confirmAdd = () => {
    showAlert('Add to My Plans?', 'This will become your active plan.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Add', onPress: addPlan },
    ]);
  };

  return (
    <View className="bg-surface rounded-2xl p-4 mt-2 border border-primary/40">
      <View className="flex-row items-center mb-1">
        <Icon name="Dumbbell" size={18} color={colors.brand} />
        <Text className="text-text font-bold text-lg ml-2 flex-1">{plan.name}</Text>
      </View>
      {!!plan.description && (
        <Text className="text-text-light text-sm mb-2">{plan.description}</Text>
      )}
      <View className="mb-3">
        {sortedDays.map(day => (
          <Text key={day.day_of_week} className="text-text-light text-sm py-0.5">
            <Text className="text-text font-medium">{DAY_ABBR[day.day_of_week]}</Text>
            {day.is_rest_day
              ? ' — Rest'
              : ` — ${day.name} · ${day.exercises.length} exercise${day.exercises.length === 1 ? '' : 's'}`}
          </Text>
        ))}
      </View>
      <TouchableOpacity
        className={`bg-primary py-3 rounded-lg ${adding ? 'opacity-50' : ''}`}
        disabled={adding}
        onPress={confirmAdd}
        accessibilityRole="button"
      >
        {adding ? (
          <ActivityIndicator size="small" color={colors.onBrand} />
        ) : (
          <Text className="text-on-brand text-center font-bold">Add to My Plans</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function AssistantMessage({ content }: { content: string }) {
  const parsed = aiService.parsePlanBlock(content);

  return (
    <View className="flex-row justify-start px-4 mb-3">
      <View className="max-w-[85%]">
        {parsed ? (
          <>
            {!!parsed.textWithoutBlock && (
              <View className="bg-surface border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                <Text className="text-text">{parsed.textWithoutBlock}</Text>
              </View>
            )}
            <PlanCard plan={parsed.plan} />
          </>
        ) : (
          <View className="bg-surface border border-border rounded-2xl rounded-bl-sm px-4 py-3">
            <Text className="text-text">{content}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function CoachScreen() {
  const { colors } = useThemeStore();
  const { user } = useAuthStore();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const conversation = await aiService.getLatestConversation();
      if (cancelled) return;
      if (conversation) {
        const history = await aiService.getMessages(conversation.id);
        if (cancelled) return;
        setConversationId(conversation.id);
        setMessages(
          history.map(m => ({ id: m.id, role: m.role, content: m.content }))
        );
      }
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Keep the newest message in view.
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(t);
  }, [messages, sending]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setInput('');

    const localId = nextLocalId();
    setMessages(prev => [...prev, { id: localId, role: 'user', content: trimmed }]);

    try {
      const { conversationId: cid, reply } = await aiService.sendMessage(
        conversationId,
        trimmed
      );
      setConversationId(cid);
      setMessages(prev => [
        ...prev,
        { id: nextLocalId(), role: 'assistant', content: reply },
      ]);
    } catch (error) {
      setMessages(prev =>
        prev.map(m => (m.id === localId ? { ...m, failed: true } : m))
      );
      showAlert(
        'Error',
        error instanceof Error ? error.message : 'The coach could not respond.'
      );
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const retryMessage = (message: ChatMessage) => {
    if (sendingRef.current) return;
    setMessages(prev => prev.filter(m => m.id !== message.id));
    sendMessage(message.content);
  };

  const startNewChat = () => {
    if (sendingRef.current) return;
    setConversationId(null);
    setMessages([]);
    setInput('');
  };

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-1 justify-center items-center px-8">
          <Text className="text-text-light text-center">
            Please sign in to chat with your coach.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const canSend = input.trim().length > 0 && !sending;

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <Text className="text-text text-2xl font-bold">Coach</Text>
          <TouchableOpacity
            className="bg-surface-2 border border-border rounded-full p-2"
            onPress={startNewChat}
            accessibilityRole="button"
            accessibilityLabel="Start new conversation"
          >
            <Icon name="SquarePen" size={20} color={colors.textLight} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color={colors.brand} />
          </View>
        ) : messages.length === 0 && !sending ? (
          /* Welcome state */
          <ScrollView
            ref={scrollRef}
            className="flex-1"
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="items-center px-6">
              <View className="bg-primary/15 rounded-full p-5 mb-4">
                <Icon name="Bot" size={40} color={colors.brand} />
              </View>
              <Text className="text-text text-xl font-bold mb-2 text-center">
                Hey, I'm your Coach
              </Text>
              <Text className="text-text-light text-center mb-6">
                Ask me about your training, nutrition, or progress
              </Text>
              <View className="w-full max-w-md">
                {EXAMPLE_PROMPTS.map(prompt => (
                  <TouchableOpacity
                    key={prompt}
                    className="bg-surface-2 border border-border rounded-full px-4 py-3 mb-2"
                    onPress={() => setInput(prompt)}
                    accessibilityRole="button"
                    accessibilityLabel={`Ask: ${prompt}`}
                  >
                    <Text className="text-text text-center">{prompt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        ) : (
          /* Message list */
          <ScrollView
            ref={scrollRef}
            className="flex-1"
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map(message =>
              message.role === 'assistant' ? (
                <AssistantMessage key={message.id} content={message.content} />
              ) : (
                <View key={message.id} className="px-4 mb-3">
                  <View className="flex-row justify-end">
                    <View
                      className={`rounded-2xl rounded-br-sm px-4 py-3 max-w-[85%] ${
                        message.failed ? 'bg-surface border border-danger' : 'bg-primary'
                      }`}
                    >
                      <Text className={message.failed ? 'text-text' : 'text-on-brand'}>{message.content}</Text>
                    </View>
                  </View>
                  {message.failed && (
                    <View className="flex-row justify-end mt-1">
                      <TouchableOpacity
                        className="flex-row items-center"
                        onPress={() => retryMessage(message)}
                        accessibilityRole="button"
                      >
                        <Icon name="RefreshCw" size={14} color={colors.danger} />
                        <Text className="text-danger text-sm ml-1">
                          Failed to send · Retry
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )
            )}
            {sending && <TypingIndicator />}
          </ScrollView>
        )}

        {/* Input row */}
        <View className="flex-row items-end px-4 py-3 bg-bg">
          <TextInput
            className="bg-surface-2 border border-border text-text rounded-2xl px-4 py-3 flex-1 mr-2 max-h-32 outline-none"
            placeholder="Ask your coach..."
            placeholderTextColor={colors.textLight}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={4000}
            editable={!sending}
            accessibilityLabel="Ask your coach..."
          />
          <TouchableOpacity
            className={`bg-primary rounded-full p-3 ${canSend ? '' : 'opacity-50'}`}
            disabled={!canSend}
            onPress={() => sendMessage(input)}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <Icon name="Send" size={20} color={colors.onBrand} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
