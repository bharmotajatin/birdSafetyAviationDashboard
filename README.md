# BFS Safety Incident Tracker

Production-ready safety incident tracking platform for Bird Flight Services.

## Features

- Role-based access: `admin`, `safety_head`, `investigator`, `duty_manager`, `viewer`
- Incident lifecycle management with audit timeline
- SLA tracking (approaching + breach warnings)
- Notification center + email notifications
- Admin console (users, stations, settings, activity log)
- Reports and exports (incident, monthly, audit, executive summary)

## Tech Stack

- Next.js App Router
- MongoDB + Mongoose
- NextAuth (credentials)
- Nodemailer (SMTP)
- Sentry (`@sentry/nextjs`)

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

- `MONGODB_URI`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `JWT_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`
- `ANTHROPIC_API_KEY`
- `GROQ_API_KEY`
- `CRON_SECRET`
- `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` (optional)
- `SENTRY_ORG` / `SENTRY_PROJECT` (optional for source maps)

## Setup

```bash
npm install
npm run dev
```

## Database Initialization

Seed base master data + users:

```bash
npm run seed
```

Legacy Excel import (one-time):

```bash
npm run import-excel -- "path/to/DEL_INCIDENT_FIXED.xlsx"
```

## Build & Quality

```bash
npx tsc --noEmit
npm test
npm run build
```

## Deployment

- Primary target: Vercel (set all environment variables in project settings)
- MongoDB Atlas in production with backups enabled and IP/network access configured
- Schedule cron for SLA checker:
  - `GET /api/cron/sla-check`
  - Header: `x-cron-secret: <CRON_SECRET>`

## User Roles

- **Admin**: full control, users/stations/settings/activity log
- **Safety Head**: station-wide oversight, reviews, pattern/risk supervision
- **Investigator**: assigned incidents and investigation updates
- **Duty Manager**: incident reporting and personal report follow-up
- **Viewer**: read-only monitoring

## Incident Lifecycle

1. Incident created (`Open`)
2. Investigator assigned (`In Progress`)
3. Review workflow (`Pending`/`Rejected`)
4. Closure (`Closed`)
5. SLA warning at 80%, breach alerts beyond deadline

## Health Endpoint

- `GET /api/health`
- Returns DB status, uptime, version

## Notes

- Atlas cluster provisioning and Vercel project deployment require operator credentials and are done outside the repository.
- User onboarding tour is available via `react-joyride` on dashboard.
