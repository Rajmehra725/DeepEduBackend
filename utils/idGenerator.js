import Counter from "../models/Counter.js";

/**
 * Concurrency-safe permanent ID generator using atomic MongoDB findOneAndUpdate
 * @param {ObjectId} schoolId - Tenant school identifier
 * @param {string} entity - 'student' | 'teacher' | 'parent' | 'certificate'
 * @param {string} prefix - e.g. 'STU', 'TCH', 'PRN', 'CERT'
 * @returns {Promise<string>} e.g. "STU-2026-0001"
 */
export async function generatePermanentId(schoolId, entity, prefix) {
  const year = new Date().getFullYear();
  const counter = await Counter.findOneAndUpdate(
    { schoolId, entity, year },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const paddedSeq = String(counter.seq).padStart(4, "0");
  return `${prefix}-${year}-${paddedSeq}`;
}
