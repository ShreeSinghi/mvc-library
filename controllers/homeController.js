const express = require("express");
const router = express.Router();
const { authenticate, getDataAdmin,  getDataUser} = require('../middleware');

router.get('/home', authenticate, async (req, res) => {
    const userId = req.body.userId
    if (req.body.admin){
      res.render('home-admin', await getDataAdmin())
    } else {
      res.render('home', await getDataUser(userId, ''))
    }
  })
  
  module.exports = router;