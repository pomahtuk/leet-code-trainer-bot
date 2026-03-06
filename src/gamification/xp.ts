const LEVELS = [
  { xp: 0, title: "Beginner" },
  { xp: 50, title: "Apprentice" },
  { xp: 150, title: "Practitioner" },
  { xp: 400, title: "Skilled" },
  { xp: 800, title: "Expert" },
  { xp: 1500, title: "Master" },
  { xp: 3000, title: "Grandmaster" },
];

export function getLevel(xp: number): { title: string; nextXp: number | null } {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xp) {
      return {
        title: LEVELS[i].title,
        nextXp: i < LEVELS.length - 1 ? LEVELS[i + 1].xp : null,
      };
    }
  }
  return { title: LEVELS[0].title, nextXp: LEVELS[1].xp };
}

export function formatStats(stats: {
  xp: number;
  current_streak: number;
  longest_streak: number;
  total_correct: number;
  total_attempts: number;
}): string {
  const level = getLevel(stats.xp);
  const accuracy =
    stats.total_attempts > 0
      ? Math.round((stats.total_correct / stats.total_attempts) * 100)
      : 0;

  let text = `Level: ${level.title}\n`;
  text += `XP: ${stats.xp}`;
  if (level.nextXp) text += ` / ${level.nextXp}`;
  text += `\nStreak: ${stats.current_streak} days (best: ${stats.longest_streak})\n`;
  text += `Accuracy: ${accuracy}% (${stats.total_correct}/${stats.total_attempts})`;
  return text;
}
