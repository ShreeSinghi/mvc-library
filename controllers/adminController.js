const express = require("express");
const router = express.Router();
const { authenticate, getDataAdmin,  getDataUser} = require('../middleware');
const db = require("../database");

  
router.post('/process-checkouts', authenticate, (req, res) => {
  
    const admin = req.body.admin
    var checkoutRequests = req.body
    delete checkoutRequests.admin
    delete checkoutRequests.userId
    console.log(req.body)
  
    if (!admin) {
      return res.status(403).send({ msg: 'Not authenticated' })
    }
  
    for (var requestId of Object.keys(checkoutRequests)) {
      (function (requestId){
        
      if (checkoutRequests[requestId] === 'approve') {
        db.query(`UPDATE requests SET state='owned' WHERE id = ${db.escape(requestId)}`, (err, results) => {
          if (err) throw err
          console.log(requestId, 'apprived')
        })
      } else {
        db.query(`DELETE FROM requests WHERE id = ${db.escape(requestId)}`, (err, results) => {
          if (err) throw err
          console.log(requestId, 'denied')
  
        })
      }
    })(requestId)
    }
  
    res.redirect('/home-admin')
  })

  
  
router.post('/add-book', authenticate, (req, res) => {
    const title = req.body.title
    const quantity = Number(req.body.quantity)
    console.log(req.body)
  
    db.query(`SELECT * FROM books WHERE title = ${db.escape(title)}`, (err, results) => {
      if (err) throw err
  
      if (results.length === 0) {
        db.query(`INSERT INTO books (title, quantity) VALUES (${db.escape(title)}, ${db.escape(quantity)})`, (err, result) => {
          if (err) throw err
          res.redirect('/home')
  
        })
      } else {
        db.query(`UPDATE books SET quantity = ${results[0].quantity + quantity} WHERE title = ${db.escape(title)}`, (err, result) => {
          if (err) throw err
          res.redirect('/home')
        })
        
      }
    })
  })

  
router.post('/process-admin-requests', authenticate, (req, res) => {
    const admin = req.body.admin
    delete req.body.admin
    delete req.body.userId
    console.log(req.body)
  
    if (!admin) return res.status(403).send({ msg: 'not authenticated' })
    for (var userId of Object.keys(req.body)) {
      (function (userId) {
        var action = req.body[userId]
        if (action == 'approve') {
          console.log('hello', userId, action)
          db.query(
            `SELECT * FROM users WHERE id = ${db.escape(userId)} AND requested = true`,
            (err, results) => {
              if (err) throw err
              console.log('chal nahi raha code', userId, action)
    
              if (results.length === 0) return res.status(404).send({ msg: 'request not found' })
    
              db.query(
                `UPDATE users SET admin = true, requested = false WHERE id = ${db.escape(userId)}`,
                (err, results) => {
                  if (err) throw err
                  console.log('andar aa gaye', userId, action)
                }
              )
            }
          )
        } else {
          db.query(`SELECT * FROM users WHERE id = ${db.escape(userId)} AND requested = true`,
            (err, results) => {
              if (err) throw err
    
              if (results.length === 0) return res.status(404).send({ msg: 'request not found' })
    
              db.query(
                `UPDATE users SET requested = false WHERE id = ${db.escape(userId)}`,
                (err) => {
                  if (err) throw err
                  console.log(`Admin request ${db.escape(userId)} denied`)
                }
              )
            }
          )
        }
      })(userId)
    }
    
  
    res.redirect('/home-admin')
  })
  
  module.exports = router;