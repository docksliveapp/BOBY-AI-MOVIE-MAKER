# Security Specification — BOBY AI MOVIE MAKER (Phase 0 TDD)

## 1. Data Invariants
1. **Default-Deny Catch-All**: No document in any unlisted path is readable or writable (`match /{document=**} { allow read, write: if false; }`).
2. **Verified Identity**: Every read and write requires an authenticated user with a verified Google email (`request.auth != null && request.auth.token.email_verified == true`).
3. **Show Ownership**: A `ShowProfile` (`/shows/{showId}`) can only be created, read, updated, listed, or deleted when `ownerId == request.auth.uid`, `isValidId(showId)`, and all string/array fields obey strict blueprint bounds.
4. **Master Gate for Characters**: A `CharacterActor` (`/shows/{showId}/characters/{characterId}`) cannot exist unless `/shows/{showId}` exists and `get(/databases/$(database)/documents/shows/$(showId)).data.ownerId == request.auth.uid`, with `incoming().showId == showId` and `incoming().ownerId == request.auth.uid`.
5. **Relational Render Jobs & Terminal Locking**: A `RenderJob` (`/renderJobs/{jobId}`) can only be created if `/shows/$(incoming().showId)` exists and belongs to `request.auth.uid`. Once `resource.data.status == 'completed'`, no subsequent `update` is permitted (Terminal State Lock).
6. **Temporal & Immortal Integrity**: `createdAt == request.time` on `create`; `updatedAt == request.time` on `update`; `ownerId`, `createdAt`, and `showId` are strictly immutable on `update`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unverified Email Spoof**: Authenticated user with `email_verified: false` creating `/shows/show_1` -> `PERMISSION_DENIED`.
2. **Identity Spoofing on Show Create**: `ownerId: "victim_uid"` while authenticated as `"attacker_uid"` -> `PERMISSION_DENIED`.
3. **Shadow Ghost Field Injection**: Valid `ShowProfile` payload plus `"isAdmin": true` -> `PERMISSION_DENIED` via `hasOnly()`.
4. **ID Poisoning**: Document ID containing spaces/slashes or >128 chars -> `PERMISSION_DENIED` via `isValidId()`.
5. **Oversized Story Prompt (Denial of Wallet)**: `storyPrompt` of 20,000 characters (> 8,000 limit) -> `PERMISSION_DENIED`.
6. **Unbounded or Unallowed Language Array**: `languages: ["Urdu", "Klingon"]` or 20 elements -> `PERMISSION_DENIED` via `languages.hasOnly(...)` and `size() <= 8`.
7. **Orphaned Character Creation**: Creating `/shows/nonexistent_show/characters/char_1` -> `PERMISSION_DENIED` via Master Gate `exists()`/`get()`.
8. **Cross-Tenant Character Injection**: Attacker creating a character under victim's `/shows/victim_show/characters/char_1` -> `PERMISSION_DENIED`.
9. **Owner Transfer Mutation**: Updating `ownerId` or `createdAt` on an existing `ShowProfile` -> `PERMISSION_DENIED`.
10. **Client-Forged Timestamp**: Passing past/future timestamp instead of `serverTimestamp()` (`request.time`) -> `PERMISSION_DENIED`.
11. **Terminal RenderJob Re-opening**: Updating a `RenderJob` whose `status` is already `'completed'` back to `'running'` -> `PERMISSION_DENIED`.
12. **Unfiltered Collection Scraping**: Executing a blanket `list` on `/shows` or `/renderJobs` without `where('ownerId', '==', auth.uid)` -> `PERMISSION_DENIED`.
