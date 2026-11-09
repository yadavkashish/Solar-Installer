import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  api,
  download,
  login,
  logout,
  restore,
  upload,
  ApiError,
  SessionExpired,
} from "./auth-client";
import type { CurrentUser } from "./auth-client";
import { BillReview } from "./bill-review";
import { leadPath, parseRoute, type LeadTab, type Route } from "./routes";
import {
  languageName,
  translate,
  type Language,
  type Translation,
} from "./i18n";
import "./style.css";
const leadTabs: { id: LeadTab; label: string }[] = [
  { id: "overview", label: "overview" },
  { id: "bill", label: "bill review" },
  { id: "quote", label: "quote" },
  { id: "project", label: "project" },
];
const rupee = (n: number) => "₹" + n.toLocaleString("en-IN");
function LanguagePicker({
  language,
  setLanguage,
}: {
  language: Language;
  setLanguage: (language: Language) => void;
}) {
  return (
    <label className="language-picker">
      <span>Language / भाषा</span>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
      >
        {(Object.keys(languageName) as Language[]).map((key) => (
          <option key={key} value={key}>
            {languageName[key]}
          </option>
        ))}
      </select>
    </label>
  );
}
function Login({
  go,
  language,
  setLanguage,
}: {
  go: (u: CurrentUser) => void;
  language: Language;
  setLanguage: (language: Language) => void;
}) {
  const t = translate(language);
  const [email, setEmail] = useState("sales@surya.demo"),
    [password, setPassword] = useState("DemoPass!2026"),
    [error, setError] = useState("");
  return (
    <main className="login">
      <div className="sun">☀</div>
      <LanguagePicker language={language} setLanguage={setLanguage} />
      <p className="eyebrow">VIDARBHA SOLAR WORKSPACE</p>
      <h1>Clarity for every rooftop.</h1>
      <section className="card">
        <h2>{t.signIn}</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              go(await login(email, password));
            } catch (x: any) {
              setError(x.message);
            }
          }}
        >
          <label>
            {t.email}
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            {t.password}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary">{t.signIn}</button>
        </form>
        <small>
          Demo: sales@surya.demo or prashant@surya.demo; password DemoPass!2026.
        </small>
      </section>
    </main>
  );
}
function Header({ set }: { set: (x: string) => void }) {
  return (
    <header>
      <button className="brand" onClick={() => set("list")}>
        surya<span>path</span>
      </button>
      <nav>
        <button onClick={() => set("list")}>Leads</button>
        <button onClick={() => set("new")}>New lead</button>
      </nav>
      <i>SS</i>
    </header>
  );
}
function List({
  open,
  onSessionExpired,
}: {
  open: (id: string) => void;
  onSessionExpired: () => void;
}) {
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["leads"],
    queryFn: () => api("/leads"),
  });
  useEffect(() => {
    if (error instanceof SessionExpired) onSessionExpired();
  }, [error, onSessionExpired]);
  return (
    <main>
      <div className="head">
        <div>
          <p className="eyebrow">SALES WORKSPACE</p>
          <h1>Lead pipeline</h1>
          <p>Transparent baseline scoring, never auto-rejection.</p>
        </div>
      </div>
      <section className="card table">
        <div className="row labels">
          <span>Customer</span>
          <span>Readiness</span>
          <span>Preliminary size</span>
          <span>Next action</span>
        </div>
        {isLoading ? (
          <p>Loading leads…</p>
        ) : (
          data.map((l: any) => (
            <button className="row lead" onClick={() => open(l.id)} key={l.id}>
              <span>
                <b>{l.name}</b>
                <small>
                  {l.id} · {l.ownerType}
                </small>
              </span>
              <span>
                <em>
                  {l.score.band} · {l.score.points}
                </em>
                <small>{l.score.reasons[0]}</small>
              </span>
              <span>{l.recommendation.kw ?? "—"} kW</span>
              <span>{l.score.nextAction}</span>
            </button>
          ))
        )}
      </section>
    </main>
  );
}
function New({ done, t }: { done: (x: any) => void; t: Translation }) {
  const [f, setF] = useState<any>({
      name: "",
      email: "",
      phone: "",
      pincode: "",
      ownerType: "OWNER",
      roofType: "RCC",
      roofArea: "",
      monthlyBill: "",
      monthlyUnits: "",
      tariff: "Residential",
    }),
    [err, setErr] = useState(""),
    [bill, setBill] = useState<File | null>(null),
    [createdLead, setCreatedLead] = useState<any>(null),
    [busy, setBusy] = useState(false);
  const change = (k: string, v: string) => setF({ ...f, [k]: v });
  const saveAndUpload = async () => {
    if (!bill) {
      setErr(t.selectBill);
      return;
    }
    setBusy(true);
    setErr("");
    let lead = createdLead;
    try {
      if (!lead) {
        lead = await api("/leads", {
          method: "POST",
          body: JSON.stringify({
            ...f,
            roofArea: +f.roofArea,
            monthlyBill: +f.monthlyBill,
            monthlyUnits: f.monthlyUnits ? +f.monthlyUnits : null,
          }),
        });
        setCreatedLead(lead);
      }
      await upload("/leads/" + lead.id + "/bill/upload", bill);
      done(lead);
    } catch (x: any) {
      setErr(
        lead
          ? `Lead saved, but bill upload failed: ${x.message}. Choose a replacement and retry; a new lead will not be created.`
          : x.message,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="narrow">
      <p className="eyebrow">{t.intake}</p>
      <h1>{t.rooftop}</h1>
      <form
        className="card form"
        onSubmit={async (e) => {
          e.preventDefault();
          await saveAndUpload();
        }}
      >
        {[
          ["name", t.fullName],
          ["email", t.email],
          ["phone", t.phone],
          ["pincode", t.pincode],
          ["roofArea", t.roofArea],
          ["monthlyBill", t.monthlyBill],
          ["monthlyUnits", t.monthlyUnits],
        ].map(([k, l]) => (
          <label key={k}>
            {l}
            <input
              required={k !== "monthlyUnits"}
              inputMode={k === "pincode" ? "numeric" : undefined}
              pattern={k === "pincode" ? "[0-9]{6}" : undefined}
              maxLength={k === "pincode" ? 6 : undefined}
              value={f[k]}
              onChange={(e) => change(k, e.target.value)}
            />
          </label>
        ))}
        <label>
          {t.relationship}
          <select
            value={f.ownerType}
            onChange={(e) => change("ownerType", e.target.value)}
          >
            <option value="OWNER">{t.owner}</option>
            <option value="TENANT">{t.tenant}</option>
          </select>
        </label>
        <label>
          {t.roofType}
          <select
            value={f.roofType}
            onChange={(e) => change("roofType", e.target.value)}
          >
            <option value="RCC">RCC concrete</option>
            <option value="METAL">Metal sheet</option>
            <option value="TILE">Tile roof</option>
            <option value="OTHER">Other / needs survey</option>
          </select>
        </label>
        <label>
          {t.tariff}
          <select
            value={f.tariff}
            onChange={(e) => change("tariff", e.target.value)}
          >
            <option>Residential</option>
            <option>Commercial</option>
            <option value="">Not sure</option>
          </select>
        </label>
        <div className="upload">
          <b>{t.billUpload}</b>
          <span>
            JPEG or PNG only. It is uploaded privately after the lead is saved;
            if upload fails, retry without creating another lead.
          </span>
          <input
            required={!createdLead}
            type="file"
            accept="image/png,image/jpeg"
            onChange={(event) => setBill(event.target.files?.[0] ?? null)}
          />
        </div>
        {err && <p className="error">{err}</p>}
        <button className="primary" disabled={busy}>
          {busy
            ? "Saving…"
            : createdLead
              ? "Retry bill upload"
              : "Save and review bill"}
        </button>
      </form>
    </main>
  );
}
type QuoteCalculation = {
  capacityKw: number;
  grossCost: number;
  subsidy: number;
  netCost: number;
  yearlyGeneration: number;
  yearlySavings: number;
  paybackYears: number | null;
  assumptions: { subsidyNote: string };
};
type QuoteView = { id: string; calculation: QuoteCalculation };
const quoteView = (value: unknown): QuoteView | null => {
  const q = value as any,
    c = q?.calculation;
  if (
    !q ||
    typeof q.id !== "string" ||
    !c ||
    ![
      "capacityKw",
      "grossCost",
      "subsidy",
      "netCost",
      "yearlyGeneration",
      "yearlySavings",
    ].every((key) => typeof c[key] === "number") ||
    typeof c.assumptions?.subsidyNote !== "string"
  )
    return null;
  return q as QuoteView;
};
function Quote({
  q,
  onSessionExpired,
}: {
  q: any;
  onSessionExpired: () => void;
}) {
  const quote = quoteView(q);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!quote)
    return (
      <article className="card">
        <h2>Quote unavailable</h2>
        <p>
          The saved quote could not be read. Please issue a new quote or contact
          sales.
        </p>
      </article>
    );
  const c = quote.calculation;
  const downloadPdf = async () => {
    setBusy(true);
    setError("");
    try {
      const blob = await download("/quotes/" + quote.id + "/pdf");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "solar-quote.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      if (e instanceof SessionExpired) {
        onSessionExpired();
        return;
      }
      setError(e.message || "Quote PDF could not be downloaded.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="card quote">
      <p className="eyebrow">SAVED SNAPSHOT · {quote.id}</p>
      <h2>{c.capacityKw} kW solar system</h2>
      <strong>{rupee(c.netCost)}</strong>
      <p>Estimated cost after subsidy</p>
      <hr />
      <p>
        Gross installed cost <b>{rupee(c.grossCost)}</b>
      </p>
      <p>
        Estimated subsidy <b>− {rupee(c.subsidy)}</b>
      </p>
      <p>
        Annual generation <b>{c.yearlyGeneration.toLocaleString()} units</b>
      </p>
      <p>
        Annual savings <b>{rupee(c.yearlySavings)}</b>
      </p>
      <p>
        Simple payback <b>{c.paybackYears ?? "N/A"} years</b>
      </p>
      <button className="primary" disabled={busy} onClick={downloadPdf}>
        {busy ? "Preparing PDF…" : "Download quote PDF"}
      </button>
      {error && <p className="error">{error}</p>}
      <small>
        {c.assumptions.subsidyNote} Savings are estimates, not guarantees.
      </small>
    </article>
  );
}
function StatusLinkManager({
  leadId,
  onSessionExpired,
}: {
  leadId: string;
  onSessionExpired: () => void;
}) {
  const [links, setLinks] = useState<any[]>([]),
    [createdUrl, setCreatedUrl] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = async () => {
    try {
      const result = await api("/leads/" + leadId + "/status-links");
      setLinks(result.links);
    } catch (e: any) {
      if (e instanceof SessionExpired) onSessionExpired();
      else setError(e.message || "Could not load status links.");
    }
  };
  useEffect(() => {
    void load();
  }, [leadId]);
  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api("/leads/" + leadId + "/status-links", {
        method: "POST",
        body: JSON.stringify({ expiresInDays: 30 }),
      });
      setCreatedUrl(result.url);
      await load();
    } catch (e: any) {
      if (e instanceof SessionExpired) onSessionExpired();
      else setError(e.message || "Could not create customer link.");
    } finally {
      setBusy(false);
    }
  };
  const revoke = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      await api("/leads/" + leadId + "/status-links/" + id, {
        method: "DELETE",
      });
      await load();
    } catch (e: any) {
      if (e instanceof SessionExpired) onSessionExpired();
      else setError(e.message || "Could not revoke customer link.");
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(createdUrl);
    } catch {
      setError("Copy the displayed link manually.");
    }
  };
  return (
    <article className="card">
      <h2>Customer status access</h2>
      <p>
        Create a customer-safe link that expires in 30 days. The secret is shown
        only when created.
      </p>
      <button className="secondary" disabled={busy} onClick={create}>
        {busy ? "Creating…" : "Create customer link"}
      </button>
      {createdUrl && (
        <label>
          Customer link
          <input readOnly value={createdUrl} />
          <button className="secondary" onClick={copy}>
            Copy link
          </button>
        </label>
      )}
      {error && <p className="error">{error}</p>}
      <ul>
        {links.map((link) => (
          <li key={link.id}>
            {link.revokedAt
              ? "Revoked"
              : new Date(link.expiresAt) > new Date()
                ? "Active"
                : "Expired"}{" "}
            · expires {new Date(link.expiresAt).toLocaleDateString()}{" "}
            {!link.revokedAt && (
              <button
                className="secondary"
                disabled={busy}
                onClick={() => revoke(link.id)}
              >
                Revoke
              </button>
            )}
          </li>
        ))}
      </ul>
    </article>
  );
}
function CustomerStatus({ token, t }: { token: string; t: Translation }) {
  const [state, setState] = useState<{
    loading: boolean;
    data?: any;
    error?: string;
  }>({ loading: true });
  useEffect(() => {
    let live = true;
    fetch("/api/customer-status/" + encodeURIComponent(token))
      .then(async (response) => {
        if (!response.ok)
          throw Error(
            response.status === 404
              ? "This customer link is invalid, expired, or revoked."
              : "Customer status is unavailable.",
          );
        return response.json();
      })
      .then((data) => {
        if (live) setState({ loading: false, data });
      })
      .catch((error) => {
        if (live) setState({ loading: false, error: error.message });
      });
    return () => {
      live = false;
    };
  }, [token]);
  if (state.loading) return <main>{t.loading}</main>;
  if (state.error)
    return (
      <main>
        <h1>{t.status}</h1>
        <p className="error">{state.error}</p>
      </main>
    );
  return (
    <main className="narrow">
      <p className="eyebrow">{t.status}</p>
      <h1>{state.data.stage}</h1>
      <section className="card">
        <h2>{t.project}</h2>
        {state.data.timeline.length ? (
          state.data.timeline.map((event: any) => (
            <p key={`${event.stage}-${event.createdAt}`}>
              {event.stage} · {new Date(event.createdAt).toLocaleDateString()}
            </p>
          ))
        ) : (
          <p>{t.notStarted}</p>
        )}
      </section>
    </main>
  );
}
function Detail({
  x,
  back,
  role,
  onSessionExpired,
  tab,
  navigate,
  t,
}: {
  x: any;
  back: () => void;
  role: CurrentUser["role"];
  onSessionExpired: () => void;
  tab: LeadTab;
  navigate: (path: string) => void;
  t: Translation;
}) {
  const [l, setL] = useState(x),
    [kw, setKw] = useState(x.recommendation.kw || 3),
    [quoteBusy, setQuoteBusy] = useState(false),
    [quoteError, setQuoteError] = useState(""),
    qc = useQueryClient();
  useEffect(() => {
    setL(x);
    setKw(x.recommendation.kw || 3);
  }, [x]);
  const issue = async () => {
    setQuoteBusy(true);
    setQuoteError("");
    try {
      const q = await api("/leads/" + l.id + "/quote", {
        method: "POST",
        body: JSON.stringify({ kw }),
      });
      if (!quoteView(q))
        throw Error(
          "The saved quote response was invalid. No quote was displayed.",
        );
      setL({ ...l, quote: q });
      qc.invalidateQueries({ queryKey: ["leads"] });
    } catch (e: any) {
      if (e instanceof SessionExpired) {
        onSessionExpired();
        return;
      }
      setQuoteError(e.message || "Quote could not be issued.");
    } finally {
      setQuoteBusy(false);
    }
  };
  const advance = async () => {
    const s = [
        "Advance recorded (demo)",
        "Site survey complete",
        "Installation scheduled",
        "Installed",
        "Net-metering submitted",
        "Commissioned",
        "Subsidy credited",
      ],
      i = l.project?.stage ? s.indexOf(l.project.stage) : -1;
    try {
      const p = await api("/leads/" + l.id + "/stage", {
        method: "POST",
        body: JSON.stringify({ stage: s[i + 1] }),
      });
      setL({ ...l, project: p });
    } catch (e: any) {
      alert(e.message);
    }
  };
  return (
    <main>
      <button className="back" onClick={back}>
        ← All leads
      </button>
      <div className="head">
        <div>
          <p className="eyebrow">{l.id}</p>
          <h1>{l.name}</h1>
          <p>
            {l.ownerType === "OWNER" ? "Property owner" : "Tenant"} ·{" "}
            {rupee(l.monthlyBill)} monthly bill
          </p>
        </div>
        <em>
          {l.score.band} · {l.score.points}
        </em>
      </div>
      <div className="tabs">
        {leadTabs.map((tabItem) => (
          <button
            key={tabItem.id}
            className={tabItem.id === tab ? "active" : ""}
            onClick={() => navigate(leadPath(l.id, tabItem.id))}
          >
            {tabItem.label}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <section className="grid">
          <article className="card">
            <h2>Why this lead is prioritised</h2>
            {l.score.reasons.map((r: string) => (
              <p key={r}>✓ {r}</p>
            ))}
            <p>
              <b>Next action:</b> {l.score.nextAction}
            </p>
            <small>Source: baseline rules. Low scores remain actionable.</small>
          </article>
          <article className="card">
            <h2>Preliminary recommendation</h2>
            <strong className="size">{l.recommendation.kw ?? "—"} kW</strong>
            <p>{l.recommendation.note}</p>
          </article>
        </section>
      )}
      {tab === "bill" && (
        <BillReview
          lead={l}
          canReopen={role === "SALES"}
          t={t}
          onConfirmed={(updated) => {
            setL(updated);
            qc.invalidateQueries({ queryKey: ["leads"] });
          }}
        />
      )}
      {false && (
        <section className="grid">
          <article className="card bill">
            DEMO ELECTRICITY BILL
            <br />
            <br />
            Upload is private. AI output must be confirmed by a human;
            confidence flags are not calibrated probabilities.
          </article>
          <article className="card">
            <h2>Confirmed values</h2>
            <p>
              Consumer number:{" "}
              {l.consumerNumber || "Missing — request confirmation"}
            </p>
            <p>Tariff: {l.tariff || "Missing — request confirmation"}</p>
            <p>
              Average units:{" "}
              {l.monthlyUnits || "Missing — request confirmation"}
            </p>
            <button className="primary">Confirm reviewed data</button>
          </article>
        </section>
      )}
      {tab === "quote" && (
        <section className="grid">
          <article className="card">
            <h2>{t.quote}</h2>
            <label>
              {t.capacity}
              <input
                type="number"
                step="0.5"
                value={kw}
                onChange={(e) => setKw(+e.target.value)}
              />
            </label>
            <p>
              Backend calculation uses effective-dated demo rules and an
              immutable snapshot.
            </p>
            <button className="primary" disabled={quoteBusy} onClick={issue}>
              {quoteBusy ? t.saving : t.issueQuote}
            </button>
            {quoteError && <p className="error">{quoteError}</p>}
          </article>
          {l.quote ? (
            <Quote q={l.quote} onSessionExpired={onSessionExpired} />
          ) : (
            <article className="card">
              <h2>No saved quote</h2>
              <p>
                Set a capacity and issue a quote to create an immutable saved
                snapshot.
              </p>
            </article>
          )}
        </section>
      )}
      {tab === "project" && (
        <section className="grid">
          <article className="card">
            <h2>{t.project}</h2>
            <p>
              <b>{l.project?.stage || t.notStarted}</b>
            </p>
            {(l.project?.events || []).map((e: any) => (
              <p key={e.id ?? `${e.stage}-${e.createdAt}`}>✓ {e.stage}</p>
            ))}
            <button className="primary" onClick={advance}>
              {t.advanceStage}
            </button>
            <small>
              Advance recorded is a mock payment event. Every successful stage
              creates a mock notification and audit record.
            </small>
          </article>
          {role === "SALES" ? (
            <StatusLinkManager
              leadId={l.id}
              onSessionExpired={onSessionExpired}
            />
          ) : (
            <article className="card">
              <h2>Customer status access</h2>
              <p>
                Customer links are managed by your sales representative. Your
                authenticated project view remains private.
              </p>
            </article>
          )}
        </section>
      )}
    </main>
  );
}
function LeadRoute({
  route,
  role,
  navigate,
  onSessionExpired,
  t,
}: {
  route: Extract<Route, { kind: "lead" }>;
  role: CurrentUser["role"];
  navigate: (path: string) => void;
  onSessionExpired: () => void;
  t: Translation;
}) {
  const { data, error, isLoading } = useQuery({
    queryKey: ["lead", route.id],
    queryFn: () => api("/leads/" + encodeURIComponent(route.id)),
  });
  useEffect(() => {
    if (error instanceof SessionExpired) onSessionExpired();
  }, [error, onSessionExpired]);
  if (isLoading) return <main>{t.loading}</main>;
  if (error instanceof SessionExpired)
    return <main>Returning to sign in…</main>;
  if (error instanceof ApiError && error.status === 403)
    return (
      <main>
        <h1>Access denied</h1>
        <p>You do not have access to this lead.</p>
      </main>
    );
  if (error instanceof ApiError && error.status === 404)
    return (
      <main>
        <h1>Lead not found</h1>
        <p>This lead no longer exists or is unavailable.</p>
      </main>
    );
  if (error)
    return (
      <main>
        <h1>Could not load lead</h1>
        <p>{(error as Error).message}</p>
      </main>
    );
  return (
    <Detail
      x={data}
      back={() => navigate("/leads")}
      role={role}
      tab={route.tab}
      navigate={navigate}
      onSessionExpired={onSessionExpired}
      t={t}
    />
  );
}
function App() {
  const [user, setUser] = useState<CurrentUser | null>(null),
    [ready, setReady] = useState(false),
    [path, setPath] = useState(window.location.pathname),
    [notice, setNotice] = useState(""),
    [language, setLanguage] = useState<Language>(() => {
      const saved = window.localStorage.getItem("surya-language");
      return saved === "hi" || saved === "mr" ? saved : "en";
    });
  const t = translate(language);
  const navigate = (next: string, replace = false) => {
    if (replace) window.history.replaceState(null, "", next);
    else window.history.pushState(null, "", next);
    setPath(next);
  };
  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => {
    window.localStorage.setItem("surya-language", language);
  }, [language]);
  useEffect(() => {
    restore()
      .then(setUser)
      .catch(() => null)
      .finally(() => setReady(true));
  }, []);
  const route = parseRoute(path);
  useEffect(() => {
    if (route.kind !== "lead") return;
    const canonical = leadPath(route.id, route.tab);
    if (window.location.pathname !== canonical) navigate(canonical, true);
  }, [path]);
  if (route.kind === "customerStatus")
    return (
      <>
        <LanguagePicker language={language} setLanguage={setLanguage} />
        <CustomerStatus token={route.token} t={t} />
      </>
    );
  if (!ready) return <main>{t.loading}</main>;
  if (!user)
    return (
      <>
        <Login
          go={(nextUser) => {
            setUser(nextUser);
            if (route.kind === "notFound") navigate("/leads", true);
          }}
          language={language}
          setLanguage={setLanguage}
        />
        {notice && <p className="error">{notice}</p>}
      </>
    );
  const signOut = async () => {
    try {
      await logout();
    } catch (e) {
      /* client state must clear after expiry */
    }
    setUser(null);
    setNotice("Signed out.");
  };
  const sessionExpired = () => {
    setUser(null);
    setNotice("Your session expired. Please sign in again.");
  };
  return (
    <>
      <header>
        <button className="brand" onClick={() => navigate("/leads")}>
          surya<span>path</span>
        </button>
        <nav>
          <button onClick={() => navigate("/leads")}>{t.leads}</button>
          {user.role === "HOMEOWNER" && (
            <button onClick={() => navigate("/leads/new")}>{t.newLead}</button>
          )}
          <button onClick={signOut}>{t.logout}</button>
        </nav>
        <LanguagePicker language={language} setLanguage={setLanguage} />
        <i>{user.role === "SALES" ? "SS" : "HW"}</i>
      </header>
      {route.kind === "new" && user.role === "HOMEOWNER" ? (
        <New
          done={(x) => {
            navigate(leadPath(x.id, "bill"));
          }}
          t={t}
        />
      ) : route.kind === "lead" ? (
        <LeadRoute
          route={route}
          role={user.role}
          navigate={navigate}
          onSessionExpired={sessionExpired}
          t={t}
        />
      ) : route.kind === "leads" ? (
        <List
          open={(id) => navigate(leadPath(id))}
          onSessionExpired={sessionExpired}
        />
      ) : (
        <main>
          <h1>Page not found</h1>
          <p>The requested page does not exist.</p>
          <button className="primary" onClick={() => navigate("/leads")}>
            Go to leads
          </button>
        </main>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}>
    <App />
  </QueryClientProvider>,
);
