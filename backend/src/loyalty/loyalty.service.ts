import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function validateSlot(slot: number): number {
  if (!Number.isFinite(slot) || slot < 1 || slot > 10) {
    throw new BadRequestException('slot должен быть от 1 до 10');
  }
  return Math.trunc(slot);
}

function giftEligible(stamps: Array<{ slot: number }>): boolean {
  const have = new Set(stamps.map((s) => s.slot));
  for (let i = 1; i <= 9; i++) {
    if (!have.has(i)) return false;
  }
  return true;
}

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  async listClients(query?: string) {
    const q = query?.trim();
    const digits = q ? normalizePhone(q) : '';
    const items = await this.prisma.loyaltyClient.findMany({
      where:
        q ?
          {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
              ...(digits ? [{ phoneNormalized: { contains: digits } }] : []),
            ],
          }
        : undefined,
      include: { stamps: { orderBy: { slot: 'asc' } } },
      orderBy: [{ updatedAt: 'desc' }],
      take: 200,
    });
    return items.map((c) => ({
      ...c,
      giftAvailable: giftEligible(c.stamps),
      giftClaimed: c.stamps.some((s) => s.slot === 10),
    }));
  }

  async createClient(body: { name: string; phone: string }) {
    const name = body.name.trim();
    const phone = body.phone.trim();
    const phoneNormalized = normalizePhone(phone);
    if (!name) throw new BadRequestException('Имя клиента обязательно');
    if (phoneNormalized.length < 10) throw new BadRequestException('Введите корректный номер телефона');

    return this.prisma.loyaltyClient.create({
      data: { name, phone, phoneNormalized },
      include: { stamps: { orderBy: { slot: 'asc' } } },
    });
  }

  async upsertStamp(clientId: string, slotRaw: number, masterName: string) {
    const slot = validateSlot(slotRaw);
    const client = await this.prisma.loyaltyClient.findUnique({
      where: { id: clientId },
      include: { stamps: true },
    });
    if (!client) throw new NotFoundException('Клиент не найден');

    if (slot === 10 && !giftEligible(client.stamps)) {
      throw new BadRequestException('10-е сердечко доступно только после 9 процедур');
    }

    const cleanMaster = masterName.trim();
    if (!cleanMaster) {
      await this.prisma.loyaltyStamp.deleteMany({ where: { clientId, slot } });
    } else {
      await this.prisma.loyaltyStamp.upsert({
        where: { clientId_slot: { clientId, slot } },
        create: { clientId, slot, masterName: cleanMaster, stampedAt: new Date() },
        update: { masterName: cleanMaster, stampedAt: new Date() },
      });
    }

    const updated = await this.prisma.loyaltyClient.findUniqueOrThrow({
      where: { id: clientId },
      include: { stamps: { orderBy: { slot: 'asc' } } },
    });
    return {
      ...updated,
      giftAvailable: giftEligible(updated.stamps),
      giftClaimed: updated.stamps.some((s) => s.slot === 10),
    };
  }
}
