# المرحلة الثانية: التحقق الأمني الشامل والتشديد الإنتاجي

هذا الملف يُعطى للـAgent **بعد** إنهاء جميع البنود المفتوحة في:

`SECURITY_HARDENING_HANDOFF_AR.md`

لا تستخدم هذا الملف بدل ملف التسليم الأول، ولا تبدأ المرحلة الثانية بينما البنود الحرجة في المرحلة الأولى ما زالت مفتوحة.

## البرومبت الجاهز

انسخ النص التالي للـAgent كما هو:

```text
أنت الآن Principal Application Security Engineer + Senior NestJS Backend Engineer + SRE.

المشروع:
D:\@@project\LUXURY-PROJECT

النطاق الأساسي:
- dunastravel-backend
- Prisma schema والمهاجرات والقيود الفعلية في PostgreSQL
- Docker وVercel وdocker-compose وNginx إن كان فعالًا
- عقود التكامل مع frontend وdunastravel-dashbord
- لا تعدّل الواجهات إلا إذا كان الإصلاح الأمني يتطلب ذلك، مثل Stored XSS أو CSRF أو تغيير عقد API ضروري وموثق

هذه هي المرحلة الثانية. قبل أي فعل:

1) اقرأ بالكامل:
   - dunastravel-backend/SECURITY_HARDENING_HANDOFF_AR.md
   - dunastravel-backend/SECURITY_PHASE_2_AGENT_PROMPT_AR.md
2) افحص working tree ولا تُعِد أو تمسح أي تعديل.
3) تأكد أن البنود المفتوحة ذات الأولوية الحرجة في ملف التسليم الأول أُغلقت أو سُجل لها blocker حقيقي.
4) لا تكرر إصلاحًا موجودًا؛ أثبت وجوده وفعاليته من الكود والاختبار عند السماح.
5) تعامل مع أي تعارض بين هذا الملف والحالة الفعلية للمشروع لصالح الأمان والحفاظ على بيانات المستخدم.

الهدف:

نفّذ مراجعة أمنية قائمة على الأدلة ثم أكمل التشديد للوصول قدر الإمكان إلى OWASP ASVS Level 2، مع تشديد إضافي للمصادقة والإدارة والمدفوعات والملفات والـPII والتشغيل الإنتاجي.

لا تدّعِ أن النظام “غير قابل للاختراق”. المطلوب Defense in Depth، اختبارات سلبية، قيود قاعدة بيانات، قابلية استرداد، ومراقبة موثوقة.

## قواعد إلزامية

1. لا تطبع أو تسجل أو تنسخ أي Secret أو Token أو Password أو Cookie أو Connection String.
2. افحص أسماء مفاتيح البيئة وقوتها بصورة masked فقط.
3. لا تقرأ قيمة `.env` في output ولا تضع أي Secret داخل تقرير أو patch.
4. لا تنفذ:
   - db reset
   - migrate reset
   - seed على production
   - حذف بيانات
   - migration على production
5. لا تستخدم `npm audit fix --force`.
6. لا تعمل major upgrades عمياء.
7. لا تغيّر عقد API إلا لضرورة أمنية مثبتة، ومع compatibility/migration plan.
8. لا تعتبر Finding بحالة Fixed بدون اختبار سلبي يثبت أن الاستغلال لم يعد ممكنًا.
9. لا تستخدم أي Production URL في الاختبارات الهجومية.
10. الاختبارات الأمنية يجب أن تكون benign ومحلية أو في بيئة اختبار مصرّح بها.
11. لا تدّعِ تنفيذ إجراءات خارجية مثل WAF/DNS/PITR/secret rotation؛ سجلها Manual Action.
12. لا تستخدم Git reset/checkout أو أي أمر مدمر.
13. استخدم `apply_patch` للتعديلات اليدوية.
14. أي حذف يجب أن يكون محددًا ومبررًا وقابلًا للاسترجاع.
15. أرسل تحديثًا عربيًا مختصرًا بعد كل مرحلة: ما فُحص، ما ثبت، ما عُدّل، وما نتيجة التحقق.

## قيد أوامر الفحص

تعليمات المستخدم الحالية تمنع أوامر build/test/lint/typecheck/audit/Prisma validate/generate/migrate لأنها بطيئة.

لذلك:

- لا تشغّل أي أمر فحص ثقيل حتى يعطي المستخدم إذنًا صريحًا جديدًا.
- أثناء المنع نفّذ القراءة اليدوية، إعداد الوثائق، patches الضرورية، وتحديث الاختبارات دون تشغيلها.
- عندما يعطي المستخدم الإذن، شغّل الفحوصات على دفعات صغيرة، سجل الزمن والنتيجة، ولا تستخدم `--fix` في baseline.
- إذا لم يعطِ الإذن، لا تدّعِ نجاح أي Gate واجعل حالته `NOT RUN — USER REQUEST`.

## المرحلة صفر: Baseline وحماية الرجوع

نفّذ الآتي دون تغيير الحالة الخارجية:

1. احصر:
   - entrypoints
   - modules/controllers الفعالة
   - guards/interceptors/filters/middleware
   - Prisma models/migrations
   - schedulers/workers
   - Redis/PostgreSQL/Stripe/Cloudinary/Resend/Anthropic/Sentry
   - Docker/Vercel runtime
2. قارن:
   - `src/main.ts`
   - `src/vercel.ts`
   - Docker entrypoint
   - test/e2e bootstrap
3. حدد أي configuration drift في:
   - body parsing/raw body
   - Helmet
   - CORS
   - cookies
   - proxy trust
   - global prefix/versioning
   - global guards
   - filters/interceptors
4. لا تنشئ Remote ولا ترفع ملفات.
5. لا تعمل rollback تلقائيًا لشجرة متغيرة.

عند السماح بالفحص فقط، سجل baseline قبل أي patch جديد:

- TypeScript typecheck
- build
- unit tests
- integration/e2e tests
- Prisma validation
- lint بدون fix
- npm audit
- dependency tree للمشكلات الأمنية فقط

## مستندات إلزامية

أنشئ أو حدّث:

- `docs/security/THREAT-MODEL.md`
- `docs/security/ENDPOINT-AUTH-MATRIX.md`
- `docs/security/SECURITY-FINDINGS.md`
- `docs/security/REMEDIATION-LOG.md`
- `docs/security/PRODUCTION-SECURITY-RUNBOOK.md`
- `docs/security/MANUAL-PRODUCTION-ACTIONS.md`
- `docs/security/SECURITY-TEST-GATES.md`

لا تملأ المستندات بافتراضات. كل ادعاء يجب أن يرتبط بملف/سطر أو migration أو test.

## Endpoint/Auth Matrix

احصر كل Route فعال في جدول يحتوي:

- HTTP method
- path
- controller/handler
- هل هو Public؟
- آلية المصادقة: Cookie/Bearer/Guest token/Webhook signature
- الأدوار
- target role restrictions
- ownership/tenant/company/assignee check
- CSRF decision
- Origin decision
- rate limit/quota
- DTO
- Param/Query/Header validation
- idempotency/replay policy
- البيانات المعادة
- التصنيف:
  - Public
  - Internal
  - PII
  - Financial
  - Secret
- الاختبار السلبي المطلوب

أنشئ contract test يفشل إذا ظهر Route جديد بلا قرار أمني صريح، لكن لا تشغّله حتى يسمح المستخدم.

## Threat Model

غطِّ على الأقل:

- Anonymous attacker
- Authenticated customer
- Guest booking token theft
- Compromised AGENT
- Compromised ADMIN
- Malicious SUPER_ADMIN
- Compromised frontend/browser extension
- Replay attacker يملك كل requests
- Stripe webhook spoof/replay/out-of-order
- Redis outage أو split behavior
- Multi-instance race
- Insider لديه DB read access
- Cloud storage leak
- Supply-chain compromise
- Backup theft/failure
- Vercel ephemeral/runtime limitations

لكل Threat سجل:

- Asset
- Trust boundary
- Entry point
- Preconditions
- Abuse case
- Existing controls
- Missing controls
- Detection
- Recovery

## ترتيب التنفيذ

### P0 — لا تنتقل قبل إغلاقه أو تسجيل blocker

1. Default credentials/seeds/bootstrap admin.
2. Default-deny route authorization.
3. ADMIN ضد SUPER_ADMIN target-level authorization.
4. Last SUPER_ADMIN/self-delete/self-disable controls.
5. Session invalidation وrefresh replay.
6. CSRF cookie-auth bypass.
7. Payment success/webhook false-positive side effects.
8. Refund/double-payment/ledger inconsistencies.
9. Vercel error/config drift.
10. Backup false-success.
11. Secret/token/PII response or log leaks.
12. أي syntax/type regression ناتج عن المرحلة الأولى، لكن لا تشغّل الفحص إلا بإذن.

### P1

1. Distributed rate limits/quotas.
2. BOLA/IDOR/tenant/assignee tests.
3. Stored XSS.
4. Private customer documents.
5. Audit atomicity/append-only design.
6. Notification outbox/reconciliation.
7. Dependency High vulnerabilities.
8. Multi-instance cron locks.
9. PII retention/encryption/blind indexes.

### P2

1. MFA للإدارة.
2. Step-up authentication للعمليات المالية والصلاحيات.
3. Container/DB least privilege.
4. Managed backups/PITR/restore drill.
5. WAF/monitoring/alerts.
6. SBOM/SAST/secret/container/IaC scans.
7. Incident response/key rotation runbooks.

## المصادقة والإدارة

أثبت أو أصلح:

- JWT algorithm/issuer/audience/jti/sessionVersion.
- suspended/deleted/inactive/unverified/company-inactive checks في access وrefresh.
- refresh token hashing/rotation/reuse detection/concurrent behavior.
- logout-all يلغي كل الجلسات فعليًا.
- password policy موحدة.
- reset/change/admin-created password invalidation.
- عدم كشف وجود البريد في forgot/resend حسب السياسة المعتمدة.
- login protection لا يسمح account-lockout DoS.
- ADMIN لا يغيّر أو يحذف أو يعطل أو يعيد كلمة مرور SUPER_ADMIN.
- منع حذف/تعطيل النفس في العمليات غير المصممة لذلك.
- منع حذف آخر SUPER_ADMIN.
- role/password/refund/manual-wallet/company-financial-term changes تحتاج SUPER_ADMIN أو Permission أدق.

### MFA وStep-up

صمم ونفذ بعد مراجعة عقد المنتج:

- TOTP أو WebAuthn للإدارة.
- Recovery codes hashed ومرة واحدة.
- MFA enrollment/revocation audit.
- step-up حديث للآتي:
  - refunds
  - manual payments/wallets
  - تغيير أدوار
  - إنشاء/حذف admin
  - تغيير secrets/security settings
- لا تخزن MFA secrets plaintext دون envelope encryption.
- لا تنفذ تصميمًا شكليًا يعتمد على boolean من العميل.

إذا كان قرار المنتج مطلوبًا، سجل blocker وخيارات واضحة ولا تخترع UX.

## CSRF/CORS/Cookies/Proxy

- `@Public` لا يتجاوز CSRF تلقائيًا.
- Cookie auth يحتاج secure CSRF token وOrigin/Referer policy.
- Bearer exemption لا يعمل إذا كانت المصادقة الفعلية Cookie.
- Cookie flags/Path/TTL متوافقة مع JWT.
- CORS exact fail-closed.
- main/Vercel متطابقان.
- trust proxy مضبوط حسب منصة النشر، وليس قيمة عشوائية.
- اختبر preflight وOrigin مرفوض وCookie+Bearer spoof عند السماح.
- استخدم مطابقة Route دقيقة للـwebhook، لا `includes` عامًا.

## Payments وFinancial Integrity

أثبت بالأدلة:

- invalid signature لا يغير DB.
- pending/failed/unhandled event لا يطلق success event أو analytics.
- event type/provider/account/livemode policy واضحة.
- amount/currency/booking/transaction/invoice تطابق السجل المتوقع.
- webhook event idempotency ذري.
- duplicate/concurrent/out-of-order آمن.
- لا CAPTURED payment بلا trusted pending session إلا recovery policy.
- لا floating point في الأموال.
- لا overpayment/negative paid amount/negative wallet.
- refund provider-success/local-failure له reconciliation قابل للاسترداد.
- double/partial refund policy واضحة.
- ledger/audit لا تختفي بحذف parent.
- financial references لها DB constraints.

نفذ tests سلبية لهذه الحالات، ولا تكتفِ بـmock happy path.

## Rate Limiting وAbuse

راجع limits منفصلة لـ:

- login
- register
- refresh
- forgot/reset
- verify/resend
- contact
- inquiry/tailor-made
- agency registration
- analytics
- public AI
- pricing
- promotion validation
- booking creation/cancel
- payment initiation
- webhook
- media upload

اعتمد store مشتركًا مع:

- namespace
- TTL صحيح
- Redis TLS/auth في production
- behavior موثق عند Redis outage
- IP + account/session/business identifier حسب المسار
- quotas للتكلفة الخارجية

CAPTCHA/bot protection Manual/Integration Action عند threshold، ولا تدّعِ اكتماله بلا مزود فعلي.

## Validation/Mass Assignment/BOLA

- لا `dto:any` أو inline body أو uncontrolled Record.
- كل Param/Query/Header له validation.
- page/limit/date ranges/array sizes/max lengths محدودة.
- numbers finite وبحدود.
- enums allowlist.
- ownership داخل Service.
- company/tenant/assignee scope.
- Guest token comparison constant-time بعد تساوي الأطوال.
- لا client-supplied financial state/role/status/provider truth.

اختبر:

- owner
- foreign user
- guest token صحيح/خاطئ
- agent مسند/غير مسند/شركة أخرى
- admin
- super admin

## Stored XSS

راجع:

- CMS
- Blogs
- Reviews
- FAQ
- Tour/landing localized JSON
- Admin templates
- Notification email content
- frontend وdashboard لـ`dangerouslySetInnerHTML`

لا تستخدم Regex وحده كـHTML sanitizer.

استخدم allowlist موثوقًا ومحدثًا وغطِّ:

- SVG
- MathML
- style
- srcset
- entities
- malformed HTML
- javascript/data/vbscript URLs

فضّل النص العادي عندما لا تكون HTML ضرورية.

أنشئ XSS regression corpus benign واختبارات backend/frontend عند السماح.

## Files وCustomer Documents

- لا تعتمد على MIME/extension.
- magic bytes + decoder فعلي + dimensions/pixel limits.
- راجع decompression bombs/polyglots/metadata.
- لا تحمل ملفات غير ضرورية كاملة في الذاكرة.
- أسماء آمنة وتنظيف temp مضمون.
- افصل public tour images عن private customer documents.
- Customer document يحتاج authorization لكل download.
- Signed URL قصير العمر ومقيد.
- لا تعيد permanent public URL لمستند حساس.
- malware scanning مطلوب قبل دعم PDF/Office/archive.
- retention/deletion policy.

## PII وEncryption وRetention

راجع ما تم في المرحلة الأولى ولا تكرر التشفير.

ممنوع تشفير حقل مطلوب للبحث/uniqueness باستخدام random AES-GCM فقط.

لحقول مثل Tax ID/Email عند الحاجة للبحث:

- encrypted value
- normalized keyed blind index/HMAC
- unique/index على blind index
- key separation
- migration/backfill
- rotation plan

حدد retention لـ:

- passports
- emergency contacts
- customer documents
- contact/inquiry messages
- webhook payload metadata
- logs
- audit logs
- backups

لا تنفذ deletion policy لسجلات مالية أو قانونية قبل موافقة المنتج/القانون.

## Backups وRecovery

- لا simulated success.
- لا shell command يحتوي connection string.
- لا تعتمد على Vercel filesystem أو in-process cron.
- فضّل managed PostgreSQL backups + PITR.
- encryption/retention/object lock/least privilege.
- checksum.
- monitoring/alert.
- restore drill في disposable environment.

أي جزء خارجي يسجل في:
`docs/security/MANUAL-PRODUCTION-ACTIONS.md`

لا تضع حالته Complete بدون دليل restore حقيقي.

## Logging/Audit/Monitoring

- Mask email/phone/passport/tokens/cookies/auth headers.
- Sentry بدون request body/query/cookies/headers الحساسة.
- correlation ID allowlist أو UUID داخلي.
- privilege/financial/delete mutation + audit ذريان.
- actor/role/target/before/after/IP/correlation ID حسب الحاجة.
- لا تسجل plaintext sensitive before/after.
- Audit append-only قدر الإمكان.
- alerts لـ:
  - brute force
  - admin/role changes
  - refund/manual money movement
  - webhook failures
  - reconciliation failures
  - backup failures
  - secret/config failures
  - repeated BOLA/CSRF denials

## Dependencies/Supply Chain/Container

عند السماح بالفحص:

- npm audit بدون auto-fix.
- حدد runtime-reachable paths.
- أصلح compatible patches/minors أولًا.
- اكتب risk acceptance لأي High غير مغلق.
- أنشئ SBOM.
- OSV/Trivy أو أداة متاحة.
- secret scanning masked.
- SAST.
- container/IaC scan.

راجع Container:

- multi-stage minimal runtime
- non-root
- no `.env`
- no dev tools/source maps غير المطلوبة
- pinned version/digest حسب سياسة التحديث
- HEALTHCHECK
- read-only filesystem حيث يمكن
- drop capabilities
- CPU/memory/pids limits
- Postgres/Redis غير معرضين للعامة
- runtime DB user محدود
- migration/backup users منفصلون

لا تعتبر npm audit وحده إثباتًا للأمان.

## Prisma/Database Integrity

راجع migrations الفعلية لا schema فقط:

- payment transaction uniqueness
- pending payment uniqueness
- refund/idempotency
- availability remaining seats bounds
- promotion currentUses bounds
- wallet balance/ledger consistency
- invoice/reference uniqueness
- company identity
- hero uniqueness
- transportation idempotency
- cascade deletes على financial/audit records

أي migration جديدة:

- idempotent قدر الإمكان
- preflight يكشف البيانات المخالفة
- لا يصلح البيانات بالحذف
- rollback/compatibility plan
- تُختبر خارج production أولًا

راجع كل read-modify-write ضد السباق واستخدم:

- conditional update
- unique/check constraint
- transaction
- isolation/locking المناسب

الوظائف الحرجة المجدولة تحتاج distributed lease/lock، ولا تعتمد على in-process Cron داخل Vercel.

## Production Runbook

يجب أن يغطي:

- required environment contract
- secret generation/rotation
- PII key custody/rotation
- migrations order
- backup before migrations
- deployment/rollback
- webhook verification
- Redis outage
- Stripe outage
- email/AI/storage outage
- reconciliation
- incident response
- compromised admin
- compromised PII key
- restore drill
- alerts and ownership
- manual actions with responsible owner

لا تضع Secret values أو أمثلة قابلة للاستخدام.

## بوابات القبول

لا تعتبر المرحلة الثانية مكتملة إلا عندما تكون حالة كل Gate واحدة من:

- PASS مع دليل
- FAIL مع Finding
- BLOCKED مع سبب خارجي حقيقي
- NOT RUN بسبب منع المستخدم

الـGates:

1. كل Route محمي يعيد 401 بدون auth.
2. الدور غير الصحيح يعيد 403.
3. Public routes تطابق allowlist.
4. Route جديد بلا security decision يفشل contract test.
5. ADMIN لا يؤثر على SUPER_ADMIN.
6. لا حذف/تعطيل النفس أو آخر SUPER_ADMIN بلا workflow.
7. suspended/deleted users يفشل access/refresh.
8. reset/change invalidates sessions.
9. refresh replay/concurrent refresh آمن.
10. CSRF failures مغطاة.
11. invalid Stripe signature بلا DB side effects.
12. duplicate/pending/failed/out-of-order webhook بلا نجاح كاذب.
13. amount/currency/booking mismatch يرفض.
14. BOLA tests للحجز والفاتورة والدفع والمستند.
15. XSS corpus لا يصل إلى sink قابل للتنفيذ.
16. spoofed/oversize/polyglot file يرفض بأمان.
17. rate limit يعمل عبر نسختين/store مشترك.
18. backup failure لا يسجل نجاحًا.
19. restore drill موثق.
20. لا High/Critical dependency risk غير مقبول بلا وثيقة.
21. typecheck/lint-no-fix/unit/integration/e2e/build/Prisma validate تمر عند السماح.

## صيغة Security Finding

لكل Finding:

- ID
- Title
- Severity
- CWE
- OWASP ASVS/API Top 10 mapping
- affected file and line
- evidence
- benign abuse scenario
- impact
- exploitability
- remediation
- regression test
- compatibility/migration impact
- status: Open / In Progress / Fixed / Accepted / Blocked

لا تعرض Secret أو exploit payload مؤذيًا.

## طريقة تنفيذ الـpatches

1. Patch صغير ومحدد.
2. اشرح invariant الأمني الذي يفرضه.
3. أضف/حدّث test سلبي.
4. لا تشغّل test أثناء منع المستخدم.
5. حدّث:
   - SECURITY-FINDINGS
   - REMEDIATION-LOG
   - Endpoint Matrix إذا تغير العقد
6. لا توسع scope بلا داعٍ.
7. لا تصلح failure بإزالة validation أو تخفيف role.

## التسليم النهائي

قدّم:

- ملخص النتائج المثبتة.
- الملفات المعدلة.
- migrations الجديدة وتأثيرها.
- الاختبارات التي أضيفت.
- نتائج الاختبارات بالأرقام، أو NOT RUN بوضوح.
- المخاطر المتبقية.
- Accepted risks مع المبرر والمالك والمدة.
- Manual production actions.
- compatibility/deployment/rollback plan.
- ترتيب الخطوات التالية.

ابدأ الآن بقراءة ملف التسليم الأول، ثم اعرض Baseline مختصرًا يفرّق بوضوح بين:

- Already implemented
- Verified
- Needs verification
- Open
- Blocked by current no-check instruction

لا تبدأ بإعادة كتابة النظام ولا تكرر المرحلة الأولى.
```

## ملاحظات لصاحب المشروع

- أرسل ملف `SECURITY_HARDENING_HANDOFF_AR.md` أولًا.
- بعد أن ينهي الـAgent كل بنوده المفتوحة ويحدّثه، أرسل له هذا الملف.
- طالما لم تسمح بأوامر الفحص، ستظل بوابات الاختبار `NOT RUN`.
- عند السماح لاحقًا، اطلب تشغيل الفحوصات على دفعات، وليس كلها في أمر واحد.
- لا تطبق migrations أو تشفير PII على Production قبل Backup وبيئة تجريبية.
