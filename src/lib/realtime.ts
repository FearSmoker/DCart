// * central realtime publish helper. all...
import { pub } from "./pubsub";

export type RealtimeEvent =
  | { type: "order:created"; data: { email: string; orderId: string; amount: number } }
  | { type: "order:cancelled"; data: { email: string; orderId: string } }
  | { type: "order:dispatched"; data: { email: string; orderId: string } }
  | { type: "order:delivered"; data: { email: string; orderId: string } }
  | { type: "order:returned"; data: { email: string; orderId: string } }
  | { type: "order:return_requested"; data: { email: string; orderId: string; reason: string } }
  | { type: "order:return_dispatched"; data: { email: string; orderId: string } }
  | { type: "order:return_seller_rejected"; data: { email: string; orderId: string; vendorId: string } }
  | { type: "order:return_admin_declined"; data: { email: string; orderId: string } }
  | { type: "review:added"; data: { productId: string; rating: number } }
  | { type: "product:created"; data: { vendorId: string; productId: string; title: string } }
  | { type: "inventory:updated"; data: { productId: string; stock: number } }
  | { type: "analytics:updated"; data: Record<string, unknown> }
  | { type: "payout:approved"; data: { vendorId: string; orderId: string; amount: number } }
  | { type: "payout:rejected"; data: { vendorId: string; orderId: string } }
  | { type: "log:entry"; data: { level: string; message: string; ts: string } };

export async function publishRealtime(event: RealtimeEvent): Promise<void> {
  try {
    await pub.publish("dcart:events", JSON.stringify(event));
  } catch (err) {
    // non-critical — don't fail the primary operation
    console.warn("[Realtime] Failed to publish event:", event.type, err);
  }
}
