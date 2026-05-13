import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async requireById(id: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Пользователь не найден');
    return user;
  }

  async countUsers() {
    return this.prisma.user.count();
  }

  async registerUser(
    email: string,
    password: string,
    name: string,
    role: UserRole,
    linkedEmployeeId?: string | null,
  ) {
    const normalized = email.toLowerCase().trim();
    const existing = await this.findByEmail(normalized);
    if (existing) throw new ConflictException('Пользователь с таким email уже существует');
    const link =
      linkedEmployeeId === undefined || linkedEmployeeId === null || linkedEmployeeId === '' ?
        null
      : linkedEmployeeId;
    if (link) {
      const emp = await this.prisma.employee.findUnique({ where: { id: link } });
      if (!emp) throw new NotFoundException('Сотрудник для привязки не найден');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: {
        email: normalized,
        passwordHash,
        name: name.trim(),
        role,
        linkedEmployeeId: link,
      },
    });
  }

  async updateUserLinkedEmployee(userId: string, linkedEmployeeId: string | null) {
    await this.requireById(userId);
    if (linkedEmployeeId) {
      const emp = await this.prisma.employee.findUnique({ where: { id: linkedEmployeeId } });
      if (!emp) throw new NotFoundException('Сотрудник для привязки не найден');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { linkedEmployeeId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        linkedEmployeeId: true,
      },
    });
  }

  async updateMyProfile(userId: string, dto: { name: string; email: string }) {
    await this.requireById(userId);
    const normalizedEmail = dto.email.toLowerCase().trim();
    const existing = await this.findByEmail(normalizedEmail);
    if (existing && existing.id !== userId) {
      throw new ConflictException('Email уже занят другим пользователем');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name.trim(),
        email: normalizedEmail,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        linkedEmployeeId: true,
      },
    });
  }
}
