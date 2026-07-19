import {
  calculateLineItem,
  calculateSale,
} from './sale-calculator';

describe('sale-calculator', () => {
  describe('calculateLineItem', () => {
    it('calcula artículo sin descuento', () => {
      const result = calculateLineItem({
        quantity: 2,
        unitPrice: '5000',
        discountType: 'NONE',
        discountValue: 0,
      });
      expect(result.lineSubtotal.toString()).toBe('10000');
      expect(result.discountAmount.toString()).toBe('0');
      expect(result.lineTotal.toString()).toBe('10000');
    });

    it('calcula descuento fijo por artículo', () => {
      const result = calculateLineItem({
        quantity: 1,
        unitPrice: '12000',
        discountType: 'FIXED',
        discountValue: '2000',
      });
      expect(result.lineSubtotal.toString()).toBe('12000');
      expect(result.discountAmount.toString()).toBe('2000');
      expect(result.lineTotal.toString()).toBe('10000');
    });

    it('calcula descuento porcentual por artículo', () => {
      const result = calculateLineItem({
        quantity: 2,
        unitPrice: '5000',
        discountType: 'PERCENTAGE',
        discountValue: '10',
      });
      expect(result.lineSubtotal.toString()).toBe('10000');
      expect(result.discountAmount.toString()).toBe('1000');
      expect(result.lineTotal.toString()).toBe('9000');
    });

    it('rechaza descuento fijo mayor al importe', () => {
      expect(() =>
        calculateLineItem({
          quantity: 1,
          unitPrice: '1000',
          discountType: 'FIXED',
          discountValue: '1500',
        }),
      ).toThrow(/no puede superar/);
    });

    it('rechaza cantidad inválida', () => {
      expect(() =>
        calculateLineItem({
          quantity: 0,
          unitPrice: '1000',
          discountType: 'NONE',
          discountValue: 0,
        }),
      ).toThrow(/cantidad/);
    });
  });

  describe('calculateSale', () => {
    it('aplica descuento general fijo', () => {
      const result = calculateSale({
        items: [
          {
            quantity: 1,
            unitPrice: '10000',
            discountType: 'NONE',
            discountValue: 0,
          },
          {
            quantity: 2,
            unitPrice: '5000',
            discountType: 'NONE',
            discountValue: 0,
          },
        ],
        generalDiscountType: 'FIXED',
        generalDiscountValue: '3000',
      });
      expect(result.subtotal.toString()).toBe('20000');
      expect(result.generalDiscountAmount.toString()).toBe('3000');
      expect(result.total.toString()).toBe('17000');
    });

    it('aplica descuento general porcentual', () => {
      const result = calculateSale({
        items: [
          {
            quantity: 1,
            unitPrice: '10000',
            discountType: 'NONE',
            discountValue: 0,
          },
        ],
        generalDiscountType: 'PERCENTAGE',
        generalDiscountValue: '20',
      });
      expect(result.subtotal.toString()).toBe('10000');
      expect(result.generalDiscountAmount.toString()).toBe('2000');
      expect(result.total.toString()).toBe('8000');
    });

    it('crea venta con varios artículos y descuentos mixtos', () => {
      const result = calculateSale({
        items: [
          {
            quantity: 1,
            unitPrice: '12000',
            discountType: 'FIXED',
            discountValue: '1000',
          },
          {
            quantity: 2,
            unitPrice: '5000',
            discountType: 'PERCENTAGE',
            discountValue: '10',
          },
        ],
        generalDiscountType: 'FIXED',
        generalDiscountValue: '500',
      });
      // line1: 11000, line2: 9000, subtotal 20000, general 500 → 19500
      expect(result.items[0].lineTotal.toString()).toBe('11000');
      expect(result.items[1].lineTotal.toString()).toBe('9000');
      expect(result.subtotal.toString()).toBe('20000');
      expect(result.total.toString()).toBe('19500');
    });

    it('rechaza venta sin artículos', () => {
      expect(() =>
        calculateSale({
          items: [],
          generalDiscountType: 'NONE',
          generalDiscountValue: 0,
        }),
      ).toThrow(/al menos un artículo/);
    });
  });
});
