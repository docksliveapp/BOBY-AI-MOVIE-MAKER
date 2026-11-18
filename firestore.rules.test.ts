/**
 * Adversarial Security Rules Verification Suite ("Dirty Dozen" Payloads)
 * Verifies all 12 identity, schema, relational, and terminal-locking invariants.
 */

export interface DirtyPayloadCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'create' | 'update' | 'get' | 'list';
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: DirtyPayloadCase[] = [
  {
    id: 1,
    name: 'Unverified Email Spoof',
    collectionPath: '/shows/show_01',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: false },
    payload: { ownerId: 'user_1', title: 'Test Show' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Identity Spoofing on Show Create',
    collectionPath: '/shows/show_01',
    operation: 'create',
    auth: { uid: 'attacker_1', email_verified: true },
    payload: { ownerId: 'victim_1', title: 'Spoofed Show' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow Ghost Field Injection',
    collectionPath: '/shows/show_01',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_1', title: 'Valid Title', isVerifiedStudio: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'ID Poisoning (>128 chars)',
    collectionPath: `/shows/${'x'.repeat(140)}`,
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_1', title: 'Valid Title' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Oversized Story Prompt (>8000 chars)',
    collectionPath: '/shows/show_01',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_1', storyPrompt: 'A'.repeat(8500) },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Disallowed Language Value in Array',
    collectionPath: '/shows/show_01',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_1', languages: ['Urdu', 'InvalidLang'] },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Orphaned Character Creation',
    collectionPath: '/shows/missing_show/characters/char_01',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: { showId: 'missing_show', ownerId: 'user_1', name: 'Zayd' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Cross-Tenant Character Injection',
    collectionPath: '/shows/victim_show/characters/char_01',
    operation: 'create',
    auth: { uid: 'attacker_1', email_verified: true },
    payload: { showId: 'victim_show', ownerId: 'attacker_1', name: 'Intruder' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Owner Transfer Mutation on Update',
    collectionPath: '/shows/show_01',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_2' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Client-Forged Timestamp on Create',
    collectionPath: '/shows/show_01',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_1', createdAt: '2020-01-01T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Terminal RenderJob Status Re-open',
    collectionPath: '/renderJobs/job_completed_01',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    payload: { status: 'running' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Blanket Unfiltered Collection List',
    collectionPath: '/shows',
    operation: 'list',
    auth: { uid: 'attacker_1', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
