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
exports.AiService = void 0;
var common_1 = require("@nestjs/common");
var sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
var AiService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var AiService = _classThis = /** @class */ (function () {
        function AiService_1(configService, prisma) {
            this.configService = configService;
            this.prisma = prisma;
            this.logger = new common_1.Logger(AiService.name);
            var apiKey = this.configService.get('ANTHROPIC_API_KEY');
            if (apiKey) {
                this.anthropic = new sdk_1.default({ apiKey: apiKey });
                this.isConfigured = true;
            }
            else {
                this.logger.warn('ANTHROPIC_API_KEY is not set. AI Features will return mocked responses.');
                this.isConfigured = false;
            }
        }
        AiService_1.prototype.generateItinerary = function (dto) {
            return __awaiter(this, void 0, void 0, function () {
                var prompt_1, response, content, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.isConfigured) {
                                return [2 /*return*/, this.mockItinerary(dto)];
                            }
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            prompt_1 = "Act as a luxury travel concierge for Dunas Travel (an elite B2B and B2C travel agency).\nGenerate a ".concat(dto.days, "-day structured itinerary for ").concat(dto.destinations.join(', '), ".\nTravelers: ").concat(dto.pax || 2, ". Budget: ").concat(dto.budgetUsd ? '$' + dto.budgetUsd : 'Luxury', ".\nPreferences: ").concat(dto.preferences || 'None', ".\n\nReturn ONLY valid JSON matching this structure:\n{\n  \"title\": \"...\",\n  \"description\": \"...\",\n  \"days\": [\n    {\n      \"dayNumber\": 1,\n      \"location\": \"...\",\n      \"morning\": \"...\",\n      \"afternoon\": \"...\",\n      \"evening\": \"...\",\n      \"hotelRecommendation\": \"...\"\n    }\n  ]\n}");
                            return [4 /*yield*/, this.anthropic.messages.create({
                                    model: 'claude-3-haiku-20240307',
                                    max_tokens: 1500,
                                    temperature: 0.7,
                                    system: 'You are a senior luxury travel designer. Return ONLY raw JSON without any markdown formatting.',
                                    messages: [{ role: 'user', content: prompt_1 }],
                                })];
                        case 2:
                            response = _a.sent();
                            content = response.content[0].type === 'text' ? response.content[0].text : '{}';
                            return [2 /*return*/, JSON.parse(content)];
                        case 3:
                            error_1 = _a.sent();
                            this.logger.error("Failed to generate itinerary: ".concat(error_1.message));
                            throw new Error('Failed to generate AI itinerary. Please try again.');
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        AiService_1.prototype.analyzeCustomer = function (customerId) {
            return __awaiter(this, void 0, void 0, function () {
                var user, bookingsSummary, notesSummary, prompt_2, response, content, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.user.findUnique({
                                where: { id: customerId },
                                include: {
                                    bookings: {
                                        include: { tour: true },
                                    },
                                    customerNotes: true,
                                },
                            })];
                        case 1:
                            user = _a.sent();
                            if (!user) {
                                throw new common_1.NotFoundException('Customer not found');
                            }
                            bookingsSummary = user.bookings
                                .map(function (b) { return "".concat(b.tour.country, " (").concat(b.tour.category, ") - $").concat(b.totalAmountUsd); })
                                .join(', ');
                            notesSummary = user.customerNotes.map(function (n) { return n.content; }).join(' | ');
                            if (!this.isConfigured) {
                                return [2 /*return*/, {
                                        summary: "".concat(user.name, " is a valued customer with past travels including: ").concat(bookingsSummary || 'None', "."),
                                        suggestedDestinations: ['Maldives', 'Dubai', 'Swiss Alps'],
                                        salesStrategy: 'Focus on wellness and exclusive private tours.',
                                        churnRisk: 'Low',
                                    }];
                            }
                            _a.label = 2;
                        case 2:
                            _a.trys.push([2, 4, , 5]);
                            prompt_2 = "Analyze this luxury travel customer profile and provide actionable CRM insights.\nCustomer Name: ".concat(user.name, "\nPreferred Destination: ").concat(user.preferredDestination || 'Unknown', "\nTags: ").concat(user.tags.join(', ') || 'None', "\nPast Bookings: ").concat(bookingsSummary || 'No past bookings', "\nInternal Agent Notes: ").concat(notesSummary || 'No notes', "\n\nReturn ONLY valid JSON matching this structure:\n{\n  \"summary\": \"2 sentence executive summary of the client\",\n  \"suggestedDestinations\": [\"Dest 1\", \"Dest 2\", \"Dest 3\"],\n  \"salesStrategy\": \"1 paragraph on how to pitch the next trip\",\n  \"churnRisk\": \"Low / Medium / High\"\n}");
                            return [4 /*yield*/, this.anthropic.messages.create({
                                    model: 'claude-3-haiku-20240307',
                                    max_tokens: 1000,
                                    temperature: 0.5,
                                    system: 'You are a luxury travel CRM strategist. Return ONLY raw JSON without markdown.',
                                    messages: [{ role: 'user', content: prompt_2 }],
                                })];
                        case 3:
                            response = _a.sent();
                            content = response.content[0].type === 'text' ? response.content[0].text : '{}';
                            return [2 /*return*/, JSON.parse(content)];
                        case 4:
                            error_2 = _a.sent();
                            this.logger.error("Failed to analyze customer: ".concat(error_2.message));
                            throw new Error('Failed to analyze customer data.');
                        case 5: return [2 /*return*/];
                    }
                });
            });
        };
        AiService_1.prototype.mockItinerary = function (dto) {
            return {
                title: "Luxury Escape to ".concat(dto.destinations.join(' & ')),
                description: 'An exclusive, hand-crafted journey (Mock Data)',
                days: Array.from({ length: dto.days }).map(function (_, i) { return ({
                    dayNumber: i + 1,
                    location: dto.destinations[0] || 'Unknown',
                    morning: 'Private guided tour of historical landmarks.',
                    afternoon: 'Exclusive culinary experience.',
                    evening: 'Sunset cruise with champagne.',
                    hotelRecommendation: 'Four Seasons or similar 5-star property',
                }); }),
            };
        };
        return AiService_1;
    }());
    __setFunctionName(_classThis, "AiService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AiService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AiService = _classThis;
}();
exports.AiService = AiService;
