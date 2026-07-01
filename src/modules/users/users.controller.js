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
exports.UsersController = void 0;
var common_1 = require("@nestjs/common");
var swagger_1 = require("@nestjs/swagger");
var jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
var roles_guard_1 = require("../../common/guards/roles.guard");
var roles_decorator_1 = require("../../common/decorators/roles.decorator");
var client_1 = require("@prisma/client");
var customer_crm_dto_1 = require("./dto/customer-crm.dto");
var bcrypt = __importStar(require("bcrypt"));
var UsersController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('Admin Users & CRM'), (0, swagger_1.ApiBearerAuth)(), (0, common_1.Controller)('admin/users'), (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard), (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN)];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _getCrmDashboardMetrics_decorators;
    var _exportCustomersCsv_decorators;
    var _listCustomersCrm_decorators;
    var _bulkUpdateCustomers_decorators;
    var _getCustomerCrmDetail_decorators;
    var _updateCustomerCrm_decorators;
    var _addCustomerNote_decorators;
    var _addCustomerDocument_decorators;
    var _listUsers_decorators;
    var _getUser_decorators;
    var _createUser_decorators;
    var _updateUser_decorators;
    var _deleteUser_decorators;
    var UsersController = _classThis = /** @class */ (function () {
        function UsersController_1(userService, auditService) {
            this.userService = (__runInitializers(this, _instanceExtraInitializers), userService);
            this.auditService = auditService;
        }
        // ─── ENTERPRISE CRM ENDPOINTS (PHASE 5) ────────────────────────
        UsersController_1.prototype.getCrmDashboardMetrics = function (req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.userService.getCrmDashboardMetrics(req.user.id)];
                });
            });
        };
        UsersController_1.prototype.exportCustomersCsv = function (query, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.userService.exportCustomersCsv(query, req.user.id)];
                });
            });
        };
        UsersController_1.prototype.listCustomersCrm = function (query, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.userService.findCustomersCrm(query, req.user.id)];
                });
            });
        };
        UsersController_1.prototype.bulkUpdateCustomers = function (dto, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.userService.bulkUpdateCustomers(dto, req.user.id)];
                });
            });
        };
        UsersController_1.prototype.getCustomerCrmDetail = function (id, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.userService.getCustomerCrmDetail(id, req.user.id)];
                });
            });
        };
        UsersController_1.prototype.updateCustomerCrm = function (id, dto, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.userService.updateCustomerCrm(id, dto, req.user.id)];
                });
            });
        };
        UsersController_1.prototype.addCustomerNote = function (id, dto, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.userService.addCustomerNote(id, dto, req.user.id)];
                });
            });
        };
        UsersController_1.prototype.addCustomerDocument = function (id, dto, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.userService.addCustomerDocument(id, dto, req.user.id)];
                });
            });
        };
        // ─── LEGACY USERS ENDPOINTS ────────────────────────────────────
        UsersController_1.prototype.listUsers = function (query) {
            return __awaiter(this, void 0, void 0, function () {
                var page, limit, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            page = query.page || 1;
                            limit = query.limit || 10;
                            return [4 /*yield*/, this.userService.findAll({
                                    page: page,
                                    limit: limit,
                                    search: query.search,
                                    role: query.role,
                                })];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/, {
                                    data: result.users,
                                    meta: {
                                        total: result.total,
                                        page: page,
                                        limit: limit,
                                        totalPages: Math.ceil(result.total / limit),
                                    },
                                }];
                    }
                });
            });
        };
        UsersController_1.prototype.getUser = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var user;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.userService.findById(id)];
                        case 1:
                            user = _a.sent();
                            if (!user)
                                throw new common_1.ConflictException('User not found');
                            return [2 /*return*/, this.userService.toSafeUser(user)];
                    }
                });
            });
        };
        UsersController_1.prototype.createUser = function (dto, req) {
            return __awaiter(this, void 0, void 0, function () {
                var existing, passwordHash, user;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (dto.role === client_1.UserRole.SUPER_ADMIN && req.user.role !== client_1.UserRole.SUPER_ADMIN) {
                                throw new common_1.ForbiddenException('Only SUPER_ADMIN can create a SUPER_ADMIN user');
                            }
                            return [4 /*yield*/, this.userService.findByEmail(dto.email)];
                        case 1:
                            existing = _a.sent();
                            if (existing)
                                throw new common_1.ConflictException('Email already in use');
                            return [4 /*yield*/, bcrypt.hash(dto.password, 12)];
                        case 2:
                            passwordHash = _a.sent();
                            return [4 /*yield*/, this.userService.create({
                                    name: dto.name,
                                    email: dto.email,
                                    phone: dto.phone,
                                    role: dto.role,
                                    passwordHash: passwordHash,
                                })];
                        case 3:
                            user = _a.sent();
                            return [2 /*return*/, this.userService.toSafeUser(user)];
                    }
                });
            });
        };
        UsersController_1.prototype.updateUser = function (id, dto, req) {
            return __awaiter(this, void 0, void 0, function () {
                var passwordHash, user;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (dto.role === client_1.UserRole.SUPER_ADMIN && req.user.role !== client_1.UserRole.SUPER_ADMIN) {
                                throw new common_1.ForbiddenException('Only SUPER_ADMIN can grant SUPER_ADMIN role');
                            }
                            passwordHash = undefined;
                            if (!dto.password) return [3 /*break*/, 2];
                            return [4 /*yield*/, bcrypt.hash(dto.password, 12)];
                        case 1:
                            passwordHash = _a.sent();
                            _a.label = 2;
                        case 2: return [4 /*yield*/, this.userService.update(id, {
                                name: dto.name,
                                email: dto.email,
                                phone: dto.phone,
                                role: dto.role,
                                passwordHash: passwordHash,
                            })];
                        case 3:
                            user = _a.sent();
                            if (dto.role) {
                                void this.auditService.log({
                                    actorId: req.user.id,
                                    actorRole: req.user.role,
                                    action: 'USER_ROLE_CHANGED',
                                    entityType: 'User',
                                    entityId: id,
                                    metadata: { newRole: dto.role },
                                    ipAddress: req.ip,
                                });
                            }
                            return [2 /*return*/, this.userService.toSafeUser(user)];
                    }
                });
            });
        };
        UsersController_1.prototype.deleteUser = function (id, req) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.userService.softDelete(id)];
                        case 1:
                            _a.sent();
                            void this.auditService.log({
                                actorId: req.user.id,
                                actorRole: req.user.role,
                                action: 'USER_DELETED',
                                entityType: 'User',
                                entityId: id,
                                ipAddress: req.ip,
                            });
                            return [2 /*return*/, { success: true }];
                    }
                });
            });
        };
        return UsersController_1;
    }());
    __setFunctionName(_classThis, "UsersController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _getCrmDashboardMetrics_decorators = [(0, common_1.Get)('crm/metrics'), (0, swagger_1.ApiOperation)({ summary: 'Get live CRM analytics and dashboard metrics.' }), (0, swagger_1.ApiOkResponse)({ description: 'Aggregated CRM metrics object' })];
        _exportCustomersCsv_decorators = [(0, common_1.Get)('crm/export/csv'), (0, swagger_1.ApiOperation)({ summary: 'Export customers to CSV.' }), (0, swagger_1.ApiOkResponse)({ description: 'CSV data string' })];
        _listCustomersCrm_decorators = [(0, common_1.Get)('crm/list'), (0, swagger_1.ApiOperation)({
                summary: 'List customers with advanced enterprise filtering and pagination.',
            }), (0, swagger_1.ApiOkResponse)({
                description: 'Paginated list of customers with financial metrics',
            })];
        _bulkUpdateCustomers_decorators = [(0, common_1.Patch)('crm/bulk/update'), (0, swagger_1.ApiOperation)({
                summary: 'Bulk update customer segments, tags, VIP flags, or statuses.',
            }), (0, swagger_1.ApiBody)({ type: customer_crm_dto_1.BulkUpdateCustomersDto }), (0, swagger_1.ApiOkResponse)({ description: 'Customers bulk updated successfully' })];
        _getCustomerCrmDetail_decorators = [(0, common_1.Get)('crm/:id'), (0, swagger_1.ApiOperation)({ summary: 'Get fully populated customer CRM detail profile.' }), (0, swagger_1.ApiParam)({ name: 'id', type: 'string' }), (0, swagger_1.ApiOkResponse)({
                description: 'Rich customer profile including bookings, payments, notes, documents, and timeline.',
            })];
        _updateCustomerCrm_decorators = [(0, common_1.Patch)('crm/:id'), (0, swagger_1.ApiOperation)({ summary: 'Update customer CRM profile fields.' }), (0, swagger_1.ApiParam)({ name: 'id', type: 'string' }), (0, swagger_1.ApiBody)({ type: customer_crm_dto_1.UpdateCustomerCrmDto }), (0, swagger_1.ApiOkResponse)({ description: 'Updated customer CRM profile' })];
        _addCustomerNote_decorators = [(0, common_1.Post)('crm/:id/notes'), (0, swagger_1.ApiOperation)({
                summary: 'Add an internal, sales, or operations note to a customer.',
            }), (0, swagger_1.ApiParam)({ name: 'id', type: 'string' }), (0, swagger_1.ApiBody)({ type: customer_crm_dto_1.AddCustomerNoteDto }), (0, swagger_1.ApiOkResponse)({ description: 'Customer note added successfully' })];
        _addCustomerDocument_decorators = [(0, common_1.Post)('crm/:id/documents'), (0, swagger_1.ApiOperation)({
                summary: 'Attach a document (passport scan, visa, insurance, tickets) to a customer.',
            }), (0, swagger_1.ApiParam)({ name: 'id', type: 'string' }), (0, swagger_1.ApiBody)({ type: customer_crm_dto_1.AddCustomerDocumentDto }), (0, swagger_1.ApiOkResponse)({ description: 'Customer document attached successfully' })];
        _listUsers_decorators = [(0, common_1.Get)(), (0, swagger_1.ApiOperation)({ summary: 'List all users with pagination and filtering.' }), (0, swagger_1.ApiOkResponse)({ description: 'Paginated list of users' })];
        _getUser_decorators = [(0, common_1.Get)(':id'), (0, swagger_1.ApiOperation)({ summary: 'Get details for a single user.' }), (0, swagger_1.ApiOkResponse)({ description: 'User record' }), (0, swagger_1.ApiNotFoundResponse)({ description: 'User not found' })];
        _createUser_decorators = [(0, common_1.Post)(), (0, swagger_1.ApiOperation)({ summary: 'Create a new user.' }), (0, swagger_1.ApiCreatedResponse)({ description: 'The created user' })];
        _updateUser_decorators = [(0, common_1.Patch)(':id'), (0, swagger_1.ApiOperation)({ summary: 'Update an existing user.' }), (0, swagger_1.ApiOkResponse)({ description: 'The updated user' })];
        _deleteUser_decorators = [(0, common_1.Delete)(':id'), (0, swagger_1.ApiOperation)({ summary: 'Soft delete a user.' }), (0, swagger_1.ApiOkResponse)({ description: 'User deleted' })];
        __esDecorate(_classThis, null, _getCrmDashboardMetrics_decorators, { kind: "method", name: "getCrmDashboardMetrics", static: false, private: false, access: { has: function (obj) { return "getCrmDashboardMetrics" in obj; }, get: function (obj) { return obj.getCrmDashboardMetrics; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _exportCustomersCsv_decorators, { kind: "method", name: "exportCustomersCsv", static: false, private: false, access: { has: function (obj) { return "exportCustomersCsv" in obj; }, get: function (obj) { return obj.exportCustomersCsv; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _listCustomersCrm_decorators, { kind: "method", name: "listCustomersCrm", static: false, private: false, access: { has: function (obj) { return "listCustomersCrm" in obj; }, get: function (obj) { return obj.listCustomersCrm; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _bulkUpdateCustomers_decorators, { kind: "method", name: "bulkUpdateCustomers", static: false, private: false, access: { has: function (obj) { return "bulkUpdateCustomers" in obj; }, get: function (obj) { return obj.bulkUpdateCustomers; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getCustomerCrmDetail_decorators, { kind: "method", name: "getCustomerCrmDetail", static: false, private: false, access: { has: function (obj) { return "getCustomerCrmDetail" in obj; }, get: function (obj) { return obj.getCustomerCrmDetail; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _updateCustomerCrm_decorators, { kind: "method", name: "updateCustomerCrm", static: false, private: false, access: { has: function (obj) { return "updateCustomerCrm" in obj; }, get: function (obj) { return obj.updateCustomerCrm; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _addCustomerNote_decorators, { kind: "method", name: "addCustomerNote", static: false, private: false, access: { has: function (obj) { return "addCustomerNote" in obj; }, get: function (obj) { return obj.addCustomerNote; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _addCustomerDocument_decorators, { kind: "method", name: "addCustomerDocument", static: false, private: false, access: { has: function (obj) { return "addCustomerDocument" in obj; }, get: function (obj) { return obj.addCustomerDocument; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _listUsers_decorators, { kind: "method", name: "listUsers", static: false, private: false, access: { has: function (obj) { return "listUsers" in obj; }, get: function (obj) { return obj.listUsers; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getUser_decorators, { kind: "method", name: "getUser", static: false, private: false, access: { has: function (obj) { return "getUser" in obj; }, get: function (obj) { return obj.getUser; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _createUser_decorators, { kind: "method", name: "createUser", static: false, private: false, access: { has: function (obj) { return "createUser" in obj; }, get: function (obj) { return obj.createUser; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _updateUser_decorators, { kind: "method", name: "updateUser", static: false, private: false, access: { has: function (obj) { return "updateUser" in obj; }, get: function (obj) { return obj.updateUser; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _deleteUser_decorators, { kind: "method", name: "deleteUser", static: false, private: false, access: { has: function (obj) { return "deleteUser" in obj; }, get: function (obj) { return obj.deleteUser; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        UsersController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return UsersController = _classThis;
}();
exports.UsersController = UsersController;
