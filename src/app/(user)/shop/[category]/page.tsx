import { redirect } from "next/navigation";

interface CategoryPageProps {
  params: {
    category: string;
  };
}

// this page redirects to the main...
// the shop page handles filtering client-side,...
const CategoryPage = ({ params }: CategoryPageProps) => {
  redirect(`/shop?category=${params.category}`);
};

export default CategoryPage;
