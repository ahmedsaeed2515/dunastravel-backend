"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
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
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.ContactSubmissionsService = void 0;
/* eslint-disable */
var common_1 = require("@nestjs/common");
var contact_created_event_1 = require("./events/contact-created.event");
var crypto = __importStar(require("crypto"));
var sanitize_util_1 = require("../../common/utils/sanitize.util");
var ContactSubmissionsService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var ContactSubmissionsService = _classThis = /** @class */ (function () {
        function ContactSubmissionsService_1(prisma, eventEmitter) {
            this.prisma = prisma;
            this.eventEmitter = eventEmitter;
            this.logger = new common_1.Logger(ContactSubmissionsService.name);
        }
        ContactSubmissionsService_1.prototype.create = function (dto, ipAddress) {
            return __awaiter(this, void 0, void 0, function () {
                var referenceCode, submission, payload, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.generateUniqueReferenceCode()];
                        case 1:
                            referenceCode = _a.sent();
                            _a.label = 2;
                        case 2:
                            _a.trys.push([2, 4, , 5]);
                            return [4 /*yield*/, this.prisma.contactSubmission.create({
                                    data: {
                                        referenceCode: referenceCode,
                                        firstName: (0, sanitize_util_1.sanitizeString)(dto.firstName),
                                        lastName: (0, sanitize_util_1.sanitizeString)(dto.lastName),
                                        email: (0, sanitize_util_1.sanitizeString)(dto.email),
                                        phone: dto.phone ? (0, sanitize_util_1.sanitizeString)(dto.phone) : null,
                                        subject: (0, sanitize_util_1.sanitizeString)(dto.subject),
                                        message: (0, sanitize_util_1.sanitizeString)(dto.message),
                                        locale: dto.locale || 'en',
                                        ipAddress: ipAddress,
                                    },
                                })];
                        case 3:
                            submission = _a.sent();
                            this.logger.log("Contact submission created: Ref=".concat(referenceCode, ", Email=").concat(this.maskEmail(submission.email), ", Subject=\"").concat(submission.subject, "\""));
                            payload = new contact_created_event_1.ContactCreatedEvent({
                                referenceCode: submission.referenceCode,
                                firstName: submission.firstName,
                                lastName: submission.lastName,
                                email: submission.email,
                                phone: submission.phone || undefined,
                                subject: submission.subject,
                                message: submission.message,
                                locale: submission.locale,
                                submittedAt: submission.createdAt,
                            });
                            this.eventEmitter.emit(contact_created_event_1.CONTACT_CREATED_EVENT, payload);
                            this.logger.log("Emitted event ".concat(contact_created_event_1.CONTACT_CREATED_EVENT, " for Ref=").concat(referenceCode));
                            return [2 /*return*/, submission];
                        case 4:
                            error_1 = _a.sent();
                            this.logger.error("Failed to persist contact submission: ".concat(error_1.message), error_1.stack);
                            throw new common_1.InternalServerErrorException('Failed to process contact submission');
                        case 5: return [2 /*return*/];
                    }
                });
            });
        };
        ContactSubmissionsService_1.prototype.generateUniqueReferenceCode = function () {
            return __awaiter(this, void 0, void 0, function () {
                var maxAttempts, chars, i, code, bytes, j, existing;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            maxAttempts = 10;
                            chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                            i = 0;
                            _a.label = 1;
                        case 1:
                            if (!(i < maxAttempts)) return [3 /*break*/, 4];
                            code = 'CON-';
                            bytes = crypto.randomBytes(6);
                            for (j = 0; j < 6; j++) {
                                code += chars[bytes[j] % chars.length];
                            }
                            return [4 /*yield*/, this.prisma.contactSubmission.findUnique({
                                    where: { referenceCode: code },
                                    select: { id: true },
                                })];
                        case 2:
                            existing = _a.sent();
                            if (!existing) {
                                return [2 /*return*/, code];
                            }
                            _a.label = 3;
                        case 3:
                            i++;
                            return [3 /*break*/, 1];
                        case 4:
                            this.logger.error('Failed to generate unique reference code after maximum attempts.');
                            throw new common_1.InternalServerErrorException('Failed to generate unique reference code after maximum attempts.');
                    }
                });
            });
        };
        ContactSubmissionsService_1.prototype.maskEmail = function (email) {
            var parts = email.split('@');
            if (parts.length !== 2)
                return email;
            var local = parts[0], domain = parts[1];
            var visibleLocal = local.substring(0, 3);
            return "".concat(visibleLocal, "***@").concat(domain);
        };
        return ContactSubmissionsService_1;
    }());
    __setFunctionName(_classThis, "ContactSubmissionsService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ContactSubmissionsService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ContactSubmissionsService = _classThis;
}();
exports.ContactSubmissionsService = ContactSubmissionsService;
