import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getProductImageSrc(product: any) {
  try {
    const img = product.image;
    if (typeof img === "string") return img;
    return "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=300&auto=format&fit=crop";
  } catch {
    return "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=300&auto=format&fit=crop";
  }
}
