import { notFound } from "next/navigation";
import { db } from "@/db";
import { products, productImages, productVariants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ProductGallery } from "@/components/ProductGallery";
import { VariantSelector } from "@/components/VariantSelector";
import * as Sentry from "@sentry/nextjs";

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  type ProductRecord = typeof products.$inferSelect;
  type ProductImageRecord = typeof productImages.$inferSelect;
  type ProductVariantRecord = typeof productVariants.$inferSelect;

  let product: ProductRecord | undefined;
  let images: ProductImageRecord[] = [];
  let variants: ProductVariantRecord[] = [];
  let groupedVariants: Record<string, ProductVariantRecord[]> = {};

  try {
    const resolvedParams = await params;
    const productId = Number.parseInt(resolvedParams.id, 10);

    if (Number.isNaN(productId)) {
      notFound();
    }

    const [fetchedProduct] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId));

    if (!fetchedProduct) {
      notFound();
    }

    product = fetchedProduct;

    images = await db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(productImages.displayOrder);

    variants = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, productId));

    groupedVariants = variants.reduce<Record<string, ProductVariantRecord[]>>(
      (acc, variant) => {
        if (!acc[variant.variantType]) {
          acc[variant.variantType] = [];
        }
        acc[variant.variantType].push(variant);
        return acc;
      },
      {},
    );
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }

  if (!product) {
    notFound();
  }

  return (
    <main className="container py-8">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Image Gallery */}
        <ProductGallery images={images} productName={product.name} />

        {/* Product Info */}
        <div className="flex flex-col gap-6">
          <div>
            <div className="text-sm text-muted-foreground mb-2">
              {product.category}
            </div>
            <h1 className="text-4xl font-bold mb-4">{product.name}</h1>
            <p className="text-3xl font-bold mb-4">${product.price}</p>
            <p className="text-muted-foreground leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Variant Selectors */}
          {Object.keys(groupedVariants).length > 0 && (
            <div className="space-y-4">
              {Object.entries(groupedVariants).map(([type, vars]) => (
                <VariantSelector key={type} type={type} variants={vars} />
              ))}
            </div>
          )}

          {/* Add to Cart */}
          <AddToCartButton product={product} />
        </div>
      </div>
    </main>
  );
}
