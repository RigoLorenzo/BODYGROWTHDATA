-- Passi idempotenti eseguiti PRIMA di `prisma db push`, per le modifiche che
-- db push considera a rischio (e rifiuterebbe senza --accept-data-loss) ma
-- che sui dati esistenti sono sicure. Su un database nuovo non fa nulla.

-- Benessere per orologio: i giorni già salvati sono di Mi Fitness, unici per
-- (userId, date) e quindi anche per (userId, source, date).
DO $$
BEGIN
  IF to_regclass('"WellnessDay"') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeviceProvider') THEN
      CREATE TYPE "DeviceProvider" AS ENUM ('MI_FITNESS', 'GARMIN');
    END IF;
    ALTER TABLE "WellnessDay" ADD COLUMN IF NOT EXISTS "source" "DeviceProvider" NOT NULL DEFAULT 'MI_FITNESS';
    CREATE UNIQUE INDEX IF NOT EXISTS "WellnessDay_userId_source_date_key" ON "WellnessDay" ("userId", "source", "date");
  END IF;
END $$;

-- Sedute importate dagli smartwatch: colonne nuove (tutte vuote) e vincolo
-- unico sull'attività di origine. Con valori NULL non ci sono duplicati.
DO $$
BEGIN
  IF to_regclass('"WorkoutSession"') IS NOT NULL THEN
    ALTER TABLE "WorkoutSession" ADD COLUMN IF NOT EXISTS "source" "ActivitySource";
    ALTER TABLE "WorkoutSession" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS "WorkoutSession_userId_source_externalId_key"
      ON "WorkoutSession" ("userId", "source", "externalId");
  END IF;
END $$;
