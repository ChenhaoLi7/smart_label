module.exports = (...allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user?.role

    if (!userRole) {
      return res.status(403).json({
        success: false,
        message: '未获取到用户角色'
      })
    }

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      })
    }

    next()
  }
}
