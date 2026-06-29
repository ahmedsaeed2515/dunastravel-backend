export const MEDIA_UPLOADED_EVENT = 'media.uploaded';

export interface MediaUploadedEvent {
  assetId: string;
  publicId: string;
  entityType: string;
  entityId: string | null;
  uploadedBy: string | null;
  url: string;
  occurredAt: Date;
}
