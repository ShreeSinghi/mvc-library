/*had to drop requests table first because it had foreign keys
and other tables cant be deleted without deleting it first*/

DROP TABLE IF EXISTS cookies;
DROP TABLE IF EXISTS requests;
DROP TABLE IF EXISTS books;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  `hash` VARCHAR(255) NOT NULL,
  salt VARCHAR(255) NOT NULL,
  `admin` INT(1) NOT NULL,
  sessionID VARCHAR(255)
);

CREATE TABLE books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL
);

CREATE TABLE requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bookId INT NOT NULL,
  userId INT NOT NULL,
  `status` ENUM('pending', 'approved', 'denied') DEFAULT 'pending',
  FOREIGN KEY (bookId) REFERENCES books(id),
  FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE TABLE cookies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userid INT NOT NULL,
  sessionid VARCHAR(255) NOT NULL,
  FOREIGN KEY (userid) REFERENCES users(id)
);
