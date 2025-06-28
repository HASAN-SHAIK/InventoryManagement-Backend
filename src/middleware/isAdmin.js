const jwt = require("jsonwebtoken");
const isAdmin = (req, res, next) => {
   try {
       // Get token from headers
       const token = req.cookies.token;
       if (!token) {
           return res.status(401).json({ error: "Access Denied. No token provided." });
       }
       // Verify and decode token
       const decoded = jwt.verify(token, process.env.JWT_SECRET);
       // Check user role
       if (decoded.role !== "admin") {
           return res.status(403).json({ error: "Access Denied. Admins only." });
       }
       // Attach user info to request
       req.user = decoded;
       next();
   } catch (error) {
       return res.status(400).json({ error: "Invalid token" });
   }
};
module.exports = isAdmin;