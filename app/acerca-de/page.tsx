import { ContactForm } from "@/components/about/contact-form";
import { HighlightIcon, type HighlightKind } from "@/components/about/highlight-icon";
import { Reveal } from "@/components/home/reveal";

const HIGHLIGHTS: { icon: HighlightKind; text: string; color: string }[] = [
  { icon: "HEART", text: "HECHO CON ❤️ PARA JUGADORES", color: "magenta" },
  { icon: "BROWSER", text: "JUEGOS EN HTML — CORREN EN CUALQUIER NAVEGADOR", color: "cyan" },
  { icon: "PLANT", text: "PROYECTO EN CONSTANTE CRECIMIENTO", color: "green" },
];

export default function AcercaDePage() {
  return (
    <div className="about fade-in">
      {/* ACERCA DE */}
      <section className="about-hero">
        <div className="kicker pixel neon-yellow">▸ ACERCA DE</div>
        <h1 className="about-title">ACERCA DE ARCADE VAULT</h1>
        <p className="about-mission">
          ARCADE VAULT nació del amor por los videojuegos clásicos. Nuestra misión es preservar y celebrar
          los arcades que definieron una generación, haciéndolos accesibles para todos, en cualquier lugar
          y sin costo.
        </p>

        <div className="highlight-row">
          {HIGHLIGHTS.map((h, i) => (
            <div key={h.icon} className={"highlight " + h.color} style={{ transitionDelay: i * 80 + "ms" }}>
              <HighlightIcon kind={h.icon} />
              <div className="hl-text pixel">{h.text}</div>
            </div>
          ))}
        </div>
      </section>

      {/* divisor */}
      <Reveal>
        <div className="about-divider" aria-hidden="true">
          <div className="div-bar" />
          <div className="div-pixels">
            {Array.from({ length: 24 }).map((_, i) => (
              <span key={i} style={{ animationDelay: i * 80 + "ms" }} />
            ))}
          </div>
          <div className="div-bar" />
        </div>
      </Reveal>

      {/* CONTACTO */}
      <Reveal className="about-contact">
        <div className="contact-grid">
          <div className="contact-intro">
            <div className="kicker pixel neon-cyan">▸ CONTACTO</div>
            <h2 className="contact-title">CONTÁCTANOS</h2>
            <p className="contact-sub">
              ¿Tienes alguna sugerencia, quieres proponer un juego, o simplemente quieres saludar?
              Escríbenos.
            </p>
            <div className="contact-tips">
              <div className="tip"><span className="tip-led" />RESPUESTA EN 24-48H</div>
              <div className="tip"><span className="tip-led y" />SUGERENCIAS BIENVENIDAS</div>
              <div className="tip"><span className="tip-led m" />SIN SPAM, JAMÁS</div>
            </div>
          </div>

          <ContactForm />
        </div>
      </Reveal>
    </div>
  );
}
