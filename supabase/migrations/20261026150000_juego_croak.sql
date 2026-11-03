-- game-jam croak: ficha de Croak en el catálogo.
insert into public.games (id, title, short, long, category, cover, color, sort_order)
values ('croak', 'CROAK', 'Atrapa moscas con tu lengua antes de que escapen del pantano.',
        'Eres una rana en un nenúfar en el centro del pantano. Los insectos revolotean desde los bordes de la pantalla. Apunta con las flechas y dispara tu lengua para atraparlos antes de que crucen al otro lado. Moscas, libélulas y luciérnagas valen distinto. Cada insecto que escape te cuesta una vida.',
        'SHOOTER', 'cover-croak', 'cyan', 14)
on conflict (id) do nothing;
