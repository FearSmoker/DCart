import { Queue, Worker, ConnectionOptions } from "bullmq";
import { redis } from "./redis";

const isBuildTime = process.env.NEXT_PHASE === "phase-production-build";

// queues
export const emailQueue = isBuildTime
  ? null as unknown as Queue
  : new Queue("emailQueue", { connection: redis as unknown as ConnectionOptions });
export const inventoryQueue = isBuildTime
  ? null as unknown as Queue
  : new Queue("inventoryQueue", { connection: redis as unknown as ConnectionOptions });
export const analyticsQueue = isBuildTime
  ? null as unknown as Queue
  : new Queue("analyticsQueue", { connection: redis as unknown as ConnectionOptions });

// singleton worker registration to prevent duplicate...
const globalForWorkers = globalThis as unknown as {
  emailWorker: Worker;
  inventoryWorker: Worker;
  analyticsWorker: Worker;
};

if (!isBuildTime) {
  // silence queue errors (reconnection is handled by ioredis)
  emailQueue.on("error", (err) => console.warn("[BullMQ Queue: Email] Connection error:", err.message));
  inventoryQueue.on("error", (err) => console.warn("[BullMQ Queue: Inventory] Connection error:", err.message));
  analyticsQueue.on("error", (err) => console.warn("[BullMQ Queue: Analytics] Connection error:", err.message));

  if (!globalForWorkers.emailWorker) {
    globalForWorkers.emailWorker = new Worker(
      "emailQueue",
      async (job) => {
        const { email, orderId, amount } = job.data;
        console.log(
          `[BullMQ Worker: Email] Starting order confirmation email process for Order ${orderId}...`
        );
        await new Promise((resolve) => setTimeout(resolve, 2000)); // simulate sending mail
        console.log(
          `[BullMQ Worker: Email] Success: Order confirmation email sent to ${email} for amount $${amount}.`
        );
      },
      { connection: redis as unknown as ConnectionOptions }
    );
    globalForWorkers.emailWorker.on("error", (err) => console.warn("[BullMQ Worker: Email] Connection error:", err.message));
  }

  if (!globalForWorkers.inventoryWorker) {
    globalForWorkers.inventoryWorker = new Worker(
      "inventoryQueue",
      async (job) => {
        const { items } = job.data;
        console.log(
          `[BullMQ Worker: Inventory] Updating stock levels for ${items?.length} items...`
        );
        await new Promise((resolve) => setTimeout(resolve, 1500)); // simulate database query
        console.log(
          `[BullMQ Worker: Inventory] Success: Inventory updated.`
        );
      },
      { connection: redis as unknown as ConnectionOptions }
    );
    globalForWorkers.inventoryWorker.on("error", (err) => console.warn("[BullMQ Worker: Inventory] Connection error:", err.message));
  }

  if (!globalForWorkers.analyticsWorker) {
    globalForWorkers.analyticsWorker = new Worker(
      "analyticsQueue",
      async (job) => {
        const { amount, email } = job.data;
        console.log(
          `[BullMQ Worker: Analytics] Aggregating sales metrics for purchase by ${email}...`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000)); // simulate aggregation
        console.log(
          `[BullMQ Worker: Analytics] Success: Aggregated sale of $${amount} into daily metrics.`
        );
      },
      { connection: redis as unknown as ConnectionOptions }
    );
    globalForWorkers.analyticsWorker.on("error", (err) => console.warn("[BullMQ Worker: Analytics] Connection error:", err.message));
  }
}

import { ProductData } from "../../types";

export async function queueOrderJobs(
  email: string,
  orderId: string,
  totalAmt: number,
  items: ProductData[]
) {
  try {
    await emailQueue.add("sendOrderEmail", { email, orderId, amount: totalAmt });
    await inventoryQueue.add("updateInventory", { items });
    await analyticsQueue.add("aggregateAnalytics", { amount: totalAmt, email });
    console.log(`[BullMQ] Successfully queued background jobs for Order ${orderId}.`);
  } catch (error) {
    console.error("[BullMQ] Error queuing background jobs:", error);
  }
}
