# Publish the Stamp Card on Render

This version uses one web server:
- `/` = customer page
- `/staff` = staff page
- `/admin` = admin page

## Before publishing

1. Create a GitHub account at https://github.com if you do not have one.
2. Create a new repository. You can call it `stamp-card`.
3. Upload all files inside this folder to that repository.
4. Create a Render account at https://render.com.
5. In Render, choose **New +** → **Web Service**.
6. Connect your GitHub repository.
7. Render should detect Node. If it asks:
   - Build Command: `npm install`
   - Start Command: `npm start`
8. Add these environment variables:
   - `SECRET` = a long random secret (Render can generate this)
   - `ADMIN_PASSWORD` = a strong admin password you choose
9. Click **Create Web Service**.
10. Wait for the deployment to finish. Render will give you an `https://...onrender.com` address.

## Pages after publishing

- Customer: `https://YOUR-ADDRESS.onrender.com/`
- Staff: `https://YOUR-ADDRESS.onrender.com/staff`
- Admin: `https://YOUR-ADDRESS.onrender.com/admin`

## Important

The JSON file is still a prototype database. For a real shop, move the data to a persistent database before relying on it for important customer records. Render's normal web-service filesystem should not be treated as permanent database storage.

The QR scanner requires HTTPS, which the Render address provides automatically.
