"""
Database models and setup for Fit Buddy API.
"""
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
import json

db = SQLAlchemy()


class StepsData(db.Model):
    """Steps data model."""
    __tablename__ = 'steps_data'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), nullable=False, index=True)
    date = db.Column(db.Date, nullable=False, index=True)
    total_steps = db.Column(db.Integer)
    hourly_data = db.Column(db.JSON)
    full_data = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('email', 'date', name='unique_user_date_steps'),)
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'email': self.email,
            'date': self.date.isoformat() if self.date else None,
            'total_steps': self.total_steps,
            'hourly_data': self.hourly_data,
            'full_data': self.full_data,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class HeartRateData(db.Model):
    """Heart rate data model."""
    __tablename__ = 'heart_rate_data'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), nullable=False, index=True)
    date = db.Column(db.Date, nullable=False, index=True)
    resting_hr = db.Column(db.Integer)
    average_hr = db.Column(db.Integer)
    max_hr = db.Column(db.Integer)
    min_hr = db.Column(db.Integer)
    full_data = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('email', 'date', name='unique_user_date_hr'),)
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'email': self.email,
            'date': self.date.isoformat() if self.date else None,
            'resting_hr': self.resting_hr,
            'average_hr': self.average_hr,
            'max_hr': self.max_hr,
            'min_hr': self.min_hr,
            'full_data': self.full_data,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class SleepData(db.Model):
    """Sleep data model."""
    __tablename__ = 'sleep_data'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), nullable=False, index=True)
    date = db.Column(db.Date, nullable=False, index=True)
    sleep_score = db.Column(db.Integer)
    sleep_duration_seconds = db.Column(db.Integer)
    sleep_duration_minutes = db.Column(db.Integer)
    deep_sleep_seconds = db.Column(db.Integer)
    light_sleep_seconds = db.Column(db.Integer)
    rem_sleep_seconds = db.Column(db.Integer)
    awake_seconds = db.Column(db.Integer)
    full_data = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('email', 'date', name='unique_user_date_sleep'),)
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'email': self.email,
            'date': self.date.isoformat() if self.date else None,
            'sleep_score': self.sleep_score,
            'sleep_duration_seconds': self.sleep_duration_seconds,
            'sleep_duration_minutes': self.sleep_duration_minutes,
            'deep_sleep_seconds': self.deep_sleep_seconds,
            'light_sleep_seconds': self.light_sleep_seconds,
            'rem_sleep_seconds': self.rem_sleep_seconds,
            'awake_seconds': self.awake_seconds,
            'full_data': self.full_data,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class StressData(db.Model):
    """Stress data model."""
    __tablename__ = 'stress_data'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), nullable=False, index=True)
    date = db.Column(db.Date, nullable=False, index=True)
    rest_minutes = db.Column(db.Integer)
    low_stress_minutes = db.Column(db.Integer)
    medium_stress_minutes = db.Column(db.Integer)
    high_stress_minutes = db.Column(db.Integer)
    average_stress = db.Column(db.Float)
    max_stress = db.Column(db.Integer)
    full_data = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('email', 'date', name='unique_user_date_stress'),)
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'email': self.email,
            'date': self.date.isoformat() if self.date else None,
            'rest_minutes': self.rest_minutes,
            'low_stress_minutes': self.low_stress_minutes,
            'medium_stress_minutes': self.medium_stress_minutes,
            'high_stress_minutes': self.high_stress_minutes,
            'average_stress': self.average_stress,
            'max_stress': self.max_stress,
            'full_data': self.full_data,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class BodyBatteryData(db.Model):
    """Body battery data model."""
    __tablename__ = 'body_battery_data'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), nullable=False, index=True)
    date = db.Column(db.Date, nullable=False, index=True)
    charged = db.Column(db.Integer)  # Body battery charged (0-100)
    drained = db.Column(db.Integer)  # Body battery drained (0-100)
    full_data = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('email', 'date', name='unique_user_date_body_battery'),)
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'email': self.email,
            'date': self.date.isoformat() if self.date else None,
            'charged': self.charged,
            'drained': self.drained,
            'full_data': self.full_data,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class ActivityData(db.Model):
    """Activity/exercise data model."""
    __tablename__ = 'activity_data'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), nullable=False, index=True)
    activity_id = db.Column(db.String(255), nullable=False, index=True)
    date = db.Column(db.Date, nullable=False, index=True)
    activity_name = db.Column(db.String(500))
    activity_type = db.Column(db.String(100))
    start_time = db.Column(db.DateTime)
    duration_seconds = db.Column(db.Integer)
    distance_meters = db.Column(db.Float)
    calories = db.Column(db.Integer)
    average_hr = db.Column(db.Integer)
    max_hr = db.Column(db.Integer)
    average_speed = db.Column(db.Float)
    max_speed = db.Column(db.Float)
    elevation_gain = db.Column(db.Float)
    average_cadence = db.Column(db.Integer)
    full_data = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('email', 'activity_id', name='unique_user_activity'),)
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'email': self.email,
            'activity_id': self.activity_id,
            'date': self.date.isoformat() if self.date else None,
            'activity_name': self.activity_name,
            'activity_type': self.activity_type,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'duration_seconds': self.duration_seconds,
            'distance_meters': self.distance_meters,
            'calories': self.calories,
            'average_hr': self.average_hr,
            'max_hr': self.max_hr,
            'average_speed': self.average_speed,
            'max_speed': self.max_speed,
            'elevation_gain': self.elevation_gain,
            'average_cadence': self.average_cadence,
            'full_data': self.full_data,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class HealthMetricsData(db.Model):
    """Comprehensive health metrics data model."""
    __tablename__ = 'health_metrics_data'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), nullable=False, index=True)
    date = db.Column(db.Date, nullable=False, index=True)
    # VO2 Max and Fitness
    vo2_max = db.Column(db.Float)
    fitness_age = db.Column(db.Integer)
    # HRV
    hrv_value = db.Column(db.Float)
    # Training
    training_readiness = db.Column(db.Integer)
    training_status = db.Column(db.String(100))
    # Intensity
    intensity_minutes_cardio = db.Column(db.Integer)
    intensity_minutes_anaerobic = db.Column(db.Integer)
    # Hydration
    hydration_ml = db.Column(db.Integer)
    hydration_goal_ml = db.Column(db.Integer)
    # Floors
    floors_climbed = db.Column(db.Integer)
    # SpO2
    average_spo2 = db.Column(db.Float)
    lowest_spo2 = db.Column(db.Float)
    # Respiration
    average_respiration = db.Column(db.Float)
    lowest_respiration = db.Column(db.Float)
    # Full data storage
    full_data = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('email', 'date', name='unique_user_date_health_metrics'),)
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'email': self.email,
            'date': self.date.isoformat() if self.date else None,
            'vo2_max': self.vo2_max,
            'fitness_age': self.fitness_age,
            'hrv_value': self.hrv_value,
            'training_readiness': self.training_readiness,
            'training_status': self.training_status,
            'intensity_minutes_cardio': self.intensity_minutes_cardio,
            'intensity_minutes_anaerobic': self.intensity_minutes_anaerobic,
            'hydration_ml': self.hydration_ml,
            'hydration_goal_ml': self.hydration_goal_ml,
            'floors_climbed': self.floors_climbed,
            'average_spo2': self.average_spo2,
            'lowest_spo2': self.lowest_spo2,
            'average_respiration': self.average_respiration,
            'lowest_respiration': self.lowest_respiration,
            'full_data': self.full_data,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


def init_db():
    """Initialize database tables."""
    db.create_all()
