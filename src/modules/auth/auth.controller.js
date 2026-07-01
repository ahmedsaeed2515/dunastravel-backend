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
exports.AuthController = void 0;
var common_1 = require("@nestjs/common");
var swagger_1 = require("@nestjs/swagger");
var throttler_1 = require("@nestjs/throttler");
var auth_service_1 = require("./auth.service");
var decorators_1 = require("../../common/decorators");
var guards_1 = require("../../common/guards");
var AuthController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('Auth'), (0, common_1.Controller)('auth'), (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60000 } })];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _register_decorators;
    var _login_decorators;
    var _refresh_decorators;
    var _logout_decorators;
    var _getMe_decorators;
    var _getCsrfToken_decorators;
    var _forgotPassword_decorators;
    var _resetPassword_decorators;
    var _verifyEmail_decorators;
    var _changePassword_decorators;
    var _resendVerification_decorators;
    var _logoutAll_decorators;
    var AuthController = _classThis = /** @class */ (function () {
        function AuthController_1(authService, configService) {
            this.authService = (__runInitializers(this, _instanceExtraInitializers), authService);
            this.configService = configService;
        }
        AuthController_1.prototype.register = function (dto, res) {
            return __awaiter(this, void 0, void 0, function () {
                var user, token, refreshToken, nodeEnv;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.authService.register(dto)];
                        case 1:
                            user = _a.sent();
                            token = this.authService.generateToken(user);
                            return [4 /*yield*/, this.authService.generateRefreshToken(user.id)];
                        case 2:
                            refreshToken = _a.sent();
                            nodeEnv = this.configService.get('nodeEnv') || 'development';
                            res.cookie('access_token', token, (0, auth_service_1.getCookieOptions)(nodeEnv));
                            res.cookie('refresh_token', refreshToken, (0, auth_service_1.getRefreshCookieOptions)(nodeEnv));
                            return [2 /*return*/, user];
                    }
                });
            });
        };
        AuthController_1.prototype.login = function (req, dto, res) {
            return __awaiter(this, void 0, void 0, function () {
                var user, token, refreshToken, nodeEnv;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.authService.login(dto, req.ip || 'unknown')];
                        case 1:
                            user = _a.sent();
                            token = this.authService.generateToken(user);
                            return [4 /*yield*/, this.authService.generateRefreshToken(user.id)];
                        case 2:
                            refreshToken = _a.sent();
                            nodeEnv = this.configService.get('nodeEnv') || 'development';
                            res.cookie('access_token', token, (0, auth_service_1.getCookieOptions)(nodeEnv));
                            res.cookie('refresh_token', refreshToken, (0, auth_service_1.getRefreshCookieOptions)(nodeEnv));
                            return [2 /*return*/, user];
                    }
                });
            });
        };
        AuthController_1.prototype.refresh = function (req, res) {
            return __awaiter(this, void 0, void 0, function () {
                var oldRefreshToken, _a, user, accessToken, refreshToken, nodeEnv;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            oldRefreshToken = req.cookies['refresh_token'];
                            if (!oldRefreshToken) {
                                throw new common_1.UnauthorizedException('No refresh token provided');
                            }
                            return [4 /*yield*/, this.authService.refresh(oldRefreshToken)];
                        case 1:
                            _a = _b.sent(), user = _a.user, accessToken = _a.accessToken, refreshToken = _a.refreshToken;
                            nodeEnv = this.configService.get('nodeEnv') || 'development';
                            res.cookie('access_token', accessToken, (0, auth_service_1.getCookieOptions)(nodeEnv));
                            res.cookie('refresh_token', refreshToken, (0, auth_service_1.getRefreshCookieOptions)(nodeEnv));
                            return [2 /*return*/, { message: 'Token refreshed successfully' }];
                    }
                });
            });
        };
        AuthController_1.prototype.logout = function (user, res) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.authService.clearRefreshToken(user.id)];
                        case 1:
                            _a.sent();
                            res.clearCookie('access_token', { path: '/' });
                            res.clearCookie('refresh_token', { path: '/' });
                            return [2 /*return*/, { message: 'Logged out successfully' }];
                    }
                });
            });
        };
        AuthController_1.prototype.getMe = function (user) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.authService.getMe(user.id)];
                });
            });
        };
        AuthController_1.prototype.getCsrfToken = function (res) {
            // Generate a random 32 byte hex string
            var crypto = require('crypto');
            var token = crypto.randomBytes(32).toString('hex');
            var nodeEnv = this.configService.get('nodeEnv') || 'development';
            res.cookie('csrf_token', token, {
                httpOnly: false, // Must be readable by frontend JavaScript
                secure: nodeEnv === 'production',
                sameSite: 'strict',
                path: '/',
            });
            return { csrfToken: token };
        };
        AuthController_1.prototype.forgotPassword = function (dto) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.authService.forgotPassword(dto)];
                });
            });
        };
        AuthController_1.prototype.resetPassword = function (dto) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.authService.resetPassword(dto)];
                });
            });
        };
        AuthController_1.prototype.verifyEmail = function (dto) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.authService.verifyEmail(dto)];
                });
            });
        };
        AuthController_1.prototype.changePassword = function (user, dto) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.authService.changePassword(user.id, dto)];
                });
            });
        };
        AuthController_1.prototype.resendVerification = function (dto) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.authService.resendVerification(dto)];
                });
            });
        };
        AuthController_1.prototype.logoutAll = function (user, res) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.authService.clearRefreshToken(user.id)];
                        case 1:
                            _a.sent();
                            res.clearCookie('access_token');
                            res.clearCookie('refresh_token');
                            return [2 /*return*/, { message: 'Logged out from all devices successfully' }];
                    }
                });
            });
        };
        return AuthController_1;
    }());
    __setFunctionName(_classThis, "AuthController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _register_decorators = [(0, decorators_1.Public)(), (0, common_1.Post)('register'), (0, common_1.HttpCode)(201), (0, swagger_1.ApiOperation)({ summary: 'Register a new user' }), (0, swagger_1.ApiCreatedResponse)(), (0, swagger_1.ApiConflictResponse)()];
        _login_decorators = [(0, decorators_1.Public)(), (0, common_1.Post)('login'), (0, common_1.HttpCode)(200), (0, swagger_1.ApiOperation)({ summary: 'Login' }), (0, swagger_1.ApiOkResponse)(), (0, swagger_1.ApiUnauthorizedResponse)()];
        _refresh_decorators = [(0, decorators_1.Public)(), (0, common_1.Post)('refresh'), (0, common_1.HttpCode)(200), (0, swagger_1.ApiOperation)({ summary: 'Refresh access token' }), (0, swagger_1.ApiOkResponse)(), (0, swagger_1.ApiUnauthorizedResponse)()];
        _logout_decorators = [(0, common_1.UseGuards)(guards_1.JwtAuthGuard), (0, common_1.Post)('logout'), (0, common_1.HttpCode)(200), (0, swagger_1.ApiOperation)({ summary: 'Logout' }), (0, swagger_1.ApiOkResponse)()];
        _getMe_decorators = [(0, common_1.UseGuards)(guards_1.JwtAuthGuard), (0, common_1.Get)('me'), (0, common_1.HttpCode)(200), (0, swagger_1.ApiOperation)({ summary: 'Get current user profile' }), (0, swagger_1.ApiOkResponse)()];
        _getCsrfToken_decorators = [(0, decorators_1.Public)(), (0, common_1.Get)('csrf'), (0, common_1.HttpCode)(200), (0, swagger_1.ApiOperation)({ summary: 'Get CSRF token' }), (0, swagger_1.ApiOkResponse)()];
        _forgotPassword_decorators = [(0, decorators_1.Public)(), (0, common_1.Post)('forgot-password'), (0, common_1.HttpCode)(200), (0, swagger_1.ApiOperation)({ summary: 'Request password reset' }), (0, swagger_1.ApiOkResponse)()];
        _resetPassword_decorators = [(0, decorators_1.Public)(), (0, common_1.Post)('reset-password'), (0, common_1.HttpCode)(200), (0, swagger_1.ApiOperation)({ summary: 'Reset password using token' }), (0, swagger_1.ApiOkResponse)()];
        _verifyEmail_decorators = [(0, decorators_1.Public)(), (0, common_1.Post)('verify-email'), (0, common_1.HttpCode)(200), (0, swagger_1.ApiOperation)({ summary: 'Verify user email' }), (0, swagger_1.ApiOkResponse)()];
        _changePassword_decorators = [(0, common_1.Post)('change-password'), (0, common_1.UseGuards)(guards_1.JwtAuthGuard), (0, common_1.HttpCode)(200), (0, swagger_1.ApiOperation)({ summary: 'Change password' })];
        _resendVerification_decorators = [(0, decorators_1.Public)(), (0, common_1.Post)('resend-verification'), (0, common_1.HttpCode)(200), (0, swagger_1.ApiOperation)({ summary: 'Resend verification email' })];
        _logoutAll_decorators = [(0, common_1.Post)('logout-all'), (0, common_1.UseGuards)(guards_1.JwtAuthGuard), (0, common_1.HttpCode)(200), (0, swagger_1.ApiOperation)({ summary: 'Logout from all devices' })];
        __esDecorate(_classThis, null, _register_decorators, { kind: "method", name: "register", static: false, private: false, access: { has: function (obj) { return "register" in obj; }, get: function (obj) { return obj.register; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _login_decorators, { kind: "method", name: "login", static: false, private: false, access: { has: function (obj) { return "login" in obj; }, get: function (obj) { return obj.login; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _refresh_decorators, { kind: "method", name: "refresh", static: false, private: false, access: { has: function (obj) { return "refresh" in obj; }, get: function (obj) { return obj.refresh; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _logout_decorators, { kind: "method", name: "logout", static: false, private: false, access: { has: function (obj) { return "logout" in obj; }, get: function (obj) { return obj.logout; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getMe_decorators, { kind: "method", name: "getMe", static: false, private: false, access: { has: function (obj) { return "getMe" in obj; }, get: function (obj) { return obj.getMe; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getCsrfToken_decorators, { kind: "method", name: "getCsrfToken", static: false, private: false, access: { has: function (obj) { return "getCsrfToken" in obj; }, get: function (obj) { return obj.getCsrfToken; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _forgotPassword_decorators, { kind: "method", name: "forgotPassword", static: false, private: false, access: { has: function (obj) { return "forgotPassword" in obj; }, get: function (obj) { return obj.forgotPassword; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _resetPassword_decorators, { kind: "method", name: "resetPassword", static: false, private: false, access: { has: function (obj) { return "resetPassword" in obj; }, get: function (obj) { return obj.resetPassword; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _verifyEmail_decorators, { kind: "method", name: "verifyEmail", static: false, private: false, access: { has: function (obj) { return "verifyEmail" in obj; }, get: function (obj) { return obj.verifyEmail; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _changePassword_decorators, { kind: "method", name: "changePassword", static: false, private: false, access: { has: function (obj) { return "changePassword" in obj; }, get: function (obj) { return obj.changePassword; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _resendVerification_decorators, { kind: "method", name: "resendVerification", static: false, private: false, access: { has: function (obj) { return "resendVerification" in obj; }, get: function (obj) { return obj.resendVerification; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _logoutAll_decorators, { kind: "method", name: "logoutAll", static: false, private: false, access: { has: function (obj) { return "logoutAll" in obj; }, get: function (obj) { return obj.logoutAll; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AuthController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AuthController = _classThis;
}();
exports.AuthController = AuthController;
