import { describe, expect, it } from "vitest";

import { type ExistingMember, planSync } from "./plan";
import type { SourceMember } from "./types";

const source = (id: number, overrides: Partial<SourceMember> = {}): SourceMember => ({
  easyvereinId: String(id),
  email: `m${id}@example.com`,
  firstName: `First${id}`,
  lastName: `Last${id}`,
  status: "active",
  membershipType: null,
  joinedOn: "2024-01-01",
  leftOn: null,
  ...overrides,
});

const existing = (id: number, overrides: Partial<ExistingMember> = {}): ExistingMember => ({
  id: `row-${id}`,
  easyverein_id: String(id),
  user_id: null,
  email: `m${id}@example.com`,
  first_name: `First${id}`,
  last_name: `Last${id}`,
  status: "active",
  membership_type: null,
  joined_on: "2024-01-01",
  left_on: null,
  deleted_at: null,
  ...overrides,
});

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("planSync", () => {
  it("inserts new members", () => {
    const plan = planSync([], [source(1)]);
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0]?.email).toBe("m1@example.com");
    expect(plan.stop).toBeNull();
  });

  it("leaves unchanged members alone", () => {
    const plan = planSync([existing(1)], [source(1)]);
    expect(plan.unchangedIds).toEqual(["row-1"]);
    expect(plan.updates).toEqual([]);
  });

  it("updates changed fields", () => {
    const plan = planSync([existing(1)], [source(1, { lastName: "Neu" })]);
    expect(plan.updates).toEqual([
      { id: "row-1", values: expect.objectContaining({ last_name: "Neu" }), restored: false },
    ]);
  });

  it("copies a new exit date from easyVerein", () => {
    const plan = planSync(
      [existing(1, { user_id: "user-1" })],
      [source(1, { status: "resigned", leftOn: "2026-11-01" })],
    );
    expect(plan.updates).toHaveLength(1);
  });

  it("marks members missing in easyVerein as deleted instead of removing them", () => {
    const rows = range(10).map((i) => existing(i, { user_id: i === 10 ? "user-10" : null }));
    const plan = planSync(
      rows,
      range(9).map((i) => source(i)),
    );
    expect(plan.markDeletedIds).toEqual(["row-10"]);
    expect(plan.stop).toBeNull();
  });

  it("keeps members easyVerein returned but we could not map", () => {
    const plan = planSync([existing(1), existing(2)], [source(1)], ["2"]);
    expect(plan.markDeletedIds).toEqual([]);
  });

  it("does not count members that are already marked deleted", () => {
    const plan = planSync([existing(1), existing(2, { deleted_at: "2026-11-01" })], [source(1)]);
    expect(plan.markDeletedIds).toEqual([]);
  });

  it("restores a member that reappears", () => {
    const plan = planSync([existing(1, { deleted_at: "2026-11-01" })], [source(1)]);
    expect(plan.updates).toEqual([{ id: "row-1", values: expect.any(Object), restored: true }]);
  });

  it("stops when more than 10% would be marked deleted", () => {
    const rows = range(10).map((i) => existing(i));
    const plan = planSync(
      rows,
      range(8).map((i) => source(i)),
    );
    expect(plan.markDeletedIds).toHaveLength(2);
    expect(plan.stop?.reason).toMatch(/Safety stop: 2 of 10/);
  });

  it("always allows a single removal in a small club", () => {
    const plan = planSync([existing(1), existing(2), existing(3)], [source(1), source(2)]);
    expect(plan.stop).toBeNull();
  });

  it("stops when easyVerein returns nobody", () => {
    const plan = planSync([existing(1)], []);
    expect(plan.stop).not.toBeNull();
  });

  it("fails on duplicate easyVerein ids", () => {
    expect(() => planSync([], [source(1), source(1)])).toThrow(/twice/);
  });
});
