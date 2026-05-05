-- Add a realistic upcoming week of work for Kieran so the AI has something to talk about.
-- Today is Tue 5 May 2026 (per app context). Adds Tue/Wed/Thu/Fri jobs + next Mon quote visit.
-- Applied 5 May 2026 — confirms five upcoming jobs land in the schedule, fuse board on Fri.

DO $seed12$
DECLARE
  v_user uuid := '0fc769f9-2257-4eb9-8749-8c66766df8b1';
  v_company uuid := 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa';
BEGIN
  -- Carter Heights kitchen rewire is supposedly "in progress" — extend its dates so it's
  -- genuinely ongoing this week (final 2nd-fix days)
  UPDATE job_cards
  SET start_date = '2026-04-28',
      end_date   = '2026-05-09'
  WHERE id = 'cccccccc-1111-1111-1111-cccccccccccc';

  -- Tuesday (today) — short fault-finding callout
  INSERT INTO job_cards (id, user_id, company_id, title, customer, address, type, status, value, start_date, end_date, scope_of_work, created_at)
  VALUES (gen_random_uuid(), v_user, v_company,
    'Fault finding — kitchen RCD',
    'Helen Pritchard',
    '47 Hillcrest Mount, Leeds, LS7 4LP',
    'electrical', 'scheduled', 180,
    '2026-05-05', '2026-05-05',
    'Tripped RCD, loss of power to kitchen sockets. 1–2 hour callout to investigate and resolve.',
    '2026-05-04 00:00:00+00');

  -- Wednesday — domestic EICR
  INSERT INTO job_cards (id, user_id, company_id, title, customer, address, type, status, value, start_date, end_date, scope_of_work, created_at)
  VALUES (gen_random_uuid(), v_user, v_company,
    'EICR — domestic 3 bed',
    'Robert Atkinson',
    '23 Granville Rd, Leeds, LS6 3JG',
    'electrical', 'scheduled', 220,
    '2026-05-06', '2026-05-06',
    'Periodic inspection report for landlord — 3 bed semi. Full test + cert.',
    '2026-05-02 00:00:00+00');

  -- Thursday — outdoor sockets
  INSERT INTO job_cards (id, user_id, company_id, title, customer, address, type, status, value, start_date, end_date, scope_of_work, created_at)
  VALUES (gen_random_uuid(), v_user, v_company,
    'Outdoor socket + PIR security light',
    'Anita Wells',
    '8 Norwood Crescent, Leeds, LS6 1NJ',
    'electrical', 'scheduled', 320,
    '2026-05-07', '2026-05-07',
    'IP65 outdoor twin socket + PIR security light to rear elevation. Existing outdoor cable in place.',
    '2026-05-03 00:00:00+00');

  -- FRIDAY — fuse board upgrade (this is the one the AI will surface)
  INSERT INTO job_cards (id, user_id, company_id, title, customer, address, type, status, value, start_date, end_date, scope_of_work, created_at)
  VALUES (gen_random_uuid(), v_user, v_company,
    'Fuse board upgrade',
    'Tom Weaver',
    '14 Beckett Park Drive, Leeds, LS6 3PD',
    'electrical', 'scheduled', 680,
    '2026-05-08', '2026-05-08',
    'Replace old rewireable fuse board with 17th edition consumer unit. Make safe + minor remedial.',
    '2026-05-04 00:00:00+00');

  -- Next Monday — quote visit
  INSERT INTO job_cards (id, user_id, company_id, title, customer, address, type, status, value, start_date, end_date, scope_of_work, created_at)
  VALUES (gen_random_uuid(), v_user, v_company,
    'Quote visit — partial rewire',
    'Steve Robertson',
    '92 Stainbeck Lane, Leeds, LS7 2EL',
    'quote', 'quoted', 0,
    '2026-05-11', '2026-05-11',
    'Customer wants ground floor partial rewire — kitchen, hall, lounge. Site visit to scope and price.',
    '2026-05-04 00:00:00+00');

END $seed12$;
