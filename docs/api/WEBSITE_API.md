# Website & Customer API

## Auth Module

### `POST` /api/auth/register

**Summary:** Register a new user

- **Controller:** `AuthController`
- **Action:** `register`
- **Auth Required:** ❌ No

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "phone": "+1 234 567 8900",
  "password": "StrongPass123"
}
```

**Responses:**
- **201**: 
- **409**: 

---
### `POST` /api/auth/login

**Summary:** Login

- **Controller:** `AuthController`
- **Action:** `login`
- **Auth Required:** ❌ No

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "password": "StrongPass123"
}
```

**Responses:**
- **200**: 
- **401**: 

---
### `POST` /api/auth/refresh

**Summary:** Refresh access token

- **Controller:** `AuthController`
- **Action:** `refresh`
- **Auth Required:** ❌ No

**Responses:**
- **200**: 
- **401**: 

---
### `POST` /api/auth/logout

**Summary:** Logout

- **Controller:** `AuthController`
- **Action:** `logout`
- **Auth Required:** ❌ No

**Responses:**
- **200**: 

---
### `GET` /api/auth/me

**Summary:** Get current user profile

- **Controller:** `AuthController`
- **Action:** `getMe`
- **Auth Required:** ❌ No

**Responses:**
- **200**: 

---
### `GET` /api/auth/csrf

**Summary:** Get CSRF token

- **Controller:** `AuthController`
- **Action:** `getCsrfToken`
- **Auth Required:** ❌ No

**Responses:**
- **200**: 

---
### `POST` /api/auth/forgot-password

**Summary:** Request password reset

- **Controller:** `AuthController`
- **Action:** `forgotPassword`
- **Auth Required:** ❌ No

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Responses:**
- **200**: 

---
### `POST` /api/auth/reset-password

**Summary:** Reset password using token

- **Controller:** `AuthController`
- **Action:** `resetPassword`
- **Auth Required:** ❌ No

**Request Body:**
```json
{
  "token": "abc123token",
  "newPassword": "NewStrongPassword123!"
}
```

**Responses:**
- **200**: 

---
### `POST` /api/auth/verify-email

**Summary:** Verify user email

- **Controller:** `AuthController`
- **Action:** `verifyEmail`
- **Auth Required:** ❌ No

**Request Body:**
```json
{
  "token": "verify123token"
}
```

**Responses:**
- **200**: 

---
## Bookings Module

### `POST` /api/bookings

**Summary:** Create a tour booking

- **Controller:** `BookingsController`
- **Action:** `createBooking`
- **Auth Required:** ❌ No

**Request Body:**
```json
{
  "tourId": "string",
  "arrivalDate": "2027-03-15",
  "departureDate": "2027-03-22",
  "adults": 2,
  "children": "number",
  "infants": "number",
  "transportChoice": "flight",
  "notes": "string",
  "passengerNames": [
    {
      "id": "string",
      "passengerType": "string",
      "fullName": "string",
      "passportNumber": "string",
      "passportExpiry": "string",
      "dateOfBirth": "string",
      "nationality": "string"
    }
  ],
  "billing": {
    "phone": "string",
    "invoiceType": "string"
  }
}
```

**Responses:**
- **201**: Booking created successfully
- **400**: Validation failed or invalid tour
- **422**: Tour not available

---
### `GET` /api/bookings/me

**Summary:** Get all bookings for current user

- **Controller:** `BookingsController`
- **Action:** `findUserBookings`
- **Auth Required:** ❌ No

**Responses:**
- **200**: List of user bookings

---
### `GET` /api/bookings/{referenceCode}

**Summary:** Get booking summary by reference code

- **Controller:** `BookingsController`
- **Action:** `findByReferenceCode`
- **Auth Required:** ❌ No

**Path Parameters:**
- `referenceCode` (string): 

**Query Parameters:**
- `email` (string): 

**Responses:**
- **200**: Booking summary
- **400**: Invalid reference format
- **404**: Booking not found

---
## Contact Module

### `POST` /api/contact

**Summary:** Submit a contact inquiry

- **Controller:** `ContactSubmissionsController`
- **Action:** `create`
- **Auth Required:** ❌ No

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "+1234567890",
  "subject": "Inquiry regarding custom tour",
  "message": "I would like to know if you organize customized tours in Europe.",
  "locale": "en"
}
```

**Responses:**
- **201**: The contact submission was successfully received.
  ```json
  {
    "data": {
      "referenceCode": "CON-A3F9K2",
      "message": "Your message has been received. We will be in touch shortly."
    }
  }
  ```
- **422**: Validation failed.
- **429**: Rate limit exceeded.

---
## Health Module

### `GET` /api/health/live

**Summary:** Liveness probe for basic process health

- **Controller:** `HealthController`
- **Action:** `checkLive`
- **Auth Required:** ❌ No

**Responses:**
- **200**: 

---
### `GET` /api/health/ready

**Summary:** Readiness probe checking database connectivity

- **Controller:** `HealthController`
- **Action:** `checkReady`
- **Auth Required:** ❌ No

**Responses:**
- **200**: 

---
### `GET` /api/health

**Summary:** Legacy health endpoint, delegates to readiness probe

- **Controller:** `HealthController`
- **Action:** `check`
- **Auth Required:** ❌ No

**Responses:**
- **200**: 

---
## Inquiries (Public) Module

### `POST` /api/inquiries

**Summary:** Submit a new tailor-made tour inquiry

- **Controller:** `PublicInquiriesController`
- **Action:** `create`
- **Auth Required:** ❌ No

**Request Body:**
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "phone": "+1 (555) 123-4567",
  "preferredLanguage": "en",
  "destinations": [
    "string"
  ],
  "startDate": "2027-10-01",
  "endDate": "2027-10-15",
  "adults": 2,
  "children": "number",
  "budgetAmount": 5000,
  "budgetCurrency": "USD",
  "notes": "We want a family friendly trip with lots of history."
}
```

**Responses:**
- **201**: Inquiry successfully submitted
- **400**: Validation failed
- **429**: Rate limit exceeded

---
## Invoices Module

### `GET` /api/invoices/{invoiceNumber}

**Summary:** Get invoice details by invoice number

- **Controller:** `InvoicesController`
- **Action:** `findByInvoiceNumber`
- **Auth Required:** ❌ No

**Path Parameters:**
- `invoiceNumber` (string): 

**Responses:**
- **200**: Full invoice for display or printing
- **400**: Invalid invoice number format
- **404**: Invoice not found

---
## Media Module

### `GET` /api/media/tours/{tourId}

**Summary:** Get all active media assets for a tour

- **Controller:** `MediaPublicController`
- **Action:** `getAssetsByTourId`
- **Auth Required:** ❌ No

**Path Parameters:**
- `tourId` (string): 

**Responses:**
- **200**: 
  ```json
  [
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
  ]
  ```
- **400**: 

---
## Prometheus Module

### `GET` /api/metrics

- **Controller:** `PrometheusController`
- **Action:** `index`
- **Auth Required:** ❌ No

**Responses:**
- **200**: 

---
## Tours Module

### `GET` /api/tours

**Summary:** List all active tours

- **Controller:** `ToursController`
- **Action:** `findAll`
- **Auth Required:** ❌ No

**Query Parameters:**
- `lang` (string): 
- `category` (string): 
- `page` (number): 
- `limit` (number): 

**Responses:**
- **200**: Paginated list of tours

---
### `GET` /api/tours/{slug}

**Summary:** Get full tour details by slug

- **Controller:** `ToursController`
- **Action:** `findBySlug`
- **Auth Required:** ❌ No

**Path Parameters:**
- `slug` (string): 

**Query Parameters:**
- `lang` (string): 

**Responses:**
- **200**: Full tour detail with itinerary and images
- **404**: Tour not found

---
