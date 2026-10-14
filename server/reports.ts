import PDFDocument from "pdfkit";

/**
 * Report export helpers.
 *
 * Both exporters take an already school-scoped snapshot (compliance items +
 * score and an incident summary) and render it to CSV (dependency-free string
 * building) or PDF (pdfkit, buffered). The route layer is responsible for
 * loading the data for req.user.schoolId and setting response headers.
 */

export interface ComplianceRow {
  title: string;
  status: string;
  weight: number;
}

export interface IncidentRow {
  type: string;
  severity: string;
  status: string;
}

export interface ReportData {
  schoolName: string;
  complianceScore: number;
  compliance: ComplianceRow[];
  incidents: IncidentRow[];
}

/** Escape a single CSV field per RFC 4180 (quote if it contains , " or newline). */
function csvField(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(fields: unknown[]): string {
  return fields.map(csvField).join(",");
}

/**
 * Build a CSV report. The document has a compliance section (one row per item)
 * followed by an incident summary section, with a leading summary line. A
 * stable header row is emitted for the compliance section so the columns are
 * deterministic for tests and downstream tooling.
 */
export function buildComplianceCsv(data: ReportData): string {
  const lines: string[] = [];

  lines.push(csvRow(["Report", "HarmonyShield Compliance Report"]));
  lines.push(csvRow(["School", data.schoolName]));
  lines.push(csvRow(["Compliance Score", `${data.complianceScore}%`]));
  lines.push(csvRow(["Total Incidents", data.incidents.length]));
  lines.push("");

  lines.push(csvRow(["Section", "Compliance Items"]));
  lines.push(csvRow(["Title", "Status", "Weight"]));
  for (const item of data.compliance) {
    lines.push(csvRow([item.title, item.status, item.weight]));
  }
  lines.push("");

  lines.push(csvRow(["Section", "Incident Summary"]));
  lines.push(csvRow(["Type", "Severity", "Status"]));
  for (const incident of data.incidents) {
    lines.push(csvRow([incident.type, incident.severity, incident.status]));
  }

  return lines.join("\n");
}

/**
 * Build a PDF report buffer. Resolves once pdfkit has flushed the full
 * document, so the route can send a single buffered response with a correct
 * Content-Length.
 */
export function buildCompliancePdf(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(20).text("HarmonyShield Compliance Report", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12).text(`School: ${data.schoolName}`);
      doc.text(`Compliance Score: ${data.complianceScore}%`);
      doc.text(`Generated: ${new Date().toISOString()}`);
      doc.moveDown();

      doc.fontSize(16).text("Compliance Items");
      doc.moveDown(0.3);
      doc.fontSize(11);
      for (const item of data.compliance) {
        doc.text(`- ${item.title}: ${item.status} (weight ${item.weight})`);
      }
      doc.moveDown();

      doc.fontSize(16).text("Incident Summary");
      doc.moveDown(0.3);
      doc.fontSize(11);
      if (data.incidents.length === 0) {
        doc.text("No incidents recorded.");
      } else {
        for (const incident of data.incidents) {
          doc.text(`- ${incident.type} | ${incident.severity} | ${incident.status}`);
        }
      }

      doc.end();
    } catch (err) {
      reject(err as Error);
    }
  });
}
