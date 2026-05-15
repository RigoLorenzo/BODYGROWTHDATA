import { PrismaClient, ExerciseCategory, MuscleGroup, Equipment } from "@prisma/client";

const prisma = new PrismaClient();

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
  { name: "Back Extension", aliases: ["hyperextension", "lombare"], category: "ISOLATION", muscleGroups: ["BACK", "GLUTES", "HAMSTRINGS"], primaryMuscle: "BACK", equipment: ["MACHINE"], difficulty: 2 },

  // SHOULDERS - Compound
  { name: "Overhead Press", aliases: ["OHP", "military press", "press lento avanti", "shoulder press"], category: "COMPOUND", muscleGroups: ["SHOULDERS", "TRICEPS", "CORE"], primaryMuscle: "SHOULDERS", equipment: ["BARBELL"], difficulty: 4 },
  { name: "Dumbbell Shoulder Press", aliases: ["db shoulder press", "arnold press"], category: "COMPOUND", muscleGroups: ["SHOULDERS", "TRICEPS"], primaryMuscle: "SHOULDERS", equipment: ["DUMBBELL"], difficulty: 3 },
  { name: "Arnold Press", aliases: ["arnold dumbbell press"], category: "COMPOUND", muscleGroups: ["SHOULDERS", "TRICEPS"], primaryMuscle: "SHOULDERS", equipment: ["DUMBBELL"], difficulty: 3 },
  // SHOULDERS - Isolation
  { name: "Lateral Raise", aliases: ["side lateral raise", "alzate laterali"], category: "ISOLATION", muscleGroups: ["SHOULDERS"], primaryMuscle: "SHOULDERS", equipment: ["DUMBBELL"], difficulty: 2 },
  { name: "Front Raise", aliases: ["dumbbell front raise", "alzate frontali"], category: "ISOLATION", muscleGroups: ["SHOULDERS"], primaryMuscle: "SHOULDERS", equipment: ["DUMBBELL"], difficulty: 2 },
  { name: "Rear Delt Fly", aliases: ["face pull", "rear delt raise", "alzate posteriori"], category: "ISOLATION", muscleGroups: ["SHOULDERS", "BACK"], primaryMuscle: "SHOULDERS", equipment: ["DUMBBELL", "CABLE"], difficulty: 2 },
  { name: "Face Pull", aliases: ["cable face pull"], category: "ISOLATION", muscleGroups: ["SHOULDERS", "BACK"], primaryMuscle: "SHOULDERS", equipment: ["CABLE"], difficulty: 2 },
  { name: "Upright Row", aliases: ["upright barbell row"], category: "COMPOUND", muscleGroups: ["SHOULDERS", "BICEPS"], primaryMuscle: "SHOULDERS", equipment: ["BARBELL", "CABLE"], difficulty: 3 },

  // BICEPS
  { name: "Barbell Curl", aliases: ["bicep curl", "curl bilanciere", "EZ curl"], category: "ISOLATION", muscleGroups: ["BICEPS", "FOREARMS"], primaryMuscle: "BICEPS", equipment: ["BARBELL"], difficulty: 2 },
  { name: "Dumbbell Curl", aliases: ["alternating curl", "curl manubri"], category: "ISOLATION", muscleGroups: ["BICEPS", "FOREARMS"], primaryMuscle: "BICEPS", equipment: ["DUMBBELL"], difficulty: 1 },
  { name: "Hammer Curl", aliases: ["neutral grip curl", "curl martello"], category: "ISOLATION", muscleGroups: ["BICEPS", "FOREARMS"], primaryMuscle: "BICEPS", equipment: ["DUMBBELL"], difficulty: 1 },
  { name: "Incline Dumbbell Curl", aliases: ["incline curl"], category: "ISOLATION", muscleGroups: ["BICEPS"], primaryMuscle: "BICEPS", equipment: ["DUMBBELL"], difficulty: 2 },
  { name: "Cable Curl", aliases: ["low pulley curl", "curl al cavo"], category: "ISOLATION", muscleGroups: ["BICEPS"], primaryMuscle: "BICEPS", equipment: ["CABLE"], difficulty: 1 },
  { name: "Concentration Curl", aliases: ["scott curl", "preacher curl"], category: "ISOLATION", muscleGroups: ["BICEPS"], primaryMuscle: "BICEPS", equipment: ["DUMBBELL"], difficulty: 2 },
  { name: "Chin-Up", aliases: ["supinated pull-up", "trazioni supinate"], category: "COMPOUND", muscleGroups: ["BICEPS", "BACK"], primaryMuscle: "BICEPS", equipment: ["BODYWEIGHT"], difficulty: 3 },

  // TRICEPS
  { name: "Close-Grip Bench Press", aliases: ["close grip bench", "panca presa stretta"], category: "COMPOUND", muscleGroups: ["TRICEPS", "CHEST"], primaryMuscle: "TRICEPS", equipment: ["BARBELL"], difficulty: 3 },
  { name: "Tricep Pushdown", aliases: ["cable pushdown", "pushdown tricipiti"], category: "ISOLATION", muscleGroups: ["TRICEPS"], primaryMuscle: "TRICEPS", equipment: ["CABLE"], difficulty: 1 },
  { name: "Overhead Tricep Extension", aliases: ["skull crusher", "french press", "estensione tricipiti"], category: "ISOLATION", muscleGroups: ["TRICEPS"], primaryMuscle: "TRICEPS", equipment: ["BARBELL", "DUMBBELL"], difficulty: 3 },
  { name: "Tricep Dip", aliases: ["bench dip", "dip tricipiti"], category: "COMPOUND", muscleGroups: ["TRICEPS", "CHEST"], primaryMuscle: "TRICEPS", equipment: ["BODYWEIGHT"], difficulty: 2 },
  { name: "Skull Crusher", aliases: ["EZ bar skull crusher", "lying tricep extension"], category: "ISOLATION", muscleGroups: ["TRICEPS"], primaryMuscle: "TRICEPS", equipment: ["BARBELL"], difficulty: 3 },
  { name: "Diamond Push-Up", aliases: ["triangle push up"], category: "COMPOUND", muscleGroups: ["TRICEPS", "CHEST"], primaryMuscle: "TRICEPS", equipment: ["BODYWEIGHT"], difficulty: 3 },

  // LEGS - Compound
  { name: "Barbell Back Squat", aliases: ["squat", "back squat", "squat bilanciere"], category: "COMPOUND", muscleGroups: ["QUADS", "GLUTES", "HAMSTRINGS", "CORE"], primaryMuscle: "QUADS", equipment: ["BARBELL"], difficulty: 5 },
  { name: "Front Squat", aliases: ["front loaded squat"], category: "COMPOUND", muscleGroups: ["QUADS", "GLUTES", "CORE"], primaryMuscle: "QUADS", equipment: ["BARBELL"], difficulty: 5 },
  { name: "Goblet Squat", aliases: ["dumbbell squat"], category: "COMPOUND", muscleGroups: ["QUADS", "GLUTES", "CORE"], primaryMuscle: "QUADS", equipment: ["DUMBBELL", "KETTLEBELL"], difficulty: 2 },
  { name: "Bulgarian Split Squat", aliases: ["rear foot elevated split squat", "RFESS", "split squat"], category: "COMPOUND", muscleGroups: ["QUADS", "GLUTES", "HAMSTRINGS"], primaryMuscle: "QUADS", equipment: ["DUMBBELL", "BARBELL"], difficulty: 4 },
  { name: "Lunge", aliases: ["lunges", "affondi"], category: "COMPOUND", muscleGroups: ["QUADS", "GLUTES", "HAMSTRINGS"], primaryMuscle: "QUADS", equipment: ["DUMBBELL", "BARBELL", "BODYWEIGHT"], difficulty: 2 },
  { name: "Leg Press", aliases: ["machine leg press", "pressa"], category: "COMPOUND", muscleGroups: ["QUADS", "GLUTES", "HAMSTRINGS"], primaryMuscle: "QUADS", equipment: ["MACHINE"], difficulty: 2 },
  { name: "Hack Squat", aliases: ["machine hack squat"], category: "COMPOUND", muscleGroups: ["QUADS", "GLUTES"], primaryMuscle: "QUADS", equipment: ["MACHINE", "BARBELL"], difficulty: 3 },
  { name: "Sumo Deadlift", aliases: ["sumo dl", "stacco sumo"], category: "COMPOUND", muscleGroups: ["GLUTES", "HAMSTRINGS", "QUADS", "BACK"], primaryMuscle: "GLUTES", equipment: ["BARBELL"], difficulty: 4 },
  { name: "Hip Thrust", aliases: ["barbell hip thrust", "glute bridge", "hip hinge"], category: "COMPOUND", muscleGroups: ["GLUTES", "HAMSTRINGS"], primaryMuscle: "GLUTES", equipment: ["BARBELL", "DUMBBELL"], difficulty: 3 },
  { name: "Step-Up", aliases: ["box step up", "step up con manubri"], category: "COMPOUND", muscleGroups: ["QUADS", "GLUTES"], primaryMuscle: "QUADS", equipment: ["DUMBBELL", "BODYWEIGHT"], difficulty: 2 },
  // LEGS - Isolation
  { name: "Leg Extension", aliases: ["quad extension", "estensione gambe"], category: "ISOLATION", muscleGroups: ["QUADS"], primaryMuscle: "QUADS", equipment: ["MACHINE"], difficulty: 1 },
  { name: "Leg Curl", aliases: ["hamstring curl", "curl femorali"], category: "ISOLATION", muscleGroups: ["HAMSTRINGS"], primaryMuscle: "HAMSTRINGS", equipment: ["MACHINE"], difficulty: 1 },
  { name: "Seated Leg Curl", aliases: ["seated hamstring curl"], category: "ISOLATION", muscleGroups: ["HAMSTRINGS"], primaryMuscle: "HAMSTRINGS", equipment: ["MACHINE"], difficulty: 1 },
  { name: "Standing Calf Raise", aliases: ["calf raise", "soleus", "polpacci in piedi"], category: "ISOLATION", muscleGroups: ["CALVES"], primaryMuscle: "CALVES", equipment: ["MACHINE", "BODYWEIGHT"], difficulty: 1 },
  { name: "Seated Calf Raise", aliases: ["seated calf press", "polpacci seduto"], category: "ISOLATION", muscleGroups: ["CALVES"], primaryMuscle: "CALVES", equipment: ["MACHINE"], difficulty: 1 },
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

async function main() {
  console.log("🌱 Seeding database...");

  // Seed achievements
  for (const achievement of achievements) {
    await prisma.achievement.upsert({
      where: { slug: achievement.slug },
      update: achievement,
      create: {
        ...achievement,
        tier: achievement.tier as any,
      },
    });
  }
  console.log(`✅ Seeded ${achievements.length} achievements`);

  // Seed exercises
  for (const ex of exercises) {
    await prisma.exercise.upsert({
      where: {
        id: `seed-${ex.name.toLowerCase().replace(/\s+/g, "-")}`,
      },
      update: {
        name: ex.name,
        aliases: ex.aliases,
        category: ex.category as ExerciseCategory,
        muscleGroups: ex.muscleGroups as MuscleGroup[],
        primaryMuscle: ex.primaryMuscle as MuscleGroup,
        equipment: ex.equipment as Equipment[],
        difficulty: ex.difficulty,
        isCustom: false,
        isPublic: true,
      },
      create: {
        id: `seed-${ex.name.toLowerCase().replace(/\s+/g, "-")}`,
        name: ex.name,
        aliases: ex.aliases,
        category: ex.category as ExerciseCategory,
        muscleGroups: ex.muscleGroups as MuscleGroup[],
        primaryMuscle: ex.primaryMuscle as MuscleGroup,
        equipment: ex.equipment as Equipment[],
        difficulty: ex.difficulty,
        isCustom: false,
        isPublic: true,
      },
    });
  }
  console.log(`✅ Seeded ${exercises.length} exercises`);

  console.log("🎉 Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
