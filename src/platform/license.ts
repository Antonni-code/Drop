import { config, paymentsConfigured } from "../config";
import { boundedJson } from "../core/bounded-json";
import { DropError, string } from "../core/model";
import { verifyReceipt } from "../core/receipt";
import type { StorageAdapter } from "./repository";

export const LICENSE_KEY = "drop.license.v1";
interface License { deviceId: string; key: string; instanceId: string; receipt: string; checkedAt: number; pending: boolean }
export class LicenseService {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private storage: StorageAdapter, private extensionId: string) {}
  private queue<T>(action: () => Promise<T>): Promise<T> { const result = this.tail.then(action); this.tail = result.catch(() => undefined); return result; }
  private async read(): Promise<License> {
    const value = await this.storage.get(LICENSE_KEY) as License | undefined;
    if (value && typeof value.deviceId === "string" && typeof value.key === "string" && typeof value.instanceId === "string" && typeof value.receipt === "string" && typeof value.checkedAt === "number" && typeof value.pending === "boolean") return value;
    const empty: License = { deviceId: crypto.randomUUID(), key: "", instanceId: "", receipt: "", checkedAt: 0, pending: false };
    await this.save(empty); return empty;
  }
  private save(value: License): Promise<void> { return this.storage.set({ [LICENSE_KEY]: value }); }
  private async request(action: string, license: License): Promise<{ receipt?: string; instanceId?: string }> {
    if (!paymentsConfigured()) throw new DropError("setup", "License activation will be available when Drop launches.");
    let response: Response;
    try { response = await fetch(`${config.apiBase}/v1/${action}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Drop-Extension": this.extensionId }, body: JSON.stringify({ key: license.key, deviceId: license.deviceId, instanceId: license.instanceId }), signal: AbortSignal.timeout(10000), credentials: "omit", redirect: "error" }); }
    catch { throw new DropError(action === "activate" ? "activation_unknown" : "offline", action === "activate" ? "Activation could not be confirmed. Contact support before retrying." : "You appear to be offline. Existing clips remain available."); }
    let result: { error?: { code?: string; message?: string }; receipt?: string; instanceId?: string };
    try { result = await boundedJson(response, 16384) as typeof result; } catch { throw new DropError("response", "The license response could not be verified. Contact support."); }
    if (!response.ok) throw new DropError(result.error?.code ?? "license", result.error?.message?.slice(0, 250) ?? "The license could not be checked.");
    return result;
  }
  async status(): Promise<{ pro: boolean; label: string }> {
    const value = await this.queue(() => this.read());
    const pro = !!value.receipt && !!await verifyReceipt(value.receipt, config, value.deviceId, value.instanceId);
    return { pro, label: pro ? "Pro active" : value.pending ? "Activation needs support" : value.key ? "Reconnect to verify Pro" : "Free plan" };
  }
  activate(key: unknown): Promise<void> { return this.queue(async () => {
    if (!paymentsConfigured()) throw new DropError("setup", "Activation is not configured in this preview.");
    const current = await this.read();
    const nextKey = string(key, 200, "License key").trim();
    if (current.key && current.key !== nextKey) throw new DropError("license", "Deactivate the current key before switching keys.");
    if (current.pending) throw new DropError("activation_unknown", "Contact support to release the unconfirmed device before retrying activation.");
    const value = { ...current, key: nextKey };
    const action = value.instanceId ? "validate" : "activate";
    if (action === "activate") { value.pending = true; await this.save(value); }
    let result: Awaited<ReturnType<LicenseService["request"]>>;
    try { result = await this.request(action, value); }
    catch (error) {
      if (error instanceof DropError && ["license", "rate", "origin", "setup", "invalid"].includes(error.code)) await this.save({ ...current, pending: false });
      throw error;
    }
    if (typeof result.instanceId !== "string" || typeof result.receipt !== "string" || !await verifyReceipt(result.receipt, config, value.deviceId, result.instanceId)) throw new DropError("receipt", "The license response could not be verified. Contact support.");
    await this.save({ ...value, receipt: result.receipt, instanceId: result.instanceId, checkedAt: Date.now(), pending: false });
  }); }
  refresh(force = false): Promise<void> { return this.queue(async () => {
    const value = await this.read();
    if (!paymentsConfigured() || !value.key || !value.instanceId || (!force && Date.now() - value.checkedAt < 6 * 60 * 60 * 1000)) return;
    try {
      const result = await this.request("validate", value);
      if (typeof result.receipt !== "string" || result.instanceId !== value.instanceId || !await verifyReceipt(result.receipt, config, value.deviceId, value.instanceId)) throw new DropError("receipt", "Could not verify this license.");
      await this.save({ ...value, receipt: result.receipt, checkedAt: Date.now() });
    } catch (error) {
      if (error instanceof DropError && error.code === "license") await this.save({ ...value, receipt: "", checkedAt: Date.now() });
      if (force) throw error;
    }
  }); }
  deactivate(): Promise<void> { return this.queue(async () => {
    const value = await this.read();
    if (value.pending) throw new DropError("activation_unknown", "Ask support to release the unconfirmed activation first. Then choose Reset after support.");
    if (value.instanceId) await this.request("deactivate", value);
    await this.save({ ...value, key: "", instanceId: "", receipt: "", checkedAt: 0 });
  }); }
  resetPending(confirm: unknown): Promise<void> { return this.queue(async () => {
    const value = await this.read();
    if (confirm !== "RELEASED" || !value.pending) throw new DropError("confirm", "Only reset after support releases the unconfirmed device.");
    await this.save({ ...value, key: "", instanceId: "", receipt: "", checkedAt: 0, pending: false });
  }); }
}
