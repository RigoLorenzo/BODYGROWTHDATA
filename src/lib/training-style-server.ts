import { prisma } from "@/lib/prisma";
import { isTrainingStyle, type TrainingStyle } from "@/lib/training-style";

/** Lo stile dell'utente; null se non l'ha scelto o se il database non risponde */
export async function readTrainingStyle(userId: string): Promise<TrainingStyle | null> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { trainingStyle: true } });
    return isTrainingStyle(user?.trainingStyle) ? user.trainingStyle : null;
  } catch {
    return null;
  }
}
