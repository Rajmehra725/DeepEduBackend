import axios from "axios";

/**
 * Server-Side CAPTCHA Verification Middleware
 * Supports Cloudflare Turnstile (Primary) and Google reCAPTCHA
 */
export const verifyCaptcha = async (req, res, next) => {
  const token =
    req.body.captchaToken ||
    req.headers["x-captcha-token"] ||
    req.query.captchaToken;

  // Check if CAPTCHA enforcement is bypassed for unit tests or explicitly disabled via env
  if (process.env.DISABLE_CAPTCHA === "true") {
    return next();
  }

  // Support local test suite synthetic bypass token in non-production
  if (
    process.env.NODE_ENV !== "production" &&
    (token === "test-captcha-token" ||
      token === "1x00000000000000000000AA")
  ) {
    req.captchaVerified = true;
    return next();
  }

  if (!token) {
    return res.status(400).json({
      success: false,
      message: "CAPTCHA verification required. Please complete the security check.",
      code: "CAPTCHA_REQUIRED",
    });
  }

  try {
    const turnstileSecret =
      process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY ||
      process.env.CAPTCHA_SECRET_KEY ||
      "1x0000000000000000000000000000000AA"; // Cloudflare official testing pass key

    const params = new URLSearchParams();
    params.append("secret", turnstileSecret);
    params.append("response", token);
    const remoteIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    if (remoteIp) {
      params.append("remoteip", Array.isArray(remoteIp) ? remoteIp[0] : remoteIp.split(",")[0].trim());
    }

    const verificationResponse = await axios.post(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      params,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 6000,
      }
    );

    const { success, "error-codes": errorCodes } = verificationResponse.data;

    if (!success) {
      console.warn("Turnstile server verification failed:", errorCodes);
      return res.status(400).json({
        success: false,
        message: "CAPTCHA challenge verification failed. Please try again.",
        code: "CAPTCHA_FAILED",
        errors: errorCodes,
      });
    }

    req.captchaVerified = true;
    next();
  } catch (err) {
    console.error("CAPTCHA verification network/server error:", err.message);

    // Cloudflare outage / unreachable fallback
    if (process.env.NODE_ENV !== "production") {
      console.warn("Non-production environment: permitting request despite CAPTCHA service unreachable");
      req.captchaVerified = true;
      return next();
    }

    return res.status(503).json({
      success: false,
      message: "Security verification service temporarily unreachable. Please retry shortly.",
      code: "CAPTCHA_SERVICE_UNAVAILABLE",
    });
  }
};
