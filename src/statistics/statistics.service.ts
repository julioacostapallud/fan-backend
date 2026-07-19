import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseFromDate, parseToDate } from '../common/utils/dates';

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildDateFilter(from?: string, to?: string): Prisma.SaleWhereInput {
    const fromDate = parseFromDate(from);
    const toDate = parseToDate(to);
    if (!fromDate && !toDate) return {};
    const createdAt: Prisma.DateTimeFilter = {};
    if (fromDate) createdAt.gte = fromDate;
    if (toDate) createdAt.lte = toDate;
    return { createdAt };
  }

  async summary(from?: string, to?: string) {
    const where = this.buildDateFilter(from, to);
    const sales = await this.prisma.sale.findMany({
      where,
      select: {
        id: true,
        total: true,
        subtotal: true,
        generalDiscountAmount: true,
        items: {
          select: {
            quantity: true,
            discountAmount: true,
          },
        },
      },
    });

    const salesCount = sales.length;
    let totalSold = new Prisma.Decimal(0);
    let totalUnits = 0;
    let totalDiscounts = new Prisma.Decimal(0);

    for (const sale of sales) {
      totalSold = totalSold.plus(sale.total);
      totalDiscounts = totalDiscounts.plus(sale.generalDiscountAmount);
      for (const item of sale.items) {
        totalUnits += item.quantity;
        totalDiscounts = totalDiscounts.plus(item.discountAmount);
      }
    }

    const averageTicket =
      salesCount > 0
        ? totalSold.div(salesCount).toDecimalPlaces(2)
        : new Prisma.Decimal(0);

    return {
      totalSold,
      salesCount,
      totalUnits,
      averageTicket,
      totalDiscounts,
    };
  }

  async byProducts(from?: string, to?: string) {
    const where = this.buildDateFilter(from, to);
    const items = await this.prisma.saleItem.findMany({
      where: { sale: where },
      select: {
        productId: true,
        motifId: true,
        quantity: true,
        lineSubtotal: true,
        discountAmount: true,
        lineTotal: true,
        saleId: true,
        product: { select: { id: true, name: true } },
        motif: { select: { id: true, name: true } },
      },
    });

    type MotifAgg = {
      motifId: string;
      motifName: string;
      units: number;
    };

    type ProductAgg = {
      productId: string;
      productName: string;
      units: number;
      salesCount: Set<string>;
      gross: Prisma.Decimal;
      discounts: Prisma.Decimal;
      net: Prisma.Decimal;
      motifs: Map<string, MotifAgg>;
    };

    const map = new Map<string, ProductAgg>();

    for (const item of items) {
      let agg = map.get(item.productId);
      if (!agg) {
        agg = {
          productId: item.productId,
          productName: item.product.name,
          units: 0,
          salesCount: new Set(),
          gross: new Prisma.Decimal(0),
          discounts: new Prisma.Decimal(0),
          net: new Prisma.Decimal(0),
          motifs: new Map(),
        };
        map.set(item.productId, agg);
      }
      agg.units += item.quantity;
      agg.salesCount.add(item.saleId);
      agg.gross = agg.gross.plus(item.lineSubtotal);
      agg.discounts = agg.discounts.plus(item.discountAmount);
      agg.net = agg.net.plus(item.lineTotal);

      let motifAgg = agg.motifs.get(item.motifId);
      if (!motifAgg) {
        motifAgg = {
          motifId: item.motifId,
          motifName: item.motif.name,
          units: 0,
        };
        agg.motifs.set(item.motifId, motifAgg);
      }
      motifAgg.units += item.quantity;
    }

    return [...map.values()]
      .map((p) => ({
        productId: p.productId,
        productName: p.productName,
        units: p.units,
        salesCount: p.salesCount.size,
        gross: p.gross,
        discounts: p.discounts,
        net: p.net,
        motifs: [...p.motifs.values()].sort((a, b) =>
          a.motifName.localeCompare(b.motifName, 'es'),
        ),
      }))
      .sort((a, b) => a.productName.localeCompare(b.productName, 'es'));
  }

  async byProduct(productId: string, from?: string, to?: string) {
    const all = await this.byProducts(from, to);
    const found = all.find((p) => p.productId === productId);
    return (
      found ?? {
        productId,
        productName: null,
        units: 0,
        salesCount: 0,
        gross: new Prisma.Decimal(0),
        discounts: new Prisma.Decimal(0),
        net: new Prisma.Decimal(0),
        motifs: [],
      }
    );
  }
}
