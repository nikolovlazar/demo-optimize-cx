'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/cart';
import { Product } from '@/db/schema';
import * as Sentry from '@sentry/nextjs';

interface AddToCartButtonProps {
  product: Product;
}

export function AddToCartButton({ product }: AddToCartButtonProps) {
  const [isAdding, setIsAdding] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const router = useRouter();

  const handleAddToCart = () => {
    try {
      setIsAdding(true);
      addItem({
        productId: product.id,
        name: product.name,
        price: product.price,
        posterImageUrl: product.posterImageUrl,
      });

      // Simulate a slight delay for UX
      setTimeout(() => {
        setIsAdding(false);
      }, 300);
    } catch (error) {
      Sentry.captureException(error);
      setIsAdding(false);
    }
  };

  const handleBuyNow = () => {
    handleAddToCart();
    setTimeout(() => {
      router.push('/checkout');
    }, 300);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Button
        onClick={handleAddToCart}
        disabled={isAdding}
        variant="outline"
        size="lg"
        className="flex-1"
      >
        <ShoppingCart className="mr-2 h-4 w-4" />
        {isAdding ? 'Adding...' : 'Add to Cart'}
      </Button>
      <Button onClick={handleBuyNow} size="lg" className="flex-1">
        Buy Now
      </Button>
    </div>
  );
}
