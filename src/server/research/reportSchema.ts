import { z } from "zod";

const nullableString = z.string().min(1).nullable();
const nullableNumber = z.number().nullable();
const confidence = z.enum(["high", "medium", "low", "unknown"]).default("unknown");

const evidenceSourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().min(1),
  publisher: nullableString,
  accessed_at: nullableString,
  claim_supported: z.string().min(1),
  patent_publication_number: nullableString,
  page_reference: nullableString,
  source_type: z
    .enum(["patent_office", "regulator", "drug_label", "clinical_registry", "company_filing", "tender", "secondary"])
    .default("secondary"),
});

const metricWithEvidenceSchema = z.object({
  value: z.union([nullableString, nullableNumber]),
  confidence_note: nullableString,
  confidence,
  evidence: z.array(evidenceSourceSchema).default([]),
});

const countryMetricSchema = z.object({
  country: z.string().min(1),
  value: z.union([nullableString, nullableNumber]),
  currency: nullableString,
  confidence_note: nullableString,
  confidence,
  evidence: z.array(evidenceSourceSchema).default([]),
});

const patentTypeByJurisdictionSchema = z.object({
  jurisdiction: z.string().min(1),
  publication_number: nullableString,
  expiry_date: nullableString,
  status: nullableString,
  confidence_note: nullableString,
  evidence: z.array(evidenceSourceSchema).default([]),
});

const riskItemSchema = z.object({
  score: z.number().min(0).max(1).nullable(),
  explanation: nullableString,
  confidence_note: nullableString,
  evidence: z.array(evidenceSourceSchema).default([]),
});

export const deepDiveReportSchema = z.object({
  asset_summary: z.object({
    inn: metricWithEvidenceSchema,
    originator_brand: metricWithEvidenceSchema,
    molecule_class: metricWithEvidenceSchema,
    mechanism: metricWithEvidenceSchema,
    indications: z.array(metricWithEvidenceSchema).default([]),
    dosage_forms: z.array(metricWithEvidenceSchema).default([]),
    strengths: z.array(metricWithEvidenceSchema).default([]),
  }),
  patent_and_exclusivity_landscape: z.object({
    composition_of_matter: z.array(patentTypeByJurisdictionSchema).default([]),
    formulation: z.array(patentTypeByJurisdictionSchema).default([]),
    method_of_use: z.array(patentTypeByJurisdictionSchema).default([]),
    polymorph: z.array(patentTypeByJurisdictionSchema).default([]),
    salt: z.array(patentTypeByJurisdictionSchema).default([]),
    spc_pte: z.array(patentTypeByJurisdictionSchema).default([]),
    pediatric_extensions: z.array(patentTypeByJurisdictionSchema).default([]),
    data_exclusivity: z.array(patentTypeByJurisdictionSchema).default([]),
    orphan_exclusivity: z.array(patentTypeByJurisdictionSchema).default([]),
    expiry_timeline_by_country: z.array(patentTypeByJurisdictionSchema).default([]),
  }),
  originator_and_filer_intelligence: z.object({
    molecule_owner: metricWithEvidenceSchema,
    current_generic_filers_by_country: z.array(
      z.object({
        country: z.string().min(1),
        filers: z.array(z.string()).default([]),
        confidence_note: nullableString,
        evidence: z.array(evidenceSourceSchema).default([]),
      }),
    ).default([]),
    paragraph_iv_history: metricWithEvidenceSchema,
    settlement_history: metricWithEvidenceSchema,
  }),
  market_sizing: z.object({
    revenue_by_country: z.array(countryMetricSchema).default([]),
    unit_volume_by_country: z.array(countryMetricSchema).default([]),
    growth: metricWithEvidenceSchema,
    payer_mix: metricWithEvidenceSchema,
    tender_vs_retail: metricWithEvidenceSchema,
    reference_pricing: metricWithEvidenceSchema,
    post_loe_erosion_curve: metricWithEvidenceSchema,
  }),
  competitive_density: z.object({
    existing_generic_approvals: metricWithEvidenceSchema,
    pipeline_filings: metricWithEvidenceSchema,
    pending_andas: metricWithEvidenceSchema,
    biosimilar_developers: metricWithEvidenceSchema,
  }),
  cdmo_matchmaking: z.object({
    ranked_cdmos: z.array(
      z.object({
        name: z.string().min(1),
        modality_fit: nullableString,
        capacity: nullableString,
        gmp_inspection_history: nullableString,
        prior_approvals_for_molecule_class: nullableString,
        geographic_fit: nullableString,
        indicative_pricing_band: nullableString,
        direct_intro_request_placeholder: z.boolean().default(false),
        confidence_note: nullableString,
        evidence: z.array(evidenceSourceSchema).default([]),
      }),
    ).default([]),
  }),
  api_and_ksm_sourcing: z.object({
    qualified_api_suppliers: metricWithEvidenceSchema,
    dmf_holders: metricWithEvidenceSchema,
    geographic_concentration_risk: metricWithEvidenceSchema,
    price_trend: metricWithEvidenceSchema,
  }),
  regulatory_pathway: z.object({
    filing_routes_by_country: z.array(
      z.object({
        country: z.string().min(1),
        route: nullableString,
        bioequivalence_requirements: nullableString,
        expected_review_timeline: nullableString,
        required_studies: nullableString,
        estimated_cost: nullableString,
        confidence_note: nullableString,
        evidence: z.array(evidenceSourceSchema).default([]),
      }),
    ).default([]),
  }),
  risk_score: z.object({
    composite: riskItemSchema,
    ip_litigation_risk: riskItemSchema,
    regulatory_risk: riskItemSchema,
    supply_concentration_risk: riskItemSchema,
    price_erosion_velocity: riskItemSchema,
    fx_risk: riskItemSchema,
    country_risk: riskItemSchema,
  }),
  financial_model: z.object({
    pnl_5y_by_country: z.array(
      z.object({
        country: z.string().min(1),
        year_1: nullableNumber,
        year_2: nullableNumber,
        year_3: nullableNumber,
        year_4: nullableNumber,
        year_5: nullableNumber,
        currency: nullableString,
        confidence_note: nullableString,
        evidence: z.array(evidenceSourceSchema).default([]),
      }),
    ).default([]),
    sensitivities: metricWithEvidenceSchema,
    npv: metricWithEvidenceSchema,
    irr: metricWithEvidenceSchema,
    payback: metricWithEvidenceSchema,
    capex_and_tooling_estimate: metricWithEvidenceSchema,
  }),
  strategic_recommendation: z.object({
    go_no_go: z.enum(["go", "no_go", "uncertain"]),
    launch_sequence_by_country: z.array(z.string()).default([]),
    partnership_vs_in_house: nullableString,
    first_to_file_urgency: nullableString,
    confidence_note: nullableString,
    evidence: z.array(evidenceSourceSchema).default([]),
  }),
  evidence_pack: z.object({
    claims: z.array(
      z.object({
        claim: z.string().min(1),
        confidence_note: nullableString,
        evidence: z.array(evidenceSourceSchema).min(1),
      }),
    ).default([]),
  }),
});

export type DeepDiveReport = z.infer<typeof deepDiveReportSchema>;
