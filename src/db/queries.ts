import { supabase } from "./client.js";
import type { UserSettings, UserSession } from "../types.js";

export async function getOrCreateUser(telegramId: number, username?: string) {
  const { data } = await supabase
    .from("lc_users")
    .select()
    .eq("telegram_id", telegramId)
    .single();

  if (data) return data;

  const { data: created, error } = await supabase
    .from("lc_users")
    .insert({ telegram_id: telegramId, username })
    .select()
    .single();

  if (error) throw error;
  return created;
}

export async function getUserSettings(
  telegramId: number,
): Promise<UserSettings> {
  const { data } = await supabase
    .from("lc_users")
    .select("settings")
    .eq("telegram_id", telegramId)
    .single();

  return (data?.settings as UserSettings) ?? {};
}

export async function updateUserSettings(
  telegramId: number,
  settings: UserSettings,
) {
  await supabase
    .from("lc_users")
    .update({ settings })
    .eq("telegram_id", telegramId);
}

export async function getSession(
  telegramId: number,
): Promise<UserSession | null> {
  const { data } = await supabase
    .from("lc_sessions")
    .select()
    .eq("telegram_id", telegramId)
    .single();

  if (!data) return null;
  return { problem_id: data.problem_id, quiz_index: data.quiz_index };
}

export async function upsertSession(
  telegramId: number,
  session: UserSession,
) {
  await supabase.from("lc_sessions").upsert({
    telegram_id: telegramId,
    problem_id: session.problem_id,
    quiz_index: session.quiz_index,
  });
}

export async function deleteSession(telegramId: number) {
  await supabase
    .from("lc_sessions")
    .delete()
    .eq("telegram_id", telegramId);
}

export async function recordAttempt(
  telegramId: number,
  problemId: number,
  quizIndex: number,
  selected: number,
  correct: boolean,
) {
  await supabase.from("lc_attempts").insert({
    telegram_id: telegramId,
    problem_id: problemId,
    quiz_index: quizIndex,
    selected,
    correct,
  });
}

export async function getOrCreateStats(telegramId: number) {
  const { data } = await supabase
    .from("lc_user_stats")
    .select()
    .eq("telegram_id", telegramId)
    .single();

  if (data) return data;

  const { data: created, error } = await supabase
    .from("lc_user_stats")
    .insert({ telegram_id: telegramId })
    .select()
    .single();

  if (error) throw error;
  return created;
}

export async function updateStatsOnCorrect(telegramId: number) {
  const stats = await getOrCreateStats(telegramId);
  const today = new Date().toISOString().split("T")[0];
  const lastActive = stats.last_active;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const streakContinues = lastActive === yesterdayStr || lastActive === today;
  const newStreak = streakContinues ? stats.current_streak + 1 : 1;

  await supabase
    .from("lc_user_stats")
    .update({
      current_streak: newStreak,
      longest_streak: Math.max(newStreak, stats.longest_streak),
      total_correct: stats.total_correct + 1,
      total_attempts: stats.total_attempts + 1,
      xp: stats.xp + 10,
      last_active: today,
    })
    .eq("telegram_id", telegramId);
}

export async function updateStatsOnIncorrect(telegramId: number) {
  const stats = await getOrCreateStats(telegramId);
  const today = new Date().toISOString().split("T")[0];

  await supabase
    .from("lc_user_stats")
    .update({
      total_attempts: stats.total_attempts + 1,
      last_active: today,
    })
    .eq("telegram_id", telegramId);
}

export async function getSolvedProblemIds(
  telegramId: number,
): Promise<number[]> {
  const { data } = await supabase
    .from("lc_attempts")
    .select("problem_id")
    .eq("telegram_id", telegramId)
    .eq("correct", true);

  if (!data) return [];
  return [...new Set(data.map((r) => r.problem_id))];
}
