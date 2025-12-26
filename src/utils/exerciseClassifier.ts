export type ExerciseType = 'warmup' | 'workout' | 'cooldown';

export const classifyExerciseType = ({
  name,
  description,
}: {
  name: string;
  description: string;
}): ExerciseType => {
  const n = name.toLowerCase();
  const d = description.toLowerCase();

  if (
    n.includes('stretch') ||
    n.includes('mobility') ||
    d.includes('stretch')
  ) {
    return 'cooldown';
  }

  if (
    n.includes('warm') ||
    n.includes('activation') ||
    n.includes('band') ||
    d.includes('activation')
  ) {
    return 'warmup';
  }

  return 'workout';
};
