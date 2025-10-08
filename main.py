import os
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/*": {
    "origins": "*",
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"],
    "supports_credentials": True
}})

app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key")
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL")
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}

from models import db, User, UserState, UserToken

db.init_app(app)

with app.app_context():
    db.create_all()

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"}), 200

@app.route('/api/user', methods=['POST'])
def create_or_update_user():
    try:
        data = request.json
        user_id = data.get('user_id')
        email = data.get('email')
        name = data.get('name')
        picture = data.get('picture')
        
        if not user_id or not email:
            return jsonify({"error": "user_id and email are required"}), 400
        
        user = User.query.get(user_id)
        if not user:
            user = User(id=user_id, email=email, name=name, picture=picture)
            db.session.add(user)
        else:
            user.email = email
            user.name = name
            user.picture = picture
        
        db.session.commit()
        return jsonify({"message": "User created/updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/state/<user_id>', methods=['GET'])
def get_state(user_id):
    try:
        state = UserState.query.filter_by(user_id=user_id).first()
        if not state:
            return jsonify({"state": {}}), 200
        return jsonify({"state": state.state_data}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/state/<user_id>', methods=['POST'])
def save_state(user_id):
    try:
        data = request.json
        state_data = data.get('state', {})
        
        state = UserState.query.filter_by(user_id=user_id).first()
        if not state:
            state = UserState(user_id=user_id, state_data=state_data)
            db.session.add(state)
        else:
            state.state_data = state_data
        
        db.session.commit()
        return jsonify({"message": "State saved successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/tokens/<user_id>/<token_type>', methods=['GET'])
def get_token(user_id, token_type):
    try:
        token = UserToken.query.filter_by(user_id=user_id, token_type=token_type).first()
        if not token:
            return jsonify({"token": None}), 200
        return jsonify({"token": token.get_token()}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/tokens/<user_id>/<token_type>', methods=['POST'])
def save_token(user_id, token_type):
    try:
        data = request.json
        token_value = data.get('token')
        
        if not token_value:
            return jsonify({"error": "token is required"}), 400
        
        token = UserToken.query.filter_by(user_id=user_id, token_type=token_type).first()
        if not token:
            token = UserToken(user_id=user_id, token_type=token_type)
            db.session.add(token)
        
        token.set_token(token_value)
        db.session.commit()
        return jsonify({"message": "Token saved successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/tokens/<user_id>/<token_type>', methods=['DELETE'])
def delete_token(user_id, token_type):
    try:
        token = UserToken.query.filter_by(user_id=user_id, token_type=token_type).first()
        if token:
            db.session.delete(token)
            db.session.commit()
        return jsonify({"message": "Token deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=True)
