import "dotenv/config";
import axios from "axios";

const BASE_URL = `http://localhost:${process.env.PORT || 5000}/api`;

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failedCount++;
  }
}

async function runTests() {
  console.log("\n🧪 Running DeepEdu 1.0 Automated Verification Suite...\n");
  console.log(`Target API Base: ${BASE_URL}\n`);

  // Wait 1.5s for server to settle
  await new Promise((r) => setTimeout(r, 1500));

  let superAdminToken = "";
  let principalToken = "";
  let teacherToken = "";
  let studentToken = "";
  let parentToken = "";
  let schoolId = "";
  let testStudentId = "";
  let testClassId = "";
  let testSectionId = "";
  let testSubjectId = "";
  let testExamId = "";

  // 1. AUTHENTICATION TESTS
  console.log("--- 1. AUTHENTICATION & LOGIN ---");
  try {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
      email: "principal@dps.edu",
      password: "Principal@123",
    });
    assert(res.status === 200 && res.data.data.token, "Principal login succeeds with valid credentials");
    principalToken = res.data.data.token;
    schoolId = res.data.data.school._id;
  } catch (err) {
    assert(false, `Principal login failed: ${err.message}`);
  }

  try {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
      email: "superadmin@deepedu.io",
      password: "SuperAdmin@123",
    });
    assert(res.status === 200 && res.data.data.user.role === "superadmin", "Super Admin login succeeds");
    superAdminToken = res.data.data.token;
  } catch (err) {
    assert(false, `Super Admin login failed: ${err.message}`);
  }

  try {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
      email: "teacher.sharma@dps.edu",
      password: "Teacher@123",
    });
    assert(res.status === 200 && res.data.data.user.role === "teacher", "Teacher login succeeds");
    teacherToken = res.data.data.token;
  } catch (err) {
    assert(false, `Teacher login failed: ${err.message}`);
  }

  try {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
      email: "stu-1001@dps.edu",
      password: "Student@123",
    });
    assert(res.status === 200 && res.data.data.user.role === "student", "Student login succeeds");
    studentToken = res.data.data.token;
  } catch (err) {
    assert(false, `Student login failed: ${err.message}`);
  }

  try {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
      email: "parent.verma@gmail.com",
      password: "Parent@123",
    });
    assert(res.status === 200 && res.data.data.user.role === "parent", "Parent login succeeds");
    parentToken = res.data.data.token;
  } catch (err) {
    assert(false, `Parent login failed: ${err.message}`);
  }

  try {
    await axios.post(`${BASE_URL}/auth/login`, {
      email: "principal@dps.edu",
      password: "WrongPassword!99",
    });
    assert(false, "Rejection of invalid password failed (expected 401)");
  } catch (err) {
    assert(err.response?.status === 401, "Invalid password rejected with HTTP 401");
  }

  // 2. SUPER ADMIN PLATFORM MANAGEMENT
  console.log("\n--- 2. SUPER ADMIN PLATFORM MANAGEMENT ---");
  try {
    const res = await axios.get(`${BASE_URL}/superadmin/dashboard`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(res.status === 200 && res.data.data.stats.totalSchools >= 1, "Super Admin dashboard statistics retrieved");
  } catch (err) {
    assert(false, `Super Admin dashboard failed: ${err.message}`);
  }

  try {
    const res = await axios.get(`${BASE_URL}/superadmin/schools`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(res.status === 200 && Array.isArray(res.data.data.schools), "Super Admin school list retrieved");
  } catch (err) {
    assert(false, `Super Admin school list failed: ${err.message}`);
  }

  // 3. ROLE-BASED ACCESS CONTROL (RBAC) & PERMISSION ENFORCEMENT
  console.log("\n--- 3. ROLE-BASED ACCESS CONTROL & PERMISSION GUARDS ---");
  try {
    await axios.get(`${BASE_URL}/superadmin/dashboard`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert(false, "Teacher accessing Super Admin dashboard should be blocked");
  } catch (err) {
    assert(err.response?.status === 403, "Teacher blocked from Super Admin endpoint with HTTP 403");
  }

  try {
    await axios.post(
      `${BASE_URL}/academics/classes`,
      { name: "Unauthorized Class" },
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );
    assert(false, "Student creating class should be blocked");
  } catch (err) {
    assert(err.response?.status === 403, "Student blocked from creating classes with HTTP 403");
  }

  // 4. ACADEMICS & CLASSES
  console.log("\n--- 4. ACADEMIC STRUCTURE & CLASSES ---");
  try {
    const res = await axios.get(`${BASE_URL}/academics/classes`, {
      headers: { Authorization: `Bearer ${principalToken}` },
    });
    assert(res.status === 200 && res.data.data.length > 0, "Classes and sections retrieved for school");
    testClassId = res.data.data[0]._id;
    testSectionId = res.data.data[0].sections[0]._id;
  } catch (err) {
    assert(false, `Academics classes failed: ${err.message}`);
  }

  try {
    const res = await axios.get(`${BASE_URL}/academics/subjects`, {
      headers: { Authorization: `Bearer ${principalToken}` },
    });
    assert(res.status === 200 && res.data.data.length > 0, "Subjects retrieved for school");
    testSubjectId = res.data.data[0]._id;
  } catch (err) {
    assert(false, `Academics subjects failed: ${err.message}`);
  }

  // 5. STUDENTS MANAGEMENT & SEARCH
  console.log("\n--- 5. STUDENT MANAGEMENT & SEARCH ---");
  try {
    const res = await axios.get(`${BASE_URL}/students?search=Aarav`, {
      headers: { Authorization: `Bearer ${principalToken}` },
    });
    assert(res.status === 200 && res.data.data.students.length >= 1, "Student search by name works");
    testStudentId = res.data.data.students[0]._id;
  } catch (err) {
    assert(false, `Student search failed: ${err.message}`);
  }

  try {
    const res = await axios.get(`${BASE_URL}/students/${testStudentId}`, {
      headers: { Authorization: `Bearer ${principalToken}` },
    });
    assert(res.status === 200 && res.data.data.admissionNumber === "STU-1001", "Student profile details retrieved");
  } catch (err) {
    assert(false, `Student details failed: ${err.message}`);
  }

  // 6. TEACHER MODULE & ASSIGNED CLASSES
  console.log("\n--- 6. TEACHER MODULE & ASSIGNED CLASSES ---");
  try {
    const res = await axios.get(`${BASE_URL}/teachers/my-classes`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert(res.status === 200 && Array.isArray(res.data.data.assignedClasses), "Teacher assigned classes retrieved");
  } catch (err) {
    assert(false, `Teacher assigned classes failed: ${err.message}`);
  }

  // 7. ATTENDANCE MANAGEMENT
  console.log("\n--- 7. ATTENDANCE ROSTER & MARKING ---");
  try {
    const res = await axios.get(
      `${BASE_URL}/attendance/roster?classId=${testClassId}&sectionId=${testSectionId}`,
      { headers: { Authorization: `Bearer ${teacherToken}` } }
    );
    assert(res.status === 200 && Array.isArray(res.data.data.roster), "Attendance roster retrieved");
  } catch (err) {
    assert(false, `Attendance roster failed: ${err.message}`);
  }

  try {
    const res = await axios.get(`${BASE_URL}/attendance/student/${testStudentId}`, {
      headers: { Authorization: `Bearer ${principalToken}` },
    });
    assert(res.status === 200 && res.data.data.percentage !== undefined, "Student attendance percentage computed");
  } catch (err) {
    assert(false, `Student attendance summary failed: ${err.message}`);
  }

  // 8. HOMEWORK
  console.log("\n--- 8. HOMEWORK MANAGEMENT ---");
  try {
    const res = await axios.get(`${BASE_URL}/homework`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(res.status === 200 && Array.isArray(res.data.data), "Student retrieves assigned homework");
  } catch (err) {
    assert(false, `Homework fetch failed: ${err.message}`);
  }

  // 9. EXAMINATION & REPORT CARDS
  console.log("\n--- 9. EXAMINATION & RESULTS ---");
  try {
    const res = await axios.get(`${BASE_URL}/exams`, {
      headers: { Authorization: `Bearer ${principalToken}` },
    });
    assert(res.status === 200 && res.data.data.length > 0, "Examination list retrieved");
    testExamId = res.data.data[0]._id;
  } catch (err) {
    assert(false, `Exams list failed: ${err.message}`);
  }

  try {
    const res = await axios.get(
      `${BASE_URL}/exams/report-card?studentId=${testStudentId}`,
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );
    assert(res.status === 200 && Array.isArray(res.data.data.reportCards), "Student report card retrieved with calculated grades");
  } catch (err) {
    assert(false, `Report card failed: ${err.message}`);
  }

  // 10. FEES & RECEIPTS
  console.log("\n--- 10. FEES & RECEIPT GENERATION ---");
  try {
    const res = await axios.get(`${BASE_URL}/fees/student/${testStudentId}`, {
      headers: { Authorization: `Bearer ${principalToken}` },
    });
    assert(res.status === 200 && res.data.data.totalFeeAmount > 0, "Student fee dues and pending balance computed");
  } catch (err) {
    assert(false, `Fee details failed: ${err.message}`);
  }

  try {
    const res = await axios.get(`${BASE_URL}/fees/receipts/RCP-2026-0001`, {
      headers: { Authorization: `Bearer ${principalToken}` },
    });
    assert(res.status === 200 && res.data.data.receiptNumber === "RCP-2026-0001", "Printable fee receipt data retrieved");
  } catch (err) {
    assert(false, `Fee receipt failed: ${err.message}`);
  }

  // 11. COMPLAINT / SHIKAYAT SYSTEM
  console.log("\n--- 11. COMPLAINT / SHIKAYAT MANAGEMENT ---");
  try {
    const res = await axios.get(`${BASE_URL}/complaints/my`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(res.status === 200 && Array.isArray(res.data.data), "Student retrieves own filed complaints");
  } catch (err) {
    assert(false, `Student complaints fetch failed: ${err.message}`);
  }

  try {
    const res = await axios.get(`${BASE_URL}/complaints`, {
      headers: { Authorization: `Bearer ${principalToken}` },
    });
    assert(res.status === 200 && res.data.data.complaints.length > 0, "Principal retrieves school complaints");
  } catch (err) {
    assert(false, `Principal complaints fetch failed: ${err.message}`);
  }

  // 12. NOTICES & NOTIFICATIONS
  console.log("\n--- 12. NOTICES & NOTIFICATIONS ---");
  try {
    const res = await axios.get(`${BASE_URL}/notices`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(res.status === 200 && Array.isArray(res.data.data), "School circulars and notices retrieved");
  } catch (err) {
    assert(false, `Notices fetch failed: ${err.message}`);
  }

  try {
    const res = await axios.get(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(res.status === 200 && Array.isArray(res.data.data.notifications), "User notifications inbox retrieved");
  } catch (err) {
    assert(false, `Notifications fetch failed: ${err.message}`);
  }

  // 13. CSV EXPORTS
  console.log("\n--- 13. CSV DATA EXPORT ---");
  try {
    const res = await axios.get(`${BASE_URL}/reports/students/export`, {
      headers: { Authorization: `Bearer ${principalToken}` },
    });
    assert(res.status === 200 && res.data.includes("AdmissionNumber"), "Student CSV register export successful");
  } catch (err) {
    assert(false, `Student CSV export failed: ${err.message}`);
  }

  // 14. FACULTY SELF-ATTENDANCE
  console.log("\n--- 14. FACULTY ATTENDANCE & PRINCIPAL REVIEW ---");
  try {
    const res = await axios.post(
      `${BASE_URL}/teacher-attendance/check-in`,
      { status: "Present", remarks: "Automated check-in test" },
      { headers: { Authorization: `Bearer ${teacherToken}` } }
    );
    assert(
      (res.status === 200 || res.status === 201) && res.data.data.status === "Present",
      "Teacher self-attendance check-in recorded"
    );
  } catch (err) {
    assert(false, `Teacher check-in failed: ${err.message}`);
  }

  try {
    const res = await axios.get(`${BASE_URL}/teacher-attendance/school`, {
      headers: { Authorization: `Bearer ${principalToken}` },
    });
    assert(
      res.status === 200 && Array.isArray(res.data.data.report),
      "Principal retrieves daily faculty attendance roster"
    );
  } catch (err) {
    assert(false, `Principal teacher attendance view failed: ${err.message}`);
  }

  // 15. TIMETABLE & CONFLICT VALIDATION
  console.log("\n--- 15. TIMETABLE SCHEDULE & CONFLICT VALIDATION ---");
  let testSlotId = "";
  let teacherIdForTimetable = "";
  try {
    const teachersRes = await axios.get(`${BASE_URL}/teachers`, {
      headers: { Authorization: `Bearer ${principalToken}` },
    });
    const teachersList = teachersRes.data.data.teachers || [];
    teacherIdForTimetable = teachersList[0]._id;

    // Add valid timetable slot
    const slotRes = await axios.post(
      `${BASE_URL}/timetable/slot`,
      {
        classId: testClassId,
        sectionId: testSectionId,
        subjectId: testSubjectId,
        teacherId: teacherIdForTimetable,
        dayOfWeek: "Monday",
        periodNumber: 1,
        startTime: "09:00",
        endTime: "09:45",
        roomNumber: "Room-101",
      },
      { headers: { Authorization: `Bearer ${principalToken}` } }
    );
    assert(
      (slotRes.status === 200 || slotRes.status === 201) && slotRes.data.data._id,
      "Timetable slot created successfully"
    );
    testSlotId = slotRes.data.data._id;

    // Get other section for collision testing
    const classesRes = await axios.get(`${BASE_URL}/academics/classes`, {
      headers: { Authorization: `Bearer ${principalToken}` },
    });
    const firstClass = classesRes.data.data[0];
    const otherSectionId =
      firstClass.sections[1]?._id || classesRes.data.data[1]?.sections[0]?._id;

    // Test Teacher Conflict (same teacher, same day, same period in another section)
    try {
      await axios.post(
        `${BASE_URL}/timetable/slot`,
        {
          classId: testClassId,
          sectionId: otherSectionId,
          subjectId: testSubjectId,
          teacherId: teacherIdForTimetable,
          dayOfWeek: "Monday",
          periodNumber: 1,
          startTime: "09:00",
          endTime: "09:45",
          roomNumber: "Room-102",
        },
        { headers: { Authorization: `Bearer ${principalToken}` } }
      );
      assert(false, "Teacher conflict slot should be rejected");
    } catch (conflictErr) {
      assert(
        conflictErr.response?.status === 409,
        "Teacher schedule collision rejected with HTTP 409 Conflict"
      );
    }

    // Test Room Conflict (different teacher, same room, same day, same period in another section)
    try {
      await axios.post(
        `${BASE_URL}/timetable/slot`,
        {
          classId: testClassId,
          sectionId: otherSectionId,
          subjectId: testSubjectId,
          teacherId: teachersList[1]?._id || teacherIdForTimetable,
          dayOfWeek: "Monday",
          periodNumber: 1,
          startTime: "09:00",
          endTime: "09:45",
          roomNumber: "Room-101",
        },
        { headers: { Authorization: `Bearer ${principalToken}` } }
      );
      assert(false, "Room conflict slot should be rejected");
    } catch (conflictErr) {
      assert(
        conflictErr.response?.status === 409,
        "Room occupancy collision rejected with HTTP 409 Conflict"
      );
    }

    // Clean up created slot
    if (testSlotId) {
      await axios.delete(`${BASE_URL}/timetable/slot/${testSlotId}`, {
        headers: { Authorization: `Bearer ${principalToken}` },
      });
    }
  } catch (err) {
    assert(false, `Timetable workflow failed: ${err.message}`);
  }

  // 16. MARKSHEET & A4 PRINTABLE REPORT CARD
  console.log("\n--- 16. MARKSHEET METRICS & A4 PRINTABLE ENGINE ---");
  try {
    const res = await axios.get(`${BASE_URL}/marksheets/${testStudentId}`, {
      headers: { Authorization: `Bearer ${principalToken}` },
    });
    assert(
      res.status === 200 &&
        res.data.data.summary.totalMax > 0 &&
        res.data.data.student.permanentId,
      "Marksheet JSON computed with totals, percentages, and permanent student ID"
    );
  } catch (err) {
    assert(false, `Marksheet data failed: ${err.message}`);
  }

  try {
    const res = await axios.get(
      `${BASE_URL}/marksheets/${testStudentId}/print?token=${principalToken}`
    );
    assert(
      res.status === 200 &&
        res.data.includes("Academic Progress Report") &&
        res.data.includes("@page { size: A4 portrait;"),
      "Printable A4 HTML marksheet generated with print CSS and grade breakdown"
    );
  } catch (err) {
    assert(false, `Printable marksheet HTML failed: ${err.message}`);
  }

  // 17. CERTIFICATE ISSUANCE & PRINTING
  console.log("\n--- 17. CERTIFICATES & BONAFIDE GENERATION ---");
  let testCertId = "";
  try {
    const res = await axios.post(
      `${BASE_URL}/certificates`,
      {
        studentId: testStudentId,
        type: "Bonafide Certificate",
        remarks: "Exemplary academic conduct and regular attendance",
      },
      { headers: { Authorization: `Bearer ${principalToken}` } }
    );
    assert(
      res.status === 201 && res.data.data.certificateNumber.startsWith("CERT-"),
      "Bonafide certificate issued with atomic sequence number"
    );
    testCertId = res.data.data._id;
  } catch (err) {
    assert(false, `Certificate issuance failed: ${err.message}`);
  }

  try {
    const res = await axios.get(
      `${BASE_URL}/certificates/${testCertId}/print?token=${principalToken}`
    );
    assert(
      res.status === 200 &&
        res.data.includes("Bonafide Certificate") &&
        res.data.includes("cert-frame"),
      "Printable A4 landscape certificate HTML rendered with institutional seals"
    );
  } catch (err) {
    assert(false, `Certificate print HTML failed: ${err.message}`);
  }

  // 18. GALLERY ALBUMS & MEDIA
  console.log("\n--- 18. GALLERY ALBUMS & MULTI-TENANT MEDIA ---");
  let testAlbumId = "";
  try {
    const res = await axios.post(
      `${BASE_URL}/gallery`,
      {
        title: "Annual Sports Meet 2026",
        description: "Track and field events for high school division",
        category: "Sports",
        coverImage: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211",
      },
      { headers: { Authorization: `Bearer ${principalToken}` } }
    );
    assert(
      res.status === 201 && res.data.data.title === "Annual Sports Meet 2026",
      "Gallery album created with cover image and category"
    );
    testAlbumId = res.data.data._id;
  } catch (err) {
    assert(false, `Gallery album creation failed: ${err.message}`);
  }

  try {
    const res = await axios.post(
      `${BASE_URL}/gallery/${testAlbumId}/media`,
      {
        items: [
          {
            url: "https://images.unsplash.com/photo-1517649763962-0c623266ddc0",
            title: "Relay Race Finish",
            caption: "Gold medal victory in 4x100m relay",
            mediaType: "image",
          },
        ],
      },
      { headers: { Authorization: `Bearer ${principalToken}` } }
    );
    assert(
      res.status === 200 && res.data.data.media.length > 0,
      "Media item attached to gallery album"
    );
  } catch (err) {
    assert(false, `Gallery media attachment failed: ${err.message}`);
  }

  try {
    const res = await axios.get(`${BASE_URL}/gallery`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(
      res.status === 200 && Array.isArray(res.data.data),
      "Student retrieves published school gallery albums"
    );
  } catch (err) {
    assert(false, `Gallery listing failed: ${err.message}`);
  }

  // 19. PERMANENT CONCURRENCY-SAFE ID VERIFICATION
  console.log("\n--- 19. PERMANENT IDENTIFIER SYSTEM ---");
  try {
    const studentRes = await axios.get(`${BASE_URL}/students/${testStudentId}`, {
      headers: { Authorization: `Bearer ${principalToken}` },
    });
    const sId = studentRes.data.data.permanentId;
    assert(
      Boolean(sId && sId.startsWith("STU-")),
      `Student permanent ID exists and follows standardized convention: ${sId}`
    );

    const teachersRes = await axios.get(`${BASE_URL}/teachers`, {
      headers: { Authorization: `Bearer ${principalToken}` },
    });
    const tId = teachersRes.data.data.teachers[0]?.permanentId;
    assert(
      Boolean(tId && tId.startsWith("TCH-")),
      `Teacher permanent ID exists and follows standardized convention: ${tId}`
    );
  } catch (err) {
    assert(false, `Permanent ID verification failed: ${err.message}`);
  }

  console.log("\n=======================================================");
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
