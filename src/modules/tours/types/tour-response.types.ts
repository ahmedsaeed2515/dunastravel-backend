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
  title?: string | null;
  titleJsonb?: unknown;
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
  priceDisplayMode?: string | null;
  priceLabel?: string | null;
  bookingRules?: unknown | null;
  duration: string;
  overview: string;
  highlights: string[];
  includedServices?: string[];
  excludedServices?: string[];
  heroImage: string | null;
  heroImageUrl?: string | null;
  images?: string[];
  country: string | null;
  city?: string | null;
  languages: string[];
  isFeatured: boolean;
  displayOrder: number;
}

export interface TourAccommodationResponse {
  id: string;
  hotelId: string;
  roomId: string | null;
  city: string | null;
  destination?: string | null;
  categoryTier: string | null;
  nights: number;
  dayFrom: number | null;
  dayTo: number | null;
  dayRange?: string | null;
  priceSupplementUsd: string;
  priceSupplement?: number;
  isDefault: boolean;
  notes: string | null;
  sortOrder: number;
  hotel: {
    id: string;
    slug: string;
    name: string;
    city: string;
    country: string;
    starRating: number;
    stars?: number;
    isGlobal?: boolean;
    heroImageUrl: string | null;
    images: Array<{
      id: string;
      imageUrl: string;
      altText: string | null;
      isHero: boolean;
    }>;
  } | null;
  room: {
    id: string;
    slug: string;
    name: string;
    roomType: string | null;
    capacity: number;
    basePriceUsd: string;
    ratePerNight?: number;
    currency: string;
    heroImageUrl: string | null;
    seasonPricings: Array<{
      id: string;
      seasonId: string | null;
      seasonName: string | null;
      startDate: string | null;
      endDate: string | null;
      boardBasis: string;
      pricePerNightUsd: string;
      ratePerNightUsd?: number;
      singleSupplementUsd: string | null;
      extraBedPriceUsd: string | null;
      childPriceUsd: string | null;
      currency: string;
    }>;
  } | null;
}

export interface TourDetailResponse {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  category: string | null;
  basePriceUsd: string;
  currency: string;
  priceDisplayMode?: string | null;
  priceLabel?: string | null;
  priceLabelJsonb?: unknown | null;
  bookingRules?: unknown | null;
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
  routeMapJsonb?: unknown | null;
  routeMap?: unknown | null;
  itinerary: TourItineraryResponse[];
  images: TourImageResponse[];
  accommodations?: TourAccommodationResponse[];
  tripHotel?: unknown | null;
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
