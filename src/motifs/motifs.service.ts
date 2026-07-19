import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeText } from '../common/utils/normalize';

@Injectable()
export class MotifsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q?: string, limit = 20) {
    const take = Math.min(Math.max(limit, 1), 50);
    if (!q || !q.trim()) {
      return this.prisma.motif.findMany({
        orderBy: { name: 'asc' },
        take,
      });
    }
    const normalized = normalizeText(q);
    return this.prisma.motif.findMany({
      where: {
        OR: [
          { name: { contains: q.trim(), mode: 'insensitive' } },
          { normalizedName: { contains: normalized } },
        ],
      },
      orderBy: { name: 'asc' },
      take,
    });
  }
}
