# Theater Ticketing Platform - Bug Fixes & Migration Summary

---

## BUG 1: Maximum Update Depth Exceeded (CRITICAL) ✅ FIXED

**File**: `/home/z/my-project/src/components/seat-map.tsx`

**Root Cause**: The `useEffect` on lines 257-260 called `onSelectionChange?.(selectedSeats, totalPrice)` with `selectedSeats` and `totalPrice` as dependencies. Since `selectedSeats` was computed via `seats.filter(...)` on every render, it created a new array reference each time. This caused the useEffect to fire on every render, which called `onSelectionChange`, which updated parent state, which re-rendered SeatMap, creating an infinite loop.

**Fix Applied**:
1. Added `onSelectionChangeRef` (useRef) to track the latest `onSelectionChange` callback without causing re-renders
2. Created a `notifyParent()` helper (wrapped in useCallback) that reads the ref and computes `selectedSeats`/`totalPrice` from current state
3. Removed the problematic `useEffect` entirely
4. Called `notifyParent()` directly from:
   - `handleSeatClick` (after selection change) — via `setTimeout(() => notifyParent(), 0)` to defer until after state update
   - `handleClearSelection` (at the end) — via `setTimeout(() => notifyParent(), 0)`
   - Countdown expiry handler — already covered since it calls `handleClearSelection()`
5. Kept `selectedSeats` and `totalPrice` computed values for rendering purposes only (NOT in any dependency array)

---

## BUG 2: Cek Tiket Page Empty (/verify → 404) ✅ FIXED

**File**: Created `/home/z/my-project/src/app/verify/page.tsx`

**Root Cause**: The navbar linked to `/verify` but only `/verify/[transactionId]/page.tsx` existed. No `/verify/page.tsx` was ever created, so navigating to `/verify` returned a 404.

**Fix Applied**: Created a new `/verify/page.tsx` with:
- Clean "Cek Tiket" form with Transaction ID input
- Auto-uppercasing input with font-mono styling
- "Cek Tiket" button that navigates to `/verify/[transactionId]`
- Japanese-inspired minimalist design matching the existing theme (charcoal/gold palette)
- Navbar component included
- Loading state with spinner on submit
- Helpful hint text about where to find the transaction code
- Responsive layout (max-w-md centered)

---

## TASK 3: SQLite → Supabase PostgreSQL Migration ✅ CONFIGURED

### Changes Made:

1. **prisma/schema.prisma** — Changed datasource provider from `sqlite` to `postgresql`

2. **.env** — Updated DATABASE_URL to use the Supabase PostgreSQL connection string:
   - URL-encoded the password (`$!` → `%24%21`) to prevent shell/Prisma parsing issues
   - Format: `postgresql://postgres:G5PdN_edtw%24%21ddk@db.xxxxx.supabase.co:5432/postgres`
   - Removed the old SQLite URL and commented-out Supabase block

3. **Admin auth routes migrated from better-sqlite3 to Prisma**:
   - `/src/app/api/admin/auth/login/route.ts` — Replaced all `better-sqlite3` raw SQL queries with `db.admin.findFirst()` calls via Prisma
   - `/src/app/api/admin/auth/seed/route.ts` — Replaced all `better-sqlite3` raw SQL queries with `db.admin.findFirst()` and `db.admin.create()` via Prisma

4. **Prisma client regenerated**: `npx prisma generate` succeeded

5. **Schema push attempted**: `npx prisma db push` correctly connects to the PostgreSQL format but cannot reach `db.xxxxx.supabase.co` because `xxxxx` is a placeholder.

### ⚠️ ACTION REQUIRED BY USER:
Replace `xxxxx` in the DATABASE_URL in `.env` with your actual Supabase project ID. Then run:
```bash
cd /home/z/my-project && npx prisma db push
```
This will create all tables (Event, PriceCategory, Seat, Transaction, EmailTemplate, Admin) in your Supabase PostgreSQL database.

After that, run the seed to populate initial data.

### Files no longer needed:
- `db/custom.db` (old SQLite database file) — can be deleted after migration is verified

---

## Verification

- `npm run lint` — passes with no errors
- No remaining `better-sqlite3` or `custom.db` references in `src/` directory
