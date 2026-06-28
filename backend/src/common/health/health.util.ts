import type { PrismaService } from '../../prisma/prisma.service';

export interface MigrationStatus {
  latest: string | null;
  appliedCount: number;
  pending: boolean;
}

export async function getMigrationStatus(
  prisma: PrismaService,
): Promise<MigrationStatus> {
  const rows = await prisma.$queryRaw<
    { migration_name: string; finished_at: Date | null }[]
  >`SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY finished_at DESC NULLS LAST`;

  const applied = rows.filter((r) => r.finished_at != null);
  const pending = rows.some((r) => r.finished_at == null);

  return {
    latest: applied[0]?.migration_name ?? null,
    appliedCount: applied.length,
    pending,
  };
}

export async function getDataCounts(prisma: PrismaService) {
  const [users, employees, crmClients, appointments] = await Promise.all([
    prisma.user.count(),
    prisma.employee.count(),
    prisma.crmClient.count(),
    prisma.crmAppointment.count(),
  ]);
  return { users, employees, crmClients, appointments };
}
