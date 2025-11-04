import * as dotenv from "dotenv";

// Load environment variables FIRST before any other imports
dotenv.config({ path: ".env.local" });

import { faker } from "@faker-js/faker";
import { db } from ".";
import { products, productImages, productVariants } from "./schema";

// Product categories with associated search terms
const categories = [
  {
    name: "Electronics",
    terms: ["laptop", "phone", "tablet", "camera", "headphones"],
  },
  {
    name: "Fashion",
    terms: ["shoes", "clothing", "watch", "sunglasses", "bag"],
  },
  {
    name: "Home & Garden",
    terms: ["furniture", "plants", "lamp", "decor", "kitchenware"],
  },
  {
    name: "Sports",
    terms: ["running", "yoga", "cycling", "fitness", "sports"],
  },
  {
    name: "Beauty",
    terms: ["perfume", "cosmetics", "skincare", "makeup", "beauty"],
  },
];

// Variant types
const variantTypes = [
  {
    type: "color",
    values: ["Black", "White", "Red", "Blue", "Green", "Gray", "Navy", "Pink"],
  },
  { type: "size", values: ["XS", "S", "M", "L", "XL", "XXL"] },
  {
    type: "material",
    values: ["Cotton", "Leather", "Polyester", "Wool", "Silk"],
  },
  { type: "storage", values: ["64GB", "128GB", "256GB", "512GB", "1TB"] },
];

async function getPlaceholderImages(
  query: string,
  count: number,
): Promise<string[]> {
  // Use high-quality placeholder images from Picsum (Lorem Picsum)
  // Random seed ensures different images for each product
  const seed = Math.floor(Math.random() * 1000);
  return Array.from(
    { length: count },
    (_, i) => `https://picsum.photos/seed/${seed + i}/1080/1080`,
  );
}

async function seedDatabase() {
  console.log("🌱 Starting database seeding...");

  const totalProducts = faker.number.int({ min: 100, max: 150 });
  console.log(`📦 Generating ${totalProducts} products...`);

  for (let i = 0; i < totalProducts; i++) {
    try {
      // Select random category
      const category = faker.helpers.arrayElement(categories);
      const searchTerm = faker.helpers.arrayElement(category.terms);

      // Generate product details
      const productName = faker.commerce.productName();
      const price = faker.commerce.price({ min: 9.99, max: 999.99, dec: 2 });
      const description = faker.commerce.productDescription();

      // Get placeholder images (1 poster + 3-5 gallery images)
      const galleryCount = faker.number.int({ min: 3, max: 5 });
      const allImages = await getPlaceholderImages(searchTerm, 1 + galleryCount);
      const posterImage = allImages[0];
      const galleryImages = allImages.slice(1);

      // Insert product
      const [product] = await db
        .insert(products)
        .values({
          name: productName,
          description,
          price,
          posterImageUrl: posterImage,
          category: category.name,
        })
        .returning();

      console.log(
        `✓ Created product ${i + 1}/${totalProducts}: ${product.name}`,
      );

      // Insert gallery images
      for (let j = 0; j < galleryImages.length; j++) {
        await db.insert(productImages).values({
          productId: product.id,
          imageUrl: galleryImages[j],
          displayOrder: j,
        });
      }

      // Generate 2-4 random variants
      const variantCount = faker.number.int({ min: 2, max: 4 });
      const selectedVariantTypes = faker.helpers.arrayElements(
        variantTypes,
        variantCount,
      );

      for (const variantType of selectedVariantTypes) {
        const variantValuesCount = faker.number.int({ min: 2, max: 4 });
        const selectedValues = faker.helpers.arrayElements(
          variantType.values,
          variantValuesCount,
        );

        for (const value of selectedValues) {
          const priceModifier = faker.number.int({ min: -20, max: 50 });
          const stockQuantity = faker.number.int({ min: 0, max: 100 });

          await db.insert(productVariants).values({
            productId: product.id,
            variantType: variantType.type,
            variantValue: value,
            priceModifier: priceModifier.toString(),
            stockQuantity,
          });
        }
      }

      // No delay needed with placeholder images
    } catch (error) {
      console.error(`Error creating product ${i + 1}:`, error);
    }
  }

  console.log("✅ Database seeding completed!");
}

seedDatabase()
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
