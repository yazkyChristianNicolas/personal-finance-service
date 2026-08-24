import { PaymentMethodsMapper } from './payment-methods.mapper';
import { PaymentMethod } from '../../generated/prisma/client';

const ROW: PaymentMethod = {
  id: 'pm-1',
  userId: 'user-1',
  name: 'Tarjeta Visa',
  type: 'CREDIT',
  billingCycleStart: 1,
  billingCycleEnd: 30,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('PaymentMethodsMapper', () => {
  it('toModel mapea la fila de Prisma al Model', () => {
    expect(PaymentMethodsMapper.toModel(ROW)).toEqual({
      id: 'pm-1',
      userId: 'user-1',
      name: 'Tarjeta Visa',
      type: 'CREDIT',
      billingCycleStart: 1,
      billingCycleEnd: 30,
      createdAt: ROW.createdAt,
    });
  });

  it('toResponseDto devuelve el Model completo', () => {
    const model = PaymentMethodsMapper.toModel(ROW);
    expect(PaymentMethodsMapper.toResponseDto(model)).toEqual(model);
  });

  it('toSearchResultDto minifica a id/name/type', () => {
    const model = PaymentMethodsMapper.toModel(ROW);
    expect(PaymentMethodsMapper.toSearchResultDto(model)).toEqual({
      id: 'pm-1',
      name: 'Tarjeta Visa',
      type: 'CREDIT',
    });
  });
});
