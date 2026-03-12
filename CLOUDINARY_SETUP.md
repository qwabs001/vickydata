# Cloudinary Setup Guide

Cloudinary is used for uploading logos and network images. It's **optional** - you can use logo URLs instead (paste a direct image link in Theme Customization).

## Quick Setup

### Option 1: Add to Vercel (Recommended)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your **BundleArena** project
3. Go to **Settings** → **Environment Variables**
4. Add these three variables:

   **Variable Name:** `CLOUDINARY_CLOUD_NAME`  
   **Value:** `Root`  
   **Environments:** ✅ Production, ✅ Preview, ✅ Development

   **Variable Name:** `CLOUDINARY_API_KEY`  
   **Value:** `749215317453844`  
   **Environments:** ✅ Production, ✅ Preview, ✅ Development

   **Variable Name:** `CLOUDINARY_API_SECRET`  
   **Value:** `gg-XHTbwyIBZRnAJSXgcAR60-KI`  
   **Environments:** ✅ Production, ✅ Preview, ✅ Development

5. Click **Save** for each variable
6. **Redeploy** your project:
   - Go to **Deployments** tab
   - Click **⋯** (three dots) on latest deployment
   - Click **Redeploy**

### Option 2: Use CLOUDINARY_URL (Alternative)

Instead of three separate variables, you can use a single `CLOUDINARY_URL`:

**Format:** `cloudinary://api_key:api_secret@cloud_name`

**Example:**
```
CLOUDINARY_URL=cloudinary://749215317453844:gg-XHTbwyIBZRnAJSXgcAR60-KI@Root
```

**Note:** Replace `Root` with your actual Cloudinary cloud name if different.

## Verify Setup

After redeploying:

1. Go to **Admin** → **Settings** → **Theme Customization**
2. Try uploading a logo file
3. If Cloudinary is configured correctly, the upload should succeed
4. If you see an error, check:
   - All three variables are set in Vercel
   - Variables are enabled for the correct environments
   - You've redeployed after adding the variables

## Alternative: Use Logo URL (No Cloudinary Needed)

If you don't want to set up Cloudinary:

1. Upload your logo to any image host (your website, Imgur, etc.)
2. Get the direct image URL (e.g. `https://example.com/logo.png`)
3. In **Theme Customization**, use the **"Or use a logo URL"** field
4. Paste the URL and click **"Save logo URL"**

This works without Cloudinary and is often simpler!

## Troubleshooting

**"Cloudinary upload failed"**
- Check that all three variables are set correctly in Vercel
- Verify the cloud name is correct (usually lowercase, not "Root" - check your Cloudinary dashboard)
- Make sure you've redeployed after adding variables

**"Invalid CLOUDINARY_URL"**
- If using `CLOUDINARY_URL`, ensure the format is: `cloudinary://api_key:api_secret@cloud_name`
- Don't include `https://` or other prefixes

**Logo upload still doesn't work**
- Use the **Logo URL** option instead (no Cloudinary needed)
- Or check Cloudinary dashboard to verify your credentials
