import { db } from "./storage";
import { notifications } from "../shared/schema";
import { getMessaging } from "./firebase-admin";

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

export class NotificationService {
  /**
   * Send push notifications to all devices for a user via FCM,
   * and persist to the in-app notification feed.
   */
  static async sendImmediateNotification(
    userId: string,
    payload: NotificationPayload
  ): Promise<boolean> {
    try {
      // Always persist notification to DB for in-app feed
      await db.insert(notifications).values({
        userId,
        type: payload.data?.type as string || "general",
        title: payload.title,
        body: payload.body,
        data: payload.data ? JSON.stringify(payload.data) : null,
        isRead: false,
      }).catch(err => console.error("Failed to persist notification:", err));

      // Send via Firebase Cloud Messaging (topic-based per user)
      const messaging = getMessaging();
      if (messaging) {
        try {
          await messaging.send({
            topic: `user_${userId}`,
            notification: { title: payload.title, body: payload.body },
            data: payload.data
              ? Object.fromEntries(
                  Object.entries(payload.data).map(([k, v]) => [k, String(v)])
                )
              : undefined,
          });
        } catch (fcmErr) {
          console.warn("FCM send failed (non-fatal):", fcmErr);
        }
      }

      return true;
    } catch (error) {
      console.error("Failed to send push notification:", error);
      return false;
    }
  }

  /**
   * Notify sender that a carrier has accepted their parcel
   */
  static async notifyParcelAccepted(
    senderId: string,
    parcelId: string,
    carrierName: string
  ): Promise<void> {
    await this.sendImmediateNotification(senderId, {
      title: "Carrier Found! 🎉",
      body: `${carrierName} has accepted your parcel and will pick it up soon.`,
      data: {
        type: "parcel_accepted",
        parcelId,
      },
    });
  }

  /**
   * Notify relevant users about a parcel status change
   */
  static async notifyStatusChange(
    userId: string,
    parcelId: string,
    oldStatus: string,
    newStatus: string,
    context?: { origin?: string; destination?: string }
  ): Promise<void> {
    const routeText = context?.origin && context?.destination
      ? ` (${context.origin} → ${context.destination})`
      : "";

    const statusMessages: Record<string, { title: string; body: string }> = {
      Accepted: {
        title: "Carrier Found! 🎉",
        body: `Your parcel${routeText} has been accepted by a carrier.`,
      },
      "Picked Up": {
        title: "Parcel Picked Up 📦",
        body: `Your parcel${routeText} has been picked up and is on its way!`,
      },
      "In Transit": {
        title: "Parcel In Transit 🚚",
        body: `Your parcel${routeText} is on the move!`,
      },
      Delivered: {
        title: "Parcel Delivered! ✅",
        body: `Your parcel${routeText} has been delivered successfully.`,
      },
      Expired: {
        title: "Parcel Listing Expired",
        body: `Your parcel listing${routeText} has expired.`,
      },
    };

    const msgConfig = statusMessages[newStatus];
    if (!msgConfig) return;

    await this.sendImmediateNotification(userId, {
      title: msgConfig.title,
      body: msgConfig.body,
      data: {
        type: "parcel_status_change",
        parcelId,
        oldStatus,
        newStatus,
      },
    });
  }

  /**
   * Notify a user about a new chat message
   */
  static async notifyNewMessage(
    recipientId: string,
    parcelId: string,
    senderName: string,
    messagePreview: string
  ): Promise<void> {
    const preview = messagePreview.length > 60
      ? messagePreview.substring(0, 60) + "..."
      : messagePreview;

    await this.sendImmediateNotification(recipientId, {
      title: `Message from ${senderName}`,
      body: preview,
      data: {
        type: "new_message",
        parcelId,
      },
    });
  }

  /**
   * Notify receiver about new incoming parcel
   */
  static async notifyNewIncomingParcel(
    receiverId: string,
    parcelId: string,
    senderName: string
  ): Promise<void> {
    await this.sendImmediateNotification(receiverId, {
      title: "Incoming Parcel 📬",
      body: `${senderName} is sending you a parcel. Tap to view details.`,
      data: {
        type: "new_incoming_parcel",
        parcelId,
      },
    });
  }

  /**
   * Notify when carrier is nearby
   */
  static async notifyCarrierNearby(
    receiverId: string,
    parcelId: string,
    estimatedMinutes: number
  ): Promise<void> {
    await this.sendImmediateNotification(receiverId, {
      title: "Carrier is Nearby! 📍",
      body: `Your delivery will arrive in approximately ${estimatedMinutes} minutes`,
      data: {
        type: "carrier_nearby",
        parcelId,
        estimatedMinutes,
      },
    });
  }

  /**
   * Notify carrier (route owner) of a new parcel booking request on their route
   */
  static async notifyNewRouteBookingRequest(
    carrierId: string,
    bookingId: string,
    routeId: string,
    senderName: string,
    routeSummary: string
  ): Promise<void> {
    await this.sendImmediateNotification(carrierId, {
      title: "New parcel along your route 📦",
      body: `${senderName} wants to add a parcel to your route (${routeSummary}). Tap to review.`,
      data: {
        type: "route_booking_request",
        bookingId,
        routeId,
      },
    });
  }

  /**
   * Notify sender that the carrier responded to their route booking request
   */
  static async notifyRouteBookingDecision(
    senderId: string,
    bookingId: string,
    parcelId: string,
    routeId: string,
    decision: "Approved" | "Declined",
    carrierName: string
  ): Promise<void> {
    const approved = decision === "Approved";
    await this.sendImmediateNotification(senderId, {
      title: approved ? "Booking approved! 🎉" : "Booking declined",
      body: approved
        ? `${carrierName} approved your parcel on their route. They'll pick it up soon.`
        : `${carrierName} declined your parcel for this route. You can request another route.`,
      data: {
        type: approved ? "route_booking_approved" : "route_booking_declined",
        bookingId,
        parcelId,
        routeId,
      },
    });
  }

  /**
   * Request delivery confirmation from receiver
   */
  static async requestDeliveryConfirmation(
    receiverId: string,
    parcelId: string
  ): Promise<void> {
    await this.sendImmediateNotification(receiverId, {
      title: "Confirm Delivery ✅",
      body: "Have you received your parcel? Please confirm delivery.",
      data: {
        type: "confirm_delivery",
        parcelId,
      },
    });
  }
}
