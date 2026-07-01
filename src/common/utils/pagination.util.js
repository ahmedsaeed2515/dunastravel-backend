"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginate = paginate;
exports.getPaginationParams = getPaginationParams;
function paginate(items, total, page, limit) {
    var totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
    var hasNextPage = page < totalPages;
    var hasPrevPage = page > 1;
    return {
        items: items,
        total: total,
        page: page,
        limit: limit,
        totalPages: totalPages,
        hasNextPage: hasNextPage,
        hasPrevPage: hasPrevPage,
    };
}
function getPaginationParams(page, limit) {
    var p = page === undefined || page < 1 ? 1 : page;
    var l = limit === undefined ? 10 : limit;
    if (l < 1)
        l = 1;
    if (l > 100)
        l = 100;
    var skip = (p - 1) * l;
    return { skip: skip, take: l, page: p, limit: l };
}
