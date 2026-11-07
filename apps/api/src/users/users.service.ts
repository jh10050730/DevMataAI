import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** 비밀번호 해시 등 민감 정보를 제외한 사용자 정보 */
  static toPublic(user: { id: string; email: string; name: string; createdAt: Date }) {
    return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  create(data: { email: string; name: string; passwordHash: string }) {
    return this.prisma.user.create({ data });
  }

  async getProfile(id: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    return UsersService.toPublic(user);
  }

  async updateProfile(id: string, data: { name?: string }) {
    const user = await this.prisma.user.update({ where: { id }, data });
    return UsersService.toPublic(user);
  }
}
