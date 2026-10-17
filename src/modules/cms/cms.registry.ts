export const CMS_LOCALES = ['en', 'ar', 'es', 'pt', 'it'] as const;
export type CmsLocale = (typeof CMS_LOCALES)[number];

export type CmsBlockDefinition = {
  owner: string;
  public: boolean;
  locales: readonly CmsLocale[];
  kind: 'localized-object' | 'catalog' | 'structured-object';
  consumers: readonly string[];
};

/** One authoritative allow-list: arbitrary CMS keys cannot become production content. */
export const CMS_BLOCK_REGISTRY = {
  about: {
    owner: 'marketing',
    public: true,
    locales: CMS_LOCALES,
    kind: 'localized-object',
    consumers: ['frontend/About'],
  },
  about_page: {
    owner: 'marketing',
    public: true,
    locales: CMS_LOCALES,
    kind: 'localized-object',
    consumers: ['frontend/About', 'dashboard/content'],
  },
  faq_page: {
    owner: 'support',
    public: true,
    locales: CMS_LOCALES,
    kind: 'localized-object',
    consumers: ['frontend/FAQ', 'dashboard/content'],
  },
  global_seo: {
    owner: 'marketing',
    public: false,
    locales: CMS_LOCALES,
    kind: 'localized-object',
    consumers: ['dashboard/content', 'frontend/SEO'],
  },
  holiday_packages: {
    owner: 'catalog',
    public: true,
    locales: CMS_LOCALES,
    kind: 'catalog',
    consumers: ['frontend/Home'],
  },
  hotels_catalog: {
    owner: 'accommodation',
    public: true,
    locales: CMS_LOCALES,
    kind: 'catalog',
    consumers: ['frontend/useServices', 'frontend/HotelDetails'],
  },
  transportation_fleet: {
    owner: 'transport',
    public: true,
    locales: CMS_LOCALES,
    kind: 'catalog',
    consumers: ['frontend/useServices'],
  },
  home_banner: {
    owner: 'marketing',
    public: true,
    locales: CMS_LOCALES,
    kind: 'localized-object',
    consumers: ['traveler CMS hook tests'],
  },
  homepage_hero: {
    owner: 'marketing',
    public: true,
    locales: CMS_LOCALES,
    kind: 'localized-object',
    consumers: ['frontend/Home', 'dashboard/content'],
  },
  'homepage.hero': {
    owner: 'marketing',
    public: true,
    locales: CMS_LOCALES,
    kind: 'localized-object',
    consumers: ['CMS contract tests'],
  },
  footer_info: {
    owner: 'marketing',
    public: true,
    locales: CMS_LOCALES,
    kind: 'localized-object',
    consumers: ['frontend/Footer', 'dashboard/content'],
  },
  contact_info: {
    owner: 'support',
    public: true,
    locales: CMS_LOCALES,
    kind: 'localized-object',
    consumers: ['frontend/Contact', 'dashboard/content'],
  },
} as const satisfies Record<string, CmsBlockDefinition>;

export type CmsBlockKey = keyof typeof CMS_BLOCK_REGISTRY;

export function getCmsBlockDefinition(
  key: string,
): CmsBlockDefinition | undefined {
  return CMS_BLOCK_REGISTRY[key as CmsBlockKey];
}

export function isCmsLocale(value: string | undefined): value is CmsLocale {
  return Boolean(value && CMS_LOCALES.includes(value as CmsLocale));
}
