import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../../database/prisma.service';
import {
  CurrentTenantId,
  CurrentUser,
} from '../../../common/current-user.decorator';
import type { RequestUser } from '../../identity/domain/identity.types';

@ApiTags('search')
@ApiBearerAuth('bearer')
@Controller('search')
export class SearchController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Global search: invoices, vendors, users (admin)' })
  async search(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const query = (q ?? '').trim();
    const limit = Math.min(Math.max(Number(limitRaw ?? 8) || 8, 1), 20);
    if (query.length < 1) {
      return { invoices: [], vendors: [], users: [] };
    }

    const [invoices, vendors, users] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          tenantId,
          OR: [
            { invoiceNumber: { contains: query, mode: 'insensitive' } },
            { vendorNameRaw: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          invoiceNumber: true,
          vendorNameRaw: true,
          status: true,
          totalMinor: true,
          currency: true,
        },
      }),
      this.prisma.vendor.findMany({
        where: {
          tenantId,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { code: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: { name: 'asc' },
        select: { id: true, code: true, name: true, active: true },
      }),
      user.role === 'admin'
        ? this.prisma.user.findMany({
            where: {
              tenantId,
              OR: [
                { email: { contains: query, mode: 'insensitive' } },
                { displayName: { contains: query, mode: 'insensitive' } },
              ],
            },
            take: limit,
            orderBy: { displayName: 'asc' },
            select: {
              id: true,
              email: true,
              displayName: true,
              role: true,
              status: true,
            },
          })
        : Promise.resolve([]),
    ]);

    return { invoices, vendors, users };
  }
}
