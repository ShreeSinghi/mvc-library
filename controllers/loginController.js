const bcrypt = require('bcrypt')
const crypto = require('crypto')
const express = require("express");
const router = express.Router();
const db = require("../database");

async function matchKaro(password, salt, oldhash) {
    const newhash = await bcrypt.hash(password, salt)
    return oldhash==newhash
  }
  

router.get('/login', (req, res) => {
    res.render('login', {error:''})
  })

  router.post('/login', (req, res) => {
    const username = req.body.username
    const password = req.body.password

    db.query(
        `SELECT * FROM users WHERE username = ${db.escape(username)}`, async (err, result) => {
        if (err) return console.error('Error during login:', err)


        if (result.length === 0 || !(await matchKaro(password, result[0].salt, result[0].hash))) {
            return res.render('login', { error: 'invalid username or password' })
            
        }

        const newSessionId = crypto.randomUUID()

        db.query(
            `UPDATE cookies SET sessionId = ${db.escape(newSessionId)} WHERE id = ${db.escape(result[0].id)}`,
            (err, results) => {
            if (err) return console.error(err)

            res.cookie('sessionID', newSessionId, { httpOnly: true }).redirect('home')
            }
        )
        }
    )
})

module.exports = router;
