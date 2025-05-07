const express = require('express');
const router = express.Router();
const Advertisement = require('../models/Advertisement');

router.post('/advertisement', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }

    const newAdvertisement = new Advertisement({ name, email, phone, subject, message });
    await newAdvertisement.save();

    res.status(201).json({ message: 'Message stored successfully' });
  } catch (error) {
    console.error('Error saving contact:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get("/get-advertisers", async (req, res) => {
  try {
    const advertisers = await Advertisement.find();
    res.status(200).json(advertisers);
  } catch (error) {
    console.log(error); 
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;
