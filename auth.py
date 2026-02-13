"""
Authentication module for Fit Buddy API.

Provides bcrypt password hashing, JWT token creation and verification,
and a Flask route decorator for protecting dashboard endpoints with
Bearer token authentication.

This module implements a single-user authentication system where the
authorized email and bcrypt-hashed password are stored in environment
variables. JWT tokens are issued on successful login and must be
included as a Bearer token in the Authorization header for all
protected endpoints.

Environment Variables:
    DASHBOARD_EMAIL: The authorized user's email address.
    DASHBOARD_PASSWORD_HASH: The bcrypt hash of the authorized password.
    JWT_SECRET_KEY: Secret key used to sign and verify JWT tokens.

Typical usage:
    # In a Flask route:
    @app.route('/api/protected')
    @require_dashboard_auth
    def protected_route(dashboard_email):
        return jsonify({'email': dashboard_email})
"""
import os
import datetime
import bcrypt
import jwt
from functools import wraps
from flask import request, jsonify

# The single authorized user
AUTHORIZED_EMAIL = os.getenv('DASHBOARD_EMAIL', 'tobolove@icloud.com')

# Pre-computed bcrypt hash of the dashboard password
AUTHORIZED_PASSWORD_HASH = os.getenv('DASHBOARD_PASSWORD_HASH', '')

# JWT configuration
JWT_SECRET = os.getenv('JWT_SECRET_KEY', 'fit-buddy-default-secret-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24


def generate_password_hash(plain_password):
    """
    Generate a bcrypt hash for a plaintext password.

    Creates a salted bcrypt hash suitable for secure password storage.
    The salt is automatically generated and embedded in the hash output.

    Args:
        plain_password (str): The plaintext password string to hash.
            Must be a non-empty string.

    Returns:
        str: A UTF-8 encoded string of the bcrypt hash, suitable for
            storage in environment variables or configuration files.
            Format: '$2b$12$<22-char-salt><31-char-hash>'

    Example:
        >>> hash_val = generate_password_hash('my_secure_password')
        >>> hash_val.startswith('$2b$12$')
        True
    """
    return bcrypt.hashpw(
        plain_password.encode('utf-8'),
        bcrypt.gensalt()
    ).decode('utf-8')


def verify_password(plain_password, hashed_password):
    """
    Verify a plaintext password against a stored bcrypt hash.

    Performs a constant-time comparison between the hash of the provided
    password and the stored hash, preventing timing attacks.

    Args:
        plain_password (str): The plaintext password submitted by the user
            during login.
        hashed_password (str): The stored bcrypt hash to compare against,
            as returned by generate_password_hash().

    Returns:
        bool: True if the password matches the hash, False otherwise.
            Returns False if either argument is empty or None.

    Example:
        >>> stored = generate_password_hash('secret')
        >>> verify_password('secret', stored)
        True
        >>> verify_password('wrong', stored)
        False
    """
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False


def create_jwt_token(email):
    """
    Create a signed JWT token for an authenticated user session.

    The token includes the user's email as the subject claim ('sub'),
    the issue time ('iat'), and an expiration time ('exp') set to
    JWT_EXPIRATION_HOURS from now.

    Args:
        email (str): The authenticated user's email address to encode
            as the token subject.

    Returns:
        str: A signed JWT token string that can be used as a Bearer
            token in the Authorization header.

    Example:
        >>> token = create_jwt_token('user@example.com')
        >>> isinstance(token, str)
        True
    """
    payload = {
        'sub': email,
        'iat': datetime.datetime.utcnow(),
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt_token(token):
    """
    Decode and validate a JWT token.

    Verifies the token signature using the JWT_SECRET and checks that
    the token has not expired. Returns the full decoded payload on success.

    Args:
        token (str): The JWT token string to decode and verify.

    Returns:
        dict: The decoded payload dictionary containing:
            - 'sub' (str): The user's email address.
            - 'iat' (int): Unix timestamp of when the token was issued.
            - 'exp' (int): Unix timestamp of when the token expires.

    Raises:
        jwt.ExpiredSignatureError: If the token's expiration time has passed.
        jwt.InvalidTokenError: If the token is malformed, has an invalid
            signature, or is otherwise not valid.
    """
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def require_dashboard_auth(f):
    """
    Flask route decorator that enforces JWT-based dashboard authentication.

    Expects an HTTP Authorization header with the format 'Bearer <token>'.
    Decodes and validates the JWT token, then passes the authenticated
    user's email as a keyword argument 'dashboard_email' to the decorated
    route handler function.

    If authentication fails, returns an appropriate JSON error response
    with a 401 status code. Expired tokens include a 'code' field set to
    'TOKEN_EXPIRED' so the frontend can distinguish between expired and
    invalid tokens.

    Args:
        f (callable): The Flask route handler function to protect.
            Must accept a 'dashboard_email' keyword argument.

    Returns:
        callable: The decorated function that enforces authentication
            before executing the original route handler.

    Example:
        @app.route('/api/protected')
        @require_dashboard_auth
        def my_route(dashboard_email):
            return jsonify({'user': dashboard_email})
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid authorization header'}), 401

        token = auth_header.split(' ', 1)[1]
        try:
            payload = decode_jwt_token(token)
            kwargs['dashboard_email'] = payload['sub']
            return f(*args, **kwargs)
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired', 'code': 'TOKEN_EXPIRED'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401

    return decorated_function
