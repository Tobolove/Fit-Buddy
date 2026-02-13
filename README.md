# Fit Buddy API 🏃‍♂️

A production-ready REST API for fetching and storing Garmin Connect fitness data. Built with Flask, PostgreSQL, and the Garmin Connect Python library.

## Features

- 🔐 **Secure Authentication**: Email/password authentication via headers
- 📊 **Comprehensive Data**: Steps, heart rate, sleep, stress, body battery, activities, and advanced health metrics
- 🏃 **Exercise Tracking**: Detailed activity data with calories, distance, heart rate zones, and more
- 🔋 **Body Battery**: Track energy levels throughout the day
- 📈 **Advanced Metrics**: VO2 Max, HRV, Training Readiness, Intensity Minutes, and more
- 🗄️ **PostgreSQL Storage**: Automatic data persistence for all metrics
- 🚀 **Production Ready**: Docker support, error handling, logging
- 📅 **Yesterday's Data**: Automatically fetches data from the previous day
- 🌐 **RESTful API**: Clean JSON endpoints

## API Endpoints

### Health Check
```http
GET /health
```

### Get Steps Data
```http
GET /api/steps
Headers:
  X-Email: your-email@example.com
  X-Password: your-password
```

**Response:**
```json
{
  "date": "2024-01-15",
  "total_steps": 12500,
  "hourly_data": [...],
  "user_summary": {...}
}
```

### Get Heart Rate Data
```http
GET /api/heartrate
Headers:
  X-Email: your-email@example.com
  X-Password: your-password
```

**Response:**
```json
{
  "date": "2024-01-15",
  "resting_hr": 58,
  "average_hr": 72,
  "max_hr": 145,
  "min_hr": 55,
  "heart_rate": {...},
  "resting_heart_rate": {...}
}
```

### Get Sleep Data (Detailed)
```http
GET /api/sleep
Headers:
  X-Email: your-email@example.com
  X-Password: your-password
```

**Response:**
```json
{
  "date": "2024-01-15",
  "sleep_score": 85,
  "sleep_duration_minutes": 480,
  "sleep_stages": {
    "deep_seconds": 12000,
    "light_seconds": 14400,
    "rem_seconds": 7200,
    "awake_seconds": 2400
  },
  "average_spo2": 96,
  "sleep_data": {...}
}
```

### Get Stress Distribution
```http
GET /api/stress
Headers:
  X-Email: your-email@example.com
  X-Password: your-password
```

**Response:**
```json
{
  "date": "2024-01-15",
  "stress_distribution": {
    "rest_minutes": 300,
    "low_stress_minutes": 180,
    "medium_stress_minutes": 60,
    "high_stress_minutes": 15
  },
  "stress_statistics": {
    "average_stress": 28.5,
    "max_stress": 75,
    "total_stress_minutes": 555
  },
  "hourly_stress": [...]
}
```

### Get Body Battery Data
```http
GET /api/bodybattery
Headers:
  X-Email: your-email@example.com
  X-Password: your-password
```

**Response:**
```json
{
  "date": "2024-01-15",
  "charged": 85,
  "drained": 45,
  "body_battery_data": [...]
}
```

### Get Activities/Exercises
```http
GET /api/activities
Headers:
  X-Email: your-email@example.com
  X-Password: your-password
```

**Response:**
```json
{
  "date": "2024-01-15",
  "activity_count": 2,
  "activities": [
    {
      "activity_id": "123456789",
      "activity_name": "Morning Run",
      "activity_type": "running",
      "start_time": "2024-01-15T07:00:00",
      "duration_seconds": 3600,
      "distance_meters": 5000,
      "calories": 450,
      "average_hr": 145,
      "max_hr": 165,
      "average_speed": 5.0,
      "max_speed": 6.2,
      "elevation_gain": 150,
      "average_cadence": 170,
      "full_activity_data": {...}
    }
  ]
}
```

### Get Comprehensive Health Metrics
```http
GET /api/healthmetrics
Headers:
  X-Email: your-email@example.com
  X-Password: your-password
```

**Response:**
```json
{
  "date": "2024-01-15",
  "vo2_max": 52.5,
  "fitness_age": 28,
  "hrv": {
    "value": 45.2,
    "full_data": {...}
  },
  "training": {
    "readiness": 85,
    "status": "productive",
    "readiness_data": {...},
    "status_data": {...}
  },
  "intensity_minutes": {
    "cardio": 30,
    "anaerobic": 15,
    "full_data": {...}
  },
  "hydration": {
    "ml": 2000,
    "goal_ml": 2500,
    "full_data": {...}
  },
  "floors": {
    "climbed": 12,
    "full_data": {...}
  },
  "spo2": {
    "average": 96,
    "lowest": 94,
    "full_data": {...}
  },
  "respiration": {
    "average": 14.5,
    "lowest": 12.0,
    "full_data": {...}
  }
}
```

### Sync Date to Database
```http
POST /api/sync/<date>
Headers:
  X-Email: your-email@example.com
  X-Password: your-password
```

**URL Parameters:**
- `date`: Date in format YYYY-MM-DD (e.g., 2026-01-15)

**Description:**
Fetches all data for the specified date from Garmin Connect and stores it in ALL database tables. This endpoint is perfect for syncing historical data or ensuring a specific date is up-to-date in your database.

**Response:**
```json
{
  "date": "2026-01-15",
  "email": "your-email@example.com",
  "sync_status": {
    "steps": "success",
    "heart_rate": "success",
    "sleep": "success",
    "stress": "success",
    "body_battery": "success",
    "activities": "success",
    "health_metrics": "success"
  },
  "summary": {
    "total_steps": 12500,
    "resting_hr": 58,
    "sleep_score": 85,
    "average_stress": 28.5,
    "body_battery_charged": 85,
    "activity_count": 2,
    "total_calories": 650,
    "vo2_max": 52.5,
    "training_readiness": 85
  },
  "database_status": "success",
  "message": "Successfully synced all data for 2026-01-15"
}
```

### Get All Data (Complete Dashboard Data)
```http
GET /api/all
Headers:
  X-Email: your-email@example.com
  X-Password: your-password
```

Returns combined data from ALL endpoints including:
- Steps
- Heart Rate
- Sleep
- Stress
- Body Battery
- Activities/Exercises
- Health Metrics (VO2 Max, HRV, Training Readiness, Hydration, etc.)

## Quick Start

### Option 1: Docker Compose (Recommended)

1. **Clone and navigate to the project:**
   ```bash
   cd "C:\Users\tobia\OneDrive\Desktop\GPT\Fit Buddy"
   ```

2. **Start services:**
   ```bash
   docker-compose up -d
   ```

3. **Initialize database:**
   ```bash
   docker-compose exec api python -c "from app import app, db; app.app_context().push(); db.create_all()"
   ```

4. **Test the API:**
   ```bash
   curl http://localhost:5000/health
   ```

### Option 2: Local Development

1. **Install PostgreSQL:**
   - Download from https://www.postgresql.org/download/
   - Create database: `createdb fitbuddy`

2. **Create virtual environment:**
   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set environment variables:**
   ```powershell
   $env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fitbuddy"
   $env:FLASK_ENV="development"
   ```

5. **Initialize database:**
   ```bash
   python -c "from app import app, db; app.app_context().push(); db.create_all()"
   ```

6. **Run the server:**
   ```bash
   python app.py
   ```

## Usage Examples

### Python (using requests)
```python
import requests

headers = {
    'X-Email': 'your-email@example.com',
    'X-Password': 'your-password'
}

# Get steps data
response = requests.get('http://localhost:5000/api/steps', headers=headers)
data = response.json()
print(f"Total steps: {data['total_steps']}")

# Get sleep data
response = requests.get('http://localhost:5000/api/sleep', headers=headers)
data = response.json()
print(f"Sleep score: {data['sleep_score']}")
```

### cURL
```bash
curl -X GET http://localhost:5000/api/steps \
  -H "X-Email: your-email@example.com" \
  -H "X-Password: your-password"
```

### JavaScript (fetch)
```javascript
fetch('http://localhost:5000/api/steps', {
  method: 'GET',
  headers: {
    'X-Email': 'your-email@example.com',
    'X-Password': 'your-password'
  }
})
.then(response => response.json())
.then(data => console.log(data));
```

## Database Schema

### Steps Data (`steps_data`)
- `id` (Primary Key)
- `email` (Indexed)
- `date` (Indexed, Unique with email)
- `total_steps`
- `hourly_data` (JSON)
- `full_data` (JSON)
- `created_at`, `updated_at`

### Heart Rate Data (`heart_rate_data`)
- `id` (Primary Key)
- `email` (Indexed)
- `date` (Indexed, Unique with email)
- `resting_hr`, `average_hr`, `max_hr`, `min_hr`
- `full_data` (JSON)
- `created_at`, `updated_at`

### Sleep Data (`sleep_data`)
- `id` (Primary Key)
- `email` (Indexed)
- `date` (Indexed, Unique with email)
- `sleep_score`, `sleep_duration_seconds`, `sleep_duration_minutes`
- `deep_sleep_seconds`, `light_sleep_seconds`, `rem_sleep_seconds`, `awake_seconds`
- `full_data` (JSON)
- `created_at`, `updated_at`

### Stress Data (`stress_data`)
- `id` (Primary Key)
- `email` (Indexed)
- `date` (Indexed, Unique with email)
- `rest_minutes`, `low_stress_minutes`, `medium_stress_minutes`, `high_stress_minutes`
- `average_stress`, `max_stress`
- `full_data` (JSON)
- `created_at`, `updated_at`

### Body Battery Data (`body_battery_data`)
- `id` (Primary Key)
- `email` (Indexed)
- `date` (Indexed, Unique with email)
- `charged`, `drained`
- `full_data` (JSON)
- `created_at`, `updated_at`

### Activity Data (`activity_data`)
- `id` (Primary Key)
- `email` (Indexed)
- `activity_id` (Indexed, Unique with email)
- `date` (Indexed)
- `activity_name`, `activity_type`
- `start_time`, `duration_seconds`
- `distance_meters`, `calories`
- `average_hr`, `max_hr`
- `average_speed`, `max_speed`
- `elevation_gain`, `average_cadence`
- `full_data` (JSON)
- `created_at`, `updated_at`

### Health Metrics Data (`health_metrics_data`)
- `id` (Primary Key)
- `email` (Indexed)
- `date` (Indexed, Unique with email)
- `vo2_max`, `fitness_age`
- `hrv_value`
- `training_readiness`, `training_status`
- `intensity_minutes_cardio`, `intensity_minutes_anaerobic`
- `hydration_ml`, `hydration_goal_ml`
- `floors_climbed`
- `average_spo2`, `lowest_spo2`
- `average_respiration`, `lowest_respiration`
- `full_data` (JSON)
- `created_at`, `updated_at`

## Deployment

### Heroku

1. **Create Heroku app:**
   ```bash
   heroku create your-app-name
   ```

2. **Add PostgreSQL:**
   ```bash
   heroku addons:create heroku-postgresql:hobby-dev
   ```

3. **Set environment variables:**
   ```bash
   heroku config:set FLASK_ENV=production
   ```

4. **Deploy:**
   ```bash
   git push heroku main
   ```

5. **Initialize database:**
   ```bash
   heroku run python -c "from app import app, db; app.app_context().push(); db.create_all()"
   ```

### AWS/DigitalOcean

1. Use the Dockerfile to build and deploy
2. Set up managed PostgreSQL database
3. Configure `DATABASE_URL` environment variable
4. Use a process manager like systemd or supervisor

## Security Notes

⚠️ **Important Security Considerations:**

1. **Production Deployment:**
   - Use HTTPS only
   - Consider implementing API keys or JWT tokens instead of headers
   - Use environment variables for sensitive data
   - Enable rate limiting
   - Use a reverse proxy (nginx) for additional security

2. **Credentials:**
   - Never commit `.env` files
   - Store credentials securely
   - Consider using a secrets manager (AWS Secrets Manager, etc.)

3. **Database:**
   - Use strong database passwords
   - Enable SSL connections
   - Restrict database access by IP

## Error Handling

The API returns appropriate HTTP status codes:

- `200`: Success
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (authentication failed)
- `429`: Too Many Requests (rate limit)
- `500`: Internal Server Error
- `503`: Service Unavailable (Garmin Connect down)

Example error response:
```json
{
  "error": "Authentication failed",
  "message": "Invalid Garmin Connect credentials"
}
```

## Logging

The application logs all requests and errors. In production, configure log aggregation:

- **Local**: Check console output
- **Docker**: `docker-compose logs -f api`
- **Production**: Use centralized logging (CloudWatch, Datadog, etc.)

## Troubleshooting

### Authentication Issues

If you get authentication errors:
1. Verify your Garmin Connect credentials
2. If MFA is enabled, authenticate manually first:
   ```bash
   cd python-garminconnect
   python example.py
   ```

### Database Connection Issues

1. Verify PostgreSQL is running: `pg_isready`
2. Check `DATABASE_URL` environment variable
3. Ensure database exists: `createdb fitbuddy`

### Docker Issues

1. Check container status: `docker-compose ps`
2. View logs: `docker-compose logs api`
3. Rebuild: `docker-compose up --build`

## Development

### Running Tests

```bash
pytest tests/
```

### Code Formatting

```bash
black app.py database.py utils.py
flake8 app.py database.py utils.py
```

## License

MIT License - See LICENSE file for details

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## Support

For issues or questions:
- Open an issue on GitHub
- Check the Garmin Connect Python library documentation

## Acknowledgments

- Built with [python-garminconnect](https://github.com/cyberjunky/python-garminconnect)
- Uses [Garth](https://github.com/matin/garth) for OAuth authentication
