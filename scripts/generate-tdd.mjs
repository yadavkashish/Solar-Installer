import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const buildDir = join(root, ".tdd-docx-build");
const docxPath = join(root, "Technical Design Document.docx");
const docxZipPath = join(root, ".tdd-output.zip");
const submissionDir = join(root, ".submission-build");
const submissionPath = join(root, "submission.zip");

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
let insertedScreenshots = false;

for (const line of source.split("\n")) {
  if (!line.trim()) continue;
  if (line.startsWith("# ")) {
    blocks.push(paragraph(plainText(line.slice(2)), { bold: true, size: 34, after: 220 }));
    continue;
  }
  if (line.startsWith("## ")) {
    if (!insertedScreenshots && line.includes("Verification record")) {
      blocks.push(paragraph("Working application captures", { bold: true, size: 26, before: 160 }));
      blocks.push(image(1, "Desktop dashboard", 5486400, 3086100));
      blocks.push(paragraph("Desktop working-app capture.", { size: 18, after: 160 }));
      blocks.push(image(2, "Mobile view", 2743200, 4876800));
      blocks.push(paragraph("Mobile working-app capture.", { size: 18, after: 180 }));
      insertedScreenshots = true;
    }
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

writeFileSync(join(buildDir, "[Content_Types].xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
writeFileSync(join(buildDir, "_rels", ".rels"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
writeFileSync(join(buildDir, "word", "document.xml"), documentXml);
writeFileSync(join(buildDir, "word", "_rels", "document.xml.rels"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/dashboard.png"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/mobile.png"/></Relationships>`);
cpSync(join(root, "docs", "dashboard.png"), join(buildDir, "word", "media", "dashboard.png"));
cpSync(join(root, "docs", "mobile.png"), join(buildDir, "word", "media", "mobile.png"));

rmSync(docxPath, { force: true });
rmSync(docxZipPath, { force: true });
execFileSync("powershell.exe", ["-NoProfile", "-Command", "Compress-Archive -Path .tdd-docx-build\\* -DestinationPath .tdd-output.zip -CompressionLevel Optimal"], { cwd: root, stdio: "inherit" });
renameSync(docxZipPath, docxPath);

rmSync(submissionDir, { recursive: true, force: true });
mkdirSync(submissionDir);
cpSync(docxPath, join(submissionDir, "Technical Design Document.docx"));
cpSync(join(root, "deployment.md"), join(submissionDir, "deployment.md"));
rmSync(submissionPath, { force: true });
execFileSync("powershell.exe", ["-NoProfile", "-Command", "Compress-Archive -Path .submission-build\\* -DestinationPath submission.zip -CompressionLevel Optimal"], { cwd: root, stdio: "inherit" });

if (!existsSync(docxPath) || !existsSync(submissionPath)) {
  throw new Error("Document package generation did not produce the expected artifacts.");
}

rmSync(buildDir, { recursive: true, force: true });
rmSync(submissionDir, { recursive: true, force: true });
