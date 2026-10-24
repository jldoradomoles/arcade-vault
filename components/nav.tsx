"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/components/session-provider";

export function Nav() {
  const pathname = usePathname();
  const { user, signOut } = useSession();
  const [open, setOpen] = useState(false);
  // El menú de usuario se abre para una ruta concreta: al navegar se cierra solo.
  const [menuAt, setMenuAt] = useState<string | null>(null);
  const menuOpen = menuAt === pathname;
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuAt(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuAt(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const logout = async () => {
    setMenuAt(null);
    setOpen(false);
    await signOut();
  };

  const isHome = pathname === "/";
  const isLibrary =
    pathname.startsWith("/biblioteca") || pathname.startsWith("/juegos");
  const isHall = pathname.startsWith("/salon");
  const isAbout = pathname.startsWith("/acerca-de");
  const isAuth = pathname.startsWith("/acceso");
  const close = () => setOpen(false);

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo">
          <div className="logo-mark" />
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link href="/" className={isHome ? "active" : ""}>
            Inicio
          </Link>
          <Link href="/biblioteca" className={isLibrary ? "active" : ""}>
            Biblioteca
          </Link>
          <Link href="/salon" className={isHall ? "active" : ""}>
            Salón de la Fama
          </Link>
          <Link href="/acerca-de" className={isAbout ? "active" : ""}>
            Acerca de
          </Link>
        </div>
        <div className="spacer" />
        <div className="coin-counter">
          <span className="coin" />
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <div className="user-menu" ref={menuRef}>
            <button
              type="button"
              className="btn ghost auth-btn"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuAt(menuOpen ? null : pathname)}
            >
              {user.name} ▾
            </button>
            {menuOpen && (
              <div className="user-menu-list" role="menu">
                <button type="button" role="menuitem" onClick={logout}>
                  CERRAR SESIÓN
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link href="/acceso" className="btn auth-btn">
            Iniciar Sesión
          </Link>
        )}
        <button
          type="button"
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
        >
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={close}
      />
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan mb-4 text-[11px]">MENÚ</div>
        <Link href="/" className={isHome ? "active" : ""} onClick={close}>
          Inicio
        </Link>
        <Link
          href="/biblioteca"
          className={isLibrary ? "active" : ""}
          onClick={close}
        >
          Biblioteca
        </Link>
        <Link href="/salon" className={isHall ? "active" : ""} onClick={close}>
          Salón de la Fama
        </Link>
        <Link
          href="/acerca-de"
          className={isAbout ? "active" : ""}
          onClick={close}
        >
          Acerca de
        </Link>
        {user ? (
          <>
            <div className="pixel mt-2 px-3 text-[10px] text-yellow">
              {user.name}
            </div>
            <button type="button" className="mobile-logout" onClick={logout}>
              Cerrar sesión
            </button>
          </>
        ) : (
          <Link
            href="/acceso"
            className={isAuth ? "active" : ""}
            onClick={close}
          >
            Iniciar Sesión
          </Link>
        )}
        <div className="flex-1" />
        <div className="pixel text-[9px] tracking-[0.16em] text-ink-faint">
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
