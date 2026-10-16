// Sceau de l'établissement suivi de son nom.
export function Marque({ compacte }: { compacte?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/logo.png" alt="" className={compacte ? 'h-8 w-8' : 'h-10 w-10'} />
      <div className="leading-tight">
        <div className={compacte ? 'text-sm font-bold' : 'text-[0.95rem] font-bold tracking-tight'}>CETIC de Mezessé</div>
        {!compacte && <div className="text-[0.7rem] text-encre-2">Gestion scolaire</div>}
      </div>
    </div>
  );
}
