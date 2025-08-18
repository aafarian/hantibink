#!/usr/bin/env node

/**
 * Test script for matching functionality
 * Run with: node test-matching.js
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log(`
🧪 MATCHING TEST GUIDE
====================

To test the matching system properly, follow these steps:

1️⃣  CREATE TWO TEST ACCOUNTS:
   - User A: test1@test.com / password
   - User B: test2@test.com / password
   
2️⃣  ADD PHOTOS TO BOTH ACCOUNTS:
   - Login to each account
   - Go to Profile → Edit Profile
   - Upload at least 1 photo each
   
3️⃣  TEST THE MATCHING FLOW:
   
   Step 1: Login as User A
   - Go to Discovery/People screen
   - You should see User B in the feed
   - Either swipe right OR use the TEST button
   
   Step 2: Login as User B  
   - Go to Discovery/People screen
   - You should see User A in the feed
   - Swipe right OR use the TEST button
   
   Step 3: Check for Match
   - Both users should now see each other in Matches tab
   - Try sending a message
   
4️⃣  WHAT TO LOOK FOR IN LOGS:
   - "🎉 New match created: [ID] between [user1] and [user2]"
   - "✅ User liked via API" 
   - Match count updates
   
5️⃣  CURRENT ISSUES TO TEST:
   - Do users appear in discovery after liking?
   - Do matches show up in the Matches tab?
   - Can you send messages after matching?
   - Do users without photos get filtered out?

🚨 DEBUGGING TIPS:
   - Check API logs for match creation messages
   - Verify both users have photos uploaded
   - Make sure you're testing with different user accounts
   - Clear app data if behavior seems cached

Press ENTER to continue or Ctrl+C to exit...
`);

rl.question('', () => {
  console.log(`
📱 QUICK COMMANDS:

To reset test data:
   - Delete all matches: DELETE FROM "Match";
   - Delete all actions: DELETE FROM "UserAction";
   - (Use your database client)

To check current data:
   - View matches: SELECT * FROM "Match";
   - View actions: SELECT * FROM "UserAction";
   - View users: SELECT id, email, name FROM "User";

Need more help? Check the API logs while testing!
`);
  rl.close();
});
