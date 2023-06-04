const db = require("./database");

exports.authenticate = (req,res,next) => {
    const cookie = req.headers.cookie
    if (!cookie)  res.status(403).send({ 'msg': 'not authenticated'})
  
    const sessionId = cookie.slice(cookie.indexOf("sessionID=") + 10)
    if (req.headers.cookie.includes("sessionID")){
      db.query(`SELECT cookies.userId, cookies.sessionId, users.admin, users.username FROM cookies, users WHERE sessionId=${db.escape(sessionId)} AND users.id=cookies.userid`, (err,result) =>{
          if (err) throw err
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

  exports.getDataUser = (userId, checkoutStatus) => {
  return new Promise((resolve, reject) => {

    db.query('SELECT * FROM books', (err, booksresult) => {
      if (err) throw err
  
      db.query(`SELECT * FROM requests WHERE userId=${db.escape(userId)}`, (err, requestsresult) => {
        if (err) throw err
  
        db.query(`SELECT * FROM users WHERE id=${db.escape(userId)}`, (err, userresult) => {
          if (err) throw err
          ownedbooks = []
          requestsresult.forEach(request => {
            if (request.state=='owned' || request.state=='inrequested'){
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

exports.getDataAdmin = () => {
    return new Promise((resolve, reject) => {
      db.query(`SELECT * FROM requests WHERE state in ('outrequested', 'inrequested')`, (err, requestsResult) => {
        if (err) throw err
      
        db.query(`SELECT * FROM books`, (err, booksResult) => {
          if (err) throw err
      
          var outList = []
          var inList = []

          requestsResult.forEach((request) => {    
            const book = booksResult.find((book) => book.id === request.bookId)
      
            const title = book.title
            const requestWithBookTitle = { ...request, title }
            if (requestWithBookTitle.state == 'outrequested'){
              outList.push(requestWithBookTitle)
            } else {
              inList.push(requestWithBookTitle)
            }
          })
      
          db.query(`SELECT * FROM users WHERE requested = true`, (err, usersResult) => {
            if (err) throw err
      
            resolve({
              booksout: outList,
              booksin: inList,
              users: usersResult
            })
          })
        })
      })
    })
  }