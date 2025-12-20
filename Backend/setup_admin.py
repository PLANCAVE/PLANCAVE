#!/usr/bin/env python3
"""
STANDALONE ADMIN CREATION SCRIPT
Run this ONCE on Render to create your first admin account.
DO NOT import this into the main app.

To run on Render:
1. Go to your backend service dashboard
2. Under "Manual Deploy" or use a one-off command
3. Run: python Backend/setup_admin.py

OR set environment variables on Render:
- ADMIN_USERNAME=your_admin_username
- ADMIN_PASSWORD=your_secure_password

Then run: python Backend/setup_admin.py
"""

import os
import sys
from getpass import getpass

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from flask_bcrypt import Bcrypt
import psycopg
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
bcrypt = Bcrypt(app)

DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    print("❌ ERROR: DATABASE_URL environment variable not set!")
    sys.exit(1)

def create_admin_user():
    """Create an admin user in the database"""
    
    # Check if credentials are in environment variables
    username = os.getenv('ADMIN_USERNAME')
    password = os.getenv('ADMIN_PASSWORD')
    
    # If not in env, prompt for them
    if not username or not password:
        print("\n" + "="*60)
        print("  RAMANICAVE ADMIN SETUP")
        print("="*60)
        print("\nCreate your first admin account:\n")
        
        username = input("Enter admin username: ").strip()
        if not username:
            print("❌ Username cannot be empty!")
            sys.exit(1)
        
        password = getpass("Enter admin password: ")
        if not password:
            print("❌ Password cannot be empty!")
            sys.exit(1)
        
        confirm_password = getpass("Confirm password: ")
        if password != confirm_password:
            print("❌ Passwords do not match!")
            sys.exit(1)
    
    # Hash the password
    hashed_pw = bcrypt.generate_password_hash(password).decode('utf-8')
    
    # Connect to database and create admin
    try:
        conn = psycopg.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # First check if admin already exists
        cur.execute("SELECT id FROM users WHERE username = %s", (username,))
        existing = cur.fetchone()
        
        if existing:
            print(f"\n⚠️  User '{username}' already exists!")
            response = input("Do you want to update their role to admin? (yes/no): ").lower()
            if response == 'yes':
                cur.execute(
                    "UPDATE users SET role = 'admin', password = %s, is_active = TRUE WHERE username = %s",
                    (hashed_pw, username)
                )
                conn.commit()
                print(f"\n✅ User '{username}' updated to admin successfully!")
            else:
                print("\n❌ Operation cancelled.")
                sys.exit(0)
        else:
            # Create new admin user
            cur.execute(
                "INSERT INTO users (username, password, role, is_active) VALUES (%s, %s, 'admin', TRUE)",
                (username, hashed_pw)
            )
            conn.commit()
            print(f"\n✅ Admin user '{username}' created successfully!")
        
        print("\n" + "="*60)
        print("  SETUP COMPLETE!")
        print("="*60)
        print(f"\nYou can now login with:")
        print(f"  Username: {username}")
        print(f"  Password: (the password you just entered)")
        print("\n⚠️  IMPORTANT: Delete or secure this script after use!")
        print("="*60 + "\n")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"\n❌ Error creating admin user: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        sys.exit(1)

if __name__ == '__main__':
    create_admin_user()
