import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeText } from '../common/utils/normalize';

@Injectable()
export class MotifsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q?: string, limit = 20, productId?: string) {
    const take = Math.min(Math.max(limit, 1), 50);
    const query = q?.trim();

    if (productId && !query) {
      const links = await this.prisma.productMotif.findMany({
        where: { productId },
        include: { motif: true },
        orderBy: { motif: { name: 'asc' } },
        take,
      });
      return links.map((l) => l.motif);
    }

    if (productId && query) {
      const normalized = normalizeText(query);
      const links = await this.prisma.productMotif.findMany({
        where: {
          productId,
          motif: {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { normalizedName: { contains: normalized } },
            ],
          },
        },
        include: { motif: true },
        orderBy: { motif: { name: 'asc' } },
        take,
      });
      const fromProduct = links.map((l) => l.motif);
      if (fromProduct.length >= take) return fromProduct;

      const extras = await this.prisma.motif.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { normalizedName: { contains: normalized } },
          ],
          NOT: { id: { in: fromProduct.map((m) => m.id) } },
        },
        orderBy: { name: 'asc' },
        take: take - fromProduct.length,
      });
      return [...fromProduct, ...extras];
    }

    if (!query) {
      return this.prisma.motif.findMany({
        orderBy: { name: 'asc' },
        take,
      });
    }

    const normalized = normalizeText(query);
    return this.prisma.motif.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { normalizedName: { contains: normalized } },
        ],
      },
      orderBy: { name: 'asc' },
      take,
    });
  }
}
