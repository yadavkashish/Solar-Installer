import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, isAbsolute, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const buildDir = join(root, ".tdd-docx-build");
const docxPath = join(root, "Technical Design Document.docx");
const docxZipPath = join(root, ".tdd-output.zip");
const generatedDocxPath = join(root, ".tdd-output.docx");
const submissionDir = join(root, ".submission-build");
const submissionPath = join(root, "submission.zip");
const generatedSubmissionPath = join(root, ".submission-output.zip");

const escapeXml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const plainText = (value) =>
  value
    .replaceAll(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replaceAll(/\*\*/g, "")
    .replaceAll(/`/g, "");

const paragraph = (text, { bold = false, size = 22, before = 0, after = 120 } = {}) =>
  `<w:p><w:pPr><w:spacing w:before="${before}" w:after="${after}"/></w:pPr><w:r><w:rPr>${bold ? "<w:b/>" : ""}<w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;

const image = (id, name, width, height) =>
  `<w:p><w:pPr><w:spacing w:before="120" w:after="80"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${width}" cy="${height}"/><wp:docPr id="${id}" name="${name}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;

const source = readFileSync(join(root, "docs", "TDD.md"), "utf8").replace(/\r/g, "");
const blocks = [];
const imageRelationships = [];
const screenshotFiles = [
  ["lead-form.png", "Lead form"],
  ["bill-review.png", "Bill review"],
  ["quote.png", "Quote"],
  ["tracker.png", "Project tracker"],
  ["status.png", "Customer status"],
  ["admin-rules.png", "Dated admin rules"],
  ["mobile.png", "Mobile layout"],
];
const screenshotsDir = resolve(root, "docs", "screenshots");
const missingScreenshots = [];

function embedScreenshot(imagePath, caption) {
  const resolvedImagePath = resolve(imagePath);
  const relativePath = relative(screenshotsDir, resolvedImagePath);
  if (relativePath.startsWith("..") || isAbsolute(relativePath))
    throw new Error(`Screenshot path is outside docs/screenshots: ${imagePath}`);

  const bytes = readFileSync(resolvedImagePath);
  if (
    bytes.length < 24 ||
    bytes.toString("ascii", 1, 4) !== "PNG" ||
    bytes.toString("ascii", 12, 16) !== "IHDR"
  )
    throw new Error(`Screenshot is not a valid PNG: ${imagePath}`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const maxWidth = 5_303_520;
  const maxHeight = 5_943_600;
  const scale = Math.min(maxWidth / width, maxHeight / height);
  const id = imageRelationships.length + 1;
  const name = basename(resolvedImagePath);
  imageRelationships.push({ id, name, path: resolvedImagePath });
  blocks.push(paragraph(caption, { size: 18, before: 100, after: 40 }));
  blocks.push(
    image(
      id,
      name,
      Math.round(width * scale),
      Math.round(height * scale),
    ),
  );
}

function addScreenshotSection() {
  blocks.push(paragraph("Screenshots", { bold: true, size: 26, before: 180, after: 110 }));
  for (const [fileName, caption] of screenshotFiles) {
    const imagePath = join(screenshotsDir, fileName);
    if (!existsSync(imagePath)) {
      missingScreenshots.push(`docs/screenshots/${fileName}`);
      continue;
    }
    embedScreenshot(imagePath, caption);
  }
  if (missingScreenshots.length) {
    const note = `Screenshots not present; no images were fabricated: ${missingScreenshots.join(", ")}`;
    blocks.push(paragraph(note, { size: 20 }));
    console.warn(note);
  } else {
    console.log("All seven docs/screenshots PNGs were embedded.");
  }
}

for (const line of source.split("\n")) {
  if (!line.trim()) continue;
  if (line.trim() === "## Screenshots") {
    addScreenshotSection();
    continue;
  }
  const imageMatch = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(line);
  if (imageMatch) {
    embedScreenshot(resolve(root, "docs", imageMatch[2]), imageMatch[1]);
    continue;
  }
  if (line.startsWith("# ")) {
    blocks.push(paragraph(plainText(line.slice(2)), { bold: true, size: 34, after: 220 }));
    continue;
  }
  if (line.startsWith("## ")) {
    blocks.push(paragraph(plainText(line.slice(3)), { bold: true, size: 26, before: 180, after: 110 }));
    continue;
  }
  if (line.startsWith("- ")) {
    blocks.push(paragraph(`• ${plainText(line.slice(2))}`, { size: 20, after: 55 }));
    continue;
  }
  if (line.startsWith("|")) {
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (!cells.every((cell) => /^-+$/.test(cell))) {
      blocks.push(paragraph(cells.join("  |  "), { size: 18, after: 45 }));
    }
    continue;
  }
  blocks.push(paragraph(plainText(line), { size: 20 }));
}

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${blocks.join("")}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900"/></w:sectPr></w:body></w:document>`;

rmSync(buildDir, { recursive: true, force: true });
mkdirSync(join(buildDir, "_rels"), { recursive: true });
mkdirSync(join(buildDir, "word", "_rels"), { recursive: true });
mkdirSync(join(buildDir, "word", "media"), { recursive: true });
for (const asset of imageRelationships) {
  cpSync(asset.path, join(buildDir, "word", "media", asset.name));
}

writeFileSync(join(buildDir, "[Content_Types].xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
writeFileSync(join(buildDir, "_rels", ".rels"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
writeFileSync(join(buildDir, "word", "document.xml"), documentXml);
writeFileSync(join(buildDir, "word", "_rels", "document.xml.rels"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${imageRelationships.map(({ id, name }) => `<Relationship Id="rId${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${name}"/>`).join("")}</Relationships>`);

rmSync(docxZipPath, { force: true });
const createDocxArchive = [
  "$ErrorActionPreference = 'Stop'",
  "Add-Type -AssemblyName System.IO.Compression",
  "Add-Type -AssemblyName System.IO.Compression.FileSystem",
  "$source = (Resolve-Path '.tdd-docx-build').Path",
  "$archive = [System.IO.Compression.ZipFile]::Open('.tdd-output.zip', [System.IO.Compression.ZipArchiveMode]::Create)",
  "try { Get-ChildItem -LiteralPath $source -Recurse -File | ForEach-Object { $entry = $_.FullName.Substring($source.Length + 1).Replace([char]92, [char]47); [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $entry, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null } } finally { $archive.Dispose() }",
].join("; ");
execFileSync("powershell.exe", ["-NoProfile", "-Command", createDocxArchive], { cwd: root, stdio: "inherit" });
rmSync(generatedDocxPath, { force: true });
renameSync(docxZipPath, generatedDocxPath);

rmSync(submissionDir, { recursive: true, force: true });
mkdirSync(submissionDir);
cpSync(generatedDocxPath, join(submissionDir, "Technical Design Document.docx"));
cpSync(join(root, "deployment.md"), join(submissionDir, "deployment.md"));
rmSync(generatedSubmissionPath, { force: true });
execFileSync("powershell.exe", ["-NoProfile", "-Command", "Compress-Archive -Path .submission-build\\* -DestinationPath .submission-output.zip -CompressionLevel Optimal"], { cwd: root, stdio: "inherit" });

if (!existsSync(generatedDocxPath) || !existsSync(generatedSubmissionPath)) {
  throw new Error("Document package generation did not produce the expected artifacts.");
}

rmSync(docxPath, { force: true });
renameSync(generatedDocxPath, docxPath);
rmSync(submissionPath, { force: true });
renameSync(generatedSubmissionPath, submissionPath);
rmSync(buildDir, { recursive: true, force: true });
rmSync(submissionDir, { recursive: true, force: true });
