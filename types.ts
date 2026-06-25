export interface BannerData {
  _id: string;
  _type: string;
  _createdAt: string;
  _updatedAt: string;
  _rev: string;
  image: {
    _type: string;
    asset: {
      _ref: string;
      _type: string;
    };
  };
  title: string;
  subtitle: string;
  price: number;
  description: string;
}

type ImageAsset = {
  _type: "image";
  asset: {
    _ref: string;
    _type: "reference";
  };
};

type Slug = {
  current: string;
  _type: "slug";
};

type Category = {
  _id: string;
  name: string;
};

export interface ProductData {
  title: string;
  image: ImageAsset | string;
  quantity: number;
  price: number;
  category: Category[];
  slug: Slug;
  _createdAt: string;
  description: string;
  _updatedAt: string;
  ratings: number;
  ratingCount?: number;
  brand: string;
  _type: "product";
  _id: string;
  position: string;
  rowprice: number;
  variants?: Array<{
    color: string;
    model?: string;
    images: string[];
    price?: number;
    quantity?: number;
  }>;
  customFields?: Record<string, string>;
  material?: string | null;
  modelInfo?: string | null;
  vendorId?: string;
  materialsCare?: string[];
  featuresSpecs?: string[];
  measurements?: string[];
  inTheBox?: string[];
}

export interface Review {
  reviewId: string;
  email: string;
  rating: number;
  comment: string;
  title?: string;
  images?: string[];
  timestamp: string;
  helpfulCount?: number;
  verifiedPurchase?: boolean;
}

export interface StoreState {
  dcart: {
    cart: ProductData[];
    favorite: ProductData[];
    buyNowCart: ProductData[] | null;
  };
}
