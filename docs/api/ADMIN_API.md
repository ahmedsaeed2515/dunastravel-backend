# Admin & Enterprise API

## Admin Module

### `GET` /api/admin/bookings

**Summary:** List all bookings with pagination and filtering.

- **Controller:** `AdminController`
- **Action:** `listBookings`
- **Auth Required:** ✅ Yes

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `status` (string): Filter by booking status
- `tourId` (string): Filter by tour ID
- `dateFrom` (string): Filter created after this date
- `dateTo` (string): Filter created before this date
- `search` (string): Search term for customer name, email, or reference code
- `paymentStatus` (string): Filter by payment status (e.g. PAID, PENDING, PARTIALLY_PAID)
- `sortBy` (string): Sort field
- `sortOrder` (string): Sort order

**Responses:**
- **200**: Paginated list of bookings
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role

---
### `GET` /api/admin/bookings/export/csv

**Summary:** Export bookings to CSV.

- **Controller:** `AdminController`
- **Action:** `exportBookingsCsv`
- **Auth Required:** ✅ Yes

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `status` (string): Filter by booking status
- `tourId` (string): Filter by tour ID
- `dateFrom` (string): Filter created after this date
- `dateTo` (string): Filter created before this date
- `search` (string): Search term for customer name, email, or reference code
- `paymentStatus` (string): Filter by payment status (e.g. PAID, PENDING, PARTIALLY_PAID)
- `sortBy` (string): Sort field
- `sortOrder` (string): Sort order

**Responses:**
- **200**: CSV data string
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role

---
### `GET` /api/admin/bookings/{referenceCode}

**Summary:** Get full detail for a single booking.

- **Controller:** `AdminController`
- **Action:** `getBookingByReferenceCode`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `referenceCode` (string): 

**Responses:**
- **200**: Full booking record
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role
- **404**: Booking not found

---
### `PATCH` /api/admin/bookings/{referenceCode}

**Summary:** Update general booking details.

- **Controller:** `AdminController`
- **Action:** `updateBooking`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `referenceCode` (string): 

**Request Body:**
```json
{
  "transportChoice": "string",
  "notes": "string",
  "cancellationReason": "string",
  "arrivalDate": "string",
  "departureDate": "string",
  "tags": [
    "string"
  ],
  "priority": "string"
}
```

**Responses:**
- **200**: Updated booking record
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role

---
### `DELETE` /api/admin/bookings/{referenceCode}

**Summary:** Soft delete a booking.

- **Controller:** `AdminController`
- **Action:** `softDeleteBooking`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `referenceCode` (string): 

**Responses:**
- **200**: Booking deleted successfully
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role

---
### `PATCH` /api/admin/bookings/bulk/update

**Summary:** Bulk update bookings.

- **Controller:** `AdminController`
- **Action:** `bulkUpdateBookings`
- **Auth Required:** ✅ Yes

**Request Body:**
```json
{
  "referenceCodes": [
    "string"
  ],
  "status": "string",
  "assigneeId": "object",
  "priority": "string"
}
```

**Responses:**
- **200**: Bookings updated successfully
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role

---
### `PATCH` /api/admin/bookings/{referenceCode}/status

**Summary:** Update the status of a booking.

- **Controller:** `AdminController`
- **Action:** `updateBookingStatus`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `referenceCode` (string): 

**Request Body:**
```json
{
  "status": "string",
  "reason": "string"
}
```

**Responses:**
- **200**: Updated booking status
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role

---
### `PATCH` /api/admin/bookings/{referenceCode}/passengers

**Summary:** Upsert passengers for a booking.

- **Controller:** `AdminController`
- **Action:** `upsertPassengers`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `referenceCode` (string): 

**Request Body:**
```json
{
  "passengers": [
    {
      "id": "string",
      "passengerType": "string",
      "fullName": "string",
      "passportNumber": "string",
      "passportExpiry": "string",
      "dateOfBirth": "string",
      "nationality": "string"
    }
  ]
}
```

**Responses:**
- **200**: Passengers updated successfully
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role

---
### `PATCH` /api/admin/bookings/{referenceCode}/assign

**Summary:** Assign a booking to an admin.

- **Controller:** `AdminController`
- **Action:** `assignBooking`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `referenceCode` (string): 

**Request Body:**
```json
{
  "assigneeId": "object"
}
```

**Responses:**
- **200**: Booking assigned successfully
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role

---
### `POST` /api/admin/bookings/{referenceCode}/payments

**Summary:** Add a payment to a booking.

- **Controller:** `AdminController`
- **Action:** `addPayment`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `referenceCode` (string): 

**Request Body:**
```json
{
  "amount": "number",
  "currency": "USD",
  "method": "string",
  "transactionId": "string",
  "isRefund": "boolean"
}
```

**Responses:**
- **200**: Payment added successfully
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role

---
### `POST` /api/admin/bookings/{referenceCode}/notes

**Summary:** Add an internal note to a booking.

- **Controller:** `AdminController`
- **Action:** `addBookingNote`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `referenceCode` (string): 

**Request Body:**
```json
{
  "content": "string"
}
```

**Responses:**
- **200**: Note added successfully
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role

---
### `POST` /api/admin/bookings/{referenceCode}/attachments

**Summary:** Link an attachment to a booking.

- **Controller:** `AdminController`
- **Action:** `addBookingAttachment`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `referenceCode` (string): 

**Request Body:**
```json
{
  "mediaAssetId": "string"
}
```

**Responses:**
- **200**: Attachment linked successfully
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role

---
### `GET` /api/admin/inquiries

**Summary:** List all tailor-made inquiries with pagination and filtering.

- **Controller:** `AdminController`
- **Action:** `listInquiries`
- **Auth Required:** ✅ Yes

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `status` (string): Filter by inquiry status
- `email` (string): Filter by email
- `dateFrom` (string): Filter created after this date
- `dateTo` (string): Filter created before this date
- `sortBy` (string): Sort field
- `sortOrder` (string): Sort order

**Responses:**
- **200**: Paginated list of inquiries
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role

---
### `GET` /api/admin/inquiries/{referenceCode}

**Summary:** Get full detail for a single tailor-made inquiry.

- **Controller:** `AdminController`
- **Action:** `getInquiryByReferenceCode`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `referenceCode` (string): 

**Responses:**
- **200**: Full inquiry record
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role
- **404**: Inquiry not found

---
### `PATCH` /api/admin/inquiries/{referenceCode}/status

**Summary:** Update the status of a tailor-made inquiry.

- **Controller:** `AdminController`
- **Action:** `updateInquiryStatus`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `referenceCode` (string): 

**Request Body:**
```json
{
  "status": "IN_PROGRESS"
}
```

**Responses:**
- **200**: Updated inquiry record
- **400**: Invalid status transition
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role
- **404**: Inquiry not found

---
### `GET` /api/admin/contact-submissions

**Summary:** List all contact submissions with pagination and filtering.

- **Controller:** `AdminController`
- **Action:** `listContactSubmissions`
- **Auth Required:** ✅ Yes

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `status` (string): Filter by status
- `email` (string): Filter by email
- `dateFrom` (string): Filter created after this date
- `dateTo` (string): Filter created before this date
- `sortBy` (string): Sort field
- `sortOrder` (string): Sort order

**Responses:**
- **200**: Paginated list of contact submissions
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role

---
### `GET` /api/admin/contact-submissions/{referenceCode}

**Summary:** Get full detail for a single contact submission.

- **Controller:** `AdminController`
- **Action:** `getContactSubmissionByReferenceCode`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `referenceCode` (string): 

**Responses:**
- **200**: Full contact submission record
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role
- **404**: Contact submission not found

---
### `PATCH` /api/admin/contact-submissions/{referenceCode}/status

**Summary:** Update the status of a contact submission.

- **Controller:** `AdminController`
- **Action:** `updateContactSubmissionStatus`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `referenceCode` (string): 

**Request Body:**
```json
{
  "status": "READ"
}
```

**Responses:**
- **200**: Updated contact submission record
- **400**: Invalid status transition
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role
- **404**: Contact submission not found

---
### `GET` /api/admin/notification-logs

**Summary:** List notification delivery logs with pagination and filtering.

- **Controller:** `AdminController`
- **Action:** `listNotificationLogs`
- **Auth Required:** ✅ Yes

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `status` (string): Filter by delivery status
- `originEvent` (string): Filter by origin event
- `dateFrom` (string): Filter created after this date
- `dateTo` (string): Filter created before this date
- `sortBy` (string): Sort field
- `sortOrder` (string): Sort order

**Responses:**
- **200**: Paginated list of notification logs
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role

---
### `GET` /api/admin/dashboard

**Summary:** Retrieve aggregated CRM dashboard metrics.

- **Controller:** `AdminController`
- **Action:** `getDashboardMetrics`
- **Auth Required:** ✅ Yes

**Responses:**
- **200**: Dashboard metrics object
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role

---
### `GET` /api/admin/tours

**Summary:** List all tours with advanced enterprise filtering and pagination.

- **Controller:** `AdminController`
- **Action:** `listTours`
- **Auth Required:** ✅ Yes

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Number of items per page
- `search` (string): Search query for title or slug
- `country` (string): Filter by country
- `city` (string): Filter by city
- `category` (string): Filter by category
- `status` (string): Filter by status (PUBLISHED, DRAFT, ARCHIVED)
- `isFeatured` (string): Filter by featured status
- `tag` (string): Filter by tag
- `sortBy` (string): Sort field
- `sortOrder` (string): Sort order

**Responses:**
- **200**: Paginated list of tours
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role

---
### `POST` /api/admin/tours

**Summary:** Create a new tour (supports 10-step wizard data).

- **Controller:** `AdminController`
- **Action:** `createTour`
- **Auth Required:** ✅ Yes

**Request Body:**
```json
{
  "slug": "string",
  "titleJsonb": "object",
  "category": "string",
  "basePriceUsd": "number",
  "durationJsonb": "object",
  "overviewJsonb": "object",
  "minPaxJsonb": "object",
  "isActive": true,
  "country": "string",
  "city": "string",
  "region": "string",
  "meetingPoint": "string",
  "departureTime": "string",
  "returnTime": "string",
  "isFeatured": "boolean",
  "status": "PUBLISHED",
  "seoTitle": "string",
  "seoDescription": "string",
  "includedServicesJsonb": "object",
  "excludedServicesJsonb": "object",
  "hotelInfoJsonb": "object",
  "transportationJsonb": "object",
  "pickupLocationsJsonb": "object",
  "languages": [
    "string"
  ],
  "difficultyLevel": "string",
  "ageRestrictions": "string",
  "cancellationPolicyJsonb": "object",
  "termsJsonb": "object",
  "tags": [
    "string"
  ],
  "capacity": 30,
  "remainingSeats": 30,
  "seasonPricingJsonb": "object",
  "currency": "USD",
  "itineraries": [
    {
      "dayLabel": "string",
      "descriptionJsonb": "object",
      "mealsJsonb": "object",
      "activitiesJsonb": "object",
      "hotelsJsonb": "object",
      "transportationJsonb": "object",
      "notesJsonb": "object",
      "sortOrder": "number"
    }
  ],
  "images": [
    {
      "imageUrl": "string",
      "isHero": "boolean",
      "isVideo": "boolean",
      "videoUrl": "string",
      "altText": "string",
      "sortOrder": "number"
    }
  ]
}
```

**Responses:**
- **200**: Tour created successfully
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role

---
### `GET` /api/admin/tours/stats

**Summary:** Get aggregated tour statistics and occupancy metrics.

- **Controller:** `AdminController`
- **Action:** `getTourStats`
- **Auth Required:** ✅ Yes

**Responses:**
- **200**: Tour statistics object
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role

---
### `GET` /api/admin/tours/export/csv

**Summary:** Export tours to CSV.

- **Controller:** `AdminController`
- **Action:** `exportToursCsv`
- **Auth Required:** ✅ Yes

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Number of items per page
- `search` (string): Search query for title or slug
- `country` (string): Filter by country
- `city` (string): Filter by city
- `category` (string): Filter by category
- `status` (string): Filter by status (PUBLISHED, DRAFT, ARCHIVED)
- `isFeatured` (string): Filter by featured status
- `tag` (string): Filter by tag
- `sortBy` (string): Sort field
- `sortOrder` (string): Sort order

**Responses:**
- **200**: CSV data string
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role

---
### `GET` /api/admin/tours/{slug}

**Summary:** Get full details for a single tour.

- **Controller:** `AdminController`
- **Action:** `getTourBySlug`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `slug` (string): 

**Responses:**
- **200**: Full tour record
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role
- **404**: Tour not found

---
### `PATCH` /api/admin/tours/{slug}

**Summary:** Update tour details.

- **Controller:** `AdminController`
- **Action:** `updateTour`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `slug` (string): 

**Request Body:**
```json
{
  "slug": "string",
  "titleJsonb": "object",
  "category": "string",
  "basePriceUsd": "number",
  "durationJsonb": "object",
  "overviewJsonb": "object",
  "minPaxJsonb": "object",
  "isActive": true,
  "country": "string",
  "city": "string",
  "region": "string",
  "meetingPoint": "string",
  "departureTime": "string",
  "returnTime": "string",
  "isFeatured": "boolean",
  "status": "PUBLISHED",
  "seoTitle": "string",
  "seoDescription": "string",
  "includedServicesJsonb": "object",
  "excludedServicesJsonb": "object",
  "hotelInfoJsonb": "object",
  "transportationJsonb": "object",
  "pickupLocationsJsonb": "object",
  "languages": [
    "string"
  ],
  "difficultyLevel": "string",
  "ageRestrictions": "string",
  "cancellationPolicyJsonb": "object",
  "termsJsonb": "object",
  "tags": [
    "string"
  ],
  "capacity": 30,
  "remainingSeats": 30,
  "seasonPricingJsonb": "object",
  "currency": "USD",
  "itineraries": [
    {
      "dayLabel": "string",
      "descriptionJsonb": "object",
      "mealsJsonb": "object",
      "activitiesJsonb": "object",
      "hotelsJsonb": "object",
      "transportationJsonb": "object",
      "notesJsonb": "object",
      "sortOrder": "number"
    }
  ],
  "images": [
    {
      "imageUrl": "string",
      "isHero": "boolean",
      "isVideo": "boolean",
      "videoUrl": "string",
      "altText": "string",
      "sortOrder": "number"
    }
  ]
}
```

**Responses:**
- **200**: Updated tour record
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role

---
### `DELETE` /api/admin/tours/{slug}

**Summary:** Soft delete a tour.

- **Controller:** `AdminController`
- **Action:** `softDeleteTour`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `slug` (string): 

**Responses:**
- **200**: Tour soft deleted successfully
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role

---
### `PATCH` /api/admin/tours/bulk/update

**Summary:** Bulk update tours.

- **Controller:** `AdminController`
- **Action:** `bulkUpdateTours`
- **Auth Required:** ✅ Yes

**Request Body:**
```json
{
  "slugs": [
    "string"
  ],
  "status": "string",
  "category": "string",
  "country": "string",
  "isActive": "boolean"
}
```

**Responses:**
- **200**: Tours updated successfully
- **401**: Unauthorized
- **403**: Forbidden: Requires ADMIN role

---
## Admin - AI Concierge Module

### `POST` /api/admin/ai/itinerary/generate

**Summary:** Generate a customized travel itinerary using AI

- **Controller:** `AiController`
- **Action:** `generateItinerary`
- **Auth Required:** ✅ Yes

**Request Body:**
```json
{
  "destinations": [
    "string"
  ],
  "days": "number",
  "budgetUsd": "number",
  "pax": "number",
  "preferences": "string"
}
```

**Responses:**
- **201**: 

---
### `POST` /api/admin/ai/customer/{id}/analyze

**Summary:** Analyze a customer profile using AI to generate CRM insights

- **Controller:** `AiController`
- **Action:** `analyzeCustomer`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `id` (string): 

**Responses:**
- **201**: 

---
## Admin - Communications & Notifications Module

### `GET` /api/admin/communications/logs/metrics

**Summary:** Get global communication delivery metrics

- **Controller:** `NotificationsController`
- **Action:** `getMetrics`
- **Auth Required:** ✅ Yes

**Responses:**
- **200**: 

---
### `GET` /api/admin/communications/logs

**Summary:** List notification delivery logs with pagination

- **Controller:** `NotificationsController`
- **Action:** `findAll`
- **Auth Required:** ✅ Yes

**Query Parameters:**
- `status` (string): 
- `notificationType` (string): 
- `recipientEmail` (string): 
- `page` (number): 
- `limit` (number): 

**Responses:**
- **200**: 

---
### `POST` /api/admin/communications/logs/{id}/retry

**Summary:** Manually retry a failed notification

- **Controller:** `NotificationsController`
- **Action:** `retryNotification`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `id` (string): 

**Responses:**
- **201**: 

---
## Admin - Companies (B2B) Module

### `GET` /api/admin/companies/metrics

**Summary:** Get B2B CRM dashboard metrics

- **Controller:** `CompaniesController`
- **Action:** `getMetrics`
- **Auth Required:** ✅ Yes

**Responses:**
- **200**: 

---
### `GET` /api/admin/companies/export/csv

**Summary:** Export companies to CSV

- **Controller:** `CompaniesController`
- **Action:** `exportCsv`
- **Auth Required:** ✅ Yes

**Query Parameters:**
- `page` (number): 
- `limit` (number): 
- `search` (string): 
- `companyType` (string): 
- `status` (string): 
- `tag` (string): 
- `segment` (string): 
- `sortBy` (string): 
- `sortOrder` (string): 

**Responses:**
- **200**: 

---
### `POST` /api/admin/companies

**Summary:** Create a new B2B company

- **Controller:** `CompaniesController`
- **Action:** `create`
- **Auth Required:** ✅ Yes

**Request Body:**
```json
{
  "name": "Acme Luxury Travel",
  "companyType": "AGENCY",
  "email": "contact@acmetravel.com",
  "phone": "+1-555-0198",
  "website": "https://acmetravel.com",
  "address": {
    "street": "123 Elite Ave",
    "city": "London"
  },
  "primaryContact": {
    "name": "John Doe",
    "role": "Director",
    "email": "john@acmetravel.com"
  },
  "commissionRate": 10.5,
  "paymentTerms": "NET_30",
  "contractStartDate": "2026-01-01T00:00:00.000Z",
  "contractEndDate": "2027-01-01T00:00:00.000Z",
  "tags": [
    "string"
  ],
  "segments": [
    "string"
  ]
}
```

**Responses:**
- **201**: 

---
### `GET` /api/admin/companies

**Summary:** List companies with filters

- **Controller:** `CompaniesController`
- **Action:** `findAll`
- **Auth Required:** ✅ Yes

**Query Parameters:**
- `page` (number): 
- `limit` (number): 
- `search` (string): 
- `companyType` (string): 
- `status` (string): 
- `tag` (string): 
- `segment` (string): 
- `sortBy` (string): 
- `sortOrder` (string): 

**Responses:**
- **200**: 

---
### `GET` /api/admin/companies/{id}

**Summary:** Get company by ID with full relations

- **Controller:** `CompaniesController`
- **Action:** `findOne`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `id` (string): 

**Responses:**
- **200**: 

---
### `PATCH` /api/admin/companies/{id}

**Summary:** Update company details

- **Controller:** `CompaniesController`
- **Action:** `update`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `id` (string): 

**Request Body:**
```json
{
  "name": "Acme Luxury Travel",
  "companyType": "AGENCY",
  "status": "ACTIVE",
  "email": "contact@acmetravel.com",
  "phone": "+1-555-0198",
  "website": "https://acmetravel.com",
  "address": {
    "street": "123 Elite Ave",
    "city": "London"
  },
  "primaryContact": {
    "name": "John Doe",
    "role": "Director",
    "email": "john@acmetravel.com"
  },
  "commissionRate": 10.5,
  "currentBalance": 5000,
  "paymentTerms": "NET_30",
  "contractStartDate": "2026-01-01T00:00:00.000Z",
  "contractEndDate": "2027-01-01T00:00:00.000Z",
  "tags": [
    "string"
  ],
  "segments": [
    "string"
  ]
}
```

**Responses:**
- **200**: 

---
### `DELETE` /api/admin/companies/{id}

**Summary:** Soft delete a company

- **Controller:** `CompaniesController`
- **Action:** `remove`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `id` (string): 

**Responses:**
- **200**: 

---
### `PATCH` /api/admin/companies/bulk/update

**Summary:** Bulk update companies

- **Controller:** `CompaniesController`
- **Action:** `bulkUpdate`
- **Auth Required:** ✅ Yes

**Request Body:**
```json
{
  "companyIds": [
    "string"
  ],
  "status": "string",
  "tags": [
    "string"
  ],
  "segments": [
    "string"
  ]
}
```

**Responses:**
- **200**: 

---
## Admin - Currency Engine Module

### `GET` /api/admin/currency/rates

**Summary:** Get current global exchange rates from Redis Cache

- **Controller:** `CurrencyController`
- **Action:** `getRates`
- **Auth Required:** ✅ Yes

**Responses:**
- **200**: 

---
### `GET` /api/admin/currency/convert

**Summary:** Convert an amount between two currencies

- **Controller:** `CurrencyController`
- **Action:** `convert`
- **Auth Required:** ✅ Yes

**Query Parameters:**
- `amount` (number): Amount to convert
- `from` (string): Currency code to convert from (e.g., USD)
- `to` (string): Currency code to convert to (e.g., EUR)

**Responses:**
- **200**: 

---
## Admin - Finance & Commissions Module

### `GET` /api/admin/finance/commissions/metrics

**Summary:** Get global commission metrics

- **Controller:** `CommissionsController`
- **Action:** `getMetrics`
- **Auth Required:** ✅ Yes

**Responses:**
- **200**: 

---
### `GET` /api/admin/finance/commissions

**Summary:** List all partner commissions with pagination

- **Controller:** `CommissionsController`
- **Action:** `findAll`
- **Auth Required:** ✅ Yes

**Query Parameters:**
- `companyId` (string): 
- `bookingId` (string): 
- `status` (string): 
- `page` (number): 
- `limit` (number): 

**Responses:**
- **200**: 

---
### `POST` /api/admin/finance/commissions

**Summary:** Manually create a commission record for a booking

- **Controller:** `CommissionsController`
- **Action:** `createCommission`
- **Auth Required:** ✅ Yes

**Request Body:**
```json
{
  "companyId": "string",
  "bookingId": "string",
  "rate": "number",
  "amount": "number"
}
```

**Responses:**
- **201**: 

---
### `PATCH` /api/admin/finance/commissions/{id}/status

**Summary:** Update commission status (e.g. APPROVE)

- **Controller:** `CommissionsController`
- **Action:** `updateStatus`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `id` (string): 

**Request Body:**
```json
{
  "status": "string"
}
```

**Responses:**
- **200**: 

---
## Admin - Finance & Wallets Module

### `GET` /api/admin/finance/wallets/metrics

**Summary:** Get global wallet and liability metrics

- **Controller:** `WalletsController`
- **Action:** `getMetrics`
- **Auth Required:** ✅ Yes

**Responses:**
- **200**: 

---
### `GET` /api/admin/finance/wallets/{ownerType}/{ownerId}

**Summary:** Get or initialize a wallet for a User or Company

- **Controller:** `WalletsController`
- **Action:** `getWallet`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `ownerType` (string): 
- `ownerId` (string): 

**Responses:**
- **200**: 

---
### `GET` /api/admin/finance/wallets/{walletId}/transactions

**Summary:** Get transactions for a specific wallet

- **Controller:** `WalletsController`
- **Action:** `getTransactions`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `walletId` (string): 

**Query Parameters:**
- `walletId` (string): 
- `referenceType` (string): 

**Responses:**
- **200**: 

---
### `POST` /api/admin/finance/wallets/transactions/manual

**Summary:** Manually add a transaction to a wallet (Credit/Debit)

- **Controller:** `WalletsController`
- **Action:** `addManualTransaction`
- **Auth Required:** ✅ Yes

**Request Body:**
```json
{
  "ownerType": "string",
  "ownerId": "string",
  "amount": "number",
  "type": "string",
  "referenceType": "string",
  "referenceId": "string",
  "description": "string",
  "status": "string"
}
```

**Responses:**
- **201**: 

---
## Admin Users & CRM Module

### `GET` /api/admin/users/crm/metrics

**Summary:** Get live CRM analytics and dashboard metrics.

- **Controller:** `UsersController`
- **Action:** `getCrmDashboardMetrics`
- **Auth Required:** ✅ Yes

**Responses:**
- **200**: Aggregated CRM metrics object

---
### `GET` /api/admin/users/crm/export/csv

**Summary:** Export customers to CSV.

- **Controller:** `UsersController`
- **Action:** `exportCustomersCsv`
- **Auth Required:** ✅ Yes

**Query Parameters:**
- `page` (number): 
- `limit` (number): 
- `search` (string): Search by name, email, phone, or passport
- `isVip` (string): Filter by VIP status
- `status` (string): Filter by account status (e.g. ACTIVE, INACTIVE, BLOCKED)
- `tag` (string): Filter by specific tag
- `segment` (string): Filter by customer segment
- `sortBy` (string): 
- `sortOrder` (string): 

**Responses:**
- **200**: CSV data string

---
### `GET` /api/admin/users/crm/list

**Summary:** List customers with advanced enterprise filtering and pagination.

- **Controller:** `UsersController`
- **Action:** `listCustomersCrm`
- **Auth Required:** ✅ Yes

**Query Parameters:**
- `page` (number): 
- `limit` (number): 
- `search` (string): Search by name, email, phone, or passport
- `isVip` (string): Filter by VIP status
- `status` (string): Filter by account status (e.g. ACTIVE, INACTIVE, BLOCKED)
- `tag` (string): Filter by specific tag
- `segment` (string): Filter by customer segment
- `sortBy` (string): 
- `sortOrder` (string): 

**Responses:**
- **200**: Paginated list of customers with financial metrics

---
### `PATCH` /api/admin/users/crm/bulk/update

**Summary:** Bulk update customer segments, tags, VIP flags, or statuses.

- **Controller:** `UsersController`
- **Action:** `bulkUpdateCustomers`
- **Auth Required:** ✅ Yes

**Request Body:**
```json
{
  "userIds": [
    "string"
  ],
  "tags": [
    "string"
  ],
  "segments": [
    "string"
  ],
  "isVip": true,
  "status": "INACTIVE"
}
```

**Responses:**
- **200**: Customers bulk updated successfully

---
### `GET` /api/admin/users/crm/{id}

**Summary:** Get fully populated customer CRM detail profile.

- **Controller:** `UsersController`
- **Action:** `getCustomerCrmDetail`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `id` (string): 

**Responses:**
- **200**: Rich customer profile including bookings, payments, notes, documents, and timeline.

---
### `PATCH` /api/admin/users/crm/{id}

**Summary:** Update customer CRM profile fields.

- **Controller:** `UsersController`
- **Action:** `updateCustomerCrm`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `id` (string): 

**Request Body:**
```json
{
  "customerNumber": "CUST-2026-0001",
  "isVip": true,
  "tags": [
    "string"
  ],
  "segments": [
    "string"
  ],
  "status": "ACTIVE",
  "passportNumber": "P12345678",
  "nationality": "Egyptian",
  "gender": "Male",
  "dateOfBirth": "1985-05-15",
  "emergencyContact": {
    "name": "Sarah Connor",
    "relationship": "Spouse",
    "phone": "+123456789"
  },
  "address": {
    "street": "123 Nile Ave",
    "city": "Cairo",
    "country": "Egypt"
  },
  "preferredLanguage": "en",
  "preferredCurrency": "USD",
  "preferredDestination": "Sharm El Sheikh",
  "preferredTravelType": "Luxury Private",
  "familyMembers": [
    "string"
  ],
  "travelCompanions": [
    "string"
  ],
  "marketingConsent": true,
  "phoneVerified": true,
  "customerSource": "WEB",
  "referralSource": "VIP Referral",
  "futureCompanyId": "string",
  "futureWalletId": "string",
  "futureCommissionPlan": "string"
}
```

**Responses:**
- **200**: Updated customer CRM profile

---
### `POST` /api/admin/users/crm/{id}/notes

**Summary:** Add an internal, sales, or operations note to a customer.

- **Controller:** `UsersController`
- **Action:** `addCustomerNote`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `id` (string): 

**Request Body:**
```json
{
  "content": "Customer prefers suites with Nile view.",
  "noteType": "SALES",
  "isPinned": true
}
```

**Responses:**
- **200**: Customer note added successfully

---
### `POST` /api/admin/users/crm/{id}/documents

**Summary:** Attach a document (passport scan, visa, insurance, tickets) to a customer.

- **Controller:** `UsersController`
- **Action:** `addCustomerDocument`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `id` (string): 

**Request Body:**
```json
{
  "mediaAssetId": "media-uuid-1",
  "documentType": "PASSPORT",
  "title": "Passport Scan 2026"
}
```

**Responses:**
- **200**: Customer document attached successfully

---
### `GET` /api/admin/users

**Summary:** List all users with pagination and filtering.

- **Controller:** `UsersController`
- **Action:** `listUsers`
- **Auth Required:** ✅ Yes

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `search` (string): Search term for name or email
- `role` (string): Filter by role

**Responses:**
- **200**: Paginated list of users

---
### `POST` /api/admin/users

**Summary:** Create a new user.

- **Controller:** `UsersController`
- **Action:** `createUser`
- **Auth Required:** ✅ Yes

**Request Body:**
```json
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "password": "string",
  "role": "string"
}
```

**Responses:**
- **201**: The created user

---
### `GET` /api/admin/users/{id}

**Summary:** Get details for a single user.

- **Controller:** `UsersController`
- **Action:** `getUser`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `id` (string): 

**Responses:**
- **200**: User record
- **404**: User not found

---
### `PATCH` /api/admin/users/{id}

**Summary:** Update an existing user.

- **Controller:** `UsersController`
- **Action:** `updateUser`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `id` (string): 

**Request Body:**
```json
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "password": "string",
  "role": "string"
}
```

**Responses:**
- **200**: The updated user

---
### `DELETE` /api/admin/users/{id}

**Summary:** Soft delete a user.

- **Controller:** `UsersController`
- **Action:** `deleteUser`
- **Auth Required:** ✅ Yes

**Path Parameters:**
- `id` (string): 

**Responses:**
- **200**: User deleted

---
## Admin — Media Module

### `POST` /api/admin/media/upload

**Summary:** Upload a media asset

- **Controller:** `MediaAdminController`
- **Action:** `upload`
- **Auth Required:** ❌ No

**Request Body:**
*multipart/form-data upload*

**Responses:**
- **201**: 
  ```json
  {
    "id": "string",
    "publicId": "string",
    "url": "string",
    "secureUrl": "string",
    "providerName": "string",
    "format": "string",
    "mimeType": "string",
    "bytes": "number",
    "width": "object",
    "height": "object",
    "entityType": "string",
    "entityId": "object",
    "provenance": "string",
    "altText": "object",
    "uploadedBy": "object",
    "deletedAt": "object",
    "createdAt": "string",
    "updatedAt": "string"
  }
  ```
- **400**: 
- **401**: 
- **403**: 
- **502**: 

---
### `DELETE` /api/admin/media/{id}

**Summary:** Soft-delete a media asset

- **Controller:** `MediaAdminController`
- **Action:** `deleteAsset`
- **Auth Required:** ❌ No

**Path Parameters:**
- `id` (string): 

**Responses:**
- **200**: 
  ```json
  {
    "id": "string",
    "deletedAt": "string",
    "providerDeleteFailed": "boolean"
  }
  ```
- **401**: 
- **403**: 
- **404**: 

---
### `GET` /api/admin/media

**Summary:** List media assets (admin, paginated)

- **Controller:** `MediaAdminController`
- **Action:** `listAssets`
- **Auth Required:** ❌ No

**Query Parameters:**
- `page` (number): 
- `limit` (number): 
- `entityType` (string): 
- `entityId` (string): 
- `includeDeleted` (boolean): 

**Responses:**
- **200**: 
  ```json
  {
    "data": [
      {
        "id": "string",
        "publicId": "string",
        "url": "string",
        "secureUrl": "string",
        "providerName": "string",
        "format": "string",
        "mimeType": "string",
        "bytes": "number",
        "width": "object",
        "height": "object",
        "entityType": "string",
        "entityId": "object",
        "provenance": "string",
        "altText": "object",
        "uploadedBy": "object",
        "deletedAt": "object",
        "createdAt": "string",
        "updatedAt": "string"
      }
    ],
    "meta": {
      "total": "number",
      "page": "number",
      "limit": "number",
      "totalPages": "number"
    }
  }
  ```
- **401**: 
- **403**: 

---
