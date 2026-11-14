import { describe, expect, it } from '@jest/globals';

// The camera's native settings in app.json, which can't hold comments.
const app = require('../../../app.json') as {
  expo: { plugins: unknown[]; android: { permissions?: string[]; blockedPermissions?: string[] } };
};

function plugin(name: string): Record<string, unknown> {
  const entry = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === name) as [string, Record<string, unknown>] | undefined;
  if (!entry) throw new Error(`${name} is not configured`);
  return entry[1];
}

describe('camera in app.json', () => {
  const camera = plugin('expo-camera');

  it('says why the camera is used', () => {
    expect(camera.cameraPermission).toEqual(expect.stringContaining('barcode'));
  });

  it('keeps a microphone purpose string, as expo-camera links audio code on iOS (ITMS-90683)', () => {
    expect(typeof camera.microphonePermission).toBe('string');
    expect(camera.microphonePermission).toEqual(expect.stringContaining('does not record audio'));
  });

  it('never asks for the microphone on Android', () => {
    expect(camera.recordAudioAndroid).toBe(false);
    expect(app.expo.android.permissions).toContain('android.permission.CAMERA');
    expect(app.expo.android.blockedPermissions).toContain('android.permission.RECORD_AUDIO');
    expect(app.expo.android.permissions ?? []).not.toContain('android.permission.RECORD_AUDIO');
  });
});
