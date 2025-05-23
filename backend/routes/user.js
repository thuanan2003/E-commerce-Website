const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'uploads/profile');
  },
  filename: function(req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 5 }, // 5MB limit
  fileFilter: function(req, file, cb) {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Chỉ chấp nhận file .png, .jpg và .jpeg!'));
  }
});

// Get user account info
router.get('/account', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
});

// Update user account
router.put('/account', auth, async (req, res) => {
  try {
    const { fullname, phone, addresses } = req.body;
    
    // Get user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    // Update basic info
    if (fullname) user.fullname = fullname;
    if (phone) user.phone = phone;
    
    // Update addresses if provided
    if (addresses) {
      // Ensure addresses is an array
      if (!Array.isArray(addresses)) {
        return res.status(400).json({ message: 'Địa chỉ phải là một mảng' });
      }

      // Convert addresses to the correct format
      user.addresses = addresses.map(addr => {
        if (typeof addr === 'string') {
          return {
            address: addr,
            isDefault: false
          };
        }
        return {
          address: addr.address || addr,
          isDefault: Boolean(addr.isDefault)
        };
      });

      // Ensure at least one address is default
      const hasDefault = user.addresses.some(addr => addr.isDefault);
      if (user.addresses.length > 0 && !hasDefault) {
        user.addresses[0].isDefault = true;
      }
    }

    await user.save();

    // Return user without password
    const updatedUser = await User.findById(user.id).select('-password');
    res.json({ user: updatedUser, message: 'Cập nhật thông tin thành công' });
  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
});

// Upload profile image
router.post('/account/image', auth, upload.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng tải lên một ảnh' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    // Remove old profile image if exists
    if (user.profileImage) {
      const oldImagePath = path.join(__dirname, '..', user.profileImage);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    user.profileImage = `/uploads/profile/${req.file.filename}`;
    await user.save();

    res.json({
      message: 'Cập nhật ảnh đại diện thành công',
      profileImage: user.profileImage
    });
  } catch (error) {
    console.error('Upload profile image error:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
});

module.exports = router; 