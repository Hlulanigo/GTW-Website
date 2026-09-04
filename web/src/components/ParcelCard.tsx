import { Clock, Weight, AlertTriangle } from "lucide-react";

interface Parcel {
  id: string | number;
  origin?: string;
  destination?: string;
  fromAddress?: string;
  toAddress?: string;
  size: string;
  weight?: number;
  compensation?: number;
  price?: number;
  status: string;
  pickupDate?: string;
  deliveryWindowEnd?: string;
  deadline?: string;
  senderName?: string;
  description?: string;
  isFragile?: boolean;
}

interface ParcelCardProps {
  parcel: Parcel;
  onClick?: () => void;
}

const sizeConfig: Record<string, { color: string; dot: string }> = {
  small:  { color: "bg-sky-500/10 text-sky-500",    dot: "bg-sky-500" },
  medium: { color: "bg-amber-500/10 text-amber-500", dot: "bg-amber-500" },
  large:  { color: "bg-violet-500/10 text-violet-500", dot: "bg-violet-500" },
};

const statusConfig: Record<string, { color: string; dot: string }> = {
  Pending:    { color: "bg-slate-100 dark:bg-navy-secondary text-slate-500", dot: "bg-slate-400" },
  Paid:       { color: "bg-sky-500/10 text-sky-500",    dot: "bg-sky-500" },
  Accepted:   { color: "bg-amber-500/10 text-amber-500", dot: "bg-amber-500" },
  "Picked Up":{ color: "bg-primary/10 text-primary",    dot: "bg-primary" },
  "In Transit":{ color: "bg-primary/10 text-primary",   dot: "bg-primary" },
  Arrived:    { color: "bg-success/10 text-success",    dot: "bg-success" },
  Delivered:  { color: "bg-success/10 text-success",    dot: "bg-success" },
  Expired:    { color: "bg-error/10 text-error",        dot: "bg-error" },
};

function relativeDate(dateStr?: string) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffH  = Math.round(diffMs / 3600000);
  const diffD  = Math.round(diffMs / 86400000);
  if (diffH < 0)   return "Overdue";
  if (diffH < 1)   return "< 1 hr";
  if (diffH < 24)  return `${diffH}h`;
  if (diffD === 1) return "Tomorrow";
  if (diffD <= 6)  return `${diffD} days`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function ParcelCard({ parcel, onClick }: ParcelCardProps) {
  const fromAddress = parcel.origin || parcel.fromAddress;
  const toAddress   = parcel.destination || parcel.toAddress;
  const price       = parcel.compensation ?? parcel.price;
  const deadline    = parcel.deliveryWindowEnd || parcel.deadline;
  const sz  = sizeConfig[parcel.size]   || sizeConfig.medium;
  const st  = statusConfig[parcel.status] || statusConfig.Pending;
  const pickup = relativeDate(parcel.pickupDate);

  return (
    <div
      onClick={onClick}
      className="card p-4 cursor-pointer active:scale-[0.98] transition-all duration-150 hover:shadow-lg"
    >
      {/* Top row: badges + price */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize ${sz.color}`}>
            {parcel.size}
          </span>
          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${st.color}`}>
            {parcel.status}
          </span>
          {parcel.isFragile && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-error/10 text-error flex items-center gap-1">
              <AlertTriangle size={10} />
              Fragile
            </span>
          )}
        </div>
        <span className="font-bold text-lg text-primary shrink-0">
          R{price?.toLocaleString?.() ?? price}
        </span>
      </div>

      {/* Route line */}
      <div className="flex items-start gap-2.5 mb-3">
        <div className="flex flex-col items-center gap-0.5 mt-1 shrink-0">
          <div className={`w-2 h-2 rounded-full ${sz.dot}`} />
          <div className="w-px h-5 bg-slate-200 dark:bg-navy-light" />
          <div className={`w-2 h-2 rounded-full border-2 border-current ${sz.color.split(" ")[1]}`} />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">From</p>
            <p className="text-sm font-medium text-navy dark:text-white truncate">{fromAddress}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">To</p>
            <p className="text-sm font-medium text-navy dark:text-white truncate">{toAddress}</p>
          </div>
        </div>
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-navy-light">
        <div className="flex items-center gap-3">
          {parcel.senderName && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/40 to-primary flex items-center justify-center shadow-sm shrink-0">
                <span className="text-white text-[11px] font-bold">{parcel.senderName[0]?.toUpperCase()}</span>
              </div>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{parcel.senderName}</span>
            </div>
          )}
          {parcel.weight && (
            <div className="flex items-center gap-1 text-slate-400">
              <Weight size={11} />
              <span className="text-xs">{parcel.weight}kg</span>
            </div>
          )}
        </div>
        {pickup && (
          <div className="flex items-center gap-1 text-slate-400">
            <Clock size={11} />
            <span className="text-xs">{pickup}</span>
          </div>
        )}
      </div>
    </div>
  );
}
