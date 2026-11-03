-- game-jam orbital: ficha de Orbital en el catálogo.
insert into public.games (id, title, short, long, category, cover, color, sort_order)
values ('orbital', 'ORBITAL', 'Apunta tu escudo, encadena choques y protege el reactor.',
        'Un reactor en el centro, un escudo que sigue a tu ratón y un flujo sin fin de bolas hostiles. Devuélvelas contra las demás para encadenar explosiones y subir el combo; usa el pulso cuando te rodeen. Cinco impactos y se acabó.',
        'ARCADE', 'cover-orbital', 'magenta', 15)
on conflict (id) do nothing;
