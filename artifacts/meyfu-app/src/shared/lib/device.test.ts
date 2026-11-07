import { describe, expect, it } from 'vitest';

import { deviceId } from './device';

describe('deviceId — audit FE-107', () => {
  it('bir qurilmada barqaror va saqlanadi', () => {
    const first = deviceId();

    expect(deviceId()).toBe(first);
    expect(localStorage.getItem('meyfu:device-id')).toBe(first);
  });
});
