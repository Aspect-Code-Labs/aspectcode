/**
 * Tests for auth module — credentials management.
 */

import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// We need to override the credentials path before importing auth
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-auth-'));
const credDir = path.join(tmpHome, '.aspectcode');
const credFile = path.join(credDir, 'credentials.json');

// Patch env to use temp home
const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;

describe('auth — credentials', () => {
  let loadCredentials: typeof import('../src/auth').loadCredentials;

  before(async () => {
    // Override home directory
    process.env.HOME = tmpHome;
    process.env.USERPROFILE = tmpHome;
    // Dynamic import after env override
    const auth = await import('../src/auth');
    loadCredentials = auth.loadCredentials;
  });

  after(() => {
    process.env.HOME = originalHome;
    process.env.USERPROFILE = originalUserProfile;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Clean up credentials between tests
    try { fs.unlinkSync(credFile); } catch { /* ignore */ }
    try { fs.rmdirSync(credDir); } catch { /* ignore */ }
  });

  it('returns null when no credentials exist', () => {
    const creds = loadCredentials();
    assert.equal(creds, null);
  });

  it('returns credentials when file exists', () => {
    fs.mkdirSync(credDir, { recursive: true });
    fs.writeFileSync(credFile, JSON.stringify({
      token: 'ac_test123',
      email: 'test@example.com',
      createdAt: '2026-01-01T00:00:00.000Z',
    }));

    const creds = loadCredentials();
    assert.equal(creds?.token, 'ac_test123');
    assert.equal(creds?.email, 'test@example.com');
  });

  it('returns null on malformed credentials file', () => {
    fs.mkdirSync(credDir, { recursive: true });
    fs.writeFileSync(credFile, 'not json');

    const creds = loadCredentials();
    assert.equal(creds, null);
  });
});
