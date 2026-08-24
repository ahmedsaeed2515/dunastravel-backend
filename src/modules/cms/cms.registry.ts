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
  about: { owner: 'marketing', public: true, locales: CMS_LOCALES, kind: 'localized-object', consumers: ['frontend/About'] },
  faq_page: { owner: 'support', public: true, locales: CMS_LOCALES, kind: 'localized-object', consumers: ['frontend/FAQ'] },
  global_seo: { owner: 'marketing', public: false, locales: CMS_LOCALES, kind: 'localized-object', consumers: ['dashboard/content'] },
  holiday_packages: { owner: 'catalog', public: true, locales: CMS_LOCALES, kind: 'catalog', consumers: ['frontend/Home'] },
  hotels_catalog: { owner: 'accommodation', public: true, locales: CMS_LOCALES, kind: 'catalog', consumers: ['frontend/useServices', 'frontend/HotelDetails'] },
  transportation_fleet: { owner: 'transport', public: true, locales: CMS_LOCALES, kind: 'catalog', consumers: ['frontend/useServices'] },
  home_banner: { owner: 'marketing', public: true, locales: CMS_LOCALES, kind: 'localized-object', consumers: ['traveler CMS hook tests'] },
  'homepage.hero': { owner: 'marketing', public: true, locales: CMS_LOCALES, kind: 'localized-object', consumers: ['CMS contract tests'] },
} as const satisfies Record<string, CmsBlockDefinition>;

export type CmsBlockKey = keyof typeof CMS_BLOCK_REGISTRY;

export function getCmsBlockDefinition(key: string): CmsBlockDefinition | undefined {
  return CMS_BLOCK_REGISTRY[key as CmsBlockKey];
}

export function isCmsLocale(value: string | undefined): value is CmsLocale {
  return Boolean(value && CMS_LOCALES.includes(value as CmsLocale));
}
