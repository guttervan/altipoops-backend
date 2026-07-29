const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const router = express.Router();
const jwt = require("jsonwebtoken");

router.post("/register", async (request, response) => {
  try {
    const { displayName, email, password, homeRegion } = request.body;

    if (!displayName || !email || !password) {
      return response.status(400).json({
        message: "Display name, email, and password are required.",
      });
    }

    const existingUser = await User.findOne({
      where: { email },
    });

    if (existingUser) {
      return response.status(409).json({
        message: "An account with that email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      displayName,
      email,
      passwordHash,
      homeRegion: homeRegion || null,
    });

    response.status(201).json({
      message: "User registered successfully!",
      user: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        homeRegion: user.homeRegion,
        privacySetting: user.privacySetting,
      },
    });
  } catch (error) {
    console.error(error);

    response.status(500).json({
      message: "Something went wrong while registering the user.",
    });
  }
});
router.post("/login", async (request, response) => {
  try {
    const { email, password } = request.body;

    if (!email || !password) {
      return response.status(400).json({
        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({
      where: { email },
    });

    if (!user) {
      return response.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return response.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const token = jwt.sign(
  {
    userId: user.id,
    email: user.email,
  },
  process.env.JWT_SECRET,
  {
    expiresIn: "7d",
  }
);

response.status(200).json({
  message: "Login successful!",
  token,
  user: {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    homeRegion: user.homeRegion,
    privacySetting: user.privacySetting,
  },
});
  } catch (error) {
    console.error(error);

    response.status(500).json({
      message: "Something went wrong while logging in.",
    });
  }
});


module.exports = router;