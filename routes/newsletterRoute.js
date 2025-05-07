const express = require('express');
const router = express.Router();
const Newsletter = require('../models/Newsletter');

router.post('/newsletter', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required.' });
    }

    const newNewsletter = new Newsletter({ email });
    await newNewsletter.save();

    res.status(201).json({ message: 'Message stored successfully' });
  } catch (error) {
    console.error('Error saving contact:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get("/get-newsletter", async (req, res) => {
  try {
    const newsletter = await Newsletter.find();
    res.status(200).json(newsletter);
  } catch (error) {
    console.log(error); 
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;
