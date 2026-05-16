import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "../src/lib/seed";

const prisma = new PrismaClient();

seedDatabase(prisma)
  .then(({ exercises, achievements }) => {
    console.log(`✅ Seeded ${exercises} exercises, ${achievements} achievements`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
