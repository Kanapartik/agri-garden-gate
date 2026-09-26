import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/atap/LanguageProvider";
import { getMyFarmerQr } from "@/lib/atap/farmerQr.functions";
import { formatCode, qrPayload } from "@/lib/atap/farmerQr";

export function MyFarmerQr() {
  const { t } = useLanguage();
  const fetchQr = useServerFn(getMyFarmerQr);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["my-farmer-qr"], queryFn: () => fetchQr({ data: {} }) });
  const rotate = useMutation({
    mutationFn: () => fetchQr({ data: { rotate: true } }),
    onSuccess: (d) => {
      qc.setQueryData(["my-farmer-qr"], d);
      toast.success(t("qr.replaced"));
    },
  });

  return (
    <section className="panel flex flex-wrap items-center gap-6 p-5">
      <div className="rounded-lg bg-background p-3">
        {q.data ? (
          <QRCodeSVG value={qrPayload(q.data.code)} size={148} />
        ) : (
          <div className="h-[148px] w-[148px] animate-pulse rounded bg-muted" />
        )}
      </div>
      <div className="min-w-[220px] flex-1 space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("qr.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("qr.help")}
        </p>
        {q.data && <p className="font-mono text-sm">{formatCode(q.data.code)}</p>}
        <Button size="sm" variant="outline" disabled={rotate.isPending} onClick={() => rotate.mutate()}>
          {t("qr.replace")}
        </Button>
      </div>
    </section>
  );
}
