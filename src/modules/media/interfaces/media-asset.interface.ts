import { MediaEntityType, MediaProvenance } from '@prisma/client';

export interface IMediaAsset {
  id: string;
  publicId: string;
  url: string;
  secureUrl: string;
  providerName: string;
  format: string;
  mimeType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  entityType: MediaEntityType;
  entityId: string | null;
  provenance: MediaProvenance;
  altText: string | null;
  uploadedBy: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  title?: string | null;
  description?: string | null;
  mediaType?: string;
  cloudinaryResourceType?: string;
  thumbnailUrl?: string | null;
  optimizedUrl?: string | null;
  duration?: number | null;
  isShowcase?: boolean;
  showcaseSection?: string | null;
  showcasePosition?: number | null;
  isActive?: boolean;
  isPublished?: boolean;
  metadata?: any;
}
