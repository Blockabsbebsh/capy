# The score board's database

`migrations/` holds the schema. Supabase applies it, not the game — nothing in
`js/` ever creates or alters a table. To apply by hand: Dashboard → SQL Editor →
New query → paste the migration → Run. It is safe to re-run.

The game reads `SCORE_API` in `js/config.js` for the project URL and the
publishable key. **Blank either field and the whole feature switches off** —
buttons hide, nothing is fetched. That is the fastest way to disable the board
without removing code.

## Checking it is healthy

The board's own status line, under the list in-game, is the first diagnosis:
`N runs · live` means the fetch succeeded.

```sql
select count(*) as runs, max(created_at) as latest from public.runs;
```

**Proving row level security actually works.** This is the check worth doing,
because everything else looks fine when it is broken — the board reads and
writes correctly either way. The only proof is to attempt the thing that must
fail: an anon INSERT straight into the table, bypassing `submit_score`.

The SQL Editor cannot answer this. It runs as the table owner and bypasses RLS
entirely, so it reports success however the policies are set. The question is
only meaningful from a browser holding the publishable key.

**Add `?dev=1` to the game's URL and tap RLS CHECK** in the panel top-left. This
works on a phone, which a browser console does not.

| Verdict | Means |
|---|---|
| **PASS** | The table refused a direct write. `submit_score` is the only way in. |
| **FAIL** | Anon inserted straight into `runs`. Every guard in `submit_score` is bypassable — re-run the migration, then delete the `RLSCHECK` row. |
| **INCONCLUSIVE** | The board did not answer at all. Fix `SCORE_API` first. |

The check reads before it writes, on purpose. A wrong URL answers 404 to the
write, which reads as "refused" — a false pass, the worst outcome for a security
check. A refused write is only evidence once a read has proved we are talking to
the right project.

## What none of this protects against

The checks look more protective than they are.

**Forged scores are not preventable here, and never were.** The publishable key
is in the page source and the validation rules are in this repo — but hiding
either buys nothing, because anyone can play one run with devtools open and read
the exact request the game sends.

**The flood guard is per tag.** `submit_score` refuses a second run under the
same tag within five seconds; rotating tags defeats that entirely. The board
fills with junk and `truncate` is the fix. Closing it properly needs per-IP rate
limiting, which the free tier does not offer.

What the SQL does buy is **blast radius**. `anon` holds no delete and no update
grant, so the worst a stranger can do is add rows — never remove or rewrite what
is there. Cheating stays recoverable; destruction would not have been.

If the board ever needs real integrity the answer is not a better check here. It
is moving authority off the client — submit a seed and an input log, re-simulate
server-side — and that is a different project.

## Moderation

No in-game moderation and deliberately no tag ownership, so the dashboard is the
only tool. Tags are stored uppercase.

```sql
delete from public.runs where tag = 'BADTAG';          -- one player's runs
delete from public.runs where id = 123;                -- one run
truncate public.runs;                                  -- start the board over
```

## Expected dashboard warnings

**"Public Can Execute SECURITY DEFINER Function" is expected and permanent.**
"Public" is the dashboard's name for the `anon` role — the key the game ships
with. `submit_score` is security definer precisely so it can write to a table
the caller cannot touch, and the game has to call it. Dismiss it.

**"Signed-In Users Can Execute" is not expected**, and the migration revokes it —
nothing here signs in. To see who holds the grant:

```sql
select grantee, privilege_type
from information_schema.role_routine_grants
where routine_name = 'submit_score';
```

Three grantees are expected: `postgres` (the owner), `service_role` (reachable
only with the `sb_secret_` key, which is never in the game), and `anon` (the
publishable key, the intended write path). The first two look alarming and are
not — holding either credential already means total control of the database.

**`authenticated` is the one that should not be there.** If listed, re-run the
migration or just the revoke:

```sql
revoke execute on function public.submit_score(text,int,int,int,int) from authenticated;
```

The Advisor also flags Auth settings on every project; this one does not use
Supabase Auth at all. What matters is that `runs` shows **RLS enabled** with
exactly one policy, `select` only.

## Things that will look like bugs

- **A free project pauses after about a week with no traffic.** The board greys
  out and needs a manual restore. The game is unaffected — submits are
  fire-and-forget (see `CLAUDE.md`).
- **A failed submit is not lost.** It is queued in `localStorage` and retried at
  next boot, so a score submitted while the project was paused appears later.
- **Free tier has no point-in-time recovery.** `truncate` is final.
