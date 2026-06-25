import CartContainer from "@/components/CartContainer";
import Container from "@/components/Container";
import React from "react";
import { auth } from "@/auth";
import AccessDenied from "@/components/AccessDenied";

const CartPage = async () => {
  const session = await auth();
  if (session?.user && (session.user as { role?: string }).role === "seller") {
    return (
      <Container className="py-10">
        <AccessDenied message="Sellers are not permitted to manage a shopping cart or purchase products." />
      </Container>
    );
  }

  return (
    <Container className="py-10">
      <CartContainer />
    </Container>
  );
};

export default CartPage;
