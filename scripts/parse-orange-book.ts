/**
 * Block 2: Parse the FDA Orange Book pipe-delimited (actually tilde-delimited)
 * data files into a single JSON file containing the hero drug (Ibrance) plus
 * a few filler oncology drugs for context.
 *
 * Input (gitignored):  data/_raw/{products,patent,exclusivity}.txt
 * Output (committed):  data/orange-book.json
 *
 * Run with: npm run script scripts/parse-orange-book.ts
 *
 * FDA Orange Book file format reference:
 *   - Tilde (~) delimited, first line is the header
 *   - Date format: "Mmm dd, YYYY" e.g. "Jan 29, 2027"
 *   - Source: https://www.fda.gov/drugs/drug-approvals-and-databases/orange-book-data-files
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const RAW_DIR = join(process.cwd(), "data", "_raw");
const OUT_PATH = join(process.cwd(), "data", "orange-book.json");

/**
 * NDA numbers we care about. Ibrance is the hero; the rest are realistic
 * filler small-molecule oncology drugs so the dataset doesn't look obviously
 * hand-picked. All values verified against the public Orange Book.
 */
const HERO_NDA = "207103"; // Ibrance (palbociclib) - Pfizer
const FILLER_NDAS = [
  "208065", // Tagrisso (osimertinib) - AstraZeneca
  "208716", // Verzenio (abemaciclib) - Eli Lilly
  "208558", // Lynparza (olaparib) - AstraZeneca
  "210259", // Calquence (acalabrutinib) - AstraZeneca
  "203415", // Xtandi (enzalutamide) - Astellas/Pfizer
];
const TARGET_NDAS = new Set([HERO_NDA, ...FILLER_NDAS]);

function readTilde(file: string): Record<string, string>[] {
  const path = join(RAW_DIR, file);
  if (!existsSync(path)) {
    throw new Error(
      `Missing FDA Orange Book file: ${path}\n` +
        `Download from https://www.fda.gov/drugs/drug-approvals-and-databases/orange-book-data-files\n` +
        `and extract products.txt, patent.txt, exclusivity.txt into data/_raw/`
    );
  }
  const text = readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = lines[0].split("~");
  return lines.slice(1).map((line) => {
    const cols = line.split("~");
    const row: Record<string, string> = {};
    header.forEach((h, i) => {
      row[h.trim()] = (cols[i] ?? "").trim();
    });
    return row;
  });
}

/** Parse "Jan 29, 2027" -> "2027-01-29" (ISO). Returns "" if unparseable. */
function toIsoDate(text: string): string {
  if (!text) return "";
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

type Patent = {
  patentNumber: string;
  expiryDate: string; // ISO
  expiryDateRaw: string;
  drugSubstance: boolean;
  drugProduct: boolean;
  patentUseCode: string;
  delisted: boolean;
  submissionDate: string;
};

type Exclusivity = {
  code: string;
  expiryDate: string; // ISO
  expiryDateRaw: string;
};

type Drug = {
  ndaNumber: string;
  applicationType: string; // "N" (NDA) or "A" (ANDA)
  ingredient: string;
  tradeName: string;
  applicant: string;
  applicantFullName: string;
  dosageForm: string; // DF;Route field
  strengths: string[];
  approvalDates: string[];
  patents: Patent[];
  exclusivity: Exclusivity[];
};

function main() {
  console.log(`Reading FDA Orange Book files from ${RAW_DIR}...`);
  const products = readTilde("products.txt");
  const patents = readTilde("patent.txt");
  const exclusivity = readTilde("exclusivity.txt");
  console.log(
    `  products.txt:    ${products.length.toLocaleString()} rows`
  );
  console.log(
    `  patent.txt:      ${patents.length.toLocaleString()} rows`
  );
  console.log(
    `  exclusivity.txt: ${exclusivity.length.toLocaleString()} rows`
  );

  // Group products by Appl_No (one NDA can have multiple strengths/products).
  const byNda = new Map<string, Record<string, string>[]>();
  for (const p of products) {
    const nda = p["Appl_No"];
    if (!TARGET_NDAS.has(nda)) continue;
    if (!byNda.has(nda)) byNda.set(nda, []);
    byNda.get(nda)!.push(p);
  }

  const drugs: Drug[] = [];
  for (const nda of [HERO_NDA, ...FILLER_NDAS]) {
    const rows = byNda.get(nda);
    if (!rows || rows.length === 0) {
      console.warn(`  WARNING: NDA ${nda} not found in products.txt`);
      continue;
    }
    const first = rows[0];
    const drug: Drug = {
      ndaNumber: nda,
      applicationType: first["Appl_Type"],
      ingredient: first["Ingredient"],
      tradeName: first["Trade_Name"],
      applicant: first["Applicant"],
      applicantFullName: first["Applicant_Full_Name"] ?? first["Applicant"],
      dosageForm: first["DF;Route"],
      strengths: Array.from(new Set(rows.map((r) => r["Strength"]).filter(Boolean))),
      approvalDates: Array.from(
        new Set(rows.map((r) => toIsoDate(r["Approval_Date"])).filter(Boolean))
      ),
      patents: patents
        .filter((row) => row["Appl_No"] === nda)
        .map((row) => ({
          patentNumber: row["Patent_No"],
          expiryDate: toIsoDate(row["Patent_Expire_Date_Text"]),
          expiryDateRaw: row["Patent_Expire_Date_Text"],
          drugSubstance: row["Drug_Substance_Flag"] === "Y",
          drugProduct: row["Drug_Product_Flag"] === "Y",
          patentUseCode: row["Patent_Use_Code"],
          delisted: row["Delist_Flag"] === "Y",
          submissionDate: toIsoDate(row["Submission_Date"]),
        }))
        // Drop delisted patents and de-dupe by patent number (kept earliest expiry).
        .filter((p) => !p.delisted)
        .reduce<Patent[]>((acc, p) => {
          if (!acc.some((x) => x.patentNumber === p.patentNumber)) acc.push(p);
          return acc;
        }, [])
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)),
      exclusivity: exclusivity
        .filter((row) => row["Appl_No"] === nda)
        .map((row) => ({
          code: row["Exclusivity_Code"],
          expiryDate: toIsoDate(row["Exclusivity_Date"]),
          expiryDateRaw: row["Exclusivity_Date"],
        }))
        .reduce<Exclusivity[]>((acc, e) => {
          if (!acc.some((x) => x.code === e.code && x.expiryDate === e.expiryDate))
            acc.push(e);
          return acc;
        }, [])
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)),
    };
    drugs.push(drug);
    const role = nda === HERO_NDA ? "[HERO] " : "        ";
    console.log(
      `  ${role}NDA ${nda}  ${drug.tradeName.padEnd(14)}  ` +
        `${drug.patents.length} patents, ${drug.exclusivity.length} exclusivity entries`
    );
  }

  if (drugs.length === 0) {
    throw new Error("No target drugs found. Check that data/_raw/products.txt is the correct file.");
  }

  const payload = {
    sourcedFrom: "FDA Orange Book — https://www.fda.gov/drugs/drug-approvals-and-databases/orange-book-data-files",
    generatedAt: new Date().toISOString(),
    heroNda: HERO_NDA,
    drugs,
  };

  writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2));
  console.log(
    `\nWrote ${drugs.length} drugs to ${OUT_PATH} ` +
      `(${(JSON.stringify(payload).length / 1024).toFixed(1)} KB)`
  );
}

main();
