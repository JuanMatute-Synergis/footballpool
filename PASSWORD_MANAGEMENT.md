# Password Management Guide

## For Users - Changing Your Own Password

Users can change their own passwords using the API endpoint:

### API Endpoint
```
PUT /api/auth/change-password
```

### Required Headers
```
Content-Type: application/json
Authorization: Bearer <your-jwt-token>
```

### Request Body
```json
{
  "currentPassword": "your-current-password",
  "newPassword": "your-new-password"
}
```

### Example using curl
```bash
# First, get your JWT token by logging in
TOKEN=$(curl -s -X POST https://footballpool.golfleaguemanager.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@example.com", "password": "your-current-password"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Then change your password
curl -X PUT https://footballpool.golfleaguemanager.app/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"currentPassword": "your-current-password", "newPassword": "your-new-password"}'
```

### Password Requirements
- Must be at least 6 characters long
- Must provide correct current password for verification

---

## For Admin (Tracy) - Resetting User Passwords

As an admin, Tracy can reset any user's password without knowing their current password.

### API Endpoint
```
PUT /api/admin/users/{userId}/reset-password
```

### Required Headers
```
Content-Type: application/json
Authorization: Bearer <admin-jwt-token>
```

### Request Body
```json
{
  "newPassword": "new-password-for-user"
}
```

### Example using curl
```bash
# First, get admin JWT token
ADMIN_TOKEN=$(curl -s -X POST https://footballpool.golfleaguemanager.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "tlgildner8@yahoo.com", "password": "admin123"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Reset a user's password (replace USER_ID with actual user ID)
curl -X PUT https://footballpool.golfleaguemanager.app/api/admin/users/USER_ID/reset-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"newPassword": "new-password-123"}'
```

### Finding User IDs
To find a user's ID, use the admin users endpoint:
```bash
curl -X GET https://footballpool.golfleaguemanager.app/api/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Current User IDs

| ID | Name | Email | Current Password |
|----|------|-------|------------------|
| 6 | Katie Mercadante | K8tiec18@aol.com | Welcome123! |
| 7 | Heather Hamilton | Hbrown8@yahoo.com | Welcome123! |
| 8 | Renee Jones | Renjones714@gmail.com | Welcome123! |
| 9 | Kristin Stinker | kskinker24@gmail.com | Welcome123! |
| 10 | Liz Richburg | Free67bird@gmail.com | Welcome123! |
| 11 | Amanda Tavarez | Atavarez88@gmail.com | Welcome123! |
| 12 | Chanda Carl | chandalscheetz@gmail.com | Welcome123! |
| 13 | Tracy Gildner (Admin) | tlgildner8@yahoo.com | admin123 |

---

## Security Notes

- User password changes require the current password for security
- Admin password resets do not require the user's current password
- All passwords are hashed with bcrypt (12 rounds) before storage
- JWT tokens expire after 7 days
- Password changes take effect immediately

---

## Frontend Integration

These features will need to be integrated into the Angular frontend:

1. **User Profile Page**: Add a "Change Password" form
2. **Admin User Management**: Add "Reset Password" buttons/forms for each user
3. **Password Requirements**: Display validation messages
4. **Success/Error Handling**: Show appropriate messages to users

---

*Generated: September 2, 2025*
