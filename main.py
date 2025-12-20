# main.py
import cv2
import mediapipe as mp
import pickle
import pandas as pd
import math

# -----------------------------------------
# LOAD CALORIE PREDICTION MODEL
# -----------------------------------------
with open("calorie_model.pkl", "rb") as f:
    calorie_model = pickle.load(f)

def estimate_calories(age, weight, gender, exercise, reps):
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
# USER INFO
# -----------------------------------------
USER_AGE = 25
USER_WEIGHT = 78
USER_GENDER = 1  # 1 = male, 0 = female

# -----------------------------------------
# EXERCISE SELECTION
# Options: "bicep_curl" or "lateral_raise"
# -----------------------------------------
EXERCISE = "lateral_raise"
# EXERCISE = "bicep_curl"

# -----------------------------------------
# MEDIAPIPE SETUP
# -----------------------------------------
mp_drawing = mp.solutions.drawing_utils
mp_pose = mp.solutions.pose

# Rep counting variables
reps = 0
stage = None
calories = 0

# -----------------------------------------
# HELPER FUNCTIONS
# -----------------------------------------
def calc_angle(a, b, c):
    ax, ay = a.x, a.y
    bx, by = b.x, b.y
    cx, cy = c.x, c.y

    ang = math.degrees(math.atan2(cy - by, cx - bx) -
                       math.atan2(ay - by, ax - bx))
    return ang + 360 if ang < 0 else ang

# -----------------------------------------
# CAMERA LOOP
# -----------------------------------------
cap = cv2.VideoCapture(0)

with mp_pose.Pose(min_detection_confidence=0.5,
                  min_tracking_confidence=0.5) as pose:

    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break

        # Convert BGR to RGB
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose.process(image)
        image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

        try:
            landmarks = results.pose_landmarks.landmark

            shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value]
            elbow = landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value]
            wrist = landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value]
            hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP.value]

            # -----------------------------------------
            # BICEP CURL DETECTION
            # -----------------------------------------
            if EXERCISE == "bicep_curl":
                angle = calc_angle(shoulder, elbow, wrist)

                if angle > 150:
                    stage = "down"
                if stage == "down" and angle < 40:
                    stage = "up"
                    reps += 1
                    calories = estimate_calories(USER_AGE, USER_WEIGHT, USER_GENDER, EXERCISE, reps)

            # -----------------------------------------
            # LATERAL RAISE DETECTION
            # -----------------------------------------
            elif EXERCISE == "lateral_raise":
                arm_angle = calc_angle(elbow, shoulder, hip)

                if arm_angle < 40:
                    stage = "down"
                if stage == "down" and arm_angle > 75:
                    stage = "up"
                    reps += 1
                    calories = estimate_calories(USER_AGE, USER_WEIGHT, USER_GENDER, EXERCISE, reps)

        except Exception as e:
            pass

        # -----------------------------------------
        # DISPLAY UI
        # -----------------------------------------
        cv2.putText(image, f"Exercise: {EXERCISE.replace('_', ' ').title()}",
                    (20, 40), cv2.FONT_HERSHEY_SIMPLEX,
                    1, (0, 255, 255), 3)

        cv2.putText(image, f"Reps: {reps}",
                    (20, 90), cv2.FONT_HERSHEY_SIMPLEX,
                    1, (0, 255, 0), 3)

        cv2.putText(image, f"Calories: {round(calories, 2)}",
                    (20, 140), cv2.FONT_HERSHEY_SIMPLEX,
                    1, (255, 255, 0), 3)

        # Draw pose landmarks
        mp_drawing.draw_landmarks(image, results.pose_landmarks,
                                  mp_pose.POSE_CONNECTIONS)

        # Show window
        cv2.imshow('AI Fitness Tracker', image)

        if cv2.waitKey(5) & 0xFF == 27:
            break

cap.release()
cv2.destroyAllWindows()
