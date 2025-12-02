#!/usr/bin/env python3
"""Update admin username to an email"""
import os
import sys
from flask import Flask
from flask_bcrypt import Bcrypt
import psycopg

app = Flask(__name__)
bcrypt = Bcrypt(app)

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://plancave_user:bAttB6nAANjTFrCym9h2Q5XZBo0HbTMQ@dpg-d4n5v18gjchc73br4mmg-a.oregon-postgres.render.com/plancave')

# New admin credentials
admin_email = "admin@plancave.com"
password = "Admin@2024"

try:
    conn = psycopg.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()
    
    # Check if admin exists
    cur.execute("SELECT id FROM users WHERE username = 'admin'")
    admin = cur.fetchone()
    
    if admin:
        # Update existing admin
        hashed_pw = bcrypt.generate_password_hash(password).decode('utf-8')
        cur.execute(
            "UPDATE users SET username = %s, password = %s, role = 'admin', is_active = TRUE WHERE username = 'admin'",
            (admin_email, hashed_pw)
        )
        print(f"✅ Admin username updated to: {admin_email}")
    else:
        # Create new admin if doesn't exist
        hashed_pw = bcrypt.generate_password_hash(password).decode('utf-8')
        cur.execute(
            "INSERT INTO users (username, password, role, is_active) VALUES (%s, %s, 'admin', TRUE)",
            (admin_email, hashed_pw)
        )
        print(f"✅ New admin created with email: {admin_email}")
    
    print(f"\n🔑 Login with:")
    print(f"Email: {admin_email}")
    print(f"Password: {password}")
    print("\n⚠️ CHANGE THIS PASSWORD AFTER FIRST LOGIN!")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
