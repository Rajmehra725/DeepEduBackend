import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/db.js";

import User from "../models/User.js";
import School from "../models/School.js";
import Subscription from "../models/Subscription.js";
import AcademicSession from "../models/AcademicSession.js";
import ClassRoom from "../models/ClassRoom.js";
import Section from "../models/Section.js";
import Subject from "../models/Subject.js";
import Teacher from "../models/Teacher.js";
import ClassSubjectTeacher from "../models/ClassSubjectTeacher.js";
import Student from "../models/Student.js";
import Attendance from "../models/Attendance.js";
import Homework from "../models/Homework.js";
import Exam from "../models/Exam.js";
import ExamMark from "../models/ExamMark.js";
import FeeStructure from "../models/FeeStructure.js";
import FeePayment from "../models/FeePayment.js";
import Complaint from "../models/Complaint.js";
import Notice from "../models/Notice.js";
import Notification from "../models/Notification.js";
import { generatePermanentId } from "../utils/idGenerator.js";

async function seed() {
  try {
    await connectDB();
    console.log("🌱 Starting DeepEdu Demonstration School Seeding...");

    // 1. Super Admin Account
    let superAdmin = await User.findOne({ email: "superadmin@deepedu.io" });
    if (!superAdmin) {
      superAdmin = await User.create({
        name: "DeepEdu Platform Admin",
        email: "superadmin@deepedu.io",
        password: "SuperAdmin@123",
        role: "superadmin",
        phone: "+919876543210",
        status: "active",
      });
      console.log("✅ Super Admin created: superadmin@deepedu.io / SuperAdmin@123");
    }

    // 2. Demonstration School
    let school = await School.findOne({ code: "DPS01" });
    if (!school) {
      school = await School.create({
        name: "Delhi Public Demonstration Academy",
        code: "DPS01",
        email: "contact@dpsdemo.edu",
        phone: "+911122334455",
        address: {
          street: "12 Institutional Area, Knowledge Park",
          city: "New Delhi",
          state: "Delhi",
          postalCode: "110001",
          country: "India",
        },
        status: "active",
        studentLimit: 600,
      });
      console.log("✅ School created: Delhi Public Demonstration Academy (DPS01)");
    }

    // 3. SaaS Subscription
    let subscription = await Subscription.findOne({ schoolId: school._id });
    if (!subscription) {
      const oneYearLater = new Date();
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
      subscription = await Subscription.create({
        schoolId: school._id,
        plan: "growth",
        status: "active",
        studentLimit: 600,
        startDate: new Date(),
        endDate: oneYearLater,
        price: 25000,
      });
      console.log("✅ Active SaaS Subscription created");
    }

    // 4. Principal User
    let principal = await User.findOne({ email: "principal@dps.edu" });
    if (!principal) {
      principal = await User.create({
        name: "Dr. Rajeshwar Sharma",
        email: "principal@dps.edu",
        password: "Principal@123",
        role: "principal",
        schoolId: school._id,
        phone: "+919811223344",
        status: "active",
      });
      console.log("✅ Principal created: principal@dps.edu / Principal@123");
    }

    // 5. Academic Session
    let session = await AcademicSession.findOne({ schoolId: school._id, name: "2026-2027" });
    if (!session) {
      session = await AcademicSession.create({
        schoolId: school._id,
        name: "2026-2027",
        startDate: new Date("2026-04-01"),
        endDate: new Date("2027-03-31"),
        isCurrent: true,
      });
      await School.findByIdAndUpdate(school._id, { currentSessionId: session._id });
      console.log("✅ Academic Session 2026-2027 created");
    }

    // 6. Classes and Sections
    const classConfigs = [
      { name: "Class 9", grade: 9, sections: ["A", "B"] },
      { name: "Class 10", grade: 10, sections: ["A", "B"] },
      { name: "Class 11", grade: 11, sections: ["Science", "Commerce"] },
      { name: "Class 12", grade: 12, sections: ["Science", "Commerce"] },
    ];

    const classMap = {};
    const sectionMap = {};

    for (const c of classConfigs) {
      let cls = await ClassRoom.findOne({ schoolId: school._id, name: c.name });
      if (!cls) {
        cls = await ClassRoom.create({
          schoolId: school._id,
          name: c.name,
          numericGrade: c.grade,
        });
      }
      classMap[c.name] = cls;

      for (const secName of c.sections) {
        let sec = await Section.findOne({ schoolId: school._id, classId: cls._id, name: secName });
        if (!sec) {
          sec = await Section.create({
            schoolId: school._id,
            classId: cls._id,
            name: secName,
            capacity: 45,
          });
        }
        sectionMap[`${c.name}-${secName}`] = sec;
      }
    }
    console.log("✅ Classes and Sections created");

    // 7. Subjects
    const subjectList = [
      { name: "Mathematics", code: "MATH101", type: "Core" },
      { name: "Science", code: "SCI102", type: "Core" },
      { name: "English Language & Literature", code: "ENG103", type: "Core" },
      { name: "Social Science", code: "SST104", type: "Core" },
      { name: "Information Technology", code: "IT105", type: "Elective" },
    ];

    const subjectMap = {};
    for (const sub of subjectList) {
      let s = await Subject.findOne({ schoolId: school._id, name: sub.name });
      if (!s) {
        s = await Subject.create({
          schoolId: school._id,
          name: sub.name,
          code: sub.code,
          type: sub.type,
        });
      }
      subjectMap[sub.name] = s;
    }
    console.log("✅ Core subjects created");

    // 8. Teachers
    const teacherData = [
      {
        firstName: "Vandana",
        lastName: "Sharma",
        email: "teacher.sharma@dps.edu",
        empId: "EMP-101",
        phone: "+919871112233",
        designation: "Senior Mathematics Teacher",
        qualification: "M.Sc Mathematics, B.Ed",
        specialization: "Calculus & Geometry",
      },
      {
        firstName: "Alok",
        lastName: "Verma",
        email: "teacher.verma@dps.edu",
        empId: "EMP-102",
        phone: "+919872223344",
        designation: "Head of Science Department",
        qualification: "M.Sc Physics, M.Ed",
        specialization: "Physics & Astronomy",
      },
      {
        firstName: "Pooja",
        lastName: "Nair",
        email: "teacher.nair@dps.edu",
        empId: "EMP-103",
        phone: "+919873334455",
        designation: "English Faculty",
        qualification: "M.A English Literature, B.Ed",
        specialization: "British Literature",
      },
    ];

    const teacherMap = {};
    for (const t of teacherData) {
      let user = await User.findOne({ email: t.email });
      if (!user) {
        user = await User.create({
          name: `${t.firstName} ${t.lastName}`,
          email: t.email,
          password: "Teacher@123",
          role: "teacher",
          schoolId: school._id,
          phone: t.phone,
          status: "active",
        });
      }

      let teacher = await Teacher.findOne({ schoolId: school._id, employeeId: t.empId });
      if (!teacher) {
        const permanentId = await generatePermanentId(school._id, "teacher", "TCH");
        teacher = await Teacher.create({
          schoolId: school._id,
          userId: user._id,
          employeeId: t.empId,
          permanentId,
          firstName: t.firstName,
          lastName: t.lastName,
          email: t.email,
          phone: t.phone,
          designation: t.designation,
          qualification: t.qualification,
          specialization: t.specialization,
          status: "active",
        });
      } else if (!teacher.permanentId) {
        teacher.permanentId = await generatePermanentId(school._id, "teacher", "TCH");
        await teacher.save();
      }
      teacherMap[t.empId] = teacher;
    }
    console.log("✅ Teachers created: teacher.sharma@dps.edu / Teacher@123");

    // Assign Class Teacher to Class 10-A
    const class10A = sectionMap["Class 10-A"];
    await Section.findByIdAndUpdate(class10A._id, {
      classTeacherId: teacherMap["EMP-101"]._id,
    });

    // 9. Assign Teachers to Subjects
    const class10 = classMap["Class 10"];
    const assignments = [
      { classId: class10._id, sectionId: class10A._id, subjectId: subjectMap["Mathematics"]._id, teacherId: teacherMap["EMP-101"]._id },
      { classId: class10._id, sectionId: class10A._id, subjectId: subjectMap["Science"]._id, teacherId: teacherMap["EMP-102"]._id },
      { classId: class10._id, sectionId: class10A._id, subjectId: subjectMap["English Language & Literature"]._id, teacherId: teacherMap["EMP-103"]._id },
    ];

    for (const a of assignments) {
      await ClassSubjectTeacher.findOneAndUpdate(
        { schoolId: school._id, classId: a.classId, sectionId: a.sectionId, subjectId: a.subjectId },
        { ...a, schoolId: school._id, academicSessionId: session._id },
        { upsert: true }
      );
    }
    console.log("✅ Subject and class assignments mapped");

    // 10. Students & Parent Accounts
    const studentList = [
      { adm: "STU-1001", roll: "01", first: "Aarav", last: "Verma", gender: "Male", parent: "Ramesh Verma", pPhone: "+919811001122", pEmail: "parent.verma@gmail.com" },
      { adm: "STU-1002", roll: "02", first: "Diya", last: "Patel", gender: "Female", parent: "Kirit Patel", pPhone: "+919811001123", pEmail: "kirit.patel@gmail.com" },
      { adm: "STU-1003", roll: "03", first: "Ishaan", last: "Gupta", gender: "Male", parent: "Sunil Gupta", pPhone: "+919811001124", pEmail: "sunil.gupta@gmail.com" },
      { adm: "STU-1004", roll: "04", first: "Ananya", last: "Reddy", gender: "Female", parent: "Venkat Reddy", pPhone: "+919811001125", pEmail: "venkat.reddy@gmail.com" },
      { adm: "STU-1005", roll: "05", first: "Vihaan", last: "Singh", gender: "Male", parent: "Gurpreet Singh", pPhone: "+919811001126", pEmail: "gurpreet.singh@gmail.com" },
      { adm: "STU-1006", roll: "06", first: "Saanvi", last: "Joshi", gender: "Female", parent: "Mahesh Joshi", pPhone: "+919811001127", pEmail: "mahesh.joshi@gmail.com" },
    ];

    const studentMap = {};
    for (const st of studentList) {
      const studentEmail = `${st.adm.toLowerCase()}@dps.edu`;
      let studentUser = await User.findOne({ email: studentEmail });
      if (!studentUser) {
        studentUser = await User.create({
          name: `${st.first} ${st.last}`,
          email: studentEmail,
          password: "Student@123",
          role: "student",
          schoolId: school._id,
          phone: st.pPhone,
          status: "active",
        });
      }

      let parentUser = await User.findOne({ email: st.pEmail });
      if (!parentUser) {
        parentUser = await User.create({
          name: st.parent,
          email: st.pEmail,
          password: "Parent@123",
          role: "parent",
          schoolId: school._id,
          phone: st.pPhone,
          status: "active",
        });
      }

      let student = await Student.findOne({ schoolId: school._id, admissionNumber: st.adm });
      if (!student) {
        const permanentId = await generatePermanentId(school._id, "student", "STU");
        student = await Student.create({
          schoolId: school._id,
          userId: studentUser._id,
          admissionNumber: st.adm,
          permanentId,
          rollNumber: st.roll,
          firstName: st.first,
          lastName: st.last,
          gender: st.gender,
          dateOfBirth: new Date("2011-05-15"),
          classId: class10._id,
          sectionId: class10A._id,
          academicSessionId: session._id,
          parentName: st.parent,
          parentPhone: st.pPhone,
          parentEmail: st.pEmail,
          parentUserId: parentUser._id,
          status: "active",
        });
      } else if (!student.permanentId) {
        student.permanentId = await generatePermanentId(school._id, "student", "STU");
        await student.save();
      }
      studentMap[st.adm] = student;
    }
    console.log("✅ Students and parents created: stu-1001@dps.edu / Student@123 | parent.verma@gmail.com / Parent@123");

    // 11. Attendance Records (Past 3 days + Today)
    const today = new Date().toISOString().split("T")[0];
    const pastDates = [today];
    for (let i = 1; i <= 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      pastDates.push(d.toISOString().split("T")[0]);
    }

    for (const d of pastDates) {
      for (const [idx, adm] of Object.keys(studentMap).entries()) {
        const student = studentMap[adm];
        const status = idx === 4 ? "Absent" : idx === 5 ? "Leave" : "Present";
        await Attendance.findOneAndUpdate(
          { schoolId: school._id, studentId: student._id, date: d, session: "FullDay" },
          {
            schoolId: school._id,
            studentId: student._id,
            classId: class10._id,
            sectionId: class10A._id,
            date: d,
            session: "FullDay",
            status,
            markedBy: teacherMap["EMP-101"].userId,
            remarks: status === "Leave" ? "Medical leave submitted" : "",
          },
          { upsert: true }
        );
      }
    }
    console.log("✅ Daily attendance records marked");

    // 12. Homework
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);

    await Homework.create({
      schoolId: school._id,
      classId: class10._id,
      sectionId: class10A._id,
      subjectId: subjectMap["Mathematics"]._id,
      teacherId: teacherMap["EMP-101"]._id,
      title: "Quadratic Equations - Chapter 4 Exercises",
      description: "Solve Exercise 4.1 Questions 1 to 8 in your homework notebook. Show all intermediate steps.",
      dueDate: tomorrow,
      status: "Active",
    });

    await Homework.create({
      schoolId: school._id,
      classId: class10._id,
      sectionId: class10A._id,
      subjectId: subjectMap["Science"]._id,
      teacherId: teacherMap["EMP-102"]._id,
      title: "Chemical Reactions and Balancing Lab Report",
      description: "Complete the practical report on endothermic and exothermic reactions.",
      dueDate: tomorrow,
      status: "Active",
    });
    console.log("✅ Homework assignments assigned");

    // 13. Examination & Marks
    let exam = await Exam.findOne({ schoolId: school._id, name: "Term 1 Mid-Term Examination 2026" });
    if (!exam) {
      exam = await Exam.create({
        schoolId: school._id,
        name: "Term 1 Mid-Term Examination 2026",
        term: "Term 1",
        academicSessionId: session._id,
        startDate: new Date("2026-09-10"),
        endDate: new Date("2026-09-22"),
        status: "Published",
      });

      const marksSample = [
        { adm: "STU-1001", math: 94, sci: 88, eng: 91 },
        { adm: "STU-1002", math: 85, sci: 92, eng: 89 },
        { adm: "STU-1003", math: 78, sci: 74, eng: 80 },
        { adm: "STU-1004", math: 92, sci: 95, eng: 90 },
      ];

      for (const m of marksSample) {
        const student = studentMap[m.adm];
        if (!student) continue;

        await ExamMark.create({
          schoolId: school._id,
          examId: exam._id,
          classId: class10._id,
          sectionId: class10A._id,
          subjectId: subjectMap["Mathematics"]._id,
          studentId: student._id,
          maxMarks: 100,
          obtainedMarks: m.math,
          grade: "A+",
          enteredBy: teacherMap["EMP-101"].userId,
        });

        await ExamMark.create({
          schoolId: school._id,
          examId: exam._id,
          classId: class10._id,
          sectionId: class10A._id,
          subjectId: subjectMap["Science"]._id,
          studentId: student._id,
          maxMarks: 100,
          obtainedMarks: m.sci,
          grade: "A",
          enteredBy: teacherMap["EMP-102"].userId,
        });
      }
      console.log("✅ Examination and published report card marks created");
    }

    // 14. Fee Structure & Payments
    await FeeStructure.findOneAndUpdate(
      { schoolId: school._id, classId: class10._id, category: "Tuition Fee" },
      { schoolId: school._id, classId: class10._id, academicSessionId: session._id, category: "Tuition Fee", amount: 18000, frequency: "Quarterly" },
      { upsert: true }
    );

    await FeeStructure.findOneAndUpdate(
      { schoolId: school._id, classId: class10._id, category: "Computer & Lab Charges" },
      { schoolId: school._id, classId: class10._id, academicSessionId: session._id, category: "Computer & Lab Charges", amount: 3500, frequency: "Annual" },
      { upsert: true }
    );

    const aarav = studentMap["STU-1001"];
    const existingPayment = await FeePayment.findOne({
      schoolId: school._id,
      receiptNumber: "RCP-2026-0001",
    });
    if (!existingPayment) {
      await FeePayment.create({
        schoolId: school._id,
        studentId: aarav._id,
        receiptNumber: "RCP-2026-0001",
        amount: 15000,
        paymentMethod: "UPI",
        transactionRef: "UPI/20261019/998877",
        feeCategory: "Quarterly Tuition Installment",
        recordedBy: principal._id,
        remarks: "Part payment received via PhonePe",
        paymentDate: new Date(),
      });
    }
    console.log("✅ Fee structures and receipt RCP-2026-0001 recorded");

    // 15. Complaint (Shikayat)
    await Complaint.create({
      schoolId: school._id,
      studentId: aarav._id,
      studentUserId: aarav.userId,
      teacherId: teacherMap["EMP-101"]._id,
      title: "Doubt in Calculus Chapter 3 Concept",
      category: "Academic issue",
      description: "Respected Ma'am, I am facing difficulty understanding the Chain Rule application in Question 7. Requesting a 10-minute clarification during zero period.",
      status: "Assigned",
      adminNotes: "Assigned to Mrs. Vandana Sharma for review during remedial period.",
      history: [
        { status: "Submitted", changedBy: aarav.userId, note: "Submitted by student", timestamp: new Date(Date.now() - 86400000) },
        { status: "Assigned", changedBy: principal._id, note: "Assigned to subject faculty", timestamp: new Date() },
      ],
    });
    console.log("✅ Sample student complaint (shikayat) recorded");

    // 16. Notices
    await Notice.create({
      schoolId: school._id,
      title: "Annual Sports Meet 2026 Registration Open",
      content: "All students are informed that trials for Track & Field, Football, and Badminton will commence from October 25. Submit nominations to your Physical Education instructor.",
      targetAudience: "All",
      priority: "Normal",
      postedBy: principal._id,
      publishedDate: new Date(),
    });

    await Notice.create({
      schoolId: school._id,
      title: "Parent-Teacher Meeting (PTM) Schedule",
      content: "Term 1 PTM will be held on Saturday, 24th October from 9:00 AM to 1:00 PM. Parents can check report cards in the DeepEdu portal beforehand.",
      targetAudience: "Parents",
      priority: "High",
      postedBy: principal._id,
      publishedDate: new Date(),
    });
    console.log("✅ School circulars and notices posted");

    console.log("\n=======================================================");
    console.log("🎉 DEMONSTRATION SCHOOL SEEDING COMPLETED SUCCESSFULLY!");
    console.log("=======================================================");
    console.log("DEMO ACCOUNTS READY:");
    console.log("1. Super Admin:  superadmin@deepedu.io        / SuperAdmin@123");
    console.log("2. Principal:    principal@dps.edu           / Principal@123");
    console.log("3. Teacher:      teacher.sharma@dps.edu      / Teacher@123");
    console.log("4. Student:      stu-1001@dps.edu            / Student@123");
    console.log("5. Parent:       parent.verma@gmail.com      / Parent@123");
    console.log("=======================================================\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seed();
