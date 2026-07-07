# 04 API Audit

## GET /health/live
- Controller: Derived from HealthController_checkLive
- Authentication: None
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /health/ready
- Controller: Derived from HealthController_checkReady
- Authentication: None
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /health
- Controller: Derived from HealthController_check
- Authentication: None
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /metrics
- Controller: Derived from PrometheusController_index
- Authentication: None
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/bookings
- Controller: Derived from AdminController_listBookings
- Authentication: Bearer
- Responses: 200, 401, 403
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/bookings/export/csv
- Controller: Derived from AdminController_exportBookingsCsv
- Authentication: Bearer
- Responses: 200, 401, 403
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/bookings/{referenceCode}
- Controller: Derived from AdminController_getBookingByReferenceCode
- Authentication: Bearer
- Responses: 200, 401, 403, 404
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## PATCH /admin/bookings/{referenceCode}
- Controller: Derived from AdminController_updateBooking
- Authentication: Bearer
- Responses: 200, 401, 403
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## DELETE /admin/bookings/{referenceCode}
- Controller: Derived from AdminController_softDeleteBooking
- Authentication: Bearer
- Responses: 200, 401, 403
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## PATCH /admin/bookings/bulk/update
- Controller: Derived from AdminController_bulkUpdateBookings
- Authentication: Bearer
- Responses: 200, 401, 403
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## PATCH /admin/bookings/{referenceCode}/status
- Controller: Derived from AdminController_updateBookingStatus
- Authentication: Bearer
- Responses: 200, 401, 403
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## PATCH /admin/bookings/{referenceCode}/passengers
- Controller: Derived from AdminController_upsertPassengers
- Authentication: Bearer
- Responses: 200, 401, 403
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## PATCH /admin/bookings/{referenceCode}/assign
- Controller: Derived from AdminController_assignBooking
- Authentication: Bearer
- Responses: 200, 401, 403
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## POST /admin/bookings/{referenceCode}/payments
- Controller: Derived from AdminController_addPayment
- Authentication: Bearer
- Responses: 200, 401, 403
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## POST /admin/bookings/{referenceCode}/notes
- Controller: Derived from AdminController_addBookingNote
- Authentication: Bearer
- Responses: 200, 401, 403
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## POST /admin/bookings/{referenceCode}/attachments
- Controller: Derived from AdminController_addBookingAttachment
- Authentication: Bearer
- Responses: 200, 401, 403
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/inquiries
- Controller: Derived from AdminController_listInquiries
- Authentication: Bearer
- Responses: 200, 401, 403
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/inquiries/{referenceCode}
- Controller: Derived from AdminController_getInquiryByReferenceCode
- Authentication: Bearer
- Responses: 200, 401, 403, 404
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## PATCH /admin/inquiries/{referenceCode}/status
- Controller: Derived from AdminController_updateInquiryStatus
- Authentication: Bearer
- Responses: 200, 400, 401, 403, 404
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/contact-submissions
- Controller: Derived from AdminController_listContactSubmissions
- Authentication: Bearer
- Responses: 200, 401, 403
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/contact-submissions/{referenceCode}
- Controller: Derived from AdminController_getContactSubmissionByReferenceCode
- Authentication: Bearer
- Responses: 200, 401, 403, 404
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## PATCH /admin/contact-submissions/{referenceCode}/status
- Controller: Derived from AdminController_updateContactSubmissionStatus
- Authentication: Bearer
- Responses: 200, 400, 401, 403, 404
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/notification-logs
- Controller: Derived from AdminController_listNotificationLogs
- Authentication: Bearer
- Responses: 200, 401, 403
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/dashboard
- Controller: Derived from AdminController_getDashboardMetrics
- Authentication: Bearer
- Responses: 200, 401, 403
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/tours
- Controller: Derived from AdminController_listTours
- Authentication: Bearer
- Responses: 200, 401, 403
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## POST /admin/tours
- Controller: Derived from AdminController_createTour
- Authentication: Bearer
- Responses: 200, 401, 403
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/tours/stats
- Controller: Derived from AdminController_getTourStats
- Authentication: Bearer
- Responses: 200, 401, 403
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/tours/export/csv
- Controller: Derived from AdminController_exportToursCsv
- Authentication: Bearer
- Responses: 200, 401, 403
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/tours/{slug}
- Controller: Derived from AdminController_getTourBySlug
- Authentication: Bearer
- Responses: 200, 401, 403, 404
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## PATCH /admin/tours/{slug}
- Controller: Derived from AdminController_updateTour
- Authentication: Bearer
- Responses: 200, 401, 403
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## DELETE /admin/tours/{slug}
- Controller: Derived from AdminController_softDeleteTour
- Authentication: Bearer
- Responses: 200, 401, 403
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## PATCH /admin/tours/bulk/update
- Controller: Derived from AdminController_bulkUpdateTours
- Authentication: Bearer
- Responses: 200, 401, 403
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## POST /auth/register
- Controller: Derived from AuthController_register
- Authentication: None
- Responses: 201, 409
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## POST /auth/login
- Controller: Derived from AuthController_login
- Authentication: None
- Responses: 200, 401
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## POST /auth/refresh
- Controller: Derived from AuthController_refresh
- Authentication: None
- Responses: 200, 401
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## POST /auth/logout
- Controller: Derived from AuthController_logout
- Authentication: None
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /auth/me
- Controller: Derived from AuthController_getMe
- Authentication: None
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /auth/csrf
- Controller: Derived from AuthController_getCsrfToken
- Authentication: None
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## POST /auth/forgot-password
- Controller: Derived from AuthController_forgotPassword
- Authentication: None
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## POST /auth/reset-password
- Controller: Derived from AuthController_resetPassword
- Authentication: None
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## POST /auth/verify-email
- Controller: Derived from AuthController_verifyEmail
- Authentication: None
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/users/crm/metrics
- Controller: Derived from UsersController_getCrmDashboardMetrics
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/users/crm/export/csv
- Controller: Derived from UsersController_exportCustomersCsv
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/users/crm/list
- Controller: Derived from UsersController_listCustomersCrm
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## PATCH /admin/users/crm/bulk/update
- Controller: Derived from UsersController_bulkUpdateCustomers
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/users/crm/{id}
- Controller: Derived from UsersController_getCustomerCrmDetail
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## PATCH /admin/users/crm/{id}
- Controller: Derived from UsersController_updateCustomerCrm
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## POST /admin/users/crm/{id}/notes
- Controller: Derived from UsersController_addCustomerNote
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## POST /admin/users/crm/{id}/documents
- Controller: Derived from UsersController_addCustomerDocument
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/users
- Controller: Derived from UsersController_listUsers
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## POST /admin/users
- Controller: Derived from UsersController_createUser
- Authentication: Bearer
- Responses: 201
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/users/{id}
- Controller: Derived from UsersController_getUser
- Authentication: Bearer
- Responses: 200, 404
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## PATCH /admin/users/{id}
- Controller: Derived from UsersController_updateUser
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## DELETE /admin/users/{id}
- Controller: Derived from UsersController_deleteUser
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /tours
- Controller: Derived from ToursController_findAll
- Authentication: None
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /tours/{slug}
- Controller: Derived from ToursController_findBySlug
- Authentication: None
- Responses: 200, 404
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## POST /bookings
- Controller: Derived from BookingsController_createBooking
- Authentication: None
- Responses: 201, 400, 422
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /bookings/me
- Controller: Derived from BookingsController_findUserBookings
- Authentication: None
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /bookings/{referenceCode}
- Controller: Derived from BookingsController_findByReferenceCode
- Authentication: None
- Responses: 200, 400, 404
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /invoices/{invoiceNumber}
- Controller: Derived from InvoicesController_findByInvoiceNumber
- Authentication: None
- Responses: 200, 400, 404
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## POST /inquiries
- Controller: Derived from PublicInquiriesController_create
- Authentication: None
- Responses: 201, 400, 429
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/communications/logs/metrics
- Controller: Derived from NotificationsController_getMetrics
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/communications/logs
- Controller: Derived from NotificationsController_findAll
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## POST /admin/communications/logs/{id}/retry
- Controller: Derived from NotificationsController_retryNotification
- Authentication: Bearer
- Responses: 201
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## POST /contact
- Controller: Derived from ContactSubmissionsController_create
- Authentication: None
- Responses: 201, 422, 429
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## POST /admin/media/upload
- Controller: Derived from MediaAdminController_upload
- Authentication: None
- Responses: 201, 400, 401, 403, 502
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## DELETE /admin/media/{id}
- Controller: Derived from MediaAdminController_deleteAsset
- Authentication: None
- Responses: 200, 401, 403, 404
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/media
- Controller: Derived from MediaAdminController_listAssets
- Authentication: None
- Responses: 200, 401, 403
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /media/tours/{tourId}
- Controller: Derived from MediaPublicController_getAssetsByTourId
- Authentication: None
- Responses: 200, 400
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/companies/metrics
- Controller: Derived from CompaniesController_getMetrics
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/companies/export/csv
- Controller: Derived from CompaniesController_exportCsv
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## POST /admin/companies
- Controller: Derived from CompaniesController_create
- Authentication: Bearer
- Responses: 201
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/companies
- Controller: Derived from CompaniesController_findAll
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/companies/{id}
- Controller: Derived from CompaniesController_findOne
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## PATCH /admin/companies/{id}
- Controller: Derived from CompaniesController_update
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## DELETE /admin/companies/{id}
- Controller: Derived from CompaniesController_remove
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## PATCH /admin/companies/bulk/update
- Controller: Derived from CompaniesController_bulkUpdate
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/finance/wallets/metrics
- Controller: Derived from WalletsController_getMetrics
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/finance/wallets/{ownerType}/{ownerId}
- Controller: Derived from WalletsController_getWallet
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/finance/wallets/{walletId}/transactions
- Controller: Derived from WalletsController_getTransactions
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## POST /admin/finance/wallets/transactions/manual
- Controller: Derived from WalletsController_addManualTransaction
- Authentication: Bearer
- Responses: 201
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/finance/commissions/metrics
- Controller: Derived from CommissionsController_getMetrics
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/finance/commissions
- Controller: Derived from CommissionsController_findAll
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## POST /admin/finance/commissions
- Controller: Derived from CommissionsController_createCommission
- Authentication: Bearer
- Responses: 201
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## PATCH /admin/finance/commissions/{id}/status
- Controller: Derived from CommissionsController_updateStatus
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## POST /admin/ai/itinerary/generate
- Controller: Derived from AiController_generateItinerary
- Authentication: Bearer
- Responses: 201
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## POST /admin/ai/customer/{id}/analyze
- Controller: Derived from AiController_analyzeCustomer
- Authentication: Bearer
- Responses: 201
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/currency/rates
- Controller: Derived from CurrencyController_getRates
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

## GET /admin/currency/convert
- Controller: Derived from CurrencyController_convert
- Authentication: Bearer
- Responses: 200
- Exact File Path: src/modules/...
- Recommended Fix: Ensure input validation pipe is active.

