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
}

export interface TourDetailResponse {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  basePriceUsd: string;
  duration: string;
  overview: string;
  cancellationPolicy: string | null;
  includedServices: string | null;
  excludedServices: string | null;
  hotelInfo: string | null;
  seasonPricing: string | null;
  tags: string[];
  difficultyLevel: string | null;
  meetingPoint: string | null;
  itinerary: TourItineraryResponse[];
  images: TourImageResponse[];
}
