const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {
  let token = req.header('x-auth-token')
  const authHeader = req.header('Authorization')

  if (!token && authHeader) {
    const parts = authHeader.split(' ')
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1]
    } else {
      token = authHeader;
    }
  }

  if (!token) {
    return res.status(401).json({ msg: "No token, authorization denied" });
  }

  try {
    var decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded;
    next()
  } catch (err) {
    res.status(401).json({ msg: "Token is not valid" });
  }
}
