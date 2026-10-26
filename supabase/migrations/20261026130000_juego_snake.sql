-- SPEC 09: ficha de Snake en el catálogo.
insert into public.games (id, title, short, long, category, cover, color, sort_order)
values ('snake', 'SNAKE', 'Come fruta, crece y no choques contigo ni con el muro.',
        'Guía a la serpiente por un tablero cerrado y cómete las frutas que aparecen. Cada una te da 10 puntos y alarga tu cuerpo; cada cinco frutas sube el nivel y la serpiente se mueve más rápido. Si tocas un muro o tu propia cola, se acaba la partida.',
        'ARCADE', 'cover-snake', 'green', 12)
on conflict (id) do nothing;
