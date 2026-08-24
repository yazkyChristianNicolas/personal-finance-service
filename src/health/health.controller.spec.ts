import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('check devuelve status ok', () => {
    expect(new HealthController().check()).toEqual({ status: 'ok' });
  });
});
