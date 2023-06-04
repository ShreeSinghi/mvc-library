require('dotenv').config()
const express = require('express')
const bcrypt = require('bcrypt')
const mysql = require('mysql')
const crypto = require('crypto')
const bodyParser = require('body-parser')
const path = require('path')
const request = require('request')

const app = express()


app.use(express.json())
app.use(bodyParser())
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
app.use(express.static(path.join(__dirname, 'public')))

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
  const cookie = req.headers.cookie
  if (!cookie)  res.status(403).send({ 'msg': 'not authenticated'})

  const sessionId = cookie.slice(cookie.indexOf("sessionID=") + 10)
  if (req.headers.cookie.includes("sessionID")){
    db.query(
      `SELECT cookies.userId, cookies.sessionId, users.admin, users.username FROM cookies, users WHERE sessionId=${db.escape(sessionId)} AND users.id=cookies.userid`, (err,result) =>{
        if (err) throw err
        console.log(result)
        if (result.length && sessionId===result[0].sessionId){
          req.body.admin = result[0].admin
          req.body.userId = result[0].userId
          console.log(result[0].username, result[0].admin)
          next()
        } else {
            console.log("cookie: ", sessionId)
            res.status(403).send({ 'msg': 'not authenticated'})
        }
      }
    )
  }
  else {
    res.status(403).send({ 'msg': 'not authenticated'})
  }
}

function getDataUser(userId, checkoutStatus){
  return new Promise((resolve, reject) => {

    db.query('SELECT * FROM books', (err, booksresult) => {
      if (err) throw err
  
      db.query(`SELECT * FROM requests WHERE userId=${db.escape(userId)}`, (err, requestsresult) => {
        if (err) throw err
  
        db.query(`SELECT * FROM users WHERE id=${db.escape(userId)}`, (err, userresult) => {
          if (err) throw err
          ownedbooks = []
          requestsresult.forEach(request => {
            if (request.state=='owned'){
              ownedbooks.push(booksresult.find(book => book.id === request.bookId))
            }
          })
          
          resolve({
            books: booksresult,
            isadminrequested: userresult[0].requested,
            ownedbooks: ownedbooks,
            checkoutStatus: checkoutStatus
          })
        })
      })
    })
  })
}

function getDataAdmin(){
  return new Promise((resolve, reject) => {
    db.query(`SELECT * FROM requests WHERE state = 'requested'`, (err, requestsResult) => {
      if (err) throw err
    
      db.query(`SELECT * FROM books`, (err, booksResult) => {
        if (err) throw err
    
        var requestList = []
    
        requestsResult.forEach((request) => {    
          const book = booksResult.find((book) => book.id === request.bookId)
    
          const title = book.title
          const requestWithBookTitle = { ...request, title }
          requestList.push(requestWithBookTitle)
        })
    
        db.query(`SELECT * FROM users WHERE requested = true`, (err, usersResult) => {
          if (err) throw err
    
          resolve({
            books: requestList,
            users: usersResult,
          })
        })
      })
    })
  })
}

app.get('/register', (req, res) => {
  res.render('register', {error:''})
})

app.get('/login', (req, res) => {
  res.render('login', {error:''})
})


app.get('/home', authenticate, async (req, res) => {
  const userId = req.body.userId
  if (req.body.admin){
    res.render('home-admin', await getDataAdmin())
  } else {
    res.render('home', await getDataUser(userId, ''))
  }
})

app.post('/register', async (req, res) => {
  const username = req.body.username
  const password = req.body.password
  var userId
  var [hash, salt] = await hashKaro(password)
  var message = ''
  var error = ''

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

app.post('/login', (req, res) => {
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

app.post('/add-book', authenticate, (req, res) => {
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

app.post('/request-checkout', authenticate, (req, res) => {
  const bookId = req.body.bookId
  const userId = req.body.userId

  db.query(`SELECT * FROM books WHERE id=${bookId}`, async (err, results) => {
    if (err) throw err
    if (results.length === 0) return res.send(await getDataUser(userId, 'Book does not exist'))
    if (results[0].quantity === 0) return res.send(await getDataUser(userId, 'Book is out of stock'))

    db.query(`SELECT * FROM requests WHERE bookId=${bookId} AND userId=${userId} AND state='requested'`,
      async (err, results) => {
        if (err) throw err
        if (results.length > 0) return res.send(await getDataUser(userId, 'You have already requested this book'))

        db.query(`INSERT INTO requests (bookId, userId, state) VALUES (${bookId}, ${userId}, 'requested')`,
        async (err, results) => {
            if (err) throw err
            res.send(await getDataUser(userId, 'Checkout request submitted'))
          }
        )

        db.query(`UPDATE books SET quantity = quantity - 1 WHERE id = ${bookId}`, (err, results) => {
          if (err) throw err
        })
      }
    )
  })
})

app.post('/return-book', authenticate, (req, res) => {
  const bookId = req.body.bookId
  const userId = req.body.userId

  db.query(`SELECT * FROM requests WHERE bookId=${bookId} AND userId=${userId} AND state='owned'`, (err, results) => {
      if (err) throw err

      console.log(results)

      if (results.length === 0) {
        console.log('boook does not exist or is not owned by the user')
        return res.redirect('home')

      }

      const requestId = results[0].id

      db.query(`DELETE FROM requests WHERE id=${requestId}`, (err) => {
          if (err) throw err

          db.query(
            `UPDATE books SET quantity = quantity + 1 WHERE id=${bookId}`, (err) => {
              if (err) throw err
              console.log('bbook returned')
              return res.redirect('home')
            }
          )
        }
      )
    }
  )
})

app.post('/process-checkouts', authenticate, (req, res) => {
  
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

app.post('/request-admin', authenticate, (req, res) => {
  const userId = req.body.userId

  if (req.body.admin) return res.status(403).send({ msg: 'User is already an admin' })

  db.query(`UPDATE users SET requested = true WHERE id = ${db.escape(userId)}`,
    (err, results) => {
      if (err) throw err
      console.log('hii')
      res.send(getDataUser(userId, ''))
    }
  )
})

app.post('/process-admin-requests', authenticate, (req, res) => {
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


db.query(`SELECT * FROM users WHERE username = 'admin' AND admin = true`, (err, results) => {
  if (results.length!=0) return

  request.post(
      'http://localhost:3000/register',
      { json: { username: 'admin', password:'admin'} },
      () => {
        db.query(
          `UPDATE users SET admin = true WHERE username = \'admin\'`, (err, results) => {
            if (err) throw err
          }
        )
      }
  )


})

db.query(`SELECT * FROM users WHERE username = 'shree'`, (err, results) => {
  if (results.length!=0) return

  request.post(
      'http://localhost:3000/register',
      { json: { username: 'shree', password:'aloo'} },
      () => {}
  )

})