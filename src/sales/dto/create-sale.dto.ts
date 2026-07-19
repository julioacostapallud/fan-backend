import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DiscountType } from '@prisma/client';

export class CreateSaleItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ description: 'Nombre del motivo/diseño' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  motifName!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({
    description: 'Si se omite, se usa el precio predeterminado del producto',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;

  @ApiProperty({ enum: DiscountType, default: DiscountType.NONE })
  @IsEnum(DiscountType)
  discountType!: DiscountType;

  @ApiProperty({ example: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @ValidateIf((o: CreateSaleItemDto) => o.discountType === DiscountType.PERCENTAGE)
  @Max(100)
  discountValue!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(600000)
  imageBase64?: string;

  @ApiPropertyOptional({ example: 'image/jpeg' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  imageMimeType?: string;
}

export class CreateSaleDto {
  @ApiProperty({ type: [CreateSaleItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items!: CreateSaleItemDto[];

  @ApiProperty({ enum: DiscountType, default: DiscountType.NONE })
  @IsEnum(DiscountType)
  generalDiscountType!: DiscountType;

  @ApiProperty({ example: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @ValidateIf(
    (o: CreateSaleDto) => o.generalDiscountType === DiscountType.PERCENTAGE,
  )
  @Max(100)
  generalDiscountValue!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
