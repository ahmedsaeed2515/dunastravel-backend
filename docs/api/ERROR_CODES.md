# Standard Error Codes

| Code | Type | Meaning | How to Handle |
|---|---|---|---|
| **400** | Bad Request | ValidationPipe rejected the DTO payload. | Fix the form fields and retry. |
| **401** | Unauthorized | JWT missing, expired, or invalid. | Attempt silent refresh or redirect to login. |
| **403** | Forbidden | User lacks the required RBAC role. | Hide the UI element or display access denied. |
| **404** | Not Found | The requested resource (or endpoint) does not exist. | Show a 404 page or remove the item from local state. |
| **409** | Conflict | Unique constraint violation (e.g. Prisma P2002). | Alert the user that the entity already exists. |
| **422** | Unprocessable | Semantic validation failed (e.g. invalid status transition). | Display business logic error message. |
| **429** | Too Many Requests | Throttler Guard intercepted excessive requests. | Wait 60 seconds before retrying. |
| **500** | Internal Error | Unhandled exception occurred. | Alert the team; check correlation ID in logs. |
