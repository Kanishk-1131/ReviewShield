import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import User from "../models/User.js";

export const protect = asyncHandler(async (req, res, next) => {
  let token;
  const header = req.headers.authorization;

  if (header && header.startsWith("Bearer ")) {
    token = header.split(" ")[1];
  }

  if (!token) {
    res.status(401);
    throw new Error("Not authorized. No token provided.");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    if (!req.user) {
      res.status(401);
      throw new Error("User no longer exists.");
    }
    next();
  } catch (err) {
    res.status(401);
    throw new Error("Not authorized. Invalid or expired token.");
  }
});

export const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    res.status(403);
    throw new Error("Admin access required.");
  }
  next();
};
