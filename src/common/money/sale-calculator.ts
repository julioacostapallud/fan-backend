import Decimal from 'decimal.js';

export type DiscountTypeValue = 'NONE' | 'FIXED' | 'PERCENTAGE';

export interface LineInput {
  quantity: number;
  unitPrice: Decimal.Value;
  discountType: DiscountTypeValue;
  discountValue: Decimal.Value;
}

export interface LineResult {
  lineSubtotal: Decimal;
  discountAmount: Decimal;
  lineTotal: Decimal;
}

export interface SaleCalcInput {
  items: LineInput[];
  generalDiscountType: DiscountTypeValue;
  generalDiscountValue: Decimal.Value;
}

export interface SaleCalcResult {
  items: LineResult[];
  subtotal: Decimal;
  generalDiscountAmount: Decimal;
  total: Decimal;
}

function toDecimal(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

function roundMoney(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function calculateDiscountAmount(
  base: Decimal,
  discountType: DiscountTypeValue,
  discountValue: Decimal.Value,
): Decimal {
  const value = toDecimal(discountValue);

  if (discountType === 'NONE') {
    return new Decimal(0);
  }

  if (discountType === 'PERCENTAGE') {
    if (value.lt(0) || value.gt(100)) {
      throw new Error('El porcentaje de descuento debe estar entre 0 y 100');
    }
    return roundMoney(base.mul(value).div(100));
  }

  // FIXED
  if (value.lt(0)) {
    throw new Error('El descuento fijo no puede ser negativo');
  }
  if (value.gt(base)) {
    throw new Error('El descuento fijo no puede superar el importe sobre el que se aplica');
  }
  return roundMoney(value);
}

export function calculateLineItem(input: LineInput): LineResult {
  if (input.quantity <= 0) {
    throw new Error('La cantidad debe ser mayor que cero');
  }

  const unitPrice = toDecimal(input.unitPrice);
  if (unitPrice.lt(0)) {
    throw new Error('El precio unitario no puede ser negativo');
  }

  const lineSubtotal = roundMoney(unitPrice.mul(input.quantity));
  const discountAmount = calculateDiscountAmount(
    lineSubtotal,
    input.discountType,
    input.discountValue,
  );
  const lineTotal = roundMoney(lineSubtotal.minus(discountAmount));

  if (lineTotal.lt(0)) {
    throw new Error('El total del artículo no puede ser negativo');
  }

  return { lineSubtotal, discountAmount, lineTotal };
}

export function calculateSale(input: SaleCalcInput): SaleCalcResult {
  if (!input.items.length) {
    throw new Error('Una venta debe contener al menos un artículo');
  }

  const items = input.items.map(calculateLineItem);
  const subtotal = roundMoney(
    items.reduce((acc, item) => acc.plus(item.lineTotal), new Decimal(0)),
  );

  const generalDiscountAmount = calculateDiscountAmount(
    subtotal,
    input.generalDiscountType,
    input.generalDiscountValue,
  );

  const total = roundMoney(subtotal.minus(generalDiscountAmount));
  if (total.lt(0)) {
    throw new Error('El total de la venta no puede ser negativo');
  }

  return { items, subtotal, generalDiscountAmount, total };
}
