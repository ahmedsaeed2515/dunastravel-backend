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
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanySelfController = void 0;
var common_1 = require("@nestjs/common");
var swagger_1 = require("@nestjs/swagger");
var jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
var roles_guard_1 = require("../../common/guards/roles.guard");
var roles_decorator_1 = require("../../common/decorators/roles.decorator");
var CompanySelfController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('Company Self-Service'), (0, common_1.Controller)('company'), (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard), (0, roles_decorator_1.Roles)('COMPANY', 'AGENT'), (0, swagger_1.ApiBearerAuth)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _getBookings_decorators;
    var _getCommissions_decorators;
    var _getWallet_decorators;
    var CompanySelfController = _classThis = /** @class */ (function () {
        function CompanySelfController_1(companySelfService) {
            this.companySelfService = (__runInitializers(this, _instanceExtraInitializers), companySelfService);
        }
        CompanySelfController_1.prototype.getBookings = function (user, page, limit) {
            if (page === void 0) { page = '1'; }
            if (limit === void 0) { limit = '20'; }
            return this.companySelfService.getCompanyBookings(user.companyId, page, limit);
        };
        CompanySelfController_1.prototype.getCommissions = function (user, page, limit) {
            if (page === void 0) { page = '1'; }
            if (limit === void 0) { limit = '20'; }
            return this.companySelfService.getCompanyCommissions(user.companyId, page, limit);
        };
        CompanySelfController_1.prototype.getWallet = function (user) {
            return this.companySelfService.getCompanyWallet(user.companyId);
        };
        return CompanySelfController_1;
    }());
    __setFunctionName(_classThis, "CompanySelfController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _getBookings_decorators = [(0, common_1.Get)('bookings'), (0, swagger_1.ApiOperation)({ summary: 'Get all bookings for my company' }), (0, swagger_1.ApiOkResponse)({ description: 'Company bookings' })];
        _getCommissions_decorators = [(0, common_1.Get)('commissions'), (0, swagger_1.ApiOperation)({ summary: 'Get commission records for my company' }), (0, swagger_1.ApiOkResponse)({ description: 'Company commissions' })];
        _getWallet_decorators = [(0, common_1.Get)('wallet'), (0, swagger_1.ApiOperation)({ summary: 'Get wallet balance for my company' }), (0, swagger_1.ApiOkResponse)({ description: 'Company wallet info' })];
        __esDecorate(_classThis, null, _getBookings_decorators, { kind: "method", name: "getBookings", static: false, private: false, access: { has: function (obj) { return "getBookings" in obj; }, get: function (obj) { return obj.getBookings; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getCommissions_decorators, { kind: "method", name: "getCommissions", static: false, private: false, access: { has: function (obj) { return "getCommissions" in obj; }, get: function (obj) { return obj.getCommissions; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getWallet_decorators, { kind: "method", name: "getWallet", static: false, private: false, access: { has: function (obj) { return "getWallet" in obj; }, get: function (obj) { return obj.getWallet; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        CompanySelfController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return CompanySelfController = _classThis;
}();
exports.CompanySelfController = CompanySelfController;
