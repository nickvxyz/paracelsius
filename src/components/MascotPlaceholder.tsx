export default function MascotPlaceholder() {
  return (
    <div className="ember-glow flex items-center justify-center w-64 h-64 border border-accent/30 bg-surface">
      <div className="text-center px-4">
        <div className="text-accent text-3xl mb-3">&#x2697;</div>
        <p className="font-heading text-xs tracking-widest text-accent uppercase">
          Agent Mascot
        </p>
        <p className="font-heading text-[10px] tracking-wider text-muted mt-1 uppercase">
          Coming Soon
        </p>
      </div>
    </div>
  );
}
