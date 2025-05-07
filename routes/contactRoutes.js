const express = require("express");
const router = express.Router();
const Contact = require("../models/Contact");

router.post("/contact", async (req, res) => {
  try {
    const { name, company, phone, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res
        .status(400)
        .json({ error: "Name, email, and message are required." });
    }

    const newContact = new Contact({
      name,
      company,
      phone,
      email,
      subject,
      message,
    });
    await newContact.save();

    res.status(201).json({ message: "Message stored successfully" });
  } catch (error) {
    console.error("Error saving contact:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/get-contacts", async (req, res) => {
  try {
    const contacts = await Contact.find();
    res.status(200).json(contacts);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;
