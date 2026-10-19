import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "../src/lib/seed";
import { provisionPlans } from "../src/lib/plan-provisioning";
import { provisionWellness } from "../src/lib/mifitness/wellness-provision";

const prisma = new PrismaClient();

const run = async () => {
  const { exercises, achievements } = await seedDatabase(prisma);
  console.log(`✅ Seeded ${exercises} exercises, ${achievements} achievements`);
  // Dopo la libreria: le schede risolvono gli esercizi per nome.
  await provisionPlans(prisma);
  console.log(`🩺 wellness resync: ${await provisionWellness(prisma)}`);
};

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
