# Bank Promos AR

Mobile-first web app to centralize bank discounts and promotions in Argentina.

## Requirements

- Node.js + npm installed (npm is required to install dependencies)

## Setup

```bash
cd bank-promos-ar
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Tech stack

- Next.js (App Router)
- Tailwind CSS
- Lucide React (icons)
- Supabase (auth + DB) – placeholders included

## Data model

See `src/lib/schemas/promotion.ts` and `src/lib/mock/promotions.ts`.

## Backend placeholder

- `GET /api/promotions` returns mock promotions and matches the schema.
- Intended future: scrapers ingest promotions into Supabase; API serves DB data.

