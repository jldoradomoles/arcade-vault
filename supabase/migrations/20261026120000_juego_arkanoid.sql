-- SPEC 08: ficha de Arkanoid en el catálogo.
insert into public.games (id, title, short, long, category, cover, color, sort_order)
values ('arkanoid', 'ARKANOID', 'Rompe todos los bloques con la bola sin dejarla caer.',
        'Mueve la paleta para devolver la bola y derribar los muros de bloques de colores. El rebote cambia según dónde golpees la paleta. Hay tres niveles cada vez más rápidos y, desde el segundo, bloques grises que aguantan dos golpes. Tienes tres vidas y ganas si vacías el último nivel.',
        'ARCADE', 'cover-arkanoid', 'yellow', 11)
on conflict (id) do nothing;
