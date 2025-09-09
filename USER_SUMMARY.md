# NFL Picks Application - User Summary

## Users Added Successfully ✅

### Admin User:
- **Tracy Gildner** (tlgildner8@yahoo.com) - **ADMIN**
  - Password: `admin123`
  - Role: Administrator with full access

### Regular Users:
New users with password: `Welcome123!`

1. **Katie Mercadante** (K8tiec18@aol.com)
2. **Heather Hamilton** (Hbrown8@yahoo.com) 
3. **Renee Jones** (Renjones714@gmail.com)
4. **Kristin Stinker** (kskinker24@gmail.com)
5. **Liz Richburg** (Free67bird@gmail.com)
6. **Amanda Tavarez** (Atavarez88@gmail.com)
7. **Chanda Carl** (chandalscheetz@gmail.com)

### Existing Sample Users:
Default password: `password123`

8. **John Doe** (john.doe@example.com)
9. **Jane Smith** (jane.smith@example.com)
10. **Mike Wilson** (mike.wilson@example.com)
11. **Sarah Johnson** (sarah.johnson@example.com)

## Login Information

### For the Admin (Tracy):
- **URL**: https://footballpool.golfleaguemanager.app
- **Email**: tlgildner8@yahoo.com
- **Password**: admin123

### For New Users:
- **URL**: https://footballpool.golfleaguemanager.app
- **Email**: (their respective email addresses)
- **Password**: Welcome123!

### For Sample Users:
- **URL**: https://footballpool.golfleaguemanager.app
- **Email**: (their respective email addresses) 
- **Password**: password123

## Total Users: 13
- **Admin Users**: 2 (Tracy Gildner + Default Admin)
- **Regular Users**: 11 (7 new + 4 sample)

## Database Status:
- ✅ **Fixed**: Database now persists between container restarts
- ✅ **Fixed**: Seed script updated to avoid overwriting existing users  
- ✅ **Verified**: Tracy can login successfully with admin123
- ✅ **Confirmed**: All users present in production database

## Backup Admin Account:
- **Default Admin**: admin@nflpicks.com / admin123

## Notes:
- All users are set as active
- Regular users have standard permissions (can make picks, view leaderboards)
- Admin user has full access (user management, game management, system settings)
- **NEW**: Users can now change their own passwords via Profile Settings
- **NEW**: Admin can reset any user's password via Admin Dashboard

## Password Management Features:
### For All Users:
- Click on your name in the top navigation → Profile Settings
- Change your password by providing current password + new password
- New password must be at least 6 characters long

### For Admin (Tracy):
- Access Admin Dashboard → Users tab
- Click "Reset Password" next to any user
- Set a new password without needing their current password
- Useful for helping users who forgot their passwords

## Scripts Used:
- `add_new_users.js` - Added the 7 regular users
- `add_admin_user.js` - Added Tracy as admin user
- **NEW**: Frontend password management UI implemented
- **NEW**: Backend API endpoints for password changes added

Generated: September 2, 2025
