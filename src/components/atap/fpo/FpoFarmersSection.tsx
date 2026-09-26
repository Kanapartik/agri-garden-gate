import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StateBadge } from "@/components/atap/StatusBadge";
import { useLanguage } from "@/components/atap/LanguageProvider";
import {
  assignTag,
  deleteSegment,
  getFarmer360,
  getMemberRegistry,
  linkMemberFarmer,
  recordMemberConsent,
  revokeMemberConsent,
  saveMember,
  saveSegment,
  saveTag,
  searchFarmerCandidates,
  setMembershipStatus,
} from "@/lib/atap/fpoMembers.functions";
import {
  applyFilters,
  FPO_PURPOSE_LABEL,
  FPO_PURPOSES,
  MEMBER_TYPES,
  MEMBERSHIP_STATE_LABEL,
  MEMBERSHIP_STATES,
  type FpoPurpose,
  type MembershipState,
  type SegmentFilters,
} from "@/lib/atap/fpoMembers";

const NEXT_STATES: Record<MembershipState, MembershipState[]> = {
  invited: ["approval_pending", "active", "exited"],
  approval_pending: ["active", "exited"],
  active: ["suspended", "exited"],
  suspended: ["active", "exited"],
  exited: ["invited"],
  removed: [],
};

export function FpoFarmersSection({ tenantId }: { tenantId: string }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const registryFn = useServerFn(getMemberRegistry);
  const saveMemberFn = useServerFn(saveMember);
  const statusFn = useServerFn(setMembershipStatus);
  const searchFn = useServerFn(searchFarmerCandidates);
  const linkFn = useServerFn(linkMemberFarmer);
  const saveTagFn = useServerFn(saveTag);
  const assignTagFn = useServerFn(assignTag);
  const saveSegmentFn = useServerFn(saveSegment);
  const deleteSegmentFn = useServerFn(deleteSegment);
  const consentFn = useServerFn(recordMemberConsent);
  const revokeFn = useServerFn(revokeMemberConsent);
  const farmer360Fn = useServerFn(getFarmer360);

  const registry = useQuery({
    queryKey: ["fpo-registry", tenantId],
    queryFn: () => registryFn({ data: { tenantId } }),
    enabled: Boolean(tenantId),
  });

  const [filters, setFilters] = useState<SegmentFilters>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [openMember, setOpenMember] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [memberType, setMemberType] = useState<string>(MEMBER_TYPES[0]);
  const [village, setVillage] = useState("");
  const [cluster, setCluster] = useState("");
  const [crops, setCrops] = useState("");
  const [acreage, setAcreage] = useState("");
  const [contact, setContact] = useState("");

  const [tagLabel, setTagLabel] = useState("");
  const [segmentName, setSegmentName] = useState("");
  const [search, setSearch] = useState("");
  const [candidateQuery, setCandidateQuery] = useState("");
  const [consentPurpose, setConsentPurpose] = useState<FpoPurpose>(FPO_PURPOSES[0]);
  const [consentEvidence, setConsentEvidence] = useState("");

  const data = registry.data;
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["fpo-registry", tenantId] });
    if (openMember) await qc.invalidateQueries({ queryKey: ["fpo-farmer360", openMember] });
    await qc.invalidateQueries({ queryKey: ["fpo-overview"] });
  };

  const visible = useMemo(
    () => applyFilters(data?.members ?? [], { ...filters, search }),
    [data?.members, filters, search],
  );

  const farmer360 = useQuery({
    queryKey: ["fpo-farmer360", openMember],
    queryFn: () => farmer360Fn({ data: { memberId: openMember! } }),
    enabled: Boolean(openMember),
  });

  const candidates = useQuery({
    queryKey: ["fpo-candidates", tenantId, candidateQuery],
    queryFn: () => searchFn({ data: { tenantId, query: candidateQuery } }),
    enabled: candidateQuery.trim().length >= 3,
  });

  const addMember = useMutation({
    mutationFn: () =>
      saveMemberFn({
        data: {
          tenantId,
          display_name: name,
          member_type: memberType,
          village_code: village || null,
          village_cluster: cluster || null,
          crops: crops
            .split(",")
            .map((c) => c.trim().toLowerCase())
            .filter(Boolean),
          acreage: acreage ? Number(acreage) : null,
          contact_hint: contact || null,
        },
      }),
    onSuccess: async (res) => {
      toast.success(`Member added as ${res.membershipNumber ?? "invited"}`);
      setName("");
      setCrops("");
      setAcreage("");
      setContact("");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!tenantId) return null;
  if (registry.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }
  if (registry.isError) {
    return <p className="text-sm text-muted-foreground">{(registry.error as Error).message}</p>;
  }
  if (!data) return null;

  const summary = data.summary;
  const detail = farmer360.data;
  const openRow = data.members.find((m) => m.id === openMember) ?? null;
  const openConsents = openRow?.farmer_user_id
    ? data.consents.filter((c) => c.farmer_user_id === openRow.farmer_user_id && !c.revoked_at)
    : [];

  const toggleSelected = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: t("fpo.members.total"), value: summary.total },
          { label: MEMBERSHIP_STATE_LABEL.active, value: summary.active },
          { label: MEMBERSHIP_STATE_LABEL.approval_pending, value: summary.approvalPending },
          { label: t("fpo.members.linked"), value: summary.linked },
          { label: t("fpo.members.consented"), value: summary.consented },
          { label: t("fpo.members.acreage"), value: Math.round(summary.acreage) },
        ].map((c) => (
          <div key={c.label} className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-2xl font-bold">{c.value}</p>
          </div>
        ))}
      </section>

      {/* -------------------------------------------------- add / link member */}
      {data.canAdd ? (
        <section className="panel space-y-3 p-5">
          <h2 className="font-display text-base font-semibold">{t("fpo.members.add")}</h2>
          <p className="field-hint">
            {t("fpo.ui.8ee9c700d2")}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input
              className="field-base"
              placeholder={t("fpo.ui.e2f6b27d44")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select
              className="field-base"
              value={memberType}
              onChange={(e) => setMemberType(e.target.value)}
            >
              {MEMBER_TYPES.map((m) => (
                <option key={m} value={m}>
                  {m.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <input
              className="field-base"
              placeholder={t("fpo.ui.2b20deffcc")}
              value={village}
              onChange={(e) => setVillage(e.target.value)}
            />
            <input
              className="field-base"
              placeholder={t("fpo.ui.736565ce2b")}
              value={cluster}
              onChange={(e) => setCluster(e.target.value)}
            />
            <input
              className="field-base"
              placeholder={t("fpo.ui.7c909fa7c7")}
              value={crops}
              onChange={(e) => setCrops(e.target.value)}
            />
            <input
              className="field-base"
              placeholder={t("fpo.ui.fdfd5bbdc5")}
              value={acreage}
              onChange={(e) => setAcreage(e.target.value)}
            />
            <input
              className="field-base"
              placeholder={t("fpo.ui.3cb5ce1918")}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
          </div>
          <Button onClick={() => addMember.mutate()} disabled={!name || addMember.isPending}>
            {t("fpo.members.add")}
          </Button>
        </section>
      ) : null}

      {/* --------------------------------------------------------- filters */}
      <section className="panel space-y-3 p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className="field-base"
            placeholder={t("fpo.members.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="field-base"
            value={filters.status?.[0] ?? ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                status: e.target.value ? [e.target.value as MembershipState] : undefined,
              }))
            }
          >
            <option value="">{t("fpo.ui.6405179d24")}</option>
            {MEMBERSHIP_STATES.map((s) => (
              <option key={s} value={s}>
                {MEMBERSHIP_STATE_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            className="field-base"
            value={filters.crops?.[0] ?? ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, crops: e.target.value ? [e.target.value] : undefined }))
            }
          >
            <option value="">{t("fpo.ui.ddc036722c")}</option>
            {data.facets.crops.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            className="field-base"
            value={filters.tagCodes?.[0] ?? ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, tagCodes: e.target.value ? [e.target.value] : undefined }))
            }
          >
            <option value="">{t("fpo.ui.a0ef40f7b0")}</option>
            {data.tags.map((tg) => (
              <option key={tg.id} value={tg.code}>
                {tg.label} ({tg.memberCount})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(filters.linkedOnly)}
              onChange={(e) =>
                setFilters((f) => ({ ...f, linkedOnly: e.target.checked || undefined }))
              }
            />
            {t("fpo.members.linkedOnly")}
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFilters({});
              setSearch("");
            }}
          >
            {t("fpo.ui.412226715c")}</Button>
          {data.canClassify ? (
            <>
              <input
                className="field-base max-w-48"
                placeholder={t("fpo.ui.b591b5033c")}
                value={segmentName}
                onChange={(e) => setSegmentName(e.target.value)}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={!segmentName}
                onClick={async () => {
                  await saveSegmentFn({
                    data: { tenantId, name: segmentName, filters: { ...filters, search } },
                  });
                  setSegmentName("");
                  toast.success(t("fpo.ui.5c6848ef5b"));
                  await refresh();
                }}
              >
                {t("fpo.ui.e71e6be753")}</Button>
            </>
          ) : null}
        </div>
        {data.segments.length > 0 ? (
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            {data.segments.map((s) => (
              <span
                key={s.id}
                className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"
              >
                <button
                  type="button"
                  onClick={() => {
                    setFilters(s.filters);
                    setSearch(s.filters.search ?? "");
                  }}
                >
                  {s.name}
                </button>
                {data.canClassify ? (
                  <button
                    type="button"
                    aria-label={`Delete segment ${s.name}`}
                    className="text-muted-foreground"
                    onClick={async () => {
                      await deleteSegmentFn({ data: { tenantId, segmentId: s.id } });
                      await refresh();
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      {/* ------------------------------------------------------- tag manager */}
      {data.canClassify ? (
        <section className="panel space-y-3 p-5">
          <h2 className="font-display text-base font-semibold">{t("fpo.members.tags")}</h2>
          <p className="field-hint">
            {t("fpo.ui.add3c981e5")}</p>
          <div className="flex flex-wrap gap-2">
            <input
              className="field-base max-w-64"
              placeholder={t("fpo.ui.6106bd2b47")}
              value={tagLabel}
              onChange={(e) => setTagLabel(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={tagLabel.trim().length < 2}
              onClick={async () => {
                await saveTagFn({ data: { tenantId, label: tagLabel } });
                setTagLabel("");
                toast.success(t("fpo.ui.55cc6bf63f"));
                await refresh();
              }}
            >
              {t("fpo.ui.e0db2991e3")}</Button>
          </div>
          {selected.length > 0 && data.tags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <p className="text-sm">{selected.length} {t("fpo.ui.b3fe76af8d")}</p>
              {data.tags.map((tg) => (
                <span key={tg.id} className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await assignTagFn({
                        data: { tenantId, tagId: tg.id, memberIds: selected, mode: "add" },
                      });
                      toast.success(`Tagged ${selected.length} member(s)`);
                      setSelected([]);
                      await refresh();
                    }}
                  >
                    + {tg.label}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await assignTagFn({
                        data: { tenantId, tagId: tg.id, memberIds: selected, mode: "remove" },
                      });
                      setSelected([]);
                      await refresh();
                    }}
                  >
                    −
                  </Button>
                </span>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ---------------------------------------------------------- registry */}
      <section className="panel space-y-3 p-5">
        <h2 className="font-display text-base font-semibold">{t("fpo.members.registry")}</h2>
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("fpo.members.none")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th />
                  <th>{t("fpo.ui.ffda21c01e")}</th>
                  <th>{t("fpo.ui.709a23220f")}</th>
                  <th>{t("fpo.ui.3deb745651")}</th>
                  <th>{t("fpo.ui.65075f1acc")}</th>
                  <th>{t("fpo.ui.adb5811a42")}</th>
                  <th>{t("fpo.ui.1ed6f226bd")}</th>
                  <th>{t("fpo.ui.7e5a975b6a")}</th>
                  <th>{t("fpo.ui.0599298f6d")}</th>
                  <th>{t("fpo.ui.bae7d5be70")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${m.display_name}`}
                        checked={selected.includes(m.id)}
                        onChange={() => toggleSelected(m.id)}
                      />
                    </td>
                    <td className="font-mono text-xs">{m.membership_number ?? m.member_ref}</td>
                    <td>
                      <button
                        type="button"
                        className="underline"
                        onClick={() => setOpenMember(m.id)}
                      >
                        {m.display_name}
                      </button>
                      {(m.tagCodes ?? []).length > 0 ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {(m.tagCodes ?? []).join(", ")}
                        </span>
                      ) : null}
                    </td>
                    <td className="text-xs">{(m.member_type ?? "—").replaceAll("_", " ")}</td>
                    <td className="text-xs">
                      {m.village_code ?? "—"}
                      {m.village_cluster ? ` · ${m.village_cluster}` : ""}
                    </td>
                    <td className="text-xs">{(m.crops ?? []).join(", ") || "—"}</td>
                    <td className="text-xs">{m.acreage ?? "—"}</td>
                    <td>
                      <StateBadge state={m.farmer_user_id ? "linked" : "unlinked"} />
                    </td>
                    <td className="text-xs">
                      {(m.consentPurposes ?? []).length === 0
                        ? t("fpo.members.noConsent")
                        : (m.consentPurposes ?? []).length}
                    </td>
                    <td>
                      <StateBadge state={m.status} />
                    </td>
                    <td className="text-right">
                      {data.canAdd ? (
                        <select
                          className="field-base py-1 text-xs"
                          value=""
                          aria-label={`Change status for ${m.display_name}`}
                          onChange={async (e) => {
                            if (!e.target.value) return;
                            try {
                              await statusFn({
                                data: { memberId: m.id, status: e.target.value as MembershipState },
                              });
                              toast.success(t("fpo.ui.0deb678052"));
                              await refresh();
                            } catch (err) {
                              toast.error((err as Error).message);
                            }
                          }}
                        >
                          <option value="">{t("fpo.ui.b5996c9f78")}</option>
                          {NEXT_STATES[m.status].map((s) => (
                            <option key={s} value={s}>
                              {MEMBERSHIP_STATE_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* -------------------------------------------------------- Farmer 360 */}
      {openRow ? (
        <section className="panel space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold">
              {t("fpo.farmer360.title")} — {openRow.display_name}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setOpenMember(null)}>
              {t("fpo.ui.bbfa773e5a")}</Button>
          </div>

          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <p>{t("fpo.ui.52c5d83e39")}{" "}{openRow.membership_number ?? openRow.member_ref}</p>
            <p>{t("fpo.ui.11dc9e1952")}{" "}{MEMBERSHIP_STATE_LABEL[openRow.status]}</p>
            <p>{t("fpo.ui.deb5f6b574")}{" "}{openRow.village_code ?? "—"}</p>
          </div>

          {!openRow.farmer_user_id ? (
            <div className="space-y-3 border-t border-border pt-3">
              <h3 className="text-sm font-semibold">{t("fpo.members.link")}</h3>
              <p className="field-hint">
                {t("fpo.ui.f06d0457d8")}</p>
              <input
                className="field-base"
                placeholder={t("fpo.ui.95242d5f07")}
                value={candidateQuery}
                onChange={(e) => setCandidateQuery(e.target.value)}
              />
              {(candidates.data ?? []).map((c) => (
                <div
                  key={c.farmer_user_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span>
                    {c.full_name ?? "Unnamed"} · {c.village_code ?? "—"} ·{" "}
                    {c.total_extent_acres ?? "—"} {t("fpo.ui.0c11d463c7")}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={c.alreadyMember}
                    onClick={async () => {
                      try {
                        await linkFn({
                          data: { memberId: openRow.id, farmerUserId: c.farmer_user_id },
                        });
                        toast.success(t("fpo.ui.819118e4df"));
                        await refresh();
                      } catch (err) {
                        toast.error((err as Error).message);
                      }
                    }}
                  >
                    {c.alreadyMember ? "Already a member" : "Link"}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3 border-t border-border pt-3">
              <h3 className="text-sm font-semibold">{t("fpo.consent.title")}</h3>
              <p className="field-hint">{t("fpo.consent.hint")}</p>
              <div className="flex flex-wrap gap-2">
                {openConsents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("fpo.members.noConsent")}</p>
                ) : (
                  openConsents.map((c) => (
                    <span
                      key={c.id}
                      className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs"
                    >
                      {FPO_PURPOSE_LABEL[c.purpose_code as FpoPurpose] ?? c.purpose_code}
                      {data.canConsent ? (
                        <button
                          type="button"
                          className="text-muted-foreground underline"
                          onClick={async () => {
                            await revokeFn({ data: { consentId: c.id } });
                            toast.success(t("fpo.ui.83c863d997"));
                            await refresh();
                          }}
                        >
                          {t("fpo.ui.e85a0f4980")}</button>
                      ) : null}
                    </span>
                  ))
                )}
              </div>
              {data.canConsent ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <select
                    className="field-base"
                    value={consentPurpose}
                    onChange={(e) => setConsentPurpose(e.target.value as FpoPurpose)}
                  >
                    {FPO_PURPOSES.map((p) => (
                      <option key={p} value={p}>
                        {FPO_PURPOSE_LABEL[p]}
                      </option>
                    ))}
                  </select>
                  <input
                    className="field-base"
                    placeholder={t("fpo.ui.fd0feb2100")}
                    value={consentEvidence}
                    onChange={(e) => setConsentEvidence(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    disabled={!consentEvidence.trim()}
                    onClick={async () => {
                      try {
                        await consentFn({
                          data: {
                            memberId: openRow.id,
                            purposeCode: consentPurpose,
                            evidence: consentEvidence,
                          },
                        });
                        setConsentEvidence("");
                        toast.success(t("fpo.ui.559c7ec7f7"));
                        await refresh();
                      } catch (err) {
                        toast.error((err as Error).message);
                      }
                    }}
                  >
                    {t("fpo.ui.eb794550aa")}</Button>
                </div>
              ) : null}

              {farmer360.isLoading ? (
                <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
              ) : detail ? (
                <div className="space-y-4 border-t border-border pt-3">
                  <p className="field-hint">
                    {t("fpo.ui.b84ee8d24c")}{" "}{detail.tabs.join(", ")}{t("fpo.ui.50244881aa")}</p>
                  {detail.profile ? (
                    <div className="grid gap-2 text-sm sm:grid-cols-3">
                      <p>{t("fpo.ui.71dd2eff9b")}{" "}{detail.profile.full_name ?? "—"}</p>
                      <p>{t("fpo.ui.b4838c6d96")}{" "}{detail.profile.ownership_type ?? "—"}</p>
                      <p>{t("fpo.ui.ac2c83661d")}{" "}{detail.profile.total_extent_acres ?? "—"} {t("fpo.ui.0c11d463c7")}</p>
                      <p>{t("fpo.ui.61b9204fa3")}{" "}{detail.profile.social_category ?? "—"}</p>
                      <p>{t("fpo.ui.b0cba8f9cd")}{" "}{detail.profile.irrigation_source ?? "—"}</p>
                      <p>{t("fpo.ui.deb5f6b574")}{" "}{detail.profile.village_code ?? "—"}</p>
                    </div>
                  ) : null}
                  {detail.farms.length > 0 ? (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>{t("fpo.ui.36d4b77351")}</th>
                          <th>{t("fpo.ui.74341e3c27")}</th>
                          <th>{t("fpo.ui.c5db3d91c4")}</th>
                          <th>{t("fpo.ui.1ed6f226bd")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.farms.map((f) => (
                          <tr key={f.id}>
                            <td className="font-mono text-xs">{f.plot_ref}</td>
                            <td>{f.label}</td>
                            <td>{f.primary_crop ?? "—"}</td>
                            <td>{f.area_acres ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}
                  {detail.crops.length > 0 ? (
                    <p className="text-sm">
                      {t("fpo.ui.3b0f991b19")}{" "}
                      {detail.crops
                        .map((c) => `${c.crop} (${c.acres} ac, ${c.plots} plot(s))`)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {detail.schemes.length > 0 ? (
                    <p className="text-sm">
                      {t("fpo.ui.0d5c2adeb3")}{" "}{detail.schemes.length} {t("fpo.ui.67720ac4b9")}{" "}
                      {detail.schemes[0]?.status.replaceAll("_", " ")}
                    </p>
                  ) : null}
                  {detail.purposes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("fpo.farmer360.denied")}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
