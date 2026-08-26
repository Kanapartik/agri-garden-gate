import { describe, expect, it } from "vitest";
import {
  applicationCounts,
  canAssistFarmerApplication,
  canManageApplications,
  canRecordDecision,
  canRunCampaigns,
  canTransitionApplication,
  canTransitionFacilitation,
  facilitationCounts,
  filterApplications,
  isDecisionStatus,
  nextApplicationStatuses,
  nextFacilitationStates,
  submissionReadiness,
  type ApplicationStatus,
} from "@/lib/atap/fpoApplications";

describe("FPO application lifecycle", () => {
  it("allows only forward-consistent transitions", () => {
    expect(canTransitionApplication("draft", "ready_to_submit")).toBe(true);
    expect(canTransitionApplication("ready_to_submit", "submitted")).toBe(true);
    expect(canTransitionApplication("draft", "approved")).toBe(false);
    expect(canTransitionApplication("closed", "draft")).toBe(false);
  });

  it("treats reviewer outcomes as decision statuses", () => {
    expect(isDecisionStatus("approved")).toBe(true);
    expect(isDecisionStatus("benefit_received")).toBe(true);
    expect(isDecisionStatus("documents_pending")).toBe(false);
  });

  it("offers no next status from a closed application", () => {
    expect(nextApplicationStatuses("closed")).toEqual([]);
  });

  it("blocks submission on pending documents and signatory gating", () => {
    const blocked = submissionReadiness(
      {
        status: "ready_to_submit",
        pending_documents: ["board_resolution"],
        requires_signatory: true,
      },
      { isSignatory: false },
    );
    expect(blocked.ready).toBe(false);
    expect(blocked.blockers).toHaveLength(2);

    const ready = submissionReadiness(
      { status: "ready_to_submit", pending_documents: [], requires_signatory: true },
      { isSignatory: true },
    );
    expect(ready).toEqual({ ready: true, blockers: [] });
  });

  it("blocks submission from a draft application", () => {
    const r = submissionReadiness(
      { status: "draft", pending_documents: [], requires_signatory: false },
      { isSignatory: true },
    );
    expect(r.ready).toBe(false);
  });

  it("counts and filters applications", () => {
    const rows = [
      {
        title: "Working capital",
        reference_no: "APP-1",
        status: "submitted" as ApplicationStatus,
        assigned_user_id: "u1",
      },
      {
        title: "Storage grant",
        reference_no: "APP-2",
        status: "approved" as ApplicationStatus,
        assigned_user_id: null,
      },
    ];
    const counts = applicationCounts(rows);
    expect(counts.submitted).toBe(1);
    expect(counts.approved).toBe(1);
    expect(counts.draft).toBe(0);

    expect(filterApplications(rows, { search: "storage" })).toHaveLength(1);
    expect(filterApplications(rows, { status: "submitted" })).toHaveLength(1);
    expect(filterApplications(rows, { assignedUserId: "u1" })).toHaveLength(1);
  });
});

describe("member facilitation", () => {
  it("requires notification before authorization", () => {
    expect(canTransitionFacilitation("identified", "authorized")).toBe(false);
    expect(canTransitionFacilitation("notified", "authorization_pending")).toBe(true);
    expect(canTransitionFacilitation("authorization_pending", "authorized")).toBe(true);
    expect(nextFacilitationStates("application_submitted")).toEqual([]);
  });

  it("never assists without recorded farmer authorization", () => {
    expect(canAssistFarmerApplication({ state: "notified", hasAssistanceConsent: true })).toBe(
      false,
    );
    expect(canAssistFarmerApplication({ state: "authorized", hasAssistanceConsent: false })).toBe(
      false,
    );
    expect(canAssistFarmerApplication({ state: "authorized", hasAssistanceConsent: true })).toBe(
      true,
    );
  });

  it("counts cohort states", () => {
    const counts = facilitationCounts([{ state: "notified" }, { state: "notified" }]);
    expect(counts.notified).toBe(2);
    expect(counts.authorized).toBe(0);
  });
});

describe("authority", () => {
  it("limits management to FPO admins and platform admins", () => {
    expect(canManageApplications(["viewer"], false)).toBe(false);
    expect(canManageApplications(["tenant_admin"], false)).toBe(true);
    expect(canManageApplications([], true)).toBe(true);
  });

  it("keeps decisions with the authorized reviewer", () => {
    expect(canRecordDecision(false, ["tenant_admin"])).toBe(false);
    expect(canRecordDecision(false, ["scheme_reviewer"])).toBe(true);
    expect(canRecordDecision(true, [])).toBe(true);
  });

  it("lets field agents run cohorts but not decide", () => {
    expect(canRunCampaigns(["field_agent"], false)).toBe(true);
    expect(canRecordDecision(false, ["field_agent"])).toBe(false);
  });
});
