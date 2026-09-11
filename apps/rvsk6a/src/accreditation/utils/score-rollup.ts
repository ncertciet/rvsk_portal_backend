/**
 * Score Rollup Utility — Two-Level Weighted Average Computation
 *
 * Computes overall school scores from domain_assessment_flat rows using:
 * - Level 1: Weighted average of sub-domain scores within each domain (subdomain_weightage)
 * - Level 2: Weighted average of domain scores (domain_weightage)
 *
 * Validates: Requirements 14.1, 14.2, 14.3
 */

export interface DomainAssessmentRow {
  domain_code: string;
  sub_domain_code: string;
  score: number;
  status: string;
}

export interface FrameworkDomain {
  domain_pk: string;
  domain_code: string;
  domain_weightage: number;
}

export interface FrameworkSubdomain {
  domain_pk: string;
  sub_domain_code: string;
  subdomain_weightage: number;
}

/**
 * Computes the overall school score from domain assessment rows
 * for a given assessment (identified by temp_key).
 *
 * Level 1: Sub-domain scores → Domain score (weighted by subdomain_weightage)
 * Level 2: Domain scores → Overall score (weighted by domain_weightage)
 *
 * @param assessmentRows - All domain_assessment_flat rows for a single temp_key
 * @param frameworkDomains - Domain definitions with weightages for the assessment's framework
 * @param frameworkSubdomains - Sub-domain definitions with weightages for the assessment's framework
 * @returns A number in range [0, max_score] (typically 0–100), or 0 if no ACTIVE rows exist
 */
export function computeOverallScore(
  assessmentRows: DomainAssessmentRow[],
  frameworkDomains: FrameworkDomain[],
  frameworkSubdomains: FrameworkSubdomain[],
): number {
  // Filter to ACTIVE only — Requirement 14.3
  const activeRows = assessmentRows.filter((r) => r.status === 'ACTIVE');
  if (activeRows.length === 0) return 0;

  // Group by domain_code
  const domainGroups = new Map<string, DomainAssessmentRow[]>();
  for (const row of activeRows) {
    const group = domainGroups.get(row.domain_code) || [];
    group.push(row);
    domainGroups.set(row.domain_code, group);
  }

  // Level 1: For each domain, compute weighted sub-domain average — Requirement 14.1
  const domainScores: Array<{
    code: string;
    score: number;
    weightage: number;
  }> = [];

  for (const [domainCode, subdomainRows] of domainGroups) {
    const domain = frameworkDomains.find((d) => d.domain_code === domainCode);
    if (!domain) continue;

    let weightedSum = 0;
    let totalWeight = 0;

    for (const row of subdomainRows) {
      const subdomain = frameworkSubdomains.find(
        (s) =>
          s.domain_pk === domain.domain_pk &&
          s.sub_domain_code === row.sub_domain_code,
      );
      if (!subdomain) continue;

      weightedSum += row.score * subdomain.subdomain_weightage;
      totalWeight += subdomain.subdomain_weightage;
    }

    const domainScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    domainScores.push({
      code: domainCode,
      score: domainScore,
      weightage: domain.domain_weightage,
    });
  }

  // Level 2: Compute overall from domain scores — Requirement 14.2
  const overallWeightedSum = domainScores.reduce(
    (sum, d) => sum + d.score * d.weightage,
    0,
  );
  const overallTotalWeight = domainScores.reduce(
    (sum, d) => sum + d.weightage,
    0,
  );

  return overallTotalWeight > 0 ? overallWeightedSum / overallTotalWeight : 0;
}
