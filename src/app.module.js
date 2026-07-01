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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
var common_1 = require("@nestjs/common");
var config_1 = require("@nestjs/config");
var throttler_1 = require("@nestjs/throttler");
var core_1 = require("@nestjs/core");
var cache_manager_1 = require("@nestjs/cache-manager");
var schedule_1 = require("@nestjs/schedule");
var event_emitter_1 = require("@nestjs/event-emitter");
var env_validation_1 = require("./config/env.validation");
var configuration_1 = __importDefault(require("./config/configuration"));
var async_context_service_1 = require("./common/logging/async-context.service");
var json_logger_service_1 = require("./common/logging/json-logger.service");
var timeout_interceptor_1 = require("./common/interceptors/timeout.interceptor");
var correlation_id_middleware_1 = require("./common/logging/correlation-id.middleware");
var health_module_1 = require("./health/health.module");
var prisma_module_1 = require("./prisma/prisma.module");
var auth_module_1 = require("./modules/auth/auth.module");
var tours_module_1 = require("./modules/tours/tours.module");
var bookings_module_1 = require("./modules/bookings/bookings.module");
var invoices_module_1 = require("./modules/invoices/invoices.module");
var inquiries_module_1 = require("./modules/inquiries/inquiries.module");
var notifications_module_1 = require("./modules/notifications/notifications.module");
var contact_submissions_module_1 = require("./modules/contact-submissions/contact-submissions.module");
var admin_module_1 = require("./modules/admin/admin.module");
var media_module_1 = require("./modules/media/media.module");
var companies_module_1 = require("./modules/companies/companies.module");
var commissions_module_1 = require("./modules/commissions/commissions.module");
var wallets_module_1 = require("./modules/wallets/wallets.module");
var ai_module_1 = require("./modules/ai/ai.module");
var currency_module_1 = require("./modules/currency/currency.module");
var audit_module_1 = require("./modules/audit/audit.module");
var agents_module_1 = require("./modules/agents/agents.module");
var company_self_module_1 = require("./modules/company-self/company-self.module");
var nest_winston_1 = require("nest-winston");
var winston = __importStar(require("winston"));
var csrf_guard_1 = require("./common/guards/csrf.guard");
var nestjs_prometheus_1 = require("@willsoto/nestjs-prometheus");
var AppModule = function () {
    var _classDecorators = [(0, common_1.Module)({
            imports: [
                // Config — global, validates env vars on startup
                config_1.ConfigModule.forRoot({
                    isGlobal: true,
                    load: [configuration_1.default],
                    validationSchema: env_validation_1.envValidationSchema,
                    validationOptions: {
                        allowUnknown: true,
                        abortEarly: false,
                    },
                }),
                // Rate limiting — global, 100 req/min per IP
                throttler_1.ThrottlerModule.forRoot([
                    {
                        ttl: 60000,
                        limit: 100,
                    },
                ]),
                // Structured Logging
                nest_winston_1.WinstonModule.forRoot({
                    transports: [
                        new winston.transports.Console({
                            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
                        }),
                        new winston.transports.File({
                            filename: 'logs/error.log',
                            level: 'error',
                        }),
                        new winston.transports.File({
                            filename: 'logs/combined.log',
                        }),
                    ],
                }),
                // Redis Caching
                cache_manager_1.CacheModule.registerAsync({
                    isGlobal: true,
                    useFactory: function (config) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, ({
                                    // store: redisStore, // Disabled for local audit to use memory store
                                    host: config.get('REDIS_HOST', 'localhost'),
                                    port: config.get('REDIS_PORT', 6379),
                                    ttl: 300, // 5 minutes default
                                })];
                        });
                    }); },
                    inject: [config_1.ConfigService],
                }),
                // Cron jobs — needed by CurrencyModule (Phase 10)
                schedule_1.ScheduleModule.forRoot(),
                event_emitter_1.EventEmitterModule.forRoot({
                    wildcard: false,
                    delimiter: '.',
                    newListener: false,
                    removeListener: false,
                    maxListeners: 10,
                    verboseMemoryLeak: false,
                    ignoreErrors: false,
                }),
                // Database — global provider, available in all modules
                prisma_module_1.PrismaModule,
                // Health check
                health_module_1.HealthModule,
                // Prometheus Metrics
                nestjs_prometheus_1.PrometheusModule.register(),
                // Feature modules — added in later phases:
                admin_module_1.AdminModule,
                auth_module_1.AuthModule,
                tours_module_1.ToursModule,
                bookings_module_1.BookingsModule,
                invoices_module_1.InvoicesModule,
                inquiries_module_1.InquiriesModule,
                notifications_module_1.NotificationsModule,
                contact_submissions_module_1.ContactSubmissionsModule,
                media_module_1.MediaModule,
                companies_module_1.CompaniesModule,
                wallets_module_1.WalletsModule,
                commissions_module_1.CommissionsModule,
                // MailModule      ← Phase 8
                ai_module_1.AiModule,
                currency_module_1.CurrencyModule,
                audit_module_1.AuditModule,
                agents_module_1.AgentsModule,
                company_self_module_1.CompanySelfModule,
            ],
            providers: [
                async_context_service_1.AsyncContextService,
                json_logger_service_1.JsonLoggerService,
                timeout_interceptor_1.TimeoutInterceptor,
                {
                    provide: core_1.APP_GUARD,
                    useClass: throttler_1.ThrottlerGuard,
                },
                {
                    provide: core_1.APP_GUARD,
                    useClass: csrf_guard_1.CsrfGuard,
                },
            ],
        })];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var AppModule = _classThis = /** @class */ (function () {
        function AppModule_1() {
        }
        AppModule_1.prototype.configure = function (consumer) {
            consumer.apply(correlation_id_middleware_1.CorrelationIdMiddleware).forRoutes('*');
        };
        return AppModule_1;
    }());
    __setFunctionName(_classThis, "AppModule");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AppModule = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AppModule = _classThis;
}();
exports.AppModule = AppModule;
