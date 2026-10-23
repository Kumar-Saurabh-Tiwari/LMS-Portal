# Learnspace LMS

MERN learning portal with Redux Toolkit, role-based accounts, course authoring, lesson progress, quizzes, certificates, live classes, Stripe test checkout, and an optional AWS video-delivery path.

## Requirements

- Node.js 20 or newer
- MongoDB
- Redis (required for video transcoding jobs)
- FFmpeg available as `ffmpeg` on `PATH` or configured through `FFMPEG_PATH`

## Local setup

1. Copy `server/.env.example` to `server/.env`, point `MONGODB_URI` at an isolated development database, and set a strong `JWT_SECRET`.
2. Install dependencies:

   ```powershell
   npm --prefix server install
   npm --prefix client install
   ```

   To add the optional synthetic sample catalog, run `npm --prefix server run seed` only after confirming the configured MongoDB database is an isolated development database.

3. Set `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` in `server/.env` (at least 12 characters), then bootstrap an administrator:

   ```powershell
   npm --prefix server run admin:create
   ```

4. Start the API and web app in separate terminals:

   ```powershell
   npm --prefix server run dev
   npm --prefix client run dev
   ```

5. Sign in as the admin, then use `PUT /api/admin/users/:id/roles` with an admin bearer token and body `{"roles":["student","instructor"]}` to grant instructor access. Public registration always creates a student account.

During local development, Vite proxies `/api` and `/media` requests to `http://localhost:5000`, so the frontend works whether opened through `localhost` or `127.0.0.1`. Set `VITE_API_URL` in `client/.env` only when the frontend and API are hosted separately.

No external catalog or video dataset is required. The included seed script creates a small synthetic catalog. To expand sample content, import a properly licensed Coursera/Udemy course catalog dataset or use openly licensed Big Buck Bunny/Sintel footage or Pexels clips; verify the applicable license and attribution terms before redistribution. Large media files should be uploaded through the lesson video workflow, not committed to this repository.

## Integrations

### Video upload and CloudFront

BullMQ uses `REDIS_URL`; video jobs use FFmpeg to generate HLS and update lesson processing status. Local development stores source and HLS files under `server/media` and serves them from `/media`.

For AWS, set `AWS_REGION`, `AWS_S3_BUCKET`, and `CLOUDFRONT_URL`. Configure the bucket and CloudFront distribution with a private S3 origin and Origin Access Control, and configure AWS credentials through the standard AWS SDK credential chain. AWS is optional; without `AWS_S3_BUCKET`, local storage is used. CloudFront is required when S3 storage is enabled.

### Live classes

Set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` from a LiveKit Cloud project. The instructor starts and ends sessions from the live room. LiveKit data messages provide the room chat.

### Test payments

Set `STRIPE_SECRET_KEY` to a Stripe test-mode secret key and `STRIPE_WEBHOOK_SECRET` to the secret for a webhook listening for `checkout.session.completed`. For local webhook forwarding, use the Stripe CLI:

```powershell
stripe listen --forward-to localhost:5000/api/payments/webhook
```

Only a verified Stripe webhook grants paid enrollment. The instructor revenue endpoint reports gross test-mode sales before Stripe fees; this implementation does not create Stripe Connect accounts or transfer payouts to instructors.

## Main API

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/courses`, `POST /api/courses`, `PATCH /api/courses/:id`
- `POST /api/courses/:id/lessons`, `POST /api/lessons/:id/video`
- `POST /api/courses/:id/enroll`, `GET /api/me/enrollments`
- `PUT /api/lessons/:id/quiz`, `GET /api/lessons/:id/quiz`, `POST /api/lessons/:id/quiz/submit`
- `POST /api/lessons/:id/complete`, `GET /api/enrollments/:id/certificate`
- `POST /api/lessons/:id/live-token`, `PATCH /api/lessons/:id/live-status`
- `POST /api/payments/checkout`, `POST /api/payments/webhook`
- `GET /api/instructor/courses`, `GET /api/instructor/revenue`

Protected endpoints use `Authorization: Bearer <token>`. Course publication requires at least one published lesson; video lessons must finish transcoding before publication.

## Validation

```powershell
npm --prefix server test
npm --prefix client run build
```

LiveKit, Stripe, AWS, Redis, MongoDB, and FFmpeg require their respective external configuration/services for end-to-end tests. Never commit `.env` files or put secret values in source control.
