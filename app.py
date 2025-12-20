# app.py - Flask backend for rep counter + calorie predictor
from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from flask_cors import CORS
import cv2
import numpy as np
import mediapipe as mp
import pickle
import pandas as pd
import math
import base64
from io import BytesIO
import os
import json
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = os.environ.get('APP_SECRET', 'dev-secret')
CORS(app)

# -----------------------------------------
# LOAD CALORIE MODEL
# -----------------------------------------
with open("calorie_model.pkl", "rb") as f:
    calorie_model = pickle.load(f)

# -----------------------------------------
# MEDIAPIPE SETUP
# -----------------------------------------
mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils

# Global variables for rep counting
pose_state = {}

def calc_angle(a, b, c):
    """Calculate angle between three points."""
    ax, ay = a.x, a.y
    bx, by = b.x, b.y
    cx, cy = c.x, c.y
    
    ang = math.degrees(math.atan2(cy - by, cx - bx) -
                       math.atan2(ay - by, ax - bx))
    return ang + 360 if ang < 0 else ang

def estimate_calories(age, weight, gender, exercise, reps):
    """Predict calories burned using the trained model."""
    if reps <= 0:
        return 0.0
    user = pd.DataFrame({
        'age': [age],
        'weight': [weight],
        'gender': [gender],
        'reps': [reps],
        'exercise': [exercise]
    })
    return float(calorie_model.predict(user)[0])

# -----------------------------------------
# ROUTES
# -----------------------------------------

USERS_FILE = 'users.json'

def load_users():
    if not os.path.exists(USERS_FILE):
        return {}
    with open(USERS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_users(users):
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, indent=2)


def login_required(f):
    from functools import wraps

    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user' not in session:
            return redirect(url_for('login', next=request.path))
        return f(*args, **kwargs)

    return decorated


@app.route('/')
def home():
    """Serve the home page with two big buttons."""
    user = session.get('user')
    return render_template('home.html', user=user)


@app.route('/tracker')
def tracker():
    # tracker page (index.html) - authentication handled client-side via Firebase
    return render_template('index.html')


@app.route('/placeholder')
def placeholder():
    return render_template('placeholder.html')


@app.route('/profile')
def profile():
    return render_template('profile.html')


@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')


@app.route('/admin')
def admin():
    return render_template('admin.html')


@app.route('/tips')
def tips():
    return render_template('tips.html')


@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        data = request.form
        username = data.get('username')
        password = data.get('password')
        if not username or not password:
            return render_template('signup.html', error='Missing username or password')

        users = load_users()
        if username in users:
            return render_template('signup.html', error='User already exists')

        users[username] = {'password': generate_password_hash(password)}
        save_users(users)
        session['user'] = username
        return redirect(url_for('home'))

    return render_template('signup.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.form
        username = data.get('username')
        password = data.get('password')
        users = load_users()
        user = users.get(username)
        if not user or not check_password_hash(user['password'], password):
            return render_template('login.html', error='Invalid credentials')
        session['user'] = username
        next_url = request.args.get('next') or url_for('home')
        return redirect(next_url)

    return render_template('login.html')


@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect(url_for('home'))

@app.route('/api/process_frame', methods=['POST'])
def process_frame():
    """
    Process a single frame and detect pose/count reps.
    Expects JSON with:
    - image: base64 encoded JPEG image
    - age, weight, gender: user info
    - exercise: "bicep_curl" or "lateral_raise"
    """
    try:
        data = request.json

        def _to_int(value, default):
            try:
                if value is None:
                    return default
                if isinstance(value, str) and value.strip() == '':
                    return default
                return int(value)
            except Exception:
                return default
        
        # Decode base64 image
        image_data = base64.b64decode(data['image'].split(',')[1])
        nparr = np.frombuffer(image_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Extract user info (may be auto-filled from Firestore profile)
        age = _to_int(data.get('age'), 25)
        weight = _to_int(data.get('weight'), 70)
        gender = _to_int(data.get('gender'), 1)
        exercise = data['exercise']
        
        # Initialize state if needed
        session_id = data.get('session_id', 'default')
        if session_id not in pose_state:
            pose_state[session_id] = {'reps': 0, 'stage': None}
        
        state = pose_state[session_id]
        
        # Process frame with Mediapipe
        with mp_pose.Pose(min_detection_confidence=0.5,
                         min_tracking_confidence=0.5) as pose:
            
            image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(image)
            image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
            
            # Extract landmarks
            if results.pose_landmarks:
                landmarks = results.pose_landmarks.landmark
                
                shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value]
                elbow = landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value]
                wrist = landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value]
                hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP.value]
                
                # Rep counting logic
                if exercise == "bicep_curl":
                    angle = calc_angle(shoulder, elbow, wrist)
                    
                    if angle > 150:
                        state['stage'] = "down"
                    if state['stage'] == "down" and angle < 40:
                        state['stage'] = "up"
                        state['reps'] += 1
                
                elif exercise == "lateral_raise":
                    arm_angle = calc_angle(elbow, shoulder, hip)
                    
                    if arm_angle < 40:
                        state['stage'] = "down"
                    if state['stage'] == "down" and arm_angle > 75:
                        state['stage'] = "up"
                        state['reps'] += 1
                
                # Draw landmarks on frame
                mp_drawing.draw_landmarks(image, results.pose_landmarks,
                                         mp_pose.POSE_CONNECTIONS)
            
            # Encode output frame to base64
            _, buffer = cv2.imencode('.jpg', image)
            output_image = base64.b64encode(buffer).decode()
            
            # Calculate calories (force 0 when reps=0)
            calories = estimate_calories(age, weight, gender, exercise, state['reps'])
            
            return jsonify({
                'success': True,
                'reps': state['reps'],
                'calories': round(calories, 2),
                'image': 'data:image/jpeg;base64,' + output_image,
                'stage': state['stage']
            })
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/reset', methods=['POST'])
def reset():
    """Reset rep counter and stage."""
    data = request.json
    session_id = data.get('session_id', 'default')
    
    if session_id in pose_state:
        pose_state[session_id] = {'reps': 0, 'stage': None}
    
    return jsonify({'success': True, 'message': 'Counter reset'})

# -----------------------------------------
# RUN APP
# -----------------------------------------
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
