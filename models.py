import os
from main import db
from datetime import datetime
from cryptography.fernet import Fernet

encryption_key = os.environ.get("SESSION_SECRET", Fernet.generate_key().decode()).encode()[:32]
cipher = Fernet(encryption_key.ljust(44, b'='))

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.String(255), primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    name = db.Column(db.String(255))
    picture = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    state = db.relationship('UserState', backref='user', uselist=False, cascade='all, delete-orphan')
    tokens = db.relationship('UserToken', backref='user', cascade='all, delete-orphan')

class UserState(db.Model):
    __tablename__ = 'user_state'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(255), db.ForeignKey('users.id'), unique=True, nullable=False)
    state_data = db.Column(db.JSON, nullable=False, default={})
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class UserToken(db.Model):
    __tablename__ = 'user_tokens'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(255), db.ForeignKey('users.id'), nullable=False)
    token_type = db.Column(db.String(50), nullable=False)
    token_value = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def set_token(self, value):
        self.token_value = cipher.encrypt(value.encode()).decode()
    
    def get_token(self):
        try:
            return cipher.decrypt(self.token_value.encode()).decode()
        except:
            return None
