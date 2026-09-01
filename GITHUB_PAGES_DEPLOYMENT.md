# Deploy LifeLog to GitHub Pages

Your app is now configured for GitHub Pages deployment! Here's how to set it up:

## Step 1: Push to GitHub

```bash
git add .
git commit -m "Add GitHub Pages deployment support"
git push origin main
```

## Step 2: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages** (in the left sidebar)
3. Under **Source**, select **GitHub Actions** (not "Deploy from a branch")
4. That's it! The workflow will automatically deploy when you push to `main`

## Step 3: Verify Deployment

After pushing, go to the **Actions** tab in your GitHub repository:
- You should see a workflow named "Deploy to GitHub Pages" running
- Once it completes successfully, your app will be live at:
  - `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

## Important Notes

### P2P Sync & HTTPS
The QR code P2P sync feature uses WebRTC which requires **HTTPS** in production. GitHub Pages provides HTTPS automatically, so your sync feature will work perfectly.

### Local Storage
This is a local-first app using browser localStorage. Data stays on each device and syncs peer-to-peer via QR codes. No data ever leaves your devices.

### Custom Domain (Optional)
If you want a custom domain:
1. Add a `CNAME` file in the root with your domain name
2. Configure DNS records with your domain provider
3. GitHub Pages will automatically use HTTPS via Let's Encrypt

## Troubleshooting

If the deployment fails:
1. Check the **Actions** tab for error details
2. Ensure `npm run build` works locally
3. Verify all files are committed and pushed

## Accessing Your Live App

Once deployed, share the URL with anyone. They can:
- Use the app immediately (no install needed)
- Host sync sessions to share data with other devices
- All data remains encrypted and local to their device
