# Setup Guide - MLPHoma

## Prerequisites

- Node.js 16.x or higher
- npm or yarn
- A Supabase account (free tier available at [supabase.com](https://supabase.com))

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Get your Supabase credentials:
   - Go to [Supabase Dashboard](https://app.supabase.com)
   - Select your project (or create a new one)
   - Navigate to **Settings** → **API**
   - Copy the following values:
     - **Project URL** → Use as `VITE_SUPABASE_URL`
     - **anon/public key** → Use as `VITE_SUPABASE_ANON_KEY`

3. Edit `.env.local` and paste your credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-actual-anon-key-here
   ```

   ⚠️ **Important Security Notes:**
   - Never commit `.env.local` to version control (it's already in `.gitignore`)
   - Only use the **anon/public key** in the frontend (not the service role key)
   - The anon key is safe for client-side use as it respects Row Level Security (RLS) policies

### 3. Set Up Database

1. Apply the database schema:
   - In your Supabase project dashboard, go to **SQL Editor**
   - Copy the content from `supabase_schema.sql`
   - Run the SQL script

2. Apply migrations in order:
   ```sql
   -- Run these in the SQL Editor, one at a time:
   -- 1. supabase/migrations/001_fix_foreign_keys.sql
   -- 2. supabase/migrations/002_add_indexes.sql
   -- 3. supabase/migrations/003_add_updated_at_triggers.sql
   -- 4. supabase/migrations/004_add_auth_support.sql
   ```

### 4. (Optional) Seed Sample Data

Seed AHSP data:
```bash
node scripts/seed_ahsp_supabase.mjs
```

Seed DKH data:
```bash
node scripts/seed_dkh.mjs
```

Clear and reseed AHSP:
```bash
node scripts/clear_and_seed_ahsp.mjs
```

### 5. Run Development Server

```bash
npm run dev
```

The application will be available at the URL shown in the terminal (typically `http://localhost:5173` or similar).

### 6. Build for Production

```bash
npm run build
```

The production-ready files will be in the `dist/` directory.

## Authentication Setup

The application includes a complete authentication system:

- **Login**: `/login` - Email and password authentication
- **Register**: `/register` - New user registration
- **Forgot Password**: `/forgot-password` - Password reset request
- **Reset Password**: `/reset-password` - Password reset completion (accessed via email link)

### First User Setup

1. Navigate to `/register` in your browser
2. Create your first user account
3. Check your email for verification (if email is configured in Supabase)
4. The system will automatically create a profile for you

## Row Level Security (RLS)

The database uses RLS to ensure multi-tenant data isolation:

- Users can only access their own projects and related data
- Reference data (resources, AHSP items, components) is publicly readable
- All operations are protected by RLS policies

## Troubleshooting

### "Supabase not initialized" Error

If you see this error, it means the environment variables are not set correctly:

1. Verify `.env.local` exists and has the correct values
2. Restart your development server after changing `.env.local`
3. Check that variable names match exactly: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

### Authentication Not Working

1. Verify Supabase Auth is enabled in your project settings
2. Check that email templates are configured in Supabase Dashboard → Authentication → Email Templates
3. Ensure RLS policies are applied (run migration 004)

### No Data Showing

1. Check that migrations are applied in the correct order
2. Verify your user account has `user_id` associated with projects
3. Check browser console for any error messages

## Development Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Generate test coverage report

## Project Structure

```
MLPHoma/
├── src/
│   ├── components/     # React components
│   │   ├── auth/      # Authentication components
│   │   ├── common/    # Shared components
│   │   └── ...
│   ├── pages/         # Page components
│   │   ├── auth/      # Auth pages (Login, Register, etc.)
│   │   └── modules/   # Main app pages
│   ├── store/         # Zustand state management
│   ├── lib/           # Utilities and services
│   └── hooks/         # Custom React hooks
├── supabase/
│   └── migrations/    # Database migration files
├── scripts/           # Build and seed scripts
└── dist/             # Production build output
```

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Deployment Guide](./DeploymentGuide.txt)
- [Architecture Overview](./ARCHITECTURE.md)
- [Migration Guide](./MIGRATION_GUIDE.md)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the documentation files in this repository
3. Check the GitHub issues for similar problems
