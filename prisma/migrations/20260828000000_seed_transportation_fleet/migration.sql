INSERT INTO "transportation_services" (
  "id", "name", "service_type", "vehicle_category", "vehicle_type", "capacity", "doors", "transmission", "base_price_usd", "hero_image_url", "is_private", "is_active", "features_jsonb", "description", "created_at", "updated_at"
) VALUES
  ('tr-bus-1', 'حافلة سياحية كبرى فاخرة (VIP Golden Bus)', 'AIRPORT', 'bus', 'VIP Tour Bus 50-Seater', 50, 2, 'AUTO', 450.00, '/imgs/transportation/bus1.jpeg', false, true, '["تكييف هوائي مركزي", "واي فاي فائق السرعة", "سائق محترف متعدد اللغات", "دورة مياه داخلية", "مقاعد جلدية مريحة قابلة للإمالة", "مساحة أمتعة واسعة", "منافذ شحن USB"]'::jsonb, 'حافلة سياحية فاخرة 50 مقعداً مجهزة بأحدث وسائل الراحة والترفيه وشاشات العرض للرحلات الطويلة بين القاهرة والأقصر وأسوان والغردقة.', NOW(), NOW()),
  ('tr-bus-2', 'حافلة كلاسيك جراند (Classic Coach Bus)', 'AIRPORT', 'bus', 'Tour Coach 45-Seater', 45, 2, 'AUTO', 400.00, '/imgs/transportation/bus2.jpeg', false, true, '["تكييف كامل", "واي فاي مجاني", "سائق سياحي معتمد", "دورة مياه", "نظام صوتي متطور", "مقاعد مريحة"]'::jsonb, 'حافلة مريحة مثالية للمجموعات السياحية الكبيرة مع تعليق هوائي ونوافذ بانورامية عازلة للحرارة.', NOW(), NOW()),
  ('tr-bus-3', 'حافلة مرسيدس توريزمو VIP (Mercedes-Benz VIP Bus)', 'AIRPORT', 'bus', 'Mercedes Tourismo VIP 50-Seater', 50, 2, 'AUTO', 500.00, '/imgs/transportation/bus3.jpeg', false, true, '["تكييف مركزي متطور", "إنترنت 5G مجاني", "سائق VIP خاص", "دورة مياه فاخرة", "مقاعد جلدية فاخرة", "منافذ شحن فردية لكل مقعد", "ثلاجة ومشروبات"]'::jsonb, 'قمة الفخامة الألمانية لرحلات كبار الشخصيات والوفود الرسمية مع أعلى درجات الأمان والهدوء داخل المقصورة.', NOW(), NOW()),
  ('tr-bus-4', 'حافلة كوتش VIP رويال (VIP Tour Coach)', 'CITY_TO_CITY', 'bus', 'VIP Tour Coach 48-Seater', 48, 2, 'AUTO', 420.00, '/imgs/transportation/bus4.jpeg', false, true, '["تكييف هوائي", "واي فاي سريع", "سائق محترف", "دورة مياه", "نظام صوتي نقي", "إضاءة محيطية هادئة"]'::jsonb, 'حافلة سياحية رحبة توفر راحة تامة أثناء التنقل بين المزارات والمعالم السياحية الرئيسية.', NOW(), NOW()),
  ('tr-bus-5', 'حافلة جراند ترافيل إكسكيوتيف (Grand Travel Bus)', 'CITY_TO_CITY', 'bus', 'Grand Touring 50-Seater', 50, 2, 'AUTO', 430.00, '/imgs/transportation/bus5.jpeg', false, true, '["تكييف مركزي", "واي فاي فائق السرعة", "سائق متمرس", "دورة مياه", "شاشات عرض LED", "منافذ شحن"]'::jsonb, 'حافلة السفر الطويل المتميزة برحابة المساحات بين المقاعد وإمكانيات ترفيه متكاملة للركاب.', NOW(), NOW()),
  ('tr-bus-6', 'حافلة سياحية إكسبريس (Express Coach Bus)', 'HOTEL', 'bus', 'Coach Bus 45-Seater', 45, 2, 'AUTO', 390.00, '/imgs/transportation/bus6.jpeg', false, true, '["تكييف هواء", "واي فاي", "سائق معتمد", "نظام صوتي", "مساحة أمتعة كبيرة", "مقاعد مريحة"]'::jsonb, 'حافلة متوازنة وعملية لنقل المجموعات بين الفنادق والمطارات والجولات اليومية بكفاءة عالية.', NOW(), NOW()),
  ('tr-bus-7', 'حافلة رويال إليغانس (Royal Elegance Bus)', 'HOTEL', 'bus', 'Executive Bus 48-Seater', 48, 2, 'AUTO', 480.00, '/imgs/transportation/bus7.jpeg', false, true, '["تكييف مركزي", "واي فاي عالي السرعة", "سائق VIP", "دورة مياه", "مقاعد جلدية مريحة", "ثلاجة ومشروبات", "نوافذ بانورامية"]'::jsonb, 'تصميم أنيق وتجهيزات فائقة الجودة لرحلات ممتعة وإطلالات بانورامية خلابة على أجمل المناظر الطبيعية.', NOW(), NOW()),
  ('tr-coaster-1', 'كوستر تويوتا تنفيذي (Toyota Coaster Executive)', 'AIRPORT', 'coaster', 'Toyota Coaster 26-Seater', 26, 2, 'AUTO', 260.00, '/imgs/transportation/costar.jpeg', false, true, '["تكييف قوي", "واي فاي", "سائق سياحي محترف", "نظام صوتي نقي", "مساحة واسعة للأقدام", "أماكن مخصصة للحقائب"]'::jsonb, 'الخيار الأمثل للمجموعات المتوسطة والعائلات الكبيرة، سهولة حركة وأقصى درجات الراحة والمرونة.', NOW(), NOW()),
  ('tr-coaster-2', 'كوستر VIP بريميوم (VIP Premium Coaster)', 'CITY_TO_CITY', 'coaster', 'Toyota Coaster VIP 22-Seater', 22, 2, 'AUTO', 290.00, '/imgs/transportation/costar1.jpeg', false, true, '["تكييف متطور", "واي فاي سريع", "سائق VIP خاص", "مقاعد جلدية كابتن واسعة", "منافذ شحن USB", "نظام صوتي فائق"]'::jsonb, 'مقصورة مخصصة لرجال الأعمال والمجموعات الخاصة بمقاعد كابتن مريحة ومساحات رحبة للغاية.', NOW(), NOW()),
  ('tr-private-1', 'سيارة فاخرة خاصة مع سائق (VIP Luxury Sedan & SUV)', 'AIRPORT', 'private', 'Luxury Sedan & SUV', 4, 4, 'AUTO', 150.00, '/imgs/transportation/privte.jpeg', true, true, '["تكييف هواء فاخر", "نظام ملاحة GPS", "وسائد هوائية متطورة", "واي فاي متنقل", "سائق خاص بلباس رسمي", "مقاعد جلدية فاخرة", "مياه معدنية وضيافة"]'::jsonb, 'خدمة استقبال وتوصيل خاصة فاخرة لكبار الشخصيات ورجال الأعمال مع سائق خاص يتحدث عدة لغات.', NOW(), NOW())
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "service_type" = EXCLUDED."service_type",
  "vehicle_category" = EXCLUDED."vehicle_category",
  "vehicle_type" = EXCLUDED."vehicle_type",
  "capacity" = EXCLUDED."capacity",
  "doors" = EXCLUDED."doors",
  "transmission" = EXCLUDED."transmission",
  "base_price_usd" = EXCLUDED."base_price_usd",
  "hero_image_url" = EXCLUDED."hero_image_url",
  "is_private" = EXCLUDED."is_private",
  "is_active" = EXCLUDED."is_active",
  "features_jsonb" = EXCLUDED."features_jsonb",
  "description" = EXCLUDED."description",
  "updated_at" = NOW();
