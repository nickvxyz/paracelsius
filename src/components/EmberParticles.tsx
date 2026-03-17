"use client";

export default function EmberParticles() {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: `${Math.round(5 + (i * 8.3))}%`,
    delay: `${(i * 1.7) % 8}s`,
    duration: `${8 + (i % 5) * 2}s`,
    drift: `${((i % 3) - 1) * 30}px`,
  }));

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="ember-particle"
          style={
            {
              "--x": p.x,
              "--delay": p.delay,
              "--duration": p.duration,
              "--drift": p.drift,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
