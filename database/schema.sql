CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  reg_no VARCHAR(30) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('STUDENT', 'ADMIN') DEFAULT 'STUDENT',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE items (
  item_id INT AUTO_INCREMENT PRIMARY KEY,
  reporter_id INT NOT NULL,
  report_type ENUM('LOST', 'FOUND') NOT NULL,
  title VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL,
  public_description TEXT NOT NULL,
  private_details TEXT NULL,
  campus_location VARCHAR(100) NOT NULL,
  incident_date DATE NOT NULL,
  image_url VARCHAR(255) NULL,
  status ENUM('OPEN', 'CLAIM_APPROVED', 'RETURNED') DEFAULT 'OPEN',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporter_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE claims (
  claim_id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  claimant_id INT NOT NULL,
  evidence_text TEXT NOT NULL,
  status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
  admin_reason TEXT NULL,
  reviewed_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE,
  FOREIGN KEY (claimant_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
);
