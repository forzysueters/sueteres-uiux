# Deployment & Production Guide

## Pre-Deployment Checklist

### Code Quality
- [ ] All TypeScript errors fixed
- [ ] No console warnings or errors
- [ ] All imports are correct
- [ ] No unused variables
- [ ] Code is properly formatted
- [ ] Comments are clear and helpful
- [ ] No sensitive data in code

### Testing
- [ ] All pages load correctly
- [ ] Navigation works on all paths
- [ ] Real-time data updates work
- [ ] Charts render properly
- [ ] Forms submit correctly
- [ ] Responsive design tested
- [ ] Mobile layout works
- [ ] Dark mode displays correctly

### Performance
- [ ] Build completes without warnings
- [ ] Bundle size is acceptable
- [ ] Images are optimized
- [ ] No memory leaks
- [ ] Animations are smooth

### Documentation
- [ ] README.md is complete
- [ ] API documentation updated
- [ ] Component docs complete
- [ ] Development guide accurate

## Building for Production

### Step 1: Clean Build
```bash
# Remove previous build artifacts
rm -rf dist node_modules
npm install
```

### Step 2: Run Build
```bash
npm run build
```

Expected output:
```
✓ built in 5.23s

dist/
├── assets/
│   ├── index-abc123.js (main bundle)
│   └── index-def456.css (styles)
├── vite.svg
└── index.html
```

### Step 3: Verify Build
```bash
npm run preview
```

Test the production build locally at `http://localhost:4173`

## Deployment Platforms

### 1. Netlify (Recommended - Easiest)

**Via Drag & Drop:**
1. Build the project: `npm run build`
2. Go to [netlify.com](https://netlify.com)
3. Sign in or create account
4. Drag `dist/` folder to deploy area
5. Site is live immediately

**Via Git (Recommended):**
1. Push code to GitHub
2. Connect GitHub repo to Netlify
3. Set build command: `npm run build`
4. Set publish directory: `dist`
5. Click Deploy

**Auto-Deploy on Push:**
Once connected, Netlify automatically deploys on every push to main branch.

### 2. Vercel

**Installation:**
```bash
npm i -g vercel
```

**Deploy:**
```bash
npm run build
vercel deploy dist/ --prod
```

**Via Git:**
1. Push to GitHub
2. Import project on vercel.com
3. Auto-deploys on push

### 3. AWS S3 + CloudFront

**Build:**
```bash
npm run build
```

**Upload to S3:**
```bash
aws s3 sync dist/ s3://your-bucket-name/ --delete
```

**CloudFront Configuration:**
- Origin: S3 bucket
- Default root object: index.html
- Cache settings: 1 year for assets, 1 hour for HTML

**Environment Variables:**
```bash
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_DEFAULT_REGION=us-east-1
```

### 4. Docker Deployment

**Dockerfile:**
```dockerfile
# Build stage
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src ./src
COPY *.config.* ./
COPY index.html ./
RUN npm run build

# Runtime stage
FROM node:18-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
```

**Build & Run:**
```bash
docker build -t idt-app .
docker run -p 3000:3000 idt-app
```

**Docker Compose:**
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=https://api.example.com
```

### 5. Traditional Web Server (Apache/Nginx)

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name example.com;
    root /var/www/dist;
    index index.html;

    # Handle React routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Cache HTML files for 1 hour
    location = /index.html {
        expires 1h;
        add_header Cache-Control "public";
    }
}
```

**Deploy:**
```bash
npm run build
scp -r dist/* user@server:/var/www/dist/
```

### 6. GitHub Pages

**Setup:**
1. Create GitHub account and repository
2. Add to `vite.config.ts`:
```typescript
export default defineConfig({
  base: '/repo-name/', // Your repo name
  // ... rest of config
})
```

3. Add GitHub Actions workflow (`.github/workflows/deploy.yml`):
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

## Environment Configuration

### Development
```bash
npm run dev
# Uses localhost:5173
```

### Production
Configure environment variables for your deployment:

**`.env.production`:**
```env
VITE_API_URL=https://api.example.com
VITE_ENVIRONMENT=production
VITE_LOG_LEVEL=error
```

**Usage in code:**
```typescript
const apiUrl = import.meta.env.VITE_API_URL;
```

## Security Checklist

### Before Deployment
- [ ] Remove all console.log statements
- [ ] Remove debug code
- [ ] Update API endpoints to production
- [ ] Set up HTTPS
- [ ] Configure CORS headers
- [ ] Enable security headers
- [ ] Set Content Security Policy
- [ ] Hide sensitive configuration
- [ ] Update privacy policy
- [ ] Configure analytics

### Security Headers (Nginx)
```nginx
add_header X-Content-Type-Options "nosniff";
add_header X-Frame-Options "SAMEORIGIN";
add_header X-XSS-Protection "1; mode=block";
add_header Referrer-Policy "no-referrer";
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()";
```

### Content Security Policy
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'";
```

## Performance Optimization

### Bundle Analysis
```bash
npm install -D rollup-plugin-visualizer
```

Add to `vite.config.ts`:
```typescript
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    visualizer({ open: true })
  ]
})
```

### Compression
Enable gzip in your server:

**Nginx:**
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript;
gzip_min_length 1000;
```

### Caching Strategy
```
Static Assets (/assets/) → 1 year
HTML Files → 1 hour
API Responses → 5 minutes
```

## Monitoring & Analytics

### Error Tracking (Sentry)

**Installation:**
```bash
npm install @sentry/react @sentry/tracing
```

**Configuration:**
```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://your-sentry-dsn",
  environment: import.meta.env.VITE_ENVIRONMENT,
  tracesSampleRate: 1.0,
});
```

### Analytics (Google Analytics)

**Installation:**
```bash
npm install react-ga4
```

**Configuration:**
```typescript
import ReactGA from "react-ga4";

ReactGA.initialize("GA_MEASUREMENT_ID");
ReactGA.pageview(window.location.pathname);
```

### Monitoring (New Relic)
```bash
npm install @newrelic/browser-agent
```

## Rollback Procedure

### If Something Goes Wrong

**Netlify Rollback:**
1. Go to Netlify dashboard
2. Navigate to Deploys
3. Click previous working version
4. Select "Publish Deploy"

**Vercel Rollback:**
1. Go to Vercel project
2. Find previous successful deployment
3. Click "Promote to Production"

**Manual Rollback:**
```bash
# Restore previous version from git
git revert <bad-commit>
git push main
# Re-deploy
```

## Continuous Integration

### GitHub Actions Setup
Create `.github/workflows/build.yml`:

```yaml
name: Build & Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Upload artifact
        uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/
```

## Scaling Considerations

### For Small Traffic (< 10k/month)
- ✅ Netlify free tier
- ✅ GitHub Pages
- ✅ Vercel free tier

### For Medium Traffic (10k-100k/month)
- ✅ Netlify Pro
- ✅ Vercel Pro
- ✅ Simple AWS S3 + CloudFront
- ✅ Heroku

### For Large Traffic (> 100k/month)
- ✅ AWS S3 + CloudFront + Lambda@Edge
- ✅ GCP Cloud Storage + CDN
- ✅ Kubernetes cluster
- ✅ Multi-region deployment

## Cost Estimation

| Platform | Tier | Monthly Cost |
|----------|------|--------------|
| Netlify | Free | $0 |
| Vercel | Free | $0 |
| GitHub Pages | Free | $0 |
| AWS S3 | ~100K requests | ~$10 |
| Netlify | Pro | $19 |
| Vercel | Pro | $20 |

## Maintenance & Updates

### Regular Tasks
- Weekly: Monitor error logs
- Monthly: Check dependency updates
- Quarterly: Security audit
- Yearly: Performance review

### Updating Dependencies
```bash
# Check for updates
npm outdated

# Update all packages
npm update

# Major version updates
npm install next@latest

# Test after update
npm run build
npm run preview
```

## Disaster Recovery

### Backup Strategy
1. **Code**: Use Git with remote backup (GitHub, GitLab, Bitbucket)
2. **Database**: Implement automated backups
3. **Assets**: Store in S3 with versioning
4. **Configuration**: Document in wiki/docs

### Recovery Procedure
1. Identify issue
2. Check error logs
3. Roll back if needed
4. Apply fix
5. Deploy update
6. Monitor for issues

## Support & Maintenance

### Getting Help
- Check documentation
- Review error logs
- Contact platform support
- Open GitHub issue

### Reporting Issues
Include:
- Error message
- Steps to reproduce
- Browser/device info
- Expected vs actual behavior

## Conclusion

Your Industrial Digital Twin platform is now ready for production deployment! Choose a deployment platform that fits your needs and follow the appropriate guide above.

**Recommended for starters:** Netlify or Vercel (easiest, free tier available)

---

**Happy Deploying! 🚀**
