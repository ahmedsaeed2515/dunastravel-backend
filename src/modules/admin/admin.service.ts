/* eslint-disable */
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TailorMadeInquiryStatus, ContactSubmissionStatus } from '@prisma/client';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { ListInquiriesQueryDto } from './dto/list-inquiries-query.dto';
import { ListContactSubmissionsQueryDto } from './dto/list-contact-submissions-query.dto';
import { ListNotificationLogsQueryDto } from './dto/list-notification-logs-query.dto';
import { UpdateInquiryStatusDto } from './dto/update-inquiry-status.dto';
import { UpdateContactSubmissionStatusDto } from './dto/update-contact-submission-status.dto';
import { AdminPaginatedResponse } from './types/admin-paginated-response.type';
import { IAdminBookingSummary } from './interfaces/admin-booking-summary.interface';
import { IAdminBookingDetail } from './interfaces/admin-booking-detail.interface';
import { IAdminInquirySummary } from './interfaces/admin-inquiry-summary.interface';
import { IAdminInquiryDetail } from './interfaces/admin-inquiry-detail.interface';
import { IAdminContactSummary } from './interfaces/admin-contact-summary.interface';
import { IAdminContactDetail } from './interfaces/admin-contact-detail.interface';
import { IAdminNotificationLog } from './interfaces/admin-notification-log.interface';
import { IAdminDashboardMetrics } from './interfaces/admin-dashboard-metrics.interface';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listBookings(query: ListBookingsQueryDto, adminUserId: number): Promise<AdminPaginatedResponse<IAdminBookingSummary>> {
    const { page = 1, limit = 20, status, tourId, dateFrom, dateTo, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    
    this.logger.log(`listBookings invoked by admin ${adminUserId} with filters: ${JSON.stringify(query)}`);

    const where: any = {};
    if (status) where.status = status;
    if (tourId) where.tourId = tourId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;
    const [total, records] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          invoice: { select: { invoiceNumber: true } },
          _count: { select: { passengers: true } },
          tour: { select: { id: true, slug: true, titleJsonb: true } },
        },
      }),
    ]);

    const data = records.map((b) => {
      const titleObj: any = b.tour.titleJsonb || {};
      const tourNameEn = titleObj['en'] || 'Unknown';
      
      return {
        id: b.id,
        referenceCode: b.referenceCode,
        status: b.status,
        totalAmount: b.totalAmountUsd.toString(),
        currency: 'USD',
        passengerCount: b._count.passengers,
        tourId: b.tour.id,
        tourSlug: b.tour.slug,
        tourNameEn,
        invoiceNumber: b.invoice?.invoiceNumber || null,
        createdAt: b.createdAt,
      };
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getBookingByReferenceCode(referenceCode: string, adminUserId: number): Promise<IAdminBookingDetail> {
    this.logger.log(`getBookingByReferenceCode invoked by admin ${adminUserId} for Ref: ${referenceCode}`);
    
    const b = await this.prisma.booking.findUnique({
      where: { referenceCode },
      include: {
        passengers: true,
        billingInfo: true,
        invoice: true,
        tour: { select: { id: true, slug: true, titleJsonb: true } },
      }
    });

    if (!b) throw new NotFoundException(`Booking with reference ${referenceCode} not found`);

    const titleObj: any = b.tour.titleJsonb || {};
    const tourNameEn = titleObj['en'] || 'Unknown';

    return {
      id: b.id,
      referenceCode: b.referenceCode,
      status: b.status,
      totalAmount: b.totalAmountUsd.toString(),
      currency: 'USD',
      passengerCount: b.passengers.length,
      tourId: b.tour.id,
      tourSlug: b.tour.slug,
      tourNameEn,
      invoiceNumber: b.invoice?.invoiceNumber || null,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      passengers: b.passengers.map(p => {
        const parts = p.fullName.split(' ');
        const firstName = parts[0];
        const lastName = parts.slice(1).join(' ') || '';
        return {
          id: p.id,
          firstName,
          lastName,
          passportNumber: null,
          dateOfBirth: null,
          nationality: null,
        };
      }),
      billingInfo: b.billingInfo ? {
        fullName: b.billingInfo.fullName,
        email: b.billingInfo.email,
        phone: b.billingInfo.phone || null,
        address: b.billingInfo.address || null,
        city: b.billingInfo.city || null,
        country: b.billingInfo.country || null,
      } : null,
      invoice: b.invoice ? {
        id: b.invoice.id,
        invoiceNumber: b.invoice.invoiceNumber,
        createdAt: b.invoice.issuedAt,
      } : null,
    };
  }

  async listInquiries(query: ListInquiriesQueryDto, adminUserId: number): Promise<AdminPaginatedResponse<IAdminInquirySummary>> {
    const { page = 1, limit = 20, status, email, dateFrom, dateTo, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    this.logger.log(`listInquiries invoked by admin ${adminUserId} with filters: ${JSON.stringify(query)}`);

    const where: any = {};
    if (status) where.status = status;
    if (email) where.email = { contains: email, mode: 'insensitive' };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;
    const [total, records] = await Promise.all([
      this.prisma.tailorMadeInquiry.count({ where }),
      this.prisma.tailorMadeInquiry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      })
    ]);

    const data = records.map(r => {
      const parts = r.fullName.split(' ');
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ') || '';
      return {
        id: r.id,
        referenceCode: r.referenceCode,
        status: r.status,
        firstName,
        lastName,
        email: r.email,
        phone: r.phone || null,
        numberOfTravelers: r.adults + r.children,
        createdAt: r.createdAt,
      };
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getInquiryByReferenceCode(referenceCode: string, adminUserId: number): Promise<IAdminInquiryDetail> {
    this.logger.log(`getInquiryByReferenceCode invoked by admin ${adminUserId} for Ref: ${referenceCode}`);
    const r = await this.prisma.tailorMadeInquiry.findUnique({ where: { referenceCode } });
    if (!r) throw new NotFoundException(`Inquiry with reference ${referenceCode} not found`);
    
    const parts = r.fullName.split(' ');
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ') || '';
    
    let budget: string | null = null;
    if (r.budgetAmount) {
      budget = `${r.budgetCurrency || 'USD'} ${r.budgetAmount.toString()}`;
    }

    return {
      id: r.id,
      referenceCode: r.referenceCode,
      status: r.status,
      firstName,
      lastName,
      email: r.email,
      phone: r.phone || null,
      numberOfTravelers: r.adults + r.children,
      createdAt: r.createdAt,
      departureDate: r.startDate || null,
      returnDate: r.endDate || null,
      destinations: r.destinations,
      message: r.notes || null,
      budget,
      locale: r.preferredLanguage,
      ipAddress: null,
      updatedAt: r.updatedAt,
    };
  }

  async updateInquiryStatus(referenceCode: string, dto: UpdateInquiryStatusDto, adminUserId: number): Promise<IAdminInquiryDetail> {
    const inquiry = await this.prisma.tailorMadeInquiry.findUnique({ where: { referenceCode } });
    if (!inquiry) throw new NotFoundException(`Inquiry with reference ${referenceCode} not found`);

    const validTransitions: Record<string, string[]> = {
      NEWLY_RECEIVED: ['IN_PROGRESS', 'CLOSED'],
      IN_PROGRESS: ['CLOSED'],
      CLOSED: [],
    };

    const allowed = validTransitions[inquiry.status] || [];
    if (!allowed.includes(dto.status)) {
      this.logger.warn(`Admin ${adminUserId} attempted invalid inquiry status transition for ${referenceCode}: ${inquiry.status} -> ${dto.status}`);
      throw new BadRequestException(`Invalid status transition from ${inquiry.status} to ${dto.status}`);
    }

    const updated = await this.prisma.tailorMadeInquiry.update({
      where: { referenceCode },
      data: { status: dto.status },
    });

    this.logger.log(`Admin ${adminUserId} updated inquiry ${referenceCode} status: ${inquiry.status} -> ${dto.status}`);

    return this.getInquiryByReferenceCode(referenceCode, adminUserId);
  }

  async listContactSubmissions(query: ListContactSubmissionsQueryDto, adminUserId: number): Promise<AdminPaginatedResponse<IAdminContactSummary>> {
    const { page = 1, limit = 20, status, email, dateFrom, dateTo, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    this.logger.log(`listContactSubmissions invoked by admin ${adminUserId} with filters: ${JSON.stringify(query)}`);

    const where: any = {};
    if (status) where.status = status;
    if (email) where.email = { contains: email, mode: 'insensitive' };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;
    const [total, records] = await Promise.all([
      this.prisma.contactSubmission.count({ where }),
      this.prisma.contactSubmission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      })
    ]);

    const data = records.map(r => ({
      id: r.id,
      referenceCode: r.referenceCode,
      status: r.status,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      phone: r.phone || null,
      subject: r.subject,
      createdAt: r.createdAt,
    }));

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getContactSubmissionByReferenceCode(referenceCode: string, adminUserId: number): Promise<IAdminContactDetail> {
    this.logger.log(`getContactSubmissionByReferenceCode invoked by admin ${adminUserId} for Ref: ${referenceCode}`);
    const r = await this.prisma.contactSubmission.findUnique({ where: { referenceCode } });
    if (!r) throw new NotFoundException(`Contact submission with reference ${referenceCode} not found`);
    return {
      id: r.id,
      referenceCode: r.referenceCode,
      status: r.status,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      phone: r.phone || null,
      subject: r.subject,
      createdAt: r.createdAt,
      message: r.message,
      locale: r.locale,
      ipAddress: r.ipAddress || null,
      updatedAt: r.updatedAt,
    };
  }

  async updateContactSubmissionStatus(referenceCode: string, dto: UpdateContactSubmissionStatusDto, adminUserId: number): Promise<IAdminContactDetail> {
    const contact = await this.prisma.contactSubmission.findUnique({ where: { referenceCode } });
    if (!contact) throw new NotFoundException(`Contact submission with reference ${referenceCode} not found`);

    const validTransitions: Record<string, string[]> = {
      NEW: ['READ', 'ARCHIVED'],
      READ: ['ARCHIVED'],
      ARCHIVED: [],
    };

    const allowed = validTransitions[contact.status] || [];
    if (!allowed.includes(dto.status)) {
      this.logger.warn(`Admin ${adminUserId} attempted invalid contact status transition for ${referenceCode}: ${contact.status} -> ${dto.status}`);
      throw new BadRequestException(`Invalid status transition from ${contact.status} to ${dto.status}`);
    }

    const updated = await this.prisma.contactSubmission.update({
      where: { referenceCode },
      data: { status: dto.status },
    });

    this.logger.log(`Admin ${adminUserId} updated contact submission ${referenceCode} status: ${contact.status} -> ${dto.status}`);

    return this.getContactSubmissionByReferenceCode(referenceCode, adminUserId);
  }

  async listNotificationLogs(query: ListNotificationLogsQueryDto, adminUserId: number): Promise<AdminPaginatedResponse<IAdminNotificationLog>> {
    const { page = 1, limit = 20, status, originEvent, dateFrom, dateTo, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    this.logger.log(`listNotificationLogs invoked by admin ${adminUserId} with filters: ${JSON.stringify(query)}`);

    const where: any = {};
    if (status) where.status = status;
    if (originEvent) where.originEntityType = originEvent;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;
    const [total, records] = await Promise.all([
      this.prisma.notificationDeliveryLog.count({ where }),
      this.prisma.notificationDeliveryLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      })
    ]);

    const data = records.map(r => ({
      id: r.id,
      channel: 'EMAIL',
      recipient: r.recipientEmail,
      subject: r.notificationType,
      status: r.status,
      attempts: r.attempts,
      originEvent: r.originEntityType,
      originReferenceCode: r.originReferenceCode,
      failureReason: r.failureReason || null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getDashboardMetrics(adminUserId: number): Promise<IAdminDashboardMetrics> {
    const start = Date.now();
    
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalBookings,
      bookingsThisMonth,
      totalInquiries,
      openInquiries,
      totalContactSubmissions,
      unreadContactSubmissions,
      totalNotificationsSent,
      totalNotificationsFailed,
      recentFailedNotificationsData
    ] = await Promise.all([
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { createdAt: { gte: firstDayOfMonth } } }),
      this.prisma.tailorMadeInquiry.count(),
      this.prisma.tailorMadeInquiry.count({ where: { status: { in: ['NEWLY_RECEIVED', 'IN_PROGRESS'] } } }),
      this.prisma.contactSubmission.count(),
      this.prisma.contactSubmission.count({ where: { status: 'NEW' } }),
      this.prisma.notificationDeliveryLog.count({ where: { status: 'SENT' } }),
      this.prisma.notificationDeliveryLog.count({ where: { status: 'FAILED' } }),
      this.prisma.notificationDeliveryLog.findMany({
        where: { status: 'FAILED' },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })
    ]);

    const recentFailedNotifications = recentFailedNotificationsData.map(r => ({
      id: r.id,
      recipient: r.recipientEmail,
      subject: r.notificationType,
      originEvent: r.originEntityType,
      originReferenceCode: r.originReferenceCode,
      failureReason: r.failureReason || null,
      createdAt: r.createdAt,
    }));

    const ms = Date.now() - start;
    this.logger.log(`getDashboardMetrics invoked by admin ${adminUserId}. Computed in ${ms}ms.`);

    return {
      totalBookings,
      bookingsThisMonth,
      totalInquiries,
      openInquiries,
      totalContactSubmissions,
      unreadContactSubmissions,
      totalNotificationsSent,
      totalNotificationsFailed,
      recentFailedNotifications,
    };
  }
}
