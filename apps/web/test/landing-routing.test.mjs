import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORKSPACE_TAB_IDS,
  formatHashForWorkspaceTab,
  isWorkspaceTabId,
  parseWorkspaceTabFromHash,
  resolvePostVaultImportTab,
} from '../.wrangler/test-build/services/workspaceRouting.js';

test('parseWorkspaceTabFromHash defaults first visit to home and resolves all 8 tab hashes', () => {
  assert.deepEqual(WORKSPACE_TAB_IDS, [
    'home',
    'navigator',
    'intersection',
    'stream',
    'liftover',
    'wiki',
    'swarm',
    'governance',
  ]);

  assert.equal(parseWorkspaceTabFromHash(''), 'home');
  assert.equal(parseWorkspaceTabFromHash('#'), 'home');
  assert.equal(parseWorkspaceTabFromHash('#home'), 'home');
  assert.equal(parseWorkspaceTabFromHash('#/home'), 'home');
  assert.equal(parseWorkspaceTabFromHash(null), 'home');
  assert.equal(parseWorkspaceTabFromHash(undefined), 'home');

  for (const tab of WORKSPACE_TAB_IDS) {
    assert.equal(isWorkspaceTabId(tab), true);
    assert.equal(parseWorkspaceTabFromHash(`#${tab}`), tab);
    assert.equal(parseWorkspaceTabFromHash(`#/${tab.toUpperCase()}`), tab);
  }

  // Friendly aliases & trailing slashes resolve cleanly; prototype keys & unknown hashes fall back safely
  assert.equal(parseWorkspaceTabFromHash('#viewer'), 'stream');
  assert.equal(parseWorkspaceTabFromHash('#network'), 'swarm');
  assert.equal(parseWorkspaceTabFromHash('#sources'), 'governance');
  assert.equal(parseWorkspaceTabFromHash('#/navigator/'), 'navigator');
  assert.equal(parseWorkspaceTabFromHash('#constructor'), 'home');
  assert.equal(parseWorkspaceTabFromHash('#__proto__'), 'home');
  assert.equal(parseWorkspaceTabFromHash('#toString'), 'home');
  assert.equal(parseWorkspaceTabFromHash('#/constructor'), 'home');
  assert.equal(parseWorkspaceTabFromHash('#nonexistent-route'), 'home');
});

test('formatHashForWorkspaceTab and resolvePostVaultImportTab support 1-click 23andMe onboarding', () => {
  assert.equal(formatHashForWorkspaceTab('home'), '#home');
  assert.equal(formatHashForWorkspaceTab('intersection'), '#intersection');
  assert.equal(formatHashForWorkspaceTab('navigator'), '#navigator');

  // Uploading on LandingView ('home') automatically transitions to ClinVar Intersection report
  assert.equal(resolvePostVaultImportTab('home'), 'intersection');
  // Uploading while already inside workspace tabs preserves active workspace context
  assert.equal(resolvePostVaultImportTab('intersection'), 'intersection');
  assert.equal(resolvePostVaultImportTab('navigator'), 'navigator');
  assert.equal(resolvePostVaultImportTab('stream'), 'stream');
});
