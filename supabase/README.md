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
because everything else still looks fine when it is broken. The SQL Editor runs
as the owner and bypasses RLS, so it cannot test this — run it from the browser
console on the live site instead, where you are `anon`:

```js
fetch(SCORE_API.url + '/rest/v1/runs', {
  method: 'POST',
  headers: { apikey: SCORE_API.key, 'Content-Type': 'application/json' },
  body: '{"tag":"HACK","score":999999}',
}).then(r => console.log(r.status));
```

**401 or 403 is the correct answer.** A 201 means anon can write to the table
directly, the `submit_score` guards are bypassable, and the grants in the
migration did not take.

## Moderation

There is no in-game moderation and deliberately no tag ownership, so the
dashboard is the only tool. Tags are stored uppercase.

```sql
delete from public.runs where tag = 'BADTAG';          -- one player's runs
delete from public.runs where id = 123;                -- one run
truncate public.runs;                                  -- start the board over
```

## Expected dashboard warnings

The Security Advisor flags Auth settings — leaked-password protection, MFA — on
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
