import type { Express } from "express";
import { db, storage } from "./storage";
import { parcels, receiverLocations, carrierLocations, parcelTrackingEvents } from "../shared/schema";
import { eq, desc, and, inArray, isNull, or } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "./firebase-admin";
import { NotificationService } from "./notification-service";
import { broadcastToUsers } from "./realtime";
import * as crypto from "crypto";

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
        const { photoUrl, notes } = req.body;

        if (!photoUrl) {
          return res.status(400).json({ error: "Photo URL is required" });
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

        // Store photo evidence without changing the delivery state.
        await db
          .update(parcels)
          .set({ photoUrl })
          .where(eq(parcels.id, parcelId));

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

        // Generate unique token
        const token = crypto.randomBytes(32).toString("hex");

        // In a real app, you would:
        // 1. Create a pending confirmation record
        // 2. Send an email to the receiver with a confirmation link
        // 3. Store parcel details temporarily

        // For now, we'll just return the token
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

        // Get all parcels where user is receiver
        const user = await storage.getUser(userId);
        const allParcels = await db
          .select()
          .from(parcels)
          .where(user?.email
            ? or(eq(parcels.receiverId, userId), eq(parcels.receiverEmail, user.email))
            : eq(parcels.receiverId, userId));

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
}
