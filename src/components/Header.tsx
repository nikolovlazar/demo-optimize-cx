'use client';

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/cart';
import { useSpeculationSettings } from '@/components/SpeculationProvider';

export function Header() {
  const totalItems = useCartStore((state) => state.getTotalItems());
  const { optimizationMode, hasHydrated } = useSpeculationSettings();

  const formattedMode = hasHydrated
    ? optimizationMode.charAt(0).toUpperCase() + optimizationMode.slice(1)
    : '...';
  const optimizationLabel = `Optimization: ${formattedMode}`;
  const linkPrefetch = hasHydrated && optimizationMode !== 'none';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <Link
          href="/"
          prefetch={linkPrefetch}
          className="font-bold text-xl hover:text-primary transition-colors"
        >
          OptimizeCX Store
        </Link>
        <nav className="ml-auto flex items-center gap-4">
          <Badge
            variant={
              hasHydrated && optimizationMode !== 'none' ? 'default' : 'secondary'
            }
            className="whitespace-nowrap"
          >
            {optimizationLabel}
          </Badge>
          <Link href="/cart" prefetch={linkPrefetch}>
            <Button variant="ghost" size="icon" className="relative hover:bg-accent">
              <ShoppingCart className="h-5 w-5" />
              {totalItems > 0 && (
                <Badge
                  variant="default"
                  className="absolute -right-2 -top-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-primary text-primary-foreground"
                >
                  {totalItems}
                </Badge>
              )}
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
