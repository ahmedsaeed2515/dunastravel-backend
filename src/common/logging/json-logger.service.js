"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
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
exports.JsonLoggerService = void 0;
var common_1 = require("@nestjs/common");
var correlation_id_middleware_1 = require("./correlation-id.middleware");
var LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
var JsonLoggerService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var JsonLoggerService = _classThis = /** @class */ (function () {
        function JsonLoggerService_1(configService, asyncContextService) {
            var _a;
            this.configService = configService;
            this.asyncContextService = asyncContextService;
            var configuredLevel = this.configService.get('LOG_LEVEL') || 'info';
            this.minLevel = (_a = LOG_LEVELS[configuredLevel]) !== null && _a !== void 0 ? _a : LOG_LEVELS.info;
            this.nodeEnv = this.configService.get('NODE_ENV') || 'development';
        }
        JsonLoggerService_1.prototype.safeStringify = function (obj) {
            var cache = new Set();
            return JSON.stringify(obj, function (key, value) {
                if (value instanceof Error) {
                    return { message: value.message, stack: value.stack, name: value.name };
                }
                if (typeof value === 'object' && value !== null) {
                    if (cache.has(value)) {
                        return '[Circular]';
                    }
                    cache.add(value);
                }
                return value;
            });
        };
        JsonLoggerService_1.prototype.print = function (level, message, context, meta) {
            if (LOG_LEVELS[level] < this.minLevel) {
                return;
            }
            var correlationId = this.asyncContextService.get(correlation_id_middleware_1.CORRELATION_ID_KEY) || null;
            // Safely extract string message
            var msg = typeof message === 'string' ? message : this.safeStringify(message);
            var logObject = __assign({ timestamp: new Date().toISOString(), level: level, context: context, message: msg, correlationId: correlationId, pid: process.pid, nodeEnv: this.nodeEnv }, meta);
            // Use console.log for all levels to pipe to stdout properly in Docker
            console.log(this.safeStringify(logObject));
        };
        JsonLoggerService_1.prototype.log = function (message, context) {
            this.print('info', message, context);
        };
        JsonLoggerService_1.prototype.error = function (message, trace, context, meta) {
            this.print('error', message, context, __assign({ stack: trace }, meta));
        };
        JsonLoggerService_1.prototype.warn = function (message, context) {
            this.print('warn', message, context);
        };
        JsonLoggerService_1.prototype.debug = function (message, context) {
            this.print('debug', message, context);
        };
        return JsonLoggerService_1;
    }());
    __setFunctionName(_classThis, "JsonLoggerService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        JsonLoggerService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return JsonLoggerService = _classThis;
}();
exports.JsonLoggerService = JsonLoggerService;
