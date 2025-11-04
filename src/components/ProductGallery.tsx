'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductImage } from '@/db/schema';

interface ProductGalleryProps {
  images: ProductImage[];
  productName: string;
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const hasImages = images.length > 0;
  const totalImages = images.length;

  const goToIndex = (index: number) => {
    if (!totalImages) return;
    const normalizedIndex = (index + totalImages) % totalImages;
    setActiveIndex(normalizedIndex);
  };

  const goToNext = () => goToIndex(activeIndex + 1);
  const goToPrevious = () => goToIndex(activeIndex - 1);

  if (!hasImages) {
    return (
      <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground">No images available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Main Image */}
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-gray-100">
        <div
          className="flex h-full w-full transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {images.map((image, index) => (
            <div
              key={image.id}
              className="relative h-full w-full shrink-0 grow-0 basis-full"
            >
              <Image
                src={image.imageUrl}
                alt={`${productName} - Image ${index + 1}`}
                fill
                className="object-cover"
                priority={index === 0}
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          ))}
        </div>

        {totalImages > 1 && (
          <>
            <button
              type="button"
              onClick={goToPrevious}
              aria-label="View previous product image"
              className="group absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 shadow-md transition hover:bg-background"
            >
              <ChevronLeft className="h-5 w-5 text-foreground transition group-hover:scale-110" />
            </button>
            <button
              type="button"
              onClick={goToNext}
              aria-label="View next product image"
              className="group absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 shadow-md transition hover:bg-background"
            >
              <ChevronRight className="h-5 w-5 text-foreground transition group-hover:scale-110" />
            </button>
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-background/80 px-2 py-1 text-xs text-foreground shadow">
              <span>{activeIndex + 1}</span>
              <span className="text-muted-foreground">/</span>
              <span>{totalImages}</span>
            </div>
          </>
        )}
      </div>

      {/* Thumbnail Gallery */}
      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((image, index) => (
            <button
              key={image.id}
              onClick={() => goToIndex(index)}
              className={`relative aspect-square overflow-hidden rounded-md border-2 transition-all ${
                activeIndex === index
                  ? 'border-primary'
                  : 'border-transparent hover:border-gray-300'
              }`}
            >
              <Image
                src={image.imageUrl}
                alt={`${productName} thumbnail ${index + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 25vw, 12.5vw"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
