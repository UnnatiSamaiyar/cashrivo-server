const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Coupon code is required'],
    trim: true,
    unique: true,
  },
  campaign_ids: {
    type: [Number],
    default: [],
    validate: {
      validator: arr => arr.every(id => typeof id === 'number'),
      message: 'All campaign_ids must be numbers',
    },
  },
  campaigns: {
    type: [String],
    default: [],
    validate: {
      validator: arr => arr.every(name => typeof name === 'string'),
      message: 'All campaign names must be strings',
    },
  },
  startDate: {
    type: Date,
    default: null, // Optional now
  },
  endDate: {
    type: Date,
    default: null, // Optional now
    validate: {
      validator: function (val) {
        return !this.startDate || !val || val >= this.startDate;
      },
      message: 'End date must be greater than or equal to start date',
    },
  },
  type: {
    type: String,
    required: [true, 'Coupon type is required'],
    trim: true,
    enum: ['percentage', 'flat', 'freebie', 'other', 'generic'],
  },
  status: {
    type: String,
    default: 'active',
    enum: ['active', 'inactive', 'expired', 'rejected', 'future'],
  },
  app_rej_by: {
    type: String,
    default: null,
    trim: true,
  },
  rej_reason: {
    type: String,
    default: null,
    trim: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  // Add this inside the couponSchema definition
company_logo: {
  type: String,
  default: '',
  trim: true,
},
offer_image: {
  type: String,
  default: '',
  trim: true,
},

}, {
  timestamps: true,
});

module.exports = mongoose.model('CSVCoupon', couponSchema);
