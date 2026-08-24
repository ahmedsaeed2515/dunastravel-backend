export interface TourImageResponse {
  id: string;
  imageUrl: string;
  isHero: boolean;
  altText: string | null;
  sortOrder: number;
}

export interface TourItineraryResponse {
  id: string;
  dayLabel: string | null;
  description: string;
  meals: string | null;
  sortOrder: number;
}

export interface TourSummaryResponse {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  basePriceUsd: string;
  duration: string;
  heroImage: string | null;
  country: string | null;
  languages: string[];
}

export interface TourDetailResponse {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  basePriceUsd: string;
  currency: string;
  duration: string;
  overview: string;
  cancellationPolicy: string | null;
  includedServices: string[];
  excludedServices: string[];
  hotelInfo: string | null;
  seasonPricing: string | null;
  tags: string[];
  difficultyLevel: string | null;
  meetingPoint: string | null;
  country: string | null;
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
