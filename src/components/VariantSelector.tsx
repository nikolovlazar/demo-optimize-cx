'use client';

import { useState } from 'react';
import { ProductVariant } from '@/db/schema';
import { Button } from '@/components/ui/button';

interface VariantSelectorProps {
  type: string;
  variants: ProductVariant[];
}

export function VariantSelector({ type, variants }: VariantSelectorProps) {
  const [selected, setSelected] = useState<number | null>(null);

  const formatType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div>
      <h3 className="font-semibold mb-2">{formatType(type)}</h3>
      <div className="flex flex-wrap gap-2">
        {variants.map((variant) => (
          <Button
            key={variant.id}
            variant={selected === variant.id ? 'default' : 'outline'}
            onClick={() => setSelected(variant.id)}
            className="min-w-[60px]"
          >
            {variant.variantValue}
            {variant.priceModifier !== '0.00' && (
              <span className="ml-1 text-xs">
                ({parseFloat(variant.priceModifier) > 0 ? '+' : ''}$
                {variant.priceModifier})
              </span>
            )}
          </Button>
        ))}
      </div>
    </div>
  );
}
