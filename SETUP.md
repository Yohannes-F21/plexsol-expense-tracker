# Setup Instructions for SaaS Expense Tracker

## Prerequisites
- Node.js 18+ installed
- A Neon database (already connected via v0)

## Quick Start

### 1. Create Environment Variables

Create a `.env` file in your project root:

```env
DATABASE_URL="your_neon_database_url_here"
JWT_SECRET="your_generated_jwt_secret_here"
```

**Where to get DATABASE_URL:**
- In v0: Check the "Vars" section in the left sidebar
- Or copy from your Vercel project settings → Environment Variables
- Or from Neon dashboard → Connection String

**Generate JWT_SECRET:**
Run this command in your terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Database

Generate Prisma Client and push schema to database:

```bash
npx prisma generate
npx prisma db push
```

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## First Time Setup Flow

1. **Create Super Admin**: Visit `/signup` and create your first Super Admin account (only Super Admins can sign up directly)

2. **Create Organizations**: Login as Super Admin and go to `/super-admin` to create organizations

3. **Invite Org Admins**: Send invitations to Org Admins for each organization

4. **Org Admins Setup**: Org Admins accept invitations at `/accept-invite` and login

5. **Invite Staff**: Org Admins login to `/admin` and invite staff members

6. **Staff Access**: Staff accept invitations and access their dashboard at `/dashboard`

## User Roles & Access

| Role | Sign Up | Access | Can Invite |
|------|---------|--------|------------|
| **SUPER_ADMIN** | Direct signup | `/super-admin` | Org Admins only |
| **ORG_ADMIN** | Invitation only | `/admin` | Staff only |
| **STAFF** | Invitation only | `/dashboard` | None |

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
