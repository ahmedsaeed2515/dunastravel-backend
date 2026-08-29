export interface TourImageResponse {
  id: string;
  imageUrl: string;
  isHero: boolean;
  altText: string | null;
  sortOrder: number;
  isVideo?: boolean;
  videoUrl?: string | null;
}

export interface TourItineraryResponse {
  id: string;
  dayLabel: string | null;
  description: string;
  meals: string | null;
  sortOrder: number;
  activities?: string | null;
  hotels?: string | null;
  notes?: string | null;
  transportation?: string | null;
}

export interface TourSummaryResponse {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  basePriceUsd: string;
  currency: string;
  duration: string;
  overview: string;
  highlights: string[];
  heroImage: string | null;
  country: string | null;
  city?: string | null;
  languages: string[];
  isFeatured: boolean;
}

export interface TourDetailResponse {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  category: string | null;
  basePriceUsd: string;
  currency: string;
  duration: string;
  overview: string;
  highlights: string[];
  departureInfo: string | null;
  sourceCode: string | null;
  market: string | null;
  sourceRating: string | null;
  sourceReviewCount: number | null;
  cancellationPolicy: string | null;
  includedServices: string[];
  excludedServices: string[];
  hotelInfo: unknown | null;
  seasonPricing: unknown | null;
  transportation: unknown | null;
  terms: unknown | null;
  tags: string[];
  difficultyLevel: string | null;
  meetingPoint: string | null;
  country: string | null;
  city: string | null;
  minPax: string | null;
  departureTime: string | null;
  returnTime: string | null;
  ageRestrictions: string | null;
  pickupLocations: string[] | null;
  seoTitle: string | null;
  seoDescription: string | null;
  customBadge: string | null;
  heroImage: string | null;
  heroVideoUrl: string | null;
  languages: string[];
  isFeatured: boolean;
  itinerary: TourItineraryResponse[];
  images: TourImageResponse[];
}

/**
 * The admin-only preview uses the exact public presentation fields plus the
 * visibility context needed to label an unpublished tour safely.
 */
export interface TourPreviewResponse extends TourDetailResponse {
  preview: {
    status: string;
    isActive: boolean;
    isPublic: boolean;
  };
}
