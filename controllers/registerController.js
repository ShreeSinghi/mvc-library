const bcrypt = require('bcrypt')
const crypto = require('crypto')
const db = require("../database");

const express = require("express");
const router = express.Router();

async function hashKaro(password) {
    const salt = await bcrypt.genSalt(10)
    const hash = await bcrypt.hash(password, salt)
    return [hash, salt]
  }
  
  
  router.get('/register', (req, res) => {
    res.render('register', {error:''})
  })
    
router.post('/register', async (req, res) => {
    const username = req.body.username
    const password = req.body.password
    var userId
    var [hash, salt] = await hashKaro(password)
    if (username.length==0 || password.length==0){
      res.status(403).send({ msg: 'empty string' })
    }
  
    db.query(`SELECT * FROM users WHERE username = ${db.escape(username)}`, (err, result) => {
        if (result.length!=0) return res.render('register', {error: 'user already exists'})
  
        db.query(`INSERT INTO users (username, hash, salt, admin) VALUES (${db.escape(username)}, ${db.escape(hash)}, ${db.escape(salt)}, 0)`, (err, result) => {
          if (err) console.error('error during user registration:', err)
        })
  
        db.query(`SELECT id from users WHERE username=${db.escape(username)}`, (err, result) => {
          if (err) return console.error('error during user registration:', err)
          userId = result[0].id
          db.query(`INSERT INTO cookies (userId) VALUES (${db.escape(userId)})`, (err, result) => {
            if (err) return console.error('error during user registration:', err)
    
            console.log('user registered successfully')
            return res.redirect('/login')
          })
        })
      }
    )
  
  })
  

  module.exports = router;