import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-16 space-y-4">
      <p
        className="font-heading text-5xl font-black"
        style={{ color: "rgba(140,230,180,0.9)", textShadow: "0 0 20px rgba(140,230,180,0.3)" }}
      >
        404
      </p>
      <p className="text-[15px] text-muted text-center">
        This page does not exist in any century.
      </p>
      <Link
        href="/"
        className="text-[13px] font-heading font-bold uppercase tracking-wider text-accent hover:opacity-80 transition-opacity"
      >
        Return Home
      </Link>
    </div>
  );
}
