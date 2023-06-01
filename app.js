require('dotenv').config()
const express = require('express')
const bcrypt = require('bcrypt')
const mysql = require('mysql')
const crypto = require('crypto')
const app = express()
app.use(express.json())

app.listen(3000, () => {
  console.log('Server is running on port 3000')
})

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
})

db.connect((err) => {
  if (err){
    throw err
  } else {
    console.log('Connected')
  }
})


async function hashKaro(password) {
  const salt = await bcrypt.genSalt(10)
  const hash = await bcrypt.hash(password, salt)
  return [hash, salt]
}

async function matchKaro(password, salt, oldhash) {
  const newhash = await bcrypt.hash(password, salt)
  return oldhash==newhash
}

function authenticate(req,res,next) {
  const cookie = req.headers.cookie.slice(10);
  console.log("cookie: ", cookie)
  if (req.headers.cookie.includes("sessionID")){
    db.query(
      `SELECT id, sessionId, admin FROM users WHERE sessionId=${db.escape(cookie)}`, (err,result) =>{
        if (err) throw err;
        console.log("sessionID: ",result[0].sessionId)
        req.admin = result[0].admin
  
        if (cookie===result[0].sessionId){
          req.user = result[0].id;
          next();
        }
        else{
            res.status(403).send({ 'msg': 'Not Authenticated'});
        }
      }
    )
  }
  else {
    res.status(403).send({ 'msg': 'Not Authenticated'});
  }
}

app.post('/register', async (req, res) => {
  const username = req.body.username
  const password = req.body.password
  var [hash, salt] = await hashKaro(password)

  db.query(
    `SELECT * FROM users WHERE username = ${db.escape(username)}`,
    (err, result) => {
      if (result.length!=0){
        res.status(403).send({ msg: 'Username already exists' })
      }
      else {
        db.query(`INSERT INTO users (username, hash, salt, admin) VALUES (${db.escape(username)}, ${db.escape(hash)}, ${db.escape(salt)}, 0)`, (err, result) => {
          if (err) {
            console.error('error during user registration:', err)
          } else {
            console.log('user registered successfully')
            return res.status(200).json({ message: 'registration successful' })
          }
        })
      }
    }
  )

})

app.post('/login', (req, res) => {
  const username = req.body.username
  const password = req.body.password

  db.query(
    `SELECT * FROM users WHERE username = ${db.escape(username)}`,
    async (err, result) => {
      if (err) {
        console.error('Error during login:', err)
      }

      if (result.length === 0 || !(await matchKaro(password, result[0].salt, result[0].hash))) {
        return res.status(403).send({ msg: 'invalid username or password' })
      }

      const newSessionID = crypto.randomUUID()

      db.query(
        `UPDATE users SET sessionID = ${db.escape(newSessionID)} WHERE id = ${db.escape(result[0].id)}`,
        (err) => {
          if (err) {
            console.error(err)
          }

          res.cookie('sessionID', newSessionID, { httpOnly: true }).status(200).send({ msg: 'login successful' })
        }
      )
    }
  )
})

app.get('/books', (req, res) => {
  db.query('SELECT * FROM books', (err, results) => {
    if (err) throw err
    res.send(results)
  })
})

app.post('/request-checkout', authenticate, (req, res) => {
  const bookId = req.body.bookId
  const userId = req.body.userId

  db.query(
    `SELECT * from books WHERE id=${bookId}`, (err, results) => {
      if (err) throw err
      if (results.length == 0)  return res.send('Book does not exist')
      if (results[0].state != "available") return res.send('Book unavailable')

      db.query(
        `UPDATE books SET userId = ${userId}, state = \'requested\' WHERE id = ${bookId}`,(err, results) => {
          if (err) throw err
          res.send('Checkout request submitted')
        }
      )

    }
  )

})

app.post('/return-book', authenticate, (req, res) => {
  const bookId = req.body.bookId
  const userId = req.body.userId

  db.query(
    `SELECT * from books WHERE id=${bookId} AND userId=${userId} AND state=\'owned\'`, (err, results) => {
      if (err) throw err
      if (results.length == 0)  return res.send('book does not exist or is not owned by the user')

      db.query(
        `UPDATE books SET state = \'available\' WHERE id = ${bookId}`,(err, results) => {
          if (err) throw err
          res.send('Book returned')
        }
      )

    }
  )

})

app.post('/approve-checkout', authenticate, (req, res) => {
  const bookId = req.body.bookId
  db.query(
    `UPDATE books SET state = \'owned\' WHERE id = ${bookId}`, (err, results) => {
      if (err) throw err
      res.send('Checkout request approved')
    }
  )
})

app.post('/deny-checkout', authenticate, (req, res) => {
  const bookId = req.body.bookId
  db.query(
    `UPDATE books SET state = \'available\' WHERE id = ${bookId}`, (err, results) => {
      if (err) throw err
      res.send('Checkout request denied')
    }
  )
})