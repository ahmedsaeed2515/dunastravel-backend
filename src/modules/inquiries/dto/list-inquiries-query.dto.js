"use strict";
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
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListInquiriesQueryDto = void 0;
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var swagger_1 = require("@nestjs/swagger");
var IsCreatedAtEndAfterStartConstraint = function () {
    var _classDecorators = [(0, class_validator_1.ValidatorConstraint)({ name: 'IsCreatedAtEndAfterStart', async: false })];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var IsCreatedAtEndAfterStartConstraint = _classThis = /** @class */ (function () {
        function IsCreatedAtEndAfterStartConstraint_1() {
        }
        IsCreatedAtEndAfterStartConstraint_1.prototype.validate = function (value, args) {
            var obj = args.object;
            if (!obj.createdAtStart || !value)
                return true;
            return new Date(value) >= new Date(obj.createdAtStart);
        };
        IsCreatedAtEndAfterStartConstraint_1.prototype.defaultMessage = function () {
            return 'createdAtEnd must not be before createdAtStart';
        };
        return IsCreatedAtEndAfterStartConstraint_1;
    }());
    __setFunctionName(_classThis, "IsCreatedAtEndAfterStartConstraint");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        IsCreatedAtEndAfterStartConstraint = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return IsCreatedAtEndAfterStartConstraint = _classThis;
}();
var ListInquiriesQueryDto = function () {
    var _a;
    var _page_decorators;
    var _page_initializers = [];
    var _page_extraInitializers = [];
    var _limit_decorators;
    var _limit_initializers = [];
    var _limit_extraInitializers = [];
    var _status_decorators;
    var _status_initializers = [];
    var _status_extraInitializers = [];
    var _createdAtStart_decorators;
    var _createdAtStart_initializers = [];
    var _createdAtStart_extraInitializers = [];
    var _createdAtEnd_decorators;
    var _createdAtEnd_initializers = [];
    var _createdAtEnd_extraInitializers = [];
    return _a = /** @class */ (function () {
            function ListInquiriesQueryDto() {
                this.page = __runInitializers(this, _page_initializers, 1);
                this.limit = (__runInitializers(this, _page_extraInitializers), __runInitializers(this, _limit_initializers, 10));
                this.status = (__runInitializers(this, _limit_extraInitializers), __runInitializers(this, _status_initializers, void 0));
                this.createdAtStart = (__runInitializers(this, _status_extraInitializers), __runInitializers(this, _createdAtStart_initializers, void 0));
                this.createdAtEnd = (__runInitializers(this, _createdAtStart_extraInitializers), __runInitializers(this, _createdAtEnd_initializers, void 0));
                __runInitializers(this, _createdAtEnd_extraInitializers);
            }
            return ListInquiriesQueryDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _page_decorators = [(0, swagger_1.ApiPropertyOptional)({ minimum: 1, default: 1 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsInt)(), (0, class_validator_1.Min)(1), (0, class_transformer_1.Type)(function () { return Number; })];
            _limit_decorators = [(0, swagger_1.ApiPropertyOptional)({ minimum: 1, maximum: 100, default: 10 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsInt)(), (0, class_validator_1.Min)(1), (0, class_validator_1.Max)(100), (0, class_transformer_1.Type)(function () { return Number; })];
            _status_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: ['NEWLY_RECEIVED', 'IN_PROGRESS', 'CLOSED'] }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(['NEWLY_RECEIVED', 'IN_PROGRESS', 'CLOSED'])];
            _createdAtStart_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Filter by creation date (start)' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _createdAtEnd_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Filter by creation date (end)' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)(), (0, class_validator_1.Validate)(IsCreatedAtEndAfterStartConstraint)];
            __esDecorate(null, null, _page_decorators, { kind: "field", name: "page", static: false, private: false, access: { has: function (obj) { return "page" in obj; }, get: function (obj) { return obj.page; }, set: function (obj, value) { obj.page = value; } }, metadata: _metadata }, _page_initializers, _page_extraInitializers);
            __esDecorate(null, null, _limit_decorators, { kind: "field", name: "limit", static: false, private: false, access: { has: function (obj) { return "limit" in obj; }, get: function (obj) { return obj.limit; }, set: function (obj, value) { obj.limit = value; } }, metadata: _metadata }, _limit_initializers, _limit_extraInitializers);
            __esDecorate(null, null, _status_decorators, { kind: "field", name: "status", static: false, private: false, access: { has: function (obj) { return "status" in obj; }, get: function (obj) { return obj.status; }, set: function (obj, value) { obj.status = value; } }, metadata: _metadata }, _status_initializers, _status_extraInitializers);
            __esDecorate(null, null, _createdAtStart_decorators, { kind: "field", name: "createdAtStart", static: false, private: false, access: { has: function (obj) { return "createdAtStart" in obj; }, get: function (obj) { return obj.createdAtStart; }, set: function (obj, value) { obj.createdAtStart = value; } }, metadata: _metadata }, _createdAtStart_initializers, _createdAtStart_extraInitializers);
            __esDecorate(null, null, _createdAtEnd_decorators, { kind: "field", name: "createdAtEnd", static: false, private: false, access: { has: function (obj) { return "createdAtEnd" in obj; }, get: function (obj) { return obj.createdAtEnd; }, set: function (obj, value) { obj.createdAtEnd = value; } }, metadata: _metadata }, _createdAtEnd_initializers, _createdAtEnd_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.ListInquiriesQueryDto = ListInquiriesQueryDto;
