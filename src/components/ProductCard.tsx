'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Product } from '@/db/schema';
import { usePrefetchPreference } from '@/components/SpeculationProvider';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const shouldPrefetch = usePrefetchPreference();

  return (
    <Link
      href={`/products/${product.id}`}
      prefetch={shouldPrefetch}
      className="group"
    >
      <Card className="overflow-hidden transition-all hover:shadow-lg cursor-pointer border-border/50 hover:border-border">
        <CardContent className="p-0">
          <div className="relative aspect-square w-full overflow-hidden bg-muted">
            <Image
              src={product.posterImageUrl}
              alt={product.name}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-1.5 p-4">
          <h3 className="font-semibold text-base line-clamp-1 group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            {product.category}
          </p>
          <p className="font-bold text-xl mt-1">${product.price}</p>
        </CardFooter>
      </Card>
    </Link>
  );
}
