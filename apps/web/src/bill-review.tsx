import React, { useEffect, useState } from "react";
import { api, upload, ApiError, SessionExpired } from "./auth-client";
import type { Translation } from "./i18n";
import "./bill-review.css";
type BillForm = {
  consumerNumber: string;
  tariff: string;
  sanctionedLoad: string;
  sanctionedLoadUnit: "" | "kW" | "kVA";
  monthlyUnits: string;
  monthlyBill: string;
};
const emptyForm: BillForm = {
  consumerNumber: "",
  tariff: "",
  sanctionedLoad: "",
  sanctionedLoadUnit: "",
  monthlyUnits: "",
  monthlyBill: "",
};
const isCompleteConfirmation = (value: any) =>
  Boolean(
    value?.consumerNumber &&
    value?.tariff &&
    value?.sanctionedLoad != null &&
    value?.sanctionedLoadUnit &&
    value?.monthlyUnits != null &&
    value?.monthlyBill != null,
  );
const documentValues = (document: any): BillForm => {
  const value = isCompleteConfirmation(document?.confirmed)
    ? document.confirmed
    : (document?.extraction ?? {});
  return {
    consumerNumber: value.consumerNumber ?? "",
    tariff: value.tariff ?? "",
    sanctionedLoad:
      value.sanctionedLoad == null ? "" : String(value.sanctionedLoad),
    sanctionedLoadUnit:
      value.sanctionedLoadUnit === "kW" || value.sanctionedLoadUnit === "kVA"
        ? value.sanctionedLoadUnit
        : "",
    monthlyUnits: value.monthlyUnits == null ? "" : String(value.monthlyUnits),
    monthlyBill: value.monthlyBill == null ? "" : String(value.monthlyBill),
  };
};
const readableIssues = (error: unknown) => {
  if (!(error instanceof ApiError) || !error.issues)
    return error instanceof Error ? error.message : "Request failed";
  const fields: Record<string, string> = {
    consumerNumber: "Consumer number",
    tariff: "Tariff",
    sanctionedLoad: "Sanctioned load",
    sanctionedLoadUnit: "Sanctioned-load unit",
    monthlyUnits: "Monthly units",
    monthlyBill: "Monthly bill",
  };
  return (
    Object.entries(error.issues)
      .flatMap(([field, messages]) =>
        messages.map((message) => `${fields[field] ?? field}: ${message}`),
      )
      .join(" ") || error.message
  );
};
export function BillReview({
  lead,
  onConfirmed,
  canReopen = false,
  t,
}: {
  lead: any;
  onConfirmed?: (lead: any) => void;
  canReopen?: boolean;
  t: Translation;
}) {
  const [doc, setDoc] = useState<any>(),
    [form, setForm] = useState<BillForm>(emptyForm),
    [preview, setPreview] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState(""),
    [dirty, setDirty] = useState(false),
    [suggestionsAvailable, setSuggestionsAvailable] = useState(false);
  const load = async (replaceEdits = false) => {
    setError("");
    try {
      const r = await api("/leads/" + lead.id + "/bill");
      setDoc(r.document);
      if (!dirty || replaceEdits) setForm(documentValues(r.document));
      if (r.document) {
        const p = await api(
          "/leads/" + lead.id + "/bill/" + r.document.id + "/preview",
        );
        setPreview(p.url);
      }
      return r.document;
    } catch (e: any) {
      setError(e instanceof SessionExpired ? e.message : e.message);
      return undefined;
    }
  };
  useEffect(() => {
    setDirty(false);
    void load(true);
  }, [lead.id]);
  const submitUpload = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setSuccess("");
    try {
      const r = await upload("/leads/" + lead.id + "/bill/upload", file);
      setDirty(false);
      setSuccess("Bill saved. Extract details or enter them manually.");
      await load(true);
    } catch (e: any) {
      setError(readableIssues(e));
    } finally {
      setBusy(false);
    }
  };
  const extract = async () => {
    if (!doc) return;
    setBusy(true);
    setError("");
    try {
      await api("/leads/" + lead.id + "/bill/" + doc.id + "/extract", {
        method: "POST",
      });
      const next = await load(!dirty);
      if (dirty) {
        setSuggestionsAvailable(Boolean(next?.extraction));
        setSuccess("Extraction finished. Your unsaved edits were kept.");
      } else setSuccess("Extraction complete. Review the suggestions.");
    } catch (e: any) {
      const message = readableIssues(e);
      await load(false);
      setError(message);
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    if (!doc) return;
    setBusy(true);
    try {
      const result = await api(
        "/leads/" + lead.id + "/bill/" + doc.id + "/confirm",
        {
          method: "PUT",
          body: JSON.stringify({
            consumerNumber: form.consumerNumber,
            tariff: form.tariff,
            sanctionedLoad: form.sanctionedLoad,
            sanctionedLoadUnit: form.sanctionedLoadUnit,
            monthlyUnits: form.monthlyUnits,
            monthlyBill: form.monthlyBill,
          }),
        },
      );
      setDirty(false);
      setSuggestionsAvailable(false);
      setSuccess("Confirmed values saved.");
      if (result.lead) onConfirmed?.(result.lead);
      await load(true);
    } catch (e: any) {
      setError(readableIssues(e));
    } finally {
      setBusy(false);
    }
  };
  const edit = (key: keyof BillForm, value: string) => {
    setDirty(true);
    setForm((current) => ({ ...current, [key]: value }));
  };
  const replaceWithSuggestions = () => {
    setForm(documentValues({ extraction: doc?.extraction }));
    setDirty(false);
    setSuggestionsAvailable(false);
  };
  const reopen = async () => {
    if (!doc) return;
    const reason = window.prompt(
      "Why does this confirmed bill need correction?",
    );
    if (!reason) return;
    setBusy(true);
    setError("");
    try {
      await api("/leads/" + lead.id + "/bill/" + doc.id + "/reopen", {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setSuccess(
        "Bill reopened for correction. The previous confirmation remains in audit history.",
      );
      await load(true);
    } catch (e: any) {
      setError(e.message || "The bill could not be reopened.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="grid bill-review">
      <article className="card bill">
        <h2>{t.bill}</h2>
        {preview ? (
          <img
            src={preview}
            alt="Uploaded electricity bill"
            className="bill-preview"
          />
        ) : (
          <p>{doc ? "Loading protected preview…" : "No bill yet."}</p>
        )}
        <label>
          {doc ? t.replaceBill : t.selectBill}
          <input
            disabled={busy}
            type="file"
            accept="image/jpeg,image/png"
            onChange={submitUpload}
          />
        </label>
      </article>
      <article className="card form compact-form">
        <h2>{t.reviewBill}</h2>
        <p>
          {t.billStatus}: <b>{doc?.status || "NO_BILL"}</b>
        </p>
        <p>
          {doc?.status === "PENDING_EXTRACTION"
            ? "Bill saved. Extract details or enter them manually."
            : doc?.status === "EXTRACTING"
              ? "Extracting bill details. This can take a short time."
              : doc?.status === "EXTRACTED"
                ? "AI suggestions are ready. Check every value before confirming."
                : doc?.status === "MANUAL_REQUIRED"
                  ? t.manualBill
                  : doc?.status === "CONFIRMED"
                    ? "Reviewed values are saved."
                    : "Upload a JPEG or PNG bill to begin review."}
        </p>
        {doc?.status === "CONFIRMED" && canReopen && (
          <button className="secondary" disabled={busy} onClick={reopen}>
            Correct confirmed values
          </button>
        )}
        {suggestionsAvailable && (
          <button
            className="secondary"
            disabled={busy}
            onClick={replaceWithSuggestions}
          >
            Replace edits with AI suggestions
          </button>
        )}
        {doc && doc.status !== "CONFIRMED" && doc.status !== "EXTRACTING" && (
          <button className="secondary" disabled={busy} onClick={extract}>
            {busy
              ? "Extracting…"
              : doc.status === "MANUAL_REQUIRED"
                ? t.retryExtraction
                : t.extract}
          </button>
        )}
        <p>
          {t.aiReview}
        </p>
        {error && <p className="error">{error}</p>}
        {success && <p>{success}</p>}
        <label>
          {t.consumerNumber}
          <input
            value={form.consumerNumber}
            onChange={(e) => edit("consumerNumber", e.target.value)}
          />
        </label>
        <label>
          {t.tariff}
          <input
            value={form.tariff}
            onChange={(e) => edit("tariff", e.target.value)}
          />
        </label>
        <label>
          {t.sanctionedLoad}
          <input
            inputMode="decimal"
            value={form.sanctionedLoad}
            onChange={(e) => edit("sanctionedLoad", e.target.value)}
          />
        </label>
        <label>
          {t.loadUnit}
          <select
            value={form.sanctionedLoadUnit}
            onChange={(e) => edit("sanctionedLoadUnit", e.target.value)}
          >
            <option value="">{t.selectUnit}</option>
            <option value="kW">kW</option>
            <option value="kVA">kVA</option>
          </select>
        </label>
        <label>
          {t.monthlyUnits}
          <input
            value={form.monthlyUnits}
            onChange={(e) => edit("monthlyUnits", e.target.value)}
          />
        </label>
        <label>
          {t.monthlyBill}
          <input
            value={form.monthlyBill}
            onChange={(e) => edit("monthlyBill", e.target.value)}
          />
        </label>
        <button disabled={busy || !doc} className="primary" onClick={confirm}>
          {busy ? t.saving : t.confirm}
        </button>
      </article>
    </section>
  );
}
