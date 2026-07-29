const jwt = require("jsonwebtoken");

function requireAuth(request, response, next) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return response.status(401).json({
      message: "Login token required.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    request.user = decoded;

    next();
  } catch (error) {
    return response.status(401).json({
      message: "Invalid or expired login token.",
    });
  }
}

module.exports = requireAuth;