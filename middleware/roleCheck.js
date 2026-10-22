const roleCheck = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ msg: "No user found" })
    }

    let roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]

    if (roles.indexOf(req.user.role) === -1) {
      res.status(403).json({ msg: 'Access denied. Insufficient role.' });
      return;
    }

    next();
  }
}

module.exports = roleCheck
