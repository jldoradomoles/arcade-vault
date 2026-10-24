-- SPEC 06: datos de prueba. Idempotente: se puede ejecutar varias veces.
-- Se aplica con privilegios del proyecto (MCP/SQL), nunca desde la app.

-- 1. Catálogo -----------------------------------------------------------------
insert into public.games (id, title, short, long, category, cover, color, sort_order) values
  ('asteroids', 'ASTEROIDS', 'Sobrevive en un campo de asteroides en gravedad cero.',
   'Pilota una nave en un espacio sin bordes: lo que sale por un lado entra por el otro. Dispara a las rocas para partirlas en fragmentos cada vez más pequeños y recoge power-ups: disparo triple, escudo temporal y la rara Bomba Nova. Tienes tres vidas y cada nivel llega más cargado.',
   'SHOOTER', 'cover-asteroids', 'cyan', 9)
on conflict (id) do nothing;

-- 2. Usuario de prueba con cuenta real: test@arcadevault.gg / PLAYERTEST ---------
-- Contraseña: Test1234!  El trigger on_auth_user_created crea su fila en profiles.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated',
  'test@arcadevault.gg',
  extensions.crypt('Test1234!', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"username":"PLAYERTEST"}',
  now(), now(),
  '', '', '', ''
)
on conflict (id) do nothing;

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values (
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '{"sub":"00000000-0000-4000-8000-000000000001","email":"test@arcadevault.gg","email_verified":true}',
  'email',
  now(), now(), now()
)
on conflict do nothing;

-- Puntuaciones del usuario de prueba: su mejor marca no es la primera ni la última.
insert into public.scores (id, game_id, user_id, player_name, score, created_at)
select md5('PLAYERTEST|' || game_id || '|' || score)::uuid,
       game_id, '00000000-0000-4000-8000-000000000001', 'PLAYERTEST', score,
       now() - (days || ' days')::interval
from (values
  ('asteroids', 26500, 3),
  ('asteroids', 14200, 9),
  ('asteroids',  8900, 15)
) as t(game_id, score, days)
where exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;
