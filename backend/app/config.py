"""
Application Configuration
Centralized configuration for security, limits, and paths
"""
import os
from typing import List
from pathlib import Path


class Config:
    """Application configuration"""

    # Security: Allowed base directories for projects
    # Load from environment variable, fallback to safe defaults
    ALLOWED_BASE_DIRS: List[str] = os.getenv(
        'ALLOWED_PROJECT_DIRS',
        r'C:\Users\17175;C:\Users\17175\Desktop'
    ).split(';')

    # Terminal limits
    MAX_TERMINALS: int = int(os.getenv('MAX_TERMINALS', '10'))
    MAX_SUBSCRIBERS_PER_TERMINAL: int = int(os.getenv('MAX_SUBSCRIBERS_PER_TERMINAL', '5'))

    # Queue configuration
    OUTPUT_QUEUE_SIZE: int = int(os.getenv('OUTPUT_QUEUE_SIZE', '1000'))
    QUEUE_TIMEOUT: int = int(os.getenv('QUEUE_TIMEOUT', '5'))

    # Terminal configuration
    TERMINAL_SHELL: str = os.getenv('TERMINAL_SHELL', 'powershell.exe')
    TERMINAL_ENCODING: str = os.getenv('TERMINAL_ENCODING', 'utf-8')

    # Allowed commands (whitelist)
    ALLOWED_COMMANDS: List[str] = os.getenv(
        'ALLOWED_COMMANDS',
        'claude;python;node;npm;git'
    ).split(';')

    # Logging
    LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FILE: str = os.getenv('LOG_FILE', 'logs/terminal_manager.log')

    # Database
    DATABASE_URL: str = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost/terminal_db')

    # WebSocket
    WEBSOCKET_HOST: str = os.getenv('WEBSOCKET_HOST', 'localhost')
    WEBSOCKET_PORT: int = int(os.getenv('WEBSOCKET_PORT', '8000'))

    @classmethod
    def validate_path(cls, path: str) -> bool:
        """
        Validate path is within allowed directories (symlink-safe)

        Args:
            path: Path to validate

        Returns:
            bool: True if path is allowed
        """
        try:
            # Resolve all symlinks FIRST (critical for security)
            real_path = os.path.realpath(path)

            # Normalize to absolute path
            abs_path = os.path.abspath(real_path)

            # Check for path traversal attempts
            if '..' in Path(abs_path).parts:
                return False

            # Check against whitelist using resolved paths
            # SECURITY FIX: Use path component matching, not string prefix matching
            # This prevents C:\Data\Project_Secret being allowed by C:\Data\Project
            for base_dir in cls.ALLOWED_BASE_DIRS:
                resolved_base = os.path.realpath(base_dir)
                # Ensure base ends with separator for proper path boundary checking
                if not resolved_base.endswith(os.sep):
                    resolved_base = resolved_base + os.sep
                # Check if path is exactly the base or starts with base+separator
                if abs_path == resolved_base.rstrip(os.sep) or abs_path.startswith(resolved_base):
                    return True

            return False

        except Exception:
            return False

    @classmethod
    def get_allowed_dirs(cls) -> List[str]:
        """Get list of allowed base directories"""
        return cls.ALLOWED_BASE_DIRS


# Export singleton instance
config = Config()
