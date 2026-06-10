-- Длительность записи в минутах (гибкое расписание)
ALTER TABLE "CrmAppointment" ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER NOT NULL DEFAULT 60;
