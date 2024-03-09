
## Setup
- Run `git clone https://github.com/ShreeSinghi/backend-assignment` and `cd backend-assignment` on your shell
- Then run `npm install` 
- Create `.env` file with credentials for your MySQL as follows

```
DB_HOST="0.0.0.0"

DB_USER="your_username"

DB_PASSWORD="your_password"

DB_NAME="library"
```

## How to run the server
- If the code is being run for the first time or the database needs to be refreshed open MySQL in the directory and run `source ./create.sql`
- By default an admin will be created with credentials
	- username: admin
	- password: admin
- To run the server `npm start`

