import Link from "next/link";

export default function NotFound() {
  return (
    <div className="fade-in flex flex-col items-center px-4 py-24 text-center">
      <div className="pixel neon-magenta mb-4 text-[40px]">404</div>
      <h1 className="pixel neon-cyan mb-3 text-sm">PANTALLA NO ENCONTRADA</h1>
      <p className="mb-8 text-ink-dim">Este cartucho no existe en el Vault.</p>
      <Link href="/" className="btn lg">VOLVER AL VAULT</Link>
    </div>
  );
}
