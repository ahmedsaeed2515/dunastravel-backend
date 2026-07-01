"use strict";
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
/* eslint-disable */
var common_1 = require("@nestjs/common");
var cache_manager_1 = require("@nestjs/cache-manager");
var swagger_1 = require("@nestjs/swagger");
var jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
var roles_guard_1 = require("../../common/guards/roles.guard");
var roles_decorator_1 = require("../../common/decorators/roles.decorator");
var client_1 = require("@prisma/client");
var update_booking_dto_1 = require("./dto/update-booking.dto");
var update_booking_status_dto_1 = require("./dto/update-booking-status.dto");
var add_payment_dto_1 = require("./dto/add-payment.dto");
var add_booking_note_dto_1 = require("./dto/add-booking-note.dto");
var add_booking_attachment_dto_1 = require("./dto/add-booking-attachment.dto");
var upsert_passengers_dto_1 = require("./dto/upsert-passengers.dto");
var assign_booking_dto_1 = require("./dto/assign-booking.dto");
var bulk_update_bookings_dto_1 = require("./dto/bulk-update-bookings.dto");
var update_inquiry_status_dto_1 = require("./dto/update-inquiry-status.dto");
var update_contact_submission_status_dto_1 = require("./dto/update-contact-submission-status.dto");
var create_tour_dto_1 = require("./dto/create-tour.dto");
var update_tour_dto_1 = require("./dto/update-tour.dto");
var bulk_update_tours_dto_1 = require("./dto/bulk-update-tours.dto");
var AdminController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('Admin'), (0, swagger_1.ApiBearerAuth)(), (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Unauthorized' }), (0, swagger_1.ApiForbiddenResponse)({ description: 'Forbidden: Requires ADMIN role' }), (0, common_1.Controller)('admin'), (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard), (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN)];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _listBookings_decorators;
    var _exportBookingsCsv_decorators;
    var _getBookingByReferenceCode_decorators;
    var _bulkUpdateBookings_decorators;
    var _updateBooking_decorators;
    var _updateBookingStatus_decorators;
    var _upsertPassengers_decorators;
    var _assignBooking_decorators;
    var _addPayment_decorators;
    var _addBookingNote_decorators;
    var _addBookingAttachment_decorators;
    var _softDeleteBooking_decorators;
    var _listInquiries_decorators;
    var _getInquiryByReferenceCode_decorators;
    var _updateInquiryStatus_decorators;
    var _listContactSubmissions_decorators;
    var _getContactSubmissionByReferenceCode_decorators;
    var _updateContactSubmissionStatus_decorators;
    var _listNotificationLogs_decorators;
    var _getDashboardMetrics_decorators;
    var _listTours_decorators;
    var _getTourStats_decorators;
    var _exportToursCsv_decorators;
    var _getTourBySlug_decorators;
    var _createTour_decorators;
    var _bulkUpdateTours_decorators;
    var _updateTour_decorators;
    var _softDeleteTour_decorators;
    var AdminController = _classThis = /** @class */ (function () {
        function AdminController_1(adminService) {
            this.adminService = (__runInitializers(this, _instanceExtraInitializers), adminService);
        }
        AdminController_1.prototype.listBookings = function (query, req) {
            return __awaiter(this, void 0, void 0, function () {
                var adminUserId;
                return __generator(this, function (_a) {
                    adminUserId = req.user.id;
                    return [2 /*return*/, this.adminService.listBookings(query, adminUserId)];
                });
            });
        };
        AdminController_1.prototype.exportBookingsCsv = function (query, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.adminService.exportBookingsCsv(query, req.user.id)];
                });
            });
        };
        AdminController_1.prototype.getBookingByReferenceCode = function (referenceCode, req) {
            return __awaiter(this, void 0, void 0, function () {
                var adminUserId;
                return __generator(this, function (_a) {
                    adminUserId = req.user.id;
                    return [2 /*return*/, this.adminService.getBookingByReferenceCode(referenceCode, adminUserId)];
                });
            });
        };
        AdminController_1.prototype.bulkUpdateBookings = function (dto, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.adminService.bulkUpdateBookings(dto, req.user.id)];
                });
            });
        };
        AdminController_1.prototype.updateBooking = function (referenceCode, dto, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.adminService.updateBooking(referenceCode, dto, req.user.id)];
                });
            });
        };
        AdminController_1.prototype.updateBookingStatus = function (referenceCode, dto, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.adminService.updateBookingStatus(referenceCode, dto, req.user.id)];
                });
            });
        };
        AdminController_1.prototype.upsertPassengers = function (referenceCode, dto, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.adminService.upsertPassengers(referenceCode, dto, req.user.id)];
                });
            });
        };
        AdminController_1.prototype.assignBooking = function (referenceCode, dto, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.adminService.assignBooking(referenceCode, dto, req.user.id)];
                });
            });
        };
        AdminController_1.prototype.addPayment = function (referenceCode, dto, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.adminService.addPayment(referenceCode, dto, req.user.id)];
                });
            });
        };
        AdminController_1.prototype.addBookingNote = function (referenceCode, dto, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.adminService.addBookingNote(referenceCode, dto, req.user.id)];
                });
            });
        };
        AdminController_1.prototype.addBookingAttachment = function (referenceCode, dto, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.adminService.addBookingAttachment(referenceCode, dto, req.user.id)];
                });
            });
        };
        AdminController_1.prototype.softDeleteBooking = function (referenceCode, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.adminService.softDeleteBooking(referenceCode, req.user.id)];
                });
            });
        };
        AdminController_1.prototype.listInquiries = function (query, req) {
            return __awaiter(this, void 0, void 0, function () {
                var adminUserId;
                return __generator(this, function (_a) {
                    adminUserId = req.user.id;
                    return [2 /*return*/, this.adminService.listInquiries(query, adminUserId)];
                });
            });
        };
        AdminController_1.prototype.getInquiryByReferenceCode = function (referenceCode, req) {
            return __awaiter(this, void 0, void 0, function () {
                var adminUserId;
                return __generator(this, function (_a) {
                    adminUserId = req.user.id;
                    return [2 /*return*/, this.adminService.getInquiryByReferenceCode(referenceCode, adminUserId)];
                });
            });
        };
        AdminController_1.prototype.updateInquiryStatus = function (referenceCode, dto, req) {
            return __awaiter(this, void 0, void 0, function () {
                var adminUserId;
                return __generator(this, function (_a) {
                    adminUserId = req.user.id;
                    return [2 /*return*/, this.adminService.updateInquiryStatus(referenceCode, dto, adminUserId)];
                });
            });
        };
        AdminController_1.prototype.listContactSubmissions = function (query, req) {
            return __awaiter(this, void 0, void 0, function () {
                var adminUserId;
                return __generator(this, function (_a) {
                    adminUserId = req.user.id;
                    return [2 /*return*/, this.adminService.listContactSubmissions(query, adminUserId)];
                });
            });
        };
        AdminController_1.prototype.getContactSubmissionByReferenceCode = function (referenceCode, req) {
            return __awaiter(this, void 0, void 0, function () {
                var adminUserId;
                return __generator(this, function (_a) {
                    adminUserId = req.user.id;
                    return [2 /*return*/, this.adminService.getContactSubmissionByReferenceCode(referenceCode, adminUserId)];
                });
            });
        };
        AdminController_1.prototype.updateContactSubmissionStatus = function (referenceCode, dto, req) {
            return __awaiter(this, void 0, void 0, function () {
                var adminUserId;
                return __generator(this, function (_a) {
                    adminUserId = req.user.id;
                    return [2 /*return*/, this.adminService.updateContactSubmissionStatus(referenceCode, dto, adminUserId)];
                });
            });
        };
        AdminController_1.prototype.listNotificationLogs = function (query, req) {
            return __awaiter(this, void 0, void 0, function () {
                var adminUserId;
                return __generator(this, function (_a) {
                    adminUserId = req.user.id;
                    return [2 /*return*/, this.adminService.listNotificationLogs(query, adminUserId)];
                });
            });
        };
        AdminController_1.prototype.getDashboardMetrics = function (req) {
            return __awaiter(this, void 0, void 0, function () {
                var adminUserId;
                return __generator(this, function (_a) {
                    adminUserId = req.user.id;
                    return [2 /*return*/, this.adminService.getDashboardMetrics(adminUserId)];
                });
            });
        };
        AdminController_1.prototype.listTours = function (query, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.adminService.listTours(query, req.user.id)];
                });
            });
        };
        AdminController_1.prototype.getTourStats = function (req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.adminService.getTourStats(req.user.id)];
                });
            });
        };
        AdminController_1.prototype.exportToursCsv = function (query, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.adminService.exportToursCsv(query, req.user.id)];
                });
            });
        };
        AdminController_1.prototype.getTourBySlug = function (slug, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.adminService.getTourBySlug(slug, req.user.id)];
                });
            });
        };
        AdminController_1.prototype.createTour = function (dto, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.adminService.createTour(dto, req.user.id)];
                });
            });
        };
        AdminController_1.prototype.bulkUpdateTours = function (dto, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.adminService.bulkUpdateTours(dto, req.user.id)];
                });
            });
        };
        AdminController_1.prototype.updateTour = function (slug, dto, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.adminService.updateTour(slug, dto, req.user.id)];
                });
            });
        };
        AdminController_1.prototype.softDeleteTour = function (slug, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.adminService.softDeleteTour(slug, req.user.id)];
                });
            });
        };
        return AdminController_1;
    }());
    __setFunctionName(_classThis, "AdminController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _listBookings_decorators = [(0, common_1.Get)('bookings'), (0, swagger_1.ApiOperation)({ summary: 'List all bookings with pagination and filtering.' }), (0, swagger_1.ApiOkResponse)({ description: 'Paginated list of bookings' })];
        _exportBookingsCsv_decorators = [(0, common_1.Get)('bookings/export/csv'), (0, swagger_1.ApiOperation)({ summary: 'Export bookings to CSV.' }), (0, swagger_1.ApiOkResponse)({ description: 'CSV data string' })];
        _getBookingByReferenceCode_decorators = [(0, common_1.Get)('bookings/:referenceCode'), (0, swagger_1.ApiOperation)({ summary: 'Get full detail for a single booking.' }), (0, swagger_1.ApiParam)({ name: 'referenceCode', type: 'string' }), (0, swagger_1.ApiOkResponse)({ description: 'Full booking record' }), (0, swagger_1.ApiNotFoundResponse)({ description: 'Booking not found' })];
        _bulkUpdateBookings_decorators = [(0, common_1.Patch)('bookings/bulk/update'), (0, swagger_1.ApiOperation)({ summary: 'Bulk update bookings.' }), (0, swagger_1.ApiBody)({ type: bulk_update_bookings_dto_1.BulkUpdateBookingsDto }), (0, swagger_1.ApiOkResponse)({ description: 'Bookings updated successfully' })];
        _updateBooking_decorators = [(0, common_1.Patch)('bookings/:referenceCode'), (0, swagger_1.ApiOperation)({ summary: 'Update general booking details.' }), (0, swagger_1.ApiParam)({ name: 'referenceCode', type: 'string' }), (0, swagger_1.ApiBody)({ type: update_booking_dto_1.UpdateBookingDto }), (0, swagger_1.ApiOkResponse)({ description: 'Updated booking record' })];
        _updateBookingStatus_decorators = [(0, common_1.Patch)('bookings/:referenceCode/status'), (0, swagger_1.ApiOperation)({ summary: 'Update the status of a booking.' }), (0, swagger_1.ApiParam)({ name: 'referenceCode', type: 'string' }), (0, swagger_1.ApiBody)({ type: update_booking_status_dto_1.UpdateBookingStatusDto }), (0, swagger_1.ApiOkResponse)({ description: 'Updated booking status' })];
        _upsertPassengers_decorators = [(0, common_1.Patch)('bookings/:referenceCode/passengers'), (0, swagger_1.ApiOperation)({ summary: 'Upsert passengers for a booking.' }), (0, swagger_1.ApiParam)({ name: 'referenceCode', type: 'string' }), (0, swagger_1.ApiBody)({ type: upsert_passengers_dto_1.UpsertPassengersDto }), (0, swagger_1.ApiOkResponse)({ description: 'Passengers updated successfully' })];
        _assignBooking_decorators = [(0, common_1.Patch)('bookings/:referenceCode/assign'), (0, swagger_1.ApiOperation)({ summary: 'Assign a booking to an admin.' }), (0, swagger_1.ApiParam)({ name: 'referenceCode', type: 'string' }), (0, swagger_1.ApiBody)({ type: assign_booking_dto_1.AssignBookingDto }), (0, swagger_1.ApiOkResponse)({ description: 'Booking assigned successfully' })];
        _addPayment_decorators = [(0, common_1.Post)('bookings/:referenceCode/payments'), (0, swagger_1.ApiOperation)({ summary: 'Add a payment to a booking.' }), (0, swagger_1.ApiParam)({ name: 'referenceCode', type: 'string' }), (0, swagger_1.ApiBody)({ type: add_payment_dto_1.AddPaymentDto }), (0, swagger_1.ApiOkResponse)({ description: 'Payment added successfully' })];
        _addBookingNote_decorators = [(0, common_1.Post)('bookings/:referenceCode/notes'), (0, swagger_1.ApiOperation)({ summary: 'Add an internal note to a booking.' }), (0, swagger_1.ApiParam)({ name: 'referenceCode', type: 'string' }), (0, swagger_1.ApiBody)({ type: add_booking_note_dto_1.AddBookingNoteDto }), (0, swagger_1.ApiOkResponse)({ description: 'Note added successfully' })];
        _addBookingAttachment_decorators = [(0, common_1.Post)('bookings/:referenceCode/attachments'), (0, swagger_1.ApiOperation)({ summary: 'Link an attachment to a booking.' }), (0, swagger_1.ApiParam)({ name: 'referenceCode', type: 'string' }), (0, swagger_1.ApiBody)({ type: add_booking_attachment_dto_1.AddBookingAttachmentDto }), (0, swagger_1.ApiOkResponse)({ description: 'Attachment linked successfully' })];
        _softDeleteBooking_decorators = [(0, common_1.Delete)('bookings/:referenceCode'), (0, swagger_1.ApiOperation)({ summary: 'Soft delete a booking.' }), (0, swagger_1.ApiParam)({ name: 'referenceCode', type: 'string' }), (0, swagger_1.ApiOkResponse)({ description: 'Booking deleted successfully' })];
        _listInquiries_decorators = [(0, common_1.Get)('inquiries'), (0, swagger_1.ApiOperation)({ summary: 'List all tailor-made inquiries with pagination and filtering.' }), (0, swagger_1.ApiOkResponse)({ description: 'Paginated list of inquiries' })];
        _getInquiryByReferenceCode_decorators = [(0, common_1.Get)('inquiries/:referenceCode'), (0, swagger_1.ApiOperation)({ summary: 'Get full detail for a single tailor-made inquiry.' }), (0, swagger_1.ApiParam)({ name: 'referenceCode', type: 'string' }), (0, swagger_1.ApiOkResponse)({ description: 'Full inquiry record' }), (0, swagger_1.ApiNotFoundResponse)({ description: 'Inquiry not found' })];
        _updateInquiryStatus_decorators = [(0, common_1.Patch)('inquiries/:referenceCode/status'), (0, swagger_1.ApiOperation)({ summary: 'Update the status of a tailor-made inquiry.' }), (0, swagger_1.ApiParam)({ name: 'referenceCode', type: 'string' }), (0, swagger_1.ApiBody)({ type: update_inquiry_status_dto_1.UpdateInquiryStatusDto }), (0, swagger_1.ApiOkResponse)({ description: 'Updated inquiry record' }), (0, swagger_1.ApiBadRequestResponse)({ description: 'Invalid status transition' }), (0, swagger_1.ApiNotFoundResponse)({ description: 'Inquiry not found' })];
        _listContactSubmissions_decorators = [(0, common_1.Get)('contact-submissions'), (0, swagger_1.ApiOperation)({ summary: 'List all contact submissions with pagination and filtering.' }), (0, swagger_1.ApiOkResponse)({ description: 'Paginated list of contact submissions' })];
        _getContactSubmissionByReferenceCode_decorators = [(0, common_1.Get)('contact-submissions/:referenceCode'), (0, swagger_1.ApiOperation)({ summary: 'Get full detail for a single contact submission.' }), (0, swagger_1.ApiParam)({ name: 'referenceCode', type: 'string' }), (0, swagger_1.ApiOkResponse)({ description: 'Full contact submission record' }), (0, swagger_1.ApiNotFoundResponse)({ description: 'Contact submission not found' })];
        _updateContactSubmissionStatus_decorators = [(0, common_1.Patch)('contact-submissions/:referenceCode/status'), (0, swagger_1.ApiOperation)({ summary: 'Update the status of a contact submission.' }), (0, swagger_1.ApiParam)({ name: 'referenceCode', type: 'string' }), (0, swagger_1.ApiBody)({ type: update_contact_submission_status_dto_1.UpdateContactSubmissionStatusDto }), (0, swagger_1.ApiOkResponse)({ description: 'Updated contact submission record' }), (0, swagger_1.ApiBadRequestResponse)({ description: 'Invalid status transition' }), (0, swagger_1.ApiNotFoundResponse)({ description: 'Contact submission not found' })];
        _listNotificationLogs_decorators = [(0, common_1.Get)('notification-logs'), (0, swagger_1.ApiOperation)({ summary: 'List notification delivery logs with pagination and filtering.' }), (0, swagger_1.ApiOkResponse)({ description: 'Paginated list of notification logs' })];
        _getDashboardMetrics_decorators = [(0, common_1.Get)('dashboard'), (0, common_1.UseInterceptors)(cache_manager_1.CacheInterceptor), (0, cache_manager_1.CacheKey)('admin:dashboard'), (0, cache_manager_1.CacheTTL)(60), (0, swagger_1.ApiOperation)({ summary: 'Retrieve aggregated CRM dashboard metrics.' }), (0, swagger_1.ApiOkResponse)({ description: 'Dashboard metrics object' })];
        _listTours_decorators = [(0, common_1.Get)('tours'), (0, swagger_1.ApiOperation)({ summary: 'List all tours with advanced enterprise filtering and pagination.' }), (0, swagger_1.ApiOkResponse)({ description: 'Paginated list of tours' })];
        _getTourStats_decorators = [(0, common_1.Get)('tours/stats'), (0, swagger_1.ApiOperation)({ summary: 'Get aggregated tour statistics and occupancy metrics.' }), (0, swagger_1.ApiOkResponse)({ description: 'Tour statistics object' })];
        _exportToursCsv_decorators = [(0, common_1.Get)('tours/export/csv'), (0, swagger_1.ApiOperation)({ summary: 'Export tours to CSV.' }), (0, swagger_1.ApiOkResponse)({ description: 'CSV data string' })];
        _getTourBySlug_decorators = [(0, common_1.Get)('tours/:slug'), (0, swagger_1.ApiOperation)({ summary: 'Get full details for a single tour.' }), (0, swagger_1.ApiParam)({ name: 'slug', type: 'string' }), (0, swagger_1.ApiOkResponse)({ description: 'Full tour record' }), (0, swagger_1.ApiNotFoundResponse)({ description: 'Tour not found' })];
        _createTour_decorators = [(0, common_1.Post)('tours'), (0, swagger_1.ApiOperation)({ summary: 'Create a new tour (supports 10-step wizard data).' }), (0, swagger_1.ApiBody)({ type: create_tour_dto_1.CreateTourDto }), (0, swagger_1.ApiOkResponse)({ description: 'Tour created successfully' })];
        _bulkUpdateTours_decorators = [(0, common_1.Patch)('tours/bulk/update'), (0, swagger_1.ApiOperation)({ summary: 'Bulk update tours.' }), (0, swagger_1.ApiBody)({ type: bulk_update_tours_dto_1.BulkUpdateToursDto }), (0, swagger_1.ApiOkResponse)({ description: 'Tours updated successfully' })];
        _updateTour_decorators = [(0, common_1.Patch)('tours/:slug'), (0, swagger_1.ApiOperation)({ summary: 'Update tour details.' }), (0, swagger_1.ApiParam)({ name: 'slug', type: 'string' }), (0, swagger_1.ApiBody)({ type: update_tour_dto_1.UpdateTourDto }), (0, swagger_1.ApiOkResponse)({ description: 'Updated tour record' })];
        _softDeleteTour_decorators = [(0, common_1.Delete)('tours/:slug'), (0, swagger_1.ApiOperation)({ summary: 'Soft delete a tour.' }), (0, swagger_1.ApiParam)({ name: 'slug', type: 'string' }), (0, swagger_1.ApiOkResponse)({ description: 'Tour soft deleted successfully' })];
        __esDecorate(_classThis, null, _listBookings_decorators, { kind: "method", name: "listBookings", static: false, private: false, access: { has: function (obj) { return "listBookings" in obj; }, get: function (obj) { return obj.listBookings; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _exportBookingsCsv_decorators, { kind: "method", name: "exportBookingsCsv", static: false, private: false, access: { has: function (obj) { return "exportBookingsCsv" in obj; }, get: function (obj) { return obj.exportBookingsCsv; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getBookingByReferenceCode_decorators, { kind: "method", name: "getBookingByReferenceCode", static: false, private: false, access: { has: function (obj) { return "getBookingByReferenceCode" in obj; }, get: function (obj) { return obj.getBookingByReferenceCode; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _bulkUpdateBookings_decorators, { kind: "method", name: "bulkUpdateBookings", static: false, private: false, access: { has: function (obj) { return "bulkUpdateBookings" in obj; }, get: function (obj) { return obj.bulkUpdateBookings; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _updateBooking_decorators, { kind: "method", name: "updateBooking", static: false, private: false, access: { has: function (obj) { return "updateBooking" in obj; }, get: function (obj) { return obj.updateBooking; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _updateBookingStatus_decorators, { kind: "method", name: "updateBookingStatus", static: false, private: false, access: { has: function (obj) { return "updateBookingStatus" in obj; }, get: function (obj) { return obj.updateBookingStatus; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _upsertPassengers_decorators, { kind: "method", name: "upsertPassengers", static: false, private: false, access: { has: function (obj) { return "upsertPassengers" in obj; }, get: function (obj) { return obj.upsertPassengers; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _assignBooking_decorators, { kind: "method", name: "assignBooking", static: false, private: false, access: { has: function (obj) { return "assignBooking" in obj; }, get: function (obj) { return obj.assignBooking; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _addPayment_decorators, { kind: "method", name: "addPayment", static: false, private: false, access: { has: function (obj) { return "addPayment" in obj; }, get: function (obj) { return obj.addPayment; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _addBookingNote_decorators, { kind: "method", name: "addBookingNote", static: false, private: false, access: { has: function (obj) { return "addBookingNote" in obj; }, get: function (obj) { return obj.addBookingNote; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _addBookingAttachment_decorators, { kind: "method", name: "addBookingAttachment", static: false, private: false, access: { has: function (obj) { return "addBookingAttachment" in obj; }, get: function (obj) { return obj.addBookingAttachment; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _softDeleteBooking_decorators, { kind: "method", name: "softDeleteBooking", static: false, private: false, access: { has: function (obj) { return "softDeleteBooking" in obj; }, get: function (obj) { return obj.softDeleteBooking; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _listInquiries_decorators, { kind: "method", name: "listInquiries", static: false, private: false, access: { has: function (obj) { return "listInquiries" in obj; }, get: function (obj) { return obj.listInquiries; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getInquiryByReferenceCode_decorators, { kind: "method", name: "getInquiryByReferenceCode", static: false, private: false, access: { has: function (obj) { return "getInquiryByReferenceCode" in obj; }, get: function (obj) { return obj.getInquiryByReferenceCode; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _updateInquiryStatus_decorators, { kind: "method", name: "updateInquiryStatus", static: false, private: false, access: { has: function (obj) { return "updateInquiryStatus" in obj; }, get: function (obj) { return obj.updateInquiryStatus; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _listContactSubmissions_decorators, { kind: "method", name: "listContactSubmissions", static: false, private: false, access: { has: function (obj) { return "listContactSubmissions" in obj; }, get: function (obj) { return obj.listContactSubmissions; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getContactSubmissionByReferenceCode_decorators, { kind: "method", name: "getContactSubmissionByReferenceCode", static: false, private: false, access: { has: function (obj) { return "getContactSubmissionByReferenceCode" in obj; }, get: function (obj) { return obj.getContactSubmissionByReferenceCode; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _updateContactSubmissionStatus_decorators, { kind: "method", name: "updateContactSubmissionStatus", static: false, private: false, access: { has: function (obj) { return "updateContactSubmissionStatus" in obj; }, get: function (obj) { return obj.updateContactSubmissionStatus; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _listNotificationLogs_decorators, { kind: "method", name: "listNotificationLogs", static: false, private: false, access: { has: function (obj) { return "listNotificationLogs" in obj; }, get: function (obj) { return obj.listNotificationLogs; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getDashboardMetrics_decorators, { kind: "method", name: "getDashboardMetrics", static: false, private: false, access: { has: function (obj) { return "getDashboardMetrics" in obj; }, get: function (obj) { return obj.getDashboardMetrics; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _listTours_decorators, { kind: "method", name: "listTours", static: false, private: false, access: { has: function (obj) { return "listTours" in obj; }, get: function (obj) { return obj.listTours; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getTourStats_decorators, { kind: "method", name: "getTourStats", static: false, private: false, access: { has: function (obj) { return "getTourStats" in obj; }, get: function (obj) { return obj.getTourStats; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _exportToursCsv_decorators, { kind: "method", name: "exportToursCsv", static: false, private: false, access: { has: function (obj) { return "exportToursCsv" in obj; }, get: function (obj) { return obj.exportToursCsv; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getTourBySlug_decorators, { kind: "method", name: "getTourBySlug", static: false, private: false, access: { has: function (obj) { return "getTourBySlug" in obj; }, get: function (obj) { return obj.getTourBySlug; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _createTour_decorators, { kind: "method", name: "createTour", static: false, private: false, access: { has: function (obj) { return "createTour" in obj; }, get: function (obj) { return obj.createTour; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _bulkUpdateTours_decorators, { kind: "method", name: "bulkUpdateTours", static: false, private: false, access: { has: function (obj) { return "bulkUpdateTours" in obj; }, get: function (obj) { return obj.bulkUpdateTours; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _updateTour_decorators, { kind: "method", name: "updateTour", static: false, private: false, access: { has: function (obj) { return "updateTour" in obj; }, get: function (obj) { return obj.updateTour; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _softDeleteTour_decorators, { kind: "method", name: "softDeleteTour", static: false, private: false, access: { has: function (obj) { return "softDeleteTour" in obj; }, get: function (obj) { return obj.softDeleteTour; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AdminController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AdminController = _classThis;
}();
exports.AdminController = AdminController;
