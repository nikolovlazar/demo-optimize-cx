import { ProductCard } from "@/components/ProductCard";
import { db } from "@/db";
import { products } from "@/db/schema";
import { desc } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";

export default async function Home() {
  let allProducts: {
    id: number;
    name: string;
    description: string;
    price: string;
    posterImageUrl: string;
    category: string;
    createdAt: Date;
  }[] = [];

  try {
    allProducts = await db
      .select()
      .from(products)
      .orderBy(desc(products.createdAt))
      .limit(24);
  } catch (error) {
    Sentry.captureException(error);
  }

  if (allProducts.length === 0) {
    return (
      <main className="container py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Unable to load products</h1>
          <p className="text-muted-foreground">
            Please check your database connection and try again.
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <div className="bg-gradient-to-b from-muted/50 to-background">
        <main className="container py-12">
          <div className="mb-12 text-center">
            <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Featured Products
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Discover our curated collection of premium products designed for
              modern living
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {allProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </main>
      </div>
    </>
  );
}
