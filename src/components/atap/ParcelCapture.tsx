import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  centroidOf,
  estimateAreaAcres,
  validateBoundary,
  type BoundaryPoint,
} from "@/lib/atap/farmer";

/**
 * Minimal boundary capture surface. Deliberately provider-neutral: taps on a
 * local grid become lat/lng vertices, so the same component works with a real
 * basemap adapter later ([VALIDATE GIS provider]) and works fully offline.
 */
export interface ParcelCaptureProps {
  center: BoundaryPoint;
  /** Degrees of lat/lng covered by the capture pad. */
  span?: number;
  value: BoundaryPoint[];
  onChange: (points: BoundaryPoint[]) => void;
}

const PAD = 320;

export function ParcelCapture({ center, span = 0.01, value, onChange }: ParcelCaptureProps) {
  const [hint, setHint] = useState<string | null>(null);

  const check = validateBoundary(value);
  const area = estimateAreaAcres(value);
  const centroid = centroidOf(value);

  const polygon = useMemo(
    () =>
      value
        .map((p) => {
          const x = ((p.lng - (center.lng - span / 2)) / span) * PAD;
          const y = PAD - ((p.lat - (center.lat - span / 2)) / span) * PAD;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" "),
    [value, center.lat, center.lng, span],
  );

  function addPointFromEvent(event: React.MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * PAD;
    const y = ((event.clientY - rect.top) / rect.height) * PAD;
    const lng = center.lng - span / 2 + (x / PAD) * span;
    const lat = center.lat - span / 2 + ((PAD - y) / PAD) * span;
    const next = [...value, { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 }];
    if (next.length > 64) {
      setHint("A parcel boundary can hold at most 64 points.");
      return;
    }
    setHint(null);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(value.slice(0, -1))}
          disabled={value.length === 0}
        >
          Undo last point
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([])}
          disabled={value.length === 0}
        >
          Clear
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() =>
            onChange([
              { lat: center.lat + 0.0018, lng: center.lng - 0.0022 },
              { lat: center.lat + 0.0018, lng: center.lng + 0.0022 },
              { lat: center.lat - 0.0016, lng: center.lng + 0.0022 },
              { lat: center.lat - 0.0016, lng: center.lng - 0.0022 },
            ])
          }
        >
          Use synthetic plot shape
        </Button>
      </div>

      <svg
        role="img"
        aria-label="Parcel boundary capture pad"
        viewBox={`0 0 ${PAD} ${PAD}`}
        className="h-64 w-full cursor-crosshair rounded-lg border border-border bg-muted/40"
        onClick={addPointFromEvent}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <g key={i} className="text-border">
            <line x1={(i * PAD) / 8} y1={0} x2={(i * PAD) / 8} y2={PAD} stroke="currentColor" strokeWidth="0.5" />
            <line x1={0} y1={(i * PAD) / 8} x2={PAD} y2={(i * PAD) / 8} stroke="currentColor" strokeWidth="0.5" />
          </g>
        ))}
        {value.length >= 2 && (
          <polygon
            points={polygon}
            className="fill-primary/20 stroke-primary"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        )}
        {value.map((p, i) => {
          const x = ((p.lng - (center.lng - span / 2)) / span) * PAD;
          const y = PAD - ((p.lat - (center.lat - span / 2)) / span) * PAD;
          return <circle key={`${p.lat}-${p.lng}-${i}`} cx={x} cy={y} r="4" className="fill-primary" />;
        })}
      </svg>

      <p className="text-xs text-muted-foreground">
        Tap the pad to drop boundary corners. Works without a network connection — points are stored on
        this device until you sync.
      </p>
      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Points</dt>
          <dd className="font-medium">{value.length}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Estimated area</dt>
          <dd className="font-medium">{area === null ? "—" : `${area} acres`}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Centroid</dt>
          <dd className="font-medium">
            {centroid ? `${centroid.lat}, ${centroid.lng}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Boundary</dt>
          <dd className={check.ok ? "font-medium text-primary" : "font-medium text-destructive"}>
            {check.ok ? "Valid" : check.reason.replaceAll("_", " ")}
          </dd>
        </div>
      </dl>
      {hint && <p className="text-xs text-destructive">{hint}</p>}
      <p className="text-xs text-muted-foreground">
        Area is a local estimate for review only. Authoritative area and land records come from the
        jurisdiction GIS adapter, which is still mocked.
      </p>
    </div>
  );
}
