const express = require('express')
const router= express.Router();
const adminController = require('../controllers/Auth')

router.post('/admin/signup', adminController.adminSignup)
router.get('/admin/login',adminController.adminLogin )

module.exports =router  