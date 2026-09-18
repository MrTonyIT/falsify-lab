import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  openSync,
  closeSync,
  unlinkSync,
  renameSync,
} from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

// The ledger is operator-local. A pending reservation is deliberately NOT reclaimed
// after a crash: transport failure does not establish that the provider did not bill.
export class Budget {
  constructor(limit, { path = null, identity = null } = {}) {
    if (!Number.isFinite(limit) || limit <= 0)
      throw Error("Positive budget required");
    this.limit = limit;
    this.path = path;
    this.identity = identity;
    this.state = { version: 1, identity, spent: 0, pending: null };
    if (path) {
      mkdirSync(dirname(path), { recursive: true });
      this.transact(() => {});
    }
  }
  get spent() {
    return this.state.spent;
  }
  get reserved() {
    return this.state.pending?.upperBound ?? 0;
  }
  transact(fn) {
    if (!this.path) return fn(this.state);
    let fd;
    try {
      fd = openSync(this.path + ".lock", "wx");
      try {
        this.state = JSON.parse(readFileSync(this.path, "utf8"));
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
      if (
        this.state.version !== 1 ||
        this.state.identity !== this.identity ||
        !Number.isFinite(this.state.spent) ||
        this.state.spent < 0
      )
        throw Error("Invalid or incompatible budget ledger");
      const value = fn(this.state);
      const temp = this.path + "." + randomUUID() + ".tmp";
      writeFileSync(temp, JSON.stringify(this.state), {
        flag: "wx",
        mode: 0o600,
        flush: true,
      });
      renameSync(temp, this.path);
      return value;
    } finally {
      if (fd !== undefined) {
        closeSync(fd);
        unlinkSync(this.path + ".lock");
      }
    }
  }
  reconcile({
    reservation,
    action,
    actualCost,
    operator,
    evidence,
    noBilling = false,
  }) {
    if (
      !["settle", "release"].includes(action) ||
      typeof operator !== "string" ||
      !operator.trim() ||
      typeof evidence !== "string" ||
      !evidence.trim()
    )
      throw Error("Explicit operator and verified billing evidence required");
    if (action === "release" && noBilling !== true)
      throw Error("Explicit no-billing attestation required");
    const cost = action === "release" ? 0 : actualCost;
    if (!Number.isFinite(cost) || cost < 0)
      throw Error("Verified actual cost required");
    return this.transact((s) => {
      if (!s.pending || s.pending.id !== reservation)
        throw Error("Reservation mismatch");
      const charged = s.pending.chargedCost ?? 0;
      if (action === "release" && charged > 0)
        throw Error("Already charged usage requires verified settlement");
      if (s.spent - charged + cost < 0)
        throw Error("Invalid reconciliation balance");
      const record = {
        reservation,
        action,
        actual_cost: cost,
        previous_charge: charged,
        operator,
        evidence,
        no_billing: noBilling,
        timestamp: new Date().toISOString(),
      };
      s.spent = s.spent - charged + cost;
      s.pending = null;
      (s.reconciliations ??= []).push(record);
      return record;
    });
  }
  reserve(upperBound) {
    return this.transact((s) => {
      if (s.pending)
        throw Error(
          "Unsettled provider reservation: reconcile billing before any further request",
        );
      if (
        !Number.isFinite(upperBound) ||
        upperBound < 0 ||
        s.spent + upperBound > this.limit
      )
        throw Error("Cost guard: insufficient remaining budget");
      const id = randomUUID();
      s.pending = { id, upperBound, at: new Date().toISOString() };
      return id;
    });
  }
  charge(cost, id) {
    return this.transact((s) => {
      if (
        !Number.isFinite(cost) ||
        cost < 0 ||
        !s.pending ||
        (id && s.pending.id !== id)
      )
        throw Error("Invalid provider settlement");
      const exceeded = cost > s.pending.upperBound;
      s.spent += cost;
      s.pending = exceeded
        ? {
            ...s.pending,
            upperBound: 0,
            chargedCost: cost,
            reason:
              "Provider usage exceeded reservation; operator reconciliation required",
          }
        : null;
      return !exceeded;
    });
  }
}
