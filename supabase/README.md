# The score board's database

`migrations/` holds the schema. Supabase applies it, not the game — nothing in
`js/` ever creates or alters a table.

To apply by hand: Dashboard -> SQL Editor -> New query -> paste the migration ->
Run. It is written to be safe to re-run (`create table if not exists`,
`create or replace function`, and the policy is dropped before it is created).

The game reads `SCORE_API` in `js/config.js` for the project URL and the
publishable key. **Blank either field and the whole feature switches off** —
buttons hide, nothing is fetched. That is the fastest way to disable the board
without removing code.

## Checking it is healthy

The board's own status line, under the list in-game, is the first diagnosis:
`N runs · live` means the fetch succeeded; an offline notice means it did not.

Row count and recent activity:

```sql
select count(*) as runs, max(created_at) as latest from public.runs;
```

**Proving row level security actually works.** This is the check worth doing,
because everything else still looks fine when it is broken — the board reads
and writes correctly either way. The only proof is to attempt the thing that
must fail: an anon INSERT straight into the table, bypassing `submit_score`.

The SQL Editor cannot answer this. It runs as the table owner and bypasses RLS
entirely, so it reports success however the policies are set. The question is
only meaningful from a browser holding the publishable key.

**Add `?dev=1` to the game's URL and tap RLS CHECK** in the panel top-left.
This works on a phone, which a browser console does not:

    https://gabrieliusskuminas-crypto.github.io/Capy/?dev=1

| Verdict | Means |
|---|---|
| **PASS** | The table refused a direct write. `submit_score` is the only way in. |
| **FAIL** | Anon inserted straight into `runs`. Every guard in `submit_score` is bypassable — re-run the migration, then delete the `RLSCHECK` row. |
| **INCONCLUSIVE** | The board did not answer at all. Fix `SCORE_API` first. |

The check reads before it writes, on purpose. A wrong URL answers 404 to the
write, which reads as "refused" — a false pass, the worst possible outcome for
a security check. A refused write is only evidence once a read has proved we
are talking to the right project.

## Moderation

There is no in-game moderation and deliberately no tag ownership, so the
dashboard is the only tool. Tags are stored uppercase.

```sql
delete from public.runs where tag = 'BADTAG';          -- one player's runs
delete from public.runs where id = 123;                -- one run
truncate public.runs;                                  -- start the board over
```

## Expected dashboard warnings

**"Public Can Execute SECURITY DEFINER Function" is expected and permanent.**
"Public" is the dashboard's name for the `anon` role — the key the game ships
with. `submit_score` is security definer precisely so it can write to a table
the caller cannot touch, and the game has to be able to call it. The Advisor
flags the shape because it is a common place to get things wrong, not because
this one is. Dismiss it.

**"Signed-In Users Can Execute" is not expected**, and the migration now
revokes it — nothing here signs in. To see who actually holds the grant:

```sql
select grantee, privilege_type
from information_schema.role_routine_grants
where routine_name = 'submit_score';
```

`anon` should be the only row. If `authenticated` is still listed, re-run the
migration or just run the revoke on its own:

```sql
revoke execute on function public.submit_score(text,int,int,int,int) from authenticated;
```

The Advisor also flags Auth settings — leaked-password protection, MFA — on
every project. This one does not use Supabase Auth at all, so those do not
apply. What matters is that `runs` shows **RLS enabled** with exactly one
policy, and that policy is `select` only.

## Things that will look like bugs

- **A free project pauses after about a week with no traffic.** The board greys
  out and needs a manual restore from the dashboard. The game is unaffected —
  see the fire-and-forget rules in `CLAUDE.md`.
- **A failed submit is not lost.** It is queued in `localStorage` and retried at
  next boot, so a score submitted while the project was paused appears later.
- **Free tier has no point-in-time recovery.** `truncate` is final. For a board
  of arcade scores that is fine, but it is worth knowing before you run it.
