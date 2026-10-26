-- SPEC 07: ficha de Tetris en el catálogo.
insert into public.games (id, title, short, long, category, cover, color, sort_order)
values ('tetris', 'TETRIS', 'Encaja las piezas y limpia líneas antes de que el tablero se llene.',
        'Ordena las piezas que caen en un tablero de 10×20 y completa líneas para puntuar. Cada diez líneas sube el nivel y la caída se acelera. Cada cinco líneas llega un power-up: bomba, rayo, tinte, gravedad o congelar el tiempo. La partida termina cuando una pieza nueva ya no cabe.',
        'PUZZLE', 'cover-tetris', 'magenta', 10)
on conflict (id) do nothing;
