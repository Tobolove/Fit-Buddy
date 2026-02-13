"""
Fit Buddy API - Garmin Connect Data API
A production-ready Flask API to fetch and store Garmin fitness data.
"""
from datetime import date, datetime, timedelta
import logging
import os
from functools import wraps
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from garth.exc import GarthException, GarthHTTPError
import sys
import os

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed, continue with system env vars

# Add the python-garminconnect to path
python_garmin_path = Path(__file__).parent / "python-garminconnect"
if python_garmin_path.exists():
    sys.path.insert(0, str(python_garmin_path))

try:
    from garminconnect import (  # type: ignore
        Garmin,
        GarminConnectAuthenticationError,
        GarminConnectConnectionError,
        GarminConnectTooManyRequestsError,
    )
except ImportError as e:
    raise ImportError(
        f"Failed to import garminconnect. "
        f"Make sure the 'python-garminconnect' directory exists and dependencies are installed. "
        f"Run: cd python-garminconnect && pip install -e ."
    ) from e

from database import (
    db, init_db, StepsData, HeartRateData, SleepData, StressData,
    BodyBatteryData, ActivityData, HealthMetricsData
)
from utils import get_garmin_client, validate_credentials
from auth import (
    AUTHORIZED_EMAIL, AUTHORIZED_PASSWORD_HASH,
    verify_password, create_jwt_token, require_dashboard_auth,
    JWT_EXPIRATION_HOURS
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Suppress verbose garminconnect library logging
logging.getLogger("garminconnect").setLevel(logging.WARNING)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Database configuration
DATABASE_URL = (
    os.getenv('DATABASE_GMAIL', '').strip("'\"") or
    os.getenv('DATABASE_URL', '').strip("'\"") or
    os.getenv('DATABASE', '').strip("'\"")
)
if not DATABASE_URL:
    DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/fitbuddy'

app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_size': 5,
    'max_overflow': 20,
    'pool_timeout': 60,
    'pool_recycle': 300,
    'pool_pre_ping': True,
}

# Initialize database
db.init_app(app)
# Note: Database tables are created on first run via setup_database.py or populate_historical_data.py


def require_auth(f):
    """Decorator to require email and password in headers."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        email = request.headers.get('X-Email')
        password = request.headers.get('X-Password')
        
        if not email or not password:
            return jsonify({
                'error': 'Authentication required',
                'message': 'Please provide X-Email and X-Password headers'
            }), 401
        
        # Validate credentials format
        if not validate_credentials(email, password):
            return jsonify({
                'error': 'Invalid credentials format',
                'message': 'Email and password must be non-empty strings'
            }), 400
        
        # Add credentials to kwargs for route handlers
        kwargs['email'] = email
        kwargs['password'] = password
        return f(*args, **kwargs)
    
    return decorated_function


def get_yesterday_date():
    """Get yesterday's date in YYYY-MM-DD format."""
    yesterday = date.today() - timedelta(days=1)
    return yesterday.strftime('%Y-%m-%d')


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'Fit Buddy API',
        'version': '1.0.0'
    }), 200


@app.route('/explain', methods=['GET'])
def explain():
    """
    Get comprehensive explanation of the Fit Buddy API and all available endpoints.
    No authentication required.
    """
    return jsonify({
        'app_name': 'Fit Buddy API',
        'description': 'A RESTful API for fetching and storing Garmin Connect fitness data',
        'version': '1.0.0',
        'authentication': {
            'method': 'Header-based authentication',
            'required_headers': {
                'X-Email': 'Your Garmin Connect email address',
                'X-Password': 'Your Garmin Connect password'
            },
            'note': 'Most endpoints require authentication via X-Email and X-Password headers'
        },
        'endpoints': {
            'GET /health': {
                'description': 'Health check endpoint - verify API is running',
                'authentication': False,
                'response': {
                    'status': 'healthy',
                    'service': 'Fit Buddy API',
                    'version': '1.0.0'
                }
            },
            'GET /explain': {
                'description': 'This endpoint - explains the API and all available endpoints',
                'authentication': False,
                'response': 'This JSON response'
            },
            'GET /api/steps': {
                'description': 'Get steps data for yesterday',
                'authentication': True,
                'returns': 'Total steps, hourly breakdown, and user summary'
            },
            'GET /api/heartrate': {
                'description': 'Get heart rate data for yesterday',
                'authentication': True,
                'returns': 'Resting, average, max, and min heart rate data'
            },
            'GET /api/sleep': {
                'description': 'Get sleep data for yesterday',
                'authentication': True,
                'returns': 'Sleep score, duration, stages (deep/light/REM/awake), and SpO2 data'
            },
            'GET /api/stress': {
                'description': 'Get stress distribution and statistics for yesterday',
                'authentication': True,
                'returns': 'Stress distribution (rest/low/medium/high), average stress, and hourly stress data'
            },
            'GET /api/bodybattery': {
                'description': 'Get body battery data for yesterday',
                'authentication': True,
                'returns': 'Body battery charged and drained levels'
            },
            'GET /api/activities': {
                'description': 'Get activities/exercises for yesterday',
                'authentication': True,
                'returns': 'List of activities with details (distance, calories, heart rate, speed, etc.)'
            },
            'GET /api/healthmetrics': {
                'description': 'Get comprehensive health metrics for yesterday',
                'authentication': True,
                'returns': 'VO2 Max, fitness age, HRV, training readiness, hydration, intensity minutes, floors climbed, SpO2, respiration'
            },
            'GET /api/all': {
                'description': 'Get all fitness data combined in one response',
                'authentication': True,
                'returns': 'Combined data from all endpoints (steps, heart rate, sleep, stress, body battery, activities, health metrics)'
            },
            'POST /api/sync/<date>': {
                'description': 'Sync all data for a specific date to the database',
                'authentication': True,
                'url_parameter': 'date (format: YYYY-MM-DD, e.g., 2026-01-15)',
                'returns': 'Sync status for all data types and summary of stored data',
                'note': 'Fetches data from Garmin Connect and stores it in PostgreSQL database'
            },
            'GET /api/db/<data_type>': {
                'description': 'Get data from database for a specific date',
                'authentication': False,
                'url_parameter': 'data_type (one of: steps, heartrate, sleep, stress, bodybattery, activities, healthmetrics)',
                'query_parameters': {
                    'email': 'User email address (required)',
                    'date': 'Date in format YYYY-MM-DD (required)'
                },
                'example': '/api/db/steps?email=user@example.com&date=2026-01-15',
                'returns': 'Data stored in database for the specified email and date',
                'note': 'Use this endpoint to retrieve historical data that has been synced to the database'
            }
        },
        'data_sources': {
            'garmin_connect': {
                'description': 'Endpoints without /db/ prefix fetch data directly from Garmin Connect API',
                'note': 'These endpoints return yesterday\'s data by default'
            },
            'database': {
                'description': 'Endpoints with /db/ prefix fetch data from PostgreSQL database',
                'note': 'Use these to retrieve historical data that has been synced to the database'
            }
        },
        'example_usage': {
            'curl': 'curl -X GET http://localhost:5000/api/steps -H "X-Email: your-email@example.com" -H "X-Password: your-password"',
            'python': '''import requests
headers = {
    "X-Email": "your-email@example.com",
    "X-Password": "your-password"
}
response = requests.get("http://localhost:5000/api/steps", headers=headers)
data = response.json()''',
            'javascript': '''fetch("http://localhost:5000/api/steps", {
    method: "GET",
    headers: {
        "X-Email": "your-email@example.com",
        "X-Password": "your-password"
    }
})
.then(response => response.json())
.then(data => console.log(data));'''
        },
        'error_responses': {
            '400': 'Bad Request - Invalid parameters or credentials format',
            '401': 'Unauthorized - Missing or invalid authentication credentials',
            '429': 'Too Many Requests - Rate limit exceeded',
            '500': 'Internal Server Error - Server-side error occurred',
            '503': 'Service Unavailable - Garmin Connect API unavailable'
        },
        'database': {
            'description': 'PostgreSQL database for storing historical fitness data',
            'tables': [
                'steps_data',
                'heart_rate_data',
                'sleep_data',
                'stress_data',
                'body_battery_data',
                'activity_data',
                'health_metrics_data'
            ],
            'note': 'Use /api/sync/<date> to populate the database with historical data'
        },
        'more_info': {
            'github': 'Check the README.md file for detailed documentation',
            'frontend': 'A React frontend is available for testing endpoints',
            'docker': 'Docker and Docker Compose configurations are available for easy deployment'
        }
    }), 200


@app.route('/api/steps', methods=['GET'])
@require_auth
def get_steps(email, password):
    """
    Get steps data for yesterday.
    
    Headers:
        X-Email: Your Garmin Connect email
        X-Password: Your Garmin Connect password
    
    Returns:
        JSON with steps data including hourly breakdown
    """
    try:
        target_date = get_yesterday_date()
        logger.info(f"Fetching steps data for {email} on {target_date}")
        
        # Get Garmin client
        garmin = get_garmin_client(email, password)
        
        # Fetch steps data
        steps_data = garmin.get_steps_data(target_date)
        
        # Also get user summary for total steps
        user_summary = garmin.get_user_summary(target_date)
        total_steps = user_summary.get('totalSteps', 0) if user_summary else 0
        
        # Prepare response
        response_data = {
            'date': target_date,
            'total_steps': total_steps,
            'hourly_data': steps_data if isinstance(steps_data, list) else [],
            'user_summary': user_summary or {}
        }
        
        # Store in database
        try:
            # Check if record exists
            existing_steps = StepsData.query.filter_by(email=email, date=target_date).first()
            if existing_steps:
                existing_steps.total_steps = total_steps
                existing_steps.hourly_data = steps_data if isinstance(steps_data, list) else []
                existing_steps.full_data = response_data
            else:
                steps_record = StepsData(
                    email=email,
                    date=target_date,
                    total_steps=total_steps,
                    hourly_data=steps_data if isinstance(steps_data, list) else [],
                    full_data=response_data
                )
                db.session.add(steps_record)
            db.session.commit()
            logger.info(f"Stored steps data in database for {email} on {target_date}")
        except Exception as db_error:
            logger.error(f"Database error storing steps data: {db_error}")
            db.session.rollback()
            # Don't fail the request if DB storage fails
        
        return jsonify(response_data), 200
        
    except GarminConnectAuthenticationError as e:
        logger.error(f"Authentication error for {email}: {e}")
        return jsonify({
            'error': 'Authentication failed',
            'message': 'Invalid Garmin Connect credentials'
        }), 401
    except GarminConnectConnectionError as e:
        logger.error(f"Connection error for {email}: {e}")
        return jsonify({
            'error': 'Connection error',
            'message': 'Unable to connect to Garmin Connect'
        }), 503
    except GarminConnectTooManyRequestsError as e:
        logger.error(f"Rate limit error for {email}: {e}")
        return jsonify({
            'error': 'Rate limit exceeded',
            'message': 'Too many requests. Please try again later.'
        }), 429
    except (GarthHTTPError, GarthException) as e:
        logger.error(f"Garth error for {email}: {e}")
        return jsonify({
            'error': 'Garmin service error',
            'message': str(e)
        }), 500
    except Exception as e:
        logger.error(f"Unexpected error for {email}: {e}", exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'message': 'An unexpected error occurred'
        }), 500


@app.route('/api/heartrate', methods=['GET'])
@require_auth
def get_heartrate(email, password):
    """
    Get heart rate data for yesterday.
    
    Headers:
        X-Email: Your Garmin Connect email
        X-Password: Your Garmin Connect password
    
    Returns:
        JSON with comprehensive heart rate data
    """
    try:
        target_date = get_yesterday_date()
        logger.info(f"Fetching heart rate data for {email} on {target_date}")
        
        # Get Garmin client
        garmin = get_garmin_client(email, password)
        
        # Fetch heart rate data
        hr_data = garmin.get_heart_rates(target_date)
        
        # Also get resting heart rate
        rhr_data = garmin.get_rhr_day(target_date)
        
        # Prepare response
        response_data = {
            'date': target_date,
            'heart_rate': hr_data or {},
            'resting_heart_rate': rhr_data or {},
            'resting_hr': hr_data.get('restingHeartRate') if hr_data else None,
            'average_hr': hr_data.get('averageHeartRate') if hr_data else None,
            'max_hr': hr_data.get('maxHeartRate') if hr_data else None,
            'min_hr': hr_data.get('minHeartRate') if hr_data else None,
        }
        
        # Store in database
        try:
            # Check if record exists
            existing_hr = HeartRateData.query.filter_by(email=email, date=target_date).first()
            if existing_hr:
                existing_hr.resting_hr = response_data.get('resting_hr')
                existing_hr.average_hr = response_data.get('average_hr')
                existing_hr.max_hr = response_data.get('max_hr')
                existing_hr.min_hr = response_data.get('min_hr')
                existing_hr.full_data = response_data
            else:
                hr_record = HeartRateData(
                    email=email,
                    date=target_date,
                    resting_hr=response_data.get('resting_hr'),
                    average_hr=response_data.get('average_hr'),
                    max_hr=response_data.get('max_hr'),
                    min_hr=response_data.get('min_hr'),
                    full_data=response_data
                )
                db.session.add(hr_record)
            db.session.commit()
            logger.info(f"Stored heart rate data in database for {email} on {target_date}")
        except Exception as db_error:
            logger.error(f"Database error storing heart rate data: {db_error}")
            db.session.rollback()
        
        return jsonify(response_data), 200
        
    except GarminConnectAuthenticationError as e:
        logger.error(f"Authentication error for {email}: {e}")
        return jsonify({
            'error': 'Authentication failed',
            'message': 'Invalid Garmin Connect credentials'
        }), 401
    except GarminConnectConnectionError as e:
        logger.error(f"Connection error for {email}: {e}")
        return jsonify({
            'error': 'Connection error',
            'message': 'Unable to connect to Garmin Connect'
        }), 503
    except Exception as e:
        logger.error(f"Unexpected error for {email}: {e}", exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'message': 'An unexpected error occurred'
        }), 500


@app.route('/api/sleep', methods=['GET'])
@require_auth
def get_sleep(email, password):
    """
    Get detailed sleep data for yesterday.
    
    Headers:
        X-Email: Your Garmin Connect email
        X-Password: Your Garmin Connect password
    
    Returns:
        JSON with comprehensive sleep data including stages, score, duration
    """
    try:
        target_date = get_yesterday_date()
        logger.info(f"Fetching sleep data for {email} on {target_date}")
        
        # Get Garmin client
        garmin = get_garmin_client(email, password)
        
        # Fetch sleep data
        sleep_data = garmin.get_sleep_data(target_date)
        
        # Extract from dailySleepDTO if present (Garmin nests data here)
        daily_sleep = sleep_data.get('dailySleepDTO', {}) if isinstance(sleep_data, dict) and sleep_data else {}
        
        # Get sleep score - can be in multiple places
        sleep_score = (sleep_data.get('sleepScore') if isinstance(sleep_data, dict) else None or 
                      daily_sleep.get('sleepScore') or 
                      sleep_data.get('sleepQualityScore') if isinstance(sleep_data, dict) else None or
                      daily_sleep.get('sleepQualityScore'))
        
        # Get sleep time from dailySleepDTO or root
        sleep_time_seconds = daily_sleep.get('sleepTimeSeconds') or (sleep_data.get('sleepTimeSeconds') if isinstance(sleep_data, dict) else None)
        sleep_time_minutes = (sleep_time_seconds // 60) if sleep_time_seconds else None
        
        # Extract key metrics
        sleep_response = {
            'date': target_date,
            'sleep_data': sleep_data or {},
            'daily_sleep_dto': daily_sleep,
            'sleep_score': sleep_score,
            'sleep_duration_seconds': sleep_time_seconds,
            'sleep_duration_minutes': sleep_time_minutes,
            'sleep_start_gmt': daily_sleep.get('sleepStartTimestampGMT'),
            'sleep_end_gmt': daily_sleep.get('sleepEndTimestampGMT'),
            'sleep_start_local': daily_sleep.get('sleepStartTimestampLocal'),
            'sleep_end_local': daily_sleep.get('sleepEndTimestampLocal'),
            'sleep_stages': {
                'deep_seconds': daily_sleep.get('deepSleepSeconds') or (sleep_data.get('deepSleepSeconds') if isinstance(sleep_data, dict) else None),
                'light_seconds': daily_sleep.get('lightSleepSeconds') or (sleep_data.get('lightSleepSeconds') if isinstance(sleep_data, dict) else None),
                'rem_seconds': daily_sleep.get('remSleepSeconds') or (sleep_data.get('remSleepSeconds') if isinstance(sleep_data, dict) else None),
                'awake_seconds': daily_sleep.get('awakeSleepSeconds') or (sleep_data.get('awakeSleepSeconds') if isinstance(sleep_data, dict) else None),
            },
            'average_spo2': daily_sleep.get('averageSpO2Value') or (sleep_data.get('averageSpO2') if isinstance(sleep_data, dict) else None),
            'lowest_spo2': daily_sleep.get('lowestSpO2Value') or (sleep_data.get('lowestSpO2') if isinstance(sleep_data, dict) else None),
            'average_respiration': daily_sleep.get('averageRespirationValue') or (sleep_data.get('averageRespirationValue') if isinstance(sleep_data, dict) else None),
            'lowest_respiration': daily_sleep.get('lowestRespirationValue') or (sleep_data.get('lowestRespirationValue') if isinstance(sleep_data, dict) else None),
        }
        
        # Store in database
        try:
            # Check if record exists
            existing_sleep = SleepData.query.filter_by(email=email, date=target_date).first()
            if existing_sleep:
                existing_sleep.sleep_score = sleep_response.get('sleep_score')
                existing_sleep.sleep_duration_seconds = sleep_response.get('sleep_duration_seconds')
                existing_sleep.sleep_duration_minutes = sleep_response.get('sleep_duration_minutes')
                existing_sleep.deep_sleep_seconds = sleep_response.get('sleep_stages', {}).get('deep_seconds')
                existing_sleep.light_sleep_seconds = sleep_response.get('sleep_stages', {}).get('light_seconds')
                existing_sleep.rem_sleep_seconds = sleep_response.get('sleep_stages', {}).get('rem_seconds')
                existing_sleep.awake_seconds = sleep_response.get('sleep_stages', {}).get('awake_seconds')
                existing_sleep.full_data = sleep_data if isinstance(sleep_data, dict) else sleep_response
            else:
                sleep_record = SleepData(
                    email=email,
                    date=target_date,
                    sleep_score=sleep_response.get('sleep_score'),
                    sleep_duration_seconds=sleep_response.get('sleep_duration_seconds'),
                    sleep_duration_minutes=sleep_response.get('sleep_duration_minutes'),
                    deep_sleep_seconds=sleep_response.get('sleep_stages', {}).get('deep_seconds'),
                    light_sleep_seconds=sleep_response.get('sleep_stages', {}).get('light_seconds'),
                    rem_sleep_seconds=sleep_response.get('sleep_stages', {}).get('rem_seconds'),
                    awake_seconds=sleep_response.get('sleep_stages', {}).get('awake_seconds'),
                    full_data=sleep_data if isinstance(sleep_data, dict) else sleep_response
                )
                db.session.add(sleep_record)
            db.session.commit()
            logger.info(f"Stored sleep data in database for {email} on {target_date}")
        except Exception as db_error:
            logger.error(f"Database error storing sleep data: {db_error}", exc_info=True)
            db.session.rollback()
        
        return jsonify(sleep_response), 200
        
    except GarminConnectAuthenticationError as e:
        logger.error(f"Authentication error for {email}: {e}")
        return jsonify({
            'error': 'Authentication failed',
            'message': 'Invalid Garmin Connect credentials'
        }), 401
    except GarminConnectConnectionError as e:
        logger.error(f"Connection error for {email}: {e}")
        return jsonify({
            'error': 'Connection error',
            'message': 'Unable to connect to Garmin Connect'
        }), 503
    except Exception as e:
        logger.error(f"Unexpected error for {email}: {e}", exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'message': 'An unexpected error occurred'
        }), 500


@app.route('/api/stress', methods=['GET'])
@require_auth
def get_stress(email, password):
    """
    Get stress distribution data for yesterday.
    
    Headers:
        X-Email: Your Garmin Connect email
        X-Password: Your Garmin Connect password
    
    Returns:
        JSON with stress data including distribution, average, max stress
    """
    try:
        target_date = get_yesterday_date()
        logger.info(f"Fetching stress data for {email} on {target_date}")
        
        # Get Garmin client
        garmin = get_garmin_client(email, password)
        
        # Fetch stress data
        stress_data_raw = garmin.get_all_day_stress(target_date)
        
        # Handle different return types
        if isinstance(stress_data_raw, list):
            stress_data = stress_data_raw[0] if stress_data_raw else {}
        elif not isinstance(stress_data_raw, dict):
            stress_data = {}
        else:
            stress_data = stress_data_raw
        
        # Extract stress values array - it's an array of [timestamp_ms, stressLevel] pairs
        stress_values = stress_data.get('stressValuesArray', [])
        
        # Calculate statistics
        stress_levels = {
            'rest': 0,
            'low': 0,
            'medium': 0,
            'high': 0,
        }
        
        total_stress_minutes = 0
        stress_sum = 0
        max_stress = 0
        
        # Each entry in stressValuesArray is [timestamp_ms, stress_level]
        # Entries are typically 3 minutes apart
        for value in stress_values:
            if isinstance(value, list) and len(value) >= 2:
                stress = value[1] if isinstance(value[1], (int, float)) else 0
                duration_minutes = 3  # Each entry represents ~3 minutes
                
                if 0 <= stress <= 25:
                    stress_levels['rest'] += duration_minutes
                elif 26 <= stress <= 50:
                    stress_levels['low'] += duration_minutes
                elif 51 <= stress <= 75:
                    stress_levels['medium'] += duration_minutes
                elif stress > 75:
                    stress_levels['high'] += duration_minutes
                
                if stress > 0:
                    total_stress_minutes += duration_minutes
                    stress_sum += stress * duration_minutes
                    max_stress = max(max_stress, stress)
        
        # Use API average if available, otherwise calculate
        avg_stress_from_api = stress_data.get('avgStressLevel')
        average_stress = avg_stress_from_api if avg_stress_from_api is not None else (stress_sum / total_stress_minutes if total_stress_minutes > 0 else 0)
        
        # Use API max if available
        max_stress_from_api = stress_data.get('maxStressLevel')
        if max_stress_from_api is not None and max_stress_from_api > max_stress:
            max_stress = max_stress_from_api
        
        # Prepare response
        response_data = {
            'date': target_date,
            'stress_data': stress_data or {},
            'stress_distribution': {
                'rest_minutes': stress_levels['rest'],
                'low_stress_minutes': stress_levels['low'],
                'medium_stress_minutes': stress_levels['medium'],
                'high_stress_minutes': stress_levels['high'],
            },
            'stress_statistics': {
                'average_stress': round(average_stress, 2),
                'max_stress': max_stress,
                'total_stress_minutes': total_stress_minutes,
            },
            'hourly_stress': stress_values,
        }
        
        # Store in database
        try:
            # Check if record exists
            existing_stress = StressData.query.filter_by(email=email, date=target_date).first()
            if existing_stress:
                existing_stress.rest_minutes = stress_levels['rest']
                existing_stress.low_stress_minutes = stress_levels['low']
                existing_stress.medium_stress_minutes = stress_levels['medium']
                existing_stress.high_stress_minutes = stress_levels['high']
                existing_stress.average_stress = round(average_stress, 2)
                existing_stress.max_stress = max_stress
                existing_stress.full_data = response_data
            else:
                stress_record = StressData(
                    email=email,
                    date=target_date,
                    rest_minutes=stress_levels['rest'],
                    low_stress_minutes=stress_levels['low'],
                    medium_stress_minutes=stress_levels['medium'],
                    high_stress_minutes=stress_levels['high'],
                    average_stress=round(average_stress, 2),
                    max_stress=max_stress,
                    full_data=response_data
                )
                db.session.add(stress_record)
            db.session.commit()
            logger.info(f"Stored stress data in database for {email} on {target_date}")
        except Exception as db_error:
            logger.error(f"Database error storing stress data: {db_error}")
            db.session.rollback()
        
        return jsonify(response_data), 200
        
    except GarminConnectAuthenticationError as e:
        logger.error(f"Authentication error for {email}: {e}")
        return jsonify({
            'error': 'Authentication failed',
            'message': 'Invalid Garmin Connect credentials'
        }), 401
    except GarminConnectConnectionError as e:
        logger.error(f"Connection error for {email}: {e}")
        return jsonify({
            'error': 'Connection error',
            'message': 'Unable to connect to Garmin Connect'
        }), 503
    except Exception as e:
        logger.error(f"Unexpected error for {email}: {e}", exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'message': 'An unexpected error occurred'
        }), 500


@app.route('/api/bodybattery', methods=['GET'])
@require_auth
def get_body_battery(email, password):
    """
    Get body battery data for yesterday.
    
    Headers:
        X-Email: Your Garmin Connect email
        X-Password: Your Garmin Connect password
    
    Returns:
        JSON with body battery charged and drained values
    """
    try:
        target_date = get_yesterday_date()
        logger.info(f"Fetching body battery data for {email} on {target_date}")
        
        garmin = get_garmin_client(email, password)
        body_battery_data = garmin.get_body_battery(target_date, target_date)
        
        # Extract daily values
        daily_bb = body_battery_data[0] if body_battery_data and len(body_battery_data) > 0 else {}
        
        response_data = {
            'date': target_date,
            'charged': daily_bb.get('charged'),
            'drained': daily_bb.get('drained'),
            'body_battery_data': body_battery_data,
        }
        
        # Store in database
        try:
            # Check if record exists
            existing_bb = BodyBatteryData.query.filter_by(email=email, date=target_date).first()
            if existing_bb:
                existing_bb.charged = daily_bb.get('charged')
                existing_bb.drained = daily_bb.get('drained')
                existing_bb.full_data = response_data
            else:
                bb_record = BodyBatteryData(
                    email=email,
                    date=target_date,
                    charged=daily_bb.get('charged'),
                    drained=daily_bb.get('drained'),
                    full_data=response_data
                )
                db.session.add(bb_record)
            db.session.commit()
            logger.info(f"Stored body battery data in database for {email} on {target_date}")
        except Exception as db_error:
            logger.error(f"Database error storing body battery data: {db_error}")
            db.session.rollback()
        
        return jsonify(response_data), 200
        
    except GarminConnectAuthenticationError as e:
        logger.error(f"Authentication error for {email}: {e}")
        return jsonify({
            'error': 'Authentication failed',
            'message': 'Invalid Garmin Connect credentials'
        }), 401
    except Exception as e:
        logger.error(f"Unexpected error for {email}: {e}", exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'message': 'An unexpected error occurred'
        }), 500


@app.route('/api/activities', methods=['GET'])
@require_auth
def get_activities(email, password):
    """
    Get all activities/exercises for yesterday with detailed metrics.
    
    Headers:
        X-Email: Your Garmin Connect email
        X-Password: Your Garmin Connect password
    
    Returns:
        JSON with all activities including calories, distance, heart rate, etc.
    """
    try:
        target_date = get_yesterday_date()
        logger.info(f"Fetching activities for {email} on {target_date}")
        
        garmin = get_garmin_client(email, password)
        activities_response = garmin.get_activities_fordate(target_date)
        
        activities = activities_response.get('activities', []) if activities_response else []
        
        # Fetch detailed data for each activity
        detailed_activities = []
        for activity in activities:
            activity_id = activity.get('activityId')
            if activity_id:
                try:
                    # Get full activity details
                    activity_detail = garmin.get_activity(str(activity_id))
                    detailed_activities.append({
                        'activity_id': activity_id,
                        'activity_name': activity.get('activityName') or activity_detail.get('activityName'),
                        'activity_type': activity.get('activityType', {}).get('typeKey') or activity_detail.get('activityType', {}).get('typeKey'),
                        'start_time': activity.get('startTimeLocal') or activity_detail.get('startTimeLocal'),
                        'duration_seconds': activity_detail.get('elapsedDuration', {}).get('value') or activity.get('elapsedDuration'),
                        'distance_meters': activity_detail.get('distance', {}).get('value') or activity.get('distance'),
                        'calories': activity_detail.get('calories') or activity.get('calories'),
                        'average_hr': activity_detail.get('averageHR', {}).get('value') if isinstance(activity_detail.get('averageHR'), dict) else activity_detail.get('averageHR'),
                        'max_hr': activity_detail.get('maxHR', {}).get('value') if isinstance(activity_detail.get('maxHR'), dict) else activity_detail.get('maxHR'),
                        'average_speed': activity_detail.get('averageSpeed', {}).get('value') if isinstance(activity_detail.get('averageSpeed'), dict) else activity_detail.get('averageSpeed'),
                        'max_speed': activity_detail.get('maxSpeed', {}).get('value') if isinstance(activity_detail.get('maxSpeed'), dict) else activity_detail.get('maxSpeed'),
                        'elevation_gain': activity_detail.get('elevationGain', {}).get('value') if isinstance(activity_detail.get('elevationGain'), dict) else activity_detail.get('elevationGain'),
                        'average_cadence': activity_detail.get('averageRunningCadenceInStepsPerMinute', {}).get('value') if isinstance(activity_detail.get('averageRunningCadenceInStepsPerMinute'), dict) else activity_detail.get('averageRunningCadenceInStepsPerMinute'),
                        'full_activity_data': activity_detail,
                    })
                    
                    # Store in database
                    try:
                        # Check if activity already exists
                        existing_activity = ActivityData.query.filter_by(email=email, activity_id=str(activity_id)).first()
                        if existing_activity:
                            # Update existing activity
                            existing_activity.date = target_date
                            existing_activity.activity_name = activity.get('activityName')
                            existing_activity.activity_type = activity.get('activityType', {}).get('typeKey')
                            existing_activity.start_time = datetime.fromisoformat(activity.get('startTimeLocal').replace('Z', '+00:00')) if activity.get('startTimeLocal') else None
                            existing_activity.duration_seconds = activity_detail.get('elapsedDuration', {}).get('value') if isinstance(activity_detail.get('elapsedDuration'), dict) else activity_detail.get('elapsedDuration')
                            existing_activity.distance_meters = activity_detail.get('distance', {}).get('value') if isinstance(activity_detail.get('distance'), dict) else activity_detail.get('distance')
                            existing_activity.calories = activity_detail.get('calories')
                            existing_activity.average_hr = activity_detail.get('averageHR', {}).get('value') if isinstance(activity_detail.get('averageHR'), dict) else activity_detail.get('averageHR')
                            existing_activity.max_hr = activity_detail.get('maxHR', {}).get('value') if isinstance(activity_detail.get('maxHR'), dict) else activity_detail.get('maxHR')
                            existing_activity.average_speed = activity_detail.get('averageSpeed', {}).get('value') if isinstance(activity_detail.get('averageSpeed'), dict) else activity_detail.get('averageSpeed')
                            existing_activity.max_speed = activity_detail.get('maxSpeed', {}).get('value') if isinstance(activity_detail.get('maxSpeed'), dict) else activity_detail.get('maxSpeed')
                            existing_activity.elevation_gain = activity_detail.get('elevationGain', {}).get('value') if isinstance(activity_detail.get('elevationGain'), dict) else activity_detail.get('elevationGain')
                            existing_activity.average_cadence = activity_detail.get('averageRunningCadenceInStepsPerMinute', {}).get('value') if isinstance(activity_detail.get('averageRunningCadenceInStepsPerMinute'), dict) else activity_detail.get('averageRunningCadenceInStepsPerMinute')
                            existing_activity.full_data = activity_detail
                        else:
                            # Create new activity
                            activity_record = ActivityData(
                                email=email,
                                activity_id=str(activity_id),
                                date=target_date,
                                activity_name=activity.get('activityName'),
                                activity_type=activity.get('activityType', {}).get('typeKey'),
                                start_time=datetime.fromisoformat(activity.get('startTimeLocal').replace('Z', '+00:00')) if activity.get('startTimeLocal') else None,
                                duration_seconds=activity_detail.get('elapsedDuration', {}).get('value') if isinstance(activity_detail.get('elapsedDuration'), dict) else activity_detail.get('elapsedDuration'),
                                distance_meters=activity_detail.get('distance', {}).get('value') if isinstance(activity_detail.get('distance'), dict) else activity_detail.get('distance'),
                                calories=activity_detail.get('calories'),
                                average_hr=activity_detail.get('averageHR', {}).get('value') if isinstance(activity_detail.get('averageHR'), dict) else activity_detail.get('averageHR'),
                                max_hr=activity_detail.get('maxHR', {}).get('value') if isinstance(activity_detail.get('maxHR'), dict) else activity_detail.get('maxHR'),
                                average_speed=activity_detail.get('averageSpeed', {}).get('value') if isinstance(activity_detail.get('averageSpeed'), dict) else activity_detail.get('averageSpeed'),
                                max_speed=activity_detail.get('maxSpeed', {}).get('value') if isinstance(activity_detail.get('maxSpeed'), dict) else activity_detail.get('maxSpeed'),
                                elevation_gain=activity_detail.get('elevationGain', {}).get('value') if isinstance(activity_detail.get('elevationGain'), dict) else activity_detail.get('elevationGain'),
                                average_cadence=activity_detail.get('averageRunningCadenceInStepsPerMinute', {}).get('value') if isinstance(activity_detail.get('averageRunningCadenceInStepsPerMinute'), dict) else activity_detail.get('averageRunningCadenceInStepsPerMinute'),
                                full_data=activity_detail
                            )
                            db.session.add(activity_record)
                    except Exception as db_error:
                        logger.error(f"Database error storing activity {activity_id}: {db_error}")
                except Exception as act_error:
                    logger.warning(f"Error fetching details for activity {activity_id}: {act_error}")
                    # Store basic activity info
                    detailed_activities.append(activity)
        
        response_data = {
            'date': target_date,
            'activity_count': len(detailed_activities),
            'activities': detailed_activities,
        }
        
        try:
            db.session.commit()
            logger.info(f"Stored {len(detailed_activities)} activities in database for {email} on {target_date}")
        except Exception as db_error:
            logger.error(f"Database error committing activities: {db_error}")
            db.session.rollback()
        
        return jsonify(response_data), 200
        
    except GarminConnectAuthenticationError as e:
        logger.error(f"Authentication error for {email}: {e}")
        return jsonify({
            'error': 'Authentication failed',
            'message': 'Invalid Garmin Connect credentials'
        }), 401
    except Exception as e:
        logger.error(f"Unexpected error for {email}: {e}", exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'message': 'An unexpected error occurred'
        }), 500


@app.route('/api/healthmetrics', methods=['GET'])
@require_auth
def get_health_metrics(email, password):
    """
    Get comprehensive health metrics for yesterday.
    Includes: VO2 Max, HRV, Training Readiness, Hydration, Intensity Minutes, Floors, SpO2, Respiration
    
    Headers:
        X-Email: Your Garmin Connect email
        X-Password: Your Garmin Connect password
    
    Returns:
        JSON with all health metrics
    """
    try:
        target_date = get_yesterday_date()
        logger.info(f"Fetching health metrics for {email} on {target_date}")
        
        garmin = get_garmin_client(email, password)
        
        # Fetch all metrics
        max_metrics = garmin.get_max_metrics(target_date)
        hrv_data = garmin.get_hrv_data(target_date)
        training_readiness = garmin.get_training_readiness(target_date)
        training_status = garmin.get_training_status(target_date)
        hydration_data = garmin.get_hydration_data(target_date)
        intensity_minutes = garmin.get_intensity_minutes_data(target_date)
        floors_data = garmin.get_floors(target_date)
        spo2_data = garmin.get_spo2_data(target_date)
        respiration_data = garmin.get_respiration_data(target_date)
        
        # Handle max_metrics if it's a list (take first element)
        if isinstance(max_metrics, list):
            max_metrics = max_metrics[0] if max_metrics else {}
        elif not isinstance(max_metrics, dict):
            max_metrics = {}
        
        # Extract key values — VO2 Max from max_metrics, fallback to training_status
        vo2_max = (max_metrics.get('vo2MaxPreciseValue') or max_metrics.get('vo2MaxValue')) if max_metrics else None
        if not vo2_max and training_status and isinstance(training_status, dict):
            recent = training_status.get('mostRecentVO2Max', {})
            generic = recent.get('generic', {}) if isinstance(recent, dict) else {}
            if isinstance(generic, dict):
                vo2_max = generic.get('vo2MaxPreciseValue') or generic.get('vo2MaxValue')

        # Fitness Age — prefer dedicated endpoint, fallback to max_metrics
        fitness_age = None
        try:
            fitnessage_data = garmin.get_fitnessage_data(target_date)
            if fitnessage_data and isinstance(fitnessage_data, dict):
                fa_val = fitnessage_data.get('fitnessAge')
                if fa_val is not None:
                    fitness_age = round(fa_val) if isinstance(fa_val, float) else fa_val
        except Exception:
            fitness_age = max_metrics.get('fitnessAge') if max_metrics else None

        hrv_value = hrv_data.get('hrvSummary', {}).get('weeklyAvg') if hrv_data and isinstance(hrv_data, dict) else None
        if isinstance(training_readiness, list) and training_readiness:
            tr_entry = training_readiness[0]
            training_readiness_score = tr_entry.get('score') or tr_entry.get('trainingReadinessScore') or tr_entry.get('trainingReadiness')
        elif isinstance(training_readiness, dict):
            training_readiness_score = training_readiness.get('score') or training_readiness.get('trainingReadinessScore') or training_readiness.get('trainingReadiness')
        else:
            training_readiness_score = None
        training_status_value = training_status.get('trainingStatus', {}).get('value') if training_status and isinstance(training_status.get('trainingStatus'), dict) else training_status.get('trainingStatus') if training_status else None

        hydration_ml = hydration_data.get('valueInML') if hydration_data else None
        hydration_goal = hydration_data.get('goalInML') if hydration_data else None

        cardio_minutes = (intensity_minutes.get('moderateMinutes') or intensity_minutes.get('moderateIntensityMinutes') or 0) if intensity_minutes else 0
        anaerobic_minutes = (intensity_minutes.get('vigorousMinutes') or intensity_minutes.get('vigorousIntensityMinutes') or 0) if intensity_minutes else 0
        
        # Extract floors - floorValuesArray contains [startTime, endTime, floorsAscended, floorsDescended]
        floors = None
        if floors_data and isinstance(floors_data, dict):
            floor_array = floors_data.get('floorValuesArray', [])
            if floor_array and isinstance(floor_array, list):
                # Sum all floorsAscended values (index 2) from each entry
                total_floors = 0
                for entry in floor_array:
                    if isinstance(entry, list) and len(entry) > 2:
                        # Index 2 is floorsAscended
                        floors_ascended = entry[2] if isinstance(entry[2], (int, float)) else 0
                        total_floors += floors_ascended
                floors = total_floors if total_floors > 0 else None
        elif floors_data and isinstance(floors_data, (int, float)):
            floors = floors_data
        
        avg_spo2 = spo2_data.get('averageSpO2') if spo2_data else None
        lowest_spo2 = spo2_data.get('lowestSpO2') if spo2_data else None
        
        avg_respiration = (respiration_data.get('avgWakingRespirationValue') or respiration_data.get('avgRespirationValue')) if respiration_data else None
        lowest_respiration = respiration_data.get('lowestRespirationValue') if respiration_data else None

        response_data = {
            'date': target_date,
            'vo2_max': vo2_max,
            'fitness_age': fitness_age,
            'hrv': {
                'value': hrv_value,
                'full_data': hrv_data or {}
            },
            'training': {
                'readiness': training_readiness_score,
                'status': training_status_value,
                'readiness_data': training_readiness or {},
                'status_data': training_status or {}
            },
            'intensity_minutes': {
                'cardio': cardio_minutes,
                'anaerobic': anaerobic_minutes,
                'full_data': intensity_minutes or {}
            },
            'hydration': {
                'ml': hydration_ml,
                'goal_ml': hydration_goal,
                'full_data': hydration_data or {}
            },
            'floors': {
                'climbed': floors,
                'full_data': floors_data or {}
            },
            'spo2': {
                'average': avg_spo2,
                'lowest': lowest_spo2,
                'full_data': spo2_data or {}
            },
            'respiration': {
                'average': avg_respiration,
                'lowest': lowest_respiration,
                'full_data': respiration_data or {}
            },
            'max_metrics': max_metrics or {},
        }
        
        # Store in database
        try:
            # Check if record exists
            existing_health = HealthMetricsData.query.filter_by(email=email, date=target_date).first()
            if existing_health:
                existing_health.vo2_max = vo2_max
                existing_health.fitness_age = fitness_age
                existing_health.hrv_value = hrv_value
                existing_health.training_readiness = training_readiness_score
                existing_health.training_status = training_status_value
                existing_health.intensity_minutes_cardio = cardio_minutes
                existing_health.intensity_minutes_anaerobic = anaerobic_minutes
                existing_health.hydration_ml = hydration_ml
                existing_health.hydration_goal_ml = hydration_goal
                existing_health.floors_climbed = floors
                existing_health.average_spo2 = avg_spo2
                existing_health.lowest_spo2 = lowest_spo2
                existing_health.average_respiration = avg_respiration
                existing_health.lowest_respiration = lowest_respiration
                existing_health.full_data = response_data
            else:
                health_record = HealthMetricsData(
                    email=email,
                    date=target_date,
                    vo2_max=vo2_max,
                    fitness_age=fitness_age,
                    hrv_value=hrv_value,
                    training_readiness=training_readiness_score,
                    training_status=training_status_value,
                    intensity_minutes_cardio=cardio_minutes,
                    intensity_minutes_anaerobic=anaerobic_minutes,
                    hydration_ml=hydration_ml,
                    hydration_goal_ml=hydration_goal,
                    floors_climbed=floors,
                    average_spo2=avg_spo2,
                    lowest_spo2=lowest_spo2,
                    average_respiration=avg_respiration,
                    lowest_respiration=lowest_respiration,
                    full_data=response_data
                )
                db.session.add(health_record)
            db.session.commit()
            logger.info(f"Stored health metrics in database for {email} on {target_date}")
        except Exception as db_error:
            logger.error(f"Database error storing health metrics: {db_error}")
            db.session.rollback()
        
        return jsonify(response_data), 200
        
    except GarminConnectAuthenticationError as e:
        logger.error(f"Authentication error for {email}: {e}")
        return jsonify({
            'error': 'Authentication failed',
            'message': 'Invalid Garmin Connect credentials'
        }), 401
    except Exception as e:
        logger.error(f"Unexpected error for {email}: {e}", exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'message': 'An unexpected error occurred'
        }), 500


@app.route('/api/sync/<date>', methods=['POST'])
@require_auth
def sync_date_to_database(email, password, date):
    """
    Sync all data for a specific date to the database.
    Fetches data from Garmin and stores it in all tables.
    
    Headers:
        X-Email: Your Garmin Connect email
        X-Password: Your Garmin Connect password
    
    URL Parameters:
        date: Date in format YYYY-MM-DD (e.g., 2026-01-15)
    
    Returns:
        JSON with sync status and summary of stored data
    """
    try:
        # Validate date format
        try:
            datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            return jsonify({
                'error': 'Invalid date format',
                'message': 'Date must be in format YYYY-MM-DD (e.g., 2026-01-15)'
            }), 400
        
        logger.info(f"Syncing all data for {email} on {date}")
        
        # Get Garmin client
        garmin = get_garmin_client(email, password)
        
        sync_results = {
            'date': date,
            'email': email,
            'sync_status': {},
            'summary': {}
        }
        
        # Convert date string to date object
        from datetime import datetime as dt
        date_obj = dt.strptime(date, '%Y-%m-%d').date()
        
        # Sync Steps Data
        try:
            steps_data = garmin.get_steps_data(date)
            user_summary = garmin.get_user_summary(date)
            total_steps = user_summary.get('totalSteps', 0) if user_summary else 0
            
            steps_record = StepsData(
                email=email,
                date=date_obj,
                total_steps=total_steps,
                hourly_data=steps_data if isinstance(steps_data, list) else [],
                full_data={'steps_data': steps_data, 'user_summary': user_summary or {}}
            )
            db.session.merge(steps_record)
            sync_results['sync_status']['steps'] = 'success'
            sync_results['summary']['total_steps'] = total_steps
        except Exception as e:
            logger.error(f"Error syncing steps: {e}")
            sync_results['sync_status']['steps'] = f'error: {str(e)}'
        
        # Sync Heart Rate Data
        try:
            hr_data = garmin.get_heart_rates(date)
            rhr_data = garmin.get_rhr_day(date)
            
            # Calculate average HR from heartRateValues array if available
            average_hr = None
            if hr_data and isinstance(hr_data, dict):
                heart_rate_values = hr_data.get('heartRateValues', [])
                if heart_rate_values and isinstance(heart_rate_values, list):
                    # Extract HR values (second element in each [timestamp, hr] pair)
                    hr_values = [v[1] for v in heart_rate_values if isinstance(v, list) and len(v) >= 2 and isinstance(v[1], (int, float)) and v[1] > 0]
                    if hr_values:
                        average_hr = int(sum(hr_values) / len(hr_values))
            
            hr_record = HeartRateData(
                email=email,
                date=date_obj,
                resting_hr=hr_data.get('restingHeartRate') if hr_data else None,
                average_hr=average_hr or (hr_data.get('averageHeartRate') if hr_data else None),
                max_hr=hr_data.get('maxHeartRate') if hr_data else None,
                min_hr=hr_data.get('minHeartRate') if hr_data else None,
                full_data={'heart_rate': hr_data or {}, 'resting_hr': rhr_data or {}}
            )
            db.session.merge(hr_record)
            sync_results['sync_status']['heart_rate'] = 'success'
            sync_results['summary']['resting_hr'] = hr_data.get('restingHeartRate') if hr_data else None
        except Exception as e:
            logger.error(f"Error syncing heart rate: {e}")
            sync_results['sync_status']['heart_rate'] = f'error: {str(e)}'
        
        # Sync Sleep Data
        try:
            sleep_data = garmin.get_sleep_data(date)
            
            if not sleep_data:
                logger.warning(f"No sleep data for {date}")
                sync_results['sync_status']['sleep'] = 'no_data'
            else:
                # Extract from dailySleepDTO if present
                daily_sleep = sleep_data.get('dailySleepDTO', {}) if isinstance(sleep_data, dict) else {}
                
                # Get sleep score - try sleepScores.overall.value first (new structure)
                sleep_score = None
                if isinstance(daily_sleep, dict):
                    sleep_scores = daily_sleep.get('sleepScores', {})
                    if isinstance(sleep_scores, dict) and 'overall' in sleep_scores:
                        overall = sleep_scores.get('overall', {})
                        if isinstance(overall, dict):
                            sleep_score = overall.get('value')
                # Fallback to other locations
                if not sleep_score:
                    sleep_score = (sleep_data.get('sleepScore') if isinstance(sleep_data, dict) else None or 
                                  daily_sleep.get('sleepScore') if isinstance(daily_sleep, dict) else None or
                                  sleep_data.get('sleepQualityScore') if isinstance(sleep_data, dict) else None or
                                  daily_sleep.get('sleepQualityScore') if isinstance(daily_sleep, dict) else None)
                
                # Get sleep time from dailySleepDTO
                sleep_time_seconds = daily_sleep.get('sleepTimeSeconds') if isinstance(daily_sleep, dict) else None
                if not sleep_time_seconds and isinstance(sleep_data, dict):
                    sleep_time_seconds = sleep_data.get('sleepTimeSeconds')
                sleep_time_minutes = (sleep_time_seconds // 60) if sleep_time_seconds else None
                
                # Check if record exists
                existing_sleep = SleepData.query.filter_by(email=email, date=date_obj).first()
                if existing_sleep:
                    # Update existing record
                    existing_sleep.sleep_score = sleep_score
                    existing_sleep.sleep_duration_seconds = sleep_time_seconds
                    existing_sleep.sleep_duration_minutes = sleep_time_minutes
                    existing_sleep.deep_sleep_seconds = daily_sleep.get('deepSleepSeconds') or (sleep_data.get('deepSleepSeconds') if isinstance(sleep_data, dict) else None)
                    existing_sleep.light_sleep_seconds = daily_sleep.get('lightSleepSeconds') or (sleep_data.get('lightSleepSeconds') if isinstance(sleep_data, dict) else None)
                    existing_sleep.rem_sleep_seconds = daily_sleep.get('remSleepSeconds') or (sleep_data.get('remSleepSeconds') if isinstance(sleep_data, dict) else None)
                    existing_sleep.awake_seconds = daily_sleep.get('awakeSleepSeconds') or (sleep_data.get('awakeSleepSeconds') if isinstance(sleep_data, dict) else None)
                    existing_sleep.full_data = sleep_data if isinstance(sleep_data, dict) else {}
                else:
                    # Create new record
                    sleep_record = SleepData(
                        email=email,
                        date=date_obj,
                        sleep_score=sleep_score,
                        sleep_duration_seconds=sleep_time_seconds,
                        sleep_duration_minutes=sleep_time_minutes,
                        deep_sleep_seconds=daily_sleep.get('deepSleepSeconds') or (sleep_data.get('deepSleepSeconds') if isinstance(sleep_data, dict) else None),
                        light_sleep_seconds=daily_sleep.get('lightSleepSeconds') or (sleep_data.get('lightSleepSeconds') if isinstance(sleep_data, dict) else None),
                        rem_sleep_seconds=daily_sleep.get('remSleepSeconds') or (sleep_data.get('remSleepSeconds') if isinstance(sleep_data, dict) else None),
                        awake_seconds=daily_sleep.get('awakeSleepSeconds') or (sleep_data.get('awakeSleepSeconds') if isinstance(sleep_data, dict) else None),
                        full_data=sleep_data if isinstance(sleep_data, dict) else {}
                    )
                    db.session.add(sleep_record)
                sync_results['sync_status']['sleep'] = 'success'
                sync_results['summary']['sleep_score'] = sleep_score
                sync_results['summary']['sleep_duration_minutes'] = sleep_time_minutes
        except Exception as e:
            logger.error(f"Error syncing sleep: {e}", exc_info=True)
            sync_results['sync_status']['sleep'] = f'error: {str(e)}'
        
        # Sync Stress Data
        try:
            stress_data_raw = garmin.get_all_day_stress(date)
            
            # Handle different return types
            if stress_data_raw is None:
                sync_results['sync_status']['stress'] = 'no_data'
            else:
                # If it's a list, try to get the first element or use empty dict
                if isinstance(stress_data_raw, list):
                    if len(stress_data_raw) > 0 and isinstance(stress_data_raw[0], dict):
                        stress_data = stress_data_raw[0]
                    else:
                        stress_data = {}
                elif isinstance(stress_data_raw, dict):
                    stress_data = stress_data_raw
                else:
                    stress_data = {}
                
                # Extract stress values array - it's an array of [timestamp_ms, stressLevel] pairs
                stress_values = stress_data.get('stressValuesArray', []) if isinstance(stress_data, dict) else []
                
                # Calculate statistics
                stress_levels = {'rest': 0, 'low': 0, 'medium': 0, 'high': 0}
                total_stress_minutes = 0
                stress_sum = 0
                max_stress = 0
                
                # Each entry in stressValuesArray is [timestamp_ms, stress_level]
                # Entries are typically 3 minutes apart
                if isinstance(stress_values, list):
                    for value in stress_values:
                        if isinstance(value, list) and len(value) >= 2:
                            stress = value[1] if isinstance(value[1], (int, float)) else 0
                            duration_minutes = 3  # Each entry represents ~3 minutes
                            
                            if 0 <= stress <= 25:
                                stress_levels['rest'] += duration_minutes
                            elif 26 <= stress <= 50:
                                stress_levels['low'] += duration_minutes
                            elif 51 <= stress <= 75:
                                stress_levels['medium'] += duration_minutes
                            elif stress > 75:
                                stress_levels['high'] += duration_minutes
                            
                            if stress > 0:
                                total_stress_minutes += duration_minutes
                                stress_sum += stress * duration_minutes
                                max_stress = max(max_stress, stress)
                
                # Use API average if available, otherwise calculate
                avg_stress_from_api = stress_data.get('avgStressLevel') if isinstance(stress_data, dict) else None
                average_stress = avg_stress_from_api if avg_stress_from_api is not None else (stress_sum / total_stress_minutes if total_stress_minutes > 0 else 0)
                
                # Use API max if available
                max_stress_from_api = stress_data.get('maxStressLevel') if isinstance(stress_data, dict) else None
                if max_stress_from_api is not None and max_stress_from_api > max_stress:
                    max_stress = max_stress_from_api
                
                # Check if record exists
                existing_stress = StressData.query.filter_by(email=email, date=date_obj).first()
                if existing_stress:
                    # Update existing record
                    existing_stress.rest_minutes = stress_levels['rest']
                    existing_stress.low_stress_minutes = stress_levels['low']
                    existing_stress.medium_stress_minutes = stress_levels['medium']
                    existing_stress.high_stress_minutes = stress_levels['high']
                    existing_stress.average_stress = round(average_stress, 2)
                    existing_stress.max_stress = max_stress
                    existing_stress.full_data = stress_data or {}
                else:
                    # Create new record
                    stress_record = StressData(
                        email=email,
                        date=date_obj,
                        rest_minutes=stress_levels['rest'],
                        low_stress_minutes=stress_levels['low'],
                        medium_stress_minutes=stress_levels['medium'],
                        high_stress_minutes=stress_levels['high'],
                        average_stress=round(average_stress, 2),
                        max_stress=max_stress,
                        full_data=stress_data or {}
                    )
                    db.session.add(stress_record)
            sync_results['sync_status']['stress'] = 'success'
            sync_results['summary']['average_stress'] = round(average_stress, 2)
        except Exception as e:
            logger.error(f"Error syncing stress: {e}")
            sync_results['sync_status']['stress'] = f'error: {str(e)}'
        
        # Sync Body Battery Data
        try:
            body_battery_data = garmin.get_body_battery(date, date)
            daily_bb = body_battery_data[0] if body_battery_data and len(body_battery_data) > 0 else {}
            
            # Check if record exists
            existing_bb = BodyBatteryData.query.filter_by(email=email, date=date_obj).first()
            if existing_bb:
                # Update existing record
                existing_bb.charged = daily_bb.get('charged')
                existing_bb.drained = daily_bb.get('drained')
                existing_bb.full_data = body_battery_data
            else:
                # Create new record
                bb_record = BodyBatteryData(
                    email=email,
                    date=date_obj,
                    charged=daily_bb.get('charged'),
                    drained=daily_bb.get('drained'),
                    full_data=body_battery_data
                )
                db.session.add(bb_record)
            sync_results['sync_status']['body_battery'] = 'success'
            sync_results['summary']['body_battery_charged'] = daily_bb.get('charged')
        except Exception as e:
            logger.error(f"Error syncing body battery: {e}")
            sync_results['sync_status']['body_battery'] = f'error: {str(e)}'
        
        # Sync Activities Data
        try:
            # Try get_activities_by_date first (returns list directly)
            try:
                activities = garmin.get_activities_by_date(date, date)
                if not activities:
                    activities = []
            except:
                activities = []
            
            # Fallback to get_activities_fordate if needed
            if not activities:
                activities_response = garmin.get_activities_fordate(date)
                if activities_response and isinstance(activities_response, dict):
                    if 'ActivitiesForDay' in activities_response:
                        activities_for_day = activities_response['ActivitiesForDay']
                        if isinstance(activities_for_day, dict) and 'payload' in activities_for_day:
                            activities = activities_for_day['payload']
                        elif isinstance(activities_for_day, list):
                            activities = activities_for_day
                    elif 'activities' in activities_response:
                        activities = activities_response['activities']
                elif isinstance(activities_response, list):
                    activities = activities_response
                else:
                    activities = []
            
            activity_count = 0
            total_calories = 0
            
            for activity in activities:
                activity_id = activity.get('activityId')
                if activity_id:
                    try:
                        # Get detailed activity data
                        activity_detail = garmin.get_activity(str(activity_id))
                        if not activity_detail:
                            activity_detail = {}
                        
                        # Extract data from summaryDTO (where all the metrics are stored)
                        summary = activity_detail.get('summaryDTO', {}) if isinstance(activity_detail, dict) else {}
                        
                        # Parse start time from summaryDTO if available
                        start_time = None
                        start_time_str = summary.get('startTimeLocal') or activity.get('startTimeLocal') or activity_detail.get('startTimeLocal')
                        if start_time_str:
                            try:
                                start_time_str = start_time_str.replace('Z', '').replace('+00:00', '').replace('T', ' ')
                                if '.' in start_time_str:
                                    start_time = datetime.strptime(start_time_str.split('.')[0], '%Y-%m-%d %H:%M:%S')
                                elif 'T' in start_time_str:
                                    start_time = datetime.strptime(start_time_str.split('T')[0], '%Y-%m-%d')
                            except:
                                pass
                        
                        # Extract calories from summaryDTO
                        calories = summary.get('calories') or activity.get('calories') or activity.get('activeCalories') or 0
                        if not isinstance(calories, (int, float)):
                            calories = 0
                        total_calories += calories
                        
                        # Check if activity already exists
                        existing_activity = ActivityData.query.filter_by(email=email, activity_id=str(activity_id)).first()
                        if existing_activity:
                            # Update existing activity
                            existing_activity.date = date_obj
                            existing_activity.activity_name = activity.get('activityName') or activity_detail.get('activityName')
                            existing_activity.activity_type = (activity_detail.get('activityTypeDTO', {}).get('typeKey') 
                                             if isinstance(activity_detail.get('activityTypeDTO'), dict) 
                                             else (activity.get('activityType', {}).get('typeKey') 
                                                  if isinstance(activity.get('activityType'), dict) 
                                                  else None))
                            existing_activity.start_time = start_time
                            existing_activity.duration_seconds = summary.get('elapsedDuration') or activity.get('elapsedDuration') or activity.get('duration')
                            existing_activity.distance_meters = summary.get('distance') or activity.get('distance')
                            existing_activity.calories = int(calories)
                            existing_activity.average_hr = summary.get('averageHR') or activity.get('averageHR')
                            existing_activity.max_hr = summary.get('maxHR') or activity.get('maxHR')
                            existing_activity.average_speed = summary.get('averageSpeed') or activity.get('averageSpeed')
                            existing_activity.max_speed = summary.get('maxSpeed') or activity.get('maxSpeed')
                            existing_activity.elevation_gain = summary.get('elevationGain') or activity.get('elevationGain')
                            existing_activity.average_cadence = summary.get('averageRunCadence') or activity.get('averageRunCadence')
                            existing_activity.full_data = activity_detail if activity_detail else activity
                        else:
                            # Create new activity
                            activity_record = ActivityData(
                                email=email,
                                activity_id=str(activity_id),
                                date=date_obj,
                                activity_name=activity.get('activityName') or activity_detail.get('activityName'),
                                activity_type=(activity_detail.get('activityTypeDTO', {}).get('typeKey') 
                                             if isinstance(activity_detail.get('activityTypeDTO'), dict) 
                                             else (activity.get('activityType', {}).get('typeKey') 
                                                  if isinstance(activity.get('activityType'), dict) 
                                                  else None)),
                                start_time=start_time,
                                duration_seconds=summary.get('elapsedDuration') or activity.get('elapsedDuration') or activity.get('duration'),
                                distance_meters=summary.get('distance') or activity.get('distance'),
                                calories=int(calories),
                                average_hr=summary.get('averageHR') or activity.get('averageHR'),
                                max_hr=summary.get('maxHR') or activity.get('maxHR'),
                                average_speed=summary.get('averageSpeed') or activity.get('averageSpeed'),
                                max_speed=summary.get('maxSpeed') or activity.get('maxSpeed'),
                                elevation_gain=summary.get('elevationGain') or activity.get('elevationGain'),
                                average_cadence=summary.get('averageRunCadence') or activity.get('averageRunCadence'),
                                full_data=activity_detail if activity_detail else activity
                            )
                            db.session.add(activity_record)
                        activity_count += 1
                    except Exception as act_error:
                        logger.warning(f"Could not sync activity {activity_id}: {act_error}", exc_info=True)
            
            sync_results['sync_status']['activities'] = 'success'
            sync_results['summary']['activity_count'] = activity_count
            sync_results['summary']['total_calories'] = total_calories
        except Exception as e:
            logger.error(f"Error syncing activities: {e}")
            sync_results['sync_status']['activities'] = f'error: {str(e)}'
        
        # Sync Health Metrics Data
        try:
            max_metrics = garmin.get_max_metrics(date)
            hrv_data = garmin.get_hrv_data(date)
            training_readiness = garmin.get_training_readiness(date)
            training_status = garmin.get_training_status(date)
            hydration_data = garmin.get_hydration_data(date)
            intensity_minutes = garmin.get_intensity_minutes_data(date)
            floors_data = garmin.get_floors(date)
            spo2_data = garmin.get_spo2_data(date)
            respiration_data = garmin.get_respiration_data(date)
            
            # Handle max_metrics if it's a list (take first element)
            if isinstance(max_metrics, list):
                max_metrics = max_metrics[0] if max_metrics else {}
            elif not isinstance(max_metrics, dict):
                max_metrics = {}
            
            # VO2 Max — from max_metrics, fallback to training_status
            vo2_max = (max_metrics.get('vo2MaxPreciseValue') or max_metrics.get('vo2MaxValue')) if max_metrics else None
            if not vo2_max and training_status and isinstance(training_status, dict):
                recent = training_status.get('mostRecentVO2Max', {})
                generic = recent.get('generic', {}) if isinstance(recent, dict) else {}
                if isinstance(generic, dict):
                    vo2_max = generic.get('vo2MaxPreciseValue') or generic.get('vo2MaxValue')

            # Fitness Age — prefer dedicated endpoint
            fitness_age = None
            try:
                fitnessage_data = garmin.get_fitnessage_data(date)
                if fitnessage_data and isinstance(fitnessage_data, dict):
                    fa_val = fitnessage_data.get('fitnessAge')
                    if fa_val is not None:
                        fitness_age = round(fa_val) if isinstance(fa_val, float) else fa_val
            except Exception:
                fitness_age = max_metrics.get('fitnessAge') if max_metrics else None

            hrv_value = hrv_data.get('hrvSummary', {}).get('weeklyAvg') if hrv_data and isinstance(hrv_data, dict) else None
            if isinstance(training_readiness, list) and training_readiness:
                tr_entry = training_readiness[0]
                training_readiness_score = tr_entry.get('score') or tr_entry.get('trainingReadinessScore') or tr_entry.get('trainingReadiness')
            elif isinstance(training_readiness, dict):
                training_readiness_score = training_readiness.get('score') or training_readiness.get('trainingReadinessScore') or training_readiness.get('trainingReadiness')
            else:
                training_readiness_score = None
            training_status_value = training_status.get('trainingStatus', {}).get('value') if training_status and isinstance(training_status.get('trainingStatus'), dict) else training_status.get('trainingStatus') if training_status else None

            hydration_ml = hydration_data.get('valueInML') if hydration_data else None
            hydration_goal = hydration_data.get('goalInML') if hydration_data else None

            cardio_minutes = (intensity_minutes.get('moderateMinutes') or intensity_minutes.get('moderateIntensityMinutes') or 0) if intensity_minutes else 0
            anaerobic_minutes = (intensity_minutes.get('vigorousMinutes') or intensity_minutes.get('vigorousIntensityMinutes') or 0) if intensity_minutes else 0

            # Extract floors - floorValuesArray contains [startTime, endTime, floorsAscended, floorsDescended]
            floors = None
            if floors_data and isinstance(floors_data, dict):
                floor_array = floors_data.get('floorValuesArray', [])
                if floor_array and isinstance(floor_array, list):
                    total_floors = 0
                    for entry in floor_array:
                        if isinstance(entry, list) and len(entry) > 2:
                            floors_ascended = entry[2] if isinstance(entry[2], (int, float)) else 0
                            total_floors += floors_ascended
                    floors = total_floors if total_floors > 0 else None
            elif floors_data and isinstance(floors_data, (int, float)):
                floors = floors_data

            avg_spo2 = spo2_data.get('averageSpO2') if spo2_data else None
            lowest_spo2 = spo2_data.get('lowestSpO2') if spo2_data else None

            avg_respiration = (respiration_data.get('avgWakingRespirationValue') or respiration_data.get('avgRespirationValue')) if respiration_data else None
            lowest_respiration = respiration_data.get('lowestRespirationValue') if respiration_data else None
            
            # Check if record exists
            existing_health = HealthMetricsData.query.filter_by(email=email, date=date_obj).first()
            if existing_health:
                # Update existing record
                existing_health.vo2_max = vo2_max
                existing_health.fitness_age = fitness_age
                existing_health.hrv_value = hrv_value
                existing_health.training_readiness = training_readiness_score
                existing_health.training_status = training_status_value
                existing_health.intensity_minutes_cardio = cardio_minutes
                existing_health.intensity_minutes_anaerobic = anaerobic_minutes
                existing_health.hydration_ml = hydration_ml
                existing_health.hydration_goal_ml = hydration_goal
                existing_health.floors_climbed = floors
                existing_health.average_spo2 = avg_spo2
                existing_health.lowest_spo2 = lowest_spo2
                existing_health.average_respiration = avg_respiration
                existing_health.lowest_respiration = lowest_respiration
                existing_health.full_data = {
                    'max_metrics': max_metrics or {},
                    'hrv_data': hrv_data or {},
                    'training_readiness': training_readiness or {},
                    'training_status': training_status or {},
                    'hydration_data': hydration_data or {},
                    'intensity_minutes': intensity_minutes or {},
                    'floors_data': floors_data or {},
                    'spo2_data': spo2_data or {},
                    'respiration_data': respiration_data or {},
                }
            else:
                # Create new record
                health_record = HealthMetricsData(
                    email=email,
                    date=date_obj,
                    vo2_max=vo2_max,
                    fitness_age=fitness_age,
                    hrv_value=hrv_value,
                    training_readiness=training_readiness_score,
                    training_status=training_status_value,
                    intensity_minutes_cardio=cardio_minutes,
                    intensity_minutes_anaerobic=anaerobic_minutes,
                    hydration_ml=hydration_ml,
                    hydration_goal_ml=hydration_goal,
                    floors_climbed=floors,
                    average_spo2=avg_spo2,
                    lowest_spo2=lowest_spo2,
                    average_respiration=avg_respiration,
                    lowest_respiration=lowest_respiration,
                    full_data={
                        'max_metrics': max_metrics or {},
                        'hrv_data': hrv_data or {},
                        'training_readiness': training_readiness or {},
                        'training_status': training_status or {},
                        'hydration_data': hydration_data or {},
                        'intensity_minutes': intensity_minutes or {},
                        'floors_data': floors_data or {},
                        'spo2_data': spo2_data or {},
                        'respiration_data': respiration_data or {},
                    }
                )
                db.session.add(health_record)
            sync_results['sync_status']['health_metrics'] = 'success'
            sync_results['summary']['vo2_max'] = vo2_max
            sync_results['summary']['training_readiness'] = training_readiness_score
        except Exception as e:
            logger.error(f"Error syncing health metrics: {e}")
            sync_results['sync_status']['health_metrics'] = f'error: {str(e)}'
        
        # Commit all changes
        try:
            db.session.commit()
            sync_results['database_status'] = 'success'
            sync_results['message'] = f'Successfully synced all data for {date}'
            logger.info(f"Successfully synced all data for {email} on {date}")
            return jsonify(sync_results), 200
        except Exception as db_error:
            db.session.rollback()
            logger.error(f"Database error committing sync: {db_error}")
            sync_results['database_status'] = 'error'
            sync_results['message'] = f'Sync completed but database commit failed: {str(db_error)}'
            return jsonify(sync_results), 500
        
    except GarminConnectAuthenticationError as e:
        logger.error(f"Authentication error for {email}: {e}")
        return jsonify({
            'error': 'Authentication failed',
            'message': 'Invalid Garmin Connect credentials'
        }), 401
    except ValueError as e:
        return jsonify({
            'error': 'Invalid date format',
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Unexpected error syncing data for {email}: {e}", exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'message': f'An unexpected error occurred: {str(e)}'
        }), 500


@app.route('/api/all', methods=['GET'])
@require_auth
def get_all_data(email, password):
    """
    Get all fitness data (steps, heart rate, sleep, stress) for yesterday.
    
    Headers:
        X-Email: Your Garmin Connect email
        X-Password: Your Garmin Connect password
    
    Returns:
        JSON with all fitness metrics combined
    """
    try:
        target_date = get_yesterday_date()
        logger.info(f"Fetching all data for {email} on {target_date}")
        
        # Get Garmin client once
        garmin = get_garmin_client(email, password)
        
        # Fetch all data
        steps_data = garmin.get_steps_data(target_date)
        user_summary = garmin.get_user_summary(target_date)
        hr_data = garmin.get_heart_rates(target_date)
        sleep_data = garmin.get_sleep_data(target_date)
        stress_data = garmin.get_all_day_stress(target_date)
        body_battery_data = garmin.get_body_battery(target_date, target_date)
        # Use get_activities_by_date for better results
        try:
            activities = garmin.get_activities_by_date(target_date, target_date)
            if not activities:
                activities = []
        except:
            activities = []
        
        # Fallback to get_activities_fordate if needed
        if not activities:
            try:
                activities_response = garmin.get_activities_fordate(target_date)
                if activities_response and isinstance(activities_response, dict):
                    if 'ActivitiesForDay' in activities_response:
                        activities_for_day = activities_response['ActivitiesForDay']
                        if isinstance(activities_for_day, dict) and 'payload' in activities_for_day:
                            activities = activities_for_day['payload']
                        elif isinstance(activities_for_day, list):
                            activities = activities_for_day
                    elif 'activities' in activities_response:
                        activities = activities_response['activities']
                elif isinstance(activities_response, list):
                    activities = activities_response
            except:
                activities = []
        
        max_metrics = garmin.get_max_metrics(target_date)
        hrv_data = garmin.get_hrv_data(target_date)
        training_readiness = garmin.get_training_readiness(target_date)
        training_status = garmin.get_training_status(target_date)
        hydration_data = garmin.get_hydration_data(target_date)
        intensity_minutes = garmin.get_intensity_minutes_data(target_date)
        floors_data = garmin.get_floors(target_date)

        # Handle max_metrics if it's a list (take first element)
        if isinstance(max_metrics, list):
            max_metrics = max_metrics[0] if max_metrics else {}
        elif not isinstance(max_metrics, dict):
            max_metrics = {}

        # Combine all data
        response_data = {
            'date': target_date,
            'steps': {
                'total_steps': user_summary.get('totalSteps', 0) if user_summary else 0,
                'hourly_data': steps_data if isinstance(steps_data, list) else [],
                'user_summary': user_summary or {},
            },
            'heart_rate': {
                'resting_hr': hr_data.get('restingHeartRate') if hr_data else None,
                'average_hr': hr_data.get('averageHeartRate') if hr_data else None,
                'max_hr': hr_data.get('maxHeartRate') if hr_data else None,
                'min_hr': hr_data.get('minHeartRate') if hr_data else None,
                'full_data': hr_data or {},
            },
            'sleep': {
                'sleep_score': sleep_data.get('sleepScore') if sleep_data else None,
                'duration_minutes': sleep_data.get('sleepTimeSeconds', 0) // 60 if sleep_data and sleep_data.get('sleepTimeSeconds') else None,
                'stages': {
                    'deep': sleep_data.get('deepSleepSeconds') if sleep_data else None,
                    'light': sleep_data.get('lightSleepSeconds') if sleep_data else None,
                    'rem': sleep_data.get('remSleepSeconds') if sleep_data else None,
                    'awake': sleep_data.get('awakeSleepSeconds') if sleep_data else None,
                } if sleep_data else {},
                'full_data': sleep_data or {},
            },
            'stress': {
                'distribution': stress_data.get('stressValuesArray', []) if stress_data else [],
                'full_data': stress_data or {},
            },
            'body_battery': {
                'charged': body_battery_data[0].get('charged') if body_battery_data and len(body_battery_data) > 0 else None,
                'drained': body_battery_data[0].get('drained') if body_battery_data and len(body_battery_data) > 0 else None,
                'full_data': body_battery_data,
            },
            'activities': {
                'count': len(activities),
                'activities': activities,
            },
            'health_metrics': {
                'vo2_max': (
                    (max_metrics.get('vo2MaxPreciseValue') or max_metrics.get('vo2MaxValue')) if max_metrics else None
                ) or (
                    (training_status.get('mostRecentVO2Max', {}).get('generic', {}) or {}).get('vo2MaxPreciseValue')
                    if training_status and isinstance(training_status, dict) else None
                ),
                'fitness_age': max_metrics.get('fitnessAge') if max_metrics else None,
                'hrv': hrv_data.get('hrvSummary', {}).get('weeklyAvg') if hrv_data and isinstance(hrv_data, dict) else None,
                'training_readiness': (
                    training_readiness[0].get('score') or training_readiness[0].get('trainingReadinessScore')
                    if isinstance(training_readiness, list) and training_readiness
                    else training_readiness.get('trainingReadiness') if isinstance(training_readiness, dict) else None
                ),
                'hydration_ml': hydration_data.get('valueInML') if hydration_data else None,
                'intensity_minutes_cardio': (intensity_minutes.get('moderateMinutes') or intensity_minutes.get('moderateIntensityMinutes') or 0) if intensity_minutes else 0,
                'intensity_minutes_anaerobic': (intensity_minutes.get('vigorousMinutes') or intensity_minutes.get('vigorousIntensityMinutes') or 0) if intensity_minutes else 0,
                'floors_climbed': (
                    sum(entry[2] for entry in floors_data.get('floorValuesArray', []) 
                        if isinstance(entry, list) and len(entry) > 2 and isinstance(entry[2], (int, float)))
                    if floors_data and isinstance(floors_data, dict) and floors_data.get('floorValuesArray')
                    else None
                ),
                'max_metrics': max_metrics or {},
                'hrv_data': hrv_data or {},
                'training_readiness_data': training_readiness or {},
                'hydration_data': hydration_data or {},
                'intensity_minutes_data': intensity_minutes or {},
                'floors_data': floors_data or {},
            },
        }
        
        return jsonify(response_data), 200
        
    except GarminConnectAuthenticationError as e:
        logger.error(f"Authentication error for {email}: {e}")
        return jsonify({
            'error': 'Authentication failed',
            'message': 'Invalid Garmin Connect credentials'
        }), 401
    except Exception as e:
        logger.error(f"Unexpected error for {email}: {e}", exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'message': 'An unexpected error occurred'
        }), 500


@app.route('/api/db/<data_type>', methods=['GET'])
def get_db_data(data_type):
    """
    Query database for historical data.
    
    Query Parameters:
        email: User email
        date: Date in format YYYY-MM-DD
    
    Returns:
        JSON with data from database
    """
    try:
        email = request.args.get('email')
        date_str = request.args.get('date')
        
        if not email:
            return jsonify({'error': 'Missing email parameter'}), 400
        if not date_str:
            return jsonify({'error': 'Missing date parameter'}), 400
        
        try:
            date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        
        data_type_map = {
            'steps': StepsData,
            'heartrate': HeartRateData,
            'sleep': SleepData,
            'stress': StressData,
            'bodybattery': BodyBatteryData,
            'activities': ActivityData,
            'healthmetrics': HealthMetricsData,
        }
        
        model = data_type_map.get(data_type.lower())
        if not model:
            return jsonify({'error': f'Unknown data type: {data_type}'}), 400
        
        # Query database
        if data_type.lower() == 'activities':
            # Activities can have multiple records per date
            records = model.query.filter_by(email=email, date=date_obj).all()
            data = [r.to_dict() for r in records] if records else None
        else:
            # Other data types have one record per date
            record = model.query.filter_by(email=email, date=date_obj).first()
            data = record.to_dict() if record else None
        
        if not data:
            return jsonify({
                'error': 'No data found',
                'message': f'No {data_type} data found for {email} on {date_str}'
            }), 404
        
        return jsonify({
            'date': date_str,
            'email': email,
            'data_type': data_type,
            'data': data,
            'source': 'database'
        }), 200
        
    except Exception as e:
        logger.error(f"Error querying database: {e}", exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'message': str(e)
        }), 500


# ============================================================
# Dashboard Authentication Endpoints
# ============================================================

@app.route('/api/auth/login', methods=['POST'])
def dashboard_login():
    """
    Authenticate a user for the dashboard.

    Accepts a JSON body with 'email' and 'password' fields. Validates
    the email against the authorized dashboard user and verifies the
    password against the stored bcrypt hash. On success, returns a
    signed JWT token for subsequent authenticated requests.

    Request Body:
        email (str): The user's email address.
        password (str): The user's plaintext password.

    Returns:
        200: JSON with 'token', 'email', and 'expires_in' (seconds).
        400: If the request body is not valid JSON.
        401: If the email or password is incorrect.
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body must be JSON'}), 400

    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if email != AUTHORIZED_EMAIL.lower():
        return jsonify({'error': 'Invalid credentials'}), 401

    if not verify_password(password, AUTHORIZED_PASSWORD_HASH):
        return jsonify({'error': 'Invalid credentials'}), 401

    token = create_jwt_token(email)
    return jsonify({
        'token': token,
        'email': email,
        'expires_in': JWT_EXPIRATION_HOURS * 3600
    }), 200


@app.route('/api/auth/verify', methods=['GET'])
@require_dashboard_auth
def verify_token(dashboard_email):
    """
    Verify that a JWT token is still valid.

    Protected by the require_dashboard_auth decorator. If the request
    reaches this handler, the token is valid and not expired.

    Args:
        dashboard_email (str): The email extracted from the JWT token.

    Returns:
        200: JSON with 'valid' (True) and 'email'.
    """
    return jsonify({'valid': True, 'email': dashboard_email}), 200


@app.route('/api/live', methods=['GET'])
@require_dashboard_auth
def get_live_data(dashboard_email):
    """
    Fetch live fitness data using server-stored Garmin credentials.

    This endpoint is used by the dashboard for periodic polling of
    real-time data. It authenticates with Garmin Connect using the
    EMAIL and PASSWORD environment variables, so the frontend never
    needs to handle Garmin credentials.

    Protected by JWT authentication (dashboard login required).

    Args:
        dashboard_email (str): The email extracted from the JWT token.

    Returns:
        200: JSON with all fitness data for yesterday (steps, heart_rate,
            sleep, stress, body_battery, activities, health_metrics).
        401: If the JWT token is missing, expired, or invalid.
        500: If fetching data from Garmin fails.
    """
    try:
        email = os.getenv('EMAIL')
        password = os.getenv('PASSWORD')

        if not email or not password:
            return jsonify({'error': 'Garmin credentials not configured on server'}), 500

        garmin = get_garmin_client(email, password)
        target_date = date.today().isoformat()

        result = {'date': target_date, 'email': email}

        # Fetch all data types
        try:
            steps_data = garmin.get_steps_data(target_date)
            user_summary = garmin.get_user_summary(target_date)
            result['steps'] = {
                'total_steps': user_summary.get('totalSteps', 0) if user_summary else 0,
                'daily_step_goal': user_summary.get('dailyStepGoal', 10000) if user_summary else 10000,
                'total_distance': user_summary.get('totalDistanceMeters', 0) if user_summary else 0,
                'total_calories': user_summary.get('totalKilocalories', 0) if user_summary else 0,
                'floors_ascended': user_summary.get('floorsAscended', 0) if user_summary else 0,
                'hourly_data': steps_data if isinstance(steps_data, list) else [],
            }
        except Exception as e:
            result['steps'] = {'error': str(e)}

        try:
            hr_data = garmin.get_heart_rates(target_date)
            result['heart_rate'] = {
                'resting_hr': hr_data.get('restingHeartRate') if hr_data else None,
                'max_hr': hr_data.get('maxHeartRate') if hr_data else None,
                'min_hr': hr_data.get('minHeartRate') if hr_data else None,
                'heart_rate_values': hr_data.get('heartRateValues', []) if hr_data else [],
            }
            # Calculate average from values
            if hr_data and isinstance(hr_data, dict):
                vals = [v[1] for v in hr_data.get('heartRateValues', []) if isinstance(v, list) and len(v) >= 2 and isinstance(v[1], (int, float)) and v[1] > 0]
                result['heart_rate']['average_hr'] = int(sum(vals) / len(vals)) if vals else None
        except Exception as e:
            result['heart_rate'] = {'error': str(e)}

        try:
            sleep_data = garmin.get_sleep_data(target_date)
            daily_sleep = sleep_data.get('dailySleepDTO', {}) if isinstance(sleep_data, dict) else {}
            sleep_scores = daily_sleep.get('sleepScores', {}) if isinstance(daily_sleep, dict) else {}
            overall = sleep_scores.get('overall', {}) if isinstance(sleep_scores, dict) else {}
            result['sleep'] = {
                'sleep_score': overall.get('value') if isinstance(overall, dict) else None,
                'sleep_duration_seconds': daily_sleep.get('sleepTimeSeconds'),
                'deep_sleep_seconds': daily_sleep.get('deepSleepSeconds'),
                'light_sleep_seconds': daily_sleep.get('lightSleepSeconds'),
                'rem_sleep_seconds': daily_sleep.get('remSleepSeconds'),
                'awake_seconds': daily_sleep.get('awakeSleepSeconds'),
                'sleep_start': daily_sleep.get('sleepStartTimestampLocal'),
                'sleep_end': daily_sleep.get('sleepEndTimestampLocal'),
                'awake_count': daily_sleep.get('awakeCount'),
                'avg_sleep_stress': daily_sleep.get('avgSleepStress'),
                'average_spo2': daily_sleep.get('averageSpO2Value'),
                'lowest_spo2': daily_sleep.get('lowestSpO2Value'),
                'average_respiration': daily_sleep.get('averageRespirationValue'),
                'lowest_respiration': daily_sleep.get('lowestRespirationValue'),
                'avg_overnight_hrv': sleep_data.get('avgOvernightHrv') if isinstance(sleep_data, dict) else None,
                'hrv_status': sleep_data.get('hrvStatus') if isinstance(sleep_data, dict) else None,
                'body_battery_change': sleep_data.get('bodyBatteryChange') if isinstance(sleep_data, dict) else None,
                'resting_heart_rate': sleep_data.get('restingHeartRate') if isinstance(sleep_data, dict) else None,
                'sleep_levels': sleep_data.get('sleepLevels', []) if isinstance(sleep_data, dict) else [],
                'sleep_heart_rate': sleep_data.get('sleepHeartRate', []) if isinstance(sleep_data, dict) else [],
                'sleep_body_battery': sleep_data.get('sleepBodyBattery', []) if isinstance(sleep_data, dict) else [],
                'sleep_scores_detail': sleep_scores if isinstance(sleep_scores, dict) else {},
            }
        except Exception as e:
            result['sleep'] = {'error': str(e)}

        try:
            stress_raw = garmin.get_all_day_stress(target_date)
            stress_data = stress_raw[0] if isinstance(stress_raw, list) and stress_raw else stress_raw if isinstance(stress_raw, dict) else {}
            stress_values = stress_data.get('stressValuesArray', []) if isinstance(stress_data, dict) else []
            levels = {'rest': 0, 'low': 0, 'medium': 0, 'high': 0}
            for v in stress_values:
                if isinstance(v, list) and len(v) >= 2:
                    s = v[1] if isinstance(v[1], (int, float)) else 0
                    if 0 <= s <= 25: levels['rest'] += 3
                    elif 26 <= s <= 50: levels['low'] += 3
                    elif 51 <= s <= 75: levels['medium'] += 3
                    elif s > 75: levels['high'] += 3
            result['stress'] = {
                'average_stress': stress_data.get('avgStressLevel') if isinstance(stress_data, dict) else None,
                'max_stress': stress_data.get('maxStressLevel') if isinstance(stress_data, dict) else None,
                'rest_minutes': levels['rest'],
                'low_stress_minutes': levels['low'],
                'medium_stress_minutes': levels['medium'],
                'high_stress_minutes': levels['high'],
            }
        except Exception as e:
            result['stress'] = {'error': str(e)}

        try:
            bb_data = garmin.get_body_battery(target_date, target_date)
            daily_bb = bb_data[0] if bb_data and len(bb_data) > 0 else {}

            # The detailed body battery timeline (~400 points) comes from
            # get_stress_data(), not get_body_battery() which only has ~6
            # transition points. Format: [timestamp_ms, status, value, delta].
            # We extract [timestamp_ms, value] pairs for the frontend.
            detailed_timeline = []
            try:
                stress_detail = garmin.get_stress_data(target_date)
                if stress_detail and isinstance(stress_detail, dict):
                    raw_bb = stress_detail.get('bodyBatteryValuesArray', [])
                    for entry in raw_bb:
                        if isinstance(entry, list) and len(entry) >= 3:
                            ts = entry[0]
                            val = entry[2]
                            if isinstance(val, (int, float)):
                                detailed_timeline.append([ts, val])
            except Exception as e2:
                logger.warning(f"Failed to get detailed BB timeline from stress: {e2}")

            result['body_battery'] = {
                'charged': daily_bb.get('charged'),
                'drained': daily_bb.get('drained'),
                'timeline': detailed_timeline if detailed_timeline else daily_bb.get('bodyBatteryValuesArray', []),
                'start_timestamp': daily_bb.get('startTimestampLocal'),
                'end_timestamp': daily_bb.get('endTimestampLocal'),
            }
        except Exception as e:
            result['body_battery'] = {'error': str(e)}

        try:
            activities = garmin.get_activities_by_date(target_date, target_date)
            if not activities:
                activities = []
            act_list = []
            for act in (activities if isinstance(activities, list) else []):
                if not isinstance(act, dict):
                    continue
                start_local = act.get('startTimeLocal', '')
                act_list.append({
                    'activity_id': act.get('activityId'),
                    'activity_name': act.get('activityName'),
                    'activity_type': act.get('activityType', {}).get('typeKey') if isinstance(act.get('activityType'), dict) else None,
                    'date': start_local[:10] if start_local else target_date,
                    'start_time': start_local,
                    'duration_seconds': act.get('duration') or act.get('elapsedDuration'),
                    'distance_meters': act.get('distance'),
                    'calories': act.get('calories', 0),
                    'average_hr': act.get('averageHR'),
                    'max_hr': act.get('maxHR'),
                })
            result['activities'] = {'activity_count': len(act_list), 'activities': act_list}
        except Exception as e:
            result['activities'] = {'error': str(e)}

        # Each health metric is fetched in its own try/except so a single
        # API failure doesn't wipe out all metrics.
        health = {}

        try:
            max_metrics = garmin.get_max_metrics(target_date)
            if isinstance(max_metrics, list):
                max_metrics = max_metrics[0] if max_metrics else {}
            if isinstance(max_metrics, dict) and max_metrics:
                health['fitness_age'] = max_metrics.get('fitnessAge')
        except Exception as e:
            logger.warning(f"Failed to fetch max_metrics: {e}")

        try:
            fitnessage = garmin.get_fitnessage_data(target_date)
            if fitnessage and isinstance(fitnessage, dict):
                fa_val = fitnessage.get('fitnessAge')
                if fa_val is not None:
                    health['fitness_age'] = round(fa_val) if isinstance(fa_val, float) else fa_val
        except Exception as e:
            logger.warning(f"Failed to fetch fitness age data: {e}")

        try:
            hrv_data = garmin.get_hrv_data(target_date)
            if hrv_data and isinstance(hrv_data, dict):
                hrv_summary = hrv_data.get('hrvSummary', {})
                if isinstance(hrv_summary, dict):
                    health['hrv_value'] = hrv_summary.get('weeklyAvg')
        except Exception as e:
            logger.warning(f"Failed to fetch HRV data: {e}")

        try:
            # First: try dedicated training readiness endpoint
            tr_entry = garmin.get_morning_training_readiness(target_date)
            if tr_entry and isinstance(tr_entry, dict) and tr_entry.get('score') is not None:
                health['training_readiness'] = tr_entry.get('score')
                health['training_readiness_level'] = tr_entry.get('level')
            else:
                # Fallback: extract training status from get_training_status()
                # which returns status code + feedback phrase
                ts = garmin.get_training_status(target_date)
                if ts and isinstance(ts, dict):
                    mrt = ts.get('mostRecentTrainingStatus', {})
                    ltd = mrt.get('latestTrainingStatusData', {}) if isinstance(mrt, dict) else {}
                    if isinstance(ltd, dict):
                        # latestTrainingStatusData is keyed by device ID
                        for device_id, status_data in ltd.items():
                            if isinstance(status_data, dict):
                                # Map status code to label
                                status_map = {
                                    0: 'No Status', 1: 'Detraining', 2: 'Recovery',
                                    3: 'Maintaining', 4: 'Productive', 5: 'Peaking',
                                    6: 'Overreaching', 7: 'Unproductive',
                                }
                                status_code = status_data.get('trainingStatus')
                                feedback = status_data.get('trainingStatusFeedbackPhrase', '')
                                # Parse feedback phrase: "PRODUCTIVE_3" -> "Productive"
                                parsed_label = feedback.split('_')[0].capitalize() if feedback else None
                                health['training_readiness'] = status_code
                                health['training_readiness_level'] = parsed_label or status_map.get(status_code, '')
                                # Also store ACWR data
                                acwr = status_data.get('acuteTrainingLoadDTO', {})
                                if isinstance(acwr, dict):
                                    health['training_load_status'] = acwr.get('acwrStatus')
                                break
        except Exception as e:
            logger.warning(f"Failed to fetch training readiness/status: {e}")

        try:
            floors = garmin.get_floors(target_date)
            total_floors = 0
            if floors and isinstance(floors, dict):
                for entry in floors.get('floorValuesArray', []):
                    if isinstance(entry, list) and len(entry) > 2:
                        total_floors += entry[2] if isinstance(entry[2], (int, float)) else 0
            health['floors_climbed'] = total_floors if total_floors > 0 else None
        except Exception as e:
            logger.warning(f"Failed to fetch floors data: {e}")

        try:
            spo2 = garmin.get_spo2_data(target_date)
            if spo2 and isinstance(spo2, dict):
                health['average_spo2'] = spo2.get('averageSpO2')
                health['lowest_spo2'] = spo2.get('lowestSpO2')
        except Exception as e:
            logger.warning(f"Failed to fetch SpO2 data: {e}")

        try:
            respiration = garmin.get_respiration_data(target_date)
            if respiration and isinstance(respiration, dict):
                health['average_respiration'] = respiration.get('avgWakingRespirationValue') or respiration.get('avgRespirationValue')
                health['lowest_respiration'] = respiration.get('lowestRespirationValue')
        except Exception as e:
            logger.warning(f"Failed to fetch respiration data: {e}")

        try:
            intensity_minutes = garmin.get_intensity_minutes_data(target_date)
            if intensity_minutes and isinstance(intensity_minutes, dict):
                moderate = intensity_minutes.get('moderateMinutes') or intensity_minutes.get('moderateIntensityMinutes') or 0
                vigorous = intensity_minutes.get('vigorousMinutes') or intensity_minutes.get('vigorousIntensityMinutes') or 0
                health['intensity_minutes_cardio'] = moderate + vigorous
                health['weekly_intensity_total'] = intensity_minutes.get('weeklyTotal')
        except Exception as e:
            logger.warning(f"Failed to fetch intensity minutes: {e}")

        result['health_metrics'] = health

        # ── Monthly running goal tracker ────────────────────────────────
        # Fetches all activities from the 1st of the current month to today,
        # filters for running-type activities (road, trail, treadmill), sums
        # the total distance, and calculates how many km/day the user still
        # needs to run to reach a 100 km monthly goal.
        try:
            import calendar
            from datetime import timedelta as td

            today = date.today()
            month_start = today.replace(day=1)
            _, days_in_month = calendar.monthrange(today.year, today.month)

            run_activities = garmin.get_activities_by_date(
                month_start.isoformat(), today.isoformat()
            )
            if not run_activities or not isinstance(run_activities, list):
                run_activities = []

            running_types = {'running', 'trail_running', 'treadmill_running'}
            runs = []
            total_distance_m = 0.0
            total_duration_s = 0.0
            total_calories = 0
            for act in run_activities:
                if not isinstance(act, dict):
                    continue
                atype = act.get('activityType', {})
                type_key = atype.get('typeKey', '') if isinstance(atype, dict) else ''
                if type_key in running_types:
                    dist = act.get('distance') or 0
                    dur = act.get('duration') or act.get('elapsedDuration') or 0
                    cal = act.get('calories') or 0
                    total_distance_m += dist
                    total_duration_s += dur
                    total_calories += cal
                    runs.append({
                        'date': act.get('startTimeLocal', '')[:10],
                        'distance_km': round(dist / 1000, 2),
                        'duration_seconds': dur,
                        'calories': cal,
                        'avg_hr': act.get('averageHR'),
                        'avg_pace_min_km': round(dur / 60 / (dist / 1000), 2) if dist > 0 else None,
                    })

            total_km = round(total_distance_m / 1000, 2)
            goal_km = 100
            remaining_km = max(goal_km - total_km, 0)
            days_elapsed = (today - month_start).days + 1
            days_remaining = max(days_in_month - days_elapsed, 0)
            km_per_day_needed = round(remaining_km / days_remaining, 2) if days_remaining > 0 else 0

            result['running_goal'] = {
                'goal_km': goal_km,
                'total_km': total_km,
                'remaining_km': round(remaining_km, 2),
                'days_elapsed': days_elapsed,
                'days_remaining': days_remaining,
                'days_in_month': days_in_month,
                'km_per_day_needed': km_per_day_needed,
                'runs_count': len(runs),
                'total_duration_seconds': round(total_duration_s),
                'total_calories': total_calories,
                'on_track': total_km >= (goal_km / days_in_month) * days_elapsed,
                'avg_km_per_run': round(total_km / len(runs), 2) if runs else 0,
                'runs': runs,
            }
        except Exception as e:
            logger.warning(f"Failed to compute running goal: {e}")
            result['running_goal'] = {'error': str(e)}

        return jsonify(result), 200

    except GarminConnectAuthenticationError as e:
        return jsonify({'error': 'Garmin authentication failed', 'message': str(e)}), 401
    except Exception as e:
        logger.error(f"Error fetching live data: {e}", exc_info=True)
        return jsonify({'error': 'Failed to fetch live data', 'message': str(e)}), 500


@app.route('/api/db/<data_type>/range', methods=['GET'])
@require_dashboard_auth
def get_db_data_range(data_type, dashboard_email):
    """
    Query database for a date range of historical data.

    Returns all records of the specified data type that fall within
    the given date range for the server-configured user email.
    This endpoint is essential for the weekly comparison feature
    in the dashboard.

    Args:
        data_type (str): The type of data to query. One of: 'steps',
            'heartrate', 'sleep', 'stress', 'bodybattery', 'activities',
            'healthmetrics'.
        dashboard_email (str): The email extracted from the JWT token.

    Query Parameters:
        start_date (str): Start date in YYYY-MM-DD format (inclusive).
        end_date (str): End date in YYYY-MM-DD format (inclusive).

    Returns:
        200: JSON with 'data' (array of records), 'count', 'data_type',
            'start_date', 'end_date'.
        400: If parameters are missing or date format is invalid.
        500: If a database error occurs.
    """
    try:
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')

        if not start_date_str or not end_date_str:
            return jsonify({'error': 'Missing start_date or end_date parameter'}), 400

        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

        email = os.getenv('EMAIL', dashboard_email)

        data_type_map = {
            'steps': StepsData,
            'heartrate': HeartRateData,
            'sleep': SleepData,
            'stress': StressData,
            'bodybattery': BodyBatteryData,
            'activities': ActivityData,
            'healthmetrics': HealthMetricsData,
        }

        model = data_type_map.get(data_type.lower())
        if not model:
            return jsonify({'error': f'Unknown data type: {data_type}'}), 400

        records = model.query.filter(
            model.email == email,
            model.date >= start_date,
            model.date <= end_date
        ).order_by(model.date.asc()).all()

        data = [r.to_dict() for r in records]

        return jsonify({
            'data': data,
            'count': len(data),
            'data_type': data_type,
            'start_date': start_date_str,
            'end_date': end_date_str,
            'source': 'database'
        }), 200

    except Exception as e:
        logger.error(f"Error querying database range: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


# ============================================================
# Frontend Static File Serving (must be LAST route)
# ============================================================

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """
    Serve the React frontend application.

    In production (Docker), Flask serves the built React files from
    the dist/ directory. Falls through to index.html for client-side
    routing support.

    Args:
        path (str): The requested URL path. If it matches a static file
            in dist/, that file is served. Otherwise, index.html is
            served to support client-side routing.

    Returns:
        The requested static file or index.html as a fallback.
    """
    dist_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dist')
    if path and os.path.exists(os.path.join(dist_dir, path)):
        return send_from_directory(dist_dir, path)
    return send_from_directory(dist_dir, 'index.html')


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_ENV') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)
