-- game-jam pantano: ficha de Pantano en el catálogo.
insert into public.games (id, title, short, long, category, cover, color, sort_order)
values ('pantano', 'PANTANO', 'Coloca troncos y nenúfares para guiar a las ranas hasta la otra orilla.',
        'Las ranas avanzan solas por un pantano peligroso y necesitan plataformas para no caer al agua. Coloca nenúfares, troncos y tortugas en las casillas de agua para crear caminos seguros. Los troncos se desplazan con la corriente y las tortugas se hunden. Cada nivel trae más ranas y corrientes más rápidas.',
        'PUZZLE', 'cover-pantano', 'magenta', 15)
on conflict (id) do nothing;
