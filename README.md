# OptimizeCX Store - Performance Demo

An ecommerce demo application instrumented with Sentry for performance monitoring.

## 🎯 Project Goals

This demo is designed to showcase a full-stack ecommerce experience built with Next.js, from product browsing to checkout.

## 🏗️ Tech Stack

- **Frontend**: Next.js 14+ (App Router), React, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui
- **State Management**: Zustand (cart management)
- **Database**: PostgreSQL (Neon DB)
- **ORM**: Drizzle ORM
- **Images**: Unsplash API
- **Monitoring**: Sentry

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Neon DB account (or any PostgreSQL database)
- Unsplash API access key
- Sentry account and DSN

### 1. Environment Setup

Create a `.env.local` file in the root directory with the following variables:

```bash
# Database (Neon DB connection string)
DATABASE_URL=your_neon_database_url_here

# Sentry
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn_here
SENTRY_ORG=your_sentry_org
SENTRY_PROJECT=your_sentry_project

# Unsplash API
UNSPLASH_ACCESS_KEY=your_unsplash_access_key_here
```

#### Getting the Required Keys:

**Neon DB:**
1. Go to [Neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string from the dashboard

**Unsplash API:**
1. Go to [Unsplash Developers](https://unsplash.com/developers)
2. Create a new application
3. Copy the Access Key

**Sentry:**
1. Go to [Sentry.io](https://sentry.io)
2. Create a new Next.js project
3. Copy the DSN and project details

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Database

Push the database schema to your Neon DB:

```bash
npm run db:push
```

### 4. Seed the Database

Populate the database with 100-150 random products from Unsplash:

```bash
npm run db:seed
```

This will:
- Generate 100-150 products with realistic data
- Fetch high-quality images from Unsplash (1 poster + 3-5 gallery images per product)
- Create 2-4 variants per product (colors, sizes, materials, etc.)

**Note**: Seeding may take 5-10 minutes due to Unsplash API rate limits.

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🎨 Key Features

- **Homepage**: Product grid with 24 products
- **Product Details**: Image gallery, variant selector, add to cart
- **Shopping Cart**: Quantity management, item removal, subtotal
- **Checkout**: Full checkout form with order summary
- **Responsive Design**: Mobile-first, works on all screen sizes
- **Real Images**: High-quality Unsplash images for realistic performance testing

## 📁 Project Structure

```
├── src/
│   ├── app/
│   │   ├── api/products/          # API routes
│   │   ├── cart/                   # Cart page
│   │   ├── checkout/               # Checkout flow
│   │   ├── products/[id]/          # Product details
│   │   └── page.tsx                # Homepage
│   ├── components/
│   │   ├── ui/                     # shadcn/ui components
│   │   ├── Header.tsx              # Navigation header
│   │   ├── ProductCard.tsx         # Product card component
│   │   └── ...                     # Other components
│   ├── db/
│   │   ├── schema.ts               # Drizzle schema
│   │   ├── index.ts                # Database connection
│   │   └── seed.ts                 # Seeding script
│   └── store/
│       └── cart.ts                 # Zustand cart store
├── drizzle.config.ts               # Drizzle configuration
├── next.config.ts                  # Next.js + Sentry config
└── instrumentation.ts              # Sentry instrumentation
```

## 🐛 Troubleshooting

### Database Connection Issues

If you see "Unable to load products":
1. Verify your `DATABASE_URL` in `.env.local`
2. Ensure your Neon DB is active
3. Run `npm run db:push` again

### Seed Script Failures

If seeding fails:
1. Check your `UNSPLASH_ACCESS_KEY`
2. Ensure you haven't hit Unsplash rate limits (50 requests/hour on free tier)
3. Try running the seed script again later

### Images Not Loading

If images don't load:
1. Check if Unsplash images are accessible
2. Verify Next.js image configuration in `next.config.ts`
3. Check browser console for CORS errors

## 📝 Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Drizzle migrations
- `npm run db:push` - Push schema to database
- `npm run db:studio` - Open Drizzle Studio
- `npm run db:seed` - Seed database with products

## 📄 License

MIT
