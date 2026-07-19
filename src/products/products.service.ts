import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeText, sanitizeText } from '../common/utils/normalize';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params?: { activeOnly?: boolean; q?: string }) {
    const where: Prisma.ProductWhereInput = {};
    if (params?.activeOnly) {
      where.isActive = true;
    }
    if (params?.q) {
      const q = normalizeText(params.q);
      where.OR = [
        { name: { contains: params.q, mode: 'insensitive' } },
        { normalizedName: { contains: q } },
      ];
    }
    return this.prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }
    return product;
  }

  async create(dto: CreateProductDto) {
    const name = sanitizeText(dto.name);
    const normalizedName = normalizeText(name);
    const existing = await this.prisma.product.findFirst({
      where: { normalizedName },
    });
    if (existing) {
      throw new ConflictException('Ya existe un producto con ese nombre');
    }
    return this.prisma.product.create({
      data: {
        name,
        normalizedName,
        defaultPrice: new Prisma.Decimal(dto.defaultPrice),
      },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    const data: Prisma.ProductUpdateInput = {};

    if (dto.name !== undefined) {
      const name = sanitizeText(dto.name);
      const normalizedName = normalizeText(name);
      const conflict = await this.prisma.product.findFirst({
        where: { normalizedName, NOT: { id } },
      });
      if (conflict) {
        throw new ConflictException('Ya existe un producto con ese nombre');
      }
      data.name = name;
      data.normalizedName = normalizedName;
    }
    if (dto.defaultPrice !== undefined) {
      data.defaultPrice = new Prisma.Decimal(dto.defaultPrice);
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    return this.prisma.product.update({ where: { id }, data });
  }

  async getMotifs(productId: string) {
    await this.findOne(productId);
    const links = await this.prisma.productMotif.findMany({
      where: { productId },
      include: { motif: true },
      orderBy: { motif: { name: 'asc' } },
    });
    return links.map((l) => l.motif);
  }

  async deactivateIfHasSales(id: string) {
    const salesCount = await this.prisma.saleItem.count({
      where: { productId: id },
    });
    if (salesCount > 0) {
      throw new BadRequestException(
        'El producto tiene ventas asociadas. Solo se puede desactivar.',
      );
    }
  }
}
