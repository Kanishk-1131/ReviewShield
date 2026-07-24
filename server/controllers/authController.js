import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";

// @route POST /api/auth/register
export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Name, email and password are all required.");
  }
  if (password.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters.");
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    res.status(409);
    throw new Error("An account with this email already exists.");
  }

  const user = await User.create({ name, email, password });

  res.status(201).json({
    user: user.toSafeObject(),
    token: generateToken(user._id),
  });
});

// @route POST /api/auth/login
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Email and password are required.");
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error("Invalid email or password.");
  }

  res.json({
    user: user.toSafeObject(),
    token: generateToken(user._id),
  });
});

// @route GET /api/auth/me
export const getMe = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toSafeObject() });
});
