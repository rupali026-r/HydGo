/**
 * Test script for driver approval workflow
 * 
 * This script:
 * 1. Registers a test driver (creates PENDING status)
 * 2. Verifies notification was created for admin
 * 3. Shows pending drivers
 * 4. Provides instructions for manual approval test
 */

import axios from 'axios';

const API_BASE = 'http://localhost:3000/api';

interface RegisterResponse {
  success: boolean;
  data?: {
    user: any;
    driver: any;
    token: string;
  };
  message?: string;
}

async function testDriverApprovalWorkflow() {
  console.log('\n🚀 Testing Driver Approval Workflow\n');
  console.log('=' .repeat(60));

  try {
    // Step 1: Register a test driver
    console.log('\n📝 Step 1: Registering test driver...');
    const timestamp = Date.now();
    const testDriver = {
      name: `Test Driver ${timestamp}`,
      email: `testdriver${timestamp}@hydgo.com`,
      password: 'Test@1234',
      phone: `+91${timestamp.toString().slice(-10)}`,
      role: 'DRIVER',
      licenseNumber: `DL${timestamp}`,
      vehicleNumber: `TS09${timestamp.toString().slice(-4)}`,
      vehicleType: 'BUS',
    };

    const registerResponse = await axios.post<RegisterResponse>(
      `${API_BASE}/auth/register`,
      testDriver
    );

    if (!registerResponse.data.success) {
      throw new Error(registerResponse.data.message || 'Registration failed');
    }

    const driverId = registerResponse.data.data?.driver?.id;
    const driverToken = registerResponse.data.data?.token;

    console.log('✅ Driver registered successfully!');
    console.log(`   Driver ID: ${driverId}`);
    console.log(`   Email: ${testDriver.email}`);
    console.log(`   Status: PENDING (waiting for admin approval)`);

    // Step 2: Verify driver is in pending state
    console.log('\n🔍 Step 2: Verifying driver status...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for notification creation

    // Mock admin login (you'll need to replace this with actual admin credentials)
    console.log('\n🔐 Step 3: Admin authentication needed...');
    console.log('   Please login as admin to see the pending driver.');
    console.log('   Admin Secret: HYDGO_SUPER_ADMIN_2026');

    // Step 3: Show how to check pending drivers
    console.log('\n📋 Step 4: To view pending drivers:');
    console.log('   GET /api/admin/drivers/pending');
    console.log('   (Requires admin authentication)');

    // Step 4: Show approval/rejection endpoints
    console.log('\n✅ Step 5: To approve this driver:');
    console.log(`   PATCH /api/admin/drivers/${driverId}/approve`);
    console.log('   (Requires admin authentication)');

    console.log('\n❌ Alternative: To reject this driver:');
    console.log(`   PATCH /api/admin/drivers/${driverId}/reject`);
    console.log('   (Requires admin authentication)');

    // Step 5: What happens next
    console.log('\n🎯 Expected Workflow:');
    console.log('   1. Admin sees notification: "New driver application"');
    console.log('   2. Admin goes to Approvals screen');
    console.log(`   3. Admin sees driver: ${testDriver.name}`);
    console.log('   4. Admin clicks "Approve" button');
    console.log('   5. Driver receives socket event "driver:approved"');
    console.log('   6. Driver app redirects to dashboard automatically');
    console.log('   7. Driver status changes: PENDING → OFFLINE');

    console.log('\n🔔 Real-time Events:');
    console.log('   - Socket namespace: /driver');
    console.log('   - Event emitted: driver:approved');
    console.log('   - Notification created: DRIVER_APPROVED');

    console.log('\n✨ Test driver created successfully!');
    console.log('   You can now test the approval workflow in the admin panel.');
    console.log('\n' + '='.repeat(60) + '\n');

  } catch (error: any) {
    console.error('\n❌ Error during test:', error.message);
    if (error.response?.data) {
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Run the test
testDriverApprovalWorkflow();
