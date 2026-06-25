import SuccessContainer from "@/components/SuccessContainer";
import { redirect } from "next/navigation";

interface Props {
  searchParams: {
    session_id: string | null;
    buynow?: string;
  };
}

const SuccessPage = ({ searchParams }: Props) => {
  const id = searchParams?.session_id;
  const buynow = searchParams?.buynow === "true";

  if (!id) {
    redirect("/");
  }

  return (
    <div>
      <SuccessContainer id={id} isBuyNow={buynow} />
    </div>
  );
};

export default SuccessPage;
