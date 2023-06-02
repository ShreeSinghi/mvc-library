require('dotenv').config()
const express = require('express')
const bcrypt = require('bcrypt')
const mysql = require('mysql')
const crypto = require('crypto')
const app = express()
const request = require('request');

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
  req.adminAuth = 0;
  const sessionId = req.headers.cookie.slice(10);
  if (req.headers.cookie.includes("sessionID")){
    db.query(
      `SELECT cookies.userId, cookies.sessionId, users.admin FROM cookies, users WHERE sessionId=${db.escape(sessionId)} AND users.id=cookies.userid;`, (err,result) =>{
        if (err) throw err;
        req.body.admin = result[0].admin;

        if (sessionId===result[0].sessionId){
          req.body.userId = result[0].userId;
          next();
        } else {
            console.log("cookie: ", sessionId)
            res.status(403).send({ 'msg': 'Not authenticated'});
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
  var userId;
  var [hash, salt] = await hashKaro(password)

  db.query(`SELECT * FROM users WHERE username = ${db.escape(username)}`, (err, result) => {
      if (result.length!=0) return res.status(403).send({ msg: 'Username already exists' })

      db.query(`INSERT INTO users (username, hash, salt, admin) VALUES (${db.escape(username)}, ${db.escape(hash)}, ${db.escape(salt)}, 0)`, (err, result) => {
        if (err) console.error('error during user registration:', err)
      })

      db.query(`SELECT id from users WHERE username=${db.escape(username)}`, (err, result) => {
        if (err) return console.error('error during user registration:', err)
        userId = result[0].id;
        db.query(`INSERT INTO cookies (userId) VALUES (${userId})`, (err, result) => {
          if (err) return console.error('error during user registration:', err)
  
          console.log('user registered successfully')
          return res.status(200).json({ message: 'registration successful' })
        })
      })
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

      const newSessionId = crypto.randomUUID()

      db.query(
        `UPDATE cookies SET sessionId = ${db.escape(newSessionId)} WHERE id = ${db.escape(result[0].id)}`,
        (err) => {
          if (err) {
            console.error(err)
          }

          res.cookie('sessionID', newSessionId, { httpOnly: true }).status(200).send({ msg: 'login successful' })
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
  const bookId = req.body.bookId;
  const userId = req.body.userId;

  db.query(`SELECT * FROM books WHERE id=${bookId}`, (err, results) => {
    if (err) throw err;
    if (results.length === 0) return res.send('Book does not exist');
    if (results[0].quantity === 0) return res.send('Book is out of stock');

    db.query(
      `SELECT * FROM requests WHERE bookId=${bookId} AND userId=${userId} AND state='requested'`,
      (err, results) => {
        if (err) throw err;
        if (results.length > 0) return res.send('You have already requested this book');

        db.query(
          `INSERT INTO requests (bookId, userId, state) VALUES (${bookId}, ${userId}, 'requested')`,
          (err, results) => {
            if (err) throw err;
            res.send('Checkout request submitted');
          }
        );
        db.query(`UPDATE books SET quantity = quantity - 1 WHERE id = ${bookId}`,
        (err, results) => {
          if (err) throw err;
        }
      );
      }
    );
  });
});

app.post('/return-book', authenticate, (req, res) => {
  const bookId = req.body.bookId;
  const userId = req.body.userId;

  db.query(
    `SELECT * FROM requests WHERE bookId=${bookId} AND userId=${userId} AND state='owned'`,
    (err, results) => {
      if (err) throw err;

      console.log(results)

      if (results.length === 0) {
        return res.send('Book does not exist or is not owned by the user');
      }

      const requestId = results[0].id;

      db.query(`DELETE FROM requests WHERE id=${requestId}`, (err, results) => {
          if (err) throw err;

          db.query(
            `UPDATE books SET quantity = quantity + 1 WHERE id=${bookId}`,
            (err, results) => {
              if (err) throw err;

              res.send('Book returned');
            }
          );
        }
      );
    }
  );
});

app.post('/approve-checkout', authenticate, (req, res) => {
  const requestIds = req.body.requestIds;
  const admin = req.body.admin;

  if (!admin) return res.status(403).send({ msg: 'Not authenticated' });
  console.log(`UPDATE requests SET state='owned' WHERE id IN (${requestIds.join(',')})`)
  db.query(
    `UPDATE requests SET state='owned' WHERE id IN (${requestIds.join(',')})`,
    (err, results) => {
      if (err) throw err;
      if (results.length > 0) return res.send('Checkout approved')
      return res.send('Request does not exist');
    }
  );
});


app.post('/deny-checkout', authenticate, (req, res) => {
  const requestIds = req.body.requestIds;
  const admin = req.body.admin;

  if (!admin) return res.status(403).send({ msg: 'Not authenticated' });


  db.query(
    `UPDATE requests SET state='denied' WHERE id IN (${requestIds.join(',')})`,
    (err, results) => {
      if (err) throw err;

      db.query(
        `UPDATE books SET quantity = quantity + 1 WHERE id IN (SELECT bookId FROM requests WHERE id IN (${requestIds.join(',')}))`,
        (err, results) => {
          if (err) throw err;

          res.send('Checkout request denied');
        }
      );
    }
  );
});

app.post('/request-admin', authenticate, (req, res) => {
  const userId = req.body.userId;

  if (req.body.admin) return res.status(403).send({ msg: 'User is already an admin' })

  db.query(
    `UPDATE users SET requested = true WHERE id = ${userId}`,
    (err, results) => {
      if (err) throw err;
      res.send('Admin request submitted');
    }
  );
});

app.post('/approve-admin', authenticate, (req, res) => {
  const admin = req.body.admin
  const approvalUserId = req.body.approvalUserId

  if (!admin) return res.status(403).send({ msg: 'Not authenticated' })

  db.query(
    `SELECT * FROM users WHERE id = ${approvalUserId} AND requested = true`, (err, results) => {
      if (err) throw err;

      if (results.length === 0) return res.status(404).send({ msg: 'Admin request not found' })

    
      db.query(
        `UPDATE users SET admin = true, requested = false WHERE id = ${approvalUserId}`,
        (err, results) => {
          if (err) throw err;
          res.send('Admin request approved')
        }
      );
    }
  );
});

app.post('/deny-admin', authenticate, (req, res) => {
  const denialUserId = req.body.denialUserId;
  const admin = req.body.admin;

  if (!admin) return res.status(403).send({ msg: 'Not authenticated' })

  db.query(
    `SELECT * FROM users WHERE id = ${denialUserId} AND requested = true`,
    (err, results) => {
      if (err) throw err;

      if (results.length === 0) return res.status(404).send({ msg: 'Admin request not found' })

      db.query(
        `UPDATE users SET requested = false WHERE id = ${denialUserId}`,
        (err, results) => {
          if (err) throw err;
          res.send('Admin request denied');
        }
      );
    }
  );
});

db.query(`SELECT * FROM users WHERE username = 'admin' AND admin = true;`, (err, results) => {
  if (results.length!=0) return;

  request.post(
      'http://localhost:3000/register',
      { json: { username: 'admin', password:'admin'} },
      () => {
        db.query(
          `UPDATE users SET admin = true WHERE username = \'admin\'`,
          (err, results) => {
            if (err) throw err;
          }
        );
      }
  );


})

db.query(`SELECT * FROM users WHERE username = \'shree\';`, (err, results) => {
  if (results.length!=0) return;

  request.post(
      'http://localhost:3000/register',
      { json: { username: 'shree', password:'aloo'} },
      () => {}
  );

})