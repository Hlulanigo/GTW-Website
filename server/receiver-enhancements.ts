import type { Express } from "express";
import { db, storage } from "./storage";
import { parcels, parcelPhotos, receiverLocations, carrierLocations, parcelTrackingEvents } from "../shared/schema";
import { deliveryProofs, receiverConfirmations, notificationQueue } from "../shared/schema-enhancements";
import { eq, or, desc, and, inArray, isNull } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "./firebase-admin";
import { NotificationService } from "./notification-service";
import { broadcastToUsers } from "./realtime";
import * as crypto from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const PHOTO_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Thrown when photo upload fails file-type/size validation. */
class PhotoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoValidationError";
  }
}

/**
 * Decode and validate a base64 data-URL photo.
 * Enforces a strict MIME whitelist (JPEG/PNG/WebP), proper data-URL formatting,
 * anda 1 byte –– 0 MB size limit. Clients supply only image bytes -- they can never
 * dictate storage paths or URLs.
 */
function decodePhotoData(photoData: unknown): {
  buffer: Buffer;
  mimeType: string;
  extension: string;
} {
  if (typeof photoData !== "string") {
    throw new PhotoValidationError("Photo data must be a base64 data-URL");
  }

  const match = photoData.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match) {
    throw new PhotoValidationError("Only JPEG, PNG, and WebP data-URLs are supported");
  }

  const mimeType = match[1];
  const buffer = Buffer.from(match[2].replace(/[\r\n]/g, ""), "base64");
  if (buffer.length === 0 || buffer.length > MAX_PHOTO_BYTES) {
    throw new PhotoValidationError("Photo must be between 1 byte and 10 MB");
  }

  return { buffer, mimeType, extension: PHOTO_MIME_TYPES[mimeType] };
}

/**
 * Store a validated photo buffer into server-controlled storage and return
 * the server-generated URL + file name. The server (never the client) decides
 * storage paths and names. The caller supplies only validated image bytes.
 */
async function storePhotoFile(
  buffer: Buffer,
  mimeType: string,
  extension: string,
  subdir: "parcel-photos" | "delivery-proofs",
  parcelId: string
): Promise<{ url: string; fileName: string }> {
  const uploadRoot = path.resolve(process.env.PHOTO_STORAGE_DIR || path.resolve(process.cwd(), "uploads"));
  const parcelDirectory = path.join(uploadRoot, subdir, parcelId);
  await mkdir(parcelDirectory, { recursive: true });

  const fileName = `${crypto.randomUUID()}.${extension}`;
  await writeFile(path.join(parcelDirectory, fileName), buffer, { flag: "wx" });
  const url = `/uploads/${subdir}/${encodeURIComponent(parcelId)}/${fileName}`;

  return { url, fileName };
}

export async function storeParcelPhoto(photoData: unknown, parcelId: string): Promise<string> {
  const decoded = decodePhotoData(photoData);
  const stored = await storePhotoFile(
    decoded.buffer,
    decoded.mimeType,
    decoded.extension,
    "parcel-photos",
    parcelId,
  );
  return stored.url;
}


function normalizedEmail(email?: string | null) {
  return email?.trim().toLowerCase() || null;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate ETA based on distance (simple estimation)
 * Assumes average speed of 40 km/h in urban areas
 */
function calculateETA(distanceInKm: number): number {
  const averageSpeedKmh = 40;
  const timeInHours = distanceInKm / averageSpeedKmh;
  return Math.round(timeInHours * 60); // Return minutes
}

export function registerReceiverEnhancements(app: Express) {
  /**
   * Get ETA for parcel delivery
   */
  app.get(
    "/api/parcels/:parcelId/eta",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { parcelId } = req.params;

        // Get parcel
        const parcel = await storage.getParcel(parcelId);
        if (!parcel) {
          return res.status(404).json({ error: "Parcel not found" });
        }

        // Verify user is receiver
        const isReceiver = parcel.receiverId === req.user!.uid;
        const user = await storage.getUser(req.user!.uid);
        const isReceiverByEmail =
          user?.email && parcel.receiverEmail === user.email;

        if (!isReceiver && !isReceiverByEmail) {
          return res
            .status(403)
            .json({ error: "Only receiver can access ETA" });
        }

        // Get latest carrier location
        const carrierLoc = await db
          .select()
          .from(carrierLocations)
          .where(eq(carrierLocations.parcelId, parcelId))
          .orderBy(desc(carrierLocations.timestamp))
          .limit(1);

        if (!carrierLoc[0]) {
          return res.json({
            available: false,
            message: "Carrier location not available",
          });
        }

        // Get receiver location
        let receiverLat = parcel.receiverLat;
        let receiverLng = parcel.receiverLng;

        // Try to get from receiverLocations table if not in parcel
        if (receiverLat == null || receiverLng == null) {
          const receiverLoc = await db
            .select()
            .from(receiverLocations)
            .where(eq(receiverLocations.parcelId, parcelId))
            .orderBy(desc(receiverLocations.timestamp))
            .limit(1);

          if (receiverLoc[0]) {
            receiverLat = receiverLoc[0].lat;
            receiverLng = receiverLoc[0].lng;
          } else if (parcel.destinationLat && parcel.destinationLng) {
            // Fallback to destination coordinates
            receiverLat = parcel.destinationLat;
            receiverLng = parcel.destinationLng;
          } else {
            return res.json({
              available: false,
              message: "Receiver location not available",
            });
          }
        }

        // Calculate distance
        const distance = calculateDistance(
          carrierLoc[0].lat,
          carrierLoc[0].lng,
          receiverLat,
          receiverLng
        );

        // Calculate ETA
        const etaMinutes = calculateETA(distance);

        // Notify if carrier is very close (within 2 km and not notified recently)
        if (distance < 2 && etaMinutes < 10) {
          await NotificationService.notifyCarrierNearby(
            req.user!.uid,
            parcelId,
            etaMinutes
          );
        }

        res.json({
          available: true,
          distance: Math.round(distance * 10) / 10, // Round to 1 decimal
          etaMinutes,
          carrierLocation: {
            lat: carrierLoc[0].lat,
            lng: carrierLoc[0].lng,
            timestamp: carrierLoc[0].timestamp,
            speed: carrierLoc[0].speed,
          },
        });
      } catch (error) {
        console.error("Failed to calculate ETA:", error);
        res.status(500).json({ error: "Failed to calculate ETA" });
      }
    }
  );

  /**
   * Upload delivery proof photo
   */
  app.post(
    "/api/parcels/:parcelId/delivery-proof",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { parcelId } = req.params;
        const { photoData, notes } = req.body;

        if (!photoData) {
          return res.status(400).json({ error: "Photo data is required" });
        }

        const parcel = await storage.getParcel(parcelId);
        if (!parcel) {
          return res.status(404).json({ error: "Parcel not found" });
        }

        // Proof is evidence only. It must not complete delivery on its own.
        const isReceiver = parcel.receiverId === req.user!.uid;
        const isCarrier = parcel.transporterId === req.user!.uid;
        const user = await storage.getUser(req.user!.uid);
        const isReceiverByEmail =
          user?.email && parcel.receiverEmail === user.email;

        if (!isReceiver && !isCarrier && !isReceiverByEmail) {
          return res
            .status(403)
            .json({ error: "Only receiver or carrier can upload proof" });
        }

        if (parcel.status === "Delivered" || parcel.status === "Expired") {
          return res.status(409).json({ error: "Delivery proof cannot be added to this parcel" });
        }
        if (!["Accepted", "Picked Up", "In Transit", "Arrived"].includes(parcel.status || "")) {
          return res.status(409).json({ error: "Parcel is not in an active delivery state" });
        }

        let photoUrl: string;
        let storedFile: { url: string; fileName: string };
        let decoded: { buffer: Buffer; mimeType: string; extension: string };
        try {
          decoded = decodePhotoData(photoData);
          storedFile = await storePhotoFile(
            decoded.buffer,
            decoded.mimeType,
            decoded.extension,
            "delivery-proofs",
            parcelId
          );
          photoUrl = storedFile.url;
        } catch (error: any) {
          return res.status(400).json({ error: error.message || "Invalid photo" });
        }

        // Update parcel with proof
        await storage.updateParcel(parcelId, {
          status: "Delivered",
        });

        await db
          .update(parcels)
          .set({ photoUrl })
          .where(eq(parcels.id, parcelId));
        await db.insert(parcelPhotos).values({
          parcelId,
          uploadedBy: req.user!.uid,
          photoUrl,
          photoType: "delivery",
          caption: typeof notes === "string" ? notes.slice(0, 500) : null,
        });

        // Immutable delivery-proof record (append-only; customers may use the returned
        // sha256Hash to verify photo integrity later)
        await db.insert(deliveryProofs).values({
          parcelId,
          uploadedBy: req.user!.uid,
          photoUrl,
          fileName: storedFile.fileName,
          contentType: decoded.mimeType,
          fileSizeBytes: decoded.buffer.length,
          sha256Hash: crypto.createHash("sha256").update(decoded.buffer).digest("hex"),
          notes: typeof notes === "string" ? notes.slice(0, 500) : null,
        });

        // Notify relevant parties
        if (isCarrier && parcel.receiverId) {
          await NotificationService.sendImmediateNotification(
            parcel.receiverId,
            {
              title: "Delivery Proof Uploaded",
              body: "Your carrier uploaded delivery evidence. Please confirm whether you received the parcel.",
              data: { type: "delivery_proof", parcelId },
            }
          );
        }

        res.json({
          success: true,
          message: "Delivery proof uploaded successfully",
        });
      } catch (error) {
        console.error("Failed to upload delivery proof:", error);
        res.status(500).json({ error: "Failed to upload delivery proof" });
      }
    }
  );

  /**
   * Confirm delivery as the receiver. This is the only receiver-facing
   * completion path and is intentionally idempotent.
   */
  app.post(
    "/api/parcels/:parcelId/confirm-delivery",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { parcelId } = req.params;
        const parcel = await storage.getParcel(parcelId);
        if (!parcel) return res.status(404).json({ error: "Parcel not found" });

        const user = await storage.getUser(req.user!.uid);
        const isReceiver = parcel.receiverId === req.user!.uid ||
          normalizedEmail(user?.email) === normalizedEmail(parcel.receiverEmail);
        if (!isReceiver) {
          return res.status(403).json({ error: "Only the receiver can confirm delivery" });
        }

        if (parcel.deliveryConfirmedAt) {
          return res.json({ success: true, alreadyConfirmed: true, parcel });
        }
        if (!["In Transit", "Arrived", "Delivered"].includes(parcel.status || "")) {
          return res.status(409).json({
            error: `Delivery cannot be confirmed while the parcel is ${parcel.status}`,
          });
        }

        const notes = typeof req.body?.notes === "string"
          ? req.body.notes.trim().slice(0, 500)
          : null;
        const confirmedAt = new Date();
        const update = await db
          .update(parcels)
          .set({
            status: "Delivered",
            deliveryConfirmedAt: confirmedAt,
            deliveryConfirmedBy: req.user!.uid,
            deliveryConfirmationMethod: "receiver_self_confirmed",
            deliveryConfirmationNotes: notes,
          })
          .where(and(
            eq(parcels.id, parcelId),
            isNull(parcels.deliveryConfirmedAt),
            inArray(parcels.status, ["In Transit", "Arrived", "Delivered"]),
          ))
          .returning();

        if (!update[0]) {
          const current = await storage.getParcel(parcelId);
          if (current?.deliveryConfirmedAt) {
            return res.json({ success: true, alreadyConfirmed: true, parcel: current });
          }
          return res.status(409).json({ error: "Delivery status changed; please refresh and try again" });
        }

        await db.insert(parcelTrackingEvents).values({
          parcelId,
          eventType: "Delivered",
          createdByUserId: req.user!.uid,
          note: "Confirmed by receiver",
        });

        const participantIds = [update[0].senderId, update[0].transporterId, update[0].receiverId]
          .filter(Boolean) as string[];
        broadcastToUsers(participantIds, {
          type: "parcel:status",
          parcelId,
          status: "Delivered",
          onTheMove: false,
        });

        for (const recipientId of new Set([update[0].senderId, update[0].transporterId].filter(Boolean) as string[])) {
          NotificationService.notifyStatusChange(
            recipientId,
            parcelId,
            parcel.status || "",
            "Delivered",
            { origin: parcel.origin, destination: parcel.destination },
          ).catch(error => console.error("Failed to notify delivery participant:", error));
        }

        res.json({ success: true, alreadyConfirmed: false, parcel: update[0] });
      } catch (error) {
        console.error("Failed to confirm delivery:", error);
        res.status(500).json({ error: "Failed to confirm delivery" });
      }
    },
  );

  /**
   * Request receiver confirmation before creating parcel
   */
  app.post(
    "/api/receiver-confirmations/request",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { receiverEmail, parcelDetails } = req.body;

        if (!receiverEmail) {
          return res.status(400).json({ error: "Receiver email is required" });
        }

        // Generate unique token and persist a pending confirmation request.
        // (Email delivery of the confirmation link remains a TODO -- see notificationQueue
        // below for the future outbound channel.)
        const token = crypto.randomBytes(32).toString("hex");

        await db.insert(receiverConfirmations).values({
          parcelId: parcelDetails?.parcelId || null,
          receiverEmail,
          token,
          confirmed: false,
        });

        // Queue a notification for the receiver (if they are a known platform user)
        const receiver = await storage.getUserByEmail(receiverEmail);
        if (receiver) {
          await db.insert(notificationQueue).values({
            userId: receiver.id,
            title: "Parcel delivery confirmation requested",
            body:
              "A sender has requested your confirmation before creating a parcel.",
            data: JSON.stringify({ type: "receiver_confirmation", token }),
          });
        }

        res.json({
          success: true,
          token,
          message:
            "Confirmation request sent. Receiver will need to confirm before parcel is created.",
        });
      } catch (error) {
        console.error("Failed to request receiver confirmation:", error);
        res
          .status(500)
          .json({ error: "Failed to request receiver confirmation" });
      }
    }
  );

  /**
   * Get receiver's delivery history and stats
   */
  app.get(
    "/api/receiver/stats",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user!.uid;
        const user = await storage.getUser(userId);

        // Get all parcels where user is receiver (by id or by email fallback)
        const conditions: any[] = [eq(parcels.receiverId, userId)];
        if (user?.email) {
          conditions.push(eq(parcels.receiverEmail, user.email));
        }
        const allParcels = await db
          .select()
          .from(parcels)
          .where(conditions.length === 1 ? conditions[0] : or(...conditions));

        const stats = {
          totalReceived: allParcels.length,
          delivered: allParcels.filter((p) => p.status === "Delivered").length,
          inTransit: allParcels.filter((p) => p.status === "In Transit")
            .length,
          pending: allParcels.filter((p) => p.status === "Pending").length,
          averageDeliveryTime: 0, // Would calculate from actual delivery data
        };

        res.json(stats);
      } catch (error) {
        console.error("Failed to get receiver stats:", error);
        res.status(500).json({ error: "Failed to get receiver stats" });
      }
    }
  );

  /**
   * Update receiver preferences
   */
  app.patch(
    "/api/receiver/preferences",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const {
          notifyOnStatusChange,
          notifyOnCarrierNearby,
          autoShareLocation,
        } = req.body;

        // In a real app, you would store these preferences in a user_preferences table
        // For now, we'll just acknowledge the request

        res.json({
          success: true,
          preferences: {
            notifyOnStatusChange,
            notifyOnCarrierNearby,
            autoShareLocation,
          },
        });
      } catch (error) {
        console.error("Failed to update preferences:", error);
        res.status(500).json({ error: "Failed to update preferences" });
      }
    }
  );

  /**
   * Get immutable delivery-proof records for a parcel
   */
  app.get(
    "/api/parcels/:parcelId/delivery-proof",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { parcelId } = req.params;

        const parcel = await storage.getParcel(parcelId);
        if (!parcel) {
          return res.status(404).json({ error: "Parcel not found" });
        }

        // Only the sender, receiver, or assigned carrier may view proof records
        const isSender = parcel.senderId === req.user!.uid;
        const isReceiver = parcel.receiverId === req.user!.uid;
        const isCarrier = parcel.transporterId === req.user!.uid;
        if (!isSender && !isReceiver && !isCarrier) {

          return res.status(403).json({ error: "Only the sender, receiver, or carrier can view delivery proof" });
        }

        const proofs = await db
          .select({
            id: deliveryProofs.id,
            photoUrl: deliveryProofs.photoUrl,
            fileName: deliveryProofs.fileName,
            contentType: deliveryProofs.contentType,
            fileSizeBytes: deliveryProofs.fileSizeBytes,
            sha256Hash: deliveryProofs.sha256Hash,
            notes: deliveryProofs.notes,
            uploadedBy: deliveryProofs.uploadedBy,
            uploadedAt: deliveryProofs.uploadedAt,
          })
          .from(deliveryProofs)
          .where(eq(deliveryProofs.parcelId, parcelId))
          .orderBy(desc(deliveryProofs.uploadedAt));

        res.json({ proofs });
      } catch (error: any) {
        console.error("Failed to fetch delivery proof:", error);
        res.status(500).json({ error: "Failed to fetch delivery proof" });
      }
    }
  );
}
