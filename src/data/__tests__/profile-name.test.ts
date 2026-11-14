import { describe, expect, it } from '@jest/globals';

import { memoryRepository } from '@/data/db.web';
import { cleanName, DEFAULT_PROFILE, loadProfile, mergeProfile, NAME_MAX, saveProfile } from '@/data/profile';
import { avatarInitial, greetingFor } from '@/components/today/model';

describe('the optional name', () => {
  it('is none by default', () => {
    expect(DEFAULT_PROFILE.name).toBeNull();
  });

  it('is trimmed, kept to one space between words, cut at the limit, and null when empty', () => {
    expect(cleanName('  Ravi  ')).toBe('Ravi');
    expect(cleanName('Ravi   Kumar')).toBe('Ravi Kumar');
    expect(cleanName('')).toBeNull();
    expect(cleanName('   ')).toBeNull();
    expect(cleanName(null)).toBeNull();
    expect(cleanName(42)).toBeNull();
    expect(Array.from(cleanName('a'.repeat(80))!)).toHaveLength(NAME_MAX);
    expect(cleanName('రవి')).toBe('రవి');
  });

  it('loads as none from a profile saved before the name existed, and keeps a saved one', async () => {
    const repo = memoryRepository({ kv: [['profile', JSON.stringify({ heightCm: 172, onboarded: true })]], days: [], hours: [], logs: { weight: [], water: [] }, achievements: [], moods: [], weather: [], walks: [] } as never);
    expect((await loadProfile(repo)).name).toBeNull();
    await saveProfile(repo, mergeProfile(DEFAULT_PROFILE, { name: '  Ravi ' }));
    expect((await loadProfile(repo)).name).toBe('Ravi');
  });

  it('sets the greeting and the avatar letter, and leaves both empty without one', () => {
    expect(greetingFor(9, cleanName('Ravi'))).toBe('Good morning, Ravi');
    expect(avatarInitial(cleanName('ravi'))).toBe('R');
    expect(greetingFor(9, cleanName(' '))).toBe('Good morning');
    expect(avatarInitial(cleanName(' '))).toBe('');
  });
});
