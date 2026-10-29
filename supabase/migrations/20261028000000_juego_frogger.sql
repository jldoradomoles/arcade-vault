-- game-jam frogger: ficha de Frogger en el catálogo.
insert into public.games (id, title, short, long, category, cover, color, sort_order)
values ('frogger', 'FROGGER', 'Cruza la carretera y el río sin convertirte en papilla.',
        'Guía a tu rana a través de una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.',
        'ARCADE', 'cover-frogger', 'green', 13)
on conflict (id) do nothing;
