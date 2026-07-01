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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateTourDto = exports.CreateTourImageDto = exports.CreateTourItineraryDto = void 0;
var swagger_1 = require("@nestjs/swagger");
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var CreateTourItineraryDto = function () {
    var _a;
    var _dayLabel_decorators;
    var _dayLabel_initializers = [];
    var _dayLabel_extraInitializers = [];
    var _descriptionJsonb_decorators;
    var _descriptionJsonb_initializers = [];
    var _descriptionJsonb_extraInitializers = [];
    var _mealsJsonb_decorators;
    var _mealsJsonb_initializers = [];
    var _mealsJsonb_extraInitializers = [];
    var _activitiesJsonb_decorators;
    var _activitiesJsonb_initializers = [];
    var _activitiesJsonb_extraInitializers = [];
    var _hotelsJsonb_decorators;
    var _hotelsJsonb_initializers = [];
    var _hotelsJsonb_extraInitializers = [];
    var _transportationJsonb_decorators;
    var _transportationJsonb_initializers = [];
    var _transportationJsonb_extraInitializers = [];
    var _notesJsonb_decorators;
    var _notesJsonb_initializers = [];
    var _notesJsonb_extraInitializers = [];
    var _sortOrder_decorators;
    var _sortOrder_initializers = [];
    var _sortOrder_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateTourItineraryDto() {
                this.dayLabel = __runInitializers(this, _dayLabel_initializers, void 0);
                this.descriptionJsonb = (__runInitializers(this, _dayLabel_extraInitializers), __runInitializers(this, _descriptionJsonb_initializers, void 0));
                this.mealsJsonb = (__runInitializers(this, _descriptionJsonb_extraInitializers), __runInitializers(this, _mealsJsonb_initializers, void 0));
                this.activitiesJsonb = (__runInitializers(this, _mealsJsonb_extraInitializers), __runInitializers(this, _activitiesJsonb_initializers, void 0));
                this.hotelsJsonb = (__runInitializers(this, _activitiesJsonb_extraInitializers), __runInitializers(this, _hotelsJsonb_initializers, void 0));
                this.transportationJsonb = (__runInitializers(this, _hotelsJsonb_extraInitializers), __runInitializers(this, _transportationJsonb_initializers, void 0));
                this.notesJsonb = (__runInitializers(this, _transportationJsonb_extraInitializers), __runInitializers(this, _notesJsonb_initializers, void 0));
                this.sortOrder = (__runInitializers(this, _notesJsonb_extraInitializers), __runInitializers(this, _sortOrder_initializers, void 0));
                __runInitializers(this, _sortOrder_extraInitializers);
            }
            return CreateTourItineraryDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _dayLabel_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Day label, e.g., Day 1: Arrival' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _descriptionJsonb_decorators = [(0, swagger_1.ApiProperty)({ description: 'Multilingual description object' }), (0, class_validator_1.IsObject)(), (0, class_validator_1.IsNotEmpty)()];
            _mealsJsonb_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Multilingual meals info' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)()];
            _activitiesJsonb_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Multilingual activities info' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)()];
            _hotelsJsonb_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Multilingual hotel accommodations' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)()];
            _transportationJsonb_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Multilingual transportation info' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)()];
            _notesJsonb_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    description: 'Multilingual internal/operational notes',
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)()];
            _sortOrder_decorators = [(0, swagger_1.ApiProperty)({ description: 'Display order' }), (0, class_validator_1.IsNumber)(), (0, class_transformer_1.Type)(function () { return Number; })];
            __esDecorate(null, null, _dayLabel_decorators, { kind: "field", name: "dayLabel", static: false, private: false, access: { has: function (obj) { return "dayLabel" in obj; }, get: function (obj) { return obj.dayLabel; }, set: function (obj, value) { obj.dayLabel = value; } }, metadata: _metadata }, _dayLabel_initializers, _dayLabel_extraInitializers);
            __esDecorate(null, null, _descriptionJsonb_decorators, { kind: "field", name: "descriptionJsonb", static: false, private: false, access: { has: function (obj) { return "descriptionJsonb" in obj; }, get: function (obj) { return obj.descriptionJsonb; }, set: function (obj, value) { obj.descriptionJsonb = value; } }, metadata: _metadata }, _descriptionJsonb_initializers, _descriptionJsonb_extraInitializers);
            __esDecorate(null, null, _mealsJsonb_decorators, { kind: "field", name: "mealsJsonb", static: false, private: false, access: { has: function (obj) { return "mealsJsonb" in obj; }, get: function (obj) { return obj.mealsJsonb; }, set: function (obj, value) { obj.mealsJsonb = value; } }, metadata: _metadata }, _mealsJsonb_initializers, _mealsJsonb_extraInitializers);
            __esDecorate(null, null, _activitiesJsonb_decorators, { kind: "field", name: "activitiesJsonb", static: false, private: false, access: { has: function (obj) { return "activitiesJsonb" in obj; }, get: function (obj) { return obj.activitiesJsonb; }, set: function (obj, value) { obj.activitiesJsonb = value; } }, metadata: _metadata }, _activitiesJsonb_initializers, _activitiesJsonb_extraInitializers);
            __esDecorate(null, null, _hotelsJsonb_decorators, { kind: "field", name: "hotelsJsonb", static: false, private: false, access: { has: function (obj) { return "hotelsJsonb" in obj; }, get: function (obj) { return obj.hotelsJsonb; }, set: function (obj, value) { obj.hotelsJsonb = value; } }, metadata: _metadata }, _hotelsJsonb_initializers, _hotelsJsonb_extraInitializers);
            __esDecorate(null, null, _transportationJsonb_decorators, { kind: "field", name: "transportationJsonb", static: false, private: false, access: { has: function (obj) { return "transportationJsonb" in obj; }, get: function (obj) { return obj.transportationJsonb; }, set: function (obj, value) { obj.transportationJsonb = value; } }, metadata: _metadata }, _transportationJsonb_initializers, _transportationJsonb_extraInitializers);
            __esDecorate(null, null, _notesJsonb_decorators, { kind: "field", name: "notesJsonb", static: false, private: false, access: { has: function (obj) { return "notesJsonb" in obj; }, get: function (obj) { return obj.notesJsonb; }, set: function (obj, value) { obj.notesJsonb = value; } }, metadata: _metadata }, _notesJsonb_initializers, _notesJsonb_extraInitializers);
            __esDecorate(null, null, _sortOrder_decorators, { kind: "field", name: "sortOrder", static: false, private: false, access: { has: function (obj) { return "sortOrder" in obj; }, get: function (obj) { return obj.sortOrder; }, set: function (obj, value) { obj.sortOrder = value; } }, metadata: _metadata }, _sortOrder_initializers, _sortOrder_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateTourItineraryDto = CreateTourItineraryDto;
var CreateTourImageDto = function () {
    var _a;
    var _imageUrl_decorators;
    var _imageUrl_initializers = [];
    var _imageUrl_extraInitializers = [];
    var _isHero_decorators;
    var _isHero_initializers = [];
    var _isHero_extraInitializers = [];
    var _isVideo_decorators;
    var _isVideo_initializers = [];
    var _isVideo_extraInitializers = [];
    var _videoUrl_decorators;
    var _videoUrl_initializers = [];
    var _videoUrl_extraInitializers = [];
    var _altText_decorators;
    var _altText_initializers = [];
    var _altText_extraInitializers = [];
    var _sortOrder_decorators;
    var _sortOrder_initializers = [];
    var _sortOrder_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateTourImageDto() {
                this.imageUrl = __runInitializers(this, _imageUrl_initializers, void 0);
                this.isHero = (__runInitializers(this, _imageUrl_extraInitializers), __runInitializers(this, _isHero_initializers, void 0));
                this.isVideo = (__runInitializers(this, _isHero_extraInitializers), __runInitializers(this, _isVideo_initializers, void 0));
                this.videoUrl = (__runInitializers(this, _isVideo_extraInitializers), __runInitializers(this, _videoUrl_initializers, void 0));
                this.altText = (__runInitializers(this, _videoUrl_extraInitializers), __runInitializers(this, _altText_initializers, void 0));
                this.sortOrder = (__runInitializers(this, _altText_extraInitializers), __runInitializers(this, _sortOrder_initializers, void 0));
                __runInitializers(this, _sortOrder_extraInitializers);
            }
            return CreateTourImageDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _imageUrl_decorators = [(0, swagger_1.ApiProperty)({ description: 'Image URL' }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _isHero_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Is primary hero image', default: false }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
            _isVideo_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Is video asset', default: false }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
            _videoUrl_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Video URL if isVideo is true' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _altText_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Alt text' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _sortOrder_decorators = [(0, swagger_1.ApiProperty)({ description: 'Display sort order' }), (0, class_validator_1.IsNumber)(), (0, class_transformer_1.Type)(function () { return Number; })];
            __esDecorate(null, null, _imageUrl_decorators, { kind: "field", name: "imageUrl", static: false, private: false, access: { has: function (obj) { return "imageUrl" in obj; }, get: function (obj) { return obj.imageUrl; }, set: function (obj, value) { obj.imageUrl = value; } }, metadata: _metadata }, _imageUrl_initializers, _imageUrl_extraInitializers);
            __esDecorate(null, null, _isHero_decorators, { kind: "field", name: "isHero", static: false, private: false, access: { has: function (obj) { return "isHero" in obj; }, get: function (obj) { return obj.isHero; }, set: function (obj, value) { obj.isHero = value; } }, metadata: _metadata }, _isHero_initializers, _isHero_extraInitializers);
            __esDecorate(null, null, _isVideo_decorators, { kind: "field", name: "isVideo", static: false, private: false, access: { has: function (obj) { return "isVideo" in obj; }, get: function (obj) { return obj.isVideo; }, set: function (obj, value) { obj.isVideo = value; } }, metadata: _metadata }, _isVideo_initializers, _isVideo_extraInitializers);
            __esDecorate(null, null, _videoUrl_decorators, { kind: "field", name: "videoUrl", static: false, private: false, access: { has: function (obj) { return "videoUrl" in obj; }, get: function (obj) { return obj.videoUrl; }, set: function (obj, value) { obj.videoUrl = value; } }, metadata: _metadata }, _videoUrl_initializers, _videoUrl_extraInitializers);
            __esDecorate(null, null, _altText_decorators, { kind: "field", name: "altText", static: false, private: false, access: { has: function (obj) { return "altText" in obj; }, get: function (obj) { return obj.altText; }, set: function (obj, value) { obj.altText = value; } }, metadata: _metadata }, _altText_initializers, _altText_extraInitializers);
            __esDecorate(null, null, _sortOrder_decorators, { kind: "field", name: "sortOrder", static: false, private: false, access: { has: function (obj) { return "sortOrder" in obj; }, get: function (obj) { return obj.sortOrder; }, set: function (obj, value) { obj.sortOrder = value; } }, metadata: _metadata }, _sortOrder_initializers, _sortOrder_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateTourImageDto = CreateTourImageDto;
var CreateTourDto = function () {
    var _a;
    var _slug_decorators;
    var _slug_initializers = [];
    var _slug_extraInitializers = [];
    var _titleJsonb_decorators;
    var _titleJsonb_initializers = [];
    var _titleJsonb_extraInitializers = [];
    var _category_decorators;
    var _category_initializers = [];
    var _category_extraInitializers = [];
    var _basePriceUsd_decorators;
    var _basePriceUsd_initializers = [];
    var _basePriceUsd_extraInitializers = [];
    var _durationJsonb_decorators;
    var _durationJsonb_initializers = [];
    var _durationJsonb_extraInitializers = [];
    var _overviewJsonb_decorators;
    var _overviewJsonb_initializers = [];
    var _overviewJsonb_extraInitializers = [];
    var _minPaxJsonb_decorators;
    var _minPaxJsonb_initializers = [];
    var _minPaxJsonb_extraInitializers = [];
    var _isActive_decorators;
    var _isActive_initializers = [];
    var _isActive_extraInitializers = [];
    var _country_decorators;
    var _country_initializers = [];
    var _country_extraInitializers = [];
    var _city_decorators;
    var _city_initializers = [];
    var _city_extraInitializers = [];
    var _region_decorators;
    var _region_initializers = [];
    var _region_extraInitializers = [];
    var _meetingPoint_decorators;
    var _meetingPoint_initializers = [];
    var _meetingPoint_extraInitializers = [];
    var _departureTime_decorators;
    var _departureTime_initializers = [];
    var _departureTime_extraInitializers = [];
    var _returnTime_decorators;
    var _returnTime_initializers = [];
    var _returnTime_extraInitializers = [];
    var _isFeatured_decorators;
    var _isFeatured_initializers = [];
    var _isFeatured_extraInitializers = [];
    var _status_decorators;
    var _status_initializers = [];
    var _status_extraInitializers = [];
    var _seoTitle_decorators;
    var _seoTitle_initializers = [];
    var _seoTitle_extraInitializers = [];
    var _seoDescription_decorators;
    var _seoDescription_initializers = [];
    var _seoDescription_extraInitializers = [];
    var _includedServicesJsonb_decorators;
    var _includedServicesJsonb_initializers = [];
    var _includedServicesJsonb_extraInitializers = [];
    var _excludedServicesJsonb_decorators;
    var _excludedServicesJsonb_initializers = [];
    var _excludedServicesJsonb_extraInitializers = [];
    var _hotelInfoJsonb_decorators;
    var _hotelInfoJsonb_initializers = [];
    var _hotelInfoJsonb_extraInitializers = [];
    var _transportationJsonb_decorators;
    var _transportationJsonb_initializers = [];
    var _transportationJsonb_extraInitializers = [];
    var _pickupLocationsJsonb_decorators;
    var _pickupLocationsJsonb_initializers = [];
    var _pickupLocationsJsonb_extraInitializers = [];
    var _languages_decorators;
    var _languages_initializers = [];
    var _languages_extraInitializers = [];
    var _difficultyLevel_decorators;
    var _difficultyLevel_initializers = [];
    var _difficultyLevel_extraInitializers = [];
    var _ageRestrictions_decorators;
    var _ageRestrictions_initializers = [];
    var _ageRestrictions_extraInitializers = [];
    var _cancellationPolicyJsonb_decorators;
    var _cancellationPolicyJsonb_initializers = [];
    var _cancellationPolicyJsonb_extraInitializers = [];
    var _termsJsonb_decorators;
    var _termsJsonb_initializers = [];
    var _termsJsonb_extraInitializers = [];
    var _tags_decorators;
    var _tags_initializers = [];
    var _tags_extraInitializers = [];
    var _capacity_decorators;
    var _capacity_initializers = [];
    var _capacity_extraInitializers = [];
    var _remainingSeats_decorators;
    var _remainingSeats_initializers = [];
    var _remainingSeats_extraInitializers = [];
    var _seasonPricingJsonb_decorators;
    var _seasonPricingJsonb_initializers = [];
    var _seasonPricingJsonb_extraInitializers = [];
    var _currency_decorators;
    var _currency_initializers = [];
    var _currency_extraInitializers = [];
    var _itineraries_decorators;
    var _itineraries_initializers = [];
    var _itineraries_extraInitializers = [];
    var _images_decorators;
    var _images_initializers = [];
    var _images_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateTourDto() {
                this.slug = __runInitializers(this, _slug_initializers, void 0);
                this.titleJsonb = (__runInitializers(this, _slug_extraInitializers), __runInitializers(this, _titleJsonb_initializers, void 0));
                this.category = (__runInitializers(this, _titleJsonb_extraInitializers), __runInitializers(this, _category_initializers, void 0));
                this.basePriceUsd = (__runInitializers(this, _category_extraInitializers), __runInitializers(this, _basePriceUsd_initializers, void 0));
                this.durationJsonb = (__runInitializers(this, _basePriceUsd_extraInitializers), __runInitializers(this, _durationJsonb_initializers, void 0));
                this.overviewJsonb = (__runInitializers(this, _durationJsonb_extraInitializers), __runInitializers(this, _overviewJsonb_initializers, void 0));
                this.minPaxJsonb = (__runInitializers(this, _overviewJsonb_extraInitializers), __runInitializers(this, _minPaxJsonb_initializers, void 0));
                this.isActive = (__runInitializers(this, _minPaxJsonb_extraInitializers), __runInitializers(this, _isActive_initializers, void 0));
                this.country = (__runInitializers(this, _isActive_extraInitializers), __runInitializers(this, _country_initializers, void 0));
                this.city = (__runInitializers(this, _country_extraInitializers), __runInitializers(this, _city_initializers, void 0));
                this.region = (__runInitializers(this, _city_extraInitializers), __runInitializers(this, _region_initializers, void 0));
                this.meetingPoint = (__runInitializers(this, _region_extraInitializers), __runInitializers(this, _meetingPoint_initializers, void 0));
                this.departureTime = (__runInitializers(this, _meetingPoint_extraInitializers), __runInitializers(this, _departureTime_initializers, void 0));
                this.returnTime = (__runInitializers(this, _departureTime_extraInitializers), __runInitializers(this, _returnTime_initializers, void 0));
                this.isFeatured = (__runInitializers(this, _returnTime_extraInitializers), __runInitializers(this, _isFeatured_initializers, void 0));
                this.status = (__runInitializers(this, _isFeatured_extraInitializers), __runInitializers(this, _status_initializers, void 0));
                this.seoTitle = (__runInitializers(this, _status_extraInitializers), __runInitializers(this, _seoTitle_initializers, void 0));
                this.seoDescription = (__runInitializers(this, _seoTitle_extraInitializers), __runInitializers(this, _seoDescription_initializers, void 0));
                this.includedServicesJsonb = (__runInitializers(this, _seoDescription_extraInitializers), __runInitializers(this, _includedServicesJsonb_initializers, void 0));
                this.excludedServicesJsonb = (__runInitializers(this, _includedServicesJsonb_extraInitializers), __runInitializers(this, _excludedServicesJsonb_initializers, void 0));
                this.hotelInfoJsonb = (__runInitializers(this, _excludedServicesJsonb_extraInitializers), __runInitializers(this, _hotelInfoJsonb_initializers, void 0));
                this.transportationJsonb = (__runInitializers(this, _hotelInfoJsonb_extraInitializers), __runInitializers(this, _transportationJsonb_initializers, void 0));
                this.pickupLocationsJsonb = (__runInitializers(this, _transportationJsonb_extraInitializers), __runInitializers(this, _pickupLocationsJsonb_initializers, void 0));
                this.languages = (__runInitializers(this, _pickupLocationsJsonb_extraInitializers), __runInitializers(this, _languages_initializers, void 0));
                this.difficultyLevel = (__runInitializers(this, _languages_extraInitializers), __runInitializers(this, _difficultyLevel_initializers, void 0));
                this.ageRestrictions = (__runInitializers(this, _difficultyLevel_extraInitializers), __runInitializers(this, _ageRestrictions_initializers, void 0));
                this.cancellationPolicyJsonb = (__runInitializers(this, _ageRestrictions_extraInitializers), __runInitializers(this, _cancellationPolicyJsonb_initializers, void 0));
                this.termsJsonb = (__runInitializers(this, _cancellationPolicyJsonb_extraInitializers), __runInitializers(this, _termsJsonb_initializers, void 0));
                this.tags = (__runInitializers(this, _termsJsonb_extraInitializers), __runInitializers(this, _tags_initializers, void 0));
                this.capacity = (__runInitializers(this, _tags_extraInitializers), __runInitializers(this, _capacity_initializers, void 0));
                this.remainingSeats = (__runInitializers(this, _capacity_extraInitializers), __runInitializers(this, _remainingSeats_initializers, void 0));
                this.seasonPricingJsonb = (__runInitializers(this, _remainingSeats_extraInitializers), __runInitializers(this, _seasonPricingJsonb_initializers, void 0));
                this.currency = (__runInitializers(this, _seasonPricingJsonb_extraInitializers), __runInitializers(this, _currency_initializers, void 0));
                this.itineraries = (__runInitializers(this, _currency_extraInitializers), __runInitializers(this, _itineraries_initializers, void 0));
                this.images = (__runInitializers(this, _itineraries_extraInitializers), __runInitializers(this, _images_initializers, void 0));
                __runInitializers(this, _images_extraInitializers);
            }
            return CreateTourDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _slug_decorators = [(0, swagger_1.ApiProperty)({ description: 'Unique URL slug' }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _titleJsonb_decorators = [(0, swagger_1.ApiProperty)({ description: 'Multilingual title object' }), (0, class_validator_1.IsObject)(), (0, class_validator_1.IsNotEmpty)()];
            _category_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Category name' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _basePriceUsd_decorators = [(0, swagger_1.ApiProperty)({ description: 'Base price in USD' }), (0, class_validator_1.IsNumber)(), (0, class_transformer_1.Type)(function () { return Number; })];
            _durationJsonb_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Multilingual duration object' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)()];
            _overviewJsonb_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Multilingual overview object' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)()];
            _minPaxJsonb_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Multilingual minimum passenger info' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)()];
            _isActive_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Is active flag', default: true }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
            _country_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Country name' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _city_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'City name' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _region_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Region name' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _meetingPoint_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Meeting point location' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _departureTime_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Departure time string' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _returnTime_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Return time string' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _isFeatured_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Is featured flag', default: false }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
            _status_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    description: 'Publishing status',
                    default: 'PUBLISHED',
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _seoTitle_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'SEO Meta Title' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _seoDescription_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'SEO Meta Description' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _includedServicesJsonb_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Multilingual included services' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)()];
            _excludedServicesJsonb_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Multilingual excluded services' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)()];
            _hotelInfoJsonb_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Multilingual hotel information' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)()];
            _transportationJsonb_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    description: 'Multilingual transportation information',
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)()];
            _pickupLocationsJsonb_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Multilingual pickup locations' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)()];
            _languages_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Supported languages array' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            _difficultyLevel_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Difficulty level' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _ageRestrictions_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Age restrictions description' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _cancellationPolicyJsonb_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Multilingual cancellation policy' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)()];
            _termsJsonb_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Multilingual terms and conditions' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)()];
            _tags_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Tags array' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            _capacity_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    description: 'Maximum passenger capacity',
                    default: 30,
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)(), (0, class_transformer_1.Type)(function () { return Number; })];
            _remainingSeats_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    description: 'Remaining available seats',
                    default: 30,
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)(), (0, class_transformer_1.Type)(function () { return Number; })];
            _seasonPricingJsonb_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    description: 'Seasonal pricing and price rules JSONB',
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)()];
            _currency_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Currency code', default: 'USD' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _itineraries_decorators = [(0, swagger_1.ApiPropertyOptional)({ type: [CreateTourItineraryDto] }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.ValidateNested)({ each: true }), (0, class_transformer_1.Type)(function () { return CreateTourItineraryDto; })];
            _images_decorators = [(0, swagger_1.ApiPropertyOptional)({ type: [CreateTourImageDto] }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.ValidateNested)({ each: true }), (0, class_transformer_1.Type)(function () { return CreateTourImageDto; })];
            __esDecorate(null, null, _slug_decorators, { kind: "field", name: "slug", static: false, private: false, access: { has: function (obj) { return "slug" in obj; }, get: function (obj) { return obj.slug; }, set: function (obj, value) { obj.slug = value; } }, metadata: _metadata }, _slug_initializers, _slug_extraInitializers);
            __esDecorate(null, null, _titleJsonb_decorators, { kind: "field", name: "titleJsonb", static: false, private: false, access: { has: function (obj) { return "titleJsonb" in obj; }, get: function (obj) { return obj.titleJsonb; }, set: function (obj, value) { obj.titleJsonb = value; } }, metadata: _metadata }, _titleJsonb_initializers, _titleJsonb_extraInitializers);
            __esDecorate(null, null, _category_decorators, { kind: "field", name: "category", static: false, private: false, access: { has: function (obj) { return "category" in obj; }, get: function (obj) { return obj.category; }, set: function (obj, value) { obj.category = value; } }, metadata: _metadata }, _category_initializers, _category_extraInitializers);
            __esDecorate(null, null, _basePriceUsd_decorators, { kind: "field", name: "basePriceUsd", static: false, private: false, access: { has: function (obj) { return "basePriceUsd" in obj; }, get: function (obj) { return obj.basePriceUsd; }, set: function (obj, value) { obj.basePriceUsd = value; } }, metadata: _metadata }, _basePriceUsd_initializers, _basePriceUsd_extraInitializers);
            __esDecorate(null, null, _durationJsonb_decorators, { kind: "field", name: "durationJsonb", static: false, private: false, access: { has: function (obj) { return "durationJsonb" in obj; }, get: function (obj) { return obj.durationJsonb; }, set: function (obj, value) { obj.durationJsonb = value; } }, metadata: _metadata }, _durationJsonb_initializers, _durationJsonb_extraInitializers);
            __esDecorate(null, null, _overviewJsonb_decorators, { kind: "field", name: "overviewJsonb", static: false, private: false, access: { has: function (obj) { return "overviewJsonb" in obj; }, get: function (obj) { return obj.overviewJsonb; }, set: function (obj, value) { obj.overviewJsonb = value; } }, metadata: _metadata }, _overviewJsonb_initializers, _overviewJsonb_extraInitializers);
            __esDecorate(null, null, _minPaxJsonb_decorators, { kind: "field", name: "minPaxJsonb", static: false, private: false, access: { has: function (obj) { return "minPaxJsonb" in obj; }, get: function (obj) { return obj.minPaxJsonb; }, set: function (obj, value) { obj.minPaxJsonb = value; } }, metadata: _metadata }, _minPaxJsonb_initializers, _minPaxJsonb_extraInitializers);
            __esDecorate(null, null, _isActive_decorators, { kind: "field", name: "isActive", static: false, private: false, access: { has: function (obj) { return "isActive" in obj; }, get: function (obj) { return obj.isActive; }, set: function (obj, value) { obj.isActive = value; } }, metadata: _metadata }, _isActive_initializers, _isActive_extraInitializers);
            __esDecorate(null, null, _country_decorators, { kind: "field", name: "country", static: false, private: false, access: { has: function (obj) { return "country" in obj; }, get: function (obj) { return obj.country; }, set: function (obj, value) { obj.country = value; } }, metadata: _metadata }, _country_initializers, _country_extraInitializers);
            __esDecorate(null, null, _city_decorators, { kind: "field", name: "city", static: false, private: false, access: { has: function (obj) { return "city" in obj; }, get: function (obj) { return obj.city; }, set: function (obj, value) { obj.city = value; } }, metadata: _metadata }, _city_initializers, _city_extraInitializers);
            __esDecorate(null, null, _region_decorators, { kind: "field", name: "region", static: false, private: false, access: { has: function (obj) { return "region" in obj; }, get: function (obj) { return obj.region; }, set: function (obj, value) { obj.region = value; } }, metadata: _metadata }, _region_initializers, _region_extraInitializers);
            __esDecorate(null, null, _meetingPoint_decorators, { kind: "field", name: "meetingPoint", static: false, private: false, access: { has: function (obj) { return "meetingPoint" in obj; }, get: function (obj) { return obj.meetingPoint; }, set: function (obj, value) { obj.meetingPoint = value; } }, metadata: _metadata }, _meetingPoint_initializers, _meetingPoint_extraInitializers);
            __esDecorate(null, null, _departureTime_decorators, { kind: "field", name: "departureTime", static: false, private: false, access: { has: function (obj) { return "departureTime" in obj; }, get: function (obj) { return obj.departureTime; }, set: function (obj, value) { obj.departureTime = value; } }, metadata: _metadata }, _departureTime_initializers, _departureTime_extraInitializers);
            __esDecorate(null, null, _returnTime_decorators, { kind: "field", name: "returnTime", static: false, private: false, access: { has: function (obj) { return "returnTime" in obj; }, get: function (obj) { return obj.returnTime; }, set: function (obj, value) { obj.returnTime = value; } }, metadata: _metadata }, _returnTime_initializers, _returnTime_extraInitializers);
            __esDecorate(null, null, _isFeatured_decorators, { kind: "field", name: "isFeatured", static: false, private: false, access: { has: function (obj) { return "isFeatured" in obj; }, get: function (obj) { return obj.isFeatured; }, set: function (obj, value) { obj.isFeatured = value; } }, metadata: _metadata }, _isFeatured_initializers, _isFeatured_extraInitializers);
            __esDecorate(null, null, _status_decorators, { kind: "field", name: "status", static: false, private: false, access: { has: function (obj) { return "status" in obj; }, get: function (obj) { return obj.status; }, set: function (obj, value) { obj.status = value; } }, metadata: _metadata }, _status_initializers, _status_extraInitializers);
            __esDecorate(null, null, _seoTitle_decorators, { kind: "field", name: "seoTitle", static: false, private: false, access: { has: function (obj) { return "seoTitle" in obj; }, get: function (obj) { return obj.seoTitle; }, set: function (obj, value) { obj.seoTitle = value; } }, metadata: _metadata }, _seoTitle_initializers, _seoTitle_extraInitializers);
            __esDecorate(null, null, _seoDescription_decorators, { kind: "field", name: "seoDescription", static: false, private: false, access: { has: function (obj) { return "seoDescription" in obj; }, get: function (obj) { return obj.seoDescription; }, set: function (obj, value) { obj.seoDescription = value; } }, metadata: _metadata }, _seoDescription_initializers, _seoDescription_extraInitializers);
            __esDecorate(null, null, _includedServicesJsonb_decorators, { kind: "field", name: "includedServicesJsonb", static: false, private: false, access: { has: function (obj) { return "includedServicesJsonb" in obj; }, get: function (obj) { return obj.includedServicesJsonb; }, set: function (obj, value) { obj.includedServicesJsonb = value; } }, metadata: _metadata }, _includedServicesJsonb_initializers, _includedServicesJsonb_extraInitializers);
            __esDecorate(null, null, _excludedServicesJsonb_decorators, { kind: "field", name: "excludedServicesJsonb", static: false, private: false, access: { has: function (obj) { return "excludedServicesJsonb" in obj; }, get: function (obj) { return obj.excludedServicesJsonb; }, set: function (obj, value) { obj.excludedServicesJsonb = value; } }, metadata: _metadata }, _excludedServicesJsonb_initializers, _excludedServicesJsonb_extraInitializers);
            __esDecorate(null, null, _hotelInfoJsonb_decorators, { kind: "field", name: "hotelInfoJsonb", static: false, private: false, access: { has: function (obj) { return "hotelInfoJsonb" in obj; }, get: function (obj) { return obj.hotelInfoJsonb; }, set: function (obj, value) { obj.hotelInfoJsonb = value; } }, metadata: _metadata }, _hotelInfoJsonb_initializers, _hotelInfoJsonb_extraInitializers);
            __esDecorate(null, null, _transportationJsonb_decorators, { kind: "field", name: "transportationJsonb", static: false, private: false, access: { has: function (obj) { return "transportationJsonb" in obj; }, get: function (obj) { return obj.transportationJsonb; }, set: function (obj, value) { obj.transportationJsonb = value; } }, metadata: _metadata }, _transportationJsonb_initializers, _transportationJsonb_extraInitializers);
            __esDecorate(null, null, _pickupLocationsJsonb_decorators, { kind: "field", name: "pickupLocationsJsonb", static: false, private: false, access: { has: function (obj) { return "pickupLocationsJsonb" in obj; }, get: function (obj) { return obj.pickupLocationsJsonb; }, set: function (obj, value) { obj.pickupLocationsJsonb = value; } }, metadata: _metadata }, _pickupLocationsJsonb_initializers, _pickupLocationsJsonb_extraInitializers);
            __esDecorate(null, null, _languages_decorators, { kind: "field", name: "languages", static: false, private: false, access: { has: function (obj) { return "languages" in obj; }, get: function (obj) { return obj.languages; }, set: function (obj, value) { obj.languages = value; } }, metadata: _metadata }, _languages_initializers, _languages_extraInitializers);
            __esDecorate(null, null, _difficultyLevel_decorators, { kind: "field", name: "difficultyLevel", static: false, private: false, access: { has: function (obj) { return "difficultyLevel" in obj; }, get: function (obj) { return obj.difficultyLevel; }, set: function (obj, value) { obj.difficultyLevel = value; } }, metadata: _metadata }, _difficultyLevel_initializers, _difficultyLevel_extraInitializers);
            __esDecorate(null, null, _ageRestrictions_decorators, { kind: "field", name: "ageRestrictions", static: false, private: false, access: { has: function (obj) { return "ageRestrictions" in obj; }, get: function (obj) { return obj.ageRestrictions; }, set: function (obj, value) { obj.ageRestrictions = value; } }, metadata: _metadata }, _ageRestrictions_initializers, _ageRestrictions_extraInitializers);
            __esDecorate(null, null, _cancellationPolicyJsonb_decorators, { kind: "field", name: "cancellationPolicyJsonb", static: false, private: false, access: { has: function (obj) { return "cancellationPolicyJsonb" in obj; }, get: function (obj) { return obj.cancellationPolicyJsonb; }, set: function (obj, value) { obj.cancellationPolicyJsonb = value; } }, metadata: _metadata }, _cancellationPolicyJsonb_initializers, _cancellationPolicyJsonb_extraInitializers);
            __esDecorate(null, null, _termsJsonb_decorators, { kind: "field", name: "termsJsonb", static: false, private: false, access: { has: function (obj) { return "termsJsonb" in obj; }, get: function (obj) { return obj.termsJsonb; }, set: function (obj, value) { obj.termsJsonb = value; } }, metadata: _metadata }, _termsJsonb_initializers, _termsJsonb_extraInitializers);
            __esDecorate(null, null, _tags_decorators, { kind: "field", name: "tags", static: false, private: false, access: { has: function (obj) { return "tags" in obj; }, get: function (obj) { return obj.tags; }, set: function (obj, value) { obj.tags = value; } }, metadata: _metadata }, _tags_initializers, _tags_extraInitializers);
            __esDecorate(null, null, _capacity_decorators, { kind: "field", name: "capacity", static: false, private: false, access: { has: function (obj) { return "capacity" in obj; }, get: function (obj) { return obj.capacity; }, set: function (obj, value) { obj.capacity = value; } }, metadata: _metadata }, _capacity_initializers, _capacity_extraInitializers);
            __esDecorate(null, null, _remainingSeats_decorators, { kind: "field", name: "remainingSeats", static: false, private: false, access: { has: function (obj) { return "remainingSeats" in obj; }, get: function (obj) { return obj.remainingSeats; }, set: function (obj, value) { obj.remainingSeats = value; } }, metadata: _metadata }, _remainingSeats_initializers, _remainingSeats_extraInitializers);
            __esDecorate(null, null, _seasonPricingJsonb_decorators, { kind: "field", name: "seasonPricingJsonb", static: false, private: false, access: { has: function (obj) { return "seasonPricingJsonb" in obj; }, get: function (obj) { return obj.seasonPricingJsonb; }, set: function (obj, value) { obj.seasonPricingJsonb = value; } }, metadata: _metadata }, _seasonPricingJsonb_initializers, _seasonPricingJsonb_extraInitializers);
            __esDecorate(null, null, _currency_decorators, { kind: "field", name: "currency", static: false, private: false, access: { has: function (obj) { return "currency" in obj; }, get: function (obj) { return obj.currency; }, set: function (obj, value) { obj.currency = value; } }, metadata: _metadata }, _currency_initializers, _currency_extraInitializers);
            __esDecorate(null, null, _itineraries_decorators, { kind: "field", name: "itineraries", static: false, private: false, access: { has: function (obj) { return "itineraries" in obj; }, get: function (obj) { return obj.itineraries; }, set: function (obj, value) { obj.itineraries = value; } }, metadata: _metadata }, _itineraries_initializers, _itineraries_extraInitializers);
            __esDecorate(null, null, _images_decorators, { kind: "field", name: "images", static: false, private: false, access: { has: function (obj) { return "images" in obj; }, get: function (obj) { return obj.images; }, set: function (obj, value) { obj.images = value; } }, metadata: _metadata }, _images_initializers, _images_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateTourDto = CreateTourDto;
