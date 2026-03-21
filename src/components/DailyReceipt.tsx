"use client";

interface ReceiptItem {
  habit: string;
  delta: number;
  unit: string;
}

interface DailyReceiptProps {
  items: ReceiptItem[];
  netDelta: number;
  runningTotal: number;
}

export default function DailyReceipt({
  items,
  netDelta,
  runningTotal,
}: DailyReceiptProps) {
  return (
    <div className="w-full max-w-sm mx-auto my-4 font-body text-xs">
      <div className="border border-white/10 bg-surface p-4 space-y-3">
        <div className="text-center border-b border-dashed border-white/10 pb-3">
          <p className="font-heading text-[10px] tracking-[0.3em] text-accent uppercase">
            Daily Life Receipt
          </p>
          <p className="text-muted text-[10px] mt-1">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        <div className="space-y-1.5">
          {items.map((item, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-muted">{item.habit}</span>
              <span
                className={
                  item.delta >= 0 ? "text-green-400" : "text-red-400"
                }
              >
                {item.delta >= 0 ? "+" : ""}
                {item.delta.toFixed(2)} {item.unit}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-white/10 pt-3 space-y-1.5">
          <div className="flex justify-between font-bold">
            <span className="text-foreground">NET</span>
            <span
              className={netDelta >= 0 ? "text-green-400" : "text-red-400"}
            >
              {netDelta >= 0 ? "+" : ""}
              {netDelta.toFixed(2)} years
            </span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Running total</span>
            <span className="text-foreground">{runningTotal.toFixed(1)} years</span>
          </div>
        </div>

        <div className="text-center border-t border-dashed border-white/10 pt-3">
          <p className="text-muted text-[10px] italic">
            The dose makes the poison. &mdash; Paracelsus, 1538
          </p>
        </div>
      </div>
    </div>
  );
}
