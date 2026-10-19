export const requireTenant = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  // Superadmin can act globally or optionally specify a tenant in query/body
  if (req.user.role === "superadmin") {
    req.schoolId = req.query?.schoolId || req.body?.schoolId || null;
    return next();
  }

  // Non-superadmin users MUST have a verified schoolId
  if (!req.user.schoolId) {
    return res.status(403).json({
      success: false,
      message: "No school association found for this user account",
    });
  }

  // Strict tenant lock: override any attempt to spoof schoolId via body or params
  const requestedSchoolId =
    req.params?.schoolId || req.query?.schoolId || req.body?.schoolId;

  if (
    requestedSchoolId &&
    requestedSchoolId.toString() !== req.user.schoolId.toString()
  ) {
    return res.status(403).json({
      success: false,
      message: "Cross-tenant access forbidden. You cannot access another school's data.",
    });
  }

  req.schoolId = req.user.schoolId;
  next();
};
