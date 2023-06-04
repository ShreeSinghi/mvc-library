const express = require('express')

const bodyParser = require('body-parser')
const path = require('path')
const request = require('request')

const db = require("./database.js");

const  adminController  = require('./controllers/adminController');
const  userController  = require('./controllers/userController');
const  loginController  = require('./controllers/loginController');
const  registerController  = require('./controllers/registerController');
const  homeController  = require('./controllers/homeController');

const app = express()

app.use(express.json())
app.use(bodyParser())
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
app.use(express.static(path.join(__dirname, 'public')))

app.use(homeController)
app.use(loginController)
app.use(registerController)
app.use(userController)
app.use(adminController)

app.listen(3000, () => {
  console.log('Server is running on port 3000')
})


db.connect((err) => {
  if (err){
    throw err
  } else {
    console.log('Connected')
  }
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