const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const router = express.Router();

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

module.exports = router;