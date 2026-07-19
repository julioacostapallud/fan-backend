import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscountType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { calculateSale } from '../common/money/sale-calculator';
import { normalizeText, sanitizeText } from '../common/utils/normalize';
import { parseFromDate, parseToDate } from '../common/utils/dates';

const LIST_ITEM_SELECT = {
  id: true,
  saleId: true,
  productId: true,
  motifId: true,
  quantity: true,
  unitPrice: true,
  lineSubtotal: true,
  discountType: true,
  discountValue: true,
  discountAmount: true,
  lineTotal: true,
  imageMimeType: true,
  createdAt: true,
  updatedAt: true,
  product: { select: { id: true, name: true } },
  motif: { select: { id: true, name: true } },
  // intentionally omit imageBase64
} satisfies Prisma.SaleItemSelect;

@Injectable()
export class SalesService {
  private readonly maxImageBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.maxImageBytes = Number(
      this.config.get('MAX_PROCESSED_IMAGE_BYTES') ?? 409600,
    );
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    from?: string;
    to?: string;
  }) {
    const page = Math.max(params.page ?? 1, 1);
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 50);
    const from = parseFromDate(params.from);
    const to = parseToDate(params.to);

    const where: Prisma.SaleWhereInput = {};
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }

    const [total, items] = await Promise.all([
      this.prisma.sale.count({ where }),
      this.prisma.sale.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          items: {
            select: LIST_ITEM_SELECT,
          },
        },
      }),
    ]);

    return {
      data: items.map((sale) => this.toListDto(sale)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findOne(id: string, includeImages = true) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true } },
            motif: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }
    if (!includeImages) {
      return {
        ...sale,
        items: sale.items.map(({ imageBase64: _img, ...rest }) => rest),
      };
    }
    return sale;
  }

  async create(dto: CreateSaleDto, idempotencyKey: string) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException(
        'Se requiere el header Idempotency-Key para registrar una venta',
      );
    }
    const key = idempotencyKey.trim().slice(0, 128);

    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: { key },
    });
    if (existing) {
      return this.findOne(existing.saleId);
    }

    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('Uno o más productos no existen');
    }
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of dto.items) {
      this.validateImage(item.imageBase64, item.imageMimeType);
    }

    const calcInputs = dto.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const unitPrice =
        item.unitPrice !== undefined && item.unitPrice !== null
          ? item.unitPrice
          : product.defaultPrice.toString();
      return {
        quantity: item.quantity,
        unitPrice,
        discountType: item.discountType as 'NONE' | 'FIXED' | 'PERCENTAGE',
        discountValue: item.discountValue ?? 0,
      };
    });

    let calc;
    try {
      calc = calculateSale({
        items: calcInputs,
        generalDiscountType: dto.generalDiscountType as
          | 'NONE'
          | 'FIXED'
          | 'PERCENTAGE',
        generalDiscountValue: dto.generalDiscountValue ?? 0,
      });
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Error de cálculo',
      );
    }

    try {
      const saleId = await this.prisma.$transaction(async (tx) => {
        const again = await tx.idempotencyRecord.findUnique({ where: { key } });
        if (again) {
          return again.saleId;
        }

        const sale = await tx.sale.create({
          data: {
            subtotal: new Prisma.Decimal(calc.subtotal.toString()),
            generalDiscountType: dto.generalDiscountType,
            generalDiscountValue: new Prisma.Decimal(
              dto.generalDiscountValue ?? 0,
            ),
            generalDiscountAmount: new Prisma.Decimal(
              calc.generalDiscountAmount.toString(),
            ),
            total: new Prisma.Decimal(calc.total.toString()),
            notes: dto.notes ? sanitizeText(dto.notes, 500) : null,
          },
        });

        for (let i = 0; i < dto.items.length; i++) {
          const item = dto.items[i];
          const line = calc.items[i];
          const product = productMap.get(item.productId)!;
          const motifName = sanitizeText(item.motifName, 120);
          const normalizedName = normalizeText(motifName);

          let motif = await tx.motif.findUnique({ where: { normalizedName } });
          if (!motif) {
            motif = await tx.motif.create({
              data: { name: motifName, normalizedName },
            });
          }

          await tx.productMotif.upsert({
            where: {
              productId_motifId: {
                productId: product.id,
                motifId: motif.id,
              },
            },
            create: { productId: product.id, motifId: motif.id },
            update: {},
          });

          const unitPrice =
            item.unitPrice !== undefined && item.unitPrice !== null
              ? item.unitPrice
              : product.defaultPrice.toString();

          await tx.saleItem.create({
            data: {
              saleId: sale.id,
              productId: product.id,
              motifId: motif.id,
              quantity: item.quantity,
              unitPrice: new Prisma.Decimal(unitPrice),
              lineSubtotal: new Prisma.Decimal(line.lineSubtotal.toString()),
              discountType: item.discountType,
              discountValue: new Prisma.Decimal(item.discountValue ?? 0),
              discountAmount: new Prisma.Decimal(line.discountAmount.toString()),
              lineTotal: new Prisma.Decimal(line.lineTotal.toString()),
              imageBase64: item.imageBase64 || null,
              imageMimeType: item.imageBase64
                ? item.imageMimeType || 'image/jpeg'
                : null,
            },
          });
        }

        await tx.idempotencyRecord.create({
          data: { key, saleId: sale.id },
        });

        return sale.id;
      });

      return this.findOne(saleId);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const record = await this.prisma.idempotencyRecord.findUnique({
          where: { key },
        });
        if (record) {
          return this.findOne(record.saleId);
        }
      }
      throw err;
    }
  }

  private validateImage(base64?: string, mimeType?: string) {
    if (!base64) return;
    const approxBytes = Math.ceil((base64.length * 3) / 4);
    if (approxBytes > this.maxImageBytes) {
      throw new BadRequestException(
        `La imagen procesada supera el límite de ${this.maxImageBytes} bytes`,
      );
    }
    if (mimeType && !['image/jpeg', 'image/webp', 'image/png'].includes(mimeType)) {
      throw new BadRequestException('Tipo de imagen no permitido');
    }
  }

  private toListDto(
    sale: Prisma.SaleGetPayload<{
      include: { items: { select: typeof LIST_ITEM_SELECT } };
    }>,
  ) {
    const totalUnits = sale.items.reduce((acc, i) => acc + i.quantity, 0);
    const productSummary = this.buildProductSummary(sale.items);
    const itemDiscounts = sale.items.reduce(
      (acc, i) => acc.plus(i.discountAmount),
      new Prisma.Decimal(0),
    );

    return {
      id: sale.id,
      createdAt: sale.createdAt,
      updatedAt: sale.updatedAt,
      subtotal: sale.subtotal,
      generalDiscountType: sale.generalDiscountType,
      generalDiscountValue: sale.generalDiscountValue,
      generalDiscountAmount: sale.generalDiscountAmount,
      total: sale.total,
      notes: sale.notes,
      lineCount: sale.items.length,
      totalUnits,
      productSummary,
      itemDiscountsTotal: itemDiscounts,
      items: sale.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        motifId: item.motifId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineSubtotal: item.lineSubtotal,
        discountType: item.discountType,
        discountValue: item.discountValue,
        discountAmount: item.discountAmount,
        lineTotal: item.lineTotal,
        hasImage: Boolean(item.imageMimeType),
        product: item.product,
        motif: item.motif,
      })),
    };
  }

  private buildProductSummary(
    items: Array<{
      quantity: number;
      product: { name: string };
    }>,
  ): string[] {
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.product.name, (map.get(item.product.name) ?? 0) + item.quantity);
    }
    return [...map.entries()].map(([name, qty]) => `${name} × ${qty}`);
  }
}
