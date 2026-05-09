---
name: Prisma mock pattern in tests
description: Always use as-unknown-as-MockDb cast; never vi.mocked(db.model.method) as a standalone expression
type: feedback
originSessionId: b4422d44-5a3d-4967-9db8-c9ddd4f1ed06
---
In API service tests, always use the typed cast pattern to mock Prisma clients. Never extract a method reference with `vi.mocked(db.model.method)` — that triggers `@typescript-eslint/unbound-method`.

**Wrong:**
```ts
const mockFindMany = vi.mocked(db.buddyProfile.findMany)
```

**Correct:**
```ts
type MockFn = Mock<(...args: unknown[]) => unknown>
interface MockDb {
  buddyProfile: { findMany: MockFn; findUnique: MockFn; update: MockFn }
}
const mdb = db as unknown as MockDb
// then inline: mdb.buddyProfile.findMany.mockResolvedValueOnce(...)
```

**Why:** `vi.mocked(db.model.method)` detaches the method from its object, which ESLint flags as `@typescript-eslint/unbound-method`. Accessing through the full chain (`mdb.buddyProfile.findMany.mockResolvedValueOnce(...)`) keeps the method bound.

**How to apply:** Any time writing or modifying API service tests that mock `db.*`. The reference file is `booking.service.test.ts`.
