-- =====================================================================
-- HIGH SCORE BOARD
--
-- One row per submitted RUN, not one per player: the board shows every
-- score, so the same tag appears as many times as it has beaten itself.
-- The client only submits when the run beat that device's personal best
-- (see endGame in js/gameflow.js), which is what keeps the ladder short
-- without the server needing to know who anyone is.
--
-- Tags are honour-system, exactly like an arcade cabinet. There is no
-- ownership, no password and no way to prove a tag is yours. That is a
-- deliberate product choice, so nothing below tries to enforce it.
-- =====================================================================

create table if not exists public.runs (
  id         bigint generated always as identity primary key,
  tag        text        not null,
  score      int         not null,
  level      int         not null default 1,
  combo      int         not null default 0,
  secs       int         not null default 0,
  created_at timestamptz not null default now()
);

-- The board is always read "highest first, take the top N".
create index if not exists runs_score_idx on public.runs (score desc, created_at);

alter table public.runs enable row level security;

-- Read is public. Note what is NOT here: no insert or update policy, so
-- anon cannot write to this table by any route except the function below.
drop policy if exists "board is public" on public.runs;
create policy "board is public" on public.runs for select to anon using (true);

revoke all on public.runs from anon;
grant select on public.runs to anon;

-- ---------------------------------------------------------------------
-- The only thing allowed to write. security definer runs it as the table
-- owner, which is how it inserts while the caller cannot.
--
-- The checks here are deterrence, not protection: any browser can POST
-- whatever it likes. They exist to keep a bored visitor from parking
-- score=999999999 at the top of the board forever, and nothing more.
-- ---------------------------------------------------------------------
create or replace function public.submit_score(
  p_tag text, p_score int, p_level int, p_combo int, p_secs int
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tag text := upper(btrim(coalesce(p_tag, '')));
begin
  if v_tag !~ '^[A-Z0-9 _-]{2,12}$' then
    raise exception 'tag must be 2-12 characters, letters numbers space _ or -';
  end if;

  if p_score is null or p_score < 0 or p_score > 50000000 then
    raise exception 'score out of range';
  end if;

  -- A run has to last long enough to have happened, and the score has to
  -- be reachable in that time. The ceiling is loose on purpose: the combo
  -- multiplier is uncapped, so a strong late run legitimately earns
  -- thousands of points a second.
  if p_secs is null or p_secs < 5 or p_score > 3000 * p_secs then
    raise exception 'implausible run';
  end if;

  -- Cheap flood guard. A real run cannot finish in under five seconds, so
  -- this only ever catches a script.
  if exists (
    select 1 from public.runs
    where tag = v_tag and created_at > now() - interval '5 seconds'
  ) then
    raise exception 'slow down';
  end if;

  insert into public.runs (tag, score, level, combo, secs)
  values (v_tag, p_score,
          greatest(coalesce(p_level, 1), 1),
          greatest(coalesce(p_combo, 0), 0),
          p_secs);
end $$;

revoke all on function public.submit_score(text,int,int,int,int) from public;
grant execute on function public.submit_score(text,int,int,int,int) to anon;

-- `anon` must keep this grant: it is the game's only way to write, and the
-- whole reason the function is security definer. The dashboard's Advisor
-- flags that as "Public Can Execute SECURITY DEFINER Function" and always
-- will — the warning is pointing at the design, not at a fault.
--
-- `authenticated` is a different matter. Nothing in this game signs in, so
-- that role should never be calling this. Revoking costs nothing and drops
-- the second of the two warnings. Revisit only if the game ever gains auth.
revoke execute on function public.submit_score(text,int,int,int,int) from authenticated;
