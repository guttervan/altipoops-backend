const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { ValidationError, UniqueConstraintError } = require("sequelize");

const User = require("../models/User");
const requireAuth = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", async (request, response) => {
  try {
    const {
      displayName,
      email,
      password,
      homeRegion,
    } = request.body || {};

    if (!displayName || !email || !password) {
      return response.status(400).json({
        message: "Display name, email, and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingUser) {
      return response.status(409).json({
        message: "An account with that email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      displayName,
      email: normalizedEmail,
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

    if (error instanceof UniqueConstraintError) {
      return response.status(409).json({
        message: "An account with that email already exists.",
      });
    }

    if (error instanceof ValidationError) {
      return response.status(400).json({
        message: error.errors[0]?.message || "Invalid registration information.",
      });
    }

    response.status(500).json({
      message: "Something went wrong while registering the user.",
    });
  }
});

router.post("/login", async (request, response) => {
  try {
    const { email, password } = request.body || {};

    if (!email || !password) {
      return response.status(400).json({
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      where: {
        email: normalizedEmail,
      },
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

router.get("/me", requireAuth, async (request, response) => {
  try {
    const user = await User.findByPk(request.user.userId, {
      attributes: {
        exclude: ["passwordHash"],
      },
    });

    if (!user) {
      return response.status(404).json({
        message: "User not found.",
      });
    }

    response.status(200).json({
      user,
    });
  } catch (error) {
    console.error(error);

    response.status(500).json({
      message: "Something went wrong while loading the user.",
    });
  }
});

router.put("/me", requireAuth, async (request, response) => {
  try {
    const user = await User.findByPk(request.user.userId);

    if (!user) {
      return response.status(404).json({
        message: "User not found.",
      });
    }

    const {
      displayName,
      homeRegion,
      privacySetting,
    } = request.body || {};

    const allowedPrivacySettings = [
      "private",
      "friends",
      "public",
    ];

    if (
      privacySetting !== undefined &&
      !allowedPrivacySettings.includes(privacySetting)
    ) {
      return response.status(400).json({
        message: "Privacy setting must be private, friends, or public.",
      });
    }

    await user.update({
      displayName: displayName ?? user.displayName,
      homeRegion: homeRegion ?? user.homeRegion,
      privacySetting: privacySetting ?? user.privacySetting,
    });

    response.status(200).json({
      message: "Profile updated successfully!",
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

    if (error instanceof ValidationError) {
      return response.status(400).json({
        message: error.errors[0]?.message || "Invalid profile information.",
      });
    }

    response.status(500).json({
      message: "Something went wrong while updating the profile.",
    });
  }
});

module.exports = router;