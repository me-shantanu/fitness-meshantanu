// data/starterTemplates.ts
// Ready-made weekly plans so a brand-new user can start training without
// building a plan from scratch. Exercise ids are intentionally empty and
// target weights null — users log their own working weights.
import { WorkoutDayForm, ExerciseForm } from '@/types/workout';

export type StarterLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  level: StarterLevel;
  days: WorkoutDayForm[];
}

const exercise = (name: string, sets: number, reps: number): ExerciseForm => ({
  id: '',
  name,
  sets,
  reps,
  weight: null,
  type: 'strength',
});

const workoutDay = (
  dayOfWeek: number,
  name: string,
  exercises: ExerciseForm[]
): WorkoutDayForm => ({
  dayOfWeek,
  name,
  isRestDay: false,
  exercises,
});

const restDay = (dayOfWeek: number): WorkoutDayForm => ({
  dayOfWeek,
  name: 'Rest',
  isRestDay: true,
  exercises: [],
});

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'starter-full-body-3',
    name: 'Beginner Full Body · 3 days',
    description:
      'Three simple full-body sessions a week — perfect if you are new to the gym and want to build strength without overthinking it.',
    level: 'Beginner',
    days: [
      workoutDay(0, 'Full Body A', [
        exercise('Squat', 3, 8),
        exercise('Bench Press', 3, 8),
        exercise('Barbell Row', 3, 8),
        exercise('Crunches', 3, 15),
      ]),
      restDay(1),
      workoutDay(2, 'Full Body B', [
        exercise('Deadlift', 3, 5),
        exercise('Overhead Press', 3, 8),
        exercise('Lat Pulldown', 3, 10),
        exercise('Lunges', 3, 10),
      ]),
      restDay(3),
      workoutDay(4, 'Full Body C', [
        exercise('Leg Press', 3, 10),
        exercise('Incline Dumbbell Press', 3, 10),
        exercise('Seated Cable Row', 3, 10),
        exercise('Bicep Curls', 3, 12),
      ]),
      restDay(5),
      restDay(6),
    ],
  },
  {
    id: 'starter-upper-lower-4',
    name: 'Upper / Lower · 4 days',
    description:
      'A balanced four-day split for lifters with some experience who want more volume than full-body training allows.',
    level: 'Intermediate',
    days: [
      workoutDay(0, 'Upper A', [
        exercise('Bench Press', 3, 8),
        exercise('Barbell Row', 3, 8),
        exercise('Overhead Press', 3, 10),
        exercise('Bicep Curls', 3, 12),
      ]),
      workoutDay(1, 'Lower A', [
        exercise('Squat', 3, 8),
        exercise('Romanian Deadlift', 3, 10),
        exercise('Leg Press', 3, 12),
        exercise('Calf Raises', 3, 15),
      ]),
      restDay(2),
      workoutDay(3, 'Upper B', [
        exercise('Incline Dumbbell Press', 3, 10),
        exercise('Lat Pulldown', 3, 10),
        exercise('Lateral Raises', 3, 12),
        exercise('Triceps Pushdown', 3, 12),
      ]),
      workoutDay(4, 'Lower B', [
        exercise('Deadlift', 3, 5),
        exercise('Lunges', 3, 10),
        exercise('Leg Curls', 3, 12),
        exercise('Calf Raises', 3, 15),
      ]),
      restDay(5),
      restDay(6),
    ],
  },
  {
    id: 'starter-ppl-6',
    name: 'Push / Pull / Legs · 6 days',
    description:
      'The classic six-day push/pull/legs split for advanced lifters who train nearly every day and want maximum volume per muscle group.',
    level: 'Advanced',
    days: [
      workoutDay(0, 'Push A', [
        exercise('Bench Press', 4, 8),
        exercise('Overhead Press', 3, 10),
        exercise('Incline Dumbbell Press', 3, 10),
        exercise('Triceps Pushdown', 3, 12),
      ]),
      workoutDay(1, 'Pull A', [
        exercise('Deadlift', 3, 5),
        exercise('Lat Pulldown', 3, 10),
        exercise('Barbell Row', 3, 8),
        exercise('Bicep Curls', 3, 12),
      ]),
      workoutDay(2, 'Legs A', [
        exercise('Squat', 4, 8),
        exercise('Leg Press', 3, 12),
        exercise('Leg Curls', 3, 12),
        exercise('Calf Raises', 3, 15),
      ]),
      workoutDay(3, 'Push B', [
        exercise('Incline Dumbbell Press', 4, 10),
        exercise('Overhead Press', 3, 8),
        exercise('Lateral Raises', 3, 12),
        exercise('Triceps Pushdown', 3, 12),
      ]),
      workoutDay(4, 'Pull B', [
        exercise('Barbell Row', 4, 8),
        exercise('Seated Cable Row', 3, 10),
        exercise('Lat Pulldown', 3, 10),
        exercise('Bicep Curls', 3, 12),
      ]),
      workoutDay(5, 'Legs B', [
        exercise('Romanian Deadlift', 3, 10),
        exercise('Leg Press', 3, 12),
        exercise('Lunges', 3, 10),
        exercise('Calf Raises', 3, 15),
      ]),
      restDay(6),
    ],
  },
];
