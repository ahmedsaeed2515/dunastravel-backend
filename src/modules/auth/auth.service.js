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
exports.AuthService = exports.getRefreshCookieOptions = exports.getCookieOptions = void 0;
var common_1 = require("@nestjs/common");
var bcrypt = __importStar(require("bcrypt"));
var crypto = __importStar(require("crypto"));
var getCookieOptions = function (nodeEnv) { return ({
    httpOnly: true,
    secure: nodeEnv === 'production',
    sameSite: nodeEnv === 'production' ? 'strict' : 'lax',
    path: '/',
    maxAge: 15 * 60 * 1000, // 15 minutes for access token
}); };
exports.getCookieOptions = getCookieOptions;
var getRefreshCookieOptions = function (nodeEnv) { return ({
    httpOnly: true,
    secure: nodeEnv === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
}); };
exports.getRefreshCookieOptions = getRefreshCookieOptions;
var AuthService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var AuthService = _classThis = /** @class */ (function () {
        function AuthService_1(userService, jwtService, configService, prisma, cacheManager) {
            this.userService = userService;
            this.jwtService = jwtService;
            this.configService = configService;
            this.prisma = prisma;
            this.cacheManager = cacheManager;
            this.logger = new common_1.Logger(AuthService.name);
        }
        AuthService_1.prototype.register = function (dto) {
            return __awaiter(this, void 0, void 0, function () {
                var existingUser, passwordHash, verifyToken, user;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.userService.findByEmail(dto.email)];
                        case 1:
                            existingUser = _a.sent();
                            if (existingUser) {
                                throw new common_1.ConflictException('Email already in use');
                            }
                            return [4 /*yield*/, bcrypt.hash(dto.password, 12)];
                        case 2:
                            passwordHash = _a.sent();
                            verifyToken = crypto.randomBytes(32).toString('hex');
                            return [4 /*yield*/, this.prisma.user.create({
                                    data: {
                                        name: dto.name,
                                        email: dto.email,
                                        phone: dto.phone,
                                        passwordHash: passwordHash,
                                        verifyToken: verifyToken,
                                    },
                                })];
                        case 3:
                            user = _a.sent();
                            this.logger.log("User registered: ".concat(user.email, ". Verification token generated."));
                            // TODO: Send verification email
                            return [2 /*return*/, this.userService.toSafeUser(user)];
                    }
                });
            });
        };
        AuthService_1.prototype.verifyEmail = function (dto) {
            return __awaiter(this, void 0, void 0, function () {
                var user;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.user.findFirst({
                                where: { verifyToken: dto.token, deletedAt: null },
                            })];
                        case 1:
                            user = _a.sent();
                            if (!user) {
                                throw new common_1.BadRequestException('Invalid verification token');
                            }
                            return [4 /*yield*/, this.prisma.user.update({
                                    where: { id: user.id },
                                    data: { isVerified: true, verifyToken: null },
                                })];
                        case 2:
                            _a.sent();
                            return [2 /*return*/, { message: 'Email verified successfully' }];
                    }
                });
            });
        };
        AuthService_1.prototype.login = function (dto, ip) {
            return __awaiter(this, void 0, void 0, function () {
                var lockoutKey, attemptsKey, isLocked, user, isPasswordValid;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            lockoutKey = "login:lockout:".concat(ip, ":").concat(dto.email);
                            attemptsKey = "login:attempts:".concat(ip, ":").concat(dto.email);
                            return [4 /*yield*/, this.cacheManager.get(lockoutKey)];
                        case 1:
                            isLocked = _a.sent();
                            if (isLocked) {
                                throw new common_1.UnauthorizedException('Too many failed login attempts. Please try again later.');
                            }
                            return [4 /*yield*/, this.userService.findByEmail(dto.email)];
                        case 2:
                            user = _a.sent();
                            if (!!user) return [3 /*break*/, 4];
                            return [4 /*yield*/, this.incrementFailedAttempts(attemptsKey, lockoutKey)];
                        case 3:
                            _a.sent();
                            this.logger.warn("Failed login attempt for email: ".concat(dto.email));
                            throw new common_1.UnauthorizedException('Invalid credentials');
                        case 4:
                            if (!user.isVerified) {
                                throw new common_1.UnauthorizedException('Please verify your email before logging in');
                            }
                            return [4 /*yield*/, bcrypt.compare(dto.password, user.passwordHash)];
                        case 5:
                            isPasswordValid = _a.sent();
                            if (!!isPasswordValid) return [3 /*break*/, 7];
                            return [4 /*yield*/, this.incrementFailedAttempts(attemptsKey, lockoutKey)];
                        case 6:
                            _a.sent();
                            this.logger.warn("Failed login attempt for email: ".concat(dto.email));
                            throw new common_1.UnauthorizedException('Invalid credentials');
                        case 7: 
                        // Clear failed attempts on success
                        return [4 /*yield*/, this.cacheManager.del(attemptsKey)];
                        case 8:
                            // Clear failed attempts on success
                            _a.sent();
                            this.logger.log("User logged in: ".concat(user.email));
                            return [2 /*return*/, this.userService.toSafeUser(user)];
                    }
                });
            });
        };
        AuthService_1.prototype.incrementFailedAttempts = function (attemptsKey, lockoutKey) {
            return __awaiter(this, void 0, void 0, function () {
                var attempts;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.cacheManager.get(attemptsKey)];
                        case 1:
                            attempts = (_a.sent()) || 0;
                            attempts += 1;
                            if (!(attempts >= 5)) return [3 /*break*/, 4];
                            return [4 /*yield*/, this.cacheManager.set(lockoutKey, true, 15 * 60 * 1000)];
                        case 2:
                            _a.sent(); // 15 mins
                            return [4 /*yield*/, this.cacheManager.del(attemptsKey)];
                        case 3:
                            _a.sent();
                            return [3 /*break*/, 6];
                        case 4: return [4 /*yield*/, this.cacheManager.set(attemptsKey, attempts, 5 * 60 * 1000)];
                        case 5:
                            _a.sent(); // 5 mins
                            _a.label = 6;
                        case 6: return [2 /*return*/];
                    }
                });
            });
        };
        AuthService_1.prototype.forgotPassword = function (dto) {
            return __awaiter(this, void 0, void 0, function () {
                var user, resetToken, resetTokenExp;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.userService.findByEmail(dto.email)];
                        case 1:
                            user = _a.sent();
                            if (!user) {
                                // Don't reveal that the user does not exist
                                return [2 /*return*/, {
                                        message: 'If that email exists, a password reset link has been sent.',
                                    }];
                            }
                            resetToken = crypto.randomBytes(32).toString('hex');
                            resetTokenExp = new Date(Date.now() + 60 * 60 * 1000);
                            return [4 /*yield*/, this.prisma.user.update({
                                    where: { id: user.id },
                                    data: { resetToken: resetToken, resetTokenExp: resetTokenExp },
                                })];
                        case 2:
                            _a.sent();
                            this.logger.log("Password reset token generated for ".concat(user.email));
                            // TODO: Send password reset email
                            return [2 /*return*/, {
                                    message: 'If that email exists, a password reset link has been sent.',
                                }];
                    }
                });
            });
        };
        AuthService_1.prototype.resetPassword = function (dto) {
            return __awaiter(this, void 0, void 0, function () {
                var user, passwordHash;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.user.findFirst({
                                where: {
                                    resetToken: dto.token,
                                    resetTokenExp: { gt: new Date() },
                                    deletedAt: null,
                                },
                            })];
                        case 1:
                            user = _a.sent();
                            if (!user) {
                                throw new common_1.BadRequestException('Invalid or expired password reset token');
                            }
                            return [4 /*yield*/, bcrypt.hash(dto.newPassword, 12)];
                        case 2:
                            passwordHash = _a.sent();
                            return [4 /*yield*/, this.prisma.user.update({
                                    where: { id: user.id },
                                    data: {
                                        passwordHash: passwordHash,
                                        resetToken: null,
                                        resetTokenExp: null,
                                    },
                                })];
                        case 3:
                            _a.sent();
                            this.logger.log("Password reset successful for user ID: ".concat(user.id));
                            return [2 /*return*/, { message: 'Password has been reset successfully' }];
                    }
                });
            });
        };
        AuthService_1.prototype.generateToken = function (user) {
            var payload = {
                sub: user.id,
                email: user.email,
                role: user.role,
            };
            return this.jwtService.sign(payload, { expiresIn: '15m' });
        };
        AuthService_1.prototype.generateRefreshToken = function (userId) {
            return __awaiter(this, void 0, void 0, function () {
                var refreshToken, hashed;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            refreshToken = this.jwtService.sign({ sub: userId }, {
                                secret: this.configService.get('JWT_REFRESH_SECRET'),
                                expiresIn: '7d',
                            });
                            return [4 /*yield*/, bcrypt.hash(refreshToken, 10)];
                        case 1:
                            hashed = _a.sent();
                            return [4 /*yield*/, this.userService.updateRefreshToken(userId, hashed)];
                        case 2:
                            _a.sent();
                            return [2 /*return*/, refreshToken];
                    }
                });
            });
        };
        AuthService_1.prototype.refresh = function (token) {
            return __awaiter(this, void 0, void 0, function () {
                var payload, user, isRefreshTokenValid, safeUser, accessToken, newRefreshToken, e_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 4, , 5]);
                            payload = this.jwtService.verify(token, {
                                secret: this.configService.get('JWT_REFRESH_SECRET'),
                            });
                            return [4 /*yield*/, this.userService.findById(payload.sub)];
                        case 1:
                            user = _a.sent();
                            if (!user || !user.refreshToken) {
                                throw new common_1.UnauthorizedException('Invalid refresh token');
                            }
                            return [4 /*yield*/, bcrypt.compare(token, user.refreshToken)];
                        case 2:
                            isRefreshTokenValid = _a.sent();
                            if (!isRefreshTokenValid) {
                                throw new common_1.UnauthorizedException('Invalid refresh token');
                            }
                            safeUser = this.userService.toSafeUser(user);
                            accessToken = this.generateToken(safeUser);
                            return [4 /*yield*/, this.generateRefreshToken(user.id)];
                        case 3:
                            newRefreshToken = _a.sent();
                            return [2 /*return*/, { user: safeUser, accessToken: accessToken, refreshToken: newRefreshToken }];
                        case 4:
                            e_1 = _a.sent();
                            throw new common_1.UnauthorizedException('Invalid or expired refresh token');
                        case 5: return [2 /*return*/];
                    }
                });
            });
        };
        AuthService_1.prototype.clearRefreshToken = function (userId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.userService.updateRefreshToken(userId, null)];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        AuthService_1.prototype.getMe = function (userId) {
            return __awaiter(this, void 0, void 0, function () {
                var user;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.userService.findById(userId)];
                        case 1:
                            user = _a.sent();
                            if (!user) {
                                throw new common_1.UnauthorizedException();
                            }
                            return [2 /*return*/, this.userService.toSafeUser(user)];
                    }
                });
            });
        };
        AuthService_1.prototype.changePassword = function (userId, dto) {
            return __awaiter(this, void 0, void 0, function () {
                var user, isPasswordValid, passwordHash;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.user.findUnique({ where: { id: userId } })];
                        case 1:
                            user = _a.sent();
                            if (!user)
                                throw new common_1.UnauthorizedException('User not found');
                            return [4 /*yield*/, bcrypt.compare(dto.oldPassword, user.passwordHash)];
                        case 2:
                            isPasswordValid = _a.sent();
                            if (!isPasswordValid)
                                throw new common_1.BadRequestException('Invalid old password');
                            return [4 /*yield*/, bcrypt.hash(dto.newPassword, 12)];
                        case 3:
                            passwordHash = _a.sent();
                            return [4 /*yield*/, this.prisma.user.update({
                                    where: { id: userId },
                                    data: { passwordHash: passwordHash },
                                })];
                        case 4:
                            _a.sent();
                            return [2 /*return*/, { message: 'Password changed successfully' }];
                    }
                });
            });
        };
        AuthService_1.prototype.resendVerification = function (dto) {
            return __awaiter(this, void 0, void 0, function () {
                var user, verifyToken;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.user.findUnique({ where: { email: dto.email } })];
                        case 1:
                            user = _a.sent();
                            if (!user)
                                return [2 /*return*/, { message: 'If that email is registered, a verification link has been sent.' }];
                            if (user.isVerified)
                                return [2 /*return*/, { message: 'Email is already verified.' }];
                            verifyToken = crypto.randomBytes(32).toString('hex');
                            return [4 /*yield*/, this.prisma.user.update({
                                    where: { id: user.id },
                                    data: { verifyToken: verifyToken },
                                })];
                        case 2:
                            _a.sent();
                            this.logger.log("Resent verification email for: ".concat(user.email));
                            // TODO: send email
                            return [2 /*return*/, { message: 'If that email is registered, a verification link has been sent.' }];
                    }
                });
            });
        };
        return AuthService_1;
    }());
    __setFunctionName(_classThis, "AuthService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AuthService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AuthService = _classThis;
}();
exports.AuthService = AuthService;
