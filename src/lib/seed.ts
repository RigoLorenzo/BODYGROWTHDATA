import { PrismaClient, ExerciseCategory, MuscleGroup, Equipment } from "@prisma/client";
import { prisma as defaultPrisma } from "./prisma";

const exercises = [
  // CHEST - Compound
  { name: "Barbell Bench Press", aliases: ["bench press", "flat bench", "pettorali piana"], category: "COMPOUND", muscleGroups: ["CHEST", "TRICEPS", "SHOULDERS"], primaryMuscle: "CHEST", equipment: ["BARBELL"], difficulty: 3 },
  { name: "Incline Barbell Bench Press", aliases: ["incline bench", "panca inclinata"], category: "COMPOUND", muscleGroups: ["CHEST", "TRICEPS", "SHOULDERS"], primaryMuscle: "CHEST", equipment: ["BARBELL"], difficulty: 3 },
  { name: "Decline Barbell Bench Press", aliases: ["decline bench", "panca declinata"], category: "COMPOUND", muscleGroups: ["CHEST", "TRICEPS"], primaryMuscle: "CHEST", equipment: ["BARBELL"], difficulty: 3 },
  { name: "Dumbbell Bench Press", aliases: ["db bench press", "manubri piana"], category: "COMPOUND", muscleGroups: ["CHEST", "TRICEPS", "SHOULDERS"], primaryMuscle: "CHEST", equipment: ["DUMBBELL"], difficulty: 2 },
  { name: "Incline Dumbbell Press", aliases: ["incline db press", "manubri inclinata"], category: "COMPOUND", muscleGroups: ["CHEST", "TRICEPS", "SHOULDERS"], primaryMuscle: "CHEST", equipment: ["DUMBBELL"], difficulty: 2 },
  { name: "Push-Up", aliases: ["pushup", "flessioni", "piegamenti"], category: "COMPOUND", muscleGroups: ["CHEST", "TRICEPS", "CORE"], primaryMuscle: "CHEST", equipment: ["BODYWEIGHT"], difficulty: 1 },
  { name: "Dip", aliases: ["dips", "parallel bars dip", "parallele"], category: "COMPOUND", muscleGroups: ["CHEST", "TRICEPS", "SHOULDERS"], primaryMuscle: "CHEST", equipment: ["BODYWEIGHT"], difficulty: 3 },
  // CHEST - Isolation
  { name: "Cable Fly", aliases: ["cable crossover", "croci ai cavi"], category: "ISOLATION", muscleGroups: ["CHEST"], primaryMuscle: "CHEST", equipment: ["CABLE"], difficulty: 2 },
  { name: "Dumbbell Fly", aliases: ["db fly", "croci con manubri"], category: "ISOLATION", muscleGroups: ["CHEST"], primaryMuscle: "CHEST", equipment: ["DUMBBELL"], difficulty: 2 },
  { name: "Pec Deck", aliases: ["chest fly machine", "butterfly", "farfalla"], category: "ISOLATION", muscleGroups: ["CHEST"], primaryMuscle: "CHEST", equipment: ["MACHINE"], difficulty: 1 },
  // BACK - Compound
  { name: "Deadlift", aliases: ["stacco", "stacco da terra", "conventional deadlift"], category: "COMPOUND", muscleGroups: ["BACK", "HAMSTRINGS", "GLUTES", "CORE"], primaryMuscle: "BACK", equipment: ["BARBELL"], difficulty: 5 },
  { name: "Romanian Deadlift", aliases: ["RDL", "stacco rumeno"], category: "COMPOUND", muscleGroups: ["HAMSTRINGS", "GLUTES", "BACK"], primaryMuscle: "HAMSTRINGS", equipment: ["BARBELL"], difficulty: 4 },
  { name: "Pull-Up", aliases: ["pullup", "trazioni", "chin-up"], category: "COMPOUND", muscleGroups: ["BACK", "BICEPS"], primaryMuscle: "BACK", equipment: ["BODYWEIGHT"], difficulty: 3 },
  { name: "Barbell Row", aliases: ["bent over row", "rematore bilanciere", "pendlay row"], category: "COMPOUND", muscleGroups: ["BACK", "BICEPS", "CORE"], primaryMuscle: "BACK", equipment: ["BARBELL"], difficulty: 4 },
  { name: "Dumbbell Row", aliases: ["one arm dumbbell row", "rematore manubrio"], category: "COMPOUND", muscleGroups: ["BACK", "BICEPS"], primaryMuscle: "BACK", equipment: ["DUMBBELL"], difficulty: 2 },
  { name: "Cable Row", aliases: ["seated cable row", "rematore cavo"], category: "COMPOUND", muscleGroups: ["BACK", "BICEPS"], primaryMuscle: "BACK", equipment: ["CABLE"], difficulty: 2 },
  { name: "Lat Pulldown", aliases: ["lat machine", "pulldown"], category: "COMPOUND", muscleGroups: ["BACK", "BICEPS"], primaryMuscle: "BACK", equipment: ["CABLE"], difficulty: 1 },
  { name: "T-Bar Row", aliases: ["t bar row", "rematore t-bar"], category: "COMPOUND", muscleGroups: ["BACK", "BICEPS"], primaryMuscle: "BACK", equipment: ["BARBELL"], difficulty: 3 },
  { name: "Chest-Supported Row", aliases: ["chest supported machine row"], category: "COMPOUND", muscleGroups: ["BACK", "BICEPS"], primaryMuscle: "BACK", equipment: ["MACHINE"], difficulty: 2 },
  // BACK - Isolation
  { name: "Straight Arm Pulldown", aliases: ["straight arm cable pulldown", "pullover al cavo"], category: "ISOLATION", muscleGroups: ["BACK"], primaryMuscle: "BACK", equipment: ["CABLE"], difficulty: 2 },
  { name: "Face Pull", aliases: ["rear delt pull", "tirate al viso"], category: "ISOLATION", muscleGroups: ["BACK", "SHOULDERS"], primaryMuscle: "BACK", equipment: ["CABLE"], difficulty: 2 },
  { name: "Hyperextension", aliases: ["back extension", "estensioni schiena"], category: "ISOLATION", muscleGroups: ["BACK", "GLUTES"], primaryMuscle: "BACK", equipment: ["BODYWEIGHT"], difficulty: 2 },
  // SHOULDERS - Compound
  { name: "Overhead Press", aliases: ["OHP", "military press", "press in piedi"], category: "COMPOUND", muscleGroups: ["SHOULDERS", "TRICEPS"], primaryMuscle: "SHOULDERS", equipment: ["BARBELL"], difficulty: 4 },
  { name: "Seated Dumbbell Press", aliases: ["db shoulder press", "press seduto manubri"], category: "COMPOUND", muscleGroups: ["SHOULDERS", "TRICEPS"], primaryMuscle: "SHOULDERS", equipment: ["DUMBBELL"], difficulty: 3 },
  { name: "Arnold Press", aliases: ["arnold dumbbell press"], category: "COMPOUND", muscleGroups: ["SHOULDERS", "TRICEPS"], primaryMuscle: "SHOULDERS", equipment: ["DUMBBELL"], difficulty: 3 },
  // SHOULDERS - Isolation
  { name: "Lateral Raise", aliases: ["side raise", "alzate laterali"], category: "ISOLATION", muscleGroups: ["SHOULDERS"], primaryMuscle: "SHOULDERS", equipment: ["DUMBBELL", "CABLE"], difficulty: 1 },
  { name: "Front Raise", aliases: ["anterior raise", "alzate frontali"], category: "ISOLATION", muscleGroups: ["SHOULDERS"], primaryMuscle: "SHOULDERS", equipment: ["DUMBBELL", "BARBELL"], difficulty: 1 },
  { name: "Reverse Fly", aliases: ["rear delt fly", "croci posteriori"], category: "ISOLATION", muscleGroups: ["SHOULDERS", "BACK"], primaryMuscle: "SHOULDERS", equipment: ["DUMBBELL", "CABLE"], difficulty: 2 },
  { name: "Upright Row", aliases: ["barbell upright row", "rematore verticale"], category: "COMPOUND", muscleGroups: ["SHOULDERS", "BACK"], primaryMuscle: "SHOULDERS", equipment: ["BARBELL", "CABLE"], difficulty: 3 },
  // BICEPS
  { name: "Barbell Curl", aliases: ["bb curl", "curl bilanciere"], category: "ISOLATION", muscleGroups: ["BICEPS"], primaryMuscle: "BICEPS", equipment: ["BARBELL"], difficulty: 2 },
  { name: "Dumbbell Curl", aliases: ["db curl", "curl manubri"], category: "ISOLATION", muscleGroups: ["BICEPS"], primaryMuscle: "BICEPS", equipment: ["DUMBBELL"], difficulty: 1 },
  { name: "Hammer Curl", aliases: ["neutral grip curl", "curl martello"], category: "ISOLATION", muscleGroups: ["BICEPS", "FOREARMS"], primaryMuscle: "BICEPS", equipment: ["DUMBBELL"], difficulty: 1 },
  { name: "Incline Dumbbell Curl", aliases: ["incline curl"], category: "ISOLATION", muscleGroups: ["BICEPS"], primaryMuscle: "BICEPS", equipment: ["DUMBBELL"], difficulty: 2 },
  { name: "Cable Curl", aliases: ["low cable curl", "curl al cavo"], category: "ISOLATION", muscleGroups: ["BICEPS"], primaryMuscle: "BICEPS", equipment: ["CABLE"], difficulty: 1 },
  { name: "Preacher Curl", aliases: ["scott curl", "curl al banco scott"], category: "ISOLATION", muscleGroups: ["BICEPS"], primaryMuscle: "BICEPS", equipment: ["BARBELL", "DUMBBELL"], difficulty: 2 },
  { name: "Concentration Curl", aliases: ["one arm curl"], category: "ISOLATION", muscleGroups: ["BICEPS"], primaryMuscle: "BICEPS", equipment: ["DUMBBELL"], difficulty: 1 },
  // TRICEPS
  { name: "Close Grip Bench Press", aliases: ["CGBP", "panca presa stretta"], category: "COMPOUND", muscleGroups: ["TRICEPS", "CHEST"], primaryMuscle: "TRICEPS", equipment: ["BARBELL"], difficulty: 3 },
  { name: "Tricep Dip", aliases: ["bench dip", "dip tricipiti"], category: "COMPOUND", muscleGroups: ["TRICEPS"], primaryMuscle: "TRICEPS", equipment: ["BODYWEIGHT"], difficulty: 2 },
  { name: "Skull Crusher", aliases: ["EZ bar skull crusher", "french press", "tricep extension"], category: "ISOLATION", muscleGroups: ["TRICEPS"], primaryMuscle: "TRICEPS", equipment: ["BARBELL", "DUMBBELL"], difficulty: 3 },
  { name: "Cable Tricep Pushdown", aliases: ["pushdown", "pushdown al cavo"], category: "ISOLATION", muscleGroups: ["TRICEPS"], primaryMuscle: "TRICEPS", equipment: ["CABLE"], difficulty: 1 },
  { name: "Overhead Tricep Extension", aliases: ["overhead extension", "french press in piedi"], category: "ISOLATION", muscleGroups: ["TRICEPS"], primaryMuscle: "TRICEPS", equipment: ["DUMBBELL", "CABLE"], difficulty: 2 },
  { name: "Kickback", aliases: ["tricep kickback", "calcio al tricipite"], category: "ISOLATION", muscleGroups: ["TRICEPS"], primaryMuscle: "TRICEPS", equipment: ["DUMBBELL"], difficulty: 1 },
  // LEGS - Compound
  { name: "Barbell Back Squat", aliases: ["squat", "back squat", "squat bilanciere"], category: "COMPOUND", muscleGroups: ["QUADS", "GLUTES", "HAMSTRINGS", "CORE"], primaryMuscle: "QUADS", equipment: ["BARBELL"], difficulty: 5 },
  { name: "Front Squat", aliases: ["front squat", "squat frontale"], category: "COMPOUND", muscleGroups: ["QUADS", "GLUTES", "CORE"], primaryMuscle: "QUADS", equipment: ["BARBELL"], difficulty: 5 },
  { name: "Goblet Squat", aliases: ["dumbbell squat", "squat calice"], category: "COMPOUND", muscleGroups: ["QUADS", "GLUTES"], primaryMuscle: "QUADS", equipment: ["DUMBBELL", "KETTLEBELL"], difficulty: 2 },
  { name: "Leg Press", aliases: ["machine leg press", "pressa"], category: "COMPOUND", muscleGroups: ["QUADS", "GLUTES", "HAMSTRINGS"], primaryMuscle: "QUADS", equipment: ["MACHINE"], difficulty: 2 },
  { name: "Hack Squat", aliases: ["machine hack squat"], category: "COMPOUND", muscleGroups: ["QUADS", "GLUTES"], primaryMuscle: "QUADS", equipment: ["MACHINE"], difficulty: 3 },
  { name: "Bulgarian Split Squat", aliases: ["rear foot elevated split squat", "split squat bulgaro"], category: "COMPOUND", muscleGroups: ["QUADS", "GLUTES", "HAMSTRINGS"], primaryMuscle: "QUADS", equipment: ["DUMBBELL", "BARBELL"], difficulty: 4 },
  { name: "Lunge", aliases: ["barbell lunge", "dumbbell lunge", "affondi"], category: "COMPOUND", muscleGroups: ["QUADS", "GLUTES", "HAMSTRINGS"], primaryMuscle: "QUADS", equipment: ["DUMBBELL", "BARBELL", "BODYWEIGHT"], difficulty: 2 },
  { name: "Step Up", aliases: ["box step up", "step up"], category: "COMPOUND", muscleGroups: ["QUADS", "GLUTES"], primaryMuscle: "QUADS", equipment: ["DUMBBELL", "BODYWEIGHT"], difficulty: 2 },
  { name: "Hip Thrust", aliases: ["barbell hip thrust", "glute bridge", "hip thrust"], category: "COMPOUND", muscleGroups: ["GLUTES", "HAMSTRINGS"], primaryMuscle: "GLUTES", equipment: ["BARBELL", "DUMBBELL"], difficulty: 3 },
  { name: "Good Morning", aliases: ["barbell good morning", "buongiorno"], category: "COMPOUND", muscleGroups: ["HAMSTRINGS", "BACK", "GLUTES"], primaryMuscle: "HAMSTRINGS", equipment: ["BARBELL"], difficulty: 4 },
  // LEGS - Isolation
  { name: "Leg Extension", aliases: ["quad extension", "estensione quadricipiti"], category: "ISOLATION", muscleGroups: ["QUADS"], primaryMuscle: "QUADS", equipment: ["MACHINE"], difficulty: 1 },
  { name: "Leg Curl", aliases: ["lying leg curl", "seated leg curl", "curl femorali"], category: "ISOLATION", muscleGroups: ["HAMSTRINGS"], primaryMuscle: "HAMSTRINGS", equipment: ["MACHINE"], difficulty: 1 },
  { name: "Calf Raise", aliases: ["standing calf raise", "seated calf raise", "polpacci"], category: "ISOLATION", muscleGroups: ["CALVES"], primaryMuscle: "CALVES", equipment: ["MACHINE", "BODYWEIGHT", "DUMBBELL"], difficulty: 1 },
  { name: "Glute Kickback", aliases: ["cable glute kickback", "donkey kick"], category: "ISOLATION", muscleGroups: ["GLUTES"], primaryMuscle: "GLUTES", equipment: ["CABLE", "MACHINE"], difficulty: 1 },
  { name: "Abductor Machine", aliases: ["hip abductor", "abduttori"], category: "ISOLATION", muscleGroups: ["GLUTES"], primaryMuscle: "GLUTES", equipment: ["MACHINE"], difficulty: 1 },
  { name: "Adductor Machine", aliases: ["hip adductor", "adduttori"], category: "ISOLATION", muscleGroups: ["QUADS"], primaryMuscle: "QUADS", equipment: ["MACHINE"], difficulty: 1 },
  // CORE
  { name: "Plank", aliases: ["isometric plank", "tavola"], category: "ISOLATION", muscleGroups: ["CORE"], primaryMuscle: "CORE", equipment: ["BODYWEIGHT"], difficulty: 2 },
  { name: "Crunch", aliases: ["ab crunch", "addominali"], category: "ISOLATION", muscleGroups: ["CORE"], primaryMuscle: "CORE", equipment: ["BODYWEIGHT"], difficulty: 1 },
  { name: "Cable Crunch", aliases: ["kneeling cable crunch", "crunch al cavo"], category: "ISOLATION", muscleGroups: ["CORE"], primaryMuscle: "CORE", equipment: ["CABLE"], difficulty: 2 },
  { name: "Hanging Leg Raise", aliases: ["hanging knee raise", "alzate gambe"], category: "ISOLATION", muscleGroups: ["CORE"], primaryMuscle: "CORE", equipment: ["BODYWEIGHT"], difficulty: 3 },
  { name: "Ab Rollout", aliases: ["ab wheel rollout", "ruota addominali"], category: "ISOLATION", muscleGroups: ["CORE", "BACK"], primaryMuscle: "CORE", equipment: ["BODYWEIGHT"], difficulty: 4 },
  { name: "Russian Twist", aliases: ["oblique twist", "rotazione russa"], category: "ISOLATION", muscleGroups: ["CORE"], primaryMuscle: "CORE", equipment: ["BODYWEIGHT", "DUMBBELL"], difficulty: 2 },
  { name: "Dead Bug", aliases: ["supine dead bug"], category: "ISOLATION", muscleGroups: ["CORE"], primaryMuscle: "CORE", equipment: ["BODYWEIGHT"], difficulty: 2 },
  { name: "Pallof Press", aliases: ["cable pallof press", "anti-rotation press"], category: "ISOLATION", muscleGroups: ["CORE"], primaryMuscle: "CORE", equipment: ["CABLE"], difficulty: 2 },
  // FULL BODY / CARDIO
  { name: "Burpee", aliases: ["burpees"], category: "COMPOUND", muscleGroups: ["FULL_BODY"], primaryMuscle: "FULL_BODY", equipment: ["BODYWEIGHT"], difficulty: 4 },
  { name: "Clean and Press", aliases: ["power clean", "clean and jerk", "pulita e slancio"], category: "COMPOUND", muscleGroups: ["FULL_BODY"], primaryMuscle: "FULL_BODY", equipment: ["BARBELL"], difficulty: 5 },
  { name: "Kettlebell Swing", aliases: ["kb swing", "swing con kettlebell"], category: "COMPOUND", muscleGroups: ["GLUTES", "HAMSTRINGS", "BACK", "CORE"], primaryMuscle: "GLUTES", equipment: ["KETTLEBELL"], difficulty: 3 },
  { name: "Box Jump", aliases: ["jump squat", "salto sulla box"], category: "COMPOUND", muscleGroups: ["QUADS", "GLUTES", "CALVES"], primaryMuscle: "QUADS", equipment: ["BODYWEIGHT"], difficulty: 3 },
  { name: "Farmer's Walk", aliases: ["farmers carry", "farmer walk"], category: "COMPOUND", muscleGroups: ["FOREARMS", "CORE", "BACK"], primaryMuscle: "FOREARMS", equipment: ["DUMBBELL", "KETTLEBELL"], difficulty: 3 },
  { name: "Battle Ropes", aliases: ["rope waves", "corde"], category: "CARDIO", muscleGroups: ["SHOULDERS", "CORE", "BACK"], primaryMuscle: "SHOULDERS", equipment: ["OTHER"], difficulty: 3 },
  { name: "Sled Push", aliases: ["prowler push", "spinta slitta"], category: "COMPOUND", muscleGroups: ["QUADS", "GLUTES", "CORE"], primaryMuscle: "QUADS", equipment: ["OTHER"], difficulty: 4 },
  { name: "Medicine Ball Slam", aliases: ["med ball slam"], category: "COMPOUND", muscleGroups: ["FULL_BODY", "CORE"], primaryMuscle: "CORE", equipment: ["OTHER"], difficulty: 3 },
];

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

  for (const ex of exercises) {
    const id = `seed-${ex.name.toLowerCase().replace(/\s+/g, "-")}`;
    const data = {
      name: ex.name,
      aliases: ex.aliases,
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

  return { exercises: exercises.length, achievements: achievements.length };
}
