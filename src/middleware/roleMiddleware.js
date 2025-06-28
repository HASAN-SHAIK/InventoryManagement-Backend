const roleMiddleware = (requiredRole) => {
    return (req, res, next) =>{
        if(!req.user || req.user.role !== requiredRole)
            return res.status(403).json({error: 'Insufficient Previleges'});
        next();
    }
}

module.exports = roleMiddleware;