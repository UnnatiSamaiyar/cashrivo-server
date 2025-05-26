const express = require("express");
const router = express.Router();
const { signup, login, forgot, getUsers, updateUser } = require("../controller/authController");

router.post("/signup", signup);
router.post("/login", login);
router.post("/forgot", forgot);

router.get("/users", getUsers);
router.put("/users/:userId", updateUser)


module.exports = router;
