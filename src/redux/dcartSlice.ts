import { createSlice } from "@reduxjs/toolkit";
import { ProductData } from "../../types";

interface UserInfo {
  id: string;
  name: string;
  email: string;
  // add any other properties you expect...
}

interface InitialState {
  cart: ProductData[];
  favorite: ProductData[];
  userInfo: UserInfo | null;
  stockMap: Record<string, number>;
  buyNowCart: ProductData[] | null;
}

const initialState: InitialState = {
  cart: [],
  favorite: [],
  userInfo: null,
  stockMap: {},
  buyNowCart: null,
};

export const dcartSlice = createSlice({
  name: "dcart",
  initialState,
  reducers: {
    addToCart: (state, action) => {
      const existingProduct = state?.cart?.find(
        (item) => item?._id === action.payload._id
      );
      if (existingProduct) {
        existingProduct.quantity! += 1;
      } else {
        state.cart.push({ ...action.payload, quantity: 1 });
      }
    },
    increaseQuantity: (state, action) => {
      const existingProduct = state?.cart?.find(
        (item) => item?._id === action.payload
      );
      if (existingProduct) {
        existingProduct.quantity! += 1;
      }
    },
    decreaseQuantity: (state, action) => {
      const existingProduct = state?.cart?.find(
        (item) => item?._id === action.payload
      );
      if (existingProduct) {
        existingProduct.quantity! -= 1;
      }
    },
    removeFromCart: (state, action) => {
      state.cart = state.cart.filter((item) => item?._id !== action.payload);
    },
    resetCart: (state) => {
      state.cart = [];
    },
    // favorite cart
    addToFavorite: (state, action) => {
      const existingProduct = state?.favorite?.find(
        (item) => item?._id === action.payload?._id
      );
      if (existingProduct) {
        state.favorite = state.favorite.filter(
          (item) => item?._id !== action.payload._id
        );
      } else {
        state.favorite.push(action.payload);
      }
    },
    setFavorites: (state, action) => {
      state.favorite = action.payload;
    },
    resetFavorite: (state) => {
      state.favorite = [];
    },
    setBuyNowCart: (state, action) => {
      state.buyNowCart = action.payload;
    },
    resetBuyNowCart: (state) => {
      state.buyNowCart = null;
    },

    addUser: (state, action) => {
      state.userInfo = action.payload;
    },
    removeUser: (state) => {
      state.userInfo = null;
    },
    updateStock: (state, action) => {
      const { productId, quantityLeft } = action.payload;
      if (!state.stockMap) {
        state.stockMap = {};
      }
      state.stockMap[productId] = quantityLeft;
    },
  },
});

export const {
  addToCart,
  addUser,
  removeUser,
  increaseQuantity,
  decreaseQuantity,
  removeFromCart,
  resetCart,
  addToFavorite,
  resetFavorite,
  setFavorites,
  setBuyNowCart,
  resetBuyNowCart,
  updateStock,
} = dcartSlice.actions;
export default dcartSlice.reducer;
