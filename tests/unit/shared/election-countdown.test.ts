import { describe, expect, it } from 'vitest';
import { formatCountdownDuration, getElectionCountdown } from '@/lib/election-countdown';

describe('election-countdown', () => {
  it('formats long countdowns with days, hours, minutes, and seconds', () => {
    expect(formatCountdownDuration((((2 * 24) + 3) * 60 * 60 + (4 * 60) + 5) * 1000)).toBe(
      '2d 03h 04m 05s'
    );
  });

  it('returns a live close countdown for open elections', () => {
    const now = Date.parse('2026-05-01T08:00:00.000Z');

    expect(
      getElectionCountdown(
        {
          status: 'OPEN',
          endTime: '2026-05-01T10:30:05.000Z',
        },
        now
      )
    ).toEqual({
      label: 'Cierra en',
      value: '2h 30m 05s',
      isLive: true,
    });
  });

  it('returns a live start countdown for scheduled elections', () => {
    const now = Date.parse('2026-05-01T08:00:00.000Z');

    expect(
      getElectionCountdown(
        {
          status: 'SCHEDULED',
          startTime: '2026-05-03T11:04:05.000Z',
        },
        now
      )
    ).toEqual({
      label: 'Inicia en',
      value: '2d 03h 04m 05s',
      isLive: true,
    });
  });

  it('returns static labels for non-countdown states', () => {
    expect(getElectionCountdown({ status: 'DRAFT' })).toEqual({
      label: 'Estado',
      value: 'Pendiente',
      isLive: false,
    });

    expect(getElectionCountdown({ status: 'ARCHIVED' })).toEqual({
      label: 'Estado',
      value: 'Finalizada',
      isLive: false,
    });
  });
});
