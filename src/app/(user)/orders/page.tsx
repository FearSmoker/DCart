import Container from "@/components/Container";
import Orders from "@/components/Orders";
import Title from "@/components/Title";
import React from "react";
import { auth } from "@/auth";
import AccessDenied from "@/components/AccessDenied";

const OrdersPage = async () => {
  const session = await auth();
  if (session?.user && (session.user as { role?: string }).role === "seller") {
    return (
      <Container className="py-10">
        <AccessDenied message="Sellers do not have access to customer orders pages." />
      </Container>
    );
  }

  return (
    <Container className="py-10">
      <Title>Your Orders</Title>
      <Orders />
    </Container>
  );
};

export default OrdersPage;
