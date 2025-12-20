# calorie_model.py
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.ensemble import RandomForestRegressor
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
import pickle

def train_calorie_model(save_path="calorie_model.pkl"):
    np.random.seed(42)
    num_samples = 2000

    age = np.random.randint(18, 60, num_samples)
    weight = np.random.randint(45, 120, num_samples)
    gender = np.random.randint(0, 2, num_samples)
    reps = np.random.randint(5, 60, num_samples)

    # Exercise type (categorical)
    exercises = np.random.choice(['bicep_curl', 'lateral_raise'], size=num_samples, p=[0.5, 0.5])

    noise = np.random.normal(0, 5, num_samples)

    # Make exercise influence calories so the model learns it
    exercise_factor = np.where(exercises == 'lateral_raise', 0.9, 1.05)
    calories = (
        reps * 0.3 * exercise_factor +
        weight * 0.08 -
        age * 0.05 +
        gender * 2 +
        noise
    )

    df = pd.DataFrame({
        'age': age,
        'weight': weight,
        'gender': gender,
        'reps': reps,
        'exercise': exercises,
        'calories_burned': calories
    })

    X = df[['age', 'weight', 'gender', 'reps', 'exercise']]
    y = df['calories_burned']

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    numeric_features = ['age', 'weight', 'gender', 'reps']
    categorical_features = ['exercise']

    preprocess = ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), numeric_features),
            ('cat', OneHotEncoder(handle_unknown='ignore'), categorical_features),
        ]
    )

    model = Pipeline([
        ('preprocess', preprocess),
        ('rf', RandomForestRegressor(n_estimators=300, random_state=42))
    ])

    model.fit(X_train, y_train)

    with open(save_path, "wb") as f:
        pickle.dump(model, f)

    print("Calorie model trained & saved!")
