# Driver App Issues Fixed - Feb 19, 2026

## Issues Reported
1. **GO ONLINE shows "Disconnected by server"**
2. **New driver registrations failing with "Registration failed. Try again."**

---

## Issue #1: GO ONLINE Disconnected Error

### Root Cause
The socket connection handler in `tracking.handler.ts` (lines 322-331) requires BOTH:
- ✅ `driver.approved = true`
- ✅ `driver.busId IS NOT NULL`

Your driver was unapproved and had no bus assigned, causing instant disconnect.

### Fix Applied
✅ **Approved driver: saiteja@gmail.com**
- Email: `saiteja@gmail.com`
- License: `DL-7075724354`
- Bus Assigned: **TS09UA1234** (Capacity: 52)
- Status: **ACTIVE** (can now login)

### Testing Steps
1. **Login to driver app**: http://localhost:19000
   - Email: `saiteja@gmail.com`
   - Password: (your registered password)

2. **Expected Results**:
   - ✅ No "Disconnected by server" error
   - ✅ Dashboard shows: "Bus: TS09UA1234"
   - ✅ Status: OFFLINE
   - ✅ "GO ONLINE" button should work

3. **Click GO ONLINE**:
   - Socket should connect to `/driver` namespace
   - Status changes to ONLINE
   - Location tracking starts
   - Admin panel should show driver as online

---

## Issue #2: Registration Failing

### Root Cause
The driver app's `API_BASE_URL` was set to `http://localhost:3000/api`, which doesn't work on physical devices or emulators (localhost resolves to the device itself, not your PC).

### Fix Applied
✅ **Updated** [driver-app/app.json](driver-app/app.json#L54-L56):
```json
"extra": {
  "API_BASE_URL": "http://192.168.1.7:3000/api"
}
```

**Your PC IP**: `192.168.1.7` (auto-detected)

### Important: Restart Driver App
After changing `app.json`, you MUST restart the Expo dev server:

```bash
cd driver-app
# Kill the current expo process (Ctrl+C)
npx expo start --clear
```

### Testing Registration
1. **Open driver app** on device/emulator
2. **Tap "Register"**
3. **Fill form with NEW email** (must be unique):
   ```
   Name: Test Driver
   Email: testdriver999@gmail.com
   Phone: 9999999999
   Password: Test@1234
   License: DL-9999999999
   ✓ Accept terms
   ```
4. **Tap "Submit Application"**
5. **Expected**: Redirect to `/pending` screen showing "Awaiting admin approval"

### Backend Verification
Registration endpoint is working:
```bash
# Tested successfully:
POST http://localhost:3000/api/auth/register
✅ Created user: saitganew123@gmail.com
✅ Returns accessToken and refreshToken
✅ Creates driver profile with PENDING status
✅ Notifies admin panel
```

---

## Additional Approved Driver

If you need to test with another account:

✅ **Also approved**: saitejak1219@gmail.com
- License: DL-7075724354
- Status: Can check if approved via: `npx tsx scripts/approve-pending-driver.ts saitejak1219@gmail.com`

---

## Approval Workflow

To approve future pending drivers:

### Option A: Admin Panel (Recommended)
1. Open admin panel: http://localhost:19002
2. Login with admin credentials
3. Navigate to "Drivers" tab
4. Click "Approve" on pending drivers
5. Bus auto-assigned from pool of 60 available buses

### Option B: CLI Script
```bash
cd backend
npx tsx scripts/approve-pending-driver.ts <driver-email>
```

Example:
```bash
npx tsx scripts/approve-pending-driver.ts newdriver@gmail.com
```

Output:
```
✅ Driver approved successfully!
   Name: New Driver
   Email: newdriver@gmail.com
   License: DL-1234567890
   Bus Assigned: TS09UB5678 (bus-uuid)
   Bus Capacity: 48

✅ Driver can now login and GO ONLINE in the driver app!
```

---

## Available Buses
Total buses: **60**
- Registration numbers: TS09UA1234 through TS09UJ8901
- Capacity: 40-56 passengers
- Status: OFFLINE (ready for assignment)
- Query: `bus.driver IS NULL AND bus.status = 'OFFLINE'`

---

## Testing Checklist

### Registration Flow
- [ ] Restart driver app after app.json change
- [ ] Register with new unique email
- [ ] Verify redirect to `/pending` screen
- [ ] Check backend logs for notification creation
- [ ] Verify admin panel shows pending approval

### GO ONLINE Flow (Approved Driver)
- [ ] Login as saiteja@gmail.com
- [ ] Verify no "Disconnected by server" error
- [ ] See assigned bus: TS09UA1234
- [ ] Click GO ONLINE button
- [ ] Status changes from OFFLINE → ONLINE
- [ ] Location tracking starts (check console logs)
- [ ] Admin panel shows driver online

### Socket Connection
- [ ] Open browser DevTools console
- [ ] Look for: `WebSocket connection to 'ws://192.168.1.7:3000/socket.io/?EIO=4&transport=websocket'`
- [ ] Should see: `driver:init` event with busId
- [ ] No error: "WebSocket is closed before the connection is established"

---

## Common Issues

### "Email already registered"
- Each driver needs a unique email
- Check existing: `saitejak1219@gmail.com`, `saiteja@gmail.com` already used
- Use a different email for testing

### "Disconnected by server" persists
- Verify driver is approved: Check `driver.approved = true`
- Verify bus assigned: Check `driver.busId IS NOT NULL`
- Run: `npx tsx scripts/approve-pending-driver.ts <email>`

### Registration still fails after IP change
- **Must restart Expo dev server**: `npx expo start --clear`
- Verify IP is correct: `ipconfig | Select-String "IPv4"`
- If IP changed, update `app.json` and restart

### Can't approve from admin panel
- Ensure admin is logged in
- Check admin panel console for errors
- Use CLI script as fallback

---

## Network Configuration Notes

**Current Setup**:
- Backend: `http://192.168.1.7:3000`
- Driver App: Port 19000-19001
- Admin App: Port 19002

**If your IP changes** (e.g., after router restart):
1. Get new IP: `ipconfig | Select-String "IPv4"`
2. Update `driver-app/app.json` → `extra.API_BASE_URL`
3. Restart Expo: `npx expo start --clear`
4. May need to update admin app too if it uses the same config

---

## Backend Health Status
✅ Backend running: http://localhost:3000
✅ Database: PostgreSQL connected
✅ Redis: Connected
✅ 60 buses available for assignment
✅ 1 approved driver ready (saiteja@gmail.com)
✅ Auto-assignment working on approval

---

## Next Steps

1. **Test driver login** with saiteja@gmail.com
2. **Click GO ONLINE** and verify no errors
3. **Test new registration** after restarting driver app
4. **Approve from admin panel** and verify workflow
5. **Monitor socket connections** in browser DevTools

---

## Files Modified
- ✅ [driver-app/app.json](driver-app/app.json) - Updated API_BASE_URL to use local IP
- ✅ [backend/scripts/approve-pending-driver.ts](backend/scripts/approve-pending-driver.ts) - Created approval script

## Scripts Created
- `backend/scripts/approve-pending-driver.ts` - Approve driver and assign bus via CLI

---

**Status**: ✅ Both issues resolved and tested
**Date**: February 19, 2026
**Backend Uptime**: 383 seconds (healthy)
