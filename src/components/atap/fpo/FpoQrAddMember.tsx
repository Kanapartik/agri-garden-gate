import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addMemberByQr } from "@/lib/atap/farmerQr.functions";

const ERRORS: Record<string, string> = {
  not_authorized: "Only the FPO admin or onboarding officer can add members.",
  invalid_code: "That is not a farmer QR code.",
  unknown_code: "No farmer uses this code (it may have been replaced).",
  already_member: "This farmer is already on your member list.",
};

export function FpoQrAddMember({ tenantId }: { tenantId: string }) {
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const qc = useQueryClient();
  const add = useServerFn(addMemberByQr);
  const m = useMutation({
    mutationFn: (scanned: string) => add({ data: { tenantId, scanned } }),
    onSuccess: (r) => {
      toast.success(`${r.displayName} added as ${r.memberRef} — awaiting the farmer's approval`);
      setManual("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(ERRORS[e.message] ?? "Could not add the farmer."),
  });

  useEffect(() => {
    if (!scanning || !videoRef.current) return;
    let scanner: { stop: () => void; destroy: () => void } | null = null;
    let done = false;
    import("qr-scanner").then(({ default: QrScanner }) => {
      if (done || !videoRef.current) return;
      const s = new QrScanner(
        videoRef.current,
        (res) => {
          s.stop();
          setScanning(false);
          m.mutate(res.data);
        },
        { preferredCamera: "environment", highlightScanRegion: true },
      );
      scanner = s;
      s.start().catch(() => {
        toast.error("Camera not available — type the code instead.");
        setScanning(false);
      });
    });
    return () => {
      done = true;
      scanner?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  return (
    <section className="panel space-y-3 p-5">
      <div>
        <h2 className="font-display text-base font-semibold">Add a farmer by QR code</h2>
        <p className="text-sm text-muted-foreground">
          Scan the QR on the farmer's profile. They join as "approval pending" and must approve membership and consent before you can see any farm data.</p>
      </div>
      {scanning && <video ref={videoRef} className="aspect-square w-full max-w-xs rounded-lg bg-muted object-cover" />}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setScanning((s) => !s)} disabled={m.isPending}>
          {scanning ? "Stop camera" : "Scan QR code"}
        </Button>
        <Input
          className="max-w-xs"
          placeholder="Or' type code, e.g. 1A2B-3C4D-…
          value={manual}
          onChange={(e) => setManual(e.target.value)}
        />
        <Button
          variant="outline"
          disabled={!manual.trim() || m.isPending}
          onClick={() => m.mutate(manual.replace(/[\s-]/g, ""))}
        >
          Add</Button>
      </div>
    </section>
  );
}
