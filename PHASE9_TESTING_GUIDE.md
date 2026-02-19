# Phase 9 Extended — Complete Testing Guide

## 🎯 What Was Implemented

### ✅ Completed Features

1. **Notification Center UI**
   - Right-side drawer notification panel
   - Bell icon with live unread count
   - Grouped notifications (Today / Earlier)
   - Mark as read / Mark all as read functionality
   - Real-time updates via socket events
   - Auto-refresh on visibility

2. **Dynamic Sidebar Badges**
   - Live pending driver count on "Drivers" sidebar item
   - Live open disputes count on "Disputes" sidebar item
   - Auto-refresh every 30 seconds
   - Fetched from `/admin/dashboard-summary` endpoint

3. **Real Driver Approval Workflow**
   - Admin panel "Drivers" tab shows real pending drivers
   - Approve/Reject buttons with API integration
   - Real-time socket events to driver app
   - Automatic list updates after approval/rejection
   - Loading states and empty states

## 🧪 Testing the Complete Workflow

### Prerequisites

Ensure all services are running:
- ✅ Backend: http://localhost:3000 (running)
- ✅ Admin/Passenger App: Port 19002 (or alternative)
- ✅ Driver App: Port 19000 (or alternative)
- ✅ PostgreSQL: Port 5432
- ✅ Redis: Port 6379

### Test Scenario 1: Driver Registration → Admin Approval → Driver Access

#### Step 1: Register a Test Driver

A test driver has already been registered:
- Email: `testdriver1771499144121@hydgo.com`
- Password: `Test@1234`
- Status: PENDING

Or create a new one using the script:
```powershell
cd backend
npx tsx scripts/test-driver-approval.ts
```

#### Step 2: Admin Login

1. Open the mobile/admin app in browser: http://localhost:19002
2. Navigate to Admin Registration (first time) or Admin Login
3. Use these credentials:
   - **Admin Secret**: `HYDGO_SUPER_ADMIN_2026`
   - **Email**: Your admin email
   - **Password**: Your admin password

#### Step 3: Check Notification Center

1. Look at the top-right bell icon 🔔
2. You should see a badge with the count of unread notifications
3. Click the bell icon
4. The notification drawer should slide in from the right
5. You should see: "New driver application" notification
6. Click the notification to mark it as read
7. Badge count should decrease

#### Step 4: Navigate to Driver Approvals

1. Click "Drivers" in the sidebar
2. You should see the pending driver count badge (e.g., "1")
3. The "Pending Approvals" section should show:
   - Driver name: `Test Driver 1771499144121`
   - Driver email: `testdriver1771499144121@hydgo.com`
   - License number and application date
   - Two buttons: "Reject" and "Approve"

#### Step 5: Approve the Driver

1. Click the **"Approve"** button
2. The driver card should disappear from the list
3. The sidebar badge count should decrease
4. A new notification should be created: "Driver approved: [name]"

#### Step 6: Verify Driver App Receives Event

1. Open the driver app in another browser window
2. Log in with the test driver credentials:
   - Email: `testdriver1771499144121@hydgo.com`
   - Password: `Test@1234`
3. Initially, you should see the "Pending Approval" screen
4. **After admin approves**, the screen should automatically redirect to the dashboard within 1-2 seconds
5. The driver status should be "OFFLINE" (ready to go online)

**Real-time Socket Events:**
- Event emitted: `driver:approved` to `/driver` namespace
- Driver app receives event and refreshes profile
- Automatic navigation from pending screen to dashboard

### Test Scenario 2: Driver Rejection

1. Register another test driver (use the script again)
2. Log in as admin
3. Go to "Drivers" tab
4. Click **"Reject"** instead of "Approve"
5. The driver card should disappear
6. Notification should be created

### Test Scenario 3: Real-time Notification Updates

1. Open admin panel in browser 1
2. Open driver registration in browser 2
3. Click the bell icon in admin panel (notification center should be open)
4. Register a new driver in browser 2
5. **Watch the notification center in browser 1**:
   - A new notification should appear automatically
   - Badge count should increment
   - Socket event `notification:new` received

### Test Scenario 4: Dynamic Badge Updates

1. Open admin panel
2. Check the sidebar "Drivers" badge count (e.g., 2)
3. Register a new driver using another tab/window
4. Wait up to 30 seconds (or refresh manually)
5. The badge count should increase automatically
6. Approve a driver
7. The badge count should decrease immediately

## 🔍 Verification Checklist

### Backend Verification

```powershell
# Check pending drivers
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/drivers/pending" `
  -Headers @{Authorization="Bearer YOUR_ADMIN_TOKEN"} `
  -Method GET | ConvertTo-Json

# Check notifications
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/notifications" `
  -Headers @{Authorization="Bearer YOUR_ADMIN_TOKEN"} `
  -Method GET | ConvertTo-Json

# Check dashboard summary
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/dashboard-summary" `
  -Headers @{Authorization="Bearer YOUR_ADMIN_TOKEN"} `
  -Method GET | ConvertTo-Json
```

### Database Verification

Check the database directly:

```sql
-- Check pending drivers
SELECT id, "fullName", email, "driverStatus", approved, "createdAt"
FROM "Driver"
WHERE "driverStatus" = 'PENDING' AND approved = false;

-- Check notifications
SELECT id, title, message, type, read, "createdAt"
FROM "AdminNotification"
ORDER BY "createdAt" DESC
LIMIT 10;

-- Check driver state logs
SELECT * FROM "DriverStateLog"
ORDER BY "createdAt" DESC
LIMIT 10;
```

### Socket Events to Monitor

**Driver Approval:**
- Namespace: `/driver`
- Event: `driver:approved`
- Payload: `{ driverId: string, message: string }`

**Driver Rejection:**
- Namespace: `/driver`
- Event: `driver:rejected`
- Payload: `{ driverId: string, reason: string }`

**Admin Notification:**
- Namespace: `/admin`
- Event: `notification:new`
- Payload: `{ notification: AdminNotification }`

**Driver List Update:**
- Namespace: `/admin`
- Event: `driver:approval-updated`
- Payload: `{ driverId: string, status: string }`

## 📊 Expected Behavior

### Notification Center
- ✅ Opens/closes smoothly with slide animation
- ✅ Shows grouped notifications (Today / Earlier)
- ✅ Displays icon based on notification type
- ✅ Marks individual notifications as read on click
- ✅ "Mark all as read" button appears when unread exist
- ✅ Badge updates in real-time
- ✅ Empty state when no notifications

### Sidebar Badges
- ✅ "Drivers" badge shows pending approval count
- ✅ "Disputes" badge shows open complaint count
- ✅ Updates every 30 seconds automatically
- ✅ Updates immediately after approval/rejection
- ✅ Badge disappears when count is 0

### Driver Approval Flow
- ✅ Pending drivers load from API
- ✅ Shows loading spinner while fetching
- ✅ Shows empty state when no pending drivers
- ✅ Approve button triggers API call
- ✅ Reject button triggers API call
- ✅ Driver disappears from list after action
- ✅ Refresh icon refetches the list
- ✅ Driver receives real-time socket event
- ✅ Driver app redirects automatically on approval
- ✅ Driver logs out after 3 seconds on rejection

## 🐛 Troubleshooting

### Issue: Notification center doesn't open
- Check browser console for errors
- Verify API endpoint `/admin/notifications` is accessible
- Check admin authentication token

### Issue: Badges show 0 but drivers are pending
- Check `/admin/dashboard-summary` endpoint response
- Verify dashboard summary includes `pendingDrivers` field
- Check 30-second auto-refresh interval

### Issue: Driver doesn't receive socket event
- Verify driver is connected to socket (check console logs)
- Check socket namespace is `/driver`
- Verify backend emits event in `AdminService.approveDriver()`
- Check driver socket listeners in `useDriverSocket.ts`

### Issue: "Cannot find module" errors
- Run `npm install` in backend directory
- Run `npm install` in mobile app directories
- Restart Metro bundler

## 📈 Success Metrics

- ✅ All 9 tasks completed
- ✅ Zero static/mock data in admin panel
- ✅ Real-time notifications working
- ✅ Dynamic badge updates working
- ✅ Driver approval workflow end-to-end functional
- ✅ Socket events emitting and receiving correctly
- ✅ Database records created properly
- ✅ TypeScript compilation successful
- ✅ No runtime errors

## 🎉 Final Notes

The Phase 9 Extended implementation is now **complete**! The admin control center is fully functional with:

1. **Real-time notifications** with socket integration
2. **Dynamic sidebar badges** refreshing every 30 seconds
3. **Complete driver approval workflow** from registration to acceptance
4. **Instant driver app updates** via socket events
5. **Professional UI/UX** with loading states, empty states, and animations

All data now flows from the backend API — no more static mock data! 🚀
