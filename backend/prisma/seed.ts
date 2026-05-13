import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { EmployeeStatus, PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL не задан');
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

function utcMonday(d = new Date()): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = x.getUTCDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  x.setUTCDate(x.getUTCDate() + delta);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

async function main(): Promise<void> {
  await prisma.task.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.refreshToken.deleteMany();

  const pass = await bcrypt.hash('Demo123!', 11);
  await prisma.user.deleteMany({
    where: {
      email: {
        in: ['admin@minkert.local', 'lead@minkert.local', 'view@minkert.local'],
      },
    },
  });

  await prisma.user.createMany({
    data: [
      {
        email: 'admin@minkert.local',
        passwordHash: pass,
        name: 'Екатерина Морозова',
        role: UserRole.ADMIN,
      },
      {
        email: 'lead@minkert.local',
        passwordHash: pass,
        name: 'Александр Петров',
        role: UserRole.MANAGER,
      },
      {
        email: 'view@minkert.local',
        passwordHash: pass,
        name: 'Наблюдатель',
        role: UserRole.VIEWER,
      },
    ],
    skipDuplicates: false,
  });

  const week = utcMonday(new Date());

  const emp = await Promise.all([
    prisma.employee.create({
      data: {
        name: 'Елена Сорокина',
        position: 'Продукт-менеджер',
        status: EmployeeStatus.ACTIVE,
      },
    }),
    prisma.employee.create({
      data: {
        name: 'Олег Ким',
        position: 'Руководитель отдела',
        status: EmployeeStatus.ACTIVE,
      },
    }),
    prisma.employee.create({
      data: {
        name: 'Мария Алиева',
        position: 'Специалист по аналитике',
        status: EmployeeStatus.ON_LEAVE,
      },
    }),
  ]);

  const elena = emp[0]!;
  const oleg = emp[1]!;

  await prisma.user.update({
    where: { email: 'view@minkert.local' },
    data: { linkedEmployeeId: elena.id },
  });

  await prisma.task.createMany({
    data: [
      {
        employeeId: elena.id,
        title: 'Подготовка отчётности по задачам',
        description: 'Сбор показателей и выравнивание KPI по команде.',
        taskDate: week,
        mon: 1,
        tue: 2,
        wed: 1,
        thu: 2,
        fri: 1,
        sat: 0,
        sun: 0,
      },
      {
        employeeId: elena.id,
        title: 'План спринта +1',
        taskDate: week,
        mon: 0,
        tue: 1,
        wed: 1,
        thu: 2,
        fri: 1,
        sat: 0,
        sun: 0,
      },
      {
        employeeId: oleg.id,
        title: 'Кросс-проверка процессов',
        taskDate: week,
        mon: 2,
        tue: 1,
        wed: 1,
        thu: 2,
        fri: 2,
        sat: 0,
        sun: 0,
      },
      {
        employeeId: oleg.id,
        title: '1:1 с ключевой командой',
        taskDate: week,
        mon: 1,
        tue: 1,
        wed: 0,
        thu: 1,
        fri: 1,
        sat: 0,
        sun: 0,
      },
    ],
  });
}

main()
  .then(() => {
    console.log('[seed] готово.');
    console.log('  Логины: admin@minkert.local, lead@minkert.local, view@minkert.local');
    console.log('  Пароль: Demo123!');
    console.log('  У view@minkert.local привязана карточка первого сотрудника — можно менять дни в её задачах.');
  })
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
