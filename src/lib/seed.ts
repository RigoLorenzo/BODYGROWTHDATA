import { PrismaClient, ExerciseCategory, MuscleGroup, Equipment } from "@prisma/client";
import { prisma as defaultPrisma } from "./prisma";
import { exerciseLibrary } from "./exercise-library";

/**
 * Esercizi rinominati rispetto alla prima versione della libreria.
 * Mappa "nome nuovo" -> "id storico", così gli allenamenti e i piani già
 * salvati continuano a puntare alla stessa riga invece di generare un doppione.
 */
const legacyIdByName: Record<string, string> = {
  "Chest Dip": "seed-dip",
  "Seated Cable Row": "seed-cable-row",
  "Chest-Supported T-Bar Row": "seed-chest-supported-row",
  "Straight-Arm Pulldown": "seed-straight-arm-pulldown",
  "Back Extension": "seed-hyperextension",
  "Rear Delt Fly": "seed-reverse-fly",
  "Close-Grip Bench Press": "seed-close-grip-bench-press",
  "Triceps Dip": "seed-tricep-dip",
  "EZ-Bar Skullcrusher": "seed-skull-crusher",
  "Triceps Pushdown": "seed-cable-tricep-pushdown",
  "Overhead Dumbbell Extension": "seed-overhead-tricep-extension",
  "Triceps Kickback": "seed-kickback",
  "Back Squat": "seed-barbell-back-squat",
  "Hack Squat Machine": "seed-hack-squat",
  "Walking Lunge": "seed-lunge",
  "Step-Up": "seed-step-up",
  "Barbell Hip Thrust": "seed-hip-thrust",
  "Lying Leg Curl": "seed-leg-curl",
  "Standing Calf Raise": "seed-calf-raise",
  "Cable Glute Kickback": "seed-glute-kickback",
  "Hip Abduction Machine": "seed-abductor-machine",
  "Hip Adduction Machine": "seed-adductor-machine",
  "Ab Wheel Rollout": "seed-ab-rollout",
  "Farmer's Walk": "seed-farmer's-walk",
};

function exerciseId(name: string): string {
  return (
    legacyIdByName[name] ??
    `seed-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`
  );
}

const achievements = [
  { slug: "first-workout", name: "First Step", description: "Complete your first workout", iconEmoji: "🏋️", tier: "BRONZE", xpReward: 50, criteria: { type: "total_workouts", value: 1 } },
  { slug: "streak-7", name: "Week Warrior", description: "Maintain a 7-day workout streak", iconEmoji: "🔥", tier: "SILVER", xpReward: 200, criteria: { type: "streak", value: 7 } },
  { slug: "streak-30", name: "Monthly Grind", description: "Maintain a 30-day workout streak", iconEmoji: "💪", tier: "GOLD", xpReward: 500, criteria: { type: "streak", value: 30 } },
  { slug: "streak-100", name: "Century Club", description: "Maintain a 100-day workout streak", iconEmoji: "🏆", tier: "PLATINUM", xpReward: 2000, criteria: { type: "streak", value: 100 } },
  { slug: "streak-365", name: "Year of Iron", description: "Maintain a 365-day workout streak", iconEmoji: "💎", tier: "DIAMOND", xpReward: 10000, criteria: { type: "streak", value: 365 } },
  { slug: "total-workouts-10", name: "Getting Started", description: "Complete 10 workouts", iconEmoji: "✅", tier: "BRONZE", xpReward: 100, criteria: { type: "total_workouts", value: 10 } },
  { slug: "total-workouts-50", name: "Dedicated", description: "Complete 50 workouts", iconEmoji: "🎯", tier: "SILVER", xpReward: 300, criteria: { type: "total_workouts", value: 50 } },
  { slug: "total-workouts-100", name: "Centurion", description: "Complete 100 workouts", iconEmoji: "💯", tier: "GOLD", xpReward: 1000, criteria: { type: "total_workouts", value: 100 } },
  { slug: "volume-100k", name: "100k Club", description: "Lift 100,000 kg total lifetime volume", iconEmoji: "📊", tier: "SILVER", xpReward: 400, criteria: { type: "total_volume", value: 100000 } },
  { slug: "volume-1m", name: "Million Kg Club", description: "Lift 1,000,000 kg total lifetime volume", iconEmoji: "🚀", tier: "DIAMOND", xpReward: 5000, criteria: { type: "total_volume", value: 1000000 } },
  { slug: "first-pr", name: "Personal Best", description: "Set your first personal record", iconEmoji: "⭐", tier: "BRONZE", xpReward: 75, criteria: { type: "total_prs", value: 1 } },
  { slug: "prs-10", name: "Record Breaker", description: "Set 10 personal records", iconEmoji: "🌟", tier: "SILVER", xpReward: 250, criteria: { type: "total_prs", value: 10 } },
  { slug: "early-bird", name: "Early Bird", description: "Complete a workout before 6 AM", iconEmoji: "🌅", tier: "BRONZE", xpReward: 100, criteria: { type: "workout_time", value: 6 } },
  { slug: "night-owl", name: "Night Owl", description: "Complete a workout after 10 PM", iconEmoji: "🦉", tier: "BRONZE", xpReward: 100, criteria: { type: "workout_time_after", value: 22 } },
  { slug: "volume-monster", name: "Volume Monster", description: "Accumulate 10,000 kg volume in a single week", iconEmoji: "👹", tier: "GOLD", xpReward: 750, criteria: { type: "weekly_volume", value: 10000 } },
  { slug: "consistency-king", name: "Consistency King", description: "Workout at least 4 times a week for 4 consecutive weeks", iconEmoji: "👑", tier: "GOLD", xpReward: 800, criteria: { type: "weekly_frequency", weeks: 4, minPerWeek: 4 } },
  { slug: "iron-will", name: "Iron Will", description: "Complete a workout with average RPE 9+", iconEmoji: "⚡", tier: "GOLD", xpReward: 500, criteria: { type: "session_avg_rpe", value: 9 } },
  { slug: "marathon-session", name: "Marathon Session", description: "Complete a workout lasting more than 2 hours", iconEmoji: "⏱️", tier: "SILVER", xpReward: 200, criteria: { type: "session_duration", value: 120 } },
  { slug: "comeback-kid", name: "Comeback Kid", description: "Return to training after a 2+ week break", iconEmoji: "🔄", tier: "BRONZE", xpReward: 150, criteria: { type: "return_after_break", value: 14 } },
  { slug: "social-butterfly", name: "Social Butterfly", description: "Share 5 workouts publicly", iconEmoji: "🦋", tier: "SILVER", xpReward: 200, criteria: { type: "workout_shares", value: 5 } },
];

export async function seedDatabase(
  client: PrismaClient = defaultPrisma
): Promise<{ exercises: number; achievements: number }> {
  for (const achievement of achievements) {
    await client.achievement.upsert({
      where: { slug: achievement.slug },
      update: { ...achievement, tier: achievement.tier as never },
      create: { ...achievement, tier: achievement.tier as never },
    });
  }

  const seededIds: string[] = [];

  for (const ex of exerciseLibrary) {
    const id = exerciseId(ex.name);
    seededIds.push(id);
    const data = {
      name: ex.name,
      nameIt: ex.nameIt,
      aliases: Array.from(new Set([...ex.aliases, ex.nameIt.toLowerCase()])),
      category: ex.category as ExerciseCategory,
      muscleGroups: ex.muscleGroups as MuscleGroup[],
      primaryMuscle: ex.primaryMuscle as MuscleGroup,
      equipment: ex.equipment as Equipment[],
      difficulty: ex.difficulty,
      isCustom: false,
      isPublic: true,
    };
    await client.exercise.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  // Vecchi esercizi di sistema non più in libreria: restano collegati allo storico
  // ma spariscono dalla ricerca, così non compaiono doppioni.
  await client.exercise.updateMany({
    where: { isCustom: false, id: { startsWith: "seed-" }, NOT: { id: { in: seededIds } } },
    data: { isPublic: false },
  });

  return { exercises: exerciseLibrary.length, achievements: achievements.length };
}
