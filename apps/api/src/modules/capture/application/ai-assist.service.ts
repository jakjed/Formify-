import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export type AiAssistContext = {
  tenantId: string;
  recordType: 'invoice' | 'contract';
  recordId: string;
  fullText?: string;
};

@Injectable()
export class AiAssistService {
  constructor(private readonly prisma: PrismaService) {}

  async isEnabled(tenantId: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { aiAssistEnabled: true, llmProvider: true },
    });
    return Boolean(
      tenant?.aiAssistEnabled &&
        tenant.llmProvider &&
        tenant.llmProvider !== 'none',
    );
  }

  /**
   * Future: Bedrock/BYO LLM on extracted text only.
   * Today always returns null — callers use deterministic fallbacks.
   */
  async summarize(_ctx: AiAssistContext): Promise<string | null> {
    return null;
  }
}
