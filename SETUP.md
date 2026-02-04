# Setup Instructions for SaaS Expense Tracker

## Prerequisites

- Node.js 18+ installed
- A Neon database

## Quick Start

Create a `.env` file in your project root:

```env
DATABASE_URL="your_neon_database_url_here"
JWT_SECRET="your_generated_jwt_secret_here"

# Public app URL (used to generate invitation acceptance links)
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# SMTP (used to send invitation emails)
EMAIL_HOST="smtp.your-provider.com"
EMAIL_PORT="587"
EMAIL_SECURE="false"
EMAIL_USER="your_smtp_username"
EMAIL_PASS="your_smtp_password"
# Optional (defaults to EMAIL_USER)
EMAIL_FROM="no-reply@plexsol.com"

# (Optional) Receipt OCR (OCR.space + OpenAI)
# Backend-only: never expose these keys to the client.
OCR_SPACE_API_KEY="your_ocr_space_api_key_here"
OPENAI_API_KEY="your_openai_api_key_here"
# Optional override (defaults to gpt-4o-mini)
OPENAI_MODEL="gpt-4o-mini"
```

You can copy env vars from your Vercel project settings → Environment Variables.

## Receipt OCR Setup

The app includes a Receipt OCR feature (Scan Receipt in the receipt form) backed by OCR.space, with receipt field extraction via OpenAI.

### 1. Get an OCR.space API key

- Create an account on OCR.space and copy your API key.

### 2. Configure the dev server

Set `OCR_SPACE_API_KEY` and `OPENAI_API_KEY` in `.env`.

```env
OCR_SPACE_API_KEY="your_ocr_space_api_key_here"
OPENAI_API_KEY="your_openai_api_key_here"
OPENAI_MODEL="gpt-4o-mini"
```

Notes:

- The key is used server-side only by `/api/ocr/receipt`.
- Do not expose this key in client-side code.
  Generate Prisma Client and push schema to database:

````bash
npx prisma generate
	- `OCR_SPACE_API_KEY` is set in `.env`
	- The key is valid and has remaining quota

```bash
npm run dev
````

Open [http://localhost:3000](http://localhost:3000)

## First Time Setup Flow

1. **Create Super Admin**: Visit `/signup` and create your first Super Admin account (only Super Admins can sign up directly)

2. **Create Organizations**: Login as Super Admin and go to `/super-admin` to create organizations

3. **Invite Org Admins**: Send invitations to Org Admins for each organization

4. **Org Admins Setup**: Org Admins accept invitations at `/accept-invite` and login

5. **Invite Staff**: Org Admins login to `/admin` and invite staff members

6. **Staff Access**: Staff accept invitations and access their dashboard at `/dashboard`

## User Roles & Access

| Role            | Sign Up         | Access         | Can Invite      |
| --------------- | --------------- | -------------- | --------------- |
| **SUPER_ADMIN** | Direct signup   | `/super-admin` | Org Admins only |
| **ORG_ADMIN**   | Invitation only | `/admin`       | Staff only      |
| **STAFF**       | Invitation only | `/dashboard`   | None            |

## Available Scripts

```bash
# Development
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Database commands
npx prisma studio        # Visual database browser
npx prisma db push       # Push schema changes
npx prisma generate      # Regenerate Prisma Client
npx prisma migrate dev   # Create migrations (optional)
```

## Troubleshooting

### "Environment variable not found: DATABASE_URL"

- Ensure `.env` file exists in project root
- Check DATABASE_URL is spelled correctly
- Restart dev server after creating `.env`

### "Prisma schema validation error"

```bash
# Clear cache and regenerate
rm -rf node_modules/.prisma
npx prisma generate
```

### "JWT token invalid"

- Ensure JWT_SECRET is set in `.env`
- JWT_SECRET must be at least 32 characters
- Generate a new one using the command above

### Database Connection Issues

- Verify DATABASE_URL is correct
- Check Neon database is active
- Ensure IP allowlist includes your IP (if configured)

#### Network / Wi‑Fi restrictions

If the app works on one Wi‑Fi network but fails on another, the failing network is likely blocking outbound database traffic.

- **TCP Postgres (recommended, default)**: requires outbound access to Neon on **port 5432**.
- **Neon WebSocket adapter (optional)**: requires outbound **WebSocket upgrade** access (typically over **443**). Some corporate proxies block WebSockets and you may see errors like "non-101 status code".

You can control which driver adapter Prisma uses with:

```env
# auto | pg | neon
PRISMA_ADAPTER="pg"
```

If both TCP/5432 and WebSockets are blocked on a network, you’ll need to use a different network (hotspot), a VPN, or run a local Postgres.

## Project Structure

```
├── app/
│   ├── (auth)/              # Auth pages (signin, signup, accept-invite)
│   ├── super-admin/         # Super Admin dashboard
│   ├── admin/               # Org Admin dashboard
│   ├── dashboard/           # Staff dashboard
│   └── api/                 # API routes
├── components/              # React components
├── lib/                     # Utilities (auth, prisma, etc.)
├── prisma/                  # Database schema
└── scripts/                 # SQL scripts (optional)
```

## Need Help?

- Check the [Prisma Docs](https://www.prisma.io/docs)
- Review [Next.js Documentation](https://nextjs.org/docs)
- Open a support ticket at [vercel.com/help](https://vercel.com/help)
