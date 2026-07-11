# ODS to Next.js migration

The legacy Flask application remains in `../ods`. This application connects to the existing PostgreSQL database without modifying its schema.

## Run

1. Copy `.env.example` to `.env.local` and enter the ODS database connection string.
2. Set a strong unique `AUTH_SECRET`.
3. Run `npm run dev`.

## Progress

- [x] Next.js App Router and TypeScript foundation
- [x] PostgreSQL connection pool
- [x] Login compatible with the legacy plaintext and Werkzeug PBKDF2 password formats
- [x] HTTP-only signed session cookie
- [x] Responsive application shell and navigation
- [x] Dashboard connected to repair and installation tables
- [ ] Service intake and repair workflow
- [ ] Installation workflow
- [ ] Stock and spare-parts workflow
- [ ] Purchase requests and approvals
- [ ] Customers, products, users, and master data
- [ ] Reports and print layouts
