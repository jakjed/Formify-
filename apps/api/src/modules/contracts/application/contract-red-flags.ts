import type { RedFlag } from './procure-constants';

export function ruleBasedContractRedFlags(fullText: string): RedFlag[] {
  const text = fullText.toLowerCase();
  const flags: RedFlag[] = [];

  if (
    text.includes('unlimited liability') ||
    text.includes('uncapped liability')
  ) {
    flags.push({
      severity: 'High',
      text: 'Unlimited liability language detected — review carve-outs and insurance limits.',
    });
  }
  if (text.includes('auto-renew') || text.includes('automatic renewal')) {
    flags.push({
      severity: 'Medium',
      text: 'Auto-renewal clause detected — confirm opt-out window before renewal date.',
    });
  }
  if (!text.includes('governing law') && !text.includes('jurisdiction')) {
    flags.push({
      severity: 'Low',
      text: 'Governing law / jurisdiction clause not found in extracted text.',
    });
  }
  if (text.includes('30 day') && text.includes('notice')) {
    flags.push({
      severity: 'Low',
      text: 'Notice period may be shorter than internal procurement policy for this spend tier.',
    });
  }
  if (flags.length === 0) {
    flags.push({
      severity: 'Low',
      text: 'No high-risk phrases matched rule library — manual legal review still recommended.',
    });
  }
  return flags;
}
