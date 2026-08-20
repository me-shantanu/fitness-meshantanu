// services/aiService.ts
// Client for the 'ai-chat' Supabase Edge Function and the ai_conversations /
// ai_messages tables. All AI calls run server-side; nothing secret lives here.
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface AiPlanExercise {
  exercise_name: string;
  target_sets: number;
  target_reps: number;
  target_weight?: number;
}

export interface AiPlanDay {
  day_of_week: number; // 0-6, 0 = Monday
  name: string;
  is_rest_day: boolean;
  exercises: AiPlanExercise[];
}

export interface AiPlan {
  name: string;
  description?: string;
  days: AiPlanDay[];
}

const GENERIC_ERROR = 'The coach could not respond. Please try again.';

class AiService {
  // Send a message to the ai-chat Edge Function. Pass null to start a new
  // conversation (the function creates one and returns its id).
  async sendMessage(
    conversationId: string | null,
    message: string
  ): Promise<{ conversationId: string; reply: string }> {
    const { data, error } = await supabase.functions.invoke('ai-chat', {
      body: {
        conversation_id: conversationId ?? undefined,
        message,
      },
    });

    if (error) {
      let serverMessage = GENERIC_ERROR;
      if (error instanceof FunctionsHttpError) {
        try {
          const body = await error.context.json();
          if (typeof body?.error === 'string' && body.error.trim()) {
            serverMessage = body.error;
          }
        } catch {
          // Response body wasn't JSON — keep the generic message.
        }
      }
      throw new Error(serverMessage);
    }

    if (!data?.conversation_id || typeof data?.reply !== 'string') {
      throw new Error(GENERIC_ERROR);
    }

    return { conversationId: data.conversation_id, reply: data.reply };
  }

  // Newest conversation for the current user (RLS-scoped), or null.
  async getLatestConversation(): Promise<{ id: string; title: string | null } | null> {
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('id, title')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data ?? null;
    } catch (error) {
      console.error('Error fetching latest conversation:', error);
      return null;
    }
  }

  // All messages in a conversation, oldest first.
  async getMessages(conversationId: string): Promise<AiMessage[]> {
    try {
      const { data, error } = await supabase
        .from('ai_messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data as AiMessage[]) ?? [];
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  // Extract and strictly validate a ```plan fenced block from an assistant
  // reply. Returns null when there is no block or anything fails validation.
  parsePlanBlock(reply: string): { plan: AiPlan; textWithoutBlock: string } | null {
    const match = reply.match(/```plan\s*([\s\S]*?)```/);
    if (!match) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(match[1]);
    } catch {
      return null;
    }

    const plan = validatePlan(parsed);
    if (!plan) return null;

    const textWithoutBlock = reply.replace(match[0], '').trim();
    return { plan, textWithoutBlock };
  }
}

function isNonEmptyString(v: unknown, maxLen: number): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= maxLen;
}

function isInt(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

function validatePlan(raw: unknown): AiPlan | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  if (!isNonEmptyString(obj.name, 100)) return null;
  let description: string | undefined;
  if (obj.description !== undefined) {
    if (typeof obj.description !== 'string') return null;
    description = obj.description;
  }
  if (!Array.isArray(obj.days) || obj.days.length < 1 || obj.days.length > 7) return null;

  const seenDays = new Set<number>();
  const days: AiPlanDay[] = [];

  for (const rawDay of obj.days) {
    if (typeof rawDay !== 'object' || rawDay === null || Array.isArray(rawDay)) return null;
    const day = rawDay as Record<string, unknown>;

    if (!isInt(day.day_of_week, 0, 6)) return null;
    if (seenDays.has(day.day_of_week)) return null;
    seenDays.add(day.day_of_week);

    if (typeof day.name !== 'string') return null;
    if (typeof day.is_rest_day !== 'boolean') return null;
    if (!Array.isArray(day.exercises) || day.exercises.length > 15) return null;

    const exercises: AiPlanExercise[] = [];
    for (const rawEx of day.exercises) {
      if (typeof rawEx !== 'object' || rawEx === null || Array.isArray(rawEx)) return null;
      const ex = rawEx as Record<string, unknown>;

      if (!isNonEmptyString(ex.exercise_name, 100)) return null;
      if (!isInt(ex.target_sets, 1, 10)) return null;
      if (!isInt(ex.target_reps, 1, 30)) return null;

      let targetWeight: number | undefined;
      if (ex.target_weight !== undefined) {
        const weight = ex.target_weight;
        if (
          typeof weight !== 'number' ||
          !Number.isFinite(weight) ||
          weight < 0 ||
          weight > 500
        ) {
          return null;
        }
        targetWeight = weight;
      }

      exercises.push({
        exercise_name: ex.exercise_name,
        target_sets: ex.target_sets,
        target_reps: ex.target_reps,
        ...(targetWeight !== undefined ? { target_weight: targetWeight } : {}),
      });
    }

    days.push({
      day_of_week: day.day_of_week,
      name: day.name,
      is_rest_day: day.is_rest_day,
      exercises,
    });
  }

  return {
    name: obj.name,
    ...(description !== undefined ? { description } : {}),
    days,
  };
}

export const aiService = new AiService();
