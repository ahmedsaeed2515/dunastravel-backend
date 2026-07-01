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
exports.FileValidationPipe = void 0;
var common_1 = require("@nestjs/common");
var FileValidationPipe = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var FileValidationPipe = _classThis = /** @class */ (function () {
        function FileValidationPipe_1(configService) {
            this.configService = configService;
            this.allowedMimeTypes = this.configService.get('storage.allowedMimeTypes') || ['image/jpeg', 'image/png', 'image/webp'];
        }
        FileValidationPipe_1.prototype.transform = function (file) {
            if (!file || !file.buffer || file.buffer.length === 0) {
                throw new common_1.BadRequestException('File is missing or empty.');
            }
            if (!this.allowedMimeTypes.includes(file.mimetype)) {
                throw new common_1.BadRequestException("Invalid file type. Allowed types: ".concat(this.allowedMimeTypes.join(', ')));
            }
            if (!this.verifyMagicNumber(file.buffer, file.mimetype)) {
                throw new common_1.BadRequestException('File content does not match declared MIME type.');
            }
            return file;
        };
        FileValidationPipe_1.prototype.verifyMagicNumber = function (buffer, mimetype) {
            // Magic numbers
            // JPEG: FF D8 FF
            // PNG: 89 50 4E 47 0D 0A 1A 0A
            // WebP: RIFF .... WEBP (bytes 0-3 and 8-11)
            if (mimetype === 'image/jpeg') {
                return (buffer.length >= 3 &&
                    buffer[0] === 0xff &&
                    buffer[1] === 0xd8 &&
                    buffer[2] === 0xff);
            }
            if (mimetype === 'image/png') {
                return (buffer.length >= 8 &&
                    buffer[0] === 0x89 &&
                    buffer[1] === 0x50 &&
                    buffer[2] === 0x4e &&
                    buffer[3] === 0x47 &&
                    buffer[4] === 0x0d &&
                    buffer[5] === 0x0a &&
                    buffer[6] === 0x1a &&
                    buffer[7] === 0x0a);
            }
            if (mimetype === 'image/webp') {
                return (buffer.length >= 12 &&
                    buffer[0] === 0x52 && // R
                    buffer[1] === 0x49 && // I
                    buffer[2] === 0x46 && // F
                    buffer[3] === 0x46 && // F
                    buffer[8] === 0x57 && // W
                    buffer[9] === 0x45 && // E
                    buffer[10] === 0x42 && // B
                    buffer[11] === 0x50 // P
                );
            }
            return false;
        };
        return FileValidationPipe_1;
    }());
    __setFunctionName(_classThis, "FileValidationPipe");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        FileValidationPipe = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return FileValidationPipe = _classThis;
}();
exports.FileValidationPipe = FileValidationPipe;
