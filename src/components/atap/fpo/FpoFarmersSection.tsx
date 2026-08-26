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
            Adding a member creates a membership relationship only. Farmer records, farms and
            documents stay owned by the farmer.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input
              className="field-base"
              placeholder="Farmer name"
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
              placeholder="Village code"
              value={village}
              onChange={(e) => setVillage(e.target.value)}
            />
            <input
              className="field-base"
              placeholder="Village cluster"
              value={cluster}
              onChange={(e) => setCluster(e.target.value)}
            />
            <input
              className="field-base"
              placeholder="Crops (comma separated)"
              value={crops}
              onChange={(e) => setCrops(e.target.value)}
            />
            <input
              className="field-base"
              placeholder="Acreage"
              value={acreage}
              onChange={(e) => setAcreage(e.target.value)}
            />
            <input
              className="field-base"
              placeholder="Contact hint"
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
            <option value="">All statuses</option>
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
            <option value="">All crops</option>
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
            <option value="">All tags</option>
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
            Clear filters
          </Button>
          {data.canClassify ? (
            <>
              <input
                className="field-base max-w-48"
                placeholder="Save as segment"
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
                  toast.success("Segment saved");
                  await refresh();
                }}
              >
                Save segment
              </Button>
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
            Tags are FPO-local classification. They are never written back to farmer master data.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              className="field-base max-w-64"
              placeholder="New tag label"
              value={tagLabel}
              onChange={(e) => setTagLabel(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={tagLabel.trim().length < 2}
              onClick={async () => {
                await saveTagFn({ data: { tenantId, label: tagLabel } });
                setTagLabel("");
                toast.success("Tag saved");
                await refresh();
              }}
            >
              Add tag
            </Button>
          </div>
          {selected.length > 0 && data.tags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <p className="text-sm">{selected.length} selected —</p>
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
                  <th>Membership no.</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Village / cluster</th>
                  <th>Crops</th>
                  <th>Acres</th>
                  <th>Identity</th>
                  <th>Consent</th>
                  <th>Status</th>
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
                              toast.success("Membership updated and audited");
                              await refresh();
                            } catch (err) {
                              toast.error((err as Error).message);
                            }
                          }}
                        >
                          <option value="">Change status…</option>
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
              Close
            </Button>
          </div>

          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <p>Membership: {openRow.membership_number ?? openRow.member_ref}</p>
            <p>Status: {MEMBERSHIP_STATE_LABEL[openRow.status]}</p>
            <p>Village: {openRow.village_code ?? "—"}</p>
          </div>

          {!openRow.farmer_user_id ? (
            <div className="space-y-3 border-t border-border pt-3">
              <h3 className="text-sm font-semibold">{t("fpo.members.link")}</h3>
              <p className="field-hint">
                Search an existing AgriGhar farmer identity by name or village. Only minimal
                identifying fields are returned and every search is audited.
              </p>
              <input
                className="field-base"
                placeholder="Name or village code (min 3 characters)"
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
                    {c.total_extent_acres ?? "—"} ac
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={c.alreadyMember}
                    onClick={async () => {
                      try {
                        await linkFn({
                          data: { memberId: openRow.id, farmerUserId: c.farmer_user_id },
                        });
                        toast.success("Farmer identity linked and audited");
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
                            toast.success("Consent revoked and audited");
                            await refresh();
                          }}
                        >
                          revoke
                        </button>
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
                    placeholder="How authorization was captured"
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
                        toast.success("Farmer authorization recorded and audited");
                        await refresh();
                      } catch (err) {
                        toast.error((err as Error).message);
                      }
                    }}
                  >
                    Record authorization
                  </Button>
                </div>
              ) : null}

              {farmer360.isLoading ? (
                <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
              ) : detail ? (
                <div className="space-y-4 border-t border-border pt-3">
                  <p className="field-hint">
                    Visible sections: {detail.tabs.join(", ")}. Bank, insurance and partner data are
                    never shown here.
                  </p>
                  {detail.profile ? (
                    <div className="grid gap-2 text-sm sm:grid-cols-3">
                      <p>Name: {detail.profile.full_name ?? "—"}</p>
                      <p>Ownership: {detail.profile.ownership_type ?? "—"}</p>
                      <p>Extent: {detail.profile.total_extent_acres ?? "—"} ac</p>
                      <p>Category: {detail.profile.social_category ?? "—"}</p>
                      <p>Irrigation: {detail.profile.irrigation_source ?? "—"}</p>
                      <p>Village: {detail.profile.village_code ?? "—"}</p>
                    </div>
                  ) : null}
                  {detail.farms.length > 0 ? (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Plot</th>
                          <th>Label</th>
                          <th>Crop</th>
                          <th>Acres</th>
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
                      Crop mix:{" "}
                      {detail.crops
                        .map((c) => `${c.crop} (${c.acres} ac, ${c.plots} plot(s))`)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {detail.schemes.length > 0 ? (
                    <p className="text-sm">
                      Scheme applications: {detail.schemes.length} — latest{" "}
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
