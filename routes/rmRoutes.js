const express = require('express')
const router= express.Router();
const adminController = require('../controllers/Auth')

router.post('/rm/signup', adminController.createRm)
router.get('/rm/login', adminController.rmLogin )
router.get('/rm/all-rms', adminController.getAllRms)
router.get('/rm/:id',  adminController.getSingleRm)
router.delete('/delete-rm/:id',  adminController.rmDelete);

module.exports =router  