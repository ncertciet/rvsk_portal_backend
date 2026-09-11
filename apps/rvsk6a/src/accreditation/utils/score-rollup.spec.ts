import {
  computeOverallScore,
  DomainAssessmentRow,
  FrameworkDomain,
  FrameworkSubdomain,
} from './score-rollup';

/**
 * Unit tests for computeOverallScore() — Two-Level Weighted Average
 *
 * Validates: Requirements 14.1, 14.2, 14.3
 */
describe('computeOverallScore()', () => {
  // --- Shared test fixtures ---
  const domains: FrameworkDomain[] = [
    { domain_pk: 'D1', domain_code: 'DOM_A', domain_weightage: 40 },
    { domain_pk: 'D2', domain_code: 'DOM_B', domain_weightage: 60 },
  ];

  const subdomains: FrameworkSubdomain[] = [
    { domain_pk: 'D1', sub_domain_code: 'SD_A1', subdomain_weightage: 30 },
    { domain_pk: 'D1', sub_domain_code: 'SD_A2', subdomain_weightage: 70 },
    { domain_pk: 'D2', sub_domain_code: 'SD_B1', subdomain_weightage: 50 },
    { domain_pk: 'D2', sub_domain_code: 'SD_B2', subdomain_weightage: 50 },
  ];

  describe('Requirement 14.3 — returns 0 when no ACTIVE rows exist', () => {
    it('should return 0 for an empty array', () => {
      const result = computeOverallScore([], domains, subdomains);
      expect(result).toBe(0);
    });

    it('should return 0 when all rows have non-ACTIVE status', () => {
      const rows: DomainAssessmentRow[] = [
        { domain_code: 'DOM_A', sub_domain_code: 'SD_A1', score: 80, status: 'INACTIVE' },
        { domain_code: 'DOM_B', sub_domain_code: 'SD_B1', score: 90, status: 'DELETED' },
      ];
      const result = computeOverallScore(rows, domains, subdomains);
      expect(result).toBe(0);
    });
  });

  describe('Requirement 14.1 — Level 1: weighted average of sub-domain scores within each domain', () => {
    it('should compute weighted average within a single domain', () => {
      // DOM_A: SD_A1 (weight 30, score 60) + SD_A2 (weight 70, score 80)
      // Weighted avg = (60*30 + 80*70) / (30+70) = (1800 + 5600) / 100 = 74
      const rows: DomainAssessmentRow[] = [
        { domain_code: 'DOM_A', sub_domain_code: 'SD_A1', score: 60, status: 'ACTIVE' },
        { domain_code: 'DOM_A', sub_domain_code: 'SD_A2', score: 80, status: 'ACTIVE' },
      ];

      const singleDomain: FrameworkDomain[] = [
        { domain_pk: 'D1', domain_code: 'DOM_A', domain_weightage: 100 },
      ];

      const result = computeOverallScore(rows, singleDomain, subdomains);
      expect(result).toBe(74);
    });

    it('should skip rows whose sub_domain_code is not in frameworkSubdomains', () => {
      const rows: DomainAssessmentRow[] = [
        { domain_code: 'DOM_A', sub_domain_code: 'SD_A1', score: 60, status: 'ACTIVE' },
        { domain_code: 'DOM_A', sub_domain_code: 'SD_UNKNOWN', score: 100, status: 'ACTIVE' },
      ];

      const singleDomain: FrameworkDomain[] = [
        { domain_pk: 'D1', domain_code: 'DOM_A', domain_weightage: 100 },
      ];

      // Only SD_A1 (weight 30, score 60) contributes → (60*30)/30 = 60
      const result = computeOverallScore(rows, singleDomain, subdomains);
      expect(result).toBe(60);
    });
  });

  describe('Requirement 14.2 — Level 2: weighted average of domain scores using domain_weightage', () => {
    it('should compute two-level weighted average across multiple domains', () => {
      // DOM_A: SD_A1(w30, s60) + SD_A2(w70, s80) → domain score = (1800+5600)/100 = 74
      // DOM_B: SD_B1(w50, s90) + SD_B2(w50, s70) → domain score = (4500+3500)/100 = 80
      // Overall: (74*40 + 80*60) / (40+60) = (2960+4800)/100 = 77.6
      const rows: DomainAssessmentRow[] = [
        { domain_code: 'DOM_A', sub_domain_code: 'SD_A1', score: 60, status: 'ACTIVE' },
        { domain_code: 'DOM_A', sub_domain_code: 'SD_A2', score: 80, status: 'ACTIVE' },
        { domain_code: 'DOM_B', sub_domain_code: 'SD_B1', score: 90, status: 'ACTIVE' },
        { domain_code: 'DOM_B', sub_domain_code: 'SD_B2', score: 70, status: 'ACTIVE' },
      ];

      const result = computeOverallScore(rows, domains, subdomains);
      expect(result).toBeCloseTo(77.6, 10);
    });

    it('should only include domains that exist in frameworkDomains', () => {
      const rows: DomainAssessmentRow[] = [
        { domain_code: 'DOM_A', sub_domain_code: 'SD_A1', score: 60, status: 'ACTIVE' },
        { domain_code: 'DOM_C', sub_domain_code: 'SD_C1', score: 100, status: 'ACTIVE' },
      ];

      // DOM_C is not in frameworkDomains so it's skipped
      // Only DOM_A: (60*30)/30 = 60, overall = 60*40/40 = 60
      const result = computeOverallScore(rows, domains, subdomains);
      expect(result).toBe(60);
    });

    it('should handle domains with equal weightage', () => {
      const equalDomains: FrameworkDomain[] = [
        { domain_pk: 'D1', domain_code: 'DOM_A', domain_weightage: 50 },
        { domain_pk: 'D2', domain_code: 'DOM_B', domain_weightage: 50 },
      ];

      const rows: DomainAssessmentRow[] = [
        { domain_code: 'DOM_A', sub_domain_code: 'SD_A1', score: 60, status: 'ACTIVE' },
        { domain_code: 'DOM_A', sub_domain_code: 'SD_A2', score: 80, status: 'ACTIVE' },
        { domain_code: 'DOM_B', sub_domain_code: 'SD_B1', score: 90, status: 'ACTIVE' },
        { domain_code: 'DOM_B', sub_domain_code: 'SD_B2', score: 70, status: 'ACTIVE' },
      ];

      // DOM_A: (60*30+80*70)/100 = 74
      // DOM_B: (90*50+70*50)/100 = 80
      // Overall: (74*50+80*50)/100 = 77
      const result = computeOverallScore(rows, equalDomains, subdomains);
      expect(result).toBe(77);
    });
  });

  describe('Order-independence (Requirement 14.4)', () => {
    it('should produce the same result regardless of input row order', () => {
      const rows: DomainAssessmentRow[] = [
        { domain_code: 'DOM_A', sub_domain_code: 'SD_A1', score: 60, status: 'ACTIVE' },
        { domain_code: 'DOM_A', sub_domain_code: 'SD_A2', score: 80, status: 'ACTIVE' },
        { domain_code: 'DOM_B', sub_domain_code: 'SD_B1', score: 90, status: 'ACTIVE' },
        { domain_code: 'DOM_B', sub_domain_code: 'SD_B2', score: 70, status: 'ACTIVE' },
      ];

      const result1 = computeOverallScore(rows, domains, subdomains);

      // Reversed order
      const reversed = [...rows].reverse();
      const result2 = computeOverallScore(reversed, domains, subdomains);

      // Shuffled order
      const shuffled = [rows[2], rows[0], rows[3], rows[1]];
      const result3 = computeOverallScore(shuffled, domains, subdomains);

      expect(result1).toBeCloseTo(result2, 10);
      expect(result1).toBeCloseTo(result3, 10);
    });

    it('should produce the same result with interleaved domain rows', () => {
      const ordered: DomainAssessmentRow[] = [
        { domain_code: 'DOM_A', sub_domain_code: 'SD_A1', score: 50, status: 'ACTIVE' },
        { domain_code: 'DOM_A', sub_domain_code: 'SD_A2', score: 70, status: 'ACTIVE' },
        { domain_code: 'DOM_B', sub_domain_code: 'SD_B1', score: 85, status: 'ACTIVE' },
        { domain_code: 'DOM_B', sub_domain_code: 'SD_B2', score: 65, status: 'ACTIVE' },
      ];

      const interleaved: DomainAssessmentRow[] = [
        { domain_code: 'DOM_B', sub_domain_code: 'SD_B2', score: 65, status: 'ACTIVE' },
        { domain_code: 'DOM_A', sub_domain_code: 'SD_A1', score: 50, status: 'ACTIVE' },
        { domain_code: 'DOM_B', sub_domain_code: 'SD_B1', score: 85, status: 'ACTIVE' },
        { domain_code: 'DOM_A', sub_domain_code: 'SD_A2', score: 70, status: 'ACTIVE' },
      ];

      const result1 = computeOverallScore(ordered, domains, subdomains);
      const result2 = computeOverallScore(interleaved, domains, subdomains);
      expect(result1).toBeCloseTo(result2, 10);
    });
  });

  describe('Edge cases', () => {
    it('should handle a single domain with a single subdomain', () => {
      const rows: DomainAssessmentRow[] = [
        { domain_code: 'DOM_A', sub_domain_code: 'SD_A1', score: 75, status: 'ACTIVE' },
      ];

      // (75*30)/30 = 75, overall = (75*40)/40 = 75
      const result = computeOverallScore(rows, domains, subdomains);
      expect(result).toBe(75);
    });

    it('should filter out non-ACTIVE rows and compute only from ACTIVE ones', () => {
      const rows: DomainAssessmentRow[] = [
        { domain_code: 'DOM_A', sub_domain_code: 'SD_A1', score: 60, status: 'ACTIVE' },
        { domain_code: 'DOM_A', sub_domain_code: 'SD_A2', score: 100, status: 'INACTIVE' },
        { domain_code: 'DOM_B', sub_domain_code: 'SD_B1', score: 90, status: 'ACTIVE' },
        { domain_code: 'DOM_B', sub_domain_code: 'SD_B2', score: 50, status: 'DELETED' },
      ];

      // DOM_A: only SD_A1 active → (60*30)/30 = 60
      // DOM_B: only SD_B1 active → (90*50)/50 = 90
      // Overall: (60*40 + 90*60) / (40+60) = (2400+5400)/100 = 78
      const result = computeOverallScore(rows, domains, subdomains);
      expect(result).toBe(78);
    });

    it('should return 0 when domain has ACTIVE rows but no matching subdomains in framework', () => {
      const rows: DomainAssessmentRow[] = [
        { domain_code: 'DOM_A', sub_domain_code: 'UNKNOWN_1', score: 80, status: 'ACTIVE' },
        { domain_code: 'DOM_A', sub_domain_code: 'UNKNOWN_2', score: 90, status: 'ACTIVE' },
      ];

      // DOM_A has active rows but no subdomain matches → weightedSum=0, totalWeight=0 → domainScore=0
      // Overall: (0*40)/40 = 0
      const result = computeOverallScore(rows, domains, subdomains);
      expect(result).toBe(0);
    });

    it('should handle scores of 0 correctly', () => {
      const rows: DomainAssessmentRow[] = [
        { domain_code: 'DOM_A', sub_domain_code: 'SD_A1', score: 0, status: 'ACTIVE' },
        { domain_code: 'DOM_A', sub_domain_code: 'SD_A2', score: 0, status: 'ACTIVE' },
      ];

      const result = computeOverallScore(rows, domains, subdomains);
      expect(result).toBe(0);
    });

    it('should handle maximum scores (100)', () => {
      const rows: DomainAssessmentRow[] = [
        { domain_code: 'DOM_A', sub_domain_code: 'SD_A1', score: 100, status: 'ACTIVE' },
        { domain_code: 'DOM_A', sub_domain_code: 'SD_A2', score: 100, status: 'ACTIVE' },
        { domain_code: 'DOM_B', sub_domain_code: 'SD_B1', score: 100, status: 'ACTIVE' },
        { domain_code: 'DOM_B', sub_domain_code: 'SD_B2', score: 100, status: 'ACTIVE' },
      ];

      const result = computeOverallScore(rows, domains, subdomains);
      expect(result).toBe(100);
    });
  });
});
