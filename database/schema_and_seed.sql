CREATE DATABASE IF NOT EXISTS ucu_lost_found;
 USE ucu_lost_found;
 
 -- 1. Users Table
  CREATE TABLE users(
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        reg_no VARCHAR(30) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('STUDENT', 'ADMIN') DEFAULT 'STUDENT',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 );
 
 -- 2. Items Table
 CREATE TABLE items (    item_id INT AUTO_INCREMENT PRIMARY KEY,
      reporter_id INT NOT NULL,
      report_type ENUM('LOST', 'FOUND') NOT NULL,
      title VARCHAR(150) NOT NULL,
      category VARCHAR(50) NOT NULL,
      public_description TEXT NOT NULL,
      private_details TEXT NULL,-- Hidden from public responses 
      campus_location VARCHAR(100) NOT NULL,
      incident_date DATE NOT NULL,
      image_url VARCHAR(255) NULL,    
      status ENUM('OPEN', 'CLAIM_APPROVED', 'RETURNED') DEFAULT 'OPEN',    
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,    
      FOREIGN KEY (reporter_id) REFERENCES users(user_id) ON DELETE CASCADE 
);

-- 3. Claims Table
CREATE TABLE claims (
 claim_id INT AUTO_INCREMENT PRIMARY KEY,
 item_id INT NOT NULL,
 claimant_id INT NOT NULL,
 evidence_text TEXT NOT NULL, -- Visible only to claimant & admin
 status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
 admin_reason TEXT NULL,
 reviewed_by INT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE,
 FOREIGN KEY (claimant_id) REFERENCES users(user_id) ON DELETE CASCADE,
 FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
);
-- Fictional sample data
INSERT INTO users (full_name, reg_no, email, password_hash, role) VALUES
('Admin Officer', 'STAFF/001', 'admin@ucu.ac.ug', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
'ADMIN'),
('Okello David', 'S25D14/101', 'okello@students.ucu.ac.ug', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'STUDENT'),
('Namusoke Grace', 'S25D14/102', 'namusoke@students.ucu.ac.ug', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'STUDENT');
INSERT INTO items (reporter_id, report_type, title, category, public_description, private_details,
campus_location, incident_date, status) VALUES
(3, 'FOUND', 'Set of Room Keys with Blue Keyring', 'Keys', 'Found beneath a chair after Health and Wholeness lecture.',
'Has silver inscription "ROOM 14B" on back of keyring and 3 brass keys.', 'N5B Lecture Room', '2026-11-15', 'OPEN'),
(2, 'LOST', 'HP Laptop Charger 65W', 'Electronics', 'Black HP blue-tip charger left on study table.',
'Has white masking tape with initials O.D near plug.', 'Hamu Mukasa Library', '2026-11-16', 'OPEN');
