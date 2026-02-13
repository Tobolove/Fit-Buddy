# How to Use Garmin Connect API

## Quick Start Guide

### 1. Authentication
The script will prompt you for:
- **Email**: Your Garmin Connect email address
- **Password**: Your Garmin Connect password
- **MFA Code** (if enabled): Enter if you have multi-factor authentication enabled

**Note**: After first login, tokens are saved to `~/.garminconnect` and valid for one year. You won't need to enter credentials again unless tokens expire.

### 2. Two Scripts Available

#### A. Simple Example (`example.py`)
- Shows basic authentication and today's stats
- Displays: steps, distance, calories, floors, hydration
- Good for getting started

#### B. Comprehensive Demo (`demo.py`)
- Interactive menu with 105+ API methods
- 12 categories organized by type:
  1. User & Profile
  2. Daily Health & Activity
  3. Advanced Health Metrics
  4. Historical Data & Trends
  5. Activities & Workouts
  6. Body Composition & Weight
  7. Goals & Achievements
  8. Device & Technical
  9. Gear & Equipment
  10. Hydration & Wellness
  11. System & Export
  12. Training Plans

### 3. Running the Scripts

**Activate virtual environment first:**
```powershell
.\.venv\Scripts\Activate.ps1
```

**Option 1: Simple Example**
```powershell
python example.py
```

**Option 2: Full Demo (Interactive Menu)**
```powershell
python demo.py
```

### 4. Environment Variables (Optional)

You can set these instead of typing credentials:
```powershell
$env:EMAIL="your-email@example.com"
$env:PASSWORD="your-password"
```

### 5. What Data You Can Access

**Daily Stats:**
- Steps, distance, calories, floors climbed
- Heart rate (resting, average, max)
- Sleep data
- Stress levels
- Hydration
- Body battery
- HRV (Heart Rate Variability)
- VO2 Max
- Training readiness

**Activities:**
- List all activities
- Download activity files (.fit, .gpx, .tcx)
- Upload activities
- Activity details and statistics

**Historical Data:**
- Weekly/monthly summaries
- Trends over time
- Progress tracking

### 6. Data Export

The demo script can export data to JSON files in the `your_data` directory.

---

**Security Note**: Tokens are stored locally in `~/.garminconnect`. Make sure to keep this directory secure.
