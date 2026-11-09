import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import PDFDocument from "pdfkit";
import { z } from "zod";
import {
  createLead,
  db,
  findLead,
  listLeads,
  persistQuote,
  persistStage,
  quoteView,
  RuleConfigurationError,
  stages,
} from "./repository.js";
import {
  csrf,
  logout,
  ownsLead,
  role,
  session,
  sessionTokenHash,
  signIn,
} from "./auth.js";
import multer from "multer";
import {
  deletePrivateDocument,
  expiringDownloadUrl,
  readPrivateDocument,
  uploadPrivateDocument,
  validateDocument,
} from "./documents.js";
import { extractBill } from "./groq.js";
import {
  billConfirmationSchema,
  normaliseBillConfirmation,
  normaliseBillExtraction,
} from "./bill-schema.js";
import { recommend, score } from "./engine.js";
import {
  createStatusToken,
  customerStatus,
  hashStatusToken,
  isActiveStatusToken,
} from "./status-link.js";
import { databaseUnavailableResponse } from "./db-errors.js";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 60000, max: 120 }));
const leadInput = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8),
  ownerType: z.enum(["OWNER", "TENANT"]),
  roofType: z.string(),
  roofArea: z.coerce.number().nonnegative().nullable(),
  monthlyBill: z.coerce.number().nonnegative(),
  monthlyUnits: z.coerce.number().positive().nullable(),
  tariff: z.string().nullable(),
});
const billDocumentResponse = (doc: any) => ({
  id: doc.id,
  originalName: doc.originalName,
  status: doc.status,
  extraction: normaliseBillExtraction(doc.extraction),
  confirmed: normaliseBillConfirmation(doc.confirmed),
});
app.post("/api/auth/login", async (req, res) => {
  const data = z
    .object({ email: z.string().email(), password: z.string().min(8) })
    .safeParse(req.body);
  if (!data.success) return res.sendStatus(400);
  let login;
  try {
    login = await signIn(data.data.email, data.data.password);
  } catch (error) {
    const unavailable = databaseUnavailableResponse(error);
    if (unavailable)
      return res.status(unavailable.status).json(unavailable.body);
    console.error("auth.login.failed", { message: (error as Error).message });
    return res
      .status(500)
      .json({ error: "Sign in is temporarily unavailable." });
  }
  if (!login) return res.status(401).json({ error: "Invalid credentials" });
  res.cookie("session", login.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 86400000,
  });
  res.json({ user: login.user, csrfToken: login.csrf });
});
app.post("/api/auth/logout", session, csrf, logout);
app.get("/api/auth/me", session, async (req, res) => {
  try {
    const active = await db.session.findFirst({
      where: {
        tokenHash: sessionTokenHash(req.cookies.session),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ user: req.principal, csrfToken: active?.csrfSecret });
  } catch (error) {
    const unavailable = databaseUnavailableResponse(error);
    if (unavailable)
      return res.status(unavailable.status).json(unavailable.body);
    throw error;
  }
});
const customerStatusRateLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
app.get(
  "/api/customer-status/:token",
  customerStatusRateLimit,
  async (req, res) => {
    const token = req.params.token;
    if (Array.isArray(token) || !/^[A-Za-z0-9_-]{32,}$/.test(token))
      return res.sendStatus(404);
    const link = await db.statusToken.findUnique({
      where: { tokenHash: hashStatusToken(token) },
      include: {
        project: { include: { events: { orderBy: { createdAt: "asc" } } } },
      },
    });
    if (!link || !isActiveStatusToken(link)) return res.sendStatus(404);
    res.json(customerStatus(link.project));
  },
);
app.use("/api", session);
app.use("/api", csrf);
app.use("/api/status/:id", ownsLead);
app.use("/api/quotes/:id/pdf", async (req, res, next) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const quote = await db.quote.findUnique({
    where: { id },
    include: { lead: true },
  });
  if (!quote) return res.sendStatus(404);
  if (
    req.principal!.role === "HOMEOWNER" &&
    quote.lead.ownerId !== req.principal!.id
  )
    return res.sendStatus(403);
  next();
});
app.get("/api/leads", session, async (req, res) => {
  const all = await listLeads();
  res.json(
    req.principal?.role === "SALES"
      ? all
      : all.filter((l) => l.ownerId === req.principal?.id),
  );
});
app.get("/api/leads/:id", session, ownsLead, async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const lead = await findLead(id);
  if (!lead) return res.sendStatus(404);
  res.json(lead);
});
app.post("/api/leads", session, role("HOMEOWNER"), async (req, res) => {
  const input = leadInput.safeParse(req.body);
  if (!input.success)
    return res.status(400).json({ error: "Check required details" });
  res.status(201).json(await createLead(input.data, req.principal!.id));
});
app.put("/api/leads/:id/bill", session, csrf, ownsLead, async (req, res) => {
  const input = z
    .object({
      consumerNumber: z.string().nullable(),
      tariff: z.string().nullable(),
      monthlyUnits: z.coerce.number().positive().nullable(),
      monthlyBill: z.coerce.number().nonnegative(),
    })
    .safeParse(req.body);
  if (!input.success)
    return res.status(400).json({ error: "Invalid bill values" });
  const lead = await db.lead
    .update({
      where: { id: req.params.id as string },
      data: { ...input.data, billStatus: "CONFIRMED" },
    })
    .catch(() => null);
  if (!lead) return res.sendStatus(404);
  res.json(lead);
});
app.post(
  "/api/leads/:id/bill/upload",
  session,
  csrf,
  ownsLead,
  upload.single("bill"),
  async (req, res) => {
    const started = Date.now(),
      id = req.params.id;
    if (Array.isArray(id))
      return res.status(400).json({ error: "Invalid lead id" });
    const file = req.file;
    if (!file)
      return res
        .status(400)
        .json({ error: "Choose a JPEG or PNG bill image." });
    try {
      validateDocument(file.buffer, file.mimetype);
      console.info("bill.upload.validated", {
        leadId: id,
        bytes: file.size,
        ms: Date.now() - started,
      });
      const asset = await uploadPrivateDocument(file.buffer, file.mimetype, id);
      console.info("bill.upload.cloudinary_ok", {
        leadId: id,
        ms: Date.now() - started,
      });
      const doc = await db.billDocument.create({
        data: {
          leadId: id,
          storageKey: asset.public_id,
          publicId: asset.public_id,
          resourceType: asset.resource_type,
          deliveryType: asset.type,
          format: asset.format || file.mimetype.split("/")[1],
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          status: "PENDING_EXTRACTION",
        },
      });
      res.status(201).json({
        documentId: doc.id,
        manualRequired: true,
        message: "Bill saved. Extract details or enter them manually.",
      });
    } catch (e: any) {
      console.warn("bill.upload.failed", {
        leadId: id,
        stage: "upload_or_persist",
        ms: Date.now() - started,
        message: e?.message,
      });
      res.status(422).json({ error: e.message || "Bill upload failed" });
    }
  },
);
app.get(
  "/api/leads/:id/bill/:documentId/preview",
  session,
  ownsLead,
  async (req, res) => {
    try {
      const id = req.params.id,
        documentId = req.params.documentId;
      if (Array.isArray(id) || Array.isArray(documentId))
        return res.sendStatus(400);
      const doc = await db.billDocument.findFirst({
        where: { id: documentId, leadId: id },
      });
      if (!doc) return res.sendStatus(404);
      res.json({
        url: expiringDownloadUrl({
          publicId: doc.publicId,
          resourceType: doc.resourceType,
          deliveryType: doc.deliveryType,
          format: doc.format,
        }),
        expiresInSeconds: 300,
      });
    } catch (error: any) {
      console.error("bill.preview.failed", {
        leadId: req.params.id,
        documentId: req.params.documentId,
        message: error?.message,
        stack: error?.stack?.split("\n").slice(0, 3).join("\n"),
      });
      res.status(502).json({
        error:
          "Protected bill preview is temporarily unavailable. Re-upload older documents if needed.",
      });
    }
  },
);
app.get("/api/leads/:id/bill", session, ownsLead, async (req, res) => {
  const id = req.params.id;
  if (Array.isArray(id)) return res.sendStatus(400);
  const doc = await db.billDocument.findFirst({
    where: { leadId: id },
    orderBy: { createdAt: "desc" },
  });
  if (!doc) return res.json({ document: null });
  res.json({ document: billDocumentResponse(doc) });
});
app.post(
  "/api/leads/:id/bill/:documentId/extract",
  session,
  csrf,
  ownsLead,
  async (req, res) => {
    const id = req.params.id,
      documentId = req.params.documentId;
    if (Array.isArray(id) || Array.isArray(documentId))
      return res.sendStatus(400);
    const doc = await db.billDocument.findFirst({
      where: { id: documentId, leadId: id },
    });
    if (!doc) return res.sendStatus(404);
    if (doc.status === "CONFIRMED" || doc.status === "EXTRACTING")
      return res
        .status(409)
        .json({ error: "Extraction is unavailable for this document state." });
    const started = Date.now();
    await db.billDocument.update({
      where: { id: doc.id },
      data: { status: "EXTRACTING" },
    });
    try {
      const bytes = await readPrivateDocument({
        publicId: doc.publicId,
        resourceType: doc.resourceType,
        deliveryType: doc.deliveryType,
        format: doc.format,
      });
      console.info("bill.extract.download_ok", {
        leadId: id,
        documentId: doc.id,
        ms: Date.now() - started,
      });
      const extraction = await extractBill(bytes, doc.mimeType);
      const saved = await db.billDocument.update({
        where: { id: doc.id },
        data: {
          extraction,
          status: "EXTRACTED",
          model: process.env.GROQ_VISION_MODEL,
        },
      });
      console.info("bill.extract.success", {
        leadId: id,
        documentId: doc.id,
        ms: Date.now() - started,
      });
      res.json({
        documentId: saved.id,
        extraction: normaliseBillExtraction(saved.extraction),
      });
    } catch (e: any) {
      await db.billDocument.update({
        where: { id: doc.id },
        data: { status: "MANUAL_REQUIRED" },
      });
      console.warn("bill.extract.failed", {
        leadId: id,
        documentId: doc.id,
        ms: Date.now() - started,
        message: e?.message,
      });
      res
        .status(422)
        .json({ error: e?.message || "Extraction failed. Use manual entry." });
    }
  },
);
app.put(
  "/api/leads/:id/bill/:documentId/confirm",
  session,
  csrf,
  ownsLead,
  async (req, res) => {
    const id = req.params.id,
      documentId = req.params.documentId;
    if (Array.isArray(id) || Array.isArray(documentId))
      return res.sendStatus(400);
    const input = billConfirmationSchema.safeParse(req.body);
    if (!input.success)
      return res.status(400).json({
        error:
          "Complete consumer number, tariff, sanctioned load, monthly units and monthly bill before confirming.",
        issues: input.error.flatten().fieldErrors,
      });
    const result = await db.$transaction(async (tx) => {
      const found = await tx.billDocument.findFirst({
        where: { id: documentId, leadId: id },
        include: { lead: true },
      });
      if (!found) return null;
      const baseline = score({
        ownerType: found.lead.ownerType,
        monthlyUnits: input.data.monthlyUnits,
        roofArea:
          found.lead.roofArea == null ? null : Number(found.lead.roofArea),
        tariff: input.data.tariff,
      });
      const recommendation = recommend(
        input.data.monthlyUnits,
        found.lead.roofArea == null ? null : Number(found.lead.roofArea),
      );
      const doc = await tx.billDocument.update({
        where: { id: documentId },
        data: { confirmed: input.data, status: "CONFIRMED" },
      });
      const lead = await tx.lead.update({
        where: { id },
        data: {
          consumerNumber: input.data.consumerNumber,
          tariff: input.data.tariff,
          monthlyUnits: input.data.monthlyUnits,
          monthlyBill: Math.round(input.data.monthlyBill),
          billStatus: "CONFIRMED",
        },
      });
      await tx.qualificationAssessment.upsert({
        where: { leadId: id },
        create: {
          leadId: id,
          source: baseline.source,
          score: baseline.points,
          band: baseline.band,
          reasons: baseline.reasons,
          nextAction: baseline.nextAction,
          recommendation,
        },
        update: {
          source: baseline.source,
          score: baseline.points,
          band: baseline.band,
          reasons: baseline.reasons,
          nextAction: baseline.nextAction,
          recommendation,
        },
      });
      await tx.auditEvent.create({
        data: {
          leadId: id,
          actorId: req.principal!.id,
          action: "BILL_CONFIRMED",
          metadata: { documentId, values: input.data },
        },
      });
      return { doc, lead };
    });
    if (!result) return res.sendStatus(404);
    res.json({
      document: billDocumentResponse(result.doc),
      lead: await findLead(result.lead.id),
    });
  },
);
app.post(
  "/api/leads/:id/bill/:documentId/reopen",
  session,
  csrf,
  role("SALES"),
  async (req, res) => {
    const id = req.params.id,
      documentId = req.params.documentId;
    if (Array.isArray(id) || Array.isArray(documentId))
      return res.sendStatus(400);
    const reason = z
      .object({ reason: z.string().trim().min(3).max(500) })
      .safeParse(req.body);
    if (!reason.success)
      return res.status(400).json({ error: "Provide a correction reason." });
    const doc = await db.$transaction(async (tx) => {
      const found = await tx.billDocument.findFirst({
        where: { id: documentId, leadId: id },
      });
      if (!found) return null;
      const updated = await tx.billDocument.update({
        where: { id: documentId },
        data: { status: "MANUAL_REQUIRED" },
      });
      await tx.auditEvent.create({
        data: {
          leadId: id,
          actorId: req.principal!.id,
          action: "BILL_REOPENED",
          metadata: {
            documentId,
            reason: reason.data.reason,
            previousConfirmed: normaliseBillConfirmation(found.confirmed),
          },
        },
      });
      return updated;
    });
    if (!doc) return res.sendStatus(404);
    res.json({ document: billDocumentResponse(doc) });
  },
);
app.post(
  "/api/leads/:id/quote",
  session,
  csrf,
  role("SALES"),
  async (req, res) => {
    const id = req.params.id;
    if (Array.isArray(id))
      return res.status(400).json({ error: "Invalid lead id" });
    const input = z
      .object({ kw: z.coerce.number().min(0.5).max(50) })
      .safeParse(req.body);
    if (!input.success)
      return res.status(400).json({ error: "Invalid capacity" });
    try {
      res.json(await persistQuote(id, input.data.kw));
    } catch (error: any) {
      if (error?.code === "P2025") return res.sendStatus(404);
      if (error instanceof RuleConfigurationError)
        return res.status(422).json({ error: error.message });
      console.error("quote.issue.failed", {
        leadId: id,
        message: error?.message,
      });
      res.status(500).json({ error: "Quote could not be saved." });
    }
  },
);
app.get("/api/quotes/:id/pdf", async (req, res) => {
  const quote = await db.quote.findUnique({
    where: { id: req.params.id },
    include: { lead: true },
  });
  if (!quote) return res.sendStatus(404);
  let saved;
  try {
    saved = quoteView(quote);
  } catch (error: any) {
    console.error("quote.pdf.invalid_snapshot", {
      quoteId: quote.id,
      message: error?.message,
    });
    return res.status(500).json({ error: "Saved quote data is unavailable." });
  }
  const calc = saved.calculation;
  const snapshot = quote.snapshot as any;
  const issueDate = new Date(
    snapshot.issuedAt ?? quote.createdAt,
  ).toLocaleDateString("en-IN");
  const ruleEffectiveDate =
    snapshot.ruleEffectiveDates?.PRICE ?? calc.assumptions.effectiveFrom;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=solar-quote.pdf");
  const pdf = new PDFDocument();
  pdf.pipe(res);
  pdf.fontSize(20).text("Surya Path — Solar quote");
  pdf
    .moveDown()
    .fontSize(12)
    .text(
      `For ${quote.lead.name}\nIssued: ${issueDate}\nSaved snapshot: ${quote.id}\nRule effective date: ${ruleEffectiveDate}\n\n${calc.capacityKw} kW system\nGross installed cost: INR ${calc.grossCost}\nEstimated subsidy: INR ${calc.subsidy}\nNet cost: INR ${calc.netCost}\nAnnual generation: ${calc.yearlyGeneration} units\nEstimated annual savings: INR ${calc.yearlySavings}\nSimple payback: ${calc.paybackYears ?? "N/A"} years\n\nAssumptions: price INR ${calc.assumptions.pricePerKw}/kW; generation ${calc.assumptions.generationPerKw} units/kW/year; self-use ${Math.round(calc.assumptions.selfUse * 100)}%; avoided tariff INR ${calc.assumptions.rate}/unit.\n\nDisclaimer: subsidy and savings are estimates based on dated demo rules, subject to eligibility, site survey, tariff, generation and policy confirmation.`,
    );
  pdf.end();
});
app.post(
  "/api/leads/:id/stage",
  session,
  csrf,
  role("SALES"),
  async (req, res) => {
    const input = z
      .object({ stage: z.enum(stages as [string, ...string[]]) })
      .safeParse(req.body);
    if (!input.success) return res.status(400).json({ error: "Invalid stage" });
    try {
      res.json(
        await persistStage(
          req.params.id as string,
          input.data.stage,
          req.principal!.id,
        ),
      );
    } catch (e: any) {
      res.status(409).json({ error: e.message });
    }
  },
);
app.post(
  "/api/leads/:id/status-links",
  session,
  csrf,
  role("SALES"),
  async (req, res) => {
    const leadId = req.params.id;
    if (Array.isArray(leadId))
      return res.status(400).json({ error: "Invalid lead id" });
    const input = z
      .object({
        expiresInDays: z.coerce.number().int().min(1).max(90).default(30),
      })
      .safeParse(req.body ?? {});
    if (!input.success)
      return res
        .status(400)
        .json({ error: "Expiry must be between 1 and 90 days." });
    const secret = createStatusToken();
    const expiresAt = new Date(
      Date.now() + input.data.expiresInDays * 24 * 60 * 60 * 1000,
    );
    const link = await db.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id: leadId } });
      if (!lead) return null;
      const project = await tx.project.upsert({
        where: { leadId },
        create: { leadId, stage: "NOT_STARTED" },
        update: {},
      });
      const statusLink = await tx.statusToken.create({
        data: {
          projectId: project.id,
          tokenHash: hashStatusToken(secret),
          expiresAt,
        },
      });
      await tx.auditEvent.create({
        data: {
          leadId,
          actorId: req.principal!.id,
          action: "CUSTOMER_STATUS_LINK_CREATED",
          metadata: { statusTokenId: statusLink.id, expiresAt },
        },
      });
      return statusLink;
    });
    if (!link) return res.sendStatus(404);
    const origin = process.env.WEB_ORIGIN || "http://localhost:5173";
    res.status(201).json({
      id: link.id,
      expiresAt: link.expiresAt,
      url: `${origin}/customer-status/${secret}`,
    });
  },
);
app.get(
  "/api/leads/:id/status-links",
  session,
  role("SALES"),
  async (req, res) => {
    const leadId = req.params.id;
    if (Array.isArray(leadId))
      return res.status(400).json({ error: "Invalid lead id" });
    const project = await db.project.findUnique({
      where: { leadId },
      include: { statusTokens: { orderBy: { createdAt: "desc" } } },
    });
    if (!project) return res.json({ links: [] });
    res.json({
      links: project.statusTokens.map((link) => ({
        id: link.id,
        expiresAt: link.expiresAt,
        revokedAt: link.revokedAt,
        createdAt: link.createdAt,
      })),
    });
  },
);
app.delete(
  "/api/leads/:id/status-links/:linkId",
  session,
  csrf,
  role("SALES"),
  async (req, res) => {
    const leadId = req.params.id,
      linkId = req.params.linkId;
    if (Array.isArray(leadId) || Array.isArray(linkId))
      return res.status(400).json({ error: "Invalid status link" });
    const changed = await db.$transaction(async (tx) => {
      const link = await tx.statusToken.findFirst({
        where: { id: linkId, project: { leadId } },
      });
      if (!link) return false;
      await tx.statusToken.update({
        where: { id: linkId },
        data: { revokedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          leadId,
          actorId: req.principal!.id,
          action: "CUSTOMER_STATUS_LINK_REVOKED",
          metadata: { statusTokenId: linkId },
        },
      });
      return true;
    });
    if (!changed) return res.sendStatus(404);
    res.sendStatus(204);
  },
);
app.get("/api/status/:id", async (req, res) => {
  const lead = await findLead(req.params.id);
  if (!lead) return res.sendStatus(404);
  res.json({
    name: lead.name,
    stage: lead.project?.stage ?? "Quote accepted",
    events: (lead.project?.events ?? []).map((e: any) => ({
      stage: e.stage,
      createdAt: e.createdAt,
    })),
    quote: lead.quote
      ? { id: lead.quote.id, calculation: lead.quote.calculation }
      : null,
  });
});
app.listen(3001, () => console.log("API on :3001"));
