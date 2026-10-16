// Signe de l'établissement : une équerre et une règle dans un carré, puis le nom.
export function Marque({ compacte }: { compacte?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className={compacte ? 'h-7 w-7' : 'h-9 w-9'} aria-hidden>
        <rect width="32" height="32" rx="6" className="fill-primaire" />
        <path d="M8 23 L8 9 L19 23 Z" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" />
        <path d="M21 9 v14 M18 12 h6" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div className="leading-tight">
        <div className={compacte ? 'text-sm font-bold' : 'text-[0.95rem] font-bold tracking-tight'}>CETIC de Mezessé</div>
        {!compacte && <div className="text-[0.7rem] text-encre-2">Gestion scolaire</div>}
      </div>
    </div>
  );
}
