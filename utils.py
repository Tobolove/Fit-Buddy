"""
Utility functions for Fit Buddy API.
"""
import logging
import os
import sys
from pathlib import Path
from garth.exc import GarthException, GarthHTTPError

# Add the python-garminconnect to path
python_garmin_path = Path(__file__).parent / "python-garminconnect"
if python_garmin_path.exists():
    sys.path.insert(0, str(python_garmin_path))

try:
    from garminconnect import (
        Garmin,
        GarminConnectAuthenticationError,
    )
except ImportError as e:
    raise ImportError(
        f"Failed to import garminconnect. "
        f"Make sure the 'python-garminconnect' directory exists and dependencies are installed. "
        f"Run: cd python-garminconnect && pip install -e ."
    ) from e

logger = logging.getLogger(__name__)


def validate_credentials(email: str, password: str) -> bool:
    """
    Validate that credentials are non-empty strings.
    
    Args:
        email: Email address
        password: Password
    
    Returns:
        True if valid, False otherwise
    """
    if not email or not password:
        return False
    if not isinstance(email, str) or not isinstance(password, str):
        return False
    if not email.strip() or not password.strip():
        return False
    return True


def get_garmin_client(email: str, password: str):
    """
    Get authenticated Garmin client.
    
    This function handles authentication including:
    - Token reuse if available
    - MFA support
    - Token storage
    
    Args:
        email: Garmin Connect email
        password: Garmin Connect password
    
    Returns:
        Authenticated Garmin client instance
    
    Raises:
        GarminConnectAuthenticationError: If authentication fails
    """
    # Configure token storage per user (optional, could use single storage)
    # For now, use default location
    tokenstore = os.getenv("GARMINTOKENS", "~/.garminconnect")
    tokenstore_path = Path(tokenstore).expanduser()
    
    # Try to use existing tokens first
    try:
        garmin = Garmin()
        garmin.login(str(tokenstore_path))
        logger.info(f"Using cached tokens for {email}")
        return garmin
    except (FileNotFoundError, GarthHTTPError, GarminConnectAuthenticationError):
        # Tokens not available or expired, need to authenticate
        pass
    
    # Authenticate with credentials
    try:
        garmin = Garmin(
            email=email,
            password=password,
            is_cn=False,
            return_on_mfa=True
        )
        
        result1, result2 = garmin.login()
        
        # Handle MFA if required
        if result1 == "needs_mfa":
            # For API usage, MFA should be handled by the user
            # For now, we'll raise an error suggesting they authenticate manually first
            raise GarminConnectAuthenticationError(
                "Multi-factor authentication is required. "
                "Please authenticate manually using the example.py script first."
            )
        
        # Save tokens for future use
        garmin.garth.dump(str(tokenstore_path))
        logger.info(f"Authenticated and saved tokens for {email}")
        
        return garmin
        
    except GarminConnectAuthenticationError:
        raise
    except (GarthHTTPError, GarthException) as e:
        logger.error(f"Garth error during authentication: {e}")
        raise GarminConnectAuthenticationError(f"Authentication failed: {e}")
    except Exception as e:
        logger.error(f"Unexpected error during authentication: {e}")
        raise GarminConnectAuthenticationError(f"Authentication failed: {e}")
