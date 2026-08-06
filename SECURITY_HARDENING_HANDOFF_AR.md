# تسليم مهمة تأمين Dunas Travel Backend

آخر تحديث: 2026-07-26  
مسار المشروع: `D:\@@project\LUXURY-PROJECT\dunastravel-backend`

## الهدف الحقيقي

المطلوب هو جعل الباك إند مقاومًا للتلاعب حتى لو كان المهاجم يعرف كل الـrequests والـroutes ويراقب الـNetwork، عن طريق:

- عدم الثقة في أي قيمة قادمة من الواجهة.
- فرض الصلاحية والملكية داخل الـService وليس في الواجهة فقط.
- جعل العمليات المالية والحجوزات ذرية وقابلة لإعادة الطلب بأمان.
- منع Mass Assignment وIDOR وReplay وRace Conditions وتسريب الأسرار والـPII.
- تقليل أثر الحساب المخترق، خصوصًا حساب ADMIN، وحصر العمليات المالية الخطرة في SUPER_ADMIN.
- تقليل قابلية إسقاط الخدمة عن طريق Pagination وحدود المدخلات وتجميع البيانات داخل قاعدة البيانات.
- تسجيل التغييرات الحساسة في Audit logs لا تحتوي على أسرار.

مهم: لا يوجد نظام يمكن وصفه بصدق بأنه “مستحيل الاختراق”. الهدف هو Defense in Depth، إغلاق المسارات المعروفة، تقليل مساحة الهجوم، واكتشاف أي محاولة أو تغيير غير مشروع.

## تعليمات المستخدم الحالية التي يجب احترامها

- لا تشغّل حاليًا أي أمر Build أو Test أو Lint أو Typecheck أو Audit أو Prisma Validate/Generate.
- لا تشغّل أوامر بطيئة مشابهة.
- المستخدم سيشغّل الفحوصات في النهاية ويرسل الأخطاء.
- المسموح أثناء استكمال الكود: القراءة اليدوية المحددة، البحث المحدد، والتعديل بـ`apply_patch`.
- لا تستخدم أوامر Git مدمرة، ولا تعمل Reset أو Checkout لتعديلات المستخدم.
- لا تعدّل ملفات لا تخص المهمة أو تمسح ملفات موجودة لمجرد تنظيف الشجرة.

## ملفات كانت متغيرة من المستخدم قبل/أثناء العمل ويجب التعامل معها بحذر

هذه الملفات كان معروفًا أن بها عملًا للمستخدم أو اختبارات غير متتبعة. لا تستبدلها ولا تمسحها، وافحص أي تداخل يدويًا:

- `openapi-spec.json`
- `src/modules/admin/admin-wallets/admin-wallets.controller.ts`
- `src/modules/admin/admin-wallets/admin-wallets.service.ts`
- `src/modules/availability/availability.service.ts`
- `src/modules/bookings/dto/passenger.dto.ts`
- `src/modules/currency/currency.service.ts`
- `src/modules/admin/admin-wallets/admin-wallets.service.spec.ts`
- `src/modules/availability/availability.service.spec.ts`
- `src/modules/bookings/passenger.dto.spec.ts`
- `src/modules/currency/currency.service.spec.ts`
- `src/modules/payments/adapters/stripe.adapter.spec.ts`

الشجرة حاليًا كبيرة ومليئة بتعديلات أمان مقصودة. لا تعتبر `git status` سببًا لإعادة أي ملف.

## منهج العمل الذي تم اتباعه

لكل Feature تم المرور قدر الإمكان بهذا الترتيب:

1. تحديد الـController الفعال فعلًا من خلال Module graph، وليس مجرد وجود ملف Controller.
2. حصر كل Route: هل هو Public أم Authenticated؟ وما الأدوار المسموحة؟
3. فحص كل Path/Query/Header/Body DTO:
   - UUID/slug/reference بصيغة صارمة.
   - Enums allowlist.
   - حدود طول وعدد وقيمة.
   - منع NaN/Infinity والقيم السالبة.
   - منع الحقول التي يجب أن يقررها السيرفر.
4. إعادة التحقق داخل الـService:
   - Ownership.
   - حالة الحساب والشركة والحجز والرحلة.
   - عدم الاعتماد على الـController وحده.
5. فحص المعاملة:
   - Transaction واحدة للتغيير والسجل المالي/الـaudit.
   - Conditional update أو unique constraint لمقاومة السباقات.
   - Serializable عند الحاجة.
6. فحص Replay/Idempotency.
7. فحص Response:
   - Explicit select.
   - عدم إرجاع passwordHash أو refresh/reset/verify tokens أو session URLs أو guestTokenHash أو requestHash.
8. فحص Logs/Audit:
   - لا PII أو أسرار.
   - actorId وactorRole الحقيقيان.
9. فحص Availability/DoS:
   - Pagination وحدود.
   - عدم تحميل ملايين الصفوف في الذاكرة.
10. فحص Cache invalidation والملفات الخارجية بعد نجاح المعاملة.

## ما تم تنفيذه

### 1. طبقة المصادقة والجلسات

- جعل JWT الافتراضي Default-Deny عالميًا، والـPublic routes تحتاج `@Public()` صريحًا.
- التحقق من:
  - حالة المستخدم.
  - التعليق والحذف.
  - تفعيل البريد عند تفعيل السياسة.
  - عضوية الشركة الفعالة.
  - `sessionVersion`.
- تدوير Refresh token ومنع إعادة استخدامه بعملية conditional update.
- تخزين Refresh/Reset/Verify tokens كـhash وليس plaintext.
- إبطال الجلسات عند تغيير كلمة السر أو الدور أو التعليق أو تعطيل الشركة.
- فصل `JWT_SECRET` و`JWT_REFRESH_SECRET` و`GUEST_TOKEN_SECRET`.
- فرض issuer/audience/algorithm على JWT.
- إضافة سياسة قوية لكلمات السر.
- مقاومة enumeration/timing في تسجيل الدخول باستخدام dummy bcrypt hash.
- جعل Reset Password ذريًا؛ نفس token لا ينجح في طلبين متزامنين.
- جعل Change Password ذريًا؛ نفس كلمة السر القديمة لا تنجح مرتين متزامنتين.
- Cookie flags أصبحت آمنة في `production` و`staging`.

### 2. CSRF وCORS وHTTP

- إضافة CSRF double-submit للطلبات المعتمدة على Cookies.
- إصلاح ثغرة مهمة: لم يعد إرسال `Authorization: Bearer` وهمي يعفي طلبًا يستخدم Cookie session من CSRF.
- التحقق من Origin المسموح.
- Webhooks فقط تستخدم `@SkipCsrf()`.
- CORS exact allowlist بدون wildcard.
- Helmet وسياسات Security headers.
- تعطيل ضغط الردود التي تحتوي على Cookies أو Authorization أو Guest token لتقليل مخاطر compression side channels.
- حفظ raw body للـpayment webhook فقط بدل كل الطلبات.
- حد JSON وURL-encoded يساوي 1MB.
- `urlencoded` أصبح `extended: false`.
- Swagger أصبح في development فقط، وليس staging/production.
- Timeout أصبح يرمي `RequestTimeoutException` حقيقيًا.
- Health routes لم تعد تتجاوز الـglobal throttling.
- أخطاء 5xx وPrisma لا تعيد stack أو تفاصيل قاعدة البيانات للعميل.

### 3. Environment وSecrets والتشغيل

- Joi validation قوية للأسرار والروابط والإعدادات.
- HTTPS مطلوب في production وstaging.
- Redis password مطلوب في production وstaging.
- `PII_ENCRYPTION_KEY` مطلوب في production وstaging، بصيغة 64 hex character.
- تشديد إعدادات Mail/Stripe/Cloudinary.
- Redis cache/throttling مشترك بدل الاعتماد على Memory لكل instance.
- تحسين structured logging وإخفاء stack في production.
- تحسين Docker/Compose/backup safety وإزالة خدمة backup مكررة قديمة.
- تنقية seeds ومنع credentials ضعيفة أو افتراضية.

### 4. الصلاحيات والأدوار

- SUPER_ADMIN يتجاوز RolesGuard بشكل صريح.
- العمليات المالية وتغيير الشروط والعمولات والوكالات الحساسة حُصرت غالبًا في SUPER_ADMIN.
- أي انتقال إلى دور غير USER أصبح privileged ولا يستطيع ADMIN العادي إنشاء/ترقية AGENT/COMPANY/GUEST.
- حماية آخر SUPER_ADMIN من التعليق/الإزالة في المسارات التي تمت مراجعتها.
- إبطال جلسات المستخدمين عند تعطيل/حظر الشركة أو الوكالة.
- AGENT لا يرى أو يعدّل إلا الحجوزات/الاستفسارات المسندة إليه في المسارات التي تسمح له.

### 5. الحجوزات

- حماية الحجز الضيف بـGuest token hashed والتحقق constant-time.
- إخفاء وجود الحجز غير المملوك بإرجاع 404.
- `Idempotency-Key` أصبح مطلوبًا لإنشاء حجز الرحلة في Controller وService.
- تخزين request hash ومنع استخدام نفس المفتاح مع Payload مختلفة أو مستخدم آخر.
- Replay يعيد نفس الحجز/Guest token المحدد بدل إنشاء حجز جديد.
- حجز السعة وتطبيق الكوبون وإنشاء الحجز والفاتورة والركاب داخل transaction.
- Conditional capacity reserve/release.
- منع overbooking وpromo quota races.
- منع التلاعب بالسعر؛ السعر يعاد حسابه من Tour/Availability/Promotion في الباك.
- Snapshot ثابت للفاتورة.
- التحقق من تطابق عدد الركاب مع adults/children/infants.
- تشفير أرقام الجوازات.
- منع حالات PAID/PARTIALLY_PAID/REFUNDED من الإلغاء العادي.
- منع تغيير الحالات المالية يدويًا؛ تتحكم فيها الـpayment ledger.
- تضييق state machine:
  - لا أرشفة لحجز PENDING/CONFIRMED/PARTIALLY_PAID/PAID.
  - PAID ينتقل إلى COMPLETED فقط إداريًا.
  - الأرشفة للحالات النهائية.
- منع Cancel إذا `paidAmountUsd` غير صفر؛ يجب استخدام refund workflow.
- Restore يعيد حجز السعة والكوبون ذريًا.
- إلغاء العميل ينقّي السبب، يستبعد المحذوف/المؤرشف، ويسجل Activity داخل نفس transaction.
- إصلاح متغير `safeReason` كان في دالة خاطئة.
- رد transition status أصبح explicit select ولا يعيد:
  - `guestTokenHash`
  - `requestHash`
  - `idempotencyKey`
  - بيانات داخلية غير لازمة.
- Pagination وحدود بحث وفرز allowlist.
- CSV export لـSUPER_ADMIN مع منع CSV formula injection والاقتباس الصحيح.
- Bulk update تم تضييقه وإزالة bulk status الذي كان يتجاوز state machine.
- Assignment يتحقق من مستخدم فعال بدور ADMIN/AGENT.
- الحجز اليدوي:
  - لا ينسب حجز الضيف إلى الـadmin.
  - يتحقق من USER فعال وبريد مطابق عند تمرير userId.
  - يتطلب Idempotency-Key.
  - يسجل Activity وAudit.
  - تسجيله أصبح idempotent قدر الإمكان.
- Notes/attachments/passengers لها حدود وتعقيم وربط ملكية للأصل الإعلامي.
- تفاصيل الحجز الإدارية تستبعد المحذوف وتحد Activity/Notes/Attachments/Payments إلى 500 سجل لكل مجموعة بدل تحميل غير محدود.

### 6. الدفع والاسترداد

- ربط payment initiation بمالك الحجز أو Guest token.
- التحقق من immutable financial snapshot والعملة USD.
- منع الدفع الزائد.
- Pending checkout واحد لكل حجز عبر قيد قاعدة بيانات.
- إعادة استخدام session صالح وإلغاء orphan session في السباق.
- Webhook:
  - توقيع raw body.
  - Provider allowlist.
  - event idempotency في قاعدة البيانات.
  - التحقق من amount/currency/transaction/booking.
  - Serializable retries.
  - لا يثق في client status.
- unique partial index لـ`transaction_id`.
- Manual payment:
  - SUPER_ADMIN فقط.
  - transaction reference مطلوب وفريد.
  - full ledger record.
  - تحديث booking paid/status ذريًا.
  - Activity وAudit.
- Refund:
  - SUPER_ADMIN فقط دفاعيًا داخل Service أيضًا.
  - سبب مطلوب/منقّى ومحدود.
  - Idempotency key مطلوب.
  - Full refund فقط.
  - تم إغلاق خطأ مالي: لا يمكن استرداد دفعة واحدة وتعليم حجز متعدد الدفعات كله REFUNDED.
  - الاسترداد مسموح حاليًا فقط عندما يكون الحجز PAID وله دفعة CAPTURED واحدة تساوي كامل الإجمالي والمدفوع.
  - Recovery lease ومحاولات الاسترداد المتزامنة محمية.
  - عكس promo/capacity/invoice/audit عند اكتمال الاسترداد.
- Payment status لا يعيد session URL.
- Payment cron يتعامل مع sessions المنتهية وحدود الدفعات.

### 7. العمولات والمحافظ والفواتير

- Manual commission أصبح SUPER_ADMIN.
- Commission updates لها state machine وربط بالحجز والشركة.
- عكس العمولات عند refund مع سجل reconciliation عند الفشل.
- Manual wallet transaction أصبح SUPER_ADMIN.
- العميل لا يقرر reference type/status في manual wallet DTO.
- قيود unique على business references.
- reconciliation للـwallet ledger.
- Invoice public access مرتبط بمالك الحجز أو Guest token.
- Invoice admin void/refund حُصرت في SUPER_ADMIN.
- Explicit safe responses بدل Prisma objects الكاملة في مسارات متعددة.

### 8. المستخدمون وCRM والـPII

- SafeUser يستبعد passwordHash وrefresh/reset/verify/session secrets.
- CRM list/detail/CSV مع Pagination وحدود وCSV injection protection.
- Customer documents مرتبطة بـMediaAsset واحد ولا تقبل asset مستخدمًا في كيان آخر.
- إضافة قيد قاعدة بيانات لسلامة customer documents.
- Notes وactivity logs منقاة ولا تسجل أسرار.
- تشفير AES-256-GCM عشوائي لكل قيمة مع IV وAuth tag:
  - User passport.
  - Passenger passport.
  - User emergency contact JSON.
  - User address JSON.
  - User family members JSON.
  - User travel companions JSON.
- القراءة تدعم plaintext القديم مؤقتًا.
- الإنتاج وstaging يفشلان مغلقًا إذا المفتاح ناقص/غير صالح.
- إضافة `src/scripts/encrypt-existing-pii.ts`.
- إضافة script في package باسم `security:encrypt-pii`.
- السكربت idempotent ويشفّر البيانات القديمة على batches.

مهم جدًا: لا تغيّر `PII_ENCRYPTION_KEY` بعد تشفير البيانات إلا بعملية key rotation تعيد التشفير. ضياع المفتاح يعني ضياع القدرة على قراءة البيانات.

### 9. الرحلات وAvailability والواجهات

- Slug/UUID parsing صارم.
- DTOs محدودة ومتعقمة للحقول النصية والـlocalized JSON.
- إزالة حقول `Tour.capacity` و`Tour.remainingSeats` الوهمية؛ السعة ملك Availability.
- Bulk tour mutations محدودة وذرية.
- لا تفعيل إلا للحالة المنشورة في المسارات التي تمت مراجعتها.
- Soft delete يعطل الرحلة.
- Availability:
  - UUID validation.
  - status allowlist.
  - integer/max capacities.
  - أيام تكرار 0..6 وفريدة.
- Tour images:
  - لا تقبل URL يدويًا غير مرتبط بـMediaAsset.
  - الأصل يجب أن يكون TOUR ولنفس الرحلة ومن رفع الـactor.
  - HTTPS وصورة فعلية.
  - Hero واحد منطقيًا، ومع migration لقيد Hero وحيد.
  - add/remove/reorder داخل transaction مع activity وcache invalidation.
- Itinerary add/update/delete:
  - حدود وتعقيم localized JSON.
  - transaction وactivity وcache invalidation.
- Landing pages:
  - state machine للنشر/التفعيل/الأرشفة.
  - لا Active إلا PUBLISHED.
  - mutation routes الحساسة SUPER_ADMIN.

### 10. Media والملفات

- الصور فقط: JPEG/PNG/WebP.
- فحص MIME والـmagic bytes.
- Multer limits:
  - ملف واحد.
  - 10MB.
  - عدد وحجم fields/parts محدود.
- التحقق من output provider:
  - HTTPS.
  - format allowlist.
  - bytes/dimensions/pixel count.
- cleanup للأصل الخارجي عند فشل DB.
- لا حذف لأصل مستخدم في CustomerDocument/BookingAttachment.
- ADMIN العادي يحذف ما رفعه فقط؛ SUPER_ADMIN يستطيع الكل.
- upload يتطلب actor ويسجل Audit داخل transaction.
- TOUR media يتطلب entityId لرحلة غير محذوفة.
- GENERAL media لا يخزن entityId.
- scheduled orphan cleanup أصبح batch 500 وبدون N+1 queries.
- migration تمنع Hero images متعددة لنفس الرحلة.

### 11. الاستفسارات وContact وTailor Made

- Public DTOs محدودة ومتعقمة ومحمية بالـthrottling.
- Reference pipes صارمة لـInquiry وContact.
- إزالة parseInt المرن الذي كان يقبل `123abc`.
- Agent ownership للاستفسارات.
- Assignment يتحقق من AGENT فعال.
- State machines وconditional updates وAudit.
- Tailor-made:
  - إزالة circular dependency غير الضروري.
  - Quote bounds وحالات مسموحة.
  - Conversion إلى Booking داخل Serializable transaction.
  - Explicit selections.
- Contact status transition ذري.
- actorRole في Contact audit أصبح الدور الحقيقي، وليس `ADMIN` hardcoded.

### 12. الوكالات والشركات والوكلاء

- Public agency registration:
  - لا يعيد Company record كامل أو tax ID أو balance.
  - رد ثابت لا يكشف وجود البريد/الرقم الضريبي.
  - INACTIVE لحين المراجعة.
  - تعقيم القيم.
  - transaction مع Audit بلا PII.
  - retries للسباقات.
- Migration تضيف case-insensitive unique indexes للبريد والرقم الضريبي للشركات الفعالة.
- Admin agency status/tier/commission محمية ومحددة.
- تعطيل/حظر الشركة يلغي جلسات أعضائها.
- Agent creation/update/delete SUPER_ADMIN، وكلمات السر قوية، والردود لا تعيد hash.

ملاحظة: كان آخر عمل مخطط هو دمج Agent mutation وAudit في transaction واحدة. لم يتم تنفيذ هذا الجزء بعد لأن المستخدم أوقف العمل. الـController ما زال ينفذ التغيير ثم `AuditService.log()` في خطوة منفصلة.

### 13. النقل

- Create transportation booking يتطلب مستخدمًا مصادقًا.
- تواريخ وحدود ركاب/حقائب وأماكن وflight number صارمة.
- السعر يحسب من الخدمة في الباك.
- Admin status transition state machine.
- Driver/vehicle conflict check وconditional update وAudit.
- أضيف Idempotency كامل:
  - `Idempotency-Key` header.
  - request hash.
  - compound unique `(userId, idempotencyKey)`.
  - replay يعيد نفس الحجز.
  - mismatched payload يرفض.
  - لا تعاد idempotencyKey أو requestHash في responses العامة/الإدارية.
- أضيفت migration وحقول Prisma لهذا الغرض.

### 14. Reviews/CMS/Blogs/FAQ/Destinations/Journey Maps

- تعطيل Modules/Controllers قديمة مكررة من الـactive module graph.
- Review:
  - reviewer name من المستخدم وليس من body.
  - booking ownership.
  - unique booking review.
  - status/publish consistency.
  - admin reply/comment sanitization.
  - transactions وAudit.
- CMS:
  - keys/content validated.
  - mutations مع actor وAudit.
  - delete SUPER_ADMIN.
- Blogs/Destinations/FAQ/Journey Maps:
  - Slug/UUID pipes.
  - locale/query DTOs.
  - rate limits العامة.
  - mutation roles.
  - bounds وتعقيم.

### 15. Analytics وDashboard وAI

- Browser analytics event allowlist وserver-only event denylist.
- properties محدودة، والمفاتيح الحساسة تُسقط.
- referrer يخزن origin+path فقط بدون query.
- date ranges بحد 366 يومًا.
- Dashboard:
  - query allowlists للتاريخ والعملة واللغة والمنطقة الزمنية والـslugs.
  - إزالة أرقام إشغال ثابتة وهمية.
  - حساب السعة والإشغال من TourAvailability.
  - تحويل أثقل الاستعلامات إلى DB groupBy/aggregates.
  - traffic/interface/tour events لا تحمل كل الأحداث في الذاكرة.
  - revenue/bookings trends تستخدم parameterized `Prisma.sql` بتجميع day/week/month.
  - net collected payments يطرح Completed refunds.
  - funnel لم يعد يصنع حدًا أدنى وهميًا من الزيارات.
  - action-center يحسب الرحلات ذات المقاعد القليلة من Availability الفعلية.
- AI:
  - provider disabled افتراضيًا.
  - public AI feature flag.
  - limits للوقت والتوكنز والـquota.
  - input injection heuristics.
  - output schema validation وتعقيم.
  - customer analysis لا يحمّل كل التاريخ؛ آخر 50 حجزًا وآخر 5 notes فقط.
  - إزالة ToolsModule القديم من AppModule لمنع مضاعفة public AI quota عبر مسارين.

## Migrations الجديدة

بالترتيب:

1. `20260726000000_security_session_version`
2. `20260726010000_financial_idempotency`
3. `20260726020000_promotion_decimal`
4. `20260726030000_customer_document_integrity`
5. `20260726040000_payment_transaction_integrity`
6. `20260726050000_company_identity_integrity`
7. `20260726060000_tour_hero_integrity`
8. `20260726070000_transportation_idempotency`

بعض migrations تتوقف عمدًا إذا كانت البيانات الحالية غير سليمة، مثل:

- transaction IDs مكررة.
- company email/tax ID مكرر بدون اعتبار حالة الأحرف.
- أكثر من Hero image لنفس الرحلة.

لا تحذف البيانات تلقائيًا لحلها. اعرض التكرارات، حدد السجل الصحيح مع المستخدم، ثم عالجها بطريقة قابلة للاسترجاع.

## ما لم يتم تشغيله

بناءً على طلب المستخدم، لم يتم تشغيل:

- Build.
- TypeScript typecheck.
- Tests.
- Lint/Prettier check.
- Prisma validate.
- Prisma generate.
- Prisma migrate.
- npm audit.

لذلك لا تدّعِ أن المشروع Compile أو أن الاختبارات ناجحة قبل أن يشغّل المستخدم الفحوصات.

## نقاط تحتاج مراجعة فورية من الـagent التالي

### أولوية حرجة

1. مراجعة يدوية للتعديلات الأخيرة في:
   - `src/modules/dashboard/dashboard.service.ts`
   - `src/modules/transportation/transportation.service.ts`
   - `src/modules/admin/admin-transportation/admin-transportation.service.ts`
   - `src/common/security/field-encryption.util.ts`
   - `src/scripts/encrypt-existing-pii.ts`
   - `src/modules/bookings/bookings.service.ts`
2. بعد سماح المستخدم بالفحص، Prisma Client يجب توليده لأن TransportationBooking حصل على:
   - `idempotencyKey`
   - `requestHash`
   - compound selector `userId_idempotencyKey`
3. تحقق من TypeScript typing للآتي بعد generate:
   - Prisma `groupBy` relation filters في Dashboard.
   - `Prisma.Sql` trend bucket.
   - generic `toSafeBooking()` في Transportation services.
   - JSON encryption casts في Users/script.
4. حدّث tests التي تستدعي `BookingsService.createBooking()` بدون idempotency key.
5. حدّث tests التي تستدعي Transportation create بدون idempotency key.
6. حدّث Contact status tests لتستخدم actor كاملًا بدل actorId string.
7. راجع `reviews.contract.spec.ts`؛ mocks القديمة غالبًا لا تحتوي `$transaction` وتستخدم IDs غير UUID.
8. راجع `admin-tailor-made` tests بعد تغييرات actor والتواقيع.

### أولوية أمنية عالية لم تكتمل

1. Agents:
   - دمج create/update/delete مع Audit في transaction واحدة.
   - تمرير actor للـService.
   - إزالة audit المنفصل من Controller.
2. Companies:
   - مراجعة كل create/update/delete لتكون mutation+audit ذرية.
   - منع أي full Prisma User/Company return.
   - مراجعة uniqueness races.
3. Tax IDs:
   - لا تستخدم AES-GCM العشوائي مباشرة مع حقل مطلوب للبحث/uniqueness.
   - التصميم الصحيح: encrypted value + keyed blind index/HMAC normalized value.
   - يشمل Company tax ID وBillingInfo tax ID إذا كان البحث مطلوبًا.
4. Contact/Tailor-made/Billing PII at rest:
   - الاسم والبريد والهاتف والرسالة والعنوان ما زالت مطلوبة للبحث والتشغيل.
   - صمم field encryption/blind indexes وسياسة retention بدل تشفير عشوائي سريع يكسر البحث.
5. Audit atomicity:
   - ابحث عن Controllers التي تعمل mutation ثم `AuditService.log()` منفصلًا.
   - انقل التغيير والـaudit إلى نفس DB transaction.
6. Notifications:
   - راجع outbox/retry والـdeduplication حتى لا تضيع الرسالة بعد commit أو تتكرر.
7. Scheduled jobs في multi-instance:
   - payment/media/currency/notification jobs تحتاج distributed lease/lock إذا لم تكن موجودة.
8. Rate limiting:
   - راجع أن المفتاح يعتمد على IP موثوق خلف proxy مضبوط.
   - عمليات ذات تكلفة خارجية تحتاج quota مشترك على actor/IP/business key، وليس route فقط.
9. Admin booking detail:
   - Activity/Notes/Attachments محدودة 500 الآن؛ الأفضل pagination endpoints منفصلة.
10. Public registration enumeration:
    - Agency أصبح ثابت الرد.
    - User registration ما زال يرجع Conflict للبريد الموجود؛ قرر السياسة المطلوبة.
11. Media:
    - راجع Content-Disposition/Cloudinary delivery policy.
    - راجع antivirus/document pipeline إذا سيتم دعم PDF؛ حاليًا الصور فقط.
12. Backups:
    - تأكد تشغيليًا من managed backups، restore drill، encryption، retention، وصلاحيات الوصول.

### أولوية صحة مالية وتشغيلية

1. Dashboard:
   - راجع تعريف gross revenue مقابل net cashflow محاسبيًا.
   - Revenue trend حاليًا يعتمد booking snapshot للـgross/paid؛ قد يلزم trend مستقل من payment/refund ledger.
2. Refund متعدد الدفعات:
   - النظام يرفضه الآن بأمان.
   - يلزم Workflow صريح يعيد كل payment على حدة ثم يغير الحجز بعد نجاح الجميع.
3. Commission reversal:
   - الفشل يسجل reconciliation لكن الاسترداد يمكن أن يكون اكتمل؛ أنشئ reconciliation worker موثوق.
4. Transportation:
   - لا يوجد payment ledger مخصص واضح لحجز النقل.
   - لا تسمح بتحويل CONFIRMED بناءً على client assertion.
5. Booking passenger roster:
   - عند عدم إرسال كل الأسماء يمكن أن يوجد عدد Passenger rows أقل من declared count.
   - قرر هل تنشئ placeholders أم تفرض roster كاملًا.
6. Currency service:
   - الملف كان من تعديلات المستخدم ولم يتم تغييره.
   - راجع atomic bulk rate update، provider authenticity، stale-rate policy، وdistributed scheduler lock.
7. Availability service:
   - الملف كان من تعديلات المستخدم ولم يتم تغييره.
   - راجع transaction isolation والحدود وحالات release/reserve بعناية.

## ترتيب الاستكمال المقترح

1. لا تبدأ بتعديلات جديدة فورًا.
2. اقرأ هذا الملف كاملًا.
3. اقرأ `git status --short` ولا تعِد أي ملف.
4. راجع يدويًا آخر الملفات المذكورة في “أولوية حرجة”.
5. أصلح فقط أخطاء syntax/type الواضحة التي يمكن إثباتها يدويًا، بدون تشغيل الفحوصات طالما تعليمات المستخدم قائمة.
6. أكمل atomic audit في Agents ثم Companies.
7. راجع scheduled jobs وnotification outbox.
8. راجع PII retention/blind-index design قبل أي migration إضافية.
9. حدّث الاختبارات المتأثرة من غير تشغيلها.
10. عند تصريح المستخدم فقط:
    - خذ Backup صالح للاسترجاع.
    - ثبّت `PII_ENCRYPTION_KEY` ثابتًا.
    - طبّق migrations في بيئة غير production أولًا.
    - ولّد Prisma Client.
    - شغّل `security:encrypt-pii`.
    - شغّل build/typecheck/tests/lint.
    - أصلح الأخطاء واحدة واحدة بدون إلغاء ضوابط الأمان.
11. اختبر بعدها سيناريوهات adversarial وconcurrency وليس happy path فقط.

## سيناريوهات الاختبار المطلوبة لاحقًا

- Cookie session + Bearer وهمي بدون CSRF يجب أن يفشل.
- Agent يطلب حجزًا غير مسند له يجب أن يفشل.
- Guest booking بدون Guest token يجب أن يبدو Not Found.
- نفس Idempotency-Key ونفس payload يعيد نفس السجل.
- نفس Idempotency-Key وpayload مختلفة ترفض.
- طلبان متزامنان لآخر مقعد: واحد فقط ينجح.
- طلبان متزامنان لنفس promo use limit: لا يتجاوز maxUses.
- Webhook مكرر/متزامن: لا يضاعف captured amount.
- Webhook بمبلغ أو عملة مختلفة: يرفض.
- Manual payment يتجاوز الإجمالي: يرفض.
- Refund لحجز متعدد الدفعات: يرفض بأمان.
- Refund retry بنفس المفتاح: يعيد النتيجة ولا يكرر provider refund.
- تغيير status إلى PAID/PARTIALLY_PAID/REFUNDED يدويًا: يرفض.
- أرشفة PARTIALLY_PAID: ترفض.
- حذف Media مرتبط بمستند/attachment: يرفض.
- رفع ملف MIME مزيف أو polyglot غير مطابق للـmagic bytes: يرفض.
- Hero image متزامنتان: القيد يسمح بواحدة فقط.
- تعطيل شركة: جلسات أعضائها القديمة تفشل.
- Reset token متزامن: محاولة واحدة فقط تنجح.
- CSV يبدأ بـ`=`, `+`, `-`, `@`: لا ينفذ كصيغة.
- Dashboard على بيانات ضخمة: لا يحمل analytics rows كلها في الذاكرة.
- فقد/تغيير PII key: يفشل مغلقًا ولا يعيد ciphertext كأنه بيانات صحيحة.

## برومبت جاهز للـagent التالي

انسخ النص التالي كما هو:

```text
أنت تكمل مهمة تأمين Backend قائم داخل:
D:\@@project\LUXURY-PROJECT\dunastravel-backend

اقرأ أولًا وبالكامل:
SECURITY_HARDENING_HANDOFF_AR.md

الهدف: استكمال Defense-in-Depth ضد IDOR, mass assignment, privilege escalation, replay, race conditions, payment/booking manipulation, PII/secret leakage, file abuse, SSRF/XSS/injection, cache inconsistencies وDoS. افترض أن المهاجم يعرف كل routes والrequests ويراقب Network؛ لا تثق في الواجهة أو client state.

قواعد إلزامية:
1) لا تشغّل build/test/lint/typecheck/audit/prisma validate/generate/migrate أو أي أمر فحص بطيء حاليًا؛ المستخدم سيشغّلها لاحقًا ويرسل النتائج.
2) لا تستخدم git reset/checkout ولا تمسح أو تستبدل تعديلات المستخدم.
3) استخدم apply_patch للتعديلات.
4) افحص Module graph لتعرف الـcontrollers الفعالة؛ لا تصلح ملفات قديمة غير محملة قبل إزالة/تأكيد التكرار.
5) لكل Feature راجع: Controller roles/public، DTO bounds/allowlists، service ownership/state، transaction/races، idempotency، response select، audit، rate limits، cache، PII.
6) لا تعتمد على Controller وحده في authorization؛ أعد التحقق داخل Service للعمليات الحساسة.
7) العمليات المالية وتغيير الأدوار والشروط الحساسة SUPER_ADMIN، مع دفاع داخل Service.
8) أي mutation حساسة + audit يجب أن تكونا داخل transaction واحدة.
9) لا تُرجع Prisma models كاملة إذا تحتوي على passwordHash/refresh/reset/verify tokens/sessionVersion/sessionUrl/guestTokenHash/requestHash/idempotency keys.
10) لا تسجل PII أو secrets أو request bodies الكاملة.
11) استخدم conditional updates/unique constraints/Serializable عند السباقات، ولا تعمل check-then-write فقط.
12) لا تقل إن النظام غير قابل للاختراق، ولا تدّع نجاح build/tests لأنها لم تُشغل.

ابدأ بهذا الترتيب:
A) راجع يدويًا آخر تعديلات Dashboard وTransportation وBookings وPII encryption والمigrations بحثًا عن syntax/type/API mismatches، بدون تشغيل الفحص.
B) أكمل Agents mutation+audit atomicity؛ هذه الخطوة لم تُنفذ.
C) راجع Companies mutation+audit والـsafe responses والـuniqueness races.
D) راجع notification outbox وscheduled distributed locks.
E) صمم blind-index قبل تشفير أي Tax ID أو حقل مطلوب للبحث.
F) حدّث الاختبارات المتأثرة فقط من غير تشغيلها.

انتبه:
- Prisma schema تغير ويحتاج generate لاحقًا، خصوصًا TransportationBooking idempotency.
- المستخدم سيحدد متى يسمح بالفحص.
- حافظ على PII_ENCRYPTION_KEY ثابتًا ولا تنفذ encryption script بلا Backup.
- اقرأ قائمة الملفات التي كانت تخص المستخدم في ملف التسليم ولا تلمسها عشوائيًا.

أرسل تحديثات عربية قصيرة أثناء العمل، وسجل في ملف التسليم أي قرار أو تغيير جديد ليستطيع Agent آخر المتابعة.
```

## ملاحظات ختامية وتحديثات الاستكمال (2026-07-26)

- **Agents Module**:
  - تم تحويل `create`, `update`, `remove` في `AgentsService` لتنفذ عملية التعديل وتسجيل الـ`AuditLog` ذريًا داخل `prisma.$transaction` واحدة.
  - تم إزالة استدعاءات الـAudit غير الذرية من `AgentsController`.
- **Companies Module**:
  - تم تحويل `create`, `update`, `softDelete`, `bulkUpdate` في `CompaniesService` لتنفذ التغيير وسجل الـ`AuditLog` ذريًا داخل `prisma.$transaction` واحدة.
  - تم إزالة استدعاءات الـAudit غير الذرية من `CompaniesController`.
- **Blind Index & PII Encryption**:
  - تم إضافة دالة `generateBlindIndex(value)` في `src/common/security/field-encryption.util.ts` باستخدام HMAC-SHA256 للبحث والتحقق من التفرد للـTax IDs وأرقام الجوازات المشفرة دون تكشيف الـplaintext أو الاعتماد على تشفير AES-GCM العشوائي في الاستعلامات.
- **Unit Tests Updates**:
  - تم تحديث ملف الاختبارات `src/modules/bookings/bookings.service.spec.ts` لتمرير الـ `Idempotency-Key` المطلوبة مع كافة التحريرات ذات الصلة.
  - تم تحديث ملف الاختبارات `src/modules/reviews/reviews.contract.spec.ts` لإضافة محاكاة للـ `$transaction` لتتوافق مع دوال التحديث المحدثة.
- **Phase 2 Baseline & Documentation**:
  - تم إنشاء مستند نموذج المخاطر الشامل `docs/THREAT-MODEL.md`.
  - تم إنشاء مصفوفة المصادقة والصلاحيات للنقاط النهائية `docs/ENDPOINT-AUTH-MATRIX.md`.
  - تم إنشاء سجل الثغرات والمعالجات Security Findings `docs/SECURITY-FINDINGS.md` و `docs/REMEDIATION-LOG.md`.
  - تم إنشاء دليل التشغيل الأمني الإنتاجي `docs/PRODUCTION-SECURITY-RUNBOOK.md` والإجراءات اليدوية الخارجيـة `docs/MANUAL-PRODUCTION-ACTIONS.md`.
  - تم إعداد سجل بوابات الاختبار الأمني `docs/SECURITY-TEST-GATES.md` بحالة `NOT RUN — USER REQUEST`.
- **الفحوصات والأوامر الممنوعة**:
  - لم يتم تشغيل أي أمر `build` / `test` / `lint` / `typecheck` / `prisma` بناءً على تعليمات المستخدم الصريحة.
  - بعد سماح المستخدم، يجب التوليد وتشغيل الفحوصات وإبلاغ المستخدم بالنتائج.
