import axios from "axios";
import { createServer } from "http";
import express from "express";
import connectDB from "../config/db.js";
import User from "../models/user.model.js";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import SecretRoom from "../models/secretRoom.model.js";
import TimeCapsule from "../models/timeCapsule.model.js";
import Moment from "../models/moment.model.js";
import Report from "../models/report.model.js";

import authRoutes from "../routes/auth.routes.js";
import userRoutes from "../routes/user.routes.js";
import friendRoutes from "../routes/friend.routes.js";
import chatRoutes from "../routes/chat.routes.js";
import groupRoutes from "../routes/group.routes.js";
import secretRoomRoutes from "../routes/secretRoom.routes.js";
import momentRoutes from "../routes/moment.routes.js";
import timeCapsuleRoutes from "../routes/timeCapsule.routes.js";
import chatPlayRoutes from "../routes/chatPlay.routes.js";
import adminRoutes from "../routes/admin.routes.js";
import reportRoutes from "../routes/report.routes.js";
import uploadRoutes from "../routes/upload.routes.js";

const TEST_PORT = 5088;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

async function runVerification() {
  console.log("=================================================");
  console.log("   RAAZCHAT PRO: SYSTEM & API VERIFICATION SUITE   ");
  console.log("=================================================");

  // 1. Connect DB
  await connectDB();
  console.log("✅ Step 1: MongoDB Database Connected");

  // 2. Start test server
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/friends", friendRoutes);
  app.use("/api/chat", chatRoutes);
  app.use("/api/groups", groupRoutes);
  app.use("/api/secret-room", secretRoomRoutes);
  app.use("/api/moments", momentRoutes);
  app.use("/api/capsules", timeCapsuleRoutes);
  app.use("/api/chat-play", chatPlayRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/upload", uploadRoutes);

  const server = createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`✅ Step 2: Test Server Running on port ${TEST_PORT}`);

  const testSuffix = Date.now().toString().slice(-6);
  const userAData = {
    fullName: "Raj User A",
    username: `raaz_a_${testSuffix}`,
    phone: `9100${testSuffix}`,
    password: "Password123!",
    confirmPassword: "Password123!",
  };

  const userBData = {
    fullName: "Priya User B",
    username: `raaz_b_${testSuffix}`,
    phone: `9200${testSuffix}`,
    password: "Password123!",
    confirmPassword: "Password123!",
  };

  let tokenA = "";
  let tokenB = "";
  let userAId = "";
  let userBId = "";

  // 3. Test Registration User A
  const regARes = await axios.post(`${BASE_URL}/auth/register`, userAData);
  if (!regARes.data.success || !regARes.data.token) {
    throw new Error("User A Registration failed");
  }
  tokenA = regARes.data.token;
  userAId = regARes.data.user._id;
  console.log(`✅ Step 3: Registration User A Success (@${userAData.username})`);

  // 4. Test Duplicate Account Rejection (Same Username)
  try {
    await axios.post(`${BASE_URL}/auth/register`, userAData);
    throw new Error("Duplicate registration should have failed");
  } catch (err) {
    if (err.response?.status === 400) {
      console.log("✅ Step 4: Duplicate Account Rejection Enforced");
    } else {
      throw err;
    }
  }

  // 5. Test Registration User B
  const regBRes = await axios.post(`${BASE_URL}/auth/register`, userBData);
  tokenB = regBRes.data.token;
  userBId = regBRes.data.user._id;
  console.log(`✅ Step 5: Registration User B Success (@${userBData.username})`);

  // 6. Test Username Login
  const loginUsernameRes = await axios.post(`${BASE_URL}/auth/login`, {
    identifier: `@${userAData.username}`,
    password: userAData.password,
  });
  if (!loginUsernameRes.data.success) throw new Error("Username login failed");
  console.log("✅ Step 6: Username + Password Login Verified");

  // 7. Test Mobile Number Login
  const loginMobileRes = await axios.post(`${BASE_URL}/auth/login`, {
    identifier: userAData.phone,
    password: userAData.password,
  });
  if (!loginMobileRes.data.success) throw new Error("Mobile login failed");
  console.log("✅ Step 7: Mobile Number + Password Login Verified");

  // 8. Test Invalid Password Handling
  try {
    await axios.post(`${BASE_URL}/auth/login`, {
      identifier: userAData.phone,
      password: "WrongPassword999",
    });
    throw new Error("Invalid password login should have failed");
  } catch (err) {
    if (err.response?.status === 401) {
      console.log("✅ Step 8: Invalid Password Handled Correctly (401 Unauthorized)");
    } else {
      throw err;
    }
  }

  // 9. Test Protected Profile API
  const profileRes = await axios.get(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  if (!profileRes.data.success || profileRes.data.user.phone !== userAData.phone) {
    throw new Error("Protected API failed");
  }
  console.log("✅ Step 9: Protected Route Authorization Verified");

  // 10. Test Raaz ID User Search
  const searchRes = await axios.get(`${BASE_URL}/users/search?query=${userBData.username}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  if (!searchRes.data.success || searchRes.data.users.length === 0) {
    throw new Error("User Search failed");
  }
  // Mobile number must NOT be exposed in search
  if (searchRes.data.users[0].phone) {
    throw new Error("Private mobile number leaked in public search!");
  }
  console.log("✅ Step 10: Raaz ID Search & Mobile Privacy Verified");

  // 11. Test Friend Request Lifecycle
  const friendReqRes = await axios.post(
    `${BASE_URL}/friends/request`,
    { recipientId: userBId },
    { headers: { Authorization: `Bearer ${tokenA}` } }
  );
  const requestId = friendReqRes.data.friendRequest._id;
  const acceptRes = await axios.put(
    `${BASE_URL}/friends/accept/${requestId}`,
    {},
    { headers: { Authorization: `Bearer ${tokenB}` } }
  );
  if (!acceptRes.data.success) throw new Error("Friend request accept failed");
  console.log("✅ Step 11: Friend Request Sent & Accepted Verified");

  // 12. Test Two-Account Direct Messaging & Persistence
  const chatDirectRes = await axios.post(
    `${BASE_URL}/chat/direct`,
    { recipientId: userBId },
    { headers: { Authorization: `Bearer ${tokenA}` } }
  );
  const conversationId = chatDirectRes.data.conversation._id;

  const sendMsgRes = await axios.post(
    `${BASE_URL}/chat/messages/${conversationId}`,
    { text: "Hello from User A in RaazChat Pro!" },
    { headers: { Authorization: `Bearer ${tokenA}` } }
  );
  const messageId = sendMsgRes.data.message._id;

  const getMsgRes = await axios.get(`${BASE_URL}/chat/messages/${conversationId}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const foundMsg = getMsgRes.data.messages.find((m) => m._id === messageId);
  if (!foundMsg) throw new Error("Message persistence failed");
  console.log("✅ Step 12: Two-Account Messaging & Persistence Verified");

  // 13. Test Message Reactions
  const reactRes = await axios.post(
    `${BASE_URL}/chat/messages/${messageId}/reaction`,
    { emoji: "❤️" },
    { headers: { Authorization: `Bearer ${tokenB}` } }
  );
  if (!reactRes.data.success) throw new Error("Message reaction failed");
  console.log("✅ Step 13: Message Reactions Verified");

  // 14. Test Message Editing
  const editRes = await axios.put(
    `${BASE_URL}/chat/messages/${messageId}`,
    { text: "Updated message text" },
    { headers: { Authorization: `Bearer ${tokenA}` } }
  );
  if (!editRes.data.success || !editRes.data.message.isEdited) {
    throw new Error("Message edit failed");
  }
  console.log("✅ Step 14: Message Editing Verified");

  // 15. Test Secret Room Creation & Join
  const secretRes = await axios.post(
    `${BASE_URL}/secret-room/create`,
    { title: "Top Secret Team Room", durationMinutes: 30 },
    { headers: { Authorization: `Bearer ${tokenA}` } }
  );
  const secretCode = secretRes.data.room.code;
  const joinSecretRes = await axios.post(
    `${BASE_URL}/secret-room/join`,
    { code: secretCode },
    { headers: { Authorization: `Bearer ${tokenB}` } }
  );
  if (!joinSecretRes.data.success) throw new Error("Secret room join failed");
  console.log(`✅ Step 15: Secret Room Created (Code: ${secretCode}) & Joined`);

  // 16. Test Ghost Mode Privacy Toggle
  const ghostRes = await axios.put(
    `${BASE_URL}/users/privacy`,
    { ghostMode: true },
    { headers: { Authorization: `Bearer ${tokenA}` } }
  );
  if (!ghostRes.data.success || !ghostRes.data.privacySettings.ghostMode) {
    throw new Error("Ghost mode toggle failed");
  }
  console.log("✅ Step 16: Ghost Mode Privacy Settings Verified");

  // 17. Test Feelings Mode
  const moodRes = await axios.put(
    `${BASE_URL}/users/mood`,
    { mood: "focused", note: "Working on RaazChat release" },
    { headers: { Authorization: `Bearer ${tokenA}` } }
  );
  if (!moodRes.data.success || moodRes.data.currentMood.mood !== "focused") {
    throw new Error("Feelings mode failed");
  }
  console.log("✅ Step 17: Feelings Mode Verified");

  // 18. Test Time Capsule Scheduled Message
  const deliverDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const capsuleRes = await axios.post(
    `${BASE_URL}/capsules/create`,
    {
      title: "My Future Message",
      message: "Congratulations on launching RaazChat!",
      deliverAt: deliverDate,
      isSelfCapsule: true,
    },
    { headers: { Authorization: `Bearer ${tokenA}` } }
  );
  if (!capsuleRes.data.success) throw new Error("Time capsule failed");
  console.log("✅ Step 18: Time Capsule Scheduled Message Verified");

  // 19. Test Raaz Moments (24-hour Stories)
  const momentRes = await axios.post(
    `${BASE_URL}/moments/create`,
    {
      type: "text",
      text: "RaazChat Pro is live! 🚀",
      backgroundColor: "#FF7A00",
      audience: "friends",
    },
    { headers: { Authorization: `Bearer ${tokenA}` } }
  );
  if (!momentRes.data.success) throw new Error("Moment creation failed");
  const momentId = momentRes.data.moment._id;
  const viewMomentRes = await axios.post(
    `${BASE_URL}/moments/view/${momentId}`,
    {},
    { headers: { Authorization: `Bearer ${tokenB}` } }
  );
  if (!viewMomentRes.data.success) throw new Error("Moment view track failed");
  console.log("✅ Step 19: Raaz Moments & Viewer Tracking Verified");

  // 20. Test Community Circles
  const groupRes = await axios.post(
    `${BASE_URL}/groups/create`,
    {
      name: "Developers Circle",
      type: "circle",
      category: "coding",
      participants: [userBId],
    },
    { headers: { Authorization: `Bearer ${tokenA}` } }
  );
  if (!groupRes.data.success) throw new Error("Circle creation failed");
  console.log("✅ Step 20: Community Circle Chat Verified");

  // 21. Test Abuse Reporting
  const reportRes = await axios.post(
    `${BASE_URL}/reports/submit`,
    {
      targetType: "user",
      targetId: userBId,
      targetUserId: userBId,
      reason: "Inappropriate language test",
    },
    { headers: { Authorization: `Bearer ${tokenA}` } }
  );
  if (!reportRes.data.success) throw new Error("Report submit failed");
  console.log("✅ Step 21: Abuse Reporting Submission Verified");

  // 22. Test Admin Privileges & Metrics
  // Set User A as admin for testing admin API
  await User.findByIdAndUpdate(userAId, { role: "admin" });
  const adminMetricsRes = await axios.get(`${BASE_URL}/admin/metrics`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  if (!adminMetricsRes.data.success || adminMetricsRes.data.metrics.totalUsers < 2) {
    throw new Error("Admin metrics failed");
  }
  console.log("✅ Step 22: Admin Dashboard Metrics Verified (Real DB Queries)");

  // 23. Test User Moderation (Suspend / Ban)
  const suspendRes = await axios.put(
    `${BASE_URL}/admin/users/${userBId}/suspend`,
    { reason: "Testing suspension" },
    { headers: { Authorization: `Bearer ${tokenA}` } }
  );
  if (!suspendRes.data.success) throw new Error("Admin suspension failed");
  console.log("✅ Step 23: Admin User Moderation (Suspension) Verified");

  // 24. Clean up test server
  server.close();
  console.log("=================================================");
  console.log("🎉 ALL 24 VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉");
  console.log("=================================================");
  process.exit(0);
}

runVerification().catch((err) => {
  console.error("❌ TEST FAILED:", err?.response?.data || err.message);
  process.exit(1);
});
