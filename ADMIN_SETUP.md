# ParcelPeer Admin System Setup Guide

This guide explains how to set up and use the ParcelPeer admin system.

## Overview

The admin system consists of:
1. **Backend API** - Admin-specific endpoints for managing the platform
2. **Web Dashboard** - Modern React-based admin interface

## Features

### Backend (Admin API)
- Dashboard statistics and analytics
- User management (verify, suspend, promote to admin)
- Parcel management (update status, delete)
- Route management (update, delete)
- Payment tracking
- Review moderation
- Activity logs

### Frontend (Admin Dashboard)
- Beautiful, responsive UI with Tailwind CSS
- Real-time data with React Query
- Firebase authentication
- Dashboard with charts and statistics
- CRUD operations for all entities
- Search, filter, and pagination

## Setup Instructions

### 1. Database Schema Updates

The admin system adds two new fields to the `users` table:
- `role` - enum: 'user' or 'admin' (default: 'user')
- `suspended` - boolean (default: false)

These will be automatically created when you start the server.

### 2. Backend Setup

The admin routes are already integrated into the main server. No additional setup needed.

**Admin API Endpoints:**
- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/users` - List all users
- `PATCH /api/admin/users/:id` - Update user
- `GET /api/admin/parcels` - List all parcels
- `PATCH /api/admin/parcels/:id` - Update parcel
- `DELETE /api/admin/parcels/:id` - Delete parcel
- `GET /api/admin/routes` - List all routes
- `PATCH /api/admin/routes/:id` - Update route
- `DELETE /api/admin/routes/:id` - Delete route
- `GET /api/admin/payments` - List all payments
- `GET /api/admin/reviews` - List all reviews
- `DELETE /api/admin/reviews/:id` - Delete review
- `GET /api/admin/activity` - Recent platform activity

All endpoints require Firebase authentication with admin role.

### 3. Create Your First Admin User

**Option 1: Using the script (Recommended)**
```bash
# First, create a regular user account through the mobile app
# Then promote them to admin:
tsx scripts/create-admin.ts user@example.com
```

**Option 2: Direct database update**
```sql
UPDATE users 
SET role = 'admin' 
WHERE email = 'admin@example.com';
```

### 4. Admin Dashboard Setup

1. Navigate to the admin directory:
   ```bash
   cd /app/admin
   ```

2. Install dependencies (if not already installed):
   ```bash
   yarn install
   ```

3. Create environment file:
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your Firebase configuration:
   ```env
   VITE_API_URL=/api
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

5. Start the admin dashboard:
   ```bash
   yarn dev
   ```

6. Access the dashboard at:
   ```
   http://localhost:3001
   ```

## Usage

### Logging In

1. Open the admin dashboard at `http://localhost:3001`
2. Login with your admin user credentials
3. The system will verify that you have admin role
4. If successful, you'll be redirected to the dashboard

### Managing Users

- **View all users** with search and filter capabilities
- **Verify users** by clicking the checkmark icon
- **Promote to admin** by clicking the shield icon
- **Suspend/Unsuspend** users by clicking the ban icon

### Managing Parcels

- **View all parcels** with status filters
- **Update parcel status** directly from the dropdown
- **Delete parcels** if needed

### Managing Routes

- **View all carrier routes**
- **Update route status**
- **Delete expired or cancelled routes**

### Managing Payments

- **View all payment transactions**
- **Filter by payment status**
- **Track payment references**

### Managing Reviews

- **View all platform reviews**
- **Delete inappropriate reviews**

### Dashboard Analytics

The dashboard shows:
- Total users and recent signups
- Active parcels count
- Active routes count
- Total revenue
- Parcel status breakdown
- Payment status breakdown
- Recent platform activity

## Security Features

1. **Firebase Authentication Required**: All routes require valid Firebase auth token
2. **Admin Role Check**: Backend verifies user has `role = 'admin'`
3. **Suspended Account Check**: Suspended admins cannot access the system
4. **Token Validation**: Tokens are verified on every request
5. **Auto Logout**: Invalid tokens trigger automatic logout

## Production Deployment

### Building the Admin Dashboard

```bash
cd /app/admin
yarn build
```

The built files will be in `/app/admin/dist`

### Serving Admin Dashboard

You can serve the admin dashboard:

1. **As a separate application** (Recommended for security)
   - Deploy to a subdomain: `admin.parcelpeer.com`
   - Configure CORS to allow admin dashboard domain

2. **Alongside the main app**
   - Serve the built files from `/admin` path
   - Add route handling in your main server

### Environment Variables for Production

Update your `.env` file with production values:
- Use production Firebase project
- Use production API URL
- Enable HTTPS

## Troubleshooting

### "Access denied: Admin privileges required"
- Verify the user has `role = 'admin'` in the database
- Check that the user is not suspended
- Clear browser cache and localStorage

### "Unauthorized: Invalid token"
- Re-login to get a fresh token
- Check Firebase configuration
- Verify Firebase project is active

### Cannot see any data
- Verify backend server is running
- Check API proxy configuration in `vite.config.ts`
- Verify database connection

### Admin routes not working
- Ensure `registerAdminRoutes(app)` is called in `server/routes.ts`
- Check that `requireAdmin` middleware is imported correctly
- Verify database schema has `role` and `suspended` fields

## API Authentication

All admin API requests must include the Firebase auth token:

```javascript
fetch('/api/admin/stats', {
  headers: {
    'Authorization': `Bearer ${firebaseToken}`,
    'Content-Type': 'application/json'
  }
})
```

The admin dashboard handles this automatically.

## Best Practices

1. **Limit Admin Access**: Only promote trusted users to admin
2. **Regular Audits**: Review admin actions regularly
3. **Secure Credentials**: Use strong passwords for admin accounts
4. **Monitor Activity**: Check the activity log for unusual patterns
5. **Backup Data**: Always backup before bulk operations
6. **Test Changes**: Test status updates in staging first

## Support

For issues or questions:
1. Check the logs: `/var/log/supervisor/*.log`
2. Review the admin routes code: `/app/server/admin-routes.ts`
3. Check the admin dashboard code: `/app/admin/src`

## Future Enhancements

Potential features to add:
- Email notifications for admin actions
- Bulk operations (suspend multiple users, etc.)
- Export data to CSV
- Advanced analytics and reports
- Role-based permissions (super admin, moderator, etc.)
- Audit logs for all admin actions
- IP whitelisting for admin access
